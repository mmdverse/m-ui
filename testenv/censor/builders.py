"""سازندهٔ بایت‌های آزمون: ClientHello، رکورد TLS، و Initial واقعی QUIC.

این‌ها برای تست *قواعد* شبیه‌ساز لازم‌اند: بعضی رفتارها (مثل ECH روسیه یا SNI
داخل QUIC چین) را نمی‌شود با کلاینت واقعی ساخت، ولی می‌شود بایتش را ساخت.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import struct

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from parsers import QUIC_V1_SALT, _label


def ext(etype: int, data: bytes) -> bytes:
    return struct.pack(">HH", etype, len(data)) + data


def build_client_hello(
    sni: str = "www.microsoft.com",
    *,
    ech: bool = False,
    browser: bool = True,
    grease: bool | None = None,
    extra_exts: list[tuple[int, bytes]] | None = None,
) -> bytes:
    """ClientHello دست‌ساز. `browser=True` شبیه uTLS/chrome و `False` شبیه crypto/tls گو."""
    if grease is None:
        grease = browser
    ciphers = [0x0A0A, 0x1301, 0x1302, 0x1303, 0xC02B, 0xC02F] if grease else [0x1301, 0x1302, 0xC02B, 0xC02F]
    cs = b"".join(struct.pack(">H", c) for c in ciphers)

    body = struct.pack(">H", 0x0303) + os.urandom(32)
    sid = os.urandom(32) if browser else b""
    body += bytes([len(sid)]) + sid
    body += struct.pack(">H", len(cs)) + cs + b"\x01\x00"

    exts: list[bytes] = []
    host = sni.encode()
    exts.append(ext(0x0000, struct.pack(">H", len(host) + 3) + b"\x00" + struct.pack(">H", len(host)) + host))
    exts.append(ext(0x000A, struct.pack(">H", 2) + struct.pack(">H", 0x001D)))
    exts.append(ext(0x000B, b"\x01\x00"))
    alpn = b"\x02h2\x08http/1.1" if browser else b"\x08http/1.1"
    exts.append(ext(0x0010, struct.pack(">H", len(alpn)) + alpn))
    sigs = [0x0403, 0x0804, 0x0401, 0x0503, 0x0805, 0x0501, 0x0806, 0x0601] if browser else [0x0403]
    sa = b"".join(struct.pack(">H", s) for s in sigs)
    exts.append(ext(0x000D, struct.pack(">H", len(sa)) + sa))
    exts.append(ext(0x002B, b"\x02\x03\x04"))
    exts.append(
        ext(0x0033, struct.pack(">H", 6) + struct.pack(">H", 0x001D) + struct.pack(">H", 2) + b"\x00\x01")
    )
    if browser:
        for etype, data in ((0x0017, b""), (0x0023, b""), (0x0005, b"\x01\x00\x00\x00\x00"), (0x0012, b""), (0x002D, b"\x01\x01")):
            exts.append(ext(etype, data))
    if ech:
        exts.append(ext(0xFE0D, b"\x00" * 16))
    exts.extend(extra_exts or [])

    blob = b"".join(exts)
    body += struct.pack(">H", len(blob)) + blob
    return b"\x01" + struct.pack(">I", len(body))[1:] + body


def tls_stream(handshake: bytes, *, records: int = 1) -> bytes:
    """پیچیدن handshake در یک یا دو رکورد TLS (`records=2` = تکه‌سازی لایهٔ رکورد)."""
    if records == 1:
        return b"\x16\x03\x01" + struct.pack(">H", len(handshake)) + handshake
    half = len(handshake) // 2
    return (
        b"\x16\x03\x01"
        + struct.pack(">H", half)
        + handshake[:half]
        + b"\x16\x03\x01"
        + struct.pack(">H", len(handshake) - half)
        + handshake[half:]
    )


def app_record(payload: bytes) -> bytes:
    return b"\x17\x03\x03" + struct.pack(">H", len(payload)) + payload


def split_chunks(stream: bytes, parts: int = 2) -> list[bytes]:
    """یک استریم را به چند «سگمنت TCP» می‌شکند."""
    if parts == 1:
        return [stream]
    size = len(stream) // parts
    out = []
    for i in range(parts - 1):
        out.append(stream[i * size : (i + 1) * size])
    out.append(stream[(parts - 1) * size :])
    return out


def build_quic_initial(
    handshake: bytes,
    *,
    version: int = 0x00000001,
    payload_len: int = 1200,
    dcid: bytes = b"\x01\x02\x03\x04\x05\x06\x07\x08",
    scid: bytes = b"\x11\x12\x13\x14\x15\x16\x17\x18",
) -> bytes:
    """Initial با رمزنگاری واقعی QUIC (کلیدها از dcid مشتق می‌شوند، مثل RFC 9001)."""
    pn_len = 4
    pn = 0
    header_prefix = (
        bytes([0xC0 | (pn_len - 1)])
        + struct.pack(">I", version)
        + bytes([len(dcid)])
        + dcid
        + bytes([len(scid)])
        + scid
        + b"\x00"  # token length = 0
    )
    # فریم‌ها: CRYPTO + PADDING تا رسیدن به طول دلخواه
    offset_varint = b"\x00"
    crypto_hdr = b"\x06" + offset_varint + _varint_encode(len(handshake))
    frames = crypto_hdr + handshake
    pad = payload_len - len(frames)
    assert pad >= 0, "payload_len کوچک‌تر از خودِ handshake است"
    plaintext = frames + b"\x00" * pad

    length_value = pn_len + len(plaintext) + 16
    length_field = _varint_encode(length_value)
    aad = header_prefix + length_field + pn.to_bytes(pn_len, "big")

    initial_secret = hmac.new(QUIC_V1_SALT, dcid, hashlib.sha256).digest()
    secret = HKDF(algorithm=hashes.SHA256(), length=32, salt=initial_secret, info=_label("client in")).derive(b"")
    key = HKDF(algorithm=hashes.SHA256(), length=16, salt=secret, info=_label("quic key")).derive(b"")
    iv = HKDF(algorithm=hashes.SHA256(), length=12, salt=secret, info=_label("quic iv")).derive(b"")
    nonce = bytearray(iv)
    nonce[11] ^= pn & 0xFF
    ciphertext = AESGCM(key).encrypt(bytes(nonce), plaintext, aad)
    return aad + ciphertext


def _varint_encode(value: int) -> bytes:
    if value < 0x40:
        return bytes([value])
    if value < 0x4000:
        return struct.pack(">H", value | 0x4000)
    if value < 0x40000000:
        return struct.pack(">I", value | 0x80000000)
    return struct.pack(">Q", value | 0xC000000000000000)

"""
پارسرهای «آن‌طرفِ» فیلتر: همان چیزی که DPI می‌بیند.

هر پارسر از رفتار مستندشدهٔ یک فیلتر واقعی آمده:
  * TLS ClientHello: SNI، افزونهٔ ECH (0xfe0d)، مرز رکوردها، ALPN، GREASE
  * GFW «ترافیک کاملاً رمز» (USENIX Sec'23): پنج قاعدهٔ معافیت — اثرانگشت پروتکل،
    تست زبرِ آنتروپی روی popcount، نسبت ASCII چاپی، طولانی‌ترین رشتهٔ چاپی،
    ۶ بایت اول
  * QUIC Initial: رمزگشایی واقعی با salt نسخهٔ ۱ (همان کاری که GFW از آوریل ۲۰۲۴
    می‌کند) تا SNI داخلش در بیاید
  * اثرانگشت پروتکلی: WireGuard (بستهٔ ۱۴۸ بایتی نوع ۱)، OpenVPN (اپکد)، SSH (بنر)
"""
from __future__ import annotations

import hashlib
import hmac
import struct
from dataclasses import dataclass, field

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

TLS_HANDSHAKE = 0x16
TLS_APP_DATA = 0x17
EXT_SNI = 0x0000
EXT_ALPN = 0x0010
EXT_SIG_ALGS = 0x000D
EXT_SUPPORTED_VERSIONS = 0x002B
EXT_KEY_SHARE = 0x0033
EXT_ECH = 0xFE0D

QUIC_V1_SALT = bytes.fromhex("38762cf7f55934b34d179ae6a4c80cadccbb7f0a")
QUIC_V1 = 0x00000001
QUIC_V2 = 0x6B3343CF

HTTP_METHODS = (b"GET ", b"POST", b"HEAD", b"PUT ", b"OPTI", b"CONN", b"DELE", b"PATC", b"TRAC")


# ── TLS ────────────────────────────────────────────────────────────────────


@dataclass
class Record:
    ctype: int
    version: int
    length: int
    start: int
    end: int


def split_records(buf: bytes) -> tuple[list[Record], int]:
    """رکوردهای کاملِ TLS؛ مقدار دوم = بایتی که از آن‌به‌بعد ناقص است."""
    out: list[Record] = []
    i = 0
    while i + 5 <= len(buf):
        ctype = buf[i]
        if ctype not in (0x14, 0x15, 0x16, 0x17, 0x18):
            return out, i  # چیزِ ناشناخته: از این‌جا به بعد TLS نیست
        version = struct.unpack(">H", buf[i + 1 : i + 3])[0]
        length = struct.unpack(">H", buf[i + 3 : i + 5])[0]
        if length > 0x4800:  # سقف واقعی TLS
            return out, i
        if i + 5 + length > len(buf):
            return out, i
        out.append(Record(ctype, version, length, i, i + 5 + length))
        i += 5 + length
    return out, i


def handshake_bytes(buf: bytes, records: list[Record]) -> bytes:
    """بدنهٔ رکوردهای handshake را به هم می‌چسباند (بازچینش، مثل DPI)."""
    out = bytearray()
    for r in records:
        if r.ctype == TLS_HANDSHAKE:
            out += buf[r.start + 5 : r.end]
    return bytes(out)


def _u16(b: bytes, i: int) -> int:
    return struct.unpack(">H", b[i : i + 2])[0]


def parse_client_hello(buf: bytes) -> dict | None:
    """ClientHello را از روی *بازچینش‌شدهٔ* استریم می‌خواند — دقیقاً همان کاری که
    TSPU/GFW می‌کنند، به همین دلیل تکه‌سازی ساده SNI را پنهان نمی‌کند.

    ورودی ناقص (استریم نصفه در میان بازچینش) باید None بدهد، نه استثنا: DPI
    هم روی بایت‌های ناقص نمی‌ترکد، فقط صبر می‌کند.
    """
    try:
        return _parse_client_hello(buf)
    except (struct.error, IndexError, ValueError):
        return None


def _parse_client_hello(buf: bytes) -> dict | None:
    records, _ = split_records(buf)
    hs = handshake_bytes(buf, records)
    if len(hs) < 4 or hs[0] != 0x01:
        return None
    length = (hs[1] << 16) | (hs[2] << 8) | hs[3]
    body = hs[4 : 4 + length]
    if len(body) < 34:
        return None

    i = 34  # legacy_version(2) + random(32)
    sid_len = body[i]
    i += 1 + sid_len
    cs_len = _u16(body, i)
    cs = list(struct.unpack(f">{cs_len // 2}H", body[i + 2 : i + 2 + cs_len]))
    i += 2 + cs_len
    comp_len = body[i]
    i += 1 + comp_len
    if i + 2 > len(body):
        return None
    ext_len = _u16(body, i)
    i += 2
    exts: list[tuple[int, bytes]] = []
    end = min(i + ext_len, len(body))
    while i + 4 <= end:
        etype = _u16(body, i)
        elen = _u16(body, i + 2)
        if i + 4 + elen > len(body):
            break  # افزونهٔ ناقص: بقیه را نمی‌شود خواند
        exts.append((etype, body[i + 4 : i + 4 + elen]))
        i += 4 + elen

    info: dict = {
        "sni": None,
        "ech": False,
        "legacy_version": _u16(body, 0) if len(body) >= 2 else 771,
        "ext_types": [t for t, _ in exts],
        "ciphers": cs,
        "alpn": [],
        "sig_algs": [],
        "grease": any((c & 0x0F0F) == 0x0A0A for c in cs) or any((t & 0x0F0F) == 0x0A0A for t, _ in exts),
        "ext_raw": exts,
        "record_count": len(records),
        "hello_offset": None,
        "hello_len": 4 + len(body),
    }
    # آیا ClientHello روی چند رکورد TLS پخش شده؟ (تکه‌سازی لایهٔ رکورد)
    hello_start, hello_end = 5, 5 + 4 + len(body)  # بعد از هدر رکورد اول
    info["record_split"] = len([r for r in records if r.ctype == TLS_HANDSHAKE]) > 1
    info["hello_offset"], info["hello_end"] = hello_start, hello_end

    for etype, data in exts:
        if etype == EXT_SNI and len(data) >= 5:
            # server_name_list: len(2) + type(1) + len(2) + name
            sname = data[5 : 5 + _u16(data, 3)]
            if not sname:
                continue
            info["sni"] = sname.decode("ascii", "replace").lower()
            info["sni_offset_in_ext"] = 3
        elif etype == EXT_ALPN and len(data) >= 2:
            j = 2
            while j < len(data):
                n = data[j]
                info["alpn"].append(data[j + 1 : j + 1 + n].decode("ascii", "replace"))
                j += 1 + n
        elif etype == EXT_SIG_ALGS and len(data) >= 2:
            n = _u16(data, 0)
            if 2 + n <= len(data):
                info["sig_algs"] = list(struct.unpack(f">{n // 2}H", data[2 : 2 + n]))
        elif etype == EXT_ECH:
            info["ech"] = True
    info["ja3"] = ja3(info)
    info["ja4"] = ja4(info)
    return info


def first_application_record(buf: bytes) -> tuple[int, bool] | None:
    """طول اولین رکورد application-data سمت کلاینت، اگر کامل رسیده باشد."""
    records, _ = split_records(buf)
    for r in records:
        if r.ctype == TLS_APP_DATA:
            return r.length, True
    return None


def application_records(buf: bytes, limit: int = 6) -> list[int]:
    """طول رکوردهای application-data سمت کلاینت (به ترتیب).

    تشخیص TLS-in-TLS در دنیای واقعی روی *الگوی* اندازهٔ رکوردها کار می‌کند، نه
    فقط اولین رکورد: تونلی که یک دست‌دادنِ TLS را حمل می‌کند، بعد از هدرِ کوچکِ
    پروتکل یک رکورد ۳۰۰–۷۰۰ بایتی (ClientHello درونی) می‌فرستد.
    """
    records, _ = split_records(buf)
    return [r.length for r in records if r.ctype == TLS_APP_DATA][:limit]


def sni_split_across_segments(chunks: list[bytes], hello: dict) -> bool:
    """آیا مرز سگمنت TCP داخل ClientHello افتاده؟ (نصفِ شرطِ عبور از ECH روسیه)"""
    if len(chunks) < 2:
        return False
    total = 0
    bounds = []
    for c in chunks:
        total += len(c)
        bounds.append(total)
    hello_len = hello.get("hello_len") or 0
    return any(0 < b < hello_len + 5 for b in bounds)


# ── قواعد «ترافیک کاملاً رمز» گوگل‌فایر ─────────────────────────────────────


def _printable(b: int) -> bool:
    return 0x20 <= b <= 0x7E


def fep_stats(payload: bytes) -> dict:
    if not payload:
        return {"popcount": 0.0, "ascii_fraction": 0.0, "max_run": 0}
    popcount = sum(bin(b).count("1") for b in payload) / (8 * len(payload))
    ascii_fraction = sum(1 for b in payload if _printable(b)) / len(payload)
    run = best = 0
    for b in payload:
        run = run + 1 if _printable(b) else 0
        best = max(best, run)
    return {"popcount": popcount, "ascii_fraction": ascii_fraction, "max_run": best}


def fep_exempt(payload: bytes, rule: dict) -> tuple[bool, str]:
    """آیا این payload از فیلتر «کاملاً رمز» معاف است؟

    معافیت‌های پیاده‌شده: اثرانگشت پروتکل، ۶ بایت اول قابل‌چاپ، نسبت ASCII
    قابل‌چاپ، و طولانی‌ترین رشتهٔ قابل‌چاپ. «تست popcount» که در مقاله
    (USENIX Sec'23) به‌عنوان تست زبرِ آنتروپی آمده این‌جا فقط *ثبت* می‌شود و
    در آمار `detail` می‌آید — چون رفتار مشاهده‌شدهٔ GFW این است که دادهٔ
    تصادفیِ کامل مسدود می‌شود، و اگر popcount معاف‌کننده بود، همان داده رد
    می‌شد. در `testenv/censor/README.md` صریح توضیح داده شده.
    """
    if not payload:
        return True, "empty"
    if payload[:1] == b"\x16" or payload.startswith(HTTP_METHODS) or payload.startswith(b"SSH-"):
        return True, "protocol-fingerprint"
    stats = fep_stats(payload)
    if stats["ascii_fraction"] > rule["asciiFraction"]:
        return True, "printable-fraction"
    if stats["max_run"] >= rule["asciiRun"]:
        return True, "printable-run"
    if all(_printable(b) for b in payload[: rule["printablePrefix"]]):
        return True, "printable-prefix"
    return False, "fully-encrypted"


# ── اثرانگشت پروتکل‌های VPN ────────────────────────────────────────────────


def is_wireguard_init(payload: bytes, fingerprints: dict) -> bool:
    return len(payload) == fingerprints["wireguardInitLength"] and payload[0] == fingerprints["wireguardMsgType"]


def is_openvpn(payload: bytes, fingerprints: dict) -> bool:
    return len(payload) >= 2 and payload[0] == 0x00 and payload[1] in fingerprints["openvpnOpcodes"]


def is_ssh(payload: bytes) -> bool:
    return payload.startswith(b"SSH-")


def _grease(v: int) -> bool:
    return (v & 0x0F0F) == 0x0A0A


def _ext_body(hello: dict, etype: int) -> bytes:
    for t, body in hello.get("ext_raw", []):
        if t == etype:
            return body
    return b""


def ja3(hello: dict) -> str:
    """اثرانگشت JA3 کلاسیک: md5(version,ciphers,extensions,curves,point_formats).

    GREASE حذف می‌شود (طبق تعریف JA3). برای لایهٔ «اثرانگشت مرورگر» در امارات
    به این مقدار نیاز داریم چون فیلتر آن‌جا اجازهٔ مرورگرهای شناخته‌شده را
    می‌دهد و بقیه را «ابزار» می‌داند.
    """
    if not hello:
        return ""
    ciphers = [c for c in hello.get("ciphers", []) if not _grease(c)]
    exts = [t for t in hello.get("ext_types", []) if not _grease(t)]
    groups_raw = _ext_body(hello, 0x000A)
    curves: list[int] = []
    if len(groups_raw) >= 2:
        n = min(_u16(groups_raw, 0), max(0, len(groups_raw) - 2))
        for i in range(0, n - 1, 2):
            v = _u16(groups_raw, 2 + i)
            if not _grease(v):
                curves.append(v)
    pf_raw = _ext_body(hello, 0x000B)
    points: list[int] = []
    if pf_raw:
        n = min(pf_raw[0], max(0, len(pf_raw) - 1))
        points = list(pf_raw[1 : 1 + n])
    parts = [
        str(hello.get("legacy_version", 771)),
        "-".join(str(c) for c in ciphers),
        "-".join(str(t) for t in exts),
        "-".join(str(c) for c in curves),
        "-".join(str(p) for p in points),
    ]
    return hashlib.md5(",".join(parts).encode()).hexdigest()


def _tls_version_code(hello: dict) -> str:
    """کد نسخهٔ TLS به سبک JA4: «13» برای TLS1.3، «12» برای 1.2 و ..."""
    ext = _ext_body(hello, 0x002B)  # supported_versions
    versions: list[int] = []
    if len(ext) >= 3:  # 1 بایت طول فهرست + فهرست 2 بایتی نسخه‌ها
        count = min(ext[0], (len(ext) - 1) // 2)
        versions = [_u16(ext, 1 + 2 * i) for i in range(count)]
    elif len(ext) == 2:  # بعضی کلاینت‌ها نسخهٔ تکی می‌فرستند
        versions = [_u16(ext, 0)]
    # کرومِ uTLS نسخهٔ GREASE را اول فهرست می‌گذارد؛ اگر فیلترش نکنیم نسخهٔ
    # «00» می‌شود و JA4 با کروم واقعی نمی‌خورد (این باگ یک‌بار واقعاً رخ داد).
    versions = [v for v in versions if not _grease(v)] or [hello.get("legacy_version") or 0]
    return {0x0304: "13", 0x0303: "12", 0x0302: "11", 0x0301: "10"}.get(max(versions), "00")


def _sha12(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:12]


def ja4(hello: dict) -> str:
    """اثرانگشت کانونیکال (سبک JA4).

    چرا JA3 کافی نیست؟ اندازه‌گیری ما روی xray 26.3.27 نشان داد JA3 برای
    uTLS/chrome بین اتصال‌ها *عوض می‌شود*: کروم ترتیب چند extension را تصادفی
    می‌کند و uTLS همان را تقلید می‌کند (همین باعث شد JA3 سه اتصال متفاوت بدهد).
    JA4 هر دو فهرست را مرتب می‌کند و به شمارش‌ها تکیه می‌کند، پس پایدار است —
    دقیقاً به همین دلیل سانسوری که می‌خواهد «مرورگر مجاز است» را پیاده کند
    چاره‌ای جز JA4 ندارد. این پیاده‌سازی همان قرارداد JA4 را دارد:
      a = t/q + نسخه + SNI + تعداد سیفر + تعداد extension + ALPN
      b = sha256(سیفرهای مرتب‌شده)
      c = sha256(extensionهای مرتب‌شده + '_' + sig-algهای مرتب‌شده)
    """
    if not hello:
        return ""
    ciphers = sorted(c for c in hello.get("ciphers", []) if not _grease(c))
    exts = sorted(t for t in hello.get("ext_types", []) if not _grease(t))
    alpn = hello.get("alpn") or []
    first = alpn[0] if alpn else ""
    alpn_code = (first[:1] + first[-1:]) if first else "00"
    part_a = "{ver}{sni}{cc:02d}{ec:02d}{alpn}".format(
        ver=_tls_version_code(hello),
        sni="d" if hello.get("sni") else "i",
        cc=min(len(ciphers), 99),
        ec=min(len(exts), 99),
        alpn=alpn_code,
    )
    sigs = sorted(hello.get("sig_algs", []))
    part_b = _sha12(",".join(f"{c:04x}" for c in ciphers))
    part_c = _sha12(",".join(f"{e:04x}" for e in exts) + "_" + ",".join(f"{v:04x}" for v in sigs))
    return f"t{part_a}_{part_b}_{part_c}"


def ja4_like(hello: dict) -> tuple[bool, str]:
    """معادلِ زبرِ JA4 برای «شبیه مرورگر است یا نه».

    UAE روی اثرانگشت TLS سخت‌گیر است: کلاینتی که GREASE و ALPN=h2 و فهرست
    سیگنیچرِ کامل ندارد، از دید فیلتر «ابزار» است نه مرورگر. uTLS با
    fingerprint=chrome هر سه را دارد؛ crypto/tls گو نداشت.
    """
    if not hello:
        return False, "no-client-hello"
    if not hello["grease"]:
        return False, "no-grease"
    if "h2" not in hello["alpn"]:
        return False, "no-h2-alpn"
    if len(hello["sig_algs"]) < 8 or len(hello["ext_types"]) < 10:
        return False, "thin-client-hello"
    return True, "browser-like"


# ── QUIC ───────────────────────────────────────────────────────────────────


def _varint(b: bytes, i: int) -> tuple[int, int]:
    if i >= len(b):
        return 0, i
    prefix = b[i] >> 6
    if prefix == 0:
        return b[i] & 0x3F, i + 1
    if prefix == 1:
        return struct.unpack(">H", b[i : i + 2])[0] & 0x3FFF, i + 2
    if prefix == 2:
        return struct.unpack(">I", b[i : i + 4])[0] & 0x3FFFFFFF, i + 4
    return struct.unpack(">Q", b[i : i + 8])[0] & 0x3FFFFFFFFFFFFFFF, i + 8


def parse_long_header(pkt: bytes) -> dict | None:
    if len(pkt) < 7 or not (pkt[0] & 0x80):
        return None
    version = struct.unpack(">I", pkt[1:5])[0]
    i = 5
    dcid_len = pkt[i]
    dcid = pkt[i + 1 : i + 1 + dcid_len]
    i += 1 + dcid_len
    scid_len = pkt[i]
    scid = pkt[i + 1 : i + 1 + scid_len]
    i += 1 + scid_len
    if version == 0:
        return {"version": version, "dcid": dcid, "scid": scid, "payload_len": len(pkt)}
    token_len, i = _varint(pkt, i)
    i += token_len
    length, i = _varint(pkt, i)
    pn_len = (pkt[0] & 0x03) + 1
    return {
        "version": version,
        "dcid": dcid,
        "scid": scid,
        "length": length,
        "pn_offset": i,
        "pn_len": pn_len,
        "payload_len": len(pkt),
        "is_initial": (pkt[0] & 0xF0) == 0xC0,
    }


def _label(name: str, context: bytes = b"") -> bytes:
    """HKDF-Expand-Label همان‌طور که QUIC تعریف کرده (بدون پیشوند «tls13 »)."""
    return struct.pack(">H", len(name)) + name.encode() + bytes([len(context)]) + context


def decrypt_initial_v1(pkt: bytes) -> bytes | None:
    """رمزگشایی واقعی Initial نسخهٔ ۱ — همان کاری که GFW از ۷ آوریل ۲۰۲۴ می‌کند."""
    hdr = parse_long_header(pkt)
    if not hdr or hdr["version"] != QUIC_V1 or not hdr.get("is_initial") or not hdr["dcid"]:
        return None
    pn_offset = hdr["pn_offset"]
    pn_len = hdr["pn_len"]
    initial_secret = hmac.new(QUIC_V1_SALT, hdr["dcid"], hashlib.sha256).digest()
    secret = HKDF(algorithm=hashes.SHA256(), length=32, salt=initial_secret, info=_label("client in")).derive(b"")
    key = HKDF(algorithm=hashes.SHA256(), length=16, salt=secret, info=_label("quic key")).derive(b"")
    iv = HKDF(algorithm=hashes.SHA256(), length=12, salt=secret, info=_label("quic iv")).derive(b"")
    pn_bytes = pkt[pn_offset : pn_offset + pn_len]
    pn = int.from_bytes(pn_bytes, "big")
    nonce = bytearray(iv)
    for k in range(8):
        nonce[11 - k] ^= (pn >> (8 * k)) & 0xFF
    aad = pkt[: pn_offset + pn_len]
    try:
        return AESGCM(key).decrypt(bytes(nonce), pkt[pn_offset + pn_len :], aad)
    except Exception:
        return None


def quic_client_hello(pkt: bytes) -> dict | None:
    plain = decrypt_initial_v1(pkt)
    if plain is None:
        return None
    i = 0
    crypto = bytearray()
    while i < len(plain):
        ftype = plain[i]
        if ftype == 0x00:  # PADDING
            i += 1
            continue
        if ftype == 0x01:  # PING
            i += 1
            continue
        if ftype == 0x06:  # CRYPTO
            off, i = _varint(plain, i + 1)
            ln, i = _varint(plain, i)
            crypto += plain[i : i + ln]
            i += ln
            continue
        if ftype in (0x02, 0x03):  # ACK
            _largest, i = _varint(plain, i + 1)
            _delay, i = _varint(plain, i)
            n_ranges, i = _varint(plain, i)
            _first, i = _varint(plain, i)
            for _ in range(n_ranges):
                _gap, i = _varint(plain, i)
                _rlen, i = _varint(plain, i)
            continue
        break  # فریم ناشناخته → ادامه نده
    if len(crypto) < 5 or crypto[0] != 0x01:
        return None
    fake = bytes([TLS_HANDSHAKE, 0x03, 0x03]) + struct.pack(">H", min(len(crypto), 0xFFFF)) + bytes(crypto)
    return parse_client_hello(fake)


def hexdump_head(b: bytes, n: int = 32) -> str:
    return " ".join(f"{x:02x}" for x in b[:n])


@dataclass
class Flow:
    """وضعیت یک جریان از دید فیلتر."""

    country: str
    dport: int
    chunks: list[bytes] = field(default_factory=list)
    buffer: bytes = b""
    hello: dict | None = None
    tls: bool = False
    decided: str | None = None
    first_app_len: int | None = None
    tin_tls_checked: bool = False
    bytes_seen: int = 0

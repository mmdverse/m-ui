"""
موتورِ سانسور: قاعده‌های مستندشدهٔ هر کشور را روی بایت‌های واقعی اجرا می‌کند.

قاعده‌ها از `rules.json` می‌آیند که خودش از `src/lib/censorship/countries.ts`
ساخته می‌شود؛ پس اگر مدل TS عوض شود و شبیه‌ساز به‌روز نشود، تست vitest
(`tests/censorship.test.ts`) شکست می‌خورد.
"""
from __future__ import annotations

import json
import pathlib
from dataclasses import dataclass, field

from parsers import (
    Flow,
    application_records,
    fep_exempt,
    fep_stats,
    first_application_record,
    is_openvpn,
    is_ssh,
    is_wireguard_init,
    ja4_like,
    parse_client_hello,
    parse_long_header,
    quic_client_hello,
    split_records,
)

RULES_PATH = pathlib.Path(__file__).with_name("rules.json")

#: لایه‌هایی که این شبیه‌ساز واقعاً می‌تواند مسدود کند. `selftest.py` تضمین می‌کند
#: هر لایهٔ «شبیه‌سازی‌شده» در rules.json این‌جا وجود داشته باشد.
IMPLEMENTED_LAYERS = {
    "sni_block",
    "sni_whitelist",
    "ech_drop",
    "reassembly",
    "proto_whitelist",
    "proto_fingerprint",
    "fep_detect",
    "quic_sni",
    "quic_v1_fingerprint",
    "ja4_fingerprint",
}


@dataclass
class Decision:
    """allowed=None یعنی «هنوز بایت کافی نیامده»."""

    allowed: bool | None
    layer: str | None = None
    reason: str = ""
    detail: dict = field(default_factory=dict)

    @property
    def blocked(self) -> bool:
        return self.allowed is False


def load_rules(path: pathlib.Path = RULES_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


class Censor:
    """شبیه‌سازِ فیلتر یک کشور روی یک جریان."""

    def __init__(self, country: str, doc: dict | None = None):
        self.doc = doc or load_rules()
        self.country = country
        self.layers: list[str] = self.doc["countryLayers"][country]
        self.lists: dict = self.doc["lists"][country]
        self.fingerprints: dict = self.doc["fingerprints"]

    # ── UDP / QUIC ────────────────────────────────────────────────────────
    def inspect_udp(self, payload: bytes, dport: int) -> Decision:
        quic = self.lists.get("quic")
        if "proto_whitelist" in self.layers:
            return Decision(False, "proto_whitelist", "udp-not-whitelisted", {"dport": dport})
        if not quic or not payload or dport not in quic["dports"]:
            return Decision(True, None, "no-udp-rule")
        hdr = parse_long_header(payload)
        if not hdr:
            return Decision(True, None, "not-quic-long-header")
        version = hdr["version"]
        big = len(payload) >= quic["minPayload"]

        if "quic_v1_fingerprint" in self.layers and big and version == 0x00000001:
            # TSPU: هر UDP به ۴۴۳ با QUIC نسخهٔ ۱ و ≥۱۰۰۱ بایت → کل جریان می‌افتد.
            return Decision(False, "quic_v1_fingerprint", "quic-v1-big-initial", {"version": hex(version), "len": len(payload)})

        if "quic_sni" in self.layers and big and version == 0x00000001:
            hello = quic_client_hello(payload)
            if hello is None:
                # اگر چیزی برای خواندن نیست، فیلتر هم چیزی نمی‌بیند (وگرنه
                # هر Initial خرابِ یک نرم‌افزار دیگر هم قربانی می‌شد).
                return Decision(True, None, "undecryptable-v1-initial", {})
            sni = hello.get("sni")
            blocked = self._sni_blocked(sni)
            if blocked:
                return Decision(False, "quic_sni", "quic-sni-blocked", {"sni": sni, "residual": "180s"})
            return Decision(True, None, "quic-sni-clean", {"sni": sni})

        if version not in (0x00000001,):
            # نکتهٔ کلیدی مقالهٔ USENIX'25: Initial با نسخهٔ ناشناس رمزگشایی‌ناپذیر است.
            return Decision(True, None, "unknown-version-undecryptable", {"version": hex(version)})
        return Decision(True, None, "below-inspection-threshold", {"len": len(payload)})

    # ── TCP ───────────────────────────────────────────────────────────────
    def observe(self, flow: Flow, data: bytes) -> Decision:
        flow.chunks.append(data)
        flow.buffer += data
        flow.bytes_seen += len(data)
        try:
            return self._evaluate(flow)
        except Exception as exc:  # شبیه‌ساز هرگز نباید کرش کند و تصمیم الکی بگیرد
            return Decision(None, None, f"parser-error:{type(exc).__name__}", {})

    def _sni_blocked(self, sni: str | None) -> bool:
        if not sni:
            return False
        return any(sni == d or sni.endswith("." + d) for d in self.lists.get("sniBlocked", []))

    def _sni_allowed_only(self, sni: str | None) -> bool:
        allowed = self.lists.get("sniAllowOnly")
        if not allowed:
            return True  # این کشور حالت وایت‌لیست ندارد
        if not sni:
            return False
        for entry in allowed:
            if entry.startswith(".") and (sni.endswith(entry) or sni == entry[1:]):
                return True
            if sni == entry or sni.endswith("." + entry):
                return True
        return False

    def _evaluate(self, flow: Flow) -> Decision:
        buf = flow.buffer
        if not buf:
            return Decision(None, None, "no-bytes")

        if flow.dport in self.lists.get("portsBlocked", []):
            return Decision(False, "proto_whitelist", "blocked-port", {"dport": flow.dport})

        if buf[0] == 0x16:  # TLS handshake record
            return self._evaluate_tls(flow)

        # ── ترافیک غیر TLS ──
        if is_wireguard_init(buf, self.fingerprints) and "proto_fingerprint" in self.layers:
            return Decision(False, "proto_fingerprint", "wireguard-initiation", {"len": len(buf)})
        if is_openvpn(buf, self.fingerprints) and "proto_fingerprint" in self.layers:
            return Decision(False, "proto_fingerprint", "openvpn-opcode", {"opcode": buf[1]})
        if is_ssh(buf) and "proto_fingerprint" in self.layers:
            return Decision(False, "proto_fingerprint", "ssh-banner", {})

        if buf[:4] in (b"GET ", b"POST", b"HEAD", b"PUT ", b"OPTI", b"CONN", b"DELE") or buf[:5] == b"PATCH":
            if "sni_whitelist" in self.layers:
                return Decision(False, "sni_whitelist", "plaintext-http-not-whitelisted", {})
            return Decision(True, None, "plain-http-allowed", {})

        if "proto_whitelist" in self.layers:
            return Decision(False, "proto_whitelist", "non-whitelisted-protocol", {"first": buf[:4].hex()})

        fep = self.lists.get("fep")
        if "fep_detect" in self.layers and fep:
            first = flow.chunks[0]
            if len(first) < 16 and len(flow.chunks) == 1:
                return Decision(None, None, "need-first-payload")
            exempt, why = fep_exempt(first, fep)
            stats = fep_stats(first)
            detail = {
                "why": why,
                "first_hex": first[:16].hex(),
                "first_len": len(first),
                "popcount": round(stats["popcount"], 3),
                "ascii_fraction": round(stats["ascii_fraction"], 3),
                "max_run": stats["max_run"],
            }
            if not exempt:
                return Decision(False, "fep_detect", "fully-encrypted", detail)
            return Decision(True, None, "exempt:" + why, detail)

        if not self.layers:
            return Decision(True, None, "no-filter")
        return Decision(True, None, "no-rule-matched", {})

    def _evaluate_tls(self, flow: Flow) -> Decision:
        buf = flow.buffer
        records, incomplete_at = split_records(buf)
        if not records:
            return Decision(None, None, "incomplete-record")
        records_incomplete = incomplete_at < len(buf) - 1
        hello = parse_client_hello(buf)
        if hello is None:
            return Decision(None, None, "hello-incomplete")
        flow.hello = hello
        flow.tls = True

        sni = hello.get("sni")
        if sni and self._sni_blocked(sni):
            return Decision(False, "sni_block", "sni-in-blocklist", {"sni": sni})
        if not self._sni_allowed_only(sni) and "sni_whitelist" in self.layers:
            return Decision(False, "sni_whitelist", "sni-not-whitelisted", {"sni": sni})

        if "ja4_fingerprint" in self.layers:
            ja4 = self.lists.get("ja4") or {}
            allow = ja4.get("ja4Allow") or []
            h = hello.get("ja4")
            name = (ja4.get("ja4Names") or {}).get(h or "", "unknown")
            if allow:
                # دیتابیس JA4 از اندازه‌گیری واقعی uTLS/xray ساخته شده
                # (testenv/censor/fpmeasure.py). کلید تصمیم JA4 است نه JA3:
                # uTLS/chrome ترتیب extension را عوض می‌کند و JA3 بی‌ثبات است
                # (۱۵ اتصال → ۱۵ JA3)، ولی JA4 کانونیکال است.
                if h not in allow:
                    return Decision(
                        False,
                        "ja4_fingerprint",
                        "ja4-not-in-allowlist",
                        {"sni": sni, "ja4": h, "ja3": hello.get("ja3"), "client": name},
                    )
            elif ja4.get("browserLikeOnly"):
                ok, why = ja4_like(hello)
                if not ok:
                    return Decision(
                        False, "ja4_fingerprint", f"not-browser-like:{why}", {"sni": sni, "ja4": h, "ja3": hello.get("ja3")}
                    )

        ech = self.lists.get("ech")
        if "ech_drop" in self.layers and ech and hello["ech"]:
            trigger = any((sni or "") == t or (sni or "").endswith("." + t) for t in ech["triggerSni"])
            if trigger and ech.get("needsBothSplits"):
                tcp_split = len(flow.chunks) > 1
                record_split = bool(hello.get("record_split"))
                if not (tcp_split and record_split):
                    return Decision(
                        False,
                        "ech_drop",
                        "ech-with-cloudflare-sni",
                        {"tcp_split": tcp_split, "record_split": record_split},
                    )
                flow.decided = "ech-bypassed-by-combined-splits"
            elif trigger:
                return Decision(False, "ech_drop", "ech-with-trigger-sni", {"sni": sni})

        if records_incomplete:
            return Decision(None, None, "trailing-incomplete-record")
        flow.decided = flow.decided or "tls-ok"
        return Decision(
            True,
            None,
            flow.decided,
            {
                "sni": sni,
                "app_record": getattr(flow, "first_app_len", None),
                "app_records": getattr(flow, "app_records", None),
                "record_split": bool(hello.get("record_split")),
                "tcp_split": len(flow.chunks) > 1,
                "ja3": hello.get("ja3"),
                "ja4": hello.get("ja4"),
                "client": ((self.lists.get("ja4") or {}).get("ja4Names") or {}).get(hello.get("ja4") or "", "unknown"),
                "ech": hello["ech"],
                "grease": hello["grease"],
                "alpn": hello["alpn"],
            },
        )

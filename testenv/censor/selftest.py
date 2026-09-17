#!/usr/bin/env python3
"""
تست‌های واحدِ شبیه‌ساز — بدون شبکه، بدون Xray.

هر تست یک قاعدهٔ *مستندشدهٔ* یک فیلتر واقعی را می‌سنجد. اگر این‌ها سبز باشند،
یعنی شبیه‌ساز همان چیزی است که مقاله‌ها و گزارش‌ها توصیفش می‌کنند، و بعد
می‌توان با خیال راحت سراغ «آیا عبور ما از آن رد می‌شود؟» رفت.

اجرا:  python3 testenv/censor/selftest.py
"""
from __future__ import annotations

import json
import os
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from builders import app_record, build_client_hello, build_quic_initial, split_chunks, tls_stream  # noqa: E402
from engine import IMPLEMENTED_LAYERS, Censor, load_rules  # noqa: E402
from parsers import Flow, application_records, fep_exempt, parse_client_hello  # noqa: E402

RULES = load_rules()
RESULTS: list[tuple[str, bool, str]] = []
random.seed(1337)


def check(name: str, cond: bool, extra: str = "") -> None:
    RESULTS.append((name, bool(cond), extra))


def observe(country: str, chunks: list[bytes], dport: int = 443) -> tuple:
    censor = Censor(country, RULES)
    flow = Flow(country=country, dport=dport)
    decision = None
    for chunk in chunks:
        decision = censor.observe(flow, chunk)
    return decision, flow


def blocked_by(decision, layer: str) -> bool:
    return decision.allowed is False and decision.layer == layer


# ── ۱) یکپارچگی مدل و شبیه‌ساز ─────────────────────────────────────────────

def test_no_layer_without_rules() -> None:
    for country, layers in RULES["simulatedLayers"].items():
        missing = [l for l in layers if l not in IMPLEMENTED_LAYERS]
        check(f"model⇄sim [{country}]: لایهٔ شبیه‌سازی‌شده بدون قاعده", not missing, ",".join(missing))
    check("rules.json از خودِ مدل ساخته شده", RULES["generatedFrom"].endswith("countries.ts"))
    check("نسخهٔ قواعد ثبت شده", RULES["version"] >= 1, str(RULES["version"]))


# ── ۲) GFW: تشخیص «ترافیک کاملاً رمز» (پنج قاعدهٔ معافیت) ───────────────────

def test_fep() -> None:
    rule = RULES["lists"]["cn"]["fep"]
    opaque = bytes(random.getrandbits(8) for _ in range(1200))
    d, _ = observe("cn", [opaque])
    check("GFW/FEP: دادهٔ تصادفی کامل مسدود می‌شود", blocked_by(d, "fep_detect"), d.reason)

    prefixed = b"abc123" + opaque
    exempt, why = fep_exempt(prefixed, rule)
    # دو قاعدهٔ مقاله (۶ بایت اول / طولانی‌ترین رشتهٔ چاپی) این‌جا هم‌پوشانی دارند؛
    # هر کدام شلیک کند یعنی «معاف»، و همین معیار درست است.
    check("GFW/FEP: ۶ بایت printable اول → معاف", exempt and why in ("printable-prefix", "printable-run"), why)

    http = b"GET /index.html HTTP/1.1\r\nHost: example.com\r\n\r\n"
    d, _ = observe("cn", [http])
    check("GFW/FEP: HTTP معمولی رد می‌شود", d.allowed is True, d.reason)

    hello = tls_stream(build_client_hello("www.microsoft.com"))
    d, _ = observe("cn", [hello])
    check(
        "GFW/FEP: TLS واقعی از فیلتر رمز عبور می‌کند",
        d.allowed is not False,
        str(d.layer) + "/" + d.reason,
    )

    mostly_ascii = b"hello world this is a long ascii run" + bytes(random.getrandbits(8) for _ in range(40))
    exempt, why = fep_exempt(mostly_ascii, rule)
    check("GFW/FEP: رشتهٔ چاپی بلند → معاف", exempt, why)

    d, _ = observe("open", [opaque])
    check("کنترل: همان دادهٔ تصادفی در کشور بدون فیلتر رد می‌شود", d.allowed is True, d.reason)


# ── ۳) SNI ────────────────────────────────────────────────────────────────

def test_sni() -> None:
    bad = tls_stream(build_client_hello("instagram.com"))
    d, _ = observe("ru", [bad])
    check("RU/SNI: دامنهٔ بلاک‌شده با SNI گرفته می‌شود", blocked_by(d, "sni_block"), d.reason)

    good = tls_stream(build_client_hello("www.microsoft.com"))
    d, _ = observe("ru", [good])
    check("RU/SNI: دامنهٔ تمیز رد می‌شود", d.allowed is True, d.reason)

    # TSPU سگمنت‌ها را بازچینش می‌کند: تکه‌کردن، SNI را پنهان نمی‌کند.
    d, _ = observe("ru", split_chunks(bad, 3))
    check("RU/بازچینش: تکه‌سازی TCP هم SNI را قایم نمی‌کند", blocked_by(d, "sni_block"), d.reason)

    subt = tls_stream(build_client_hello("api.instagram.com"))
    d, _ = observe("ru", [subt])
    check("RU/SNI: زیردامنه هم می‌افتد", blocked_by(d, "sni_block"), d.reason)

    d, _ = observe("ir", [tls_stream(build_client_hello("x.com"))])
    check("IR/SNI: x.com مسدود می‌شود", blocked_by(d, "sni_block"), d.reason)


# ── ۴) روسیه: ECH فقط با *ترکیب* دو تکه‌سازی ──────────────────────────────

def test_ru_ech() -> None:
    hello = build_client_hello("cloudflare-ech.com", ech=True)
    plain, _ = observe("ru", [tls_stream(hello)])
    check("RU/ECH: بدون تکه‌سازی می‌افتد", blocked_by(plain, "ech_drop"), plain.reason)

    rec_only, _ = observe("ru", [tls_stream(hello, records=2)])
    check("RU/ECH: فقط تکه‌سازی رکورد کافی نیست", blocked_by(rec_only, "ech_drop"), rec_only.reason)

    tcp_only, _ = observe("ru", [*split_chunks(tls_stream(hello, records=1), 2)])
    check("RU/ECH: فقط تکه‌سازی TCP کافی نیست", blocked_by(tcp_only, "ech_drop"), tcp_only.reason)

    both, _ = observe("ru", [*split_chunks(tls_stream(hello, records=2), 2)])
    check("RU/ECH: ترکیب هر دو تکه‌سازی عبور می‌کند", both.allowed is True, str(both.layer) + "/" + both.reason)

    other = tls_stream(build_client_hello("www.microsoft.com", ech=True))
    d, _ = observe("ru", [other])
    check("RU/ECH: ECH با SNI غیرکلاودفلر تریگر نمی‌شود", d.allowed is True, d.reason)


# ── ۵) امارات: اثرانگشت TLS (JA4-مانند) ───────────────────────────────────

def test_ja4() -> None:
    """لایهٔ اثرانگشت (امارات) روی دیتابیس JA4 تصمیم می‌گیرد، نه روی حدس ساختاری.

    سه چیز تست می‌شود:
      ۱) ClientHello با JA4 ناشناس می‌افتد.
      ۲) همان ClientHello وقتی JA4اش در دیتابیسِ مجاز باشد رد می‌شود
         (یعنی تصمیم فقط از روی دیتابیس گرفته می‌شود).
      ۳) شاهدِ اندازه‌گیری: برای uTLS/chrome چند اتصال JA3های متفاوت ولی یک JA4
         می‌دهند — پس کلید تصمیم باید JA4 باشد.
    """
    chrome = tls_stream(build_client_hello("www.microsoft.com", browser=True, grease=True))
    hello = parse_client_hello(chrome)
    assert hello is not None, "ClientHello دست‌ساز باید قابل‌پارس باشد"
    ja4 = hello["ja4"]

    d, _ = observe("ae", [chrome])
    check("AE/JA4: JA4 ناشناس مسدود می‌شود", blocked_by(d, "ja4_fingerprint"), d.reason)

    censor = Censor("ae", RULES)
    censor.lists["ja4"]["ja4Allow"] = [ja4]
    d = censor.observe(Flow(country="ae", dport=443), chrome)
    check("AE/JA4: همان ClientHello با JA4 مجاز رد می‌شود", d.allowed is True, d.reason)

    go = tls_stream(build_client_hello("www.microsoft.com", browser=False, grease=False))
    go_hello = parse_client_hello(go)
    censor2 = Censor("ae", RULES)
    censor2.lists["ja4"]["ja4Allow"] = [ja4]
    d = censor2.observe(Flow(country="ae", dport=443), go)
    check(
        "AE/JA4: JA4 متفاوت (کلاینت غیرمرورگر) می‌افتد",
        blocked_by(d, "ja4_fingerprint") and go_hello is not None and go_hello["ja4"] != ja4,
        d.reason,
    )

    evidence_path = Path(__file__).with_name("fingerprints-measured.json")
    if evidence_path.exists():
        measured = json.loads(evidence_path.read_text())
        chrome_row = measured.get("chrome", {})
        check(
            "شاهد اندازه‌گیری: JA3 کروم ناپایدار است ولی JA4 ثابت می‌ماند",
            chrome_row.get("ja3_variants", 0) >= 2 and chrome_row.get("ja4_variants") == 1,
            f"ja3_variants={chrome_row.get('ja3_variants')} ja4_variants={chrome_row.get('ja4_variants')}",
        )


# ── ۶) ترکمنستان: وایت‌لیست ────────────────────────────────────────────────

def test_tm_whitelist() -> None:
    d, _ = observe("tm", [tls_stream(build_client_hello("yandex.ru"))])
    check("TM/وایت‌لیست: مقصد مجاز رد می‌شود", d.allowed is True, d.reason)

    d, _ = observe("tm", [tls_stream(build_client_hello("example.com"))])
    check("TM/وایت‌لیست: مقصد غیرمجاز می‌افتد", blocked_by(d, "sni_whitelist"), d.reason)

    d, _ = observe("tm", [b"SSH-2.0-OpenSSH_9.6\r\n"])
    check("TM: بنر SSH می‌افتد", d.allowed is False, str(d.layer))

    d, _ = observe("ir", [bytes(random.getrandbits(8) for _ in range(64))])
    check("IR/وایت‌لیست پروتکلی: ترافیک ناشناس می‌افتد", blocked_by(d, "proto_whitelist"), d.reason)


# ── ۷) اثرانگشت پروتکل‌ها ─────────────────────────────────────────────────

def test_fingerprints() -> None:
    wg = bytes([1, 0, 0, 0]) + bytes(random.getrandbits(8) for _ in range(144))
    d, _ = observe("ru", [wg], dport=51820)
    check("RU: بستهٔ ۱۴۸ بایتی WireGuard گرفته می‌شود", blocked_by(d, "proto_fingerprint"), d.reason)
    d, _ = observe("by", [wg], dport=51820)
    check("BY: همان اثرانگشت گرفته می‌شود", blocked_by(d, "proto_fingerprint"), d.reason)

    ovpn = bytes([0x00, 0x38]) + bytes(random.getrandbits(8) for _ in range(40))
    d, _ = observe("ru", [ovpn], dport=443)
    check("RU: اپکد OpenVPN گرفته می‌شود", blocked_by(d, "proto_fingerprint"), d.reason)

    # امارات: OpenVPN روی ۴۴۳ مستقیم بسته است، ولی ترافیک ناشناسِ بدون امضا
    # از دید فیلتر «اثرانگشتی» رد می‌شود — این تفاوت را صریح تست می‌کنیم.
    ovpn_ae = bytes([0x00, 0x48]) + bytes(random.getrandbits(8) for _ in range(40))
    d, _ = observe("ae", [ovpn_ae], dport=443)
    check("AE: OpenVPN روی ۴۴۳ می‌افتد", blocked_by(d, "proto_fingerprint"), str(d.layer) + "/" + d.reason)

    clean = bytes(random.getrandbits(8) for _ in range(200))
    d, _ = observe("ae", [clean])
    check("AE: ترافیک ناشناس بدون اثرانگشت توسط لایهٔ JA4 مسدود نمی‌شود", d.allowed is True, str(d.layer))


# ── ۸) QUIC: روسیه (اثرانگشت نسخهٔ ۱) و چین (SNI رمزگشایی‌شده) ──────────────

def test_quic() -> None:
    hello = build_client_hello("www.microsoft.com")
    big = build_quic_initial(hello, payload_len=1200)
    d = Censor("ru", RULES).inspect_udp(big, 443)
    check("RU/QUIC: Initial نسخهٔ ۱ و ≥۱۰۰۱ بایت می‌افتد", blocked_by(d, "quic_v1_fingerprint"), d.reason)

    small = build_quic_initial(hello, payload_len=900)
    d = Censor("ru", RULES).inspect_udp(small, 443)
    check("RU/QUIC: همان Initial کوچک‌تر رد می‌شود", d.allowed is True, d.reason)

    unknown = build_quic_initial(hello, version=0xFF00001D, payload_len=1200)
    d = Censor("ru", RULES).inspect_udp(unknown, 443)
    check("RU/QUIC: نسخهٔ نامعلوم رد می‌شود", d.allowed is True, d.reason)

    blocked_hello = build_quic_initial(build_client_hello("youtube.com"), payload_len=1200)
    d = Censor("cn", RULES).inspect_udp(blocked_hello, 443)
    check("CN/QUIC: SNI داخل Initial رمزگشایی و مسدود می‌شود", blocked_by(d, "quic_sni"), f"{d.reason} {d.detail}")

    d = Censor("cn", RULES).inspect_udp(big, 443)
    check("CN/QUIC: SNI تمیز رد می‌شود", d.allowed is True, d.reason)

    d = Censor("cn", RULES).inspect_udp(build_quic_initial(build_client_hello("youtube.com"), version=0xFF00001D, payload_len=1200), 443)
    check("CN/QUIC: نسخهٔ نامعلوم رمزگشایی‌ناپذیر است و عبور می‌کند", d.allowed is True, d.reason)


# ── ۹) چین: تشخیص TLS-in-TLS — عمداً شبیه‌سازی نشده ────────────────────────

def test_tls_in_tls_not_simulated() -> None:
    """ما این لایه را *شبیه‌سازی نمی‌کنیم* و این تست جلوی تقلب را می‌گیرد.

    چرا؟ اندازه‌گیری خودمان (world-matrix + fingerprints-measured) نشان داد تونل
    XTLS/Vision با padding خودش درست همان اندازه‌های «شاخصِ ClientHello درونی»
    را تولید می‌کند؛ پس هر قاعده‌ای که بر پایهٔ پنجرهٔ اندازه بگذارد، ترافیک
    معمولیِ کاربر را هم می‌بندد و هیچ ارزش اعتبارسنجی ندارد. تشخیص واقعیِ GFW
    آماری/زمانی است و در حلقهٔ آزمایشگاهی قابل بازتولید نیست. مدل TS این لایه را
    به‌عنوان «گزارش‌شده، شبیه‌سازی‌نشده» نگه می‌دارد.
    """
    check("CN/TLS-in-TLS: شبیه‌ساز ادعا نمی‌کند این لایه را دارد", "tls_in_tls" not in IMPLEMENTED_LAYERS, "")
    rules_sim = {cid: layers for cid, layers in RULES["simulatedLayers"].items()}
    offenders = [cid for cid, layers in rules_sim.items() if "tls_in_tls" in layers]
    check("model: هیچ کشوری این لایه را «شبیه‌سازی‌شده» علامت نزده", not offenders, str(offenders))

    # ابزار اندازه‌گیری در دسترس و درست است (فقط برای شاهد، نه تصمیم)
    stream = tls_stream(build_client_hello("www.microsoft.com")) + app_record(b"\x00" * 53) + app_record(b"\x00" * 1203)
    lengths = application_records(stream)
    check("اندازه‌گیری: طول رکوردهای اپلیکیشن به ترتیب خوانده می‌شود", lengths == [53, 1203], str(lengths))



# ── ۱۰) شبیه‌ساز دقیقاً همان چیزی را می‌بیند که مدل ادعا می‌کند ─────────────

def test_model_claims_match_sim() -> None:
    # ایران: TLS تمیز رد می‌شود، ترافیک ناشناس می‌افتد، SNI بلاک‌شده می‌افتد
    ok = tls_stream(build_client_hello("www.microsoft.com"))
    d, _ = observe("ir", [ok])
    check("IR: REALITY-style TLS رد می‌شود (لایهٔ وایت‌لیست پروتکلی)", d.allowed is True, d.reason)

    # کشور بدون لایه: هیچ قاعده‌ای نباید تریگر شود
    for payload in (b"SSH-2.0-x\r\n", bytes(random.getrandbits(8) for _ in range(300)), ok):
        d, _ = observe("open", [payload])
        check("open: هیچ قاعده‌ای فعال نیست", d.allowed is True and d.layer is None, d.reason)

    # هر کشور فقط لایه‌های خودش را دارد
    for country in RULES["countryLayers"]:
        censor = Censor(country, RULES)
        check(f"{country}: لایه‌ها از rules.json می‌آیند", censor.layers == RULES["countryLayers"][country], str(censor.layers))


def main() -> int:
    for fn in (
        test_no_layer_without_rules,
        test_fep,
        test_sni,
        test_ru_ech,
        test_ja4,
        test_tm_whitelist,
        test_fingerprints,
        test_quic,
        test_tls_in_tls_not_simulated,
        test_model_claims_match_sim,
    ):
        fn()

    failed = [r for r in RESULTS if not r[1]]
    for name, ok, extra in RESULTS:
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {name}" + (f"  ← {extra}" if (extra and not ok) else ""))
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
    if failed:
        print("failed:")
        for name, _, extra in failed:
            print(f"  - {name}  {extra}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

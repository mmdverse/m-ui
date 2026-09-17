#!/usr/bin/env python3
"""اندازه‌گیری اثرانگشت واقعی کلاینت‌های Xray — پایهٔ لایهٔ «اثرانگشت TLS» (امارات).

چرا این ابزار وجود دارد؟ سانسور امارات (طبق گزارش‌ها) به اثرانگشت TLS حساس است:
مرورگر رد می‌شود، ابزار نه. برای این‌که مدل ما *حدس* نزند، این ابزار یک رلهٔ
ضبط‌کننده بالا می‌آورد، با xray برای هر مقدار `tlsSettings.fingerprint` چند
ClientHello واقعی می‌فرستد و اثرانگشت‌ها را حساب می‌کند.

یافتهٔ کلیدی (اندازه‌گیری محلی، نه نقل‌قول): **JA3 برای uTLS/chrome بی‌ثبات است.**
کروم ترتیب چند extension را در هر اتصال عوض می‌کند و uTLS همان را تقلید می‌کند؛
در آزمایش ما ۱۵ اتصال، ۱۵ JA3 متفاوت داد ولی همه یک JA4 داشتند. پس فهرستِ مجازِ
هر سانسوری باید کانونیکال باشد (JA4)، نه JA3 — و مدل ما هم روی JA4 بسته شده.

خروجی:
  * `testenv/censor/fingerprints-measured.json` (دادهٔ خام)
  * با `--write-ts`: `src/lib/censorship/fingerprints.ts` (تولیدشده)

اجرا (زیرساخت world-matrix بالا باشد یا --cert بده):
    python3 testenv/censor/fpmeasure.py --cert /tmp/world-matrix/reality.crt --write-ts
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import socket
import subprocess
import sys
import threading
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

#: مقدارهای `fingerprint` که Xray 26.x می‌شناسد (None = پیش‌فرض).
FINGERPRINTS = [None, "chrome", "firefox", "safari", "ios", "android", "edge", "360", "qq", "random", "randomized"]

#: پروفایل‌هایی که مدل آن‌ها را «مرورگر» می‌داند → در امارات مجاز.
#: *عضوگیری در این فهرست یک تصمیم مدل است*، ولی JA4ها اندازه‌گیری‌شده‌اند.
#: ترتیب مهم است: اولویت نام‌گذاری JA4 با همین ترتیب است (chrome و default یک
#: JA4 دارند؛ نامِ «chrome» گویاتَر است).
BROWSER_FINGERPRINTS = ["chrome", "firefox", "safari", "edge", "ios", "android", "default"]

#: چند اتصال برای هر پروفایل (برای سنجش ثبات JA3/JA4).
ROUNDS = 3

XRAY = pathlib.Path(__file__).resolve().parents[1] / "bin" / "xray"


def _parseable(payload: bytes) -> bool:
    from parsers import parse_client_hello  # noqa: PLC0415

    hello = parse_client_hello(payload)
    return bool(hello and hello.get("sni") and hello.get("hello_len", 0) <= len(payload))


class Relay:
    """رلهٔ TCP که بایت‌های کلاینت را ضبط می‌کند.

    تا وقتی ClientHello کامل نشده جمع می‌کند: بریدن زودهنگام، JA3ِ غلط می‌سازد
    (رکورد ناقص → فهرست extension ناقص) و همان باگ، یک‌بار مدل را گمراه کرد.
    """

    def __init__(self, target: tuple[str, int]):
        self.target = target
        self.captured: dict[int, bytes] = {}
        self.count = 0
        self.srv = socket.socket()
        self.srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.srv.bind(("127.0.0.1", 0))
        self.port = self.srv.getsockname()[1]
        self.srv.listen(16)

    def start(self) -> "Relay":
        threading.Thread(target=self._accept, daemon=True).start()
        return self

    def _accept(self) -> None:
        while True:
            try:
                conn, _ = self.srv.accept()
            except OSError:
                return
            idx = self.count
            self.count += 1
            threading.Thread(target=self._handle, args=(conn, idx), daemon=True).start()

    def _handle(self, conn: socket.socket, idx: int) -> None:
        import select

        conn.settimeout(5)
        first = b""
        try:
            while len(first) < 4096:
                chunk = conn.recv(65535)
                if not chunk:
                    break
                first += chunk
                self.captured[idx] = first
                if len(first) >= 256 and _parseable(first):
                    break
        except (socket.timeout, OSError):
            pass
        try:
            up = socket.create_connection(self.target, timeout=5)
        except OSError:
            conn.close()
            return
        if first:
            up.sendall(first)
        peers = {conn: up, up: conn}
        outbox = {conn: b"", up: b""}
        try:
            while True:
                pending = [s for s, b in outbox.items() if b]
                r, w, _ = select.select(list(peers), pending, [], 20)
                if not r and not w:
                    break
                for src in r:
                    try:
                        data = src.recv(65535)
                    except (BlockingIOError, InterruptedError):
                        continue
                    except OSError:
                        return
                    if not data:
                        return
                    outbox[peers[src]] += data
                for dst in w:
                    buf = outbox[dst]
                    if not buf:
                        continue
                    try:
                        sent = dst.send(buf)
                    except OSError:
                        return
                    outbox[dst] = buf[sent:]
        finally:
            for s in peers:
                try:
                    s.close()
                except OSError:
                    pass


def client_config(socks_port: int, target_port: int, cert_pin: str, fingerprint: str | None, uuid: str) -> dict:
    tls: dict = {"serverName": "www.microsoft.com", "pinnedPeerCertSha256": cert_pin}
    if fingerprint:
        tls["fingerprint"] = fingerprint
    return {
        "log": {"loglevel": "error"},
        "inbounds": [{"listen": "127.0.0.1", "port": socks_port, "protocol": "socks", "settings": {"auth": "noauth", "udp": False}}],
        "outbounds": [
            {
                "protocol": "vless",
                "settings": {"vnext": [{"address": "127.0.0.1", "port": target_port, "users": [{"id": uuid, "encryption": "none"}]}]},
                "streamSettings": {"network": "tcp", "security": "tls", "tlsSettings": tls},
            }
        ],
    }


def cert_pin(cert: pathlib.Path) -> str:
    der = subprocess.run(["openssl", "x509", "-in", str(cert), "-outform", "DER"], capture_output=True, check=True).stdout
    return hashlib.sha256(der).hexdigest()


def measure(cert: pathlib.Path, target: tuple[str, int], uuid: str, workdir: pathlib.Path) -> dict:
    from parsers import ja4_like, parse_client_hello  # noqa: PLC0415

    pin = cert_pin(cert)
    workdir.mkdir(parents=True, exist_ok=True)
    relay = Relay(target).start()
    out: dict[str, dict] = {}
    for i, fp in enumerate(FINGERPRINTS):
        name = fp or "default"
        hello = None
        ja3_seen: set[str] = set()
        ja4_seen: set[str] = set()
        codes: list[str] = []
        for round_no in range(ROUNDS):
            socks = 1500 + (i * ROUNDS) + round_no
            cfg = workdir / f"fp-{name}-{round_no}.json"
            cfg.write_text(json.dumps(client_config(socks, relay.port, pin, fp, uuid)))
            proc = subprocess.Popen([str(XRAY), "run", "-c", str(cfg)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1.0)
            res = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "5", "-k",
                 "--socks5-hostname", f"127.0.0.1:{socks}", f"https://{target[0]}:8443/"],
                capture_output=True, text=True,
            )
            codes.append((res.stdout or "").strip())
            proc.kill()
            time.sleep(0.3)
            for payload in relay.captured.values():
                parsed = parse_client_hello(payload)
                if parsed and parsed.get("sni"):
                    hello = parsed
                    ja3_seen.add(parsed["ja3"])
                    ja4_seen.add(parsed["ja4"])
            relay.captured.clear()
        ok, why = ja4_like(hello) if hello else (False, "no-client-hello")
        out[name] = {
            "ja4": hello["ja4"] if hello else None,
            "ja4_variants": len(ja4_seen),
            "ja3": hello["ja3"] if hello else None,
            "ja3_variants": len(ja3_seen),
            "grease": hello["grease"] if hello else None,
            "alpn": hello["alpn"] if hello else [],
            "extensions": len(hello["ext_types"]) if hello else 0,
            "sig_algs": len(hello["sig_algs"]) if hello else 0,
            "ech": hello["ech"] if hello else None,
            "browser_like": bool(ok),
            "browser_like_reason": why,
            "lab_curl": codes,
            "browser": name in BROWSER_FINGERPRINTS,
        }
        print(
            f"{name:11} ja4={out[name]['ja4']} (variants={out[name]['ja4_variants']}) "
            f"ja3_variants={out[name]['ja3_variants']} exts={out[name]['extensions']:2} "
            f"sigalgs={out[name]['sig_algs']:2} grease={out[name]['grease']} "
            f"{'browser' if out[name]['browser'] else 'tool'}"
        )
    return out


TS_HEADER = """// این فایل تولید شده است — دست نزن.
// منبع: testenv/censor/fpmeasure.py  (اندازه‌گیری واقعی ClientHelloهای Xray 26.3.27)
// بازتولید: python3 testenv/censor/fpmeasure.py --cert <cert> --write-ts
//
// نکتهٔ مهم: JA3 برای uTLS/chrome در هر اتصال عوض می‌شود (کروم ترتیب extension را
// تصادفی می‌کند) — ۱۵ اتصال، ۱۵ JA3. پس مبنای تصمیم JA4 است که پایدار است.
"""


def write_ts(measured: dict, path: pathlib.Path) -> None:
    lines = [TS_HEADER, ""]
    lines += [
        "export type MeasuredFingerprint = {",
        "  name: string;",
        "  ja4: string;",
        "  ja4Variants: number;",
        "  ja3: string;",
        "  ja3Variants: number;",
        "  grease: boolean;",
        "  alpn: string[];",
        "  extensions: number;",
        "  sigAlgs: number;",
        "  browser: boolean;",
        "};",
        "",
        "/** اثرانگشت‌های اندازه‌گیری‌شده (کلید = مقدار `tlsSettings.fingerprint`). */",
        "export const MEASURED_FINGERPRINTS: Record<string, MeasuredFingerprint> = {",
    ]
    for name, rec in measured.items():
        lines.append(
            f"  {json.dumps(name)}: {{ name: {json.dumps(name)}, ja4: {json.dumps(rec['ja4'])}, "
            f"ja4Variants: {rec['ja4_variants']}, ja3: {json.dumps(rec['ja3'])}, ja3Variants: {rec['ja3_variants']}, "
            f"grease: {str(bool(rec['grease'])).lower()}, alpn: {json.dumps(rec['alpn'])}, "
            f"extensions: {rec['extensions']}, sigAlgs: {rec['sig_algs']}, browser: {str(bool(rec['browser'])).lower()} }},",
        )
    lines += ["};", "", "/** JA4هایی که مدل «مرورگر» می‌داند — کلید تصمیم لایهٔ امارات. */", "export const JA4_ALLOWLIST: string[] = ["]
    for name, rec in measured.items():
        if rec["browser"] and rec["ja4"]:
            lines.append(f"  {json.dumps(rec['ja4'])}, // {name}")
    lines += ["];", "", "/** JA4 → نام کلاینت، برای UI و لاگ شبیه‌ساز. اولویت با پروفایلِ مرورگر است. */", "export const JA4_NAMES: Record<string, string> = {"]
    named: dict[str, str] = {}
    for name in BROWSER_FINGERPRINTS:
        rec = measured.get(name)
        if rec and rec["ja4"]:
            named.setdefault(rec["ja4"], name)
    for name, rec in measured.items():
        if rec["ja4"]:
            named.setdefault(rec["ja4"], name)
    for ja4_value, name in named.items():
        lines.append(f"  {json.dumps(ja4_value)}: {json.dumps(name)},")
    lines += ["};", "", "/** نمونه‌های JA3 — شاهدِ ناپایداری (در تصمیم‌گیری استفاده نمی‌شوند). */", "export const JA3_SAMPLES: Record<string, string> = {"]
    for name, rec in measured.items():
        if rec["ja3"]:
            lines.append(f"  {json.dumps(name)}: {json.dumps(rec['ja3'])},")
    lines += ["};", ""]
    path.write_text("\n".join(lines))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cert", default="/tmp/world-matrix/reality.crt", help="گواهی سرور آزمایشگاهی")
    ap.add_argument("--target-host", default="127.0.0.1")
    ap.add_argument("--target-port", type=int, default=9444)
    ap.add_argument("--uuid", default="11111111-2222-3333-4444-555555555555")
    ap.add_argument("--out", default=str(HERE / "fingerprints-measured.json"))
    ap.add_argument("--workdir", default="/tmp/fpmeasure")
    ap.add_argument("--write-ts", action="store_true", help="فایل fingerprints.ts را هم بنویس")
    args = ap.parse_args()
    cert = pathlib.Path(args.cert)
    if not cert.exists():
        print(f"گواهی پیدا نشد: {cert}", file=sys.stderr)
        return 2
    measured = measure(cert, (args.target_host, args.target_port), args.uuid, pathlib.Path(args.workdir))
    pathlib.Path(args.out).write_text(json.dumps(measured, indent=2, sort_keys=True) + "\n")
    print(f"\nنوشته شد: {args.out}")
    if args.write_ts:
        ts_path = pathlib.Path(__file__).resolve().parents[2] / "src" / "lib" / "censorship" / "fingerprints.ts"
        write_ts(measured, ts_path)
        print(f"نوشته شد: {ts_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

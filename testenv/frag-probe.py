#!/usr/bin/env python3
"""اندازه‌گیریِ قطعیِ «تکه‌سازی ClientHello» در Xray 26.3.27.

چرا جدا از world-matrix؟ چون روی loopback کرنل نوشتن‌های پشت‌سرهم را ادغام
می‌کند و «چند سگمنت TCP دیده شد» تصادفی است. آن‌چه *قطعی* و اندازه‌گیری‌پذیر است
این است که ClientHello واقعاً به چند رکورد TLS شکسته می‌شود — همان چیزی که
قاعدهٔ روسیه (بازچینشِ هم TCP و هم رکورد) به آن نگاه می‌کند.

  python3 testenv/frag-probe.py            # سرور REALITY باید بالا باشد (:9443)
  python3 testenv/frag-probe.py --json     # خروجی ماشین‌خوان
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "censor"))

from fpmeasure import Relay, client_config  # noqa: E402
from parsers import parse_client_hello, split_records  # noqa: E402

XRAY = HERE / "bin" / "xray"
WORK = pathlib.Path("/tmp/world-matrix")


def probe(cert: pathlib.Path, reality_port: int, fragment: bool) -> dict:
    import hashlib

    pin = hashlib.sha256(subprocess.run(["openssl", "x509", "-in", str(cert), "-outform", "DER"], capture_output=True).stdout).hexdigest()
    server = json.loads((WORK / "server.json").read_text())
    inb = next(i for i in server["inbounds"] if i.get("tag") == "in-reality")
    sid = inb["streamSettings"]["realitySettings"]["shortIds"][0]
    priv = inb["streamSettings"]["realitySettings"]["privateKey"]
    uuid = inb["settings"]["clients"][0]["id"]
    pub = next(t for t in subprocess.run([str(XRAY), "x25519", "-i", priv], capture_output=True, text=True).stdout.split() if len(t) == 43)

    relay = Relay(("127.0.0.1", reality_port)).start()
    cfg = client_config(2101 + int(fragment), relay.port, pin, "chrome", uuid)
    cfg["outbounds"][0]["streamSettings"] = {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {"serverName": "www.microsoft.com", "fingerprint": "chrome", "publicKey": pub, "shortId": sid, "spiderX": ""},
        "tlsSettings": {"fingerprint": "chrome"},
    }
    if fragment:
        cfg["outbounds"][0]["streamSettings"]["finalmask"] = {
            "tcp": [{"type": "fragment", "settings": {"packets": "tlshello", "length": "100-200", "delay": "10-20", "maxSplit": "4-8"}}],
        }
    path = pathlib.Path(f"/tmp/frag-probe-{int(fragment)}.json")
    path.write_text(json.dumps(cfg))
    proc = subprocess.Popen([str(XRAY), "run", "-c", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.3)
    subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "--max-time", "6", "--socks5-hostname", f"127.0.0.1:{cfg['inbounds'][0]['port']}", "http://127.0.0.1:8099/"],
        capture_output=True,
    )
    time.sleep(0.4)
    proc.kill()
    best = {"records": 0, "handshake_records": 0, "sizes": []}
    for buf in relay.captured.values():
        recs, _ = split_records(buf)
        hello = parse_client_hello(buf)
        if not hello or not hello.get("sni"):
            continue
        hs = [r.length for r in recs if r.ctype == 22]
        if len(hs) > best["handshake_records"]:
            best = {"records": len(recs), "handshake_records": len(hs), "sizes": hs[:8], "record_split": hello.get("record_split")}
    return best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cert", default=str(WORK / "reality.crt"))
    ap.add_argument("--reality-port", type=int, default=9443)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    plain = probe(pathlib.Path(args.cert), args.reality_port, False)
    frag = probe(pathlib.Path(args.cert), args.reality_port, True)
    result = {
        "reality_plain": plain,
        "reality_finalmask": frag,
        # ادعای مدل: با finalmask، ClientHello به چند رکورد TLS می‌شکند
        "fragmentation_works": plain["handshake_records"] <= 1 and frag["handshake_records"] >= 2,
    }
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"بدون تکه‌سازی: رکوردهای handshake = {plain['handshake_records']} {plain['sizes']}")
        print(f"با finalmask : رکوردهای handshake = {frag['handshake_records']} {frag['sizes']}")
        print("نتیجه:", "PASS — finalmask واقعاً ClientHello را می‌شکند" if result["fragmentation_works"] else "FAIL")
    return 0 if result["fragmentation_works"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

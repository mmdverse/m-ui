#!/usr/bin/env python3
"""lab ترانزیت — زنجیرهٔ واقعی چندگره‌ای Xray، روی همین ماشین.

هدف: عددِ «سربار هر گره» را از هوا نیاوریم. دو سناریو اجرا می‌شود:

  ۱ گره : client ──REALITY/Vision──▶ exit ──▶ origin
  ۳ گره : client ──REALITY/Vision──▶ entry ──REALITY──▶ relay ──REALITY──▶ exit ──▶ origin

هر دو از یک origin و یک client (با `finalmask`) استفاده می‌کنند و ۱۲ بار اندازه
گرفته می‌شود؛ میانه گزارش می‌شود. اختلاف تقسیم بر تعداد گره‌های اضافه = سربار
پردازش هر گره. تأکید: این «سربار گره» است، نه تأخیر جغرافیایی — آن یکی روی
loopback قابل اندازه‌گیری نیست.

اجرا:
    python3 testenv/transit-lab.py            # اندازه‌گیری + نوشتن JSON
    python3 testenv/transit-lab.py --hops 1   # فقط یک سناریو
"""

from __future__ import annotations

import argparse
import http.server
import json
import pathlib
import socket
import ssl
import statistics
import subprocess
import sys
import threading
import time

HERE = pathlib.Path(__file__).resolve().parent
XRAY = HERE / "bin" / "xray"
WORK = pathlib.Path("/tmp/transit-lab")
UUID = "11111111-2222-3333-4444-555555555555"
SNI = "www.microsoft.com"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_port(port: int, timeout: float = 8.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket() as s:
            s.settimeout(0.3)
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return True
        time.sleep(0.1)
    return False


def xray_version() -> str:
    out = subprocess.run([str(XRAY), "version"], capture_output=True, text=True).stdout
    first = out.splitlines()[0] if out else "unknown"
    return first.strip()


def keypair() -> tuple[str, str]:
    """جفت‌کلید REALITY — کلید عمومی از همان کلید خصوصی مشتق می‌شود."""
    out = subprocess.run([str(XRAY), "x25519"], capture_output=True, text=True).stdout
    priv = next((t for t in out.replace(":", " ").split() if len(t) == 43), None)
    if not priv:
        raise RuntimeError(f"xray x25519 خروجی نامنتظر داد: {out!r}")
    derived = subprocess.run([str(XRAY), "x25519", "-i", priv], capture_output=True, text=True).stdout
    pub = next((t for t in derived.replace(":", " ").split() if len(t) == 43 and t != priv), None)
    if not pub:
        raise RuntimeError(f"اشتقاق کلید عمومی شکست خورد: {derived!r}")
    return priv, pub


def gen_cert() -> tuple[pathlib.Path, pathlib.Path]:
    crt, key = WORK / "dest.crt", WORK / "dest.key"
    if not crt.exists():
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-subj", f"/CN={SNI}",
             "-keyout", str(key), "-out", str(crt)],
            capture_output=True, check=True,
        )
    return crt, key


def start_origin(port: int) -> subprocess.Popen:
    (WORK / "www").mkdir(exist_ok=True)
    (WORK / "www" / "index.html").write_text("ok\n")
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", str(WORK / "www")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return proc


def start_dest(port: int, crt: pathlib.Path, key: pathlib.Path) -> subprocess.Popen:
    """سرور TLS محلی برای `dest` گره‌های REALITY (فالبک واقعی)."""
    code = f"""
import http.server, ssl
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain({str(crt)!r}, {str(key)!r})
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Length','0'); self.end_headers()
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', {port}), H)
srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
srv.serve_forever()
"""
    path = WORK / "dest.py"
    path.write_text(code)
    return subprocess.Popen([sys.executable, str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def node_config(port: int, priv: str, dest_port: int, next_hop: tuple[str, int, str] | None) -> dict:
    """یک گره: ورودی REALITY؛ اگر گره بعدی دارد، ترافیک را زنجیر می‌کند."""
    cfg: dict = {
        "log": {"loglevel": "warning"},
        "inbounds": [{
            "tag": "in",
            "listen": "127.0.0.1",
            "port": port,
            "protocol": "vless",
            "settings": {"clients": [{"id": UUID, "flow": "xtls-rprx-vision"}], "decryption": "none"},
            "streamSettings": {
                "network": "tcp",
                "security": "reality",
                "realitySettings": {
                    "show": False,
                    "dest": f"127.0.0.1:{dest_port}",
                    "xver": 0,
                    "serverNames": [SNI],
                    "privateKey": priv,
                    "shortIds": ["a1b2c3d4"],
                },
            },
        }],
        "outbounds": [{"tag": "direct", "protocol": "freedom"}],
        "routing": {"rules": []},
    }
    if next_hop:
        host, nport, npub = next_hop
        cfg["outbounds"].insert(0, {
            "tag": "to-next",
            "protocol": "vless",
            "settings": {"vnext": [{"address": host, "port": nport, "users": [{"id": UUID, "encryption": "none", "flow": "xtls-rprx-vision"}]}]},
            "streamSettings": {
                "network": "tcp",
                "security": "reality",
                "realitySettings": {"serverName": SNI, "fingerprint": "chrome", "publicKey": npub, "shortId": "a1b2c3d4", "spiderX": ""},
            },
        })
        cfg["routing"]["rules"] = [{"type": "field", "inboundTag": ["in"], "outboundTag": "to-next"}]
    else:
        cfg["routing"]["rules"] = [{"type": "field", "inboundTag": ["in"], "outboundTag": "direct"}]
    return cfg


def client_config(socks: int, entry_port: int, pub: str, fragmented: bool = True) -> dict:
    stream: dict = {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {"serverName": SNI, "fingerprint": "chrome", "publicKey": pub, "shortId": "a1b2c3d4", "spiderX": ""},
    }
    if fragmented:
        stream["finalmask"] = {
            "tcp": [{"type": "fragment", "settings": {"packets": "tlshello", "length": "100-200", "delay": "10-20", "maxSplit": "4-8"}}],
        }
    return {
        "log": {"loglevel": "error"},
        "inbounds": [{"listen": "127.0.0.1", "port": socks, "protocol": "socks", "settings": {"auth": "noauth", "udp": False}}],
        "outbounds": [{
            "protocol": "vless",
            "settings": {"vnext": [{"address": "127.0.0.1", "port": entry_port, "users": [{"id": UUID, "encryption": "none", "flow": "xtls-rprx-vision"}]}]},
            "streamSettings": stream,
        }],
    }


def check_config(path: pathlib.Path) -> bool:
    """کانفیگ را با خودِ Xray اعتبارسنجی می‌کند (تست واقعی، نه JSON.parse)."""
    for cmd in ([str(XRAY), "run", "-test", "-c", str(path)], [str(XRAY), "-test", "-c", str(path)]):
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            return True
    return False


def measure(socks: int, url: str, rounds: int = 12) -> list[float]:
    times: list[float] = []
    for _ in range(rounds):
        res = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{time_total}", "--max-time", "8", "--socks5-hostname", f"127.0.0.1:{socks}", url],
            capture_output=True, text=True,
        )
        if res.stdout.strip():
            times.append(float(res.stdout.strip()) * 1000.0)
        time.sleep(0.05)
    return times


def run_chain(hops: int, origin_port: int, dest_port: int) -> dict:
    """زنجیرهٔ `hops` گرهای را بالا می‌آورد و تأخیر میانه را برمی‌گرداند."""
    procs: list[subprocess.Popen] = []
    keys = [keypair() for _ in range(hops)]
    ports = [free_port() for _ in range(hops)]
    # از آخر به اول بساز تا هر گره بداند بعدی کجاست
    chain_next: tuple[str, int, str] | None = None
    for i in reversed(range(hops)):
        priv, pub = keys[i]
        cfg = node_config(ports[i], priv, dest_port, chain_next)
        path = WORK / f"node-{hops}-{i}.json"
        path.write_text(json.dumps(cfg, indent=2))
        assert check_config(path), f"کانفیگ گره {i} را Xray قبول نکرد"
        procs.append(subprocess.Popen([str(XRAY), "run", "-c", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        if not wait_port(ports[i]):
            raise RuntimeError(f"گره {i} بالا نیامد")
        chain_next = ("127.0.0.1", ports[i], pub)

    socks = free_port()
    client_path = WORK / f"client-{hops}.json"
    client_path.write_text(json.dumps(client_config(socks, ports[0], keys[0][1]), indent=2))
    assert check_config(client_path), "کانفیگ کلاینت را Xray قبول نکرد"
    procs.append(subprocess.Popen([str(XRAY), "run", "-c", str(client_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    if not wait_port(socks):
        raise RuntimeError("کلاینت بالا نیامد")
    time.sleep(0.4)
    url = f"http://127.0.0.1:{origin_port}/"
    times = measure(socks, url)
    ok = len(times) >= 8
    for proc in procs:
        proc.terminate()
    for proc in procs:
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
    return {
        "hops": hops,
        "rounds_ok": len(times),
        "median_ms": round(statistics.median(times), 3) if times else None,
        "min_ms": round(min(times), 3) if times else None,
        "max_ms": round(max(times), 3) if times else None,
        "usable": ok,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hops", type=int, default=0, help="۰ = هر دو سناریو (۱ و ۳ گره)")
    ap.add_argument("--out", default=str(HERE / "transit-measured.json"))
    args = ap.parse_args()
    WORK.mkdir(parents=True, exist_ok=True)
    if not XRAY.exists():
        print(f"Xray پیدا نشد: {XRAY}", file=sys.stderr)
        return 2
    crt, key = gen_cert()
    origin_port, dest_port = free_port(), free_port()
    origin = start_origin(origin_port)
    dest = start_dest(dest_port, crt, key)
    time.sleep(1.0)
    try:
        scenarios = [1, 3] if args.hops == 0 else [args.hops]
        results = [run_chain(h, origin_port, dest_port) for h in scenarios]
    finally:
        origin.terminate()
        dest.terminate()

    one = next((r for r in results if r["hops"] == 1), None)
    three = next((r for r in results if r["hops"] == 3), None)
    overhead = None
    if one and three and one["median_ms"] and three["median_ms"]:
        # هر اتصال کاربر یک dial تازه برای هر گره به‌دنبال دارد، پس اختلاف تقسیم
        # بر تعداد گره‌های اضافه، «هزینهٔ هر گره در هر اتصال» را می‌دهد.
        overhead = round((three["median_ms"] - one["median_ms"]) / (three["hops"] - one["hops"]), 3)
    payload = {
        "xray": xray_version(),
        "method": "local loopback chain: client(REALITY+Vision+finalmask) -> N nodes -> python http origin; median of 12 curls",
        "note": "این سربار *پردازش هر گره* است؛ تأخیر جغرافیایی روی loopback اندازه‌گیری‌شدنی نیست.",
        "scenarios": results,
        "per_hop_overhead_ms": overhead,
        "verdict": "PASS" if all(r["usable"] for r in results) else "FAIL",
    }
    pathlib.Path(args.out).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    for r in results:
        print(f"{r['hops']} گره: میانه {r['median_ms']}ms (rounds={r['rounds_ok']})")
    print(f"سربار هر گره (در هر اتصال، شامل handshake): {overhead}ms")
    print(f"نوشته شد: {args.out} — نتیجه: {payload['verdict']}")
    return 0 if payload["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
ماتریس جهانی — آزمون سرتاسریِ *واقعی*:

    کلاینت واقعی Xray  →  شبیه‌سازِ سانسورِ کشور  →  سرور واقعی Xray  →  مقصد

برای هر مورد، مدل TS یک انتظار دارد (`expect`) و شبیه‌ساز باید همان را ثابت
کند: اگر مدل می‌گوید «رئالیتی+Vision در روسیه رد می‌شود» ولی شبیه‌ساز ردش
کند، تست شکست می‌خورد — و برعکس، اگر مدل می‌گوید «VMess خالی در چین می‌افتد»
شبیه‌ساز باید واقعاً بیندازدش.

اجرا:  python3 testenv/world-matrix.py [--only ru] [--keep]
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import pathlib
import re
import shutil
import signal
import signal
import socket
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).parent / "censor"))

ROOT = pathlib.Path(__file__).resolve().parents[1]
XRAY = ROOT / "testenv" / "bin" / "xray"
WORK = pathlib.Path("/tmp/world-matrix")
UUID = "11111111-2222-3333-4444-555555555555"
SHORT_ID = "a1b2c3d4"
SS_PASSWORD = base64.b64encode(b"0123456789abcdef").decode()

PORTS = {
    "reality": 9443,
    "tls": 9444,
    "ss": 9445,
    "vmess": 9446,
    "dest": 9447,
    "http": 8099,
    "https": 8443,
}

# مسیرهای شبیه‌ساز: (فرآیند، کشور، پورتِ شنود، بکِند)
ROUTES_A = [("ru", 9543, PORTS["reality"]), ("cn", 9553, PORTS["reality"]), ("tm", 9573, PORTS["reality"]), ("ir", 9583, PORTS["reality"])]
ROUTES_B = [
    ("ae", 9563, PORTS["tls"]),
    ("cn", 9603, PORTS["tls"]),
    ("cn", 9613, PORTS["ss"]),
    ("cn", 9233, PORTS["vmess"]),
    ("ir", 9633, PORTS["ss"]),
    ("open", 9623, PORTS["ss"]),
]

PLANS = ("reality-vision", "reality-vision-frag", "vless-tls-go", "vless-tls-chrome", "ss2022", "vmess-tcp")

# `evidence` = مقادیری که *اندازه‌گیری* باید تأیید کند (نه فقط allow/block)
CASES = [
    # (id, country, route, plan, sni, target, expect, layer, evidence)
    # فقط record_split را ادعا می‌کنیم: جدا شدن *سگمنت* TCP روی loopback قطعی
    # نیست (کرنل نوشتن‌های پشت‌سرهم را ادغام می‌کند) و اندازه‌گیری‌پذیر نیست.
    # شاهدِ تکه‌سازی در `testenv/frag-probe.py` مستقیم اندازه‌گیری می‌شود
    # (روی loopback، ادغامِ سگمنت‌ها در کرنل نتیجه را غیرقطعی می‌کند).
    # شاهدِ اصلیِ تکه‌سازی در testenv/frag-probe.py قطعی اندازه‌گیری می‌شود؛ این‌جا
    # هم ادعا می‌کنیم که شکستن رکورد روی وایر دیده شود.
    ("ru-reality-frag", "ru", 9543, "reality-vision-frag", "www.microsoft.com", "http", "allow", None, {"record_split": True}),
    ("ru-reality-blocked-sni", "ru", 9543, "reality-vision", "instagram.com", "http", "block", "sni_block", None),
    # گروه‌بندی سگمنت‌های TCP روی loopback قطعی نیست (کرنل ادغام می‌کند)، پس فقط
    # چیزِ قطعی را ادعا می‌کنیم: بدون finalmask، ClientHello در یک رکورد می‌رود.
    ("ru-reality-plain", "ru", 9543, "reality-vision", "www.microsoft.com", "http", "allow", None, {"record_split": False}),
    ("tm-whitelisted-sni", "tm", 9573, "reality-vision", "yandex.ru", "http", "allow", None, None),
    ("tm-other-sni", "tm", 9573, "reality-vision", "www.microsoft.com", "http", "block", "sni_whitelist", None),
    ("ir-reality", "ir", 9583, "reality-vision-frag", "www.microsoft.com", "https", "allow", None, None),
    ("ir-ss2022", "ir", 9633, "ss2022", "www.microsoft.com", "http", "block", "proto_whitelist", None),
    ("ae-tls-chrome", "ae", 9563, "vless-tls-chrome", "www.microsoft.com", "https", "allow", None, {"client": "chrome"}),
    # پروفایل تصادفی در دیتابیس امارات نیست → «ابزار»، پس می‌افتد
    # پروفایل تصادفی هر اتصال یک JA4 دیگر دارد → هیچ‌وقت در دیتابیس نمی‌نشیند
    ("ae-tls-randomized", "ae", 9563, "vless-tls-randomized", "www.microsoft.com", "https", "block", "ja4_fingerprint", {"client": "unknown"}),
    # تشخیص TLS-in-TLS عمداً شبیه‌سازی نشده (به layers.ts و docs نگاه کن):
    # اندازه‌گیری نشان داد padding ویزن همان اندازه‌های «ClientHello درونی» را
    # می‌سازد، پس این کیس فقط ثابت می‌کند شبیه‌ساز ادعای الکی نمی‌کند.
    ("cn-tls-not-simulated", "cn", 9603, "vless-tls-default", "www.microsoft.com", "https", "allow", None, None),
    ("cn-reality-vision", "cn", 9553, "reality-vision", "www.microsoft.com", "https", "allow", None, None),
    ("cn-reality-frag", "cn", 9553, "reality-vision-frag", "www.microsoft.com", "https", "allow", None, None),
    # GFW برای ترافیک «کاملاً رمز» احتمالاتی تصمیم می‌گیرد (۵ قاعدهٔ معافیت):
    # بسته به سالتِ تصادفیِ اولین بسته، هم عبور می‌بینیم هم مسدودی → انتظار «mixed».
    ("cn-ss2022", "cn", 9613, "ss2022", "www.microsoft.com", "http", "mixed", "fep_detect", None, 8),
    # مثل SS2022: اولین بستهٔ تصادفی ممکن است شانسی از قاعدهٔ «رشتهٔ قابل‌چاپ»
    # معاف شود → تصمیم احتمالاتی است، نه قطعی.
    ("cn-vmess-tcp", "cn", 9233, "vmess-tcp", "www.microsoft.com", "http", "mixed", "fep_detect", None, 8),
    ("open-ss2022-control", "open", 9623, "ss2022", "www.microsoft.com", "http", "allow", None, None),
]


class Proc:
    def __init__(self, name: str, cmd: list[str], log: pathlib.Path):
        self.name = name
        self.log = log
        self.fh = open(log, "w", encoding="utf-8")
        self.proc = subprocess.Popen(cmd, stdout=self.fh, stderr=subprocess.STDOUT, start_new_session=True)

    def stop(self) -> None:
        try:
            os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        self.fh.close()


def wait_port(port: int, timeout: float = 8.0) -> bool:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        with socket.socket() as s:
            s.settimeout(0.25)
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return True
        time.sleep(0.1)
    return False


def free_port(port: int) -> bool:
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def gen_certs() -> None:
    crt, key = WORK / "reality.crt", WORK / "reality.key"
    if crt.exists() and key.exists():
        return
    subprocess.run(
        [
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2",
            "-keyout", str(key), "-out", str(crt),
            "-subj", "/CN=www.microsoft.com",
            "-addext", "subjectAltName=DNS:www.microsoft.com,DNS:yandex.ru,DNS:instagram.com,IP:127.0.0.1",
        ],
        check=True,
        capture_output=True,
    )


def x25519() -> tuple[str, str]:
    out = subprocess.run([str(XRAY), "x25519"], capture_output=True, text=True, check=True).stdout
    tokens = re.findall(r"[A-Za-z0-9_-]{43}", out)
    if len(tokens) < 2:
        raise RuntimeError(f"x25519 output not understood: {out!r}")
    return tokens[0], tokens[1]


def origin_server() -> None:
    src = WORK / "origin.py"
    src.write_text(
        "import http.server, ssl, sys\n"
        "port = int(sys.argv[1])\n"
        "handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=sys.argv[2], **k)\n"
        "httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)\n"
        "if len(sys.argv) > 3:\n"
        "    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)\n"
        "    ctx.load_cert_chain(sys.argv[3], sys.argv[4])\n"
        "    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)\n"
        "httpd.serve_forever()\n"
    )


def dest_server() -> None:
    src = WORK / "dest.py"
    src.write_text(
        "import socket, ssl, sys, threading\n"
        "crt, key = sys.argv[2], sys.argv[3]\n"
        "ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)\n"
        "ctx.load_cert_chain(crt, key)\n"
        "def serve(c):\n"
        "    try:\n"
        "        tls = ctx.wrap_socket(c, server_side=True)\n"
        "        while True:\n"
        "            data = tls.recv(65535)\n"
        "            if not data:\n"
        "                return\n"
        "            tls.sendall(b'HTTP/1.1 200 OK\\r\\nContent-Length: 2\\r\\nConnection: close\\r\\n\\r\\nok')\n"
        "    except Exception:\n"
        "        pass\n"
        "    finally:\n"
        "        c.close()\n"
        "srv = socket.socket()\n"
        "srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)\n"
        "srv.bind(('127.0.0.1', int(sys.argv[1])))\n"
        "srv.listen(64)\n"
        "while True:\n"
        "    conn, _ = srv.accept()\n"
        "    threading.Thread(target=serve, args=(conn,), daemon=True).start()\n"
    )


def server_config(priv: str, sni_list: list[str]) -> dict:
    reality = {
        "tag": "in-reality",
        "listen": "127.0.0.1",
        "port": PORTS["reality"],
        "protocol": "vless",
        "settings": {"clients": [{"id": UUID, "flow": "xtls-rprx-vision"}], "decryption": "none"},
        "streamSettings": {
            "network": "tcp",
            "security": "reality",
            "realitySettings": {
                "show": False,
                "dest": f"127.0.0.1:{PORTS['dest']}",
                "xver": 0,
                "serverNames": sni_list,
                "privateKey": priv,
                "shortIds": [SHORT_ID],
            },
        },
    }
    tls = {
        "tag": "in-tls",
        "listen": "127.0.0.1",
        "port": PORTS["tls"],
        "protocol": "vless",
        "settings": {"clients": [{"id": UUID}], "decryption": "none"},
        "streamSettings": {
            "network": "tcp",
            "security": "tls",
            "tlsSettings": {"certificates": [{"certificateFile": str(WORK / "reality.crt"), "keyFile": str(WORK / "reality.key")}]},
        },
    }
    ss = {
        "tag": "in-ss",
        "listen": "127.0.0.1",
        "port": PORTS["ss"],
        "protocol": "shadowsocks",
        "settings": {"method": "2022-blake3-aes-128-gcm", "password": SS_PASSWORD, "network": "tcp,udp"},
    }
    vmess = {
        "tag": "in-vmess",
        "listen": "127.0.0.1",
        "port": PORTS["vmess"],
        "protocol": "vmess",
        "settings": {"clients": [{"id": UUID, "alterId": 0}]},
    }
    return {
        "log": {"loglevel": "warning"},
        "inbounds": [reality, tls, ss, vmess],
        "outbounds": [{"protocol": "freedom", "tag": "direct"}],
    }


def client_config(plan: str, socks_port: int, route_port: int, sni: str, pub: str, loglevel: str = "warning") -> dict:
    common = {"address": "127.0.0.1", "port": route_port}
    if plan in ("reality-vision", "reality-vision-frag"):
        stream: dict = {
            "network": "tcp",
            "security": "reality",
            "realitySettings": {"serverName": sni, "fingerprint": "chrome", "publicKey": pub, "shortId": SHORT_ID, "spiderX": ""},
        }
        if plan == "reality-vision-frag":
            # امضای واقعی finalmask در Xray ≥۲۵ (کلید قدیمی fragment نادیده گرفته می‌شود)
            stream["finalmask"] = {
                "tcp": [
                    {
                        "type": "fragment",
                        "settings": {"packets": "tlshello", "length": "100-200", "delay": "10-20", "maxSplit": "4-8"},
                    }
                ]
            }
        out = {
            "protocol": "vless",
            "settings": {"vnext": [{**common, "users": [{"id": UUID, "encryption": "none", "flow": "xtls-rprx-vision"}]}]},
            "streamSettings": stream,
        }
    elif plan.startswith("vless-tls-"):
        # allowInsecure در 26.3.27 حذف شده؛ فقط هش DER گواهی را می‌توان پین کرد.
        tls_settings: dict = {"serverName": sni, "pinnedPeerCertSha256": cert_sha256()}
        # vless-tls-default = بدون fingerprint (اثرانگشت پیش‌فرض xray = uTLS/chrome)
        fp_name = plan[len("vless-tls-"):]
        if fp_name != "default":
            tls_settings["fingerprint"] = fp_name
        out = {
            "protocol": "vless",
            "settings": {"vnext": [{**common, "users": [{"id": UUID, "encryption": "none"}]}]},
            "streamSettings": {"network": "tcp", "security": "tls", "tlsSettings": tls_settings},
        }
    elif plan == "ss2022":
        out = {
            "protocol": "shadowsocks",
            "settings": {"servers": [{**common, "method": "2022-blake3-aes-128-gcm", "password": SS_PASSWORD}]},
            "streamSettings": {"network": "tcp"},
        }
    elif plan == "vmess-tcp":
        out = {
            "protocol": "vmess",
            "settings": {"vnext": [{**common, "users": [{"id": UUID, "alterId": 0, "security": "auto"}]}]},
            "streamSettings": {"network": "tcp", "security": "none"},
        }
    else:
        raise ValueError(plan)

    return {
        "log": {"loglevel": loglevel},
        "inbounds": [{"listen": "127.0.0.1", "port": socks_port, "protocol": "socks", "settings": {"auth": "noauth", "udp": False}}],
        "outbounds": [out],
    }


def cert_sha256() -> str:
    der = subprocess.run(["openssl", "x509", "-in", str(WORK / "reality.crt"), "-outform", "DER"], capture_output=True, check=True).stdout
    return hashlib.sha256(der).hexdigest()


def curl_through(socks_port: int, target: str) -> tuple[bool, str]:
    url = f"http://127.0.0.1:{PORTS['http']}/" if target == "http" else f"https://127.0.0.1:{PORTS['https']}/"
    cmd = ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "8", "--socks5-hostname", f"127.0.0.1:{socks_port}", url]
    if target == "https":
        cmd.insert(1, "-k")
    res = subprocess.run(cmd, capture_output=True, text=True)
    code = (res.stdout or "").strip()
    return code == "200", code or f"rc={res.returncode}"


def read_new(path: pathlib.Path, offset: int) -> tuple[list[dict], int]:
    if not path.exists():
        return [], offset
    with open(path, encoding="utf-8") as fh:
        fh.seek(offset)
        chunk = fh.read()
        offset = fh.tell()
    entries = []
    for line in chunk.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return entries, offset


def kill_ports(ports: list[int]) -> int:
    """بستنِ هر چیزی که روی این پورت‌ها نشسته (بدون pkill: آن یک‌بار خودِ شل را کشت)."""
    killed = 0
    wanted = set(ports)
    for _ in range(6):  # چند دور: هر پورت ممکن است چند فرایند داشته باشد
        out = subprocess.run(["ss", "-ltnp"], capture_output=True, text=True).stdout
        victims: set[int] = set()
        for line in out.splitlines():
            match = re.search(r":(\d+)\s+\S+\s+.*?pid=(\d+)", line)
            if match and int(match.group(1)) in wanted:
                victims.add(int(match.group(2)))
        if not victims:
            break
        for pid in victims:
            try:
                os.kill(pid, signal.SIGKILL)
                killed += 1
            except OSError:
                pass
        time.sleep(0.3)
    return killed


def harness_ports() -> list[int]:
    ports = list(PORTS.values())
    for group in (ROUTES_A, ROUTES_B):
        ports += [r["listen"] if isinstance(r, dict) else r[1] for r in group]
    return ports


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None, help="فقط مواردی که این رشته را دارند")
    ap.add_argument("--keep", action="store_true")
    ap.add_argument("--loglevel", default="warning")
    ap.add_argument("--stop", action="store_true", help="فقط محیط را ببند و برو")
    args = ap.parse_args()
    if args.stop:
        print(f"بسته شد: {kill_ports(harness_ports())} فرایند")
        return 0

    if not XRAY.exists():
        print(f"xray پیدا نشد: {XRAY}", file=sys.stderr)
        return 2
    for port in list(PORTS.values()) + [c[2] for c in ROUTES_A] + [c[2] for c in ROUTES_B]:
        if not free_port(port):
            print(f"پورت {port} اشغال است — اول محیط قبلی را ببند.", file=sys.stderr)
            return 2

    shutil.rmtree(WORK, ignore_errors=True)
    (WORK / "www").mkdir(parents=True)
    (WORK / "www" / "index.html").write_text("matrix-ok\n")
    gen_certs()
    origin_server()
    priv, pub = x25519()

    procs: list[Proc] = []
    try:
        procs.append(Proc("origin-http", [sys.executable, str(WORK / "origin.py"), str(PORTS["http"]), str(WORK / "www")], WORK / "origin-http.log"))
        procs.append(
            Proc(
                "origin-https",
                [sys.executable, str(WORK / "origin.py"), str(PORTS["https"]), str(WORK / "www"), str(WORK / "reality.crt"), str(WORK / "reality.key")],
                WORK / "origin-https.log",
            )
        )
        dest_server()
        procs.append(Proc("reality-dest", [sys.executable, str(WORK / "dest.py"), str(PORTS["dest"]), str(WORK / "reality.crt"), str(WORK / "reality.key")], WORK / "dest.log"))
        (WORK / "server.json").write_text(json.dumps(server_config(priv, ["www.microsoft.com", "yandex.ru", "instagram.com"]), indent=2))
        procs.append(Proc("xray-server", [str(XRAY), "run", "-c", str(WORK / "server.json")], WORK / "xray-server.log"))
        for name, routes, log in (("censor-a", ROUTES_A, "censor-a.jsonl"), ("censor-b", ROUTES_B, "censor-b.jsonl")):
            cmd = [sys.executable, str(ROOT / "testenv/censor/proxy.py"), "--window", "0.6", "--log", str(WORK / log)]
            for country, listen, backend in routes:
                cmd += ["--route", f"{country}:{listen}:{backend}"]
            procs.append(Proc(name, cmd, WORK / f"{name}.log"))

        needed = [PORTS["http"], PORTS["https"], PORTS["dest"], PORTS["reality"], PORTS["tls"], PORTS["ss"], PORTS["vmess"]] + [r[1] for r in ROUTES_A] + [r[1] for r in ROUTES_B]
        for port in needed:
            if not wait_port(port):
                print(f"سرویس روی پورت {port} بالا نیامد؛ لاگ‌ها را ببین: {WORK}", file=sys.stderr)
                return 2
        # پورتِ باز کافی نیست: ممکن است یک پروسهٔ *قدیمی* پورت را گرفته باشد و
        # سانسورِ تازه بالا نیامده باشد (این باگ خاموش یک‌بار کل نتیجه را خراب کرد).
        # پس از خودِ سانسورها می‌پرسیم که آماده‌اند.
        for name, routes, _log in (("censor-a", ROUTES_A, "censor-a.jsonl"), ("censor-b", ROUTES_B, "censor-b.jsonl")):
            ready_log = WORK / f"{name}.log"
            deadline = time.time() + 8
            while time.time() < deadline:
                text = ready_log.read_text(encoding="utf-8", errors="replace") if ready_log.exists() else ""
                if text.count('"ready"') >= len(routes):
                    break
                time.sleep(0.2)
            else:
                print(f"{name} آماده نشد (پورت اشغال؟): {ready_log}", file=sys.stderr)
                return 2

        log_paths = {"censor-a": WORK / "censor-a.jsonl", "censor-b": WORK / "censor-b.jsonl"}
        offsets = {name: (path.stat().st_size if path.exists() else 0) for name, path in log_paths.items()}
        # برای هر پورتِ مسیر، فایل لاگ مربوطه را نگه می‌داریم
        route_log: dict[int, str] = {}
        for route in ROUTES_A:
            route_log[route[1]] = "censor-a"
        for route in ROUTES_B:
            route_log[route[1]] = "censor-b"

        rows = []
        failures = 0
        for idx, case in enumerate(CASES):
            cid, country, route_port, plan, sni, target, expect, want_layer = case[:8]
            want_evidence = case[8] if len(case) > 8 else None
            repeat = case[9] if len(case) > 9 else 1
            # برای SS2022 (تصمیم احتمالاتی) هر تلاش یک اتصال تازه با سالتِ تازه است
            if args.only and args.only not in cid:
                continue
            socks_port = 1100 + idx
            cfg = WORK / f"{cid}.json"
            cfg.write_text(json.dumps(client_config(plan, socks_port, route_port, sni, pub, args.loglevel), indent=2))
            client = Proc(f"client-{cid}", [str(XRAY), "run", "-c", str(cfg)], WORK / f"client-{cid}.log")
            try:
                if not wait_port(socks_port, 5):
                    rows.append((cid, country, expect, "error", "-", "client did not start", "MISMATCH"))
                    failures += 1
                    continue
                path = log_paths[route_log[route_port]]
                before = offsets[route_log[route_port]]
                codes: list[bool] = []
                route_events: list[dict] = []
                for attempt in range(repeat):
                    ok_i = False
                    raw = ""
                    for retry in range(3):
                        ok_i, raw = curl_through(socks_port, target)
                        time.sleep(0.35)
                        entries, _ = read_new(path, before)
                        route_events = [e for e in entries if e.get("route") == route_port]
                        # اگر اتصال حتی به سانسور نرسیده باشد، این «سکتهٔ زیرساخت» است
                        # نه نتیجهٔ فیلترینگ؛ یک‌بار دیگر تلاش کن (باگ خاموش قبلی).
                        if ok_i or route_events or retry == 2:
                            break
                    codes.append(ok_i)
                    if attempt + 1 < repeat:
                        time.sleep(0.3)
                time.sleep(0.6)  # تا رویداد «close» هم نوشته شود (وضعیت نهایی)
                if not any(codes):
                    observed = "block"
                elif all(codes):
                    observed = "allow"
                else:
                    observed = "mixed"
                time.sleep(0.4)
                entries, _ = read_new(path, before)
                offsets[route_log[route_port]] = path.stat().st_size
                route_events = [e for e in entries if e.get("route") == route_port]
                decisions = [e for e in route_events if e.get("verdict") in ("block", "allow")]
                last = decisions[-1] if decisions else None
                merged: dict = {}
                for event in route_events:
                    merged.update(event.get("detail") or {})
                # شاهدِ نمایشی از *وضعیت نهایی* می‌آید نه از لحظهٔ تصمیم: تصمیم‌ها
                # وسط راه گرفته می‌شوند (مثلاً تا رسیدن رکورد بعدی صبر می‌کنیم) و
                # نمایشِ آن‌ها به‌عنوان «وضعیت» گمراه‌کننده بود.
                detail = {**((last or {}).get("detail") or {}), **merged}
                layer = (last or {}).get("layer") or "-"
                reason = (last or {}).get("reason") or raw
                if repeat > 1:
                    passed = sum(codes)
                    extra = f"{passed}/{repeat} pass"
                    if 0 < passed < repeat:
                        layer = "fep_detect/mixed"
                        reason = "probabilistic"
                else:
                    extra = ", ".join(
                        f"{k}={detail[k]}"
                        for k in ("app_records", "app_record", "tcp_split", "record_split", "grease", "client", "alpn", "ech")
                        if k in detail and detail[k] is not None
                    )
                evidence_ok = True
                if want_evidence:
                    evidence_ok = all(merged.get(k) == v for k, v in want_evidence.items())
                if want_layer is None:
                    layer_ok = True
                elif observed == "mixed":
                    # تصمیم احتمالاتی: کافی است لایهٔ انتظار در بعضی اتصال‌ها دیده شود
                    layer_ok = any(e.get("layer") == want_layer for e in decisions)
                else:
                    layer_ok = layer == want_layer
                verdict = "OK " if (observed == expect and layer_ok and evidence_ok) else "MISMATCH"
                if verdict != "OK ":
                    failures += 1
                rows.append((cid, country, expect, observed, f"{layer}/{reason}", extra + ("" if evidence_ok else " evidence!"), verdict))
            finally:
                client.stop()
                time.sleep(0.2)

        width = max(len(r[0]) for r in rows) + 2
        print(f"{'case'.ljust(width)}{'ctry':6}{'expect':8}{'seen':8}{'layer/reason':34}evidence")
        print("-" * (width + 62))
        for row in rows:
            cid, country, expect, observed, layer, extra, verdict = row
            mark = "" if verdict == "OK " else "  ← "
            print(f"{cid.ljust(width)}{country.ljust(6)}{expect.ljust(8)}{observed.ljust(8)}{layer.ljust(34)}{extra}{mark}{verdict if mark else ''}")
        passed = len(rows) - failures
        print(f"\n{passed}/{len(rows)} مورد مطابق انتظارِ مدل بود")
        return 1 if failures else 0
    finally:
        if not args.keep:
            for p in reversed(procs):
                p.stop()
        else:
            print(f"پروسه‌ها زنده‌اند؛ لاگ‌ها در {WORK}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())

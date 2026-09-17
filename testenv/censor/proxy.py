#!/usr/bin/env python3
"""
پروکسیِ شبیه‌ساز سانسور.

بین کلاینت و سرور می‌نشیند و *شفاف* است (هیچ‌وقت TLS را باز نمی‌کند)، ولی همان
لحظه‌ای که یک DPI واقعی تصمیم می‌گیرد، تصمیم می‌گیرد: یا جریان را با RST
می‌بندد، یا رد می‌کند و — مثل GFW — وسط جریان هم اگر الگو را دید می‌بندد.

  python3 proxy.py --route ru:9543:9443 --route cn:9553:9443 --log /tmp/censor.jsonl
"""
from __future__ import annotations

import argparse
import json
import os
import select
import signal
import socket
import struct
import sys
import threading
import time

from engine import Censor, load_rules
from parsers import Flow, application_records, parse_client_hello

MAX_INSPECT_BYTES = 65536


def graceful(sock: socket.socket) -> None:
    """بستنِ نرم: نیم‌بسته بفرست و بعد ببند (بدون RST)."""
    try:
        sock.shutdown(socket.SHUT_WR)
    except OSError:
        pass
    try:
        sock.close()
    except OSError:
        pass


def reset(sock: socket.socket) -> None:
    """بستن با RST — همان چیزی که DPI های در-مسیر تحویل می‌دهند."""
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
    except OSError:
        pass
    try:
        sock.close()
    except OSError:
        pass


class Logger:
    def __init__(self, path: str | None):
        self.fh = open(path, "a", buffering=1, encoding="utf-8") if path else None
        self.lock = threading.Lock()

    def emit(self, **kw) -> None:
        kw["ts"] = round(time.time(), 3)
        line = json.dumps(kw, ensure_ascii=False)
        with self.lock:
            print(line, flush=True)
            if self.fh:
                self.fh.write(line + "\n")


ROUTES_LOG_KEYS = ("country", "route", "verdict", "phase", "layer", "reason", "detail", "bytes", "sni")


def flow_state(flow: Flow) -> dict:
    """وضعیت *نهایی* جریان در لحظهٔ بستن — شاهد اندازه‌گیری برای تست‌ها.

    تصمیم‌ها وسط راه گرفته می‌شوند (مثلاً تا اولین رکورد اپلیکیشن صبر می‌کنیم)،
    پس «آخرین تصمیم» وضعیت نهایی نیست. این‌جا از بافر جمع‌شده دوباره پارس می‌کنیم
    تا شاهد، همان چیزی باشد که روی سیم رفت.
    """
    state: dict = {"tcp_split": len(flow.chunks) > 1, "chunks": len(flow.chunks)}
    hello = parse_client_hello(flow.buffer)
    if hello:
        state.update(
            {
                "sni": hello.get("sni"),
                "ja4": hello.get("ja4"),
                "ja3": hello.get("ja3"),
                "grease": hello.get("grease"),
                "alpn": hello.get("alpn"),
                "ech": hello.get("ech"),
                "record_split": hello.get("record_split"),
                "records": hello.get("record_count"),
            }
        )
    records = application_records(flow.buffer)
    state["app_records"] = records
    state["app_record"] = records[0] if records else None
    return state


class Route:
    def __init__(self, country: str, listen_port: int, backend: tuple[str, int], window: float, rules: dict, logger: Logger):
        self.country = country
        self.listen_port = listen_port
        self.backend = backend
        self.window = window
        self.censor = Censor(country, rules)
        self.log = logger
        self.trace = bool(os.environ.get("CENSOR_TRACE"))

    def _trace(self, what: str, **fields) -> None:
        """ردیابی مسیرِ داده برای دیباگ (فقط با CENSOR_TRACE=1).

        این‌جا باگ واقعی پیدا شد: پمپِ غیرمسدودکننده روی نوشتنِ نصفه اتصال را
        می‌بست. چون `sendall` روی سوکت غیرمسدود BlockingIOError می‌دهد و
        `except OSError` آن را «قطعی» می‌دید. ردیابی، همین را لو داد.
        """
        if not self.trace:
            return
        self.log.emit(country=self.country, route=self.listen_port, verdict="trace", reason=what, **fields)

    def handle(self, conn: socket.socket) -> None:
        flow = Flow(country=self.country, dport=self.backend[1])
        decision = None
        conn.settimeout(0.05)
        idle_deadline = time.monotonic() + 5.0  # کلاینت‌های تنبل (SS/VMess) دیر داده می‌فرستند
        first_byte_at = None
        while time.monotonic() < idle_deadline:
            try:
                data = conn.recv(65535)
            except socket.timeout:
                if first_byte_at and time.monotonic() - first_byte_at >= self.window:
                    break  # پنجرهٔ بازرسی تمام شد؛ هرچه دیده‌ایم کافی است
                continue
            except OSError:
                return
            if not data:
                break
            if first_byte_at is None:
                first_byte_at = time.monotonic()
            decision = self.censor.observe(flow, data)
            if decision.allowed is True and not self._pending_for(country_flow=flow, decision=decision):
                break  # تصمیم روشن شد؛ معطل نکن
            if decision.blocked:
                self.log.emit(
                    country=self.country,
                    route=self.listen_port,
                    verdict="block",
                    phase="inspect",
                    layer=decision.layer,
                    reason=decision.reason,
                    detail=decision.detail,
                    bytes=flow.bytes_seen,
                    sni=(flow.hello or {}).get("sni"),
                )
                reset(conn)
                return

        if not flow.buffer:
            conn.close()
            return

        try:
            up = socket.create_connection(self.backend, timeout=5)
        except OSError as exc:
            self.log.emit(country=self.country, verdict="error", reason=str(exc))
            conn.close()
            return

        up.sendall(flow.buffer)
        self._trace("inspect-done", sent=len(flow.buffer), decision=str(decision.reason if decision else None))
        self.log.emit(
            country=self.country,
            route=self.listen_port,
            verdict="allow",
            phase="inspect",
            reason=(decision.reason if decision else "no-decision"),
            layer=decision.layer if decision else None,
            sni=(flow.hello or {}).get("sni"),
            bytes=flow.bytes_seen,
            detail=decision.detail if decision else {},
        )

        conn.setblocking(False)
        up.setblocking(False)
        peers = {conn: up, up: conn}
        # سوکت غیرمسدودکننده + sendall = نوشتنِ نصفه (BlockingIOError) و بستنِ
        # بی‌دلیلِ اتصال؛ پروازهای بزرگ TLS این‌طور نصفه می‌رفتند. هر سوکت صف
        # خروجی خودش را دارد و select روی writable هم ثبت می‌شود.
        outbox: dict = {conn: b"", up: b""}
        last: dict = {}
        try:
            while True:
                pending = [s for s, buf in outbox.items() if buf]
                try:
                    readable, writable, _ = select.select(list(peers), pending, [], 60)
                except InterruptedError:
                    continue
                if not readable and not writable:
                    break
                for src in readable:
                    try:
                        chunk = src.recv(65535)
                    except (BlockingIOError, InterruptedError):
                        continue
                    except OSError as exc:
                        self._trace("recv-error", side="client" if src is conn else "server", err=type(exc).__name__)
                        return
                    if not chunk:
                        self._trace("eof", side="client" if src is conn else "server", pending=len(outbox[peers[src]]))
                        self._drain(peers[src], outbox)
                        return
                    if src is conn and flow.bytes_seen < MAX_INSPECT_BYTES:
                        verdict = self.censor.observe(flow, chunk)
                        last = {"layer": verdict.layer, "reason": verdict.reason, "detail": verdict.detail}
                        if verdict.blocked:
                            self.log.emit(
                                country=self.country,
                                route=self.listen_port,
                                verdict="block",
                                phase="midflow",
                                layer=verdict.layer,
                                reason=verdict.reason,
                                detail=verdict.detail,
                                bytes=flow.bytes_seen,
                                sni=(flow.hello or {}).get("sni"),
                            )
                            reset(conn)
                            reset(up)
                            return
                    outbox[peers[src]] += chunk
                for dst in writable:
                    buf = outbox[dst]
                    if not buf:
                        continue
                    try:
                        sent = dst.send(buf)
                    except (BlockingIOError, InterruptedError):
                        continue
                    except OSError as exc:
                        self._trace("send-error", side="client" if dst is conn else "server", err=type(exc).__name__)
                        return
                    outbox[dst] = buf[sent:]
        finally:
            # پایانِ عادی باید مؤدبانه (FIN) بسته شود، نه RST: بستنِ سخت آخرین
            # بایت‌های در راه را دور می‌ریزد و پروازهای بزرگ (مثل دست‌دادنِ TLS
            # درونِ تونل) نصفه می‌رسند. RST فقط برای «مسدود کردن» است.
            self.log.emit(
                country=self.country,
                route=self.listen_port,
                verdict="close",
                reason=last.get("reason", "closed"),
                layer=last.get("layer"),
                detail=flow_state(flow),
                bytes=flow.bytes_seen,
                sni=(flow.hello or {}).get("sni"),
            )
            self._drain(up, outbox)
            graceful(conn)
            graceful(up)

    @staticmethod
    def _drain(dst: socket.socket, outbox: dict, timeout: float = 2.0) -> None:
        """آخرین بایت‌های صف را (اگر شد) بفرست تا نیم‌بسته‌ها گم نشوند."""
        buf = outbox.get(dst, b"")
        deadline = time.monotonic() + timeout
        while buf and time.monotonic() < deadline:
            try:
                sent = dst.send(buf)
            except (BlockingIOError, InterruptedError):
                time.sleep(0.01)
                continue
            except OSError:
                return
            buf = buf[sent:]
        outbox[dst] = b""

    @staticmethod
    def _pending_for(country_flow: Flow, decision) -> bool:
        """آیا قاعده‌ای هنوز منتظر بایت‌های بعدی است؟"""
        return decision.allowed is None

    def serve(self) -> None:
        srv = socket.socket()
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("127.0.0.1", self.listen_port))
        srv.listen(128)
        print(json.dumps({"ready": self.listen_port, "country": self.country, "backend": f"{self.backend[0]}:{self.backend[1]}"}), flush=True)
        while True:
            try:
                conn, _ = srv.accept()
            except OSError:
                return
            threading.Thread(target=self.handle, args=(conn,), daemon=True).start()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--route", action="append", required=True, help="country:listen_port:backend_port")
    ap.add_argument("--backend-host", default="127.0.0.1")
    ap.add_argument("--window", type=float, default=0.15, help="چند ثانیه برای تصمیم اول صبر کند")
    ap.add_argument("--rules", default=None)
    ap.add_argument("--log", default=None)
    args = ap.parse_args()

    rules = load_rules(args.rules) if args.rules else load_rules()
    logger = Logger(args.log)
    routes = []
    for spec in args.route:
        country, listen_port, backend_port = spec.split(":")
        route = Route(country, int(listen_port), (args.backend_host, int(backend_port)), args.window, rules, logger)
        routes.append(route)
        threading.Thread(target=route.serve, daemon=True).start()

    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    while True:
        time.sleep(1)


if __name__ == "__main__":
    raise SystemExit(main())

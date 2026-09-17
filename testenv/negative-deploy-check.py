#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تست منفیِ رفع باگ deploy: اگر پورت اشغال باشد، پنل باید شکست را گزارش کند.

قبل از رفع، چک `stdout.includes('LISTENING')` با رشتهٔ «NOT_LISTENING» هم درست
می‌شد و پنل یک پروکسی مرده را «موفق» می‌گرفت. این اسکریپت همان حالت را می‌سازد:
یک شنوندهٔ دیگر روی پورت می‌نشیند، بعد deploy صدا زده می‌شود و انتظار ۵۰۰ با
کد api.deployFailed داریم.
"""
import json
import socket
import subprocess
import sys
import threading
import time
import urllib.request

BASE = 'http://127.0.0.1:3010'
PORT = 1081


def http(path, method='GET', body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=60) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')


def hold_port(port, stop):
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('0.0.0.0', port))
    s.listen(1)
    while not stop.is_set():
        time.sleep(0.2)
    s.close()


def main():
    stop = threading.Event()
    holder = threading.Thread(target=hold_port, args=(PORT, stop), daemon=True)
    holder.start()
    time.sleep(0.5)

    _, login = http('/api/auth/login', 'POST', {'username': 'admin', 'password': 'SuperSecret123'})
    token = login['token']
    _, servers = http('/api/servers/list', token=token)
    srv = [s for s in servers if s['name'] == 'm2-local'][-1]

    _, added = http(
        '/api/configs/add', 'POST',
        {'name': 'neg-test', 'serverId': srv['_id'], 'protocol': 'socks5', 'port': PORT},
        token,
    )
    cfg = added['config']
    print(f'  config ساخته شد: {cfg["_id"]} روی پورت {PORT}')

    code, body = http(f'/api/configs/deploy?id={cfg["_id"]}', 'POST', token=token)
    ok_fail = code == 500 and body.get('code') == 'api.deployFailed'
    print(f'  deploy روی پورت اشغال → {code} {json.dumps(body, ensure_ascii=False)[:150]}')
    print(f'  شکست درست گزارش شد: {"YES" if ok_fail else "NO"}')

    stop.set()
    time.sleep(0.4)
    code2, body2 = http(f'/api/configs/deploy?id={cfg["_id"]}', 'POST', token=token)
    ok_pass = code2 == 200 and body2.get('success') is True
    print(f'  deploy بعد از آزاد شدن پورت → {code2} {json.dumps(body2, ensure_ascii=False)[:120]}')
    print(f'  موفقیت درست گزارش شد: {"YES" if ok_pass else "NO"}')

    http(f'/api/configs/delete?id={cfg["_id"]}', 'DELETE', token=token)
    return 0 if (ok_fail and ok_pass) else 1


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env bash
# اعتبارسنجی پروفایل‌های ضد فیلتر m-ui با کلاینت واقعی Xray-core.
# خروجی: جدول امتیاز evasion.ts + اعتبار کانفیگ در xray + آزمون سرتاسری REALITY.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # ریشهٔ پروژه
cd "$ROOT/testenv"
XRAY=./bin/xray
UUID="d0f1e2a3-b4c5-6789-abcd-ef0123456789"
SID="a1b2c3d4"

[ -x "$XRAY" ] || { echo "xray not found in testenv/bin"; exit 1; }
echo "### Xray: $($XRAY version | head -1)"

# ── کلید واقعی X25519 (xray با کلید جعلی کانفیگ را رد می‌کند) ───────────────
PAIR=$($XRAY x25519)
PRIV=$(echo "$PAIR" | awk -F': ' '/PrivateKey/{print $2}')
PBK=$(echo "$PAIR" | awk -F': ' '/Password/{print $2}')
printf '%s' "$PRIV" > /tmp/priv.key
printf '%s' "$PBK" > /tmp/pub.key
DERIVED=$($XRAY x25519 -i "$PRIV" | awk -F': ' '/Password/{print $2}')
[ "$DERIVED" = "$PBK" ] && echo "### keypair: matched (pub ${PBK:0:10}…)" || { echo "KEY MISMATCH"; exit 1; }

# ── مقصد محلی برای REALITY (سرویس TLS 1.3 + h2) ─────────────────────────────
mkdir -p /tmp/dest && cd /tmp/dest
[ -f cert.pem ] || openssl req -x509 -newkey rsa:2048 -sha256 -days 2 -nodes \
  -keyout key.pem -out cert.pem -subj "/CN=www.microsoft.com" \
  -addext "subjectAltName=DNS:www.microsoft.com" 2>/dev/null
if ! ss -tln | grep -q ':4443 '; then
  nohup openssl s_server -accept 4443 -tls1_3 -alpn h2 -cert cert.pem -key key.pem -quiet >/tmp/dest/log 2>&1 &
  sleep 1
fi
cd - >/dev/null

python3 - "$PRIV" "$PBK" "$UUID" "$SID" <<'PY'
import json,sys
priv,pbk,u,sid=sys.argv[1:5]
srv={"log":{"loglevel":"warning"},
 "inbounds":[{"listen":"127.0.0.1","port":8444,"protocol":"vless",
  "settings":{"clients":[{"id":u,"flow":"xtls-rprx-vision"}],"decryption":"none"},
  "streamSettings":{"network":"tcp","security":"reality",
   "realitySettings":{"show":False,"dest":"127.0.0.1:4443","xver":0,
    "serverNames":["www.microsoft.com"],"privateKey":priv,"shortIds":[sid]}}}],
 "outbounds":[{"protocol":"freedom"}]}
cli={"log":{"loglevel":"warning"},
 "inbounds":[{"listen":"127.0.0.1","port":10830,"protocol":"socks","settings":{"udp":False}}],
 "outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"127.0.0.1","port":8444,
   "users":[{"id":u,"encryption":"none","flow":"xtls-rprx-vision"}]}]},
   "streamSettings":{"network":"tcp","security":"reality",
    "realitySettings":{"show":True,"fingerprint":"chrome","serverName":"www.microsoft.com",
     "publicKey":pbk,"shortId":sid,"spiderX":"/"}}}]}
json.dump(srv,open('/tmp/srv_local.json','w')); json.dump(cli,open('/tmp/cli_local.json','w'))
PY

for P in 8444 10830; do
  for PID in $(ss -tlnp 2>/dev/null | grep ":$P " | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$PID" 2>/dev/null; done
done
sleep 0.5
nohup $XRAY run -config /tmp/srv_local.json > /tmp/srv_local.log 2>&1 & echo $! > /tmp/sl.pid
sleep 1
nohup $XRAY run -config /tmp/cli_local.json > /tmp/cli_local.log 2>&1 & echo $! > /tmp/cl.pid
sleep 1.5

echo
echo "### E2E: VLESS + REALITY + Vision (chrome uTLS)"
CODE=$(curl -sS -x socks5h://127.0.0.1:10830 -o /dev/null -w "%{http_code}" --max-time 8 https://example.com/ 2>/dev/null)
VERIFIED=$(grep -c "uConn.Verified: true" /tmp/cli_local.log)
MLKEM=$(grep -o "X25519MLKEM768 for TLS' communication: true" /tmp/cli_local.log | head -1)
echo "   tunnel traffic      : HTTP ${CODE:-000}"
echo "   cert verification   : uConn.Verified=true (${VERIFIED}x)  [client accepts forged cert via HMAC(AuthKey)]"
echo "   client hello        : ${MLKEM:-no} [post-quantum hybrid key share]"
echo "   auth key computed   : $(grep -c 'AuthKey\[:16\]' /tmp/cli_local.log)x"

echo
echo "### بررسی پروفایل‌های evasion.ts با کانفیگ واقعی Xray"
cd "$ROOT"
timeout 300 npx vite-node testenv/validate-profile.ts 2>&1 | grep -v "^npm warn"

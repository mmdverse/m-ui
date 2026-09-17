#!/bin/bash
B=http://127.0.0.1:3010
H='Content-Type: application/json'
say() { printf '\n=== %s ===\n' "$1"; }
code() { curl -s -o /tmp/body.json -w '%{http_code}' "$@"; }
show() { echo "  HTTP $1 | $(head -c ${2:-300} /tmp/body.json)"; }

say "1. login as seeded admin"
C=$(code -X POST -H "$H" -d '{"username":"admin","password":"SuperSecret123"}' $B/api/auth/login); show $C 200
TOKEN=$(jq -r .token /tmp/body.json)
echo "  token: ${TOKEN:0:24}... (len ${#TOKEN})"

say "2. wrong password"
C=$(code -X POST -H "$H" -d '{"username":"admin","password":"wrong"}' $B/api/auth/login); show $C

say "3. brute force: 12 rapid failed logins (rate-limit check)"
for i in $(seq 1 12); do
  C=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "$H" -d '{"username":"admin","password":"nope'$i'"}' $B/api/auth/login)
  printf '%s ' "$C"
done
echo

say "4. /api/auth/me with token"
C=$(code -H "Authorization: Bearer $TOKEN" $B/api/auth/me); show $C
say "4b. /api/auth/me with tampered token"
C=$(code -H "Authorization: Bearer ${TOKEN}x" $B/api/auth/me); show $C
say "4c. no token"
C=$(code $B/api/servers/list); show $C

say "5. add server (with ssh password) — what comes back?"
C=$(code -X POST -H "$H" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"srv-de","host":"203.0.113.10","port":22,"username":"root","authType":"password","password":"ssh-secret-kjh43","location":"آلمان"}' \
  $B/api/servers/add); show $C 400
SRV=$(jq -r .server._id /tmp/body.json)
echo "  response echoed password? -> $(jq -r '.server.password // "absent"' /tmp/body.json)"
echo "  response echoed sshKey?   -> $(jq -r '.server.sshKey // "absent"' /tmp/body.json)"
echo "  serverId=$SRV"

say "6. /api/servers/list (should not leak password)"
C=$(code -H "Authorization: Bearer $TOKEN" $B/api/servers/list); show $C 200
echo "  leaks password? -> $(jq -r '.[0] | has("password")' /tmp/body.json)"
echo "  leaks sshKey?   -> $(jq -r '.[0] | has("sshKey")' /tmp/body.json)"

say "7. add socks5 config"
C=$(code -X POST -H "$H" -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"cfg-socks\",\"serverId\":\"$SRV\",\"protocol\":\"socks5\",\"port\":1080}" $B/api/configs/add)
show $C 260
CFG=$(jq -r .config._id /tmp/body.json)

say "7b. add config with non-numeric port"
C=$(code -X POST -H "$H" -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"cfg-bad\",\"serverId\":\"$SRV\",\"protocol\":\"vless\",\"port\":\"abc\"}" $B/api/configs/add); show $C 200

say "7c. add config with out-of-range port 999999"
C=$(code -X POST -H "$H" -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"cfg-range\",\"serverId\":\"$SRV\",\"protocol\":\"vless\",\"port\":999999}" $B/api/configs/add); show $C 200

say "8. /api/configs/list (does it leak socksPass?)"
C=$(code -H "Authorization: Bearer $TOKEN" $B/api/configs/list); show $C 120
echo "  keys of first config: $(jq -r '.[0] | keys | join(",")' /tmp/body.json)"
echo "  leaks password?  -> $(jq -r '.[0] | has("password")' /tmp/body.json)"
echo "  leaks socksPass? -> $(jq -r '.[0] | has("socksPass")' /tmp/body.json)"

say "9. link for socks5 before deploy"
C=$(code -H "Authorization: Bearer $TOKEN" "$B/api/configs/link?id=$CFG"); show $C 300

echo "TOKEN=$TOKEN" > /tmp/api-test.env
echo "SRV=$SRV" >> /tmp/api-test.env
echo "CFG=$CFG" >> /tmp/api-test.env

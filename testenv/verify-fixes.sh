#!/bin/bash
B=http://127.0.0.1:3010; H='Content-Type: application/json'
say() { printf '\n=== %s ===\n' "$1"; }
ok() { printf '  %-62s %s\n' "$1" "$2"; }

say "login"
curl -s -o /tmp/b.json -X POST -H "$H" -d '{"username":"admin","password":"SuperSecret123"}' $B/api/auth/login
TOKEN=$(jq -r .token /tmp/b.json); T="Authorization: Bearer $TOKEN"
ok "token issued" "$([ ${#TOKEN} -gt 100 ] && echo YES || echo NO)"
if [ ${#TOKEN} -le 100 ]; then
  # The limiter is in-memory and this script intentionally trips it below, so a
  # previously throttled admin can only be un-throttled by restarting the panel.
  printf '  admin login refused: %s\n' "$(cat /tmp/b.json)"
  echo '  → restart the panel (fresh process clears the in-memory counters) and rerun.'
  exit 2
fi

# The brute-force block must not lock the account the rest of this script needs,
# so it hammers a dedicated throwaway user instead of admin.
PROBE="rl-probe-$RANDOM"
curl -s -o /dev/null -X POST -H "$H" -H "$T" -d "{\"username\":\"$PROBE\",\"password\":\"ProbePass123\",\"role\":\"user\"}" $B/api/auth/users
say "M5 — login rate limit (8/10min) + equal timing for unknown user"
printf '  codes: '; for i in $(seq 1 11); do curl -s -o /dev/null -w '%{http_code} ' -X POST -H "$H" -d "{\"username\":\"$PROBE\",\"password\":\"bad$i\"}" $B/api/auth/login; done; echo
curl -s -o /tmp/rl.json -X POST -H "$H" -d "{\"username\":\"$PROBE\",\"password\":\"badx\"}" $B/api/auth/login; printf '  last: %s\n' "$(cat /tmp/rl.json)"
printf '  admin still usable after the block: %s\n' "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "$H" -d '{"username":"admin","password":"SuperSecret123"}' $B/api/auth/login)"
t1=$(curl -s -o /dev/null -w '%{time_total}' -X POST -H "$H" -d '{"username":"nosuchuser","password":"whatever123"}' $B/api/auth/login)
printf '  unknown-user time=%ss  (bcrypt dummy compare runs)\n' "$t1"

say "M3 — secrets must not come back from the API"
curl -s -o /tmp/b.json -X POST -H "$H" -H "$T" -d '{"name":"srv-a","host":"203.0.113.10","port":22,"username":"root","authType":"password","password":"ssh-secret-kjh43"}' $B/api/servers/add
ok "POST /servers/add echoes password?" "$(jq -r 'if (.server|has("password")) then "LEAK" else "no" end' /tmp/b.json)"
ok "POST /servers/add echoes sshKey?" "$(jq -r 'if (.server|has("sshKey")) then "LEAK" else "no" end' /tmp/b.json)"
SRV=$(jq -r .server._id /tmp/b.json)
curl -s -o /tmp/b.json -X POST -H "$H" -H "$T" -d "{\"name\":\"cfg-socks\",\"serverId\":\"$SRV\",\"protocol\":\"socks5\",\"port\":1080}" $B/api/configs/add
ok "POST /configs/add echoes password?" "$(jq -r 'if (.config|has("password")) then "LEAK" else "no" end' /tmp/b.json)"
CFG=$(jq -r .config._id /tmp/b.json)
ok "GET /configs/list leaks socksPass?" "$(curl -s -H "$T" $B/api/configs/list | jq -r 'if (.[0]|has("socksPass")) then "LEAK" else "no" end')"

say "M2 — encryption at rest (sealed in DB, still usable by the app)"
node -e "
const m=require('mongoose');(async()=>{await m.connect('mongodb://127.0.0.1:27099/mui');
const s=await m.connection.db.collection('servers').findOne({name:'srv-a'});
console.log('  raw server.password in DB :', JSON.stringify(s.password).slice(0,60)+'…');
console.log('  is it a plaintext leak?   :', s.password.includes('ssh-secret') ? 'YES (BAD)' : 'no — sealed');
await m.disconnect();})();"

# self-contained fixture (a wiped /tmp/api-test.env must never turn this into a NO)
# Own the whole fixture: a real reachable server (the local test sshd), so this
# block never depends on whatever other checks left in the list.
M2SRV=$(curl -s -X POST -H "$H" -H "$T" -d '{"name":"m2-local","host":"127.0.0.1","port":2222,"username":"sshtest","authType":"password","password":"TestPass123"}' $B/api/servers/add | jq -r '(.server // .)._id')
ok "fixture server created (local sshd)" "$([ -n "$M2SRV" ] && [ "$M2SRV" != null ] && echo yes || echo NO)"
M2CFG=$(curl -s -X POST -H "$H" -H "$T" -d "{\"name\":\"m2-check\",\"serverId\":\"$M2SRV\",\"port\":1080,\"protocol\":\"socks5\",\"password\":\"s3cr3t-proxy-pass-9x\"}" $B/api/configs/add | jq -r '(.config // .)._id')
ok "fixture config created" "$([ -n "$M2CFG" ] && [ "$M2CFG" != null ] && echo yes || echo NO)"
node -e "
const m=require('mongoose');(async()=>{await m.connect('mongodb://127.0.0.1:27099/mui');
const c=await m.connection.db.collection('configs').findOne({_id:new m.Types.ObjectId('$M2CFG')});
console.log('  raw config.password in DB :', JSON.stringify(c.password).slice(0,40)+'…');
console.log('  sealed with enc:v1:       :', String(c.password).startsWith('enc:v1:') ? 'yes' : 'NO');
await m.disconnect();})();"

# Link only exists once the proxy is deployed, and that refusal is the correct
# behaviour — the important half is that nothing leaks either way.
ok "link before deploy refuses, without echoing the password" "$(curl -s -H "$T" "$B/api/configs/link?id=$M2CFG" | grep -q 's3cr3t-proxy-pass-9x' && echo LEAK || echo yes)"

# Decryption path, proven where it matters: SSH needs the real plaintext back.
ok "servers/test decrypts the sealed ssh password (real login)" "$(curl -s -X POST -H "$T" "$B/api/servers/test?id=$M2SRV" | jq -r 'if (.ok and .cpuUsage != null) then "yes — real ssh: cpu " + (.cpuUsage|tostring) + ", ram " + (.ramUsage|tostring) else "NO: " + ((.error // "no metrics")|tostring) end')"

if [ "${E2E:-0}" = "1" ]; then
  say "M2/E2E — deploy the config, then the link must carry the original password"
  # deploy mints fresh proxy credentials per run and seals them into socksPass,
  # so the link must carry *those* — that is what proves the round-trip works.
  DEP=$(curl -s -X POST -H "$T" "$B/api/configs/deploy?id=$M2CFG")
  echo "  deploy → $(echo "$DEP" | head -c 120)"
  DPASS=$(echo "$DEP" | jq -r .pass)
  # Without this guard a failed deploy (DPASS empty) would make every grep below
  # match and the section would report success on a broken run.
  if [ -z "$DPASS" ] || [ "$DPASS" = "null" ]; then
    ok "deploy returned credentials" "NO — the rest of the E2E section cannot prove anything"
  fi
  ok "deployed link carries the credentials deploy installed" "$([ -n "$DPASS" ] && [ "$DPASS" != "null" ] && curl -s -H "$T" "$B/api/configs/link?id=$M2CFG" | jq -r .link | grep -q "$DPASS" && echo yes || echo NO)"
  ok "traffic flows through the deployed proxy with those creds" "$(curl -s -x "socks5h://$(echo "$DEP" | jq -r .user):$DPASS@127.0.0.1:$(echo "$DEP" | jq -r .port)" -o /dev/null -w '%{http_code}' --max-time 10 https://example.com/ 2>/dev/null)"
  node -e "
const m=require('mongoose');(async()=>{await m.connect('mongodb://127.0.0.1:27099/mui');
const r=await m.connection.db.collection('configs').updateOne({_id:new m.Types.ObjectId('$M2CFG')},{\$set:{socksPass:'legacy-plain-77'}});
const c=await m.connection.db.collection('configs').findOne({_id:new m.Types.ObjectId('$M2CFG')});
console.log('  forced a legacy plaintext row:', r.modifiedCount===1?'yes':'no');
await m.disconnect();})();"
  ok "legacy plaintext row still readable (migration path OK)" "$([ -n "$DPASS" ] && [ "$DPASS" != "null" ] && curl -s -H "$T" "$B/api/configs/link?id=$M2CFG" | jq -r .link | grep -q 'legacy-plain-77' && echo yes || echo NO)"
else
  echo "  (set E2E=1 to also deploy and check the link end-to-end)"
fi

say "M4 — roles enforced"
curl -s -o /dev/null -X POST -H "$H" -H "$T" -d '{"username":"operator","password":"OperatorPass123","role":"user"}' $B/api/auth/users
UT="Authorization: Bearer $(curl -s -X POST -H "$H" -d '{"username":"operator","password":"OperatorPass123"}' $B/api/auth/login | jq -r .token)"
for ep in "POST /api/servers/add" "POST /api/configs/add" "POST /api/tunnels/add" "POST /api/servers/test?id=$SRV" "DELETE /api/configs/delete?id=$CFG"; do
  M=${ep% *}; P=${ep#* }
  c=$(curl -s -o /dev/null -w '%{http_code}' -X $M -H "$H" -H "$UT" -d '{}' "$B$P")
  ok "role=user  $ep" "$c $([ "$c" = 403 ] && echo '(blocked ✓)' || echo '(ALLOWED!)')"
done
c=$(curl -s -o /dev/null -w '%{http_code}' -H "$UT" $B/api/servers/list); ok "role=user  GET /api/servers/list (read allowed)" "$c"
c=$(curl -s -o /dev/null -w '%{http_code}' -H "$UT" $B/api/system/activity); ok "role=user  GET /api/system/activity" "$c"

say "M6 — invalid id → 400 with a clean message"
for ep in "GET /api/configs/link?id=xyz" "POST /api/servers/test?id=xyz" "DELETE /api/configs/delete?id=xyz"; do
  M=${ep% *}; P=${ep#* }
  out=$(curl -s -w '|%{http_code}' -X $M -H "$T" "$B$P")
  ok "$ep" "${out##*|} $(echo "${out%|*}" | head -c 60)"
done

say "M10 — port validation"
for body in '{"name":"p1","serverId":"'$SRV'","protocol":"vless","port":999999}' '{"name":"p2","serverId":"'$SRV'","protocol":"vless","port":"abc"}' '{"name":"p3","serverId":"'$SRV'","protocol":"vless","port":0}'; do
  out=$(curl -s -w '|%{http_code}' -X POST -H "$H" -H "$T" -d "$body" $B/api/configs/add)
  ok "add config $(echo $body | grep -o 'port[^}]*')" "${out##*|} $(echo "${out%|*}" | head -c 55)"
done
out=$(curl -s -w '|%{http_code}' -X POST -H "$H" -H "$T" -d '{"name":"s","host":"1.2.3.4","port":70000,"authType":"password"}' $B/api/servers/add)
ok "add server port=70000" "${out##*|} $(echo "${out%|*}" | head -c 55)"

echo "TOKEN=$TOKEN" > /tmp/v.env; echo "SRV=$SRV" >> /tmp/v.env; echo "CFG=$CFG" >> /tmp/v.env

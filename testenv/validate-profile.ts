/** Generates a client outbound from m-ui's own recommended profile and asks the
 *  real Xray-core to validate it (`xray run -test -config`). This is the "does
 *  the recommendation actually produce a machine-valid config" check. */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { assessForIran, recommendedDefaults } from '../src/lib/evasion';

const XRAY = 'testenv/bin/xray';
const ADDR = '203.0.113.7';
const UUID = 'd0f1e2a3-b4c5-6789-abcd-ef0123456789';
/** Xray refuses to start on a fake X25519 key, so use the pair the caller
 *  generated with `xray x25519` (see validate-iran-profiles.sh). */
const PBK = (() => { try { return readFileSync('/tmp/pub.key', 'utf8').trim(); } catch { return ''; } })();

function tlsBlock(sni: string, fp: string) {
  return { security: 'tls', tlsSettings: { serverName: sni, fingerprint: fp } };
}
function realityBlock(sni: string, fp: string, pbk: string, sid: string) {
  return {
    security: 'reality',
    realitySettings: { fingerprint: fp, serverName: sni, publicKey: pbk, shortId: sid, spiderX: '/' },
  };
}

const D = (p: string) => recommendedDefaults(p) as any;

function outbound(protocol: string) {
  const d = D(protocol);
  switch (protocol) {
    case 'vless':
      return {
        protocol: 'vless',
        settings: { vnext: [{ address: ADDR, port: d.port, users: [{ id: UUID, encryption: 'none', flow: d.flow }] }] },
        streamSettings: { network: 'tcp', ...realityBlock(d.sni, d.fp, PBK, 'a1b2c3d4') },
      };
    case 'vmess':
      return {
        protocol: 'vmess',
        settings: { vnext: [{ address: ADDR, port: d.port, users: [{ id: UUID, alterId: 0, security: 'auto' }] }] },
        streamSettings: { network: 'tcp', ...realityBlock(d.sni, d.fp, PBK, 'a1b2c3d4') },
      };
    case 'trojan':
      return {
        protocol: 'trojan',
        settings: { servers: [{ address: ADDR, port: d.port, password: 'pw' }] },
        streamSettings: { network: 'tcp', ...tlsBlock(d.sni, d.fp) },
      };
    case 'shadowsocks':
      return {
        protocol: 'shadowsocks',
        settings: { servers: [{ address: ADDR, port: d.port, method: 'chacha20-ietf-poly1305', password: 'pw' }] },
      };
    case 'socks5':
      return { protocol: 'socks', settings: { servers: [{ address: ADDR, port: 1080, users: [{ user: 'u', pass: 'p' }] }] } };
    default:
      return null; // hysteria2/tuic are not Xray protocols
  }
}

console.log('protocol      | assessment            | score | xray validity');
console.log('--------------|-----------------------|-------|--------------');
for (const p of ['vless', 'vmess', 'trojan', 'shadowsocks', 'socks5', 'hysteria2']) {
  const d = D(p);
  const cfg: any = { protocol: p, port: d.port, transport: d.transport || 'tcp', security: d.security || 'none', sni: d.sni || '', pbk: PBK, fp: d.fp || '', flow: d.flow || '' };
  const a = assessForIran(cfg);
  let verdict = 'n/a (not an Xray protocol)';
  const ob = outbound(p);
  if (ob) {
    const config = { log: { loglevel: 'error' }, inbounds: [{ port: 10808, protocol: 'socks', settings: {} }], outbounds: [ob] };
    writeFileSync('/tmp/prof.json', JSON.stringify(config, null, 2));
    try {
      execFileSync(XRAY, ['run', '-test', '-config', '/tmp/prof.json'], { stdio: 'pipe' });
      verdict = 'accepted (rc=0)';
    } catch (e: any) {
      verdict = 'REJECTED: ' + String(e.stderr || e.message).split('\n').slice(0, 2).join(' ');
    }
  }
  console.log(`${p.padEnd(13)} | ${a.verdict.padEnd(21)} | ${String(a.score).padEnd(5)} | ${verdict}`);
}

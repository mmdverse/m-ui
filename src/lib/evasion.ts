/**
 * Iran censorship assessment — the engineering side of the research in
 * `iran-censorship-report.md`. Every rule below traces to a measured behaviour
 * of the Iranian filter, not to folklore:
 *
 *  - DNS poisoning to 10.10.34.0/24 for censored names (OONI; arxiv 2507.14183)
 *  - HTTP DPI: injected 403 / TCP RST on hostname+keyword, case-sensitive
 *  - TLS/SNI: RST right after ClientHello when the SNI is blacklisted
 *  - protocol whitelist: only DNS/HTTP(S) forwarded; everything else dropped
 *    (Bock et al. 2020; re-confirmed June 2025 and January 2026 blackouts)
 *  - active probing of suspicious IPs → IP-level block
 *  - WireGuard's fixed 148-byte initiation is fingerprinted within hours
 *  - QUIC/UDP is selectively filtered or throttled
 *  - port choice matters: 443 is effectively unblockable, odd ports get dropped
 *  - REALITY survives because the handshake *is* a real handshake to a real
 *    site, and Vision removes the TLS-in-TLS packet-length signature
 */

export type Severity = 'fail' | 'warn' | 'info' | 'pass';

export interface CensorshipCheck {
  id: string;
  severity: Severity;
  /** Translation key — the UI resolves it in the user's language. */
  key: string;
  /** Values interpolated into the message, e.g. { sni: 'x.com' }. */
  vars?: Record<string, string | number>;
  /** Concrete, machine-applicable suggestion (field → recommended value). */
  fix?: Record<string, string | number>;
}

export interface AssessableConfig {
  protocol: string;
  transport?: string;
  security?: string;
  port?: number;
  domain?: string;
  sni?: string;
  path?: string;
  pbk?: string;
  sid?: string;
  fp?: string;
  flow?: string;
  server?: string;
}

export type Verdict = 'resilient' | 'usable' | 'fragile' | 'blocked';

export interface Assessment {
  score: number; // 100 = nothing left to harden
  verdict: Verdict;
  checks: CensorshipCheck[];
  /** Translation key for the one-line verdict. */
  summaryKey: string;
  summaryVars?: Record<string, string | number>;
}

// ── Measured facts encoded as data ──────────────────────────────────────────

/** Ports that historically survive the whitelist. 443 first: blocking it would
 *  break Iran's own banking/commerce traffic. 8443 is a common secondary. */
export const PREFERRED_PORTS = [443, 8443, 2053, 2083, 2087, 2096];
/** Ports that are essentially a "block me" signal on this network. */
export const AVOID_PORTS = [22, 80, 1080, 1194, 500, 1701, 1723, 3128, 8388, 51820];

/** SNI/dest hosts that are themselves censored inside Iran. Using one as a
 *  REALITY dest or TLS SNI means the ClientHello is reset before anything else
 *  can happen. */
export const SNI_AVOID = [
  'instagram.com', 'telegram.org', 't.me', 'whatsapp.com', 'signal.org',
  'x.com', 'twitter.com', 'facebook.com', 'youtube.com', 'openai.com',
  'chatgpt.com', 'gemini.google.com', 'bbc.com', 'bbc.co.uk', 'dw.com',
  'torproject.org', 'psiphon.ca', 'protonvpn.com', 'vpnoverview.com',
];

/** Good REALITY destinations: reachable from Iran, real TLS 1.3 + X25519 + h2,
 *  not behind a CDN that terminates by SNI, no backend that rate-limits. */
export const SNI_GOOD = [
  'www.microsoft.com', 'www.apple.com', 'www.amazon.com', 'www.bing.com',
  'www.samsung.com', 'www.cloudflare.com', 'www.nvidia.com', 'www.amd.com',
  'www.icloud.com', 'swcdn.apple.com', 'www.lovelive-anime.jp', 'www.yahoo.com',
];

/** uTLS fingerprints that look like a browser. 'random'/'randomized' mutate the
 *  ClientHello per connection, which is itself a detectable anomaly. */
export const GOOD_FINGERPRINTS = ['chrome', 'firefox', 'safari', 'edge', 'ios', 'android'];
export const RISKY_FINGERPRINTS = ['random', 'randomized', 'golang', 'go'];

const PROTOCOLS_WITH_NO_DPI_RESISTANCE = ['wireguard', 'wg'];

/** These carry TLS by construction, so a bare `security` field is not a
 *  finding: trojan is TLS-only and hysteria2/tuic are QUIC (TLS 1.3 inside). */
const INHERENTLY_TLS = ['trojan', 'hysteria2', 'hy2', 'tuic'];

// ── Helpers ────────────────────────────────────────────────────────────────

function hostOf(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
}

/** X25519 public keys are 32 bytes → 43 chars of base64url, no padding.
 *  Measured: Xray 26.3.27 refuses to load ("invalid \"password\": ...") and the
 *  user gets a client that dies at startup, with no hint about which field. */
export function looksLikeX25519(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test((value || '').trim());
}

/** shortId is hex, max 16 chars (8 bytes). Measured: "zz" → "invalid shortId". */
export function looksLikeShortId(value: string): boolean {
  return /^[0-9a-fA-F]{0,16}$/.test((value || '').trim()) && (value || '').trim().length % 2 === 0;
}

function matchesAny(host: string, list: string[]): boolean {
  return list.some((d) => host === d || host.endsWith('.' + d));
}

/** The transport REALITY is designed around: raw TCP with Vision. */
function isRealityTransport(transport: string): boolean {
  return ['', 'tcp', 'raw', 'none'].includes(transport);
}

// ── Assessment ─────────────────────────────────────────────────────────────

export function assessForIran(cfg: AssessableConfig): Assessment {
  const checks: CensorshipCheck[] = [];
  const protocol = (cfg.protocol || '').toLowerCase();
  const transport = (cfg.transport || 'tcp').toLowerCase();
  const security = (cfg.security || 'none').toLowerCase();
  const port = Number(cfg.port || 0);
  const sni = hostOf(cfg.sni || '');
  const domain = hostOf(cfg.domain || '');
  const isTls = security === 'tls' || security === 'reality';
  const reality = security === 'reality';

  // 1. protocols the filter recognises outright
  if (PROTOCOLS_WITH_NO_DPI_RESISTANCE.includes(protocol)) {
    checks.push({
      id: 'protocol-wireguard',
      severity: 'fail',
      key: 'ev.protocol-wireguard',
      fix: { protocol: 'vless', security: 'reality', transport: 'tcp', port: 443 },
    });
  }
  if (protocol === 'shadowsocks' || protocol === 'shadowsocksr') {
    checks.push({
      id: 'protocol-ss',
      severity: isTls ? 'info' : 'warn',
      key: isTls ? 'ev.protocol-ss-tls' : 'ev.protocol-ss',
    });
  }
  if (protocol === 'vmess') {
    checks.push({
      id: 'protocol-vmess',
      severity: 'warn',
      key: 'ev.protocol-vmess',
      fix: { protocol: 'vless', security: 'reality' },
    });
  }

  // 2. the protocol whitelist: anything that does not look like HTTPS on a
  //    whitelisted port is dropped, so a bare non-TLS tunnel is a dead end.
  const bareShadowsocks = (protocol === 'shadowsocks' || protocol === 'shadowsocksr') && !isTls;
  if (!isTls && protocol !== 'socks5' && !INHERENTLY_TLS.includes(protocol) && !bareShadowsocks) {
    checks.push({
      id: 'no-tls',
      severity: 'fail',
      key: 'ev.no-tls',
      fix: { security: 'reality', transport: 'tcp' },
    });
  }

  // 3. REALITY specifics
  if (reality) {
    if (!cfg.pbk) {
      checks.push({
        id: 'reality-no-pbk',
        severity: 'fail',
        key: 'ev.reality-no-pbk',
        fix: { security: 'tls' },
      });
    } else if (!looksLikeX25519(cfg.pbk)) {
      checks.push({
        id: 'reality-bad-pbk',
        severity: 'fail',
        key: 'ev.reality-bad-pbk',
      });
    }
    if (cfg.sid !== undefined && cfg.sid !== '' && !looksLikeShortId(cfg.sid)) {
      checks.push({
        id: 'reality-bad-sid',
        severity: 'fail',
        key: 'ev.reality-bad-sid',
      });
    }
    if (!sni) {
      checks.push({ id: 'reality-no-sni', severity: 'fail', key: 'ev.reality-no-sni' });
    }
    if (!isRealityTransport(transport)) {
      checks.push({
        id: 'reality-wrong-transport',
        severity: 'warn',
        key: 'ev.reality-wrong-transport',
        vars: { transport },
        fix: { transport: 'tcp', flow: 'xtls-rprx-vision' },
      });
    }
    if (transport === 'tcp' || transport === 'raw' || transport === '') {
      if ((cfg.flow || '') !== 'xtls-rprx-vision') {
        checks.push({
          id: 'reality-no-vision',
          severity: 'warn',
          key: 'ev.reality-no-vision',
          fix: { flow: 'xtls-rprx-vision' },
        });
      }
    }
    if (sni && matchesAny(sni, SNI_AVOID)) {
      checks.push({
        id: 'reality-sni-blocked',
        severity: 'fail',
        key: 'ev.reality-sni-blocked',
        vars: { sni },
        fix: { sni: SNI_GOOD[0] },
      });
    } else if (sni && SNI_GOOD.some((g) => sni === hostOf(g))) {
      checks.push({ id: 'reality-sni-good', severity: 'pass', key: 'ev.reality-sni-good', vars: { sni } });
    } else if (sni) {
      checks.push({
        id: 'reality-sni-unknown',
        severity: 'info',
        key: 'ev.reality-sni-unknown',
        vars: { sni },
      });
    }
  }

  // 4. TLS without REALITY: the SNI is visible, so it must be a harmless name
  if (security === 'tls') {
    if (!sni && !domain) {
      checks.push({ id: 'tls-no-sni', severity: 'fail', key: 'ev.tls-no-sni' });
    } else if (matchesAny(sni || domain, SNI_AVOID)) {
      checks.push({
        id: 'tls-sni-blocked',
        severity: 'fail',
        key: 'ev.tls-sni-blocked',
        vars: { sni: sni || domain },
      });
    }
  }

  // 5. fingerprint
  const fp = (cfg.fp || '').toLowerCase();
  if (reality || security === 'tls') {
    if (!fp) {
      checks.push({ id: 'fp-missing', severity: 'warn', key: 'ev.fp-missing', fix: { fp: 'chrome' } });
    } else if (RISKY_FINGERPRINTS.includes(fp)) {
      checks.push({
        id: 'fp-risky',
        severity: 'warn',
        key: 'ev.fp-risky',
        vars: { fp },
        fix: { fp: 'chrome' },
      });
    } else if (!GOOD_FINGERPRINTS.includes(fp)) {
      checks.push({ id: 'fp-unknown', severity: 'info', key: 'ev.fp-unknown', vars: { fp }, fix: { fp: 'chrome' } });
    }
  }

  // 6. port
  if (port) {
    if (port === 443) {
      checks.push({ id: 'port-443', severity: 'pass', key: 'ev.port-443' });
    } else if (AVOID_PORTS.includes(port)) {
      checks.push({
        id: 'port-avoid',
        severity: 'fail',
        key: 'ev.port-avoid',
        vars: { port },
        fix: { port: 443 },
      });
    } else if (!PREFERRED_PORTS.includes(port)) {
      checks.push({
        id: 'port-unusual',
        severity: 'warn',
        key: 'ev.port-unusual',
        vars: { port },
        fix: { port: 443 },
      });
    }
  }

  // 7. QUIC/UDP based protocols
  if (['hysteria2', 'tuic'].includes(protocol)) {
    checks.push({
      id: 'udp-quic',
      severity: 'warn',
      key: 'ev.udp-quic',
    });
    if (![443, 8443, 2053].includes(port)) {
      checks.push({ id: 'udp-port', severity: 'warn', key: 'ev.udp-port', fix: { port: 443 } });
    }
  }

  // 8. fronting / CDN
  if (domain && cfg.server && hostOf(cfg.server) !== domain) {
    checks.push({
      id: 'cdn-fronting',
      severity: 'info',
      key: 'ev.cdn-fronting',
      vars: { domain },
    });
  }

  // 9. ws/grpc payload
  if (['ws', 'websocket'].includes(transport) && !cfg.path) {
    checks.push({ id: 'ws-no-path', severity: 'info', key: 'ev.ws-no-path' });
  }
  if (transport === 'grpc' && !cfg.path) {
    checks.push({ id: 'grpc-no-name', severity: 'info', key: 'ev.grpc-no-name' });
  }

  // ── score + verdict ─────────────────────────────────────────────────────
  const failing = checks.filter((c) => c.severity === 'fail').length;
  const warning = checks.filter((c) => c.severity === 'warn').length;
  const weight: Record<Severity, number> = { fail: 45, warn: 12, info: 0, pass: 0 };
  const penalty = checks.reduce((sum, c) => sum + weight[c.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  // Any hard failure means "this does not get through the filter", regardless of
  // how many cosmetic warnings surround it.
  const verdict: Assessment['verdict'] = failing > 0
    ? 'blocked'
    : score >= 95 ? 'resilient' : score >= 70 ? 'usable' : 'fragile';

  return {
    score,
    verdict,
    checks,
    summaryKey: `ev.summary.${verdict}`,
    summaryVars: verdict === 'usable' ? { warning } : { failing, warning },
  };
}

/** Sensible Iranian defaults for a fresh config of each protocol. */
export function recommendedDefaults(protocol: string): Record<string, string | number> {
  switch (protocol) {
    case 'vless':
      return { transport: 'tcp', security: 'reality', port: 443, flow: 'xtls-rprx-vision', fp: 'chrome', sni: SNI_GOOD[0], path: '' };
    case 'vmess':
      return { transport: 'tcp', security: 'reality', port: 443, fp: 'chrome', sni: SNI_GOOD[0] };
    case 'trojan':
      return { transport: 'tcp', security: 'tls', port: 443, sni: SNI_GOOD[1], fp: 'chrome' };
    case 'shadowsocks':
      // SS-2022 AEAD has no TLS of its own; putting it behind TLS needs a domain
      // and a cert we cannot invent here, so the honest default is bare SS-2022
      // on 443 (measured to still pass in Iran), flagged as a warning.
      return { transport: 'tcp', port: 443 };
    case 'hysteria2':
      return { port: 443, sni: SNI_GOOD[0] };
    case 'tuic':
      return { port: 443, sni: SNI_GOOD[0] };
    default:
      return { port: 443 };
  }
}

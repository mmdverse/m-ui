/** Real share-link generation for protocols we can produce deterministically. */

export interface LinkConfig {
  name: string;
  protocol: string;
  uuid: string;
  password: string;
  port: number;
  transport: string;
  security: string;
  domain: string;
  path: string;
  sni: string;
  // REALITY
  pbk: string;
  fp: string;
  sid: string;
}

export interface LinkServer {
  host: string;
}

export type LinkResult = { link: string } | { error: string };

const FINGERPRINTS = ['chrome', 'firefox', 'edge', 'safari', 'ios', 'android', '360', 'qq'];
const REALITY_FP = (fp?: string) => (fp && FINGERPRINTS.includes(fp) ? fp : 'chrome');

/** Validates the parts a REALITY link needs; returns an error string or null. */
function realityCheck(config: LinkConfig): string | null {
  if (!config.pbk || !config.pbk.trim()) {
    return 'برای REALITY کلید عمومی (pbk) الزامی است';
  }
  const sni = config.sni || config.domain;
  if (!sni) return 'برای REALITY طول SNI یا دامنه الزامی است';
  return null;
}

export function generateLink(config: LinkConfig, server: LinkServer): LinkResult {
  const host = config.domain && config.domain.trim() ? config.domain.trim() : server.host;
  const name = encodeURIComponent(config.name);
  const path = config.path || '/';
  const transport = config.transport || 'tcp';
  const security = config.security || 'none';
  const uuid = config.uuid;
  const sni = config.sni || config.domain || '';

  switch (config.protocol) {
    case 'vmess': {
      const payload: any = {
        v: '2',
        ps: config.name,
        add: host,
        port: String(config.port),
        id: uuid,
        aid: '0',
        net: transport,
        type: 'none',
        host: config.domain || '',
        path,
        tls: security === 'tls' ? 'tls' : '',
      };
      if (security === 'tls' || security === 'reality') payload.sni = sni;
      if (security === 'reality') {
        const problem = realityCheck(config);
        if (problem) return { error: problem };
        payload.tls = 'reality';
        payload.pbk = config.pbk;
        payload.fp = REALITY_FP(config.fp);
        if (config.sid) payload.sid = config.sid;
      }
      return { link: 'vmess://' + Buffer.from(JSON.stringify(payload)).toString('base64') };
    }
    case 'vless': {
      const params = new URLSearchParams({
        encryption: 'none',
        type: transport,
        security,
        path,
      });
      if (config.domain) params.set('host', config.domain);
      if (security === 'tls' || security === 'reality') {
        if (!sni) return { error: 'برای TLS یا REALITY مقدار SNI یا دامنه الزامی است' };
        params.set('sni', sni);
      }
      if (security === 'reality') {
        const problem = realityCheck(config);
        if (problem) return { error: problem };
        params.set('pbk', config.pbk);
        params.set('fp', REALITY_FP(config.fp));
        if (config.sid) params.set('sid', config.sid);
      }
      return { link: `vless://${uuid}@${host}:${config.port}?${params.toString()}#${name}` };
    }
    case 'trojan': {
      const params = new URLSearchParams({
        security: security === 'none' ? 'tls' : security, // trojan requires TLS
        type: transport === 'tcp' ? 'tcp' : transport,
        path,
      });
      if (config.domain) params.set('host', config.domain);
      if (security === 'reality') {
        const problem = realityCheck(config);
        if (problem) return { error: problem };
        params.set('pbk', config.pbk);
        params.set('fp', REALITY_FP(config.fp));
        if (config.sid) params.set('sid', config.sid);
      }
      if (security === 'tls' || security === 'reality') {
        if (!sni) return { error: 'برای TLS یا REALITY مقدار SNI یا دامنه الزامی است' };
        params.set('sni', sni);
      }
      const password = config.password || config.uuid;
      return { link: `trojan://${encodeURIComponent(password)}@${host}:${config.port}?${params.toString()}#${name}` };
    }
    case 'shadowsocks': {
      const method = 'aes-256-gcm';
      const password = config.password || config.uuid;
      const auth = Buffer.from(`${method}:${password}`).toString('base64');
      return { link: `ss://${auth}@${host}:${config.port}#${name}` };
    }
    // socks5 is a proxy, not a shareable link; wireguard needs real keys
    default:
      return { error: `پروتکل ${config.protocol} لینک قابل تولید ندارد` };
  }
}

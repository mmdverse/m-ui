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
}

export interface LinkServer {
  host: string;
}

export function generateLink(config: LinkConfig, server: LinkServer): string | null {
  const host = config.domain && config.domain.trim() ? config.domain.trim() : server.host;
  const name = encodeURIComponent(config.name);
  const path = config.path || '/';
  const transport = config.transport || 'tcp';
  const security = config.security || 'none';
  const uuid = config.uuid;

  switch (config.protocol) {
    case 'vmess': {
      const payload = {
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
      return 'vmess://' + Buffer.from(JSON.stringify(payload)).toString('base64');
    }
    case 'vless': {
      const params = new URLSearchParams({
        encryption: 'none',
        type: transport,
        security,
        path,
      });
      if (config.domain) params.set('host', config.domain);
      if (config.sni) params.set('sni', config.sni);
      return `vless://${uuid}@${host}:${config.port}?${params.toString()}#${name}`;
    }
    case 'trojan': {
      const params = new URLSearchParams({
        security: security === 'none' ? 'tls' : security, // trojan requires TLS
        type: transport === 'tcp' ? 'tcp' : transport,
        path,
      });
      if (config.domain) params.set('host', config.domain);
      const password = config.password || config.uuid;
      return `trojan://${encodeURIComponent(password)}@${host}:${config.port}?${params.toString()}#${name}`;
    }
    case 'shadowsocks': {
      const method = 'aes-256-gcm';
      const password = config.password || config.uuid;
      const auth = Buffer.from(`${method}:${password}`).toString('base64');
      return `ss://${auth}@${host}:${config.port}#${name}`;
    }
    // socks5 is a proxy, not a shareable link; wireguard needs real keys
    default:
      return null;
  }
}

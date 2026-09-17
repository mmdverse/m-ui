import { describe, expect, it } from 'vitest';
import { generateLink, type LinkConfig } from '@/lib/links';

const base: LinkConfig = {
  name: 'cfg test', protocol: 'vless', uuid: 'd0f1e2a3-b4c5-6789-abcd-ef0123456789',
  password: '', port: 443, transport: 'ws', security: 'tls',
  domain: 'cdn.example.com', path: '/ws', sni: 'cdn.example.com',
  pbk: '', fp: 'chrome', sid: '',
};
const server = { host: '203.0.113.5' };
const withCfg = (patch: Partial<LinkConfig>) => generateLink({ ...base, ...patch }, server);

describe('share links', () => {
  it('vless carries the transport, security and sni', () => {
    const r: any = withCfg({});
    expect(r.link).toMatch(/^vless:\/\/d0f1e2a3.*@cdn\.example\.com:443\?/);
    expect(r.link).toContain('type=ws');
    expect(r.link).toContain('security=tls');
    expect(r.link).toContain('sni=cdn.example.com');
    expect(r.link.endsWith('#cfg%20test')).toBe(true);
  });

  it('vless refuses tls/reality without an sni or domain', () => {
    expect(withCfg({ sni: '', domain: '' })).toEqual(
      expect.objectContaining({ error: expect.stringContaining('SNI'), code: 'api.sniRequired' }),
    );
  });

  it('reality needs a public key, and gets a fingerprint', () => {
    expect(withCfg({ security: 'reality' })).toEqual(
      expect.objectContaining({ error: expect.stringContaining('pbk') }),
    );
    const r: any = withCfg({ security: 'reality', pbk: 'PUBKEY', fp: 'nonsense' });
    expect(r.link).toContain('pbk=PUBKEY');
    expect(r.link).toContain('fp=chrome'); // invalid fp falls back, never emitted raw
  });

  it('vmess is a base64 JSON payload with the right fields', () => {
    const r: any = withCfg({ protocol: 'vmess' });
    const json = JSON.parse(Buffer.from(r.link.slice(8), 'base64').toString());
    expect(json).toMatchObject({ v: '2', add: 'cdn.example.com', port: '443', net: 'ws', tls: 'tls' });
  });

  it('trojan always ends up with TLS even when security is none', () => {
    const r: any = withCfg({ protocol: 'trojan', password: 'pw', security: 'none' });
    expect(r.link).toContain('security=tls');
    expect(r.link.startsWith('trojan://pw@')).toBe(true);
  });

  it('shadowsocks encodes method:password', () => {
    const r: any = withCfg({ protocol: 'shadowsocks', password: 'pw' });
    const auth = r.link.slice(5).split('@')[0];
    expect(Buffer.from(auth, 'base64').toString()).toBe('aes-256-gcm:pw');
  });

  it('socks5 and wireguard have no share link', () => {
    expect(withCfg({ protocol: 'socks5' })).toEqual(
      expect.objectContaining({ error: expect.any(String), code: 'api.protocolNoLink' }),
    );
    expect(withCfg({ protocol: 'wireguard' })).toEqual(
      expect.objectContaining({ error: expect.any(String), code: 'api.protocolNoLink' }),
    );
  });

  it('falls back to the server host when no domain is set', () => {
    const r: any = withCfg({ domain: '' });
    expect(r.link).toContain('@203.0.113.5:443');
  });
});

import { describe, expect, it } from 'vitest';
import { assessForIran, recommendedDefaults, SNI_AVOID, SNI_GOOD } from '@/lib/evasion';

const hard = { protocol: 'vless', transport: 'tcp', security: 'reality', port: 443,
  pbk: 'PzGbo-tzW1ohcTj3fIeWtAnTwBZXHxvq0gCkojOqmx0', sid: 'a1b2', fp: 'chrome', flow: 'xtls-rprx-vision', sni: SNI_GOOD[0] };

const ids = (a: ReturnType<typeof assessForIran>) => a.checks.map((c) => c.id);

describe('Iran censorship assessment', () => {
  it('a properly configured VLESS+REALITY+Vision scores resilient', () => {
    const a = assessForIran(hard);
    expect(a.verdict).toBe('resilient');
    expect(a.score).toBe(100);
    expect(ids(a)).toContain('port-443');
    expect(ids(a)).toContain('reality-sni-good');
  });

  it('calls bare WireGuard out — the 148-byte handshake is fingerprinted', () => {
    const a = assessForIran({ protocol: 'wireguard', port: 51820 });
    expect(a.verdict).toBe('blocked');
    expect(ids(a)).toContain('protocol-wireguard');
    expect(ids(a)).toContain('port-avoid');
  });

  it('flags a REALITY config whose SNI is itself censored in Iran', () => {
    const a = assessForIran({ ...hard, sni: 'www.instagram.com' });
    expect(ids(a)).toContain('reality-sni-blocked');
    expect(a.verdict).not.toBe('resilient');
    expect(SNI_AVOID).toContain('instagram.com');
  });

  it('flags REALITY without a public key and pushes a fix', () => {
    const a = assessForIran({ ...hard, pbk: '' });
    expect(ids(a)).toContain('reality-no-pbk');
    expect(a.verdict).toBe('blocked');
  });

  it('warns when Vision flow is missing (TLS-in-TLS length signature)', () => {
    const a = assessForIran({ ...hard, flow: '' });
    expect(ids(a)).toContain('reality-no-vision');
    expect(a.checks.find((c) => c.id === 'reality-no-vision')?.fix).toEqual({ flow: 'xtls-rprx-vision' });
  });

  it('warns on randomized fingerprints', () => {
    expect(ids(assessForIran({ ...hard, fp: 'random' }))).toContain('fp-risky');
    expect(ids(assessForIran({ ...hard, fp: 'chrome' }))).not.toContain('fp-risky');
  });

  it('fails any tunnel that is not TLS-shaped (whitelist drops it)', () => {
    expect(ids(assessForIran({ protocol: 'vless', transport: 'tcp', security: 'none', port: 443 }))).toContain('no-tls');
    expect(ids(assessForIran({ protocol: 'vmess', transport: 'ws', security: 'none', port: 443 }))).toContain('no-tls');
  });

  it('keeps QUIC protocols usable but warns about UDP filtering', () => {
    const a = assessForIran({ protocol: 'hysteria2', port: 443, sni: SNI_GOOD[0] });
    expect(ids(a)).toContain('udp-quic');
    expect(a.verdict).toBe('usable');
  });

  it('every failure carries a machine-applicable fix', () => {
    for (const cfg of [{ protocol: 'wireguard' }, { protocol: 'vless', security: 'none' }, { ...hard, pbk: '' }]) {
      const fails = assessForIran(cfg).checks.filter((c) => c.severity === 'fail');
      expect(fails.length).toBeGreaterThan(0);
      expect(fails.every((c) => !!c.fix)).toBe(true);
    }
  });

  it('recommended defaults for vless are themselves resilient', () => {
    const d = recommendedDefaults('vless') as any;
    expect(assessForIran({ protocol: 'vless', pbk: 'PzGbo-tzW1ohcTj3fIeWtAnTwBZXHxvq0gCkojOqmx0', ...d }).verdict).toBe('resilient');
  });
});

describe('REALITY key shape (learned from xray-core 26.3.27 validation)', () => {
  it('rejects a placeholder public key', () => {
    const a = assessForIran({ ...hard, pbk: 'PUBLICKEY_PLACEHOLDER' });
    expect(ids(a)).toContain('reality-bad-pbk');
    expect(a.verdict).toBe('blocked');
  });

  it('rejects a non-hex shortId', () => {
    expect(ids(assessForIran({ ...hard, sid: 'zz' }))).toContain('reality-bad-sid');
  });

  it('accepts a real generated key pair and hex shortId', () => {
    const a = assessForIran({ ...hard, pbk: 'PzGbo-tzW1ohcTj3fIeWtAnTwBZXHxvq0gCkojOqmx0', sid: 'a1b2c3d4' });
    expect(ids(a)).not.toContain('reality-bad-pbk');
    expect(ids(a)).not.toContain('reality-bad-sid');
    expect(a.verdict).toBe('resilient');
  });
});

describe('recommended defaults cover every protocol honestly', () => {
  it('shadowsocks default is bare SS-2022 on 443, usable not resilient', () => {
    const d = recommendedDefaults('shadowsocks') as any;
    expect(d.port).toBe(443);
    expect(d.security).toBeUndefined();
    const a = assessForIran({ protocol: 'shadowsocks', ...d });
    expect(ids(a)).toContain('protocol-ss');
    expect(ids(a)).not.toContain('no-tls');
    expect(a.verdict).toBe('usable');
  });
});

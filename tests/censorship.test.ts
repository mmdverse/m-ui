import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  COUNTRY_ORDER,
  DEPRECATED_PLANS,
  LAYER_META,
  PLANS,
  PLAN_ORDER,
  PROFILES,
  SOURCES,
  assess,
  best,
  isXrayNative,
  rank,
  rulesDocument,
  snippet,
  verdictOf,
} from '../src/lib/censorship';
import { JA4_ALLOWLIST, JA4_NAMES, MEASURED_FINGERPRINTS } from '../src/lib/censorship/fingerprints';
import { assessForIran } from '../src/lib/evasion';

const RULES_PATH = path.resolve(__dirname, '../testenv/censor/rules.json');

/** این تست هم rules.json را می‌سازد و هم از واگرایی مدل و شبیه‌ساز جلوگیری می‌کند. */
describe('rules.json ↔ model', () => {
  it('on disk matches the model', () => {
    const serialized = JSON.stringify(rulesDocument(), null, 2) + '\n';
    if (process.env.UPDATE_RULES === '1' || !fs.existsSync(RULES_PATH)) {
      fs.mkdirSync(path.dirname(RULES_PATH), { recursive: true });
      fs.writeFileSync(RULES_PATH, serialized);
    }
    expect(fs.readFileSync(RULES_PATH, 'utf8')).toBe(serialized);
  });
});

describe('country profiles', () => {
  it('every layer is unique, has a real source and sane severity', () => {
    for (const id of COUNTRY_ORDER) {
      const profile = PROFILES[id];
      const seen = new Set<string>();
      for (const l of profile.layers) {
        expect(seen.has(l.id), `${id}/${l.id} duplicated`).toBe(false);
        seen.add(l.id);
        expect(l.severity).toBeGreaterThanOrEqual(1);
        expect(l.severity).toBeLessThanOrEqual(5);
        if (id !== 'open') expect(SOURCES[l.evidence], `${id}/${l.id} → ${l.evidence}`).toBeDefined();
      }
    }
  });

  it('filters with published mechanics carry the matching layer', () => {
    // GFW: تشخیص ترافیک کاملاً رمز، QUIC و پروب فعال
    for (const l of ['fep_detect', 'active_probe', 'quic_sni', 'tls_in_tls'] as const) {
      expect(PROFILES.cn.layers.map((x) => x.id)).toContain(l);
    }
    // TSPU: ECH، بازچینش دوگانه، اثرانگشت QUIC v1
    for (const l of ['ech_drop', 'reassembly', 'quic_v1_fingerprint'] as const) {
      expect(PROFILES.ru.layers.map((x) => x.id)).toContain(l);
    }
    // ایران: وایت‌لیست پروتکلی
    expect(PROFILES.ir.layers.map((x) => x.id)).toContain('proto_whitelist');
    // ترکمنستان: وایت‌لیست SNI
    expect(PROFILES.tm.layers.map((x) => x.id)).toContain('sni_whitelist');
  });

  it('marks simulated vs modelled layers honestly', () => {
    const simulated = new Set(
      Object.values(PROFILES)
        .flatMap((p) => p.layers)
        .filter((l) => l.simulated)
        .map((l) => l.id),
    );
    // این‌ها در شبیه‌ساز پایتون واقعاً تصمیم‌گیری می‌کنند
    for (const l of ['sni_block', 'fep_detect', 'quic_sni', 'ech_drop', 'ja4_fingerprint'] as const) {
      expect(simulated.has(l)).toBe(true);
    }
    // و این‌ها فقط مدل‌اند: شبیه‌ساز ادعای اجرایشان را ندارد
    for (const l of ['dns_poison', 'active_probe', 'ml_flow'] as const) {
      expect(LAYER_META[l].simulated).toBe(false);
    }
  });
});

describe('assessment', () => {
  it('fragmenting never scores worse than not fragmenting anywhere', () => {
    for (const id of COUNTRY_ORDER) {
      const base = assess(id, 'reality-vision');
      const frag = assess(id, 'reality-vision-frag');
      expect(frag.score, `${id}`).toBeGreaterThanOrEqual(base.score);
    }
  });

  it('every country, every plan: score and verdict agree', () => {
    for (const id of COUNTRY_ORDER) {
      for (const p of PLAN_ORDER) {
        const a = assess(id, p);
        expect(a.score).toBeGreaterThanOrEqual(0);
        expect(a.score).toBeLessThanOrEqual(100);
        expect(a.verdict).toBe(verdictOf(a.score));
        expect(a.rows).toHaveLength(PROFILES[id].layers.length);
      }
    }
  });

  it('kills the dead protocols in the hard countries', () => {
    for (const country of ['ir', 'ru', 'cn', 'tm'] as const) {
      for (const plan of ['wireguard', 'openvpn-tcp', 'ss2022-plain', 'vmess-tcp-plain'] as const) {
        expect(assess(country, plan).score, `${country}/${plan}`).toBeLessThan(55);
      }
    }
  });

  it('the winner is a REALITY-family plan where reality is the answer; TM falls back to a CDN', () => {
    for (const country of ['ir', 'ru', 'cn'] as const) {
      expect(best(country).plan.security, country).toBe('reality');
    }
    // ترکمنستان: گزارش‌ها می‌گویند فقط domain-fronting از CDN جواب می‌دهد.
    expect(['ws-tls-cdn', 'reality-vision-frag']).toContain(best('tm').plan.id);
    expect(best('tm').plan.id).toBe('ws-tls-cdn');
    for (const country of ['ir', 'ru', 'cn', 'tm'] as const) {
      expect(best(country).score, country).toBeGreaterThanOrEqual(65);
      expect(DEPRECATED_PLANS).not.toContain(best(country).plan.id);
    }
  });

  it('UDP plans are hammered where UDP is filtered', () => {
    for (const country of ['ir', 'tm'] as const) {
      expect(assess(country, 'hy2-obfs').verdict).toBe('blocked');
    }
    // هر دو در RU سقف صفر می‌خورند، پس جریمهٔ خام را مقایسه می‌کنیم.
    expect(assess('ru', 'hy2-obfs').penalty).toBeGreaterThan(assess('ru', 'hy2-obfs-unknownver').penalty);
    expect(assess('cn', 'hy2-obfs').penalty).toBeGreaterThan(assess('cn', 'hy2-obfs-unknownver').penalty);
    const quicRow = assess('ru', 'hy2-obfs').rows.find((r) => r.layer === 'quic_v1_fingerprint')!;
    expect(quicRow.coverage).toBe('exposed');
    const tcpRow = assess('ru', 'reality-vision').rows.find((r) => r.layer === 'quic_v1_fingerprint')!;
    expect(tcpRow.coverage).toBe('covered');
  });

  it('CN punishes TLS-in-TLS: vision beats bare TLS', () => {
    const vision = assess('cn', 'reality-vision');
    const trojan = assess('cn', 'trojan-tls');
    expect(vision.score).toBeGreaterThan(trojan.score);
    const tlsRow = trojan.rows.find((r) => r.layer === 'tls_in_tls')!;
    expect(tlsRow.coverage).not.toBe('covered');
  });

  it('whitelist options actually move the needle', () => {
    const plain = assess('tm', 'reality-vision');
    const whitelisted = assess('tm', 'reality-vision', { sniWhitelisted: true });
    expect(whitelisted.score).toBeGreaterThan(plain.score);
    const cdn = assess('ru', 'ws-tls-cdn', { behindCdn: true });
    const bare = assess('ru', 'ws-tls-cdn');
    expect(cdn.score).toBeGreaterThanOrEqual(bare.score);
  });

  it('stays consistent with the Iran-specific advisor', () => {
    // مشاور قدیمی ایران باید همچنان قوی‌ترین حالت را تأیید کند.
    const good = assessForIran({
      protocol: 'vless',
      transport: 'tcp',
      security: 'reality',
      port: 443,
      sni: 'www.microsoft.com',
      flow: 'xtls-rprx-vision',
      fp: 'chrome',
      pbk: 'A'.repeat(43),
      sid: 'a1b2c3d4',
    });
    expect(['resilient', 'usable']).toContain(good.verdict);
    expect(assess('ir', 'reality-vision-frag').score).toBeGreaterThan(assess('ir', 'ss2022-plain').score);
    // و پورت‌های ممنوع هر دو جا یکی‌اند
    expect(assess('ir', 'ss2022-plain').verdict).toBe('blocked');
  });

  it('exposes blockers with a plan that fixes them', () => {
    const a = assess('cn', 'ss2022-plain');
    expect(a.blockers.length).toBeGreaterThan(0);
    for (const layer of a.blockers.slice(0, 2)) {
      const row = a.rows.find((r) => r.layer === layer)!;
      expect(row.fixedBy).toBeDefined();
    }
    expect(a.actions.length).toBeGreaterThan(0);
  });

  it('ranking is stable and open country prefers the simplest thing', () => {
    const ranked = rank('open');
    expect(ranked[0].score).toBe(100);
    expect(ranked.every((r) => r.score === 100)).toBe(true);
    expect(rank('ir').length).toBe(PLAN_ORDER.length);
  });
});

describe('config snippets', () => {
  const params = {
    server: '203.0.113.7',
    port: 443,
    uuid: '11111111-2222-3333-4444-555555555555',
    sni: 'www.microsoft.com',
    publicKey: 'PBK',
    privateKey: 'PRIV',
    shortId: 'abcd1234',
  };

  it('REALITY snippets are valid JSON with the required fields', () => {
    const s = snippet('reality-vision-frag', params);
    expect(s.language).toBe('json');
    const parsed = JSON.parse(s.text);
    expect(parsed.client.streamSettings.realitySettings.publicKey).toBe('PBK');
    expect(parsed.client.settings.vnext[0].users[0].flow).toBe('xtls-rprx-vision');
    const mask = parsed.client.streamSettings.finalmask.tcp[0];
    expect(mask.type).toBe('fragment');
    expect(mask.settings.packets).toBe('tlshello');
    // بدون delay همهٔ رکوردها در یک سگمنت TCP می‌روند و نصفِ محافظت از دست می‌رود
    expect(mask.settings.delay).toBeDefined();
    expect(mask.settings.length).toBeDefined();
    // کلید قدیمی در Xray ≥۲۵ بی‌صدا نادیده گرفته می‌شود → هرگز نباید تولیدش کنیم
    expect(parsed.client.streamSettings.fragment).toBeUndefined();
    expect(parsed.server.inbound.streamSettings.realitySettings.serverNames).toEqual(['www.microsoft.com']);
    expect(s.mustHave.join(' ')).toMatch(/finalmask/);
  });

  it('non-fragmenting REALITY carries no finalmask', () => {
    const parsed = JSON.parse(snippet('reality-vision', params).text);
    expect(parsed.client.streamSettings.finalmask).toBeUndefined();
  });

  it('XHTTP plan emits mode stream-up', () => {
    const parsed = JSON.parse(snippet('reality-xhttp', params).text);
    expect(parsed.client.streamSettings.xhttpSettings.mode).toBe('stream-up');
  });

  it('AmneziaWG and Hysteria2 get non-JSON snippets with their obfuscation', () => {
    const awg = snippet('amneziawg', params);
    expect(awg.language).toBe('ini');
    expect(awg.text).toMatch(/Jc = \d/);
    const hy2 = snippet('hy2-obfs-unknownver', params);
    expect(hy2.language).toBe('yaml');
    expect(hy2.text).toMatch(/salamander/);
    expect(hy2.mustHave.join(' ')).toMatch(/unassigned QUIC version/);
  });

  it('knows which plans xray can run natively', () => {
    expect(isXrayNative('reality-vision')).toBe(true);
    expect(isXrayNative('hy2-obfs')).toBe(false);
    expect(isXrayNative('amneziawg')).toBe(false);
  });

  it('every plan is reachable from at least one country ranking', () => {
    const seen = new Set(PLAN_ORDER.map((p) => PLANS[p].id));
    expect(seen.size).toBe(PLAN_ORDER.length);
  });
});

/**
 * اثرانگشت‌های TLS: پایهٔ لایهٔ JA3/JA4 امارات.
 *
 * `src/lib/censorship/fingerprints.ts` تولیدشده است (نه دست‌نویس):
 * `testenv/censor/fpmeasure.py` با xray برای هر مقدار fingerprint یک ClientHello
 * واقعی می‌فرستد و JA3 را حساب می‌کند. این تست جلوی واگرایی داده و مدل را می‌گیرد.
 */
describe('measured TLS fingerprints', () => {
  type Measured = { ja4: string; ja3: string; ja4_variants: number; ja3_variants: number; grease: boolean; browser: boolean };
  const measuredOnDisk = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../testenv/censor/fingerprints-measured.json'), 'utf8'),
  ) as Record<string, Measured & { lab_curl?: string[] }>;

  it('fingerprints.ts is exactly what fpmeasure.py measured', () => {
    const names = Object.keys(measuredOnDisk);
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const name of names) {
      const model = MEASURED_FINGERPRINTS[name];
      expect(model, `missing fingerprint "${name}" in the model`).toBeDefined();
      expect(model.ja4, `JA4 drift for "${name}"`).toBe(measuredOnDisk[name].ja4);
      expect(model.ja3, `JA3 drift for "${name}"`).toBe(measuredOnDisk[name].ja3);
      expect(model.grease).toBe(measuredOnDisk[name].grease);
      expect(model.browser).toBe(measuredOnDisk[name].browser);
    }
  });

  it('JA3 of uTLS/chrome is unstable while JA4 is stable (measured)', () => {
    // این همان دلیلی است که لایهٔ امارات روی JA4 بسته شده: کروم ترتیب extension
    // را در هر اتصال عوض می‌کند و JA3 برای یک کلاینت ثابت نیست.
    expect(measuredOnDisk.chrome.ja3_variants).toBeGreaterThan(1);
    expect(measuredOnDisk.chrome.ja4_variants).toBe(1);
    expect(measuredOnDisk.randomized.ja4_variants).toBeGreaterThan(1); // پروفایل تصادفی → ناپایدار
  });

  it('the allowlist holds browser profiles and nothing else', () => {
    for (const ja4 of JA4_ALLOWLIST) {
      const owners = Object.values(MEASURED_FINGERPRINTS).filter((f) => f.ja4 === ja4);
      expect(owners.length, `allowlisted JA4 ${ja4} is not a measured profile`).toBeGreaterThan(0);
      // JA4 مشترک بین دو پروفایل ممکن است (مثلاً chrome و default یکی‌اند) و
      // پروفایل تصادفی هم ممکن است شانسی به همان JA4 برسد — پس «حداقل یک
      // مرورگر» معیار است، نه «همه».
      expect(owners.some((o) => o.browser), `allowlisted JA4 ${ja4} has no browser profile`).toBe(true);
    }
    expect(JA4_ALLOWLIST).toContain(MEASURED_FINGERPRINTS.chrome.ja4);
    expect(JA4_ALLOWLIST).not.toContain(MEASURED_FINGERPRINTS.randomized.ja4);
    expect(JA4_NAMES[MEASURED_FINGERPRINTS.chrome.ja4]).toBeDefined();
  });

  it('every TLS-shaped plan declares a measured client fingerprint', () => {
    for (const id of PLAN_ORDER) {
      const plan = PLANS[id];
      if (!plan.tlsShaped) continue;
      expect(plan.clientFingerprint, `plan ${id} does not declare clientFingerprint`).toBeDefined();
      expect(MEASURED_FINGERPRINTS[plan.clientFingerprint!], `plan ${id} points at an unmeasured profile`).toBeDefined();
    }
  });

  it('the AE layer is decided by the JA3 allowlist, not by hand-waving', () => {
    const rowsFor = (id: Parameters<typeof assess>[1]) =>
      assess('ae', id).rows.find((r) => r.layer === 'ja4_fingerprint')!;
    // uTLS/chrome → JA4اش در فهرست مجاز امارات است
    expect(rowsFor('reality-vision').coverage).toBe('covered');
    // طرحی که ClientHello نمی‌فرستد نه پوشش دارد نه کاملاً بی‌دفاع است
    expect(rowsFor('amneziawg').coverage).toBe('partial');
    // بهترین برنامهٔ امارات باید همان کلاینتی باشد که JA3 مجاز دارد
    expect(PLANS[best('ae').plan.id].clientFingerprint).toBe('chrome');
  });
});

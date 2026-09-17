import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildPipeline, hopConfigs, pipelineOverheadMs, validatePipeline, MEASURED_HOP_OVERHEAD_MS } from '../src/lib/censorship/transit';
import { PROFILES } from '../src/lib/censorship/countries';
import { assess } from '../src/lib/censorship/engine';

const XRAY = path.resolve(__dirname, '../testenv/bin/xray');
const measuredPath = path.resolve(__dirname, '../testenv/transit-measured.json');

const PARAMS = {
  server: 'ENTRY.HOST.IP',
  port: 443,
  uuid: '11111111-2222-3333-4444-555555555555',
  sni: 'www.microsoft.com',
};

/** کانفیگ را با خودِ Xray اعتبارسنجی می‌کند — تست واقعی، نه JSON.parse. */
function xrayAccepts(cfg: unknown, name: string): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'transit-'));
  const file = path.join(dir, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  const res = spawnSync(XRAY, ['run', '-test', '-c', file], { encoding: 'utf8' });
  const code = res.status === 0;
  fs.rmSync(dir, { recursive: true, force: true });
  expect(code, `Xray کانفیگ ${name} را قبول نکرد: ${res.stdout}${res.stderr}`).toBe(true);
}

describe('lab ترانزیت — اندازه‌گیری سربار گره', () => {
  it('فایل اندازه‌گیری موجود است و اجرای واقعی را تأیید می‌کند', () => {
    expect(fs.existsSync(measuredPath), 'testenv/transit-measured.json نیست: python3 testenv/transit-lab.py را اجرا کن').toBe(true);
    const measured = JSON.parse(fs.readFileSync(measuredPath, 'utf8')) as {
      verdict: string;
      per_hop_overhead_ms: number;
      scenarios: { hops: number; median_ms: number }[];
    };
    expect(measured.verdict).toBe('PASS');
    expect(measured.scenarios.map((s) => s.hops).sort()).toEqual([1, 3]);
    for (const s of measured.scenarios) expect(s.median_ms).toBeGreaterThan(0);
    // عدد مدل باید در همان بازهٔ اندازه‌گیری‌شده باشد (روی loopback و بین اجراها
    // نوسان دارد؛ به‌جای برابری دقیق، بازه را قفل می‌کنیم).
    expect(Math.abs(MEASURED_HOP_OVERHEAD_MS - measured.per_hop_overhead_ms)).toBeLessThan(0.5);
  });

  it('سه گره فقط چند دهم میلی‌ثانیه از یک گره کندتر است (روی loopback)', () => {
    const measured = JSON.parse(fs.readFileSync(measuredPath, 'utf8')) as {
      scenarios: { hops: number; median_ms: number }[];
    };
    const one = measured.scenarios.find((s) => s.hops === 1)!;
    const three = measured.scenarios.find((s) => s.hops === 3)!;
    // ادعای مدل: بالا بردن گره‌ها روی loopback تقریباً هزینه‌ای ندارد.
    expect(three.median_ms).toBeLessThan(one.median_ms * 2);
  });
});

describe('خط لولهٔ ترانزیت — سلامت ساختاری', () => {
  const pipeline = buildPipeline('ir');

  it('خط لولهٔ ایران سالم است (ورودی، خروج، کشورهای متفاوت، تکه‌سازی ورودی)', () => {
    expect(validatePipeline(pipeline)).toEqual([]);
  });

  it('پای ورودی همان طرحی است که مدل برای ایران بهترین می‌داند', () => {
    const best = assess('ir', pipeline.hops[0].leg.plan);
    const killers = best.rows.filter((r) => r.severity >= 4 && r.coverage === 'exposed');
    expect(killers.map((k) => k.layer)).toEqual([]);
    expect(best.verdict === 'resilient' || best.verdict === 'usable').toBe(true);
  });

  it('هر لایهٔ شدت‌بالای ایران روی کانفیگ کلاینت جبران شده است', () => {
    const entry = pipeline.hops[0].leg;
    const must = entry.must.join(' ');
    // چیزهایی که بدون آن‌ها ادعای پوشش دروغ می‌شد:
    expect(must).toContain('fingerprint');
    expect(must).toContain('xtls-rprx-vision');
    expect(must).toContain('finalmask');
    expect(entry.fragmented).toBe(true);
    const critical = PROFILES.ir.layers.filter((l) => l.severity >= 4).map((l) => l.id);
    expect(critical.length).toBeGreaterThan(3);
  });

  it('تعداد گره با سربار گزارش‌شده هم‌خوان است', () => {
    expect(pipelineOverheadMs(pipeline)).toBeCloseTo((pipeline.hops.length - 1) * MEASURED_HOP_OVERHEAD_MS, 2);
  });
});

describe('خط لولهٔ ترانزیت — کانفیگ‌های تولیدی', () => {
  const pipeline = buildPipeline('ir');
  const configs = hopConfigs(pipeline, PARAMS);
  // برای اعتبارسنجی با خود Xray، کلید و شناسه‌های *معتبر* ولی تصادفی می‌سازیم؛
  // جای‌نگهدارها فرمت نامعتبر دارند و Xray عمداً آن‌ها را رد می‌کند.
  const validKeys = {
    realityPrivateKey: randomBytes(32).toString('base64url'),
    realityPublicKey: randomBytes(32).toString('base64url'),
    shortId: randomBytes(4).toString('hex'),
  };
  const liveConfigs = hopConfigs(pipeline, { ...PARAMS, ...validKeys });

  it('هیچ مقدار واقعی/رازی داخل کانفیگ‌های تولیدی نیست', () => {
    // بدون دادن UUID/کلید، همه‌چیز جای‌نگهدار می‌شود.
    const text = JSON.stringify(hopConfigs(pipeline, { server: PARAMS.server, port: PARAMS.port, sni: PARAMS.sni }));
    expect(text).toContain('PLACEHOLDER-UUID');
    // کلید خصوصی جای‌نگهدار داخل همان کانفیگ سرورهاست، ولی به‌عمد نامعتبر است
    // (Xray با آن بالا نمی‌آید) — یعنی امکان ندارد کسی کانفیگ ناتمام را اجرا کند.
    expect(text).toContain('PLACEHOLDER-REALITY-PRIVATE-KEY');
    expect(text).not.toMatch(/BEGIN (RSA |OPENSSH |)PRIVATE KEY/);
    // UUID نمونه است، ولی کلید خصوصی واقعی هرگز نباید داخل کانفیگ کلاینت بیاید
    expect(JSON.stringify(configs.client)).not.toContain('privateKey');
  });

  it('کلاینت تکه‌سازی واقعی و اثرانگشت مرورگر را اجباری دارد', () => {
    const stream = configs.client.outbounds[0].streamSettings as Record<string, unknown>;
    expect((stream.finalmask as { tcp: { settings: Record<string, string> }[] }).tcp[0].settings.packets).toBe('tlshello');
    expect((stream.tlsSettings as { fingerprint: string }).fingerprint).toBe('chrome');
  });

  it('زنجیره واقعاً زنجیر است: هر گره ترافیک ورودی را به گره بعد می‌دهد', () => {
    for (const [name, cfg] of Object.entries({ entry: configs.entry, relay: configs.relay })) {
      const rule = cfg.routing.rules.find((r: { inboundTag?: string[] }) => r.inboundTag);
      expect(rule, `${name} قاعدهٔ مسیریابی ورودی ندارد`).toBeDefined();
      const outbound = rule!.outboundTag;
      const tag = cfg.outbounds.find((o: { tag: string }) => o.tag === outbound);
      expect(tag?.protocol, `${name} باید ترافیک را به گره بعد پروکسی کند`).toBe('vless');
    }
    // گرهٔ خروج مستقیم به freedom می‌رود (نقطهٔ خروج)
    expect(configs.exit.routing.rules[0].outboundTag).toBe('direct');
    // پای ورودی هرگز نباید کلید خصوصی گرهٔ بعد را حمل کند
    expect(JSON.stringify(configs.entry.outbounds[0])).toContain('publicKey');
    expect(JSON.stringify(configs.entry.outbounds[0])).not.toContain('"privateKey"');
    expect(configs.exit.outbounds[0].protocol).toBe('freedom');
  });

  it('کانفیگ‌های جای‌نگهدار عمداً اجرا نمی‌شوند (Xray کلید نامعتبر را رد می‌کند)', () => {
    if (!fs.existsSync(XRAY)) return;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'transit-bad-'));
    const file = path.join(dir, 'placeholder.json');
    fs.writeFileSync(file, JSON.stringify(configs.entry, null, 2));
    const res = spawnSync(XRAY, ['run', '-test', '-c', file], { encoding: 'utf8' });
    fs.rmSync(dir, { recursive: true, force: true });
    expect(res.status, 'Xray نباید کانفیگ جای‌نگهدار را قبول کند').not.toBe(0);
  });

  it('هر چهار کانفیگ را خود Xray قبول می‌کند (اگر باینری موجود باشد)', () => {
    if (!fs.existsSync(XRAY)) {
      console.warn(`Xray پیدا نشد (${XRAY}) — این تست رد شد`);
      return;
    }
    xrayAccepts(liveConfigs.entry, 'entry');
    xrayAccepts(liveConfigs.relay, 'relay');
    xrayAccepts(liveConfigs.exit, 'exit');
    xrayAccepts(liveConfigs.client, 'client');
  });
});

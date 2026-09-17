import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import fa from '../src/i18n/fa';
import en from '../src/i18n/en';
import ru from '../src/i18n/ru';
import ar from '../src/i18n/ar';
import zh from '../src/i18n/zh';
import { detectLocale, interpolate, translate, LOCALES, LOCALE_META } from '../src/i18n/core';
import { assessForIran } from '../src/lib/evasion';

const tables = { en, ru, ar, zh } as const;
/**
 * هر فایل ts/tsx زیر src (به‌جز خود i18n) — برای اسکن کلیدها و کدهای خطا.
 */
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.tsx?$/.test(e.name) && !full.includes('/i18n/') ? [full] : [];
  });
}

/** حروف/ارقامی که فقط در فارسی به کار می‌روند — عربی از معادل‌های خودش استفاده می‌کند. */
const PERSIAN_ONLY = /[\u067E\u0686\u0698\u06A9\u06AF\u06CC\u06F0-\u06F9]/;
const faKeys = Object.keys(fa).sort();

describe('i18n — هم‌سانی کلیدها', () => {
  for (const [name, table] of Object.entries(tables)) {
    it(`«${name}» دقیقاً همان کلیدهای fa را دارد`, () => {
      expect(Object.keys(table).sort()).toEqual(faKeys);
    });

    it(`«${name}» هیچ مقدار خالی یا جای‌نگهدارِ ترجمه‌نشده ندارد`, () => {
      for (const [key, value] of Object.entries(table as Record<string, string>)) {
        expect(value.trim().length, `کلید ${key}`).toBeGreaterThan(0);
        // متنی که از فارسی کپی شده باشد = ترجمه‌نشده. حروف و ارقام مخصوص
        // فارسی (پ چ ژ گ ک ی ۰-۹) در عربی هم وجود ندارند، پس نشانهٔ خوبی است.
        expect(PERSIAN_ONLY.test(value), `کلید ${key} ترجمه نشده: ${value}`).toBe(false);
      }
    });
  }

  it('زبان پیش‌فرض fa است و پنج زبان پشتیبانی می‌شود', () => {
    expect(LOCALES).toEqual(['fa', 'en', 'ru', 'ar', 'zh']);
    expect(LOCALE_META.fa.dir).toBe('rtl');
    expect(LOCALE_META.ar.dir).toBe('rtl');
    expect(LOCALE_META.en.dir).toBe('ltr');
    expect(LOCALE_META.ru.dir).toBe('ltr');
    expect(LOCALE_META.zh.dir).toBe('ltr');
  });

  it('جای‌نگهدارهای {var} بین fa و ترجمه‌ها یکسان است', () => {
    const varsOf = (s: string) => (s.match(/\{(\w+)\}/g) || []).sort().join(',');
    for (const [name, table] of Object.entries(tables)) {
      for (const key of faKeys) {
        const a = varsOf((fa as Record<string, string>)[key]);
        const b = varsOf((table as Record<string, string>)[key]);
        expect(b, `${name} → ${key} (انتظار: ${a}، دریافت: ${b})`).toBe(a);
      }
    }
  });
});

describe('i18n — تشخیص زبان و درج مقادیر', () => {
  it('زبان مرورگر را به نزدیک‌ترین زبان پشتیبانی‌شده نگاشت می‌کند', () => {
    expect(detectLocale(['fa-IR', 'fa'])).toBe('fa');
    expect(detectLocale(['zh-Hans-CN'])).toBe('zh');
    expect(detectLocale(['ru-RU'])).toBe('ru');
    expect(detectLocale(['ar-EG'])).toBe('ar');
    expect(detectLocale(['en-GB', 'de'])).toBe('en');
  });

  it('برای زبان ناشناخته به فارسی برمی‌گردد', () => {
    expect(detectLocale(['de-DE', 'sv'])).toBe('fa');
    expect(detectLocale([])).toBe('fa');
  });

  it('مقدارها را در جای‌نگهدار می‌گذارد', () => {
    expect(translate('fa', 'srv.connected', { cpu: 12, ram: 40, load: '0.31' })).toContain('12');
    expect(interpolate('پورت {port} بسته است', { port: 51820 })).toBe('پورت 51820 بسته است');
    // کلید ناشناخته جای‌نگهدار را دست‌نخورده می‌گذارد
    expect(interpolate('{a} و {b}', { a: 'x' })).toBe('x و {b}');
  });

  it('کلید ناموجود به خودِ کلید برمی‌گردد تا در UI لو برود', () => {
    expect(translate('en', 'nope.missing')).toBe('nope.missing');
  });
});

describe('i18n — پیام‌های موتور فیلترشکن', () => {
  const cfg = {
    protocol: 'vless', transport: 'tcp', security: 'reality', port: 443,
    sni: 'x.com', pbk: 'x'.repeat(43), sid: 'ab', fp: 'randomized', flow: '',
  };

  it('موتور evasion به‌جای متن، کلید ترجمه می‌دهد', () => {
    const a = assessForIran(cfg);
    expect(a.summaryKey).toMatch(/^ev\.summary\./);
    for (const c of a.checks) {
      expect(c.key).toMatch(/^ev\./);
    }
  });

  it('هر کلیدِ تولیدشده در هر پنج دیکشنری وجود دارد (وگرنه در UI خام دیده می‌شود)', () => {
    const assessments = [
      cfg,
      { protocol: 'wireguard', transport: 'tcp', security: 'none', port: 51820 },
      { protocol: 'vmess', transport: 'ws', security: 'tls', port: 80, domain: 'cf.example.com' },
      { protocol: 'hysteria2', transport: 'quic', security: 'tls', port: 9999, sni: 'www.microsoft.com' },
      { protocol: 'shadowsocks', transport: 'tcp', security: 'none', port: 8388 },
      { protocol: 'trojan', transport: 'grpc', security: 'tls', port: 443, sni: 'www.apple.com' },
    ];
    for (const c of assessments) {
      const a = assessForIran(c as any);
      const keys = [a.summaryKey, ...a.checks.map((x) => x.key)];
      for (const k of keys) {
        for (const table of [fa, en, ru, ar, zh]) {
          expect((table as Record<string, string>)[k], `کلید ${k}`).toBeTruthy();
        }
      }
      // جای‌نگهدارهای پیام با vars همان چک پر می‌شوند
      expect(translate('en', a.summaryKey, a.summaryVars)).not.toContain('{');
    }
  });

  it('پیام‌ها در پنج زبان واقعاً ترجمه شده‌اند (نه کپی فارسی)', () => {
    const a = assessForIran(cfg);
    const faText = translate('fa', a.checks[0].key, a.checks[0].vars);
    const enText = translate('en', a.checks[0].key, a.checks[0].vars);
    const zhText = translate('zh', a.checks[0].key, a.checks[0].vars);
    expect(/[\u0600-\u06FF]/.test(enText)).toBe(false);
    expect(zhText).not.toBe(faText);
  });
});

describe('i18n — کلیدهای استفاده‌شده در کد', () => {
  it('هیچ t(\'key\') ثابتی به کلید ناموجود اشاره نمی‌کند', () => {
    const known = new Set(Object.keys(fa));
    const missing: string[] = [];
    for (const file of walk('src')) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) {
        if (!known.has(m[1])) missing.push(`${file}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('خانواده‌های کلید پویا (verdict.*، status.*، ev.summary.*، ev.protocol-*) کامل‌اند', () => {
    const known = new Set(Object.keys(fa));
    for (const key of [
      'verdict.resilient', 'verdict.usable', 'verdict.fragile', 'verdict.blocked',
      'status.online', 'status.offline', 'status.active', 'status.error', 'status.unknown',
      'ev.summary.resilient', 'ev.summary.usable', 'ev.summary.fragile', 'ev.summary.blocked',
      'ev.protocol-wireguard', 'ev.protocol-ss', 'ev.protocol-ss-tls', 'ev.protocol-vmess',
    ]) {
      expect(known.has(key), `کلید پویا ${key}`).toBe(true);
    }
  });

  it('هر پنج زبان برای یک نمونهٔ متن، خروجی متفاوت و کامل می‌دهند', () => {
    const sample = ['nav.dashboard', 'login.signIn', 'adv.title', 'ev.port-443', 'set.statusTitle'];
    const rendered = (['fa', 'en', 'ru', 'ar', 'zh'] as const).map((l) => sample.map((k) => translate(l, k)).join(' | '));
    for (const text of rendered) {
      expect(text.includes('undefined')).toBe(false);
      expect(text.length).toBeGreaterThan(40);
    }
    expect(new Set(rendered).size).toBe(5);
  });
});

describe('i18n — کدهای خطای API', () => {
  it('هر کدی که بک‌اند برمی‌گرداند، در هر پنج دیکشنری ترجمه دارد', () => {
    const used = new Set<string>();
    for (const file of walk('src')) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/'(api\.[a-zA-Z]+)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(30); // اگر روزی صفر شد یعنی اسکن خراب است
    const missing: string[] = [];
    for (const code of used) {
      for (const [name, table] of Object.entries({ fa, en, ru, ar, zh })) {
        if (!(code in (table as Record<string, string>))) missing.push(`${name}: ${code}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('هر کدی که در رویدادهای سیستم ثبت می‌شود (act.*) ترجمه دارد', () => {
    const used = new Set<string>();
    for (const file of walk('src')) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/'(act\.[a-zA-Z]+)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(10);
    const missing: string[] = [];
    for (const code of used) {
      for (const [name, table] of Object.entries({ fa, en, ru, ar, zh })) {
        if (!(code in (table as Record<string, string>))) missing.push(`${name}: ${code}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('جای‌نگهدارها در پیام‌های خطا بین زبان‌ها یکسان است', () => {
    const varsOf = (s: string) => (s.match(/\{(\w+)\}/g) || []).sort().join(',');
    const families = Object.keys(fa).filter((k) => k.startsWith('api.') || k.startsWith('act.'));
    for (const key of families) {
      const a = varsOf((fa as Record<string, string>)[key]);
      for (const table of [en, ru, ar, zh]) {
        expect(varsOf((table as Record<string, string>)[key]), `${key}`).toBe(a);
      }
    }
  });
});

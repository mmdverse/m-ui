/**
 * هستهٔ i18n — بدون React، تا هم سرور و هم تست بتوانند مستقیم از آن استفاده کنند.
 * `fa.ts` منبع حقیقت کلیدهاست؛ بقیهٔ زبان‌ها با تایپ `Record<MsgKey, string>`
 * تعریف شده‌اند، پس جاافتادن یک کلید در زمان build خطا می‌دهد.
 */
import fa from './fa';
import en from './en';
import ru from './ru';
import ar from './ar';
import zh from './zh';

export type MsgKey = keyof typeof fa;

export const LOCALES = ['fa', 'en', 'ru', 'ar', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export interface LocaleMeta {
  /** نام زبان به خودش — همان چیزی که در سوییچر دیده می‌شود */
  label: string;
  /** تگ BCP-47 برای قالب‌بندی تاریخ و عدد */
  tag: string;
  dir: 'rtl' | 'ltr';
  /** کد دو حرفی برای برچسب کوچک سوییچر */
  short: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  fa: { label: 'فارسی', tag: 'fa-IR', dir: 'rtl', short: 'FA' },
  en: { label: 'English', tag: 'en-US', dir: 'ltr', short: 'EN' },
  ru: { label: 'Русский', tag: 'ru-RU', dir: 'ltr', short: 'RU' },
  ar: { label: 'العربية', tag: 'ar-EG', dir: 'rtl', short: 'AR' },
  zh: { label: '中文', tag: 'zh-CN', dir: 'ltr', short: 'ZH' },
};

export const DEFAULT_LOCALE: Locale = 'fa';
export const STORE_KEY = 'mui_locale';

const TABLES: Record<Locale, Record<MsgKey, string>> = { fa, en, ru, ar, zh };

/** امضای تابع ترجمه — جاهایی که فقط متن لازم است از این استفاده می‌کنند. */
export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/** نزدیک‌ترین زبان پشتیبانی‌شده به زبان مرورگر (fa-IR → fa، zh-Hans → zh). */
export function detectLocale(candidates: readonly string[]): Locale {
  for (const raw of candidates) {
    const base = String(raw).toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** درج مقادیر در متن: interpolate('CPU {cpu}٪', { cpu: 12 }). */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/** ترجمهٔ خالص (بدون React). */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const table = TABLES[locale] ?? TABLES[DEFAULT_LOCALE];
  const text = (table as Record<string, string>)[key] ?? (TABLES[DEFAULT_LOCALE] as Record<string, string>)[key] ?? key;
  return interpolate(text, vars);
}

export function formatDate(value: number | string | Date, locale: Locale): string {
  try {
    return new Date(value).toLocaleString(LOCALE_META[locale].tag);
  } catch {
    return '—';
  }
}

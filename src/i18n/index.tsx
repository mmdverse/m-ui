/**
 * لایهٔ React روی هستهٔ i18n: زبان انتخابی، جهت صفحه و ذخیره در localStorage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  STORE_KEY,
  detectLocale,
  formatDate,
  isLocale,
  translate,
  type Locale,
  type TFunc,
} from './core';

export * from './core';

interface I18nValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  setLocale: (next: Locale) => void;
  t: TFunc;
  fmtDate: (value: number | string | Date) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // اولین بار: مقدار ذخیره‌شده → زبان مرورگر → پیش‌فرض (فارسی)
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORE_KEY);
    } catch {
      /* قاب محدودشده */
    }
    if (isLocale(stored)) {
      setLocaleState(stored);
      return;
    }
    const nav = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
    setLocaleState(detectLocale((nav ?? []) as readonly string[]));
  }, []);

  // جهت و زبان سند تابع زبان انتخابی است
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_META[locale].dir;
    document.documentElement.setAttribute('data-lang', locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORE_KEY, next);
    } catch {
      /* بی‌خیال */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t: TFunc = (key, vars) => translate(locale, key, vars);
    return {
      locale,
      dir: LOCALE_META[locale].dir,
      setLocale,
      t,
      fmtDate: (v) => formatDate(v, locale),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** میان‌بر رایج وقتی فقط متن لازم است. */
export function useT(): TFunc {
  return useI18n().t;
}

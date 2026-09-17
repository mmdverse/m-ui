import { useEffect, useRef, useState } from 'react';
import { LOCALES, LOCALE_META, useI18n, type Locale } from '@/i18n';

/** انتخابگر زبان — مونوکروم، با همان دکمهٔ شبح تم. */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  function pick(next: Locale) {
    setLocale(next);
    setOpen(false);
  }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('lang.title')}
        style={{ gap: 7 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
        </svg>
        {!compact && <span>{LOCALE_META[locale].label}</span>}
        <span className="badge badge-quiet" style={{ padding: '1px 6px' }}>{LOCALE_META[locale].short}</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            insetInlineEnd: 0,
            top: 'calc(100% + 8px)',
            minWidth: 172,
            background: 'var(--panel-2)',
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--r-md)',
            boxShadow: '0 18px 40px rgba(0,0,0,.5)',
            padding: 6,
            zIndex: 20,
          }}
        >
          {LOCALES.map((code) => (
            <button
              key={code}
              role="option"
              aria-selected={code === locale}
              onClick={() => pick(code)}
              className="nav-item"
              style={{
                width: '100%',
                margin: 0,
                background: code === locale ? 'rgba(255,255,255,.07)' : 'transparent',
                color: code === locale ? '#fff' : 'var(--fg-dim)',
                border: '1px solid transparent',
                fontSize: 13,
                fontFamily: 'inherit',
                textAlign: 'start',
              }}
            >
              <span className="badge badge-quiet" style={{ padding: '1px 6px' }}>{LOCALE_META[code].short}</span>
              <span style={{ flex: 1 }}>{LOCALE_META[code].label}</span>
              {code === locale && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

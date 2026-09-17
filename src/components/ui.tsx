/** قطعه‌های نمایشی مشترک — بدون state و بدون API. */
import type { TFunc } from '@/i18n';

export function PageHead({ eyebrow, title, sub, children }: { eyebrow?: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="h1">{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>}
    </div>
  );
}

/** شدت پیام با شکل مرز و آیکون منتقل می‌شود، نه با رنگ. */
export function Msg({ kind = 'info', children }: { kind?: 'info' | 'ok' | 'err'; children: React.ReactNode }) {
  const glyph =
    kind === 'ok' ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
    ) : kind === 'err' ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></svg>
    );
  return (
    <div className={`msg ${kind === 'ok' ? 'msg-ok' : kind === 'err' ? 'msg-err' : ''}`}>
      {glyph}
      <span>{children}</span>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty-glyph">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" />
        </svg>
      </div>
      <div style={{ color: 'var(--fg-dim)', marginBottom: 6 }}>{title}</div>
      {hint && <div style={{ fontSize: 12 }}>{hint}</div>}
    </div>
  );
}

export function Stat({ value, label, glyph }: { value: React.ReactNode; label: string; glyph?: React.ReactNode }) {
  return (
    <div className="card hoverable tight">
      <div className="stat">
        {glyph && <div className="stat-glyph">{glyph}</div>}
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

export function StatusDot({ status }: { status?: string }) {
  const cls = status === 'online' || status === 'active' ? 'dot-on' : status === 'error' ? 'dot-warn' : 'dot-off';
  return <span className={`dot ${cls}`} />;
}

/** وضعیت‌ها در همهٔ زبان‌ها از دیکشنری می‌آیند. */
export function statusLabel(t: TFunc, status?: string): string {
  if (status === 'online') return t('status.online');
  if (status === 'offline') return t('status.offline');
  if (status === 'active') return t('status.active');
  if (status === 'error') return t('status.error');
  return t('status.unknown');
}

export function bytes(b: number): string {
  if (!b) return '0 B';
  if (b >= 1e12) return (b / 1e12).toFixed(1) + ' TB';
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b >= 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

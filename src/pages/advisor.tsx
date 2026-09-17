import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useI18n } from '@/i18n';
import { PageHead, Field } from '@/components/ui';
import {
  assessForIran,
  recommendedDefaults,
  SNI_GOOD,
  SNI_AVOID,
  GOOD_FINGERPRINTS,
  RISKY_FINGERPRINTS,
  PREFERRED_PORTS,
  type Assessment,
} from '@/lib/evasion';

/** پروتکل‌ها و انتقال‌های قابل انتخاب در فرم. */
const PROTOCOLS = ['vless', 'vmess', 'trojan', 'shadowsocks', 'socks5', 'wireguard', 'hysteria2', 'tuic'];
const TRANSPORTS = ['tcp', 'raw', 'ws', 'grpc', 'http', 'xhttp', 'kcp', 'quic'];
/** خوب‌ها اول می‌آیند، بعد آن‌هایی که خودشان پرچم قرمزند. */
const FINGERPRINTS = [...GOOD_FINGERPRINTS, ...RISKY_FINGERPRINTS];

interface Form {
  protocol: string;
  transport: string;
  security: string;
  port: number;
  sni: string;
  pbk: string;
  sid: string;
  fp: string;
  flow: string;
  path: string;
  domain: string;
  addr: string;
}

const DEFAULTS: Form = {
  protocol: 'vless', transport: 'tcp', security: 'reality', port: 443,
  sni: 'www.lovelive-anime.jp', pbk: '', sid: '', fp: 'chrome', flow: 'xtls-rprx-vision',
  path: '/', domain: '', addr: '',
};

const SEV_ORDER: Record<string, number> = { fail: 0, warn: 1, info: 2, pass: 3 };

export default function AdvisorPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [showAll, setShowAll] = useState(false);

  // از صفحهٔ کانفیگ‌ها می‌آید: ?protocol=...&transport=...
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query;
    setForm((f) => ({
      ...f,
      protocol: typeof q.protocol === 'string' ? q.protocol : f.protocol,
      transport: typeof q.transport === 'string' ? q.transport : f.transport,
      security: typeof q.security === 'string' ? q.security : f.security,
      port: typeof q.port === 'string' ? Number(q.port) : f.port,
    }));
  }, [router.isReady, router.query]);

  const assessment: Assessment = useMemo(
    () => assessForIran({
      protocol: form.protocol, transport: form.transport, security: form.security,
      port: form.port, sni: form.sni, pbk: form.pbk, sid: form.sid,
      fp: form.fp, flow: form.flow, path: form.path, domain: form.domain,
    }),
    [form],
  );

  // پیشنهاد از همان ماژول evasion می‌آید تا فرم و کتابخانه یک منبع داشته باشند
  const recipe = useMemo(() => recommendedDefaults(form.protocol) as Partial<Form>, [form.protocol]);
  const recipeKeys = Object.keys(recipe) as (keyof Form)[];
  const seen = new Set<string>();
  const visible = assessment.checks
    .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  const shown = showAll ? visible : visible.filter((c) => c.severity !== 'pass' && c.severity !== 'info');

  const total = assessment.checks.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i).length;
  const ignoresRealityFields = form.protocol === 'socks5' || form.protocol === 'wireguard';
  const ignoresTlsFields = form.security === 'none';

  return (
    <Layout>
      <Head><title>{`M-UI — ${t('adv.title')}`}</title></Head>
      <PageHead eyebrow={t('adv.eyebrow')} title={t('adv.title')} sub={t('adv.sub')} />

      <div className="split" style={{ alignItems: 'flex-start' }}>
        {/* ── فرم */}
        <div className="card">
          <div className="section-title">{t('adv.formTitle')}</div>
          <div className="grid cols-2" style={{ gap: 14 }}>
            <Field label={t('adv.protocol')}>
              <select className="select" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
                {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label={t('adv.transport')}>
              <select className="select" value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value })}>
                {TRANSPORTS.map((tr) => <option key={tr} value={tr}>{tr}</option>)}
              </select>
            </Field>
            <Field label={t('adv.security')}>
              <select className="select" value={form.security} onChange={(e) => setForm({ ...form, security: e.target.value })}>
                <option value="none">{t('cfg.secNone')}</option>
                <option value="tls">TLS</option>
                <option value="reality">REALITY</option>
              </select>
            </Field>
            <Field label={t('adv.port')} hint={t('adv.portHint', { ports: PREFERRED_PORTS.join(' / ') })}>
              <input className="input ltr" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
            </Field>

            {!ignoresTlsFields && (
              <Field label={t('adv.sni')} hint={t('adv.sniHint')}>
                <input className="input ltr" value={form.sni} onChange={(e) => setForm({ ...form, sni: e.target.value })} />
              </Field>
            )}
            <Field label={t('adv.fp')}>
              <select className="select" value={form.fp} onChange={(e) => setForm({ ...form, fp: e.target.value })}>
                {FINGERPRINTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>

            {form.security === 'reality' && (
              <>
                <Field label="pbk" hint={t('adv.pbkHint')}>
                  <input className="input ltr" value={form.pbk} onChange={(e) => setForm({ ...form, pbk: e.target.value })} />
                </Field>
                <Field label={t('adv.sid')} hint={t('adv.sidHint')}>
                  <input className="input ltr" value={form.sid} onChange={(e) => setForm({ ...form, sid: e.target.value })} />
                </Field>
                <Field label={t('adv.flow')}>
                  <select className="select" value={form.flow} onChange={(e) => setForm({ ...form, flow: e.target.value })}>
                    <option value="">{t('adv.flowNone')}</option>
                    <option value="xtls-rprx-vision">xtls-rprx-vision</option>
                  </select>
                </Field>
              </>
            )}

            {!ignoresRealityFields && (
              <>
                <Field label={t('adv.path')}>
                  <input className="input ltr" value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} />
                </Field>
                <Field label={t('adv.cdn')}>
                  <input className="input ltr" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
                </Field>
                <Field label={t('adv.serverAddr')}>
                  <input className="input ltr" value={form.addr} onChange={(e) => setForm({ ...form, addr: e.target.value })} />
                </Field>
              </>
            )}
          </div>

          {recipeKeys.length > 0 && (
            <>
              <div className="divider" />
              <div className="section-title" style={{ fontSize: 12 }}>{t('adv.recipe')}</div>
              <div className="kv" style={{ marginBottom: 10 }}>
                {recipeKeys.map((k) => (
                  <span key={k} className="mono">{k}=<b>{String(recipe[k])}</b></span>
                ))}
              </div>
              <button className="btn btn-sm" onClick={() => setForm({ ...form, ...recipe })}>
                {t('adv.applyAll', { n: recipeKeys.length })}
              </button>
            </>
          )}
        </div>

        {/* ── نتیجه */}
        <div className="grid" style={{ gap: 18 }}>
          <div className="card">
            <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div className="eyebrow">{t('adv.resultTitle')}</div>
                <div className="h1" style={{ fontSize: 24 }}>{t(`verdict.${assessment.verdict}`)}</div>
                <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
                  {t(assessment.summaryKey, assessment.summaryVars)}
                </p>
              </div>
              <div className="score-ring" style={{ '--p': assessment.score } as React.CSSProperties}>
                <span className="score-num">{assessment.score}</span>
              </div>
            </div>

            {shown.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="section-title" style={{ fontSize: 12 }}>{t('adv.whatCounts')}</div>
                {shown.map((c) => (
                  <div className="check" key={c.id}>
                    <span className={`check-glyph ${c.severity === 'fail' ? 'is-fail' : c.severity === 'pass' ? 'is-pass' : ''}`}>
                      {c.severity === 'fail' ? '!' : c.severity === 'warn' ? '~' : c.severity === 'pass' ? '✓' : 'i'}
                    </span>
                    <div className="check-body">
                      <div className="check-id">{c.severity} · {c.id}</div>
                      <div className="check-msg">{t(c.key, c.vars)}</div>
                      {c.fix && (
                        <button className="fix-chip" onClick={() => setForm({ ...form, ...(c.fix as Partial<Form>) })}>
                          {Object.entries(c.fix).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {shown.length === 0 && <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>{t('adv.noIssues')}</p>}

            <button className="btn btn-sm btn-ghost" style={{ marginTop: 16 }} onClick={() => setShowAll((v) => !v)}>
              {showAll ? `${t('adv.fullTitle')} ▾` : `${t('adv.fullTitle')} (${t('adv.fullCount', { n: total })}) ▸`}
            </button>
          </div>

          <div className="card">
            <div className="section-title">
              <span>{t('adv.goodTitle')}</span>
              <span className="badge badge-quiet">{SNI_GOOD.length}</span>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{t('adv.goodHint')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SNI_GOOD.map((d) => (
                <button key={d} className="badge badge-quiet mono" style={{ padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => setForm({ ...form, sni: d })}>
                  {d}
                </button>
              ))}
            </div>
            <div className="divider" />
            <div className="section-title" style={{ fontSize: 12 }}>{t('adv.badTitle')}</div>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{t('adv.badHint')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SNI_AVOID.map((d) => (
                <span key={d} className="badge badge-quiet mono" style={{ padding: '4px 9px', textDecoration: 'line-through' }}>{d}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

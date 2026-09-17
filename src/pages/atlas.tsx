import { useMemo, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { useI18n, LOCALE_META } from '@/i18n';
import { PageHead } from '@/components/ui';
import {
  COUNTRY_ORDER,
  LAYER_META,
  PLANS,
  PROFILES,
  SOURCES,
  buildPipeline,
  countryLabelKey,
  hopConfigs,
  pipelineOverheadMs,
  rank,
  snippet,
  validatePipeline,
  type CountryId,
  type Coverage,
  type PlanId,
} from '@/lib/censorship';

/**
 * «اطلس فیلترینگ» — صفحهٔ ماژول چندکشوریِ `src/lib/censorship`.
 *
 * هر عددی که این‌جا دیده می‌شود از همان موتوری می‌آید که تست‌ها و شبیه‌ساز
 * پایتون روی آن قفل شده‌اند؛ چیزی این‌جا «تبلیغ» نیست. ستون «شبیه‌سازی» می‌گوید
 * شبیه‌ساز ما واقعاً این لایه را اجرا می‌کند یا فقط از گزارش‌ها مدل شده.
 */

const SEV = (n: number) => '●'.repeat(n) + '○'.repeat(Math.max(0, 5 - n));
const COVERAGES: Coverage[] = ['covered', 'partial', 'exposed', 'na'];

/** مقادیر نمونهٔ کانفیگ — عمداً جعلی‌اند تا کسی کپی‌کردن را با «آماده بودن» اشتباه نگیرد. */
const SAMPLE = {
  server: 'YOUR.SERVER.IP',
  uuid: '11111111-2222-3333-4444-555555555555',
  sni: 'www.microsoft.com',
};

export default function Atlas() {
  const { t, locale } = useI18n();
  const [country, setCountry] = useState<CountryId>('ir');
  const [sniWhitelisted, setSniWhitelisted] = useState(false);
  const [behindCdn, setBehindCdn] = useState(false);
  const [openPlan, setOpenPlan] = useState<PlanId | null>(null);

  const profile = PROFILES[country];
  const ranked = useMemo(() => rank(country, { sniWhitelisted, behindCdn }), [country, sniWhitelisted, behindCdn]);
  const best = ranked[0];
  const losers = ranked.filter((r) => r.verdict === 'blocked').slice(-4).reverse();

  /** اکشن‌های موتور به شکل `world.act.cover:<layer>:<plan>` می‌آیند. */
  const actionText = (raw: string): string => {
    const [head, layer, fix] = raw.split(':');
    if (head === 'world.act.cover' && layer && fix) {
      return t('world.act.cover', { layer: t(`world.layer.${layer}`), plan: PLANS[fix as PlanId]?.label ?? fix });
    }
    if (head === 'world.act.manual' && layer) return t('world.act.manual', { layer: t(`world.layer.${layer}`) });
    return t(head);
  };

  const noteText = (note: string): string => {
    const key = `world.note.${note}`;
    const text = t(key);
    return text === key ? note : text;
  };

  const active = openPlan ? snippet(openPlan, { ...SAMPLE, port: PLANS[openPlan].port }) : null;

  const pipeline = useMemo(() => buildPipeline(country), [country]);
  const pipeProblems = useMemo(() => validatePipeline(pipeline), [pipeline]);
  const entryConfig = useMemo(
    () => hopConfigs(pipeline, { ...SAMPLE, port: pipeline.hops[0].leg.port }),
    [pipeline],
  );

  return (
    <Layout>
      <Head>
        <title>{`M-UI — ${t('nav.atlas')}`}</title>
      </Head>
      <PageHead eyebrow={t('world.eyebrow')} title={t('world.title')} sub={t('world.sub')} />

      <div className="card">
        <div className="section-title">{t('world.countryLabel')}</div>
        <div className="atlas-countries">
          {COUNTRY_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`atlas-country${id === country ? ' is-active' : ''}`}
              onClick={() => setCountry(id)}
              title={PROFILES[id].system}
            >
              <span className="atlas-country-name">{t(countryLabelKey(id))}</span>
              <span className="atlas-country-meta">{PROFILES[id].layers.length}</span>
            </button>
          ))}
        </div>
        <div className="atlas-env">
          <label className="atlas-check">
            <input type="checkbox" checked={sniWhitelisted} onChange={(e) => setSniWhitelisted(e.target.checked)} />
            <span>{t('world.env.sniWhitelisted')}</span>
          </label>
          <label className="atlas-check">
            <input type="checkbox" checked={behindCdn} onChange={(e) => setBehindCdn(e.target.checked)} />
            <span>{t('world.env.behindCdn')}</span>
          </label>
          <span className="muted">{t('world.envHint')}</span>
        </div>
        <div className="atlas-system">
          {profile.system} · {profile.family}
          {best && (
            <span className="atlas-best">
              {t('world.verdict.resilient')}: <b>{best.plan.label}</b> — {t('world.score')} {best.score}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="section-title">{t('world.layersTitle')}</div>
        <table className="tbl">
            <thead>
              <tr>
                <th>{t('world.layersTitle')}</th>
                <th>{t('world.severity')}</th>
                <th>{t('world.confidence')}</th>
                <th>{t('world.simulated')}</th>
                <th title={COVERAGES.join(' / ')}>{t('world.coverage.covered')}</th>
              </tr>
            </thead>
            <tbody>
              {profile.layers.map((layer) => {
                const row = best.rows.find((r) => r.layer === layer.id);
                return (
                  <tr key={layer.id}>
                    <td>
                      <div>{t(`world.layer.${layer.id}`)}</div>
                      <div className="muted mono">
                        {layer.id} · {LAYER_META[layer.id].families.join(' / ')}
                      </div>
                    </td>
                    <td className="mono" title={`${layer.severity}/5`}>
                      {SEV(layer.severity)}
                    </td>
                    <td>{t(`world.conf.${layer.confidence}`)}</td>
                    <td>{layer.simulated ? t('world.sim.yes') : t('world.sim.no')}</td>
                    <td className={`badge cov cov-${row?.coverage ?? 'na'}`}>
                      {row ? t(`world.coverage.${row.coverage}`) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        {profile.notes.length > 0 && (
          <div className="atlas-notes">
            {profile.notes.map((n) => (
              <span className="badge" key={n}>
                {noteText(n)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-title">{t('world.plansTitle')}</div>
        <ul className="atlas-plans">
          {ranked.map((row) => (
            <li key={row.plan.id} className={`atlas-plan is-${row.verdict}`}>
              <div className="atlas-plan-head">
                <span className="atlas-plan-label">{row.plan.label}</span>
                <span className={`badge verdict-${row.verdict}`}>{t(`world.verdict.${row.verdict}`)}</span>
                <span className="atlas-score">
                  {t('world.score')} {row.score}
                  <span className="atlas-bar">
                    <i style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }} />
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setOpenPlan(openPlan === row.plan.id ? null : row.plan.id)}
                >
                  {openPlan === row.plan.id ? '×' : t('world.snippet')}
                </button>
              </div>
              <div className="muted mono">{row.plan.tech}</div>
              <div className="atlas-blockers">
                {row.blockers.length === 0 ? (
                  <span className="badge badge-ok">{t('world.none')}</span>
                ) : (
                  row.blockers.map((b) => (
                    <span key={b} className="badge badge-warn">
                      {t(`world.layer.${b}`)}
                    </span>
                  ))
                )}
              </div>
              {row.actions.length > 0 && (
                <ul className="atlas-actions">
                  {row.actions.map((a) => (
                    <li key={a}>{actionText(a)}</li>
                  ))}
                </ul>
              )}
              {openPlan === row.plan.id && active && (
                <>
                  {active.mustHave.length > 0 && (
                    <ul className="atlas-musthave">
                      {active.mustHave.map((m) => (
                        <li key={m}>{m.startsWith('world.') ? t(m) : m}</li>
                      ))}
                    </ul>
                  )}
                  <pre className="code atlas-snippet">{active.text}</pre>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="section-title">{t('world.transit.title')}</div>
        <p className="muted">{t('world.transit.sub')}</p>
        {pipeProblems.length > 0 && (
          <div className="msg msg-err">
            {t('world.transit.problems')}: {pipeProblems.join(' · ')}
          </div>
        )}
        <ul className="atlas-plans">
          {pipeline.hops.map((hop, i) => (
            <li key={hop.id} className="atlas-plan">
              <div className="atlas-plan-head">
                <span className="badge badge-solid">
                  {t('world.transit.hop')} {i + 1} · {t(`world.transit.role.${hop.role}`)}
                </span>
                <span className="atlas-plan-label">{hop.leg.plan}</span>
                <span className="atlas-score">
                  {hop.country}:{hop.leg.port}
                  {hop.leg.fragmented && <span className="badge badge-warn">finalmask</span>}
                </span>
              </div>
              <div className="atlas-blockers">
                <span className="badge">
                  {t('world.transit.observer')}: {hop.observer === 'open' ? t('world.country.open') : t(`world.country.${hop.observer}`)}
                </span>
                <span className="badge">
                  {t('world.transit.resources')}: {hop.resources.cpu} · {hop.resources.ram}
                </span>
              </div>
              <div className="muted">{t('world.transit.why')}: {hop.why}</div>
              <ul className="atlas-musthave">
                {hop.leg.must.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="atlas-system">
          <span>
            {t('world.transit.overhead')}: <b className="mono">{pipelineOverheadMs(pipeline)} ms</b>
          </span>
          <span className="mono">{t('world.transit.ok')}</span>
        </div>
        <ul className="atlas-musthave">
          {pipeline.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <details>
          <summary className="muted">{t('world.snippet')} — {t('world.transit.role.entry')}</summary>
          <pre className="atlas-snippet">{JSON.stringify(entryConfig.entry, null, 2)}</pre>
        </details>
      </div>

      {losers.length > 0 && (
        <div className="card">
          <div className="section-title">{t('world.deadTitle')}</div>
          <p className="muted">{t('world.deadHint')}</p>
          <div className="atlas-dead">
            {losers.map((r) => (
              <span key={r.plan.id} className="badge badge-bad">
                {r.plan.label} — {r.score}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="section-title">{t('world.sources')}</div>
        <ul className="atlas-sources">
          {Object.entries(SOURCES).map(([key, src]) => (
            <li key={key}>
              <span className="mono">{key}</span>{' '}
              <a href={src.url} target="_blank" rel="noreferrer noopener">
                {src.label}
              </a>{' '}
              <span className="muted">({src.kind})</span>
            </li>
          ))}
        </ul>
        <div className="muted mono">
          locale: {LOCALE_META[locale].tag} · {profile.layers.length} layers · {Object.keys(PLANS).length} plans
        </div>
      </div>
    </Layout>
  );
}

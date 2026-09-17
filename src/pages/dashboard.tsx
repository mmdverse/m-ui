import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { api, apiErrorText } from '@/lib/api';
import { useI18n } from '@/i18n';
import { PageHead, Stat, Msg, Empty, StatusDot, statusLabel, bytes } from '@/components/ui';

export default function Dashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');

  // آخرین t برای ترجمهٔ خطا؛ وابستگی به t باعث بارگذاری دوبارهٔ آمار با هر
  // تغییر زبان می‌شد و آن را لازم نداریم.
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    api('/api/system/stats')
      .then(setStats)
      .catch((e) => setError(apiErrorText(e, tRef.current)));
  }, []);

  const totalTraffic = stats?.trafficHistory?.reduce((a: number, d: any) => a + d.rx + d.tx, 0) || 0;

  return (
    <Layout>
      <Head><title>{`M-UI — ${t('dash.title')}`}</title></Head>
      <PageHead eyebrow={t('dash.eyebrow')} title={t('dash.title')} sub={t('dash.sub')}>
        <Link href="/advisor" className="btn btn-ghost btn-sm">{t('dash.advisor')}</Link>
        <Link href="/servers" className="btn btn-primary btn-sm">{t('dash.manageServers')}</Link>
      </PageHead>

      {error && <Msg kind="err">{error}</Msg>}
      {!stats && !error && <div className="muted">{t('c.loading')}</div>}

      {stats && (
        <>
          <div className="grid cols-4" style={{ marginBottom: 26 }}>
            <Stat value={stats.servers ?? 0} label={t('dash.statServers')} glyph={<Glyph d="M3 4h18v7H3zM3 13h18v7H3z" />} />
            <Stat
              value={<span>{stats.onlineServers ?? 0}<span className="muted" style={{ fontSize: 15 }}>/{stats.servers ?? 0}</span></span>}
              label={t('dash.statOnline')}
              glyph={<span className="dot dot-on" />}
            />
            <Stat value={stats.activeConfigs ?? 0} label={t('dash.statConfigs')} glyph={<Glyph d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />} />
            <Stat value={stats.tunnels ?? 0} label={t('dash.statTunnels')} glyph={<Glyph d="M4 20V9a8 8 0 0 1 16 0v11" />} />
            <Stat value={stats.users ?? 0} label={t('dash.statUsers')} glyph={<Glyph d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 20a7 7 0 0 1 14 0" />} />
            <Stat value={bytes(totalTraffic)} label={t('dash.statTraffic')} glyph={<Glyph d="M4 19V9M10 19V5M16 19v-7M22 19H2" />} />
          </div>

          <div className="split">
            <div className="card">
              <div className="section-title">
                <span>{t('dash.trafficTitle')}</span>
                <span className="badge badge-quiet">{t('dash.trafficBadge')}</span>
              </div>
              {stats.trafficHistory?.length ? (
                <div className="bars">
                  {(() => {
                    const max = Math.max(1, ...stats.trafficHistory.map((d: any) => d.rx + d.tx));
                    return stats.trafficHistory.map((d: any, i: number) => {
                      const total = d.rx + d.tx;
                      return (
                        <div key={i} className="bar-col" title={`${d.day} — ${bytes(total)}`}>
                          <div className="bar" style={{ height: `${Math.max(3, Math.round((total / max) * 100))}%` }} />
                          <span className="bar-x">{d.day}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <Empty title={t('dash.trafficEmptyTitle')} hint={t('dash.trafficEmptyHint')} />
              )}
            </div>

            <div className="card">
              <div className="section-title">
                <span>{t('dash.statusTitle')}</span>
                <Link href="/servers" className="link-quiet" style={{ fontSize: 11, marginInlineStart: 'auto' }}>{t('dash.all')}</Link>
              </div>
              {stats.serverMetrics?.length ? (
                stats.serverMetrics.map((s: any) => (
                  <div className="row" key={s.name} style={{ padding: '12px 0' }}>
                    <div>
                      <div className="row-title" style={{ fontSize: 13 }}>
                        <StatusDot status={s.status} />
                        {s.name}
                      </div>
                      <div className="row-meta">
                        {s.status === 'online'
                          ? t('dash.metrics', { cpu: s.cpuUsage ?? '?', ram: s.ramUsage ?? '?', load: s.load1 ?? '?' })
                          : statusLabel(t, s.status)}
                      </div>
                    </div>
                    <span className="badge badge-quiet">{s.status === 'online' ? 'online' : 'offline'}</span>
                  </div>
                ))
              ) : (
                <Empty title={t('dash.serverEmptyTitle')} hint={t('dash.serverEmptyHint')} />
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

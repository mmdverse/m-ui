import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/system/stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  const cards = stats
    ? [
        { label: 'سرورها', value: stats.servers, color: '#03a66d', icon: '🖥️' },
        { label: 'کانفیگ فعال', value: stats.activeConfigs, color: '#7c3aed', icon: '🔗' },
        { label: 'تانل‌ها', value: stats.tunnels, color: '#3b82f6', icon: '🔀' },
        { label: 'کاربران', value: stats.users, color: '#f59e0b', icon: '👥' },
        { label: 'ترافیک ۷ روز اخیر', value: formatTraffic(stats.trafficHistory?.reduce((a: number, d: any) => a + d.rx + d.tx, 0) || 0), color: '#03a66d', icon: '📊' },
        { label: 'آنلاین', value: stats.onlineServers + '/' + stats.servers, color: '#22c55e', icon: '🟢' },
      ]
    : [];

  return (
    <Layout>
      <Head><title>M-UI — داشبورد</title></Head>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>🐳 داشبورد M-UI</h1>
      {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
      {!stats && !error && <p style={{ color: '#6b7280' }}>در حال بارگذاری...</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 28 }}>{c.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color, marginTop: 8 }}>{c.value}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>📈 ترافیک ۷ روز اخیر (جمع RX+TX، از نمونه‌های مونیتور)</h2>
          {stats?.trafficHistory?.length ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120 }}>
              {(() => {
                const max = Math.max(1, ...stats.trafficHistory.map((d: any) => d.rx + d.tx));
                return stats.trafficHistory.map((d: any, i: number) => {
                  const total = d.rx + d.tx;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={formatTraffic(total)}>
                      <div style={{ width: '100%', height: Math.max(4, Math.round((total / max) * 100)), background: '#03a66d', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                      <span style={{ fontSize: 9, color: '#6b7280', marginTop: 4 }}>{d.day}</span>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <p style={{ color: '#6b7280', fontSize: 13 }}>
              هنوز نمونه‌ای ثبت نشده. مونیتور هر ۱۰ دقیقه از سرورها نمونه می‌گیرد؛ بعد از اولین چرخه این‌جا داده ظاهر می‌شود.
            </p>
          )}
        </div>
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>⚡ وضعیت سرورها</h2>
          {stats?.serverMetrics?.length ? (
            stats.serverMetrics.map((s: any) => (
              <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #313244', fontSize: 13 }}>
                <span>{s.name}</span>
                <span style={{ color: s.status === 'online' ? '#22c55e' : '#ef4444' }}>
                  {s.status === 'online' ? '🟢 آنلاین' : '🔴 آفلاین'}
                  {s.status === 'online' && ` · CPU %${s.cpuUsage ?? '?'} · RAM %${s.ramUsage ?? '?'}`}
                </span>
              </div>
            ))
          ) : (
            <p style={{ color: '#6b7280', fontSize: 13 }}>سروری ثبت نشده است.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}

function formatTraffic(bytes: number): string {
  if (bytes >= 1e12) return (bytes / 1e12).toFixed(1) + ' TB';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB';
  return bytes + ' B';
}

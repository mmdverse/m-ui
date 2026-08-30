import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/system/activity')
      .then(setLogs)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Layout>
      <Head><title>M-UI — لاگ‌ها</title></Head>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>📋 رویدادهای سیستم</h1>
      {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
      <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20 }}>
        {logs.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>
            هنوز رویدادی ثبت نشده — با کارهای واقعی (تست سرور، ساخت کانفیگ، تانل) ثبت می‌شوند.
          </p>
        ) : (
          logs.map((log, i) => (
            <div key={log._id || i} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid #313244', fontSize: 13, alignItems: 'center' }}>
              <span style={{ color: '#6b7280', fontSize: 12, direction: 'ltr' }}>
                {new Date(log.ts).toLocaleString('fa-IR')}
              </span>
              <span style={{ fontSize: 11, backgroundColor: '#11111b', border: '1px solid #313244', borderRadius: 4, padding: '1px 6px', color: '#8b8b9e' }}>
                {log.actor}
              </span>
              <span style={{ color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#22c55e' : '#a0a0b0' }}>
                {log.event}
              </span>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}

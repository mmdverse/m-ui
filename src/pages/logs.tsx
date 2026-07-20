import { useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';

export default function LogsPage() {
  const [logs] = useState([
    { time: '۱۴۰۲/۱۲/۲۰ ۱۴:۳۰', event: '🟢 سرور ایران-۱ متصل شد', type: 'info' },
    { time: '۱۴۰۲/۱۲/۲۰ ۱۴:۲۵', event: '🔗 کانفیگ VLESS-TLS ایجاد شد', type: 'success' },
    { time: '۱۴۰۲/۱۲/۲۰ ۱۴:۲۰', event: '🔀 تانل ایران→آلمان فعال شد', type: 'info' },
    { time: '۱۴۰۲/۱۲/۲۰ ۱۴:۱۵', event: '🔴 سرور خارج-۳ قطع شد', type: 'error' },
    { time: '۱۴۰۲/۱۲/۲۰ ۱۴:۰۰', event: '📊 ترافیک روزانه: ۲.۳ GB', type: 'info' },
  ]);

  return (
    <Layout>
      <Head><title>M-UI — لاگ‌ها</title></Head>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>📋 لاگ‌های سیستم</h1>
      <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20 }}>
        {logs.map((log, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid #313244', fontSize: 13, alignItems: 'center' }}>
            <span style={{ color: '#6b7280', fontSize: 12, direction: 'ltr' }}>{log.time}</span>
            <span style={{ color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#22c55e' : '#a0a0b0' }}>{log.event}</span>
          </div>
        ))}
      </div>
    </Layout>
  );
}

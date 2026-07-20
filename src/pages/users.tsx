import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => { fetch('/api/auth/users').then(r => r.json()).then(setUsers).catch(() => {}); }, []);

  return (
    <Layout>
      <Head><title>M-UI — کاربران</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>👥 مدیریت کاربران</h1>
        <button style={btnStyle}>➕ کاربر جدید</button>
      </div>
      <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20 }}>
        {users.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>کاربری یافت نشد.</p>
        ) : users.map((u: any) => (
          <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #313244' }}>
            <span>{u.email}</span>
            <span style={{ color: u.isActive ? '#22c55e' : '#ef4444' }}>{u.isActive ? 'فعال' : 'غیرفعال'}</span>
          </div>
        ))}
      </div>
    </Layout>
  );
}
const btnStyle: any = { background: '#03a66d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 };

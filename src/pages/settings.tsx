import { useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [tab, setTab] = useState('security');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function changePassword() {
    setMsg(null);
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setOldPassword('');
      setNewPassword('');
      setMsg({ text: '✅ رمز عبور تغییر کرد', ok: true });
    } catch (e: any) {
      setMsg({ text: '❌ ' + e.message, ok: false });
    }
  }

  return (
    <Layout>
      <Head><title>M-UI — تنظیمات</title></Head>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>⚙️ تنظیمات</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['security', 'about'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
              background: tab === t ? '#03a66d' : '#1e1e2e', color: tab === t ? 'white' : '#a0a0b0',
              border: tab === t ? 'none' : '1px solid #313244', fontSize: 13,
            }}
          >
            {t === 'security' ? '🔒 امنیت' : 'ℹ️ درباره'}
          </button>
        ))}
      </div>
      <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 24 }}>
        {tab === 'security' && (
          <>
            <h2 style={{ fontSize: 16, marginBottom: 16 }}>🔒 تغییر رمز عبور</h2>
            <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4 }}>رمز فعلی</label>
            <input placeholder="رمز فعلی" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} style={s} />
            <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4, marginTop: 12 }}>رمز جدید (حداقل ۸ کاراکتر)</label>
            <input placeholder="رمز جدید" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={s} />
            {msg && <p style={{ fontSize: 13, color: msg.ok ? '#22c55e' : '#ef4444' }}>{msg.text}</p>}
            <button onClick={changePassword} style={{ ...btnStyle, marginTop: 16 }}>💾 تغییر رمز</button>
            <div style={{ marginTop: 16, padding: 12, background: '#0d1117', borderRadius: 8, fontSize: 12, color: '#6b7280', lineHeight: 1.9 }}>
              <p style={{ margin: 0 }}>🔐 JWT_SECRET باید در تنظیمات محیطی (Environment) ست شود؛ بدون آن در حالت production پنل اجرا نمی‌شود.</p>
              <p style={{ margin: 0 }}>🔐 ادمین اولیه از ADMIN_USERNAME / ADMIN_PASSWORD ساخته می‌شود (فقط وقتی هنوز کاربری وجود ندارد).</p>
            </div>
          </>
        )}
        {tab === 'about' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🐳</div>
            <h2 style={{ fontSize: 20, color: '#03a66d' }}>M-UI</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
              پنل مدیریت VPN — پایش واقعی سرورها با SSH، ساخت کانفیگ با UUID دائمی، تانل SSH Reverse
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              ساخته شده با ❤️ توسط{' '}
              <a href="https://t.me/llllxyz" style={{ color: '#03a66d', textDecoration: 'none' }}>Mohammad</a>
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
const s: any = { background: '#11111b', border: '1px solid #313244', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, width: '100%', display: 'block', boxSizing: 'border-box' };
const btnStyle: any = { background: '#03a66d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 };

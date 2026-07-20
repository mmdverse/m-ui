import { useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';

export default function SettingsPage() {
  const [tab, setTab] = useState('general');

  return (
    <Layout>
      <Head><title>M-UI — تنظیمات</title></Head>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>⚙️ تنظیمات</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['general', 'backup', 'security', 'about'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t ? '#03a66d' : '#1e1e2e', color: tab === t ? 'white' : '#a0a0b0',
              border: tab === t ? 'none' : '1px solid #313244', fontSize: 13,
            }}>{t === 'general' ? '📋 عمومی' : t === 'backup' ? '💾 بکاپ' : t === 'security' ? '🔒 امنیت' : 'ℹ️ درباره'}</button>
        ))}
      </div>
      <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 24 }}>
        {tab === 'general' && (
          <>
            <h2 style={{ fontSize: 16, marginBottom: 16 }}>📋 تنظیمات عمومی</h2>
            <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4 }}>نام پنل</label>
            <input defaultValue="M-UI" style={s} />
            <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4, marginTop: 12 }}>پورت پنل</label>
            <input defaultValue="3000" style={s} />
            <button style={{...btnStyle, marginTop: 16}}>💾 ذخیره</button>
          </>
        )}
        {tab === 'backup' && (
          <>
            <h2 style={{ fontSize: 16, marginBottom: 16 }}>💾 بکاپ و بازیابی</h2>
            <p style={{ fontSize: 13, color: '#a0a0b0', marginBottom: 16 }}>از کل تنظیمات و کانفیگ‌ها بکاپ بگیرید</p>
            <button style={btnStyle}>📥 دانلود بکاپ</button>
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>بازیابی از بکاپ:</p>
              <input type="file" style={{ fontSize: 13, color: '#a0a0b0' }} />
            </div>
          </>
        )}
        {tab === 'security' && (
          <>
            <h2 style={{ fontSize: 16, marginBottom: 16 }}>🔒 امنیت</h2>
            <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4 }}>تغییر رمز ادمین</label>
            <input placeholder="رمز جدید" type="password" style={s} />
            <button style={{...btnStyle, marginTop: 12}}>تغییر</button>
            <div style={{ marginTop: 16, padding: 12, background: '#0d1117', borderRadius: 8 }}>
              <p style={{ fontSize: 13, color: '#22c55e' }}>✅ همه سرورها امن هستند</p>
            </div>
          </>
        )}
        {tab === 'about' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🐳</div>
            <h2 style={{ fontSize: 20, color: '#03a66d' }}>M-UI v1.0</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>پنل مدیریت حرفه‌ای VPN و دور زدن فیلترینگ</p>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>ساخته شده با ❤️ توسط <a href="https://t.me/llllxyz" style={{ color: '#03a66d', textDecoration: 'none' }}>Mohammad</a></p>
          </div>
        )}
      </div>
    </Layout>
  );
}
const s: any = { background: '#11111b', border: '1px solid #313244', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, width: '100%', display: 'block' };
const btnStyle: any = { background: '#03a66d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 };

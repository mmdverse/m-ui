import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { setToken } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        router.push('/dashboard');
      } else {
        setError(data.error || 'نام کاربری یا رمز اشتباه');
      }
    } catch {
      setError('خطا در ارتباط');
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Head><title>M-UI — ورود به پنل</title></Head>
      <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 16, padding: 40, maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🐳</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#03a66d', margin: 0 }}>M-UI</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>پنل مدیریت VPN</p>
        </div>
        <form onSubmit={handleLogin}>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="نام کاربری" style={inputStyle} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="رمز عبور" style={inputStyle} />
          {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            background: '#03a66d', color: 'white', border: 'none', width: '100%',
            padding: '12px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            {loading ? '⏳' : '🚀 ورود به پنل'}
          </button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', marginTop: 24 }}>
          ساخته شده با ❤️ توسط <a href="https://t.me/llllxyz" style={{ color: '#03a66d', textDecoration: 'none' }}>Mohammad</a>
        </p>
      </div>
    </div>
  );
}

const inputStyle: any = {
  background: '#11111b', border: '1px solid #313244', borderRadius: 8,
  padding: '10px 14px', color: '#e0e0e0', width: '100%', marginBottom: 12,
  display: 'block', outline: 'none', fontSize: 14,
};

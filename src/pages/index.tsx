import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { setToken, apiErrorText } from '@/lib/api';
import { useI18n } from '@/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Login() {
  const router = useRouter();
  const { t } = useI18n();
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
        setError(data.error ? apiErrorText({ message: data.error, code: data.code, vars: data.vars }, t) : t('login.badCreds'));
      }
    } catch {
      setError(t('login.netError'));
    }
    setLoading(false);
  }

  return (
    <div className="gate">
      <Head><title>{t('login.headTitle')}</title></Head>
      <div className="gate-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <LanguageSwitcher />
        </div>
        <div className="gate-mark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="7" y="7" width="10" height="10" rx="2" />
            <path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3" />
          </svg>
        </div>
        <div className="gate-title">{t('login.title')}</div>
        <div className="gate-sub">{t('login.sub')}</div>

        <form onSubmit={handleLogin}>
          <label className="label">{t('login.username')}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            className="input ltr"
            style={{ marginBottom: 14 }}
            autoComplete="username"
          />
          <label className="label">{t('login.password')}</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••••"
            className="input ltr"
            style={{ marginBottom: 6 }}
            autoComplete="current-password"
          />
          {error && <div className="muted" style={{ fontSize: 12, margin: '10px 0 0', color: 'var(--fg-dim)' }}>{error}</div>}
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16, padding: '11px' }}>
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>

        <div className="gate-foot">
          {t('app.creditBy')}{' '}
          <a className="link-quiet" href="https://t.me/llllxyz" target="_blank" rel="noreferrer" style={{ color: 'var(--fg-dim)' }}>
            Mohammad
          </a>
        </div>
      </div>
    </div>
  );
}

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { api, getToken, setToken } from '@/lib/api';
import { useI18n } from '@/i18n';
import LanguageSwitcher from './LanguageSwitcher';

/** 17px خطی — مونوکروم، ۱.۵ استروک. */
const I = {
  dash: <path d="M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z" />,
  server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  link: <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />,
  tunnel: <><path d="M4 20V9a8 8 0 0 1 16 0v11" /><path d="M9 20v-6a3 3 0 0 1 6 0v6" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 11.2a3.2 3.2 0 0 0 0-6.4M18 20a6.6 6.6 0 0 0-2-4.7" /></>,
  logs: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h7M9 8h3" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 2.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.9-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10.2 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4z" /></>,
  chip: <><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3" /></>,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  chevron: <path d="M9 6l6 6-6 6" />,
};

function Icon({ name, size = 17 }: { name: keyof typeof I; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[name]}</svg>
  );
}

const groups: { labelKey: string; items: { icon: keyof typeof I; labelKey: string; path: string; badgeKey?: string }[] }[] = [
  {
    labelKey: 'nav.g.overview',
    items: [
      { icon: 'dash', labelKey: 'nav.dashboard', path: '/dashboard' },
      { icon: 'logs', labelKey: 'nav.logs', path: '/logs' },
    ],
  },
  {
    labelKey: 'nav.g.infra',
    items: [
      { icon: 'server', labelKey: 'nav.servers', path: '/servers' },
      { icon: 'link', labelKey: 'nav.configs', path: '/configs' },
      { icon: 'tunnel', labelKey: 'nav.tunnels', path: '/tunnels' },
    ],
  },
  {
    labelKey: 'nav.g.filter',
    items: [{ icon: 'shield', labelKey: 'nav.advisor', path: '/advisor', badgeKey: 'nav.badgeNew' }],
  },
  {
    labelKey: 'nav.g.admin',
    items: [
      { icon: 'users', labelKey: 'nav.users', path: '/users' },
      { icon: 'gear', labelKey: 'nav.settings', path: '/settings' },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t, dir } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [connError, setConnError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    api('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch((e) => {
        if (e.message === 'unauthorized') router.replace('/');
        else setConnError(t('nav.connError'));
      });
    // t عوض نمی‌شود مگر زبان تغییر کند؛ بارگذاری دوباره لازم نیست
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem('mui_side_collapsed') === '1') setCollapsed(true);
    } catch { /* قاب محدودشده */ }
  }, []);

  function toggleSide() {
    setCollapsed((v) => {
      try { window.localStorage.setItem('mui_side_collapsed', v ? '0' : '1'); } catch { /* ignore */ }
      return !v;
    });
  }

  function logout() {
    setToken(null);
    router.replace('/');
  }

  const current = groups.flatMap((g) => g.items).find((i) => i.path === router.pathname);
  const roleLabel = user?.role === 'admin' ? t('role.admin') : user?.role === 'reseller' ? t('role.reseller') : t('role.user');

  return (
    <div className="app">
      <aside className={`side ${collapsed ? 'is-collapsed' : ''}`}>
        <button className="collapse-btn" onClick={toggleSide} title={collapsed ? t('nav.expand') : t('nav.collapse')}>
          <span style={{ transform: collapsed ? `rotate(${dir === 'rtl' ? 0 : 180}deg)` : `rotate(${dir === 'rtl' ? 180 : 0}deg)`, display: 'grid', transition: 'transform 160ms' }}>
            <Icon name="chevron" size={14} />
          </span>
        </button>

        <div className="side-brand" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <span className="side-mark"><Icon name="chip" size={16} /></span>
          {!collapsed && (
            <span>
              <div className="side-title">{t('app.name')}</div>
              <div className="side-sub">{t('app.tagline')}</div>
            </span>
          )}
        </div>

        <nav className="side-nav">
          {groups.map((g) => (
            <div key={g.labelKey}>
              {!collapsed && <div className="nav-group">{t(g.labelKey)}</div>}
              {g.items.map((item) => {
                const active = router.pathname === item.path;
                const label = t(item.labelKey);
                return (
                  <div
                    key={item.path}
                    className={`nav-item ${active ? 'is-active' : ''}`}
                    onClick={() => router.push(item.path)}
                    style={collapsed ? { justifyContent: 'center', padding: '10px 0' } : undefined}
                    title={collapsed ? label : undefined}
                  >
                    <Icon name={item.icon} />
                    {!collapsed && (
                      <>
                        <span style={{ flex: 1 }}>{label}</span>
                        {item.badgeKey && <span className="badge badge-quiet">{t(item.badgeKey)}</span>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          {!collapsed && (
            <>
              <div className="who">
                <span className="avatar">{(user?.username || '?').slice(0, 2).toUpperCase()}</span>
                <span>
                  <div className="who-name">{user ? user.username : '…'}</div>
                  <div className="who-role">{user ? roleLabel : ''}</div>
                </span>
              </div>
              <div className="side-mini">
                <span className="link-quiet" onClick={logout} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <Icon name="logout" size={14} /> {t('nav.logout')}
                </span>
                <a className="link-quiet" href="https://t.me/llllxyz" target="_blank" rel="noreferrer">@llllxyz</a>
              </div>
            </>
          )}
          {collapsed && (
            <div className="link-quiet" onClick={logout} style={{ display: 'grid', placeItems: 'center' }} title={t('nav.logout')}>
              <Icon name="logout" size={15} />
            </div>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb">
            <span>{t('app.name')}</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <b>{current ? t(current.labelKey) : t('app.tagline')}</b>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            <span className="badge badge-quiet" title={t('top.activeTitle')}>
              <span className="dot dot-on" /> {t('top.active')}
            </span>
          </div>
        </header>

        <main className="page">
          {connError && (
            <div className="msg msg-err">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <span>{connError}</span>
            </div>
          )}
          {children}
          <footer style={{ marginTop: 56, paddingTop: 18, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--fg-mute)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span>{t('app.creditBy')} <a className="link-quiet" href="https://t.me/llllxyz" target="_blank" rel="noreferrer">Mohammad</a></span>
            <span className="mono">{t('app.footerRight')}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { api, getToken, setToken } from '@/lib/api';

const menuItems = [
  { icon: '📊', label: 'داشبورد', path: '/dashboard' },
  { icon: '🖥️', label: 'سرورها', path: '/servers' },
  { icon: '🔗', label: 'کانفیگ‌ها', path: '/configs' },
  { icon: '🔀', label: 'تانل‌ها', path: '/tunnels' },
  { icon: '👥', label: 'کاربران', path: '/users' },
  { icon: '📋', label: 'لاگ‌ها', path: '/logs' },
  { icon: '⚙️', label: 'تنظیمات', path: '/settings' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    api('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => router.replace('/'));
  }, [router]);

  function logout() {
    setToken(null);
    router.replace('/');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: collapsed ? 60 : 220, background: '#1e1e2e', borderLeft: '1px solid #313244', transition: 'width 0.3s', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #313244' }}>
          <span style={{ fontSize: 24 }}>🐳</span>
          {!collapsed && <span style={{ fontSize: 18, fontWeight: 700, color: '#03a66d', marginRight: 8 }}>M-UI</span>}
        </div>
        <nav style={{ flex: 1, padding: 8 }}>
          {menuItems.map((item) => (
            <div
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                background: router.pathname === item.path ? '#03a66d22' : 'transparent',
                color: router.pathname === item.path ? '#03a66d' : '#a0a0b0',
                fontSize: 14, transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { if (router.pathname !== item.path) (e.target as any).style.background = '#313244'; }}
              onMouseLeave={(e) => { if (router.pathname !== item.path) (e.target as any).style.background = 'transparent'; }}
            >
              <span>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </div>
          ))}
        </nav>
        <div style={{ padding: '12px', borderTop: '1px solid #313244', textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
          {!collapsed && (
            <>
              {user ? user.username : '...'} ·{' '}
              <a
                style={{ color: '#03a66d', textDecoration: 'none', cursor: 'pointer' }}
                onClick={logout}
              >
                خروج
              </a>
              <br />
              <a href="https://t.me/llllxyz" style={{ color: '#03a66d', textDecoration: 'none' }}>@llllxyz</a>
            </>
          )}
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>{children}</main>
    </div>
  );
}

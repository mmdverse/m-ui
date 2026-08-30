import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });
  const [msg, setMsg] = useState('');

  async function load() {
    setUsers(await api('/api/auth/users'));
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function addUser() {
    setMsg('');
    try {
      await api('/api/auth/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ username: '', password: '', role: 'user' });
      setShowForm(false);
      setMsg('✅ کاربر اضافه شد');
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('کاربر حذف شود؟')) return;
    setMsg('');
    try {
      await api('/api/auth/users?id=' + id, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <Layout>
      <Head><title>M-UI — کاربران</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>👥 مدیریت کاربران</h1>
        <button onClick={() => setShowForm((v) => !v)} style={btnStyle}>{showForm ? 'بستن' : '➕ کاربر جدید'}</button>
      </div>
      {msg && <p style={{ color: msg.startsWith('✅') ? '#22c55e' : '#ef4444', fontSize: 13 }}>{msg}</p>}

      {showForm && (
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10 }}>
            <input placeholder="نام کاربری" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={s} />
            <input placeholder="رمز (حداقل ۸ کاراکتر)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={s} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={s}>
              <option value="user">کاربر عادی</option>
              <option value="reseller">فروشنده</option>
              <option value="admin">مدیر</option>
            </select>
            <button onClick={addUser} style={btnStyle}>💾 افزودن</button>
          </div>
        </div>
      )}

      <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20 }}>
        {users.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>کاربری یافت نشد.</p>
        ) : (
          users.map((u: any) => (
            <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #313244' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{u.username}</span>
                <span style={{ fontSize: 12, color: '#6b7280', marginRight: 8 }}>
                  {u.role === 'admin' ? 'مدیر' : u.role === 'reseller' ? 'فروشنده' : 'کاربر'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: u.isActive ? '#22c55e' : '#ef4444', fontSize: 13 }}>
                  {u.isActive ? 'فعال' : 'غیرفعال'}
                </span>
                <button onClick={() => deleteUser(u._id)} style={{ ...btnStyle, background: '#ef4444', padding: '4px 12px', fontSize: 12 }}>🗑</button>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
const s: any = { background: '#11111b', border: '1px solid #313244', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13 };
const btnStyle: any = { background: '#03a66d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 };

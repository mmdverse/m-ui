import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

const emptyForm = {
  name: '', host: '', location: 'ایران', port: 22, username: 'root',
  authType: 'password', password: '', sshKey: '',
};

export default function ServersPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    setServers(await api('/api/servers/list'));
  }
  useEffect(() => {
    api('/api/servers/list').then(setServers).catch(() => {});
  }, []);

  async function addServer() {
    setBusy('add');
    setMsg('');
    try {
      await api('/api/servers/add', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy('');
  }

  async function testConnection(id: string) {
    setBusy(id);
    setMsg('');
    try {
      const data = await api('/api/servers/test?id=' + id, { method: 'POST' });
      setMsg(data.ok ? '✅ اتصال موفق' : '❌ ' + (data.error || 'خطا'));
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy('');
    await load();
  }

  async function deleteServer(id: string) {
    if (!confirm('سرور حذف شود؟')) return;
    try {
      await api('/api/servers/delete?id=' + id, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <Layout>
      <Head><title>M-UI — سرورها</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>🖥️ مدیریت سرورها</h1>
        <button onClick={() => setShowForm((v) => !v)} style={btnStyle}>{showForm ? 'بستن' : '➕ افزودن سرور'}</button>
      </div>
      {msg && <p style={{ color: msg.startsWith('✅') || msg.startsWith('❌') ? (msg.startsWith('✅') ? '#22c55e' : '#ef4444') : '#f59e0b', fontSize: 13 }}>{msg}</p>}

      {showForm && (
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>سرور جدید</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input placeholder="نام سرور" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={s} />
            <input placeholder="آدرس IP یا دامنه" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} style={s} />
            <input placeholder="موقعیت" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={s} />
            <input placeholder="پورت SSH" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} style={s} />
            <input placeholder="نام کاربری SSH" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={s} />
            <select value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value })} style={s}>
              <option value="password">رمز عبور</option>
              <option value="key">کلید SSH (PEM)</option>
            </select>
            {form.authType === 'password' ? (
              <input placeholder="رمز عبور SSH" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ ...s, gridColumn: '1 / -1' }} />
            ) : (
              <textarea placeholder="محتوی کلید خصوصی PEM" rows={4} value={form.sshKey} onChange={(e) => setForm({ ...form, sshKey: e.target.value })} style={{ ...s, gridColumn: '1 / -1', fontFamily: 'monospace', direction: 'ltr' }} />
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addServer} disabled={busy === 'add'} style={btnStyle}>💾 ذخیره</button>
            <button onClick={() => setShowForm(false)} style={{ ...btnStyle, background: '#6b7280' }}>لغو</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {servers.map((server: any) => (
          <div key={server._id} style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: server.status === 'online' ? '#22c55e' : server.status === 'error' ? '#ef4444' : '#6b7280', display: 'inline-block' }} />
                <span style={{ fontWeight: 600 }}>{server.name}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  ({server.location}{server.geoSource === 'auto' ? ' · خودکار' : ''})
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#a0a0b0', marginTop: 4, direction: 'ltr', textAlign: 'left' }}>{server.host}:{server.port} · {server.username} · {server.authType === 'key' ? 'کلید' : 'رمز'}</div>
              {server.status === 'online' && (
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                  <span>⚡ CPU: %{server.cpuUsage ?? '؟'}</span>
                  <span>💾 RAM: %{server.ramUsage ?? '؟'}</span>
                  <span>⏱ Load1: {server.load1 ?? '؟'}</span>
                  <span>📊 RX: {formatBytes(server.rxBytes || 0)} / TX: {formatBytes(server.txBytes || 0)}</span>
                </div>
              )}
              {server.lastError && server.status !== 'online' && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>خطای آخر: {server.lastError}</div>
              )}
              {server.lastPing && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>آخرین تست: {new Date(server.lastPing).toLocaleString('fa-IR')}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => testConnection(server._id)} disabled={busy === server._id} style={{ ...btnStyle, background: '#7c3aed', padding: '6px 16px', fontSize: 12 }}>
                {busy === server._id ? '⏳' : '🔌 تست'}
              </button>
              <button onClick={() => deleteServer(server._id)} style={{ ...btnStyle, background: '#ef4444', padding: '6px 16px', fontSize: 12 }}>🗑</button>
            </div>
          </div>
        ))}
        {servers.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>هیچ سروری ثبت نشده. اولین سرور را اضافه کن! 🚀</p>}
      </div>
    </Layout>
  );
}

function formatBytes(b: number) {
  if (b >= 1e12) return (b / 1e12).toFixed(1) + ' TB';
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b >= 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}
const s: any = { background: '#11111b', border: '1px solid #313244', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13 };
const btnStyle: any = { background: '#03a66d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 };

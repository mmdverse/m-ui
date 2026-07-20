import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';

export default function ServersPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', host: '', location: 'ایران', port: 22, username: 'root', password: '', authType: 'password' });

  useEffect(() => { fetch('/api/servers/list').then(r => r.json()).then(setServers); }, []);

  async function addServer() {
    const res = await fetch('/api/servers/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) { setServers(prev => [...prev, data.server]); setShowForm(false); }
  }

  async function testConnection(id: string) {
    const res = await fetch('/api/servers/test?id=' + id);
    const data = await res.json();
    setServers(prev => prev.map(s => s._id === id ? { ...s, status: data.status, cpuUsage: data.cpu || 0, ramUsage: data.ram || 0 } : s));
  }

  return (
    <Layout>
      <Head><title>M-UI — سرورها</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>🖥️ مدیریت سرورها</h1>
        <button onClick={() => setShowForm(true)} style={btnStyle}>➕ افزودن سرور</button>
      </div>

      {showForm && (
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>سرور جدید</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input placeholder="نام سرور" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={s} />
            <input placeholder="آدرس IP" value={form.host} onChange={e => setForm({...form, host: e.target.value})} style={s} />
            <input placeholder="موقعیت" value={form.location} onChange={e => setForm({...form, location: e.target.value})} style={s} />
            <input placeholder="پورت SSH" type="number" value={form.port} onChange={e => setForm({...form, port: Number(e.target.value)})} style={s} />
            <input placeholder="نام کاربری" value={form.username} onChange={e => setForm({...form, username: e.target.value})} style={s} />
            <input placeholder="رمز عبور" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} style={s} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addServer} style={btnStyle}>💾 ذخیره</button>
            <button onClick={() => setShowForm(false)} style={{...btnStyle, background: '#6b7280'}}>لغو</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {servers.map((server: any) => (
          <div key={server._id} style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: server.status === 'online' ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                <span style={{ fontWeight: 600 }}>{server.name}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>({server.location})</span>
              </div>
              <div style={{ fontSize: 13, color: '#a0a0b0', marginTop: 4, direction: 'ltr', textAlign: 'left' }}>{server.host}:{server.port}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                <span>💾 RAM: {server.ramUsage || '-'}%</span>
                <span>⚡ CPU: {server.cpuUsage || '-'}%</span>
                <span>📊 ترافیک: {formatBytes(server.monthlyTraffic || 0)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => testConnection(server._id)} style={{...btnStyle, background: '#7c3aed', padding: '6px 16px', fontSize: 12}}>🔌 تست</button>
              <button style={{...btnStyle, background: 'transparent', border: '1px solid #313244', padding: '6px 16px', fontSize: 12}}>⚙️</button>
            </div>
          </div>
        ))}
        {servers.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>هیچ سروری ثبت نشده. اولین سرور رو اضافه کن! 🚀</p>}
      </div>
    </Layout>
  );
}

function formatBytes(b: number) { if (b > 1e12) return (b/1e12).toFixed(1)+'TB'; if (b > 1e9) return (b/1e9).toFixed(1)+'GB'; return (b/1e6).toFixed(1)+'MB'; }
const s: any = { background: '#11111b', border: '1px solid #313244', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13 };
const btnStyle: any = { background: '#03a66d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 };

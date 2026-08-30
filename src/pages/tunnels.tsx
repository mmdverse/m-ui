import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

const emptyForm = { name: '', type: 'ssh', localServer: '', remoteServer: '', localPort: 443, remotePort: 8443 };

export default function TunnelsPage() {
  const [tunnels, setTunnels] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const [t, sv] = await Promise.all([api('/api/tunnels/list'), api('/api/servers/list')]);
    setTunnels(t);
    setServers(sv);
  }
  useEffect(() => {
    load().catch(() => {});
    const timer = setInterval(() => load().catch(() => {}), 15000); // reflect real process state
    return () => clearInterval(timer);
  }, []);

  async function addTunnel() {
    setMsg('');
    try {
      await api('/api/tunnels/add', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function startTunnel(id: string) {
    setBusy(id);
    setMsg('');
    try {
      const data = await api('/api/tunnels/start?id=' + id, { method: 'POST' });
      setMsg('✅ تانل فعال شد (pid ' + data.pid + ')');
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    }
    setBusy('');
    await load();
  }

  async function stopTunnel(id: string) {
    setBusy(id);
    try {
      await api('/api/tunnels/stop?id=' + id, { method: 'POST' });
      setMsg('⏹ تانل متوقف شد');
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy('');
    await load();
  }

  async function deleteTunnel(id: string) {
    if (!confirm('تانل حذف شود؟')) return;
    try {
      await api('/api/tunnels/delete?id=' + id, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  const typeLabel: any = { ssh: '🔄 SSH Reverse', direct: 'Direct', frp: 'FRP', wireguard: 'WireGuard' };

  return (
    <Layout>
      <Head><title>M-UI — تانل‌ها</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>🔀 تانلینگ</h1>
        <button onClick={addTunnel} style={btnStyle}>➕ تانل جدید</button>
      </div>
      {msg && <p style={{ color: msg.startsWith('✅') || msg.startsWith('❌') ? (msg.startsWith('✅') ? '#22c55e' : '#ef4444') : '#f59e0b', fontSize: 13 }}>{msg}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 14, color: '#7c3aed', marginBottom: 8 }}>🔄 SSH Reverse</h3>
          <p style={{ fontSize: 12, color: '#6b7280' }}>
            پیاده‌سازی‌شده: با OpenSSH روی سرور پنل اجرا می‌شود و پورتِ سرور خارج را به سرویس محلی فوروارد می‌کند.
            برای رمز عبور به بسته sshpass نیاز دارد؛ با کلید SSH بدون آن کار می‌کند.
          </p>
        </div>
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 14, color: '#03a66d', marginBottom: 8 }}>Direct</h3>
          <p style={{ fontSize: 12, color: '#6b7280' }}>ثبت می‌شود ولی فعلاً اجرا نمی‌شود (هنوز پیاده‌سازی نشده).</p>
        </div>
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 14, color: '#3b82f6', marginBottom: 8 }}>FRP / WireGuard</h3>
          <p style={{ fontSize: 12, color: '#6b7280' }}>ثبت می‌شود ولی فعلاً اجرا نمی‌شود (هنوز پیاده‌سازی نشده).</p>
        </div>
      </div>

      <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>➕ تانل جدید</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <input placeholder="نام تانل" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={s} />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={s}>
            <option value="ssh">SSH Reverse (اجرا می‌شود)</option>
            <option value="direct">Direct (فقط ثبت)</option>
            <option value="frp">FRP (فقط ثبت)</option>
            <option value="wireguard">WireGuard (فقط ثبت)</option>
          </select>
          <select value={form.localServer} onChange={(e) => setForm({ ...form, localServer: e.target.value })} style={s}>
            <option value="">سرور مبدأ (محلی)</option>
            {servers.map((sv: any) => <option key={sv._id} value={sv._id}>{sv.name}</option>)}
          </select>
          <select value={form.remoteServer} onChange={(e) => setForm({ ...form, remoteServer: e.target.value })} style={s}>
            <option value="">سرور مقصد (خارج)</option>
            {servers.map((sv: any) => <option key={sv._id} value={sv._id}>{sv.name}</option>)}
          </select>
          <input placeholder="پورت محلی" type="number" value={form.localPort} onChange={(e) => setForm({ ...form, localPort: Number(e.target.value) })} style={s} />
          <input placeholder="پورت روی سرور خارج" type="number" value={form.remotePort} onChange={(e) => setForm({ ...form, remotePort: Number(e.target.value) })} style={s} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {tunnels.map((t: any) => {
          const local = servers.find((sv: any) => sv._id === t.localServer);
          const remote = servers.find((sv: any) => sv._id === t.remoteServer);
          const active = (t.status as string) === 'active';
          return (
            <div key={t._id} style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: active ? '#22c55e' : '#6b7280', display: 'inline-block' }} />
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#7c3aed22', color: '#7c3aed' }}>{typeLabel[t.type] || t.type}</span>
                  {t.pid && <span style={{ fontSize: 11, color: '#6b7280' }}>pid {t.pid}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#a0a0b0', marginTop: 4 }}>
                  {local?.name || '؟'} :{t.localPort} ← {remote?.name || '؟'} :{t.remotePort}
                </div>
                {t.lastError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{t.lastError}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!active ? (
                  <button onClick={() => startTunnel(t._id)} disabled={busy === t._id || t.type !== 'ssh'} title={t.type !== 'ssh' ? 'فقط SSH پیاده‌سازی شده' : ''}
                    style={{ ...btnStyle, background: '#22c55e', padding: '6px 16px', fontSize: 12 }}>▶ شروع</button>
                ) : (
                  <button onClick={() => stopTunnel(t._id)} disabled={busy === t._id}
                    style={{ ...btnStyle, background: '#ef4444', padding: '6px 16px', fontSize: 12 }}>⏹ توقف</button>
                )}
                <button onClick={() => deleteTunnel(t._id)} style={{ ...btnStyle, background: 'transparent', border: '1px solid #313244', padding: '6px 16px', fontSize: 12 }}>🗑</button>
              </div>
            </div>
          );
        })}
        {tunnels.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>تانلی تعریف نشده. اولین تانل را با اتصال سرور ایران به خارج بساز! 🔀</p>}
      </div>
    </Layout>
  );
}
const s: any = { background: '#11111b', border: '1px solid #313244', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13 };
const btnStyle: any = { background: '#03a66d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 };

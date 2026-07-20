import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';

export default function TunnelsPage() {
  const [tunnels, setTunnels] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', type: 'direct', localServer: '', remoteServer: '', localPort: 443, remotePort: 8443 });

  useEffect(() => {
    fetch('/api/tunnels/list').then(r => r.json()).then(setTunnels);
    fetch('/api/servers/list').then(r => r.json()).then(setServers);
  }, []);

  async function addTunnel() {
    const res = await fetch('/api/tunnels/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) { setTunnels(prev => [...prev, data.tunnel]); setForm({ name: '', type: 'direct', localServer: '', remoteServer: '', localPort: 443, remotePort: 8443 }); }
    }
  }

  return (
    <Layout>
      <Head><title>M-UI — تانل‌ها</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>🔀 تانلینگ پیشرفته</h1>
        <button onClick={addTunnel} style={btnStyle}>➕ تانل جدید</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 14, color: '#03a66d', marginBottom: 8 }}>🔄 تانل مستقیم (Direct)</h3>
          <p style={{ fontSize: 12, color: '#6b7280' }}>اتصال مستقیم دو سرور بدون رمزنگاری اضافه. مناسب برای فوروارد پورت ساده.</p>
        </div>
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 14, color: '#7c3aed', marginBottom: 8 }}>🔄 تانل SSH</h3>
          <p style={{ fontSize: 12, color: '#6b7280' }}>ایجاد تانل از طریق SSH Reverse. دور زدن فیلترینگ با استفاده از سرور خارج.</p>
        </div>
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 14, color: '#3b82f6', marginBottom: 8 }}>🔄 تانل FRP</h3>
          <p style={{ fontSize: 12, color: '#6b7280' }}>استفاده از FRP برای تانلینگ پیشرفته. پشتیبانی از TLS و Load Balancing.</p>
        </div>
      </div>

      <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>➕ تانل جدید</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <input placeholder="نام تانل" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={s} />
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={s}>
            <option value="direct">Direct</option><option value="ssh">SSH Tunnel</option><option value="frp">FRP</option><option value="wireguard">WireGuard</option>
          </select>
          <select value={form.localServer} onChange={e => setForm({...form, localServer: e.target.value})} style={s}>
            <option value="">سرور مبدأ (ایران)</option>
            {servers.filter((s: any) => s.location === 'ایران').map((sv: any) => <option key={sv._id} value={sv._id}>{sv.name}</option>)}
          </select>
          <select value={form.remoteServer} onChange={e => setForm({...form, remoteServer: e.target.value})} style={s}>
            <option value="">سرور مقصد (خارج)</option>
            {servers.filter((s: any) => s.location !== 'ایران').map((sv: any) => <option key={sv._id} value={sv._id}>{sv.name}</option>)}
          </select>
          <input type="number" placeholder="پورت محلی" value={form.localPort} onChange={e => setForm({...form, localPort: Number(e.target.value)})} style={s} />
          <input type="number" placeholder="پورت مقصد" value={form.remotePort} onChange={e => setForm({...form, remotePort: Number(e.target.value)})} style={s} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {tunnels.map((t: any) => (
          <div key={t._id} style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.status === 'active' ? '#22c55e' : '#6b7280', display: 'inline-block' }} />
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#7c3aed22', color: '#7c3aed' }}>{t.type}</span>
              </div>
              <div style={{ fontSize: 12, color: '#a0a0b0', marginTop: 4, direction: 'ltr', textAlign: 'left' }}>
                {t.localPort} → {t.remotePort} | 🚀 latency: {t.latency || '-'}ms
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{...btnStyle, background: '#22c55e', padding: '6px 16px', fontSize: 12}}>▶ شروع</button>
              <button style={{...btnStyle, background: '#ef4444', padding: '6px 16px', fontSize: 12}}>⏹ توقف</button>
            </div>
          </div>
        ))}
        {tunnels.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>تانلی تعریف نشده. اولین تانل رو با اتصال سرور ایران به خارج بساز! 🔀</p>}
      </div>
    </Layout>
  );
}
const s: any = { background: '#11111b', border: '1px solid #313244', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13 };
const btnStyle: any = { background: '#03a66d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 };

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';

const protocols = ['vmess', 'vless', 'trojan', 'shadowsocks', 'socks5', 'wireguard'];
const transports = ['tcp', 'kcp', 'ws', 'http', 'quic', 'grpc'];

export default function ConfigsPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', serverId: '', protocol: 'vmess', port: 443, transport: 'ws', security: 'tls', domain: '', path: '/', sni: '' });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch('/api/configs/list').then(r => r.json()).then(setConfigs);
    fetch('/api/servers/list').then(r => r.json()).then(setServers);
  }, []);

  async function addConfig() {
    const res = await fetch('/api/configs/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) { setConfigs(prev => [...prev, data.config]); setShowForm(false); }
  }

  function generateLink(config: any) {
    const base64 = btoa(JSON.stringify({
      v: '2', ps: config.name, add: servers.find(s => s._id === config.serverId)?.host || '',
      port: config.port, id: crypto.randomUUID(), aid: '0', net: config.transport,
      type: 'none', host: config.domain, path: config.path, tls: config.security === 'tls' ? 'tls' : '',
    }));
    return 'vmess://' + base64;
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <Layout>
      <Head><title>M-UI — کانفیگ‌ها</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>🔗 مدیریت کانفیگ‌ها</h1>
        <button onClick={() => setShowForm(true)} style={btnStyle}>➕ کانفیگ جدید</button>
      </div>

      {showForm && (
        <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid #313244' }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>کانفیگ جدید</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <input placeholder="نام کانفیگ" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={s} />
            <select value={form.serverId} onChange={e => setForm({...form, serverId: e.target.value})} style={s}>
              <option value="">انتخاب سرور</option>
              {servers.map((sv: any) => <option key={sv._id} value={sv._id}>{sv.name}</option>)}
            </select>
            <select value={form.protocol} onChange={e => setForm({...form, protocol: e.target.value})} style={s}>
              {protocols.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="number" placeholder="پورت" value={form.port} onChange={e => setForm({...form, port: Number(e.target.value)})} style={s} />
            <select value={form.transport} onChange={e => setForm({...form, transport: e.target.value})} style={s}>
              {transports.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.security} onChange={e => setForm({...form, security: e.target.value})} style={s}>
              <option value="none">بدون TLS</option>
              <option value="tls">TLS</option>
              <option value="reality">REALITY</option>
            </select>
            {(form.security === 'tls' || form.security === 'reality') && (
              <input placeholder="دامنه (SNI)" value={form.sni} onChange={e => setForm({...form, sni: e.target.value})} style={s} />
            )}
            <input placeholder="Path (فقط WebSocket)" value={form.path} onChange={e => setForm({...form, path: e.target.value})} style={s} />
            <input placeholder="دامنه CDN" value={form.domain} onChange={e => setForm({...form, domain: e.target.value})} style={s} />
          </div>
          <button onClick={addConfig} style={{...btnStyle, marginTop: 12}}>💾 ایجاد کانفیگ</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {configs.map((cfg: any) => {
          const srv = servers.find((s: any) => s._id === cfg.serverId);
          return (
            <div key={cfg._id} style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: '#03a66d22', color: '#03a66d', fontSize: 11, fontWeight: 600 }}>{cfg.protocol}</span>
                    <span style={{ fontWeight: 600 }}>{cfg.name}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>→ {srv?.name || 'نامشخص'} ({srv?.location || '?'})</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#a0a0b0', marginTop: 4, direction: 'ltr', textAlign: 'left' }}>
                    {srv?.host}:{cfg.port} | {cfg.transport} | {cfg.security}
                    {cfg.sni && ` | SNI: ${cfg.sni}`}
                    {cfg.path && ` | Path: ${cfg.path}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { const link = generateLink(cfg); copyText(link); }} style={{...btnStyle, background: '#7c3aed', padding: '6px 14px', fontSize: 12}}>📋 کپی لینک</button>
                  <button style={{...btnStyle, background: 'transparent', border: '1px solid #313244', padding: '6px 14px', fontSize: 12}}>🔌 تست</button>
                </div>
              </div>
            </div>
          );
        })}
        {configs.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>هنوز کانفیگی ساخته نشده. اولین کانفیگ رو بساز! 🚀</p>}
      </div>
    </Layout>
  );
}
const s: any = { background: '#11111b', border: '1px solid #313244', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13 };
const btnStyle: any = { background: '#03a66d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 };

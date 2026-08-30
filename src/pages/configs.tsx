import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

const protocols = ['vmess', 'vless', 'trojan', 'shadowsocks', 'socks5', 'wireguard'];
const transports = ['tcp', 'kcp', 'ws', 'http', 'quic', 'grpc'];
const emptyForm = { name: '', serverId: '', protocol: 'vmess', port: 443, transport: 'ws', security: 'tls', domain: '', path: '/', sni: '', pbk: '', fp: 'chrome', sid: '' };

export default function ConfigsPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const [c, sv] = await Promise.all([api('/api/configs/list'), api('/api/servers/list')]);
    setConfigs(c);
    setServers(sv);
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function addConfig() {
    try {
      await api('/api/configs/add', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function copyLink(cfg: any) {
    try {
      const data = await api('/api/configs/link?id=' + cfg._id);
      await navigator.clipboard.writeText(data.link);
      setMsg('✅ لینک ' + data.protocol + ' کپی شد (UUID ثابت سرور)');
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function deleteConfig(id: string) {
    if (!confirm('کانفیگ حذف شود؟')) return;
    try {
      await api('/api/configs/delete?id=' + id, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <Layout>
      <Head><title>M-UI — کانفیگ‌ها</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>🔗 مدیریت کانفیگ‌ها</h1>
        <button onClick={() => setShowForm((v) => !v)} style={btnStyle}>{showForm ? 'بستن' : '➕ کانفیگ جدید'}</button>
      </div>
      {msg && <p style={{ color: msg.startsWith('✅') ? '#22c55e' : '#ef4444', fontSize: 13 }}>{msg}</p>}

      {showForm && (
        <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid #313244' }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>کانفیگ جدید</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <input placeholder="نام کانفیگ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={s} />
            <select value={form.serverId} onChange={(e) => setForm({ ...form, serverId: e.target.value })} style={s}>
              <option value="">انتخاب سرور</option>
              {servers.map((sv: any) => <option key={sv._id} value={sv._id}>{sv.name}</option>)}
            </select>
            <select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })} style={s}>
              {protocols.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="number" placeholder="پورت" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} style={s} />
            <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value })} style={s}>
              {transports.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.security} onChange={(e) => setForm({ ...form, security: e.target.value })} style={s}>
              <option value="none">بدون TLS</option>
              <option value="tls">TLS</option>
              <option value="reality">REALITY</option>
            </select>
            {(form.security === 'tls' || form.security === 'reality') && (
              <input placeholder="دامنه (SNI)" value={form.sni} onChange={(e) => setForm({ ...form, sni: e.target.value })} style={s} />
            )}
            <input placeholder="Path (فقط WebSocket)" value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} style={s} />
            <input placeholder="دامنه CDN" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} style={s} />
            {form.security === 'reality' && (
              <>
                <input placeholder="کلید عمومی REALITY (pbk)" value={form.pbk} onChange={(e) => setForm({ ...form, pbk: e.target.value })} style={{ ...s, gridColumn: '1 / 3', direction: 'ltr' }} />
                <select value={form.fp} onChange={(e) => setForm({ ...form, fp: e.target.value })} style={s}>
                  {['chrome', 'firefox', 'edge', 'safari', 'ios', 'android', '360', 'qq'].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <input placeholder="Short ID (اختیاری)" value={form.sid} onChange={(e) => setForm({ ...form, sid: e.target.value })} style={{ ...s, direction: 'ltr' }} />
              </>
            )}
          </div>
          <button onClick={addConfig} style={{ ...btnStyle, marginTop: 12 }}>💾 ایجاد کانفیگ</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {configs.map((cfg: any) => {
          const srv = servers.find((sv: any) => sv._id === cfg.serverId);
          return (
            <div key={cfg._id} style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: '#03a66d22', color: '#03a66d', fontSize: 11, fontWeight: 600 }}>{cfg.protocol}</span>
                    <span style={{ fontWeight: 600 }}>{cfg.name}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>→ {srv?.name || 'نامشخص'} ({srv?.location || '؟'})</span>
                    {!cfg.isActive && <span style={{ fontSize: 11, color: '#ef4444' }}>غیرفعال</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#a0a0b0', marginTop: 4, direction: 'ltr', textAlign: 'left' }}>
                    {srv?.host}:{cfg.port} | {cfg.transport} | {cfg.security}
                    {cfg.sni && ` | SNI: ${cfg.sni}`}
                    {cfg.path && ` | Path: ${cfg.path}`}
                    {cfg.security === 'reality' && ` | pbk: ${(cfg.pbk || '').slice(0, 14)}… | fp: ${cfg.fp}`}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, direction: 'ltr', textAlign: 'left' }}>UUID: {cfg.uuid}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => copyLink(cfg)} style={{ ...btnStyle, background: '#7c3aed', padding: '6px 14px', fontSize: 12 }}>📋 کپی لینک</button>
                  <button onClick={() => deleteConfig(cfg._id)} style={{ ...btnStyle, background: '#ef4444', padding: '6px 14px', fontSize: 12 }}>🗑</button>
                </div>
              </div>
            </div>
          );
        })}
        {configs.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>هنوز کانفیگی ساخته نشده. اولین کانفیگ را بساز! 🚀</p>}
      </div>
    </Layout>
  );
}
const s: any = { background: '#11111b', border: '1px solid #313244', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13 };
const btnStyle: any = { background: '#03a66d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 };

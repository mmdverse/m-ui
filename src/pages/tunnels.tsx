import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api, apiErrorText } from '@/lib/api';
import { useI18n } from '@/i18n';
import { PageHead, Msg, Empty, Field, StatusDot } from '@/components/ui';

const emptyForm = { name: '', type: 'ssh', localServer: '', remoteServer: '', localPort: 443, remotePort: 8443 };

export default function TunnelsPage() {
  const { t, fmtDate } = useI18n();
  const [tunnels, setTunnels] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState<'info' | 'ok' | 'err'>('info');

  function flash(text: string, k: 'info' | 'ok' | 'err' = 'info') {
    setMsg(text);
    setKind(k);
  }

  async function load() {
    const [tu, sv] = await Promise.all([api('/api/tunnels/list'), api('/api/servers/list')]);
    setTunnels(tu);
    setServers(sv);
  }
  useEffect(() => {
    load().catch(() => {});
    const timer = setInterval(() => load().catch(() => {}), 15000); // وضعیت واقعی فرایند
    return () => clearInterval(timer);
  }, []);

  async function addTunnel() {
    setMsg('');
    try {
      await api('/api/tunnels/add', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyForm);
      await load();
      flash(t('tun.created'), 'ok');
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
  }

  async function startTunnel(id: string) {
    setBusy(id);
    setMsg('');
    try {
      const data = await api('/api/tunnels/start?id=' + id, { method: 'POST' });
      flash(t('tun.started', { pid: data.pid }), 'ok');
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
    setBusy('');
    await load();
  }

  async function stopTunnel(id: string) {
    setBusy(id);
    try {
      await api('/api/tunnels/stop?id=' + id, { method: 'POST' });
      flash(t('tun.stopped'), 'ok');
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
    setBusy('');
    await load();
  }

  async function deleteTunnel(id: string) {
    if (!confirm(t('c.confirmTunnel'))) return;
    try {
      await api('/api/tunnels/delete?id=' + id, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
  }

  return (
    <Layout>
      <Head><title>{`M-UI — ${t('tun.title')}`}</title></Head>
      <PageHead eyebrow={t('tun.eyebrow')} title={t('tun.title')} sub={t('tun.sub')} />

      {msg && <Msg kind={kind}>{msg}</Msg>}

      <div className="grid cols-3" style={{ marginBottom: 22 }}>
        <div className="card tight">
          <div className="row-title" style={{ fontSize: 13 }}>{t('tun.sshTitle')}</div>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{t('tun.sshDesc')}</p>
        </div>
        <div className="card tight">
          <div className="row-title" style={{ fontSize: 13 }}>{t('tun.directTitle')}</div>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{t('tun.directDesc')}</p>
        </div>
        <div className="card tight">
          <div className="row-title" style={{ fontSize: 13 }}>{t('tun.otherTitle')}</div>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{t('tun.otherDesc')}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="section-title">{t('tun.formTitle')}</div>
        <div className="grid cols-3" style={{ gap: 14 }}>
          <Field label={t('tun.name')}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t('tun.type')}>
            <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="ssh">{t('tun.typeSsh')}</option>
              <option value="direct">{t('tun.typeDirect')}</option>
              <option value="frp">{t('tun.typeFrp')}</option>
              <option value="wireguard">{t('tun.typeWg')}</option>
            </select>
          </Field>
          <Field label={t('tun.localServer')}>
            <select className="select" value={form.localServer} onChange={(e) => setForm({ ...form, localServer: e.target.value })}>
              <option value="">{t('c.selectServer')}</option>
              {servers.map((sv: any) => <option key={sv._id} value={sv._id}>{sv.name}</option>)}
            </select>
          </Field>
          <Field label={t('tun.remoteServer')}>
            <select className="select" value={form.remoteServer} onChange={(e) => setForm({ ...form, remoteServer: e.target.value })}>
              <option value="">{t('c.selectServer')}</option>
              {servers.map((sv: any) => <option key={sv._id} value={sv._id}>{sv.name}</option>)}
            </select>
          </Field>
          <Field label={t('tun.localPort')}>
            <input className="input ltr" type="number" value={form.localPort} onChange={(e) => setForm({ ...form, localPort: Number(e.target.value) })} />
          </Field>
          <Field label={t('tun.remotePort')}>
            <input className="input ltr" type="number" value={form.remotePort} onChange={(e) => setForm({ ...form, remotePort: Number(e.target.value) })} />
          </Field>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={addTunnel}>{t('tun.create')}</button>
      </div>

      {tunnels.length === 0 ? (
        <Empty title={t('tun.emptyTitle')} hint={t('tun.emptyHint')} />
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {tunnels.map((tn: any) => {
            const local = servers.find((sv: any) => sv._id === tn.localServer);
            const remote = servers.find((sv: any) => sv._id === tn.remoteServer);
            const active = (tn.status as string) === 'active';
            return (
              <div key={tn._id} className="card hoverable">
                <div className="row" style={{ padding: 0, borderBottom: 0, alignItems: 'flex-start' }}>
                  <div>
                    <div className="row-title">
                      <StatusDot status={tn.status} />
                      {tn.name}
                      <span className="badge badge-quiet">
                        {tn.type === 'ssh' ? t('tun.sshTitle') : tn.type === 'direct' ? t('tun.directTitle') : tn.type}
                      </span>
                      {tn.pid && <span className="mono muted">pid {tn.pid}</span>}
                      {active && <span className="badge">active</span>}
                    </div>
                    <div className="row-meta mono ltr">
                      {local?.name || '?'}:{tn.localPort} ← {remote?.name || '?'}:{tn.remotePort}
                    </div>
                    {tn.lastError && <div className="row-meta" style={{ color: 'var(--fg-dim)' }}>{tn.lastError}</div>}
                    {tn.startedAt && <div className="row-meta">{t('tun.startedAt', { when: fmtDate(tn.startedAt) })}</div>}
                  </div>
                  <div className="row-actions">
                    {!active ? (
                      <button className="btn btn-sm btn-primary" onClick={() => startTunnel(tn._id)} disabled={busy === tn._id || tn.type !== 'ssh'}
                        title={tn.type !== 'ssh' ? t('tun.onlySsh') : ''}>
                        {busy === tn._id ? t('tun.starting') : t('tun.start')}
                      </button>
                    ) : (
                      <button className="btn btn-sm" onClick={() => stopTunnel(tn._id)} disabled={busy === tn._id}>{t('tun.stop')}</button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => deleteTunnel(tn._id)}>{t('c.delete')}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api, apiErrorText } from '@/lib/api';
import { useI18n } from '@/i18n';
import { PageHead, Msg, Empty, Field, StatusDot, statusLabel, bytes } from '@/components/ui';

const emptyForm = {
  name: '', host: '', location: '', port: 22, username: 'root',
  authType: 'password', password: '', sshKey: '',
};

export default function ServersPage() {
  const { t, fmtDate } = useI18n();
  const [servers, setServers] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState<'info' | 'ok' | 'err'>('info');

  function flash(text: string, k: 'info' | 'ok' | 'err' = 'info') {
    setMsg(text);
    setKind(k);
  }

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
      flash(t('srv.saved'), 'ok');
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
    setBusy('');
  }

  async function testConnection(id: string) {
    setBusy(id);
    setMsg('');
    try {
      const data = await api('/api/servers/test?id=' + id, { method: 'POST' });
      if (data.ok) flash(t('srv.connected', { cpu: data.cpuUsage, ram: data.ramUsage, load: data.load1 }), 'ok');
      else flash(apiErrorText({ message: data.error }, t) || t('srv.failed'), 'err');
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
    setBusy('');
    await load();
  }

  async function deleteServer(id: string) {
    if (!confirm(t('c.confirmServer'))) return;
    try {
      await api('/api/servers/delete?id=' + id, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
  }

  return (
    <Layout>
      <Head><title>{`M-UI — ${t('srv.title')}`}</title></Head>
      <PageHead eyebrow={t('srv.eyebrow')} title={t('srv.title')} sub={t('srv.sub')}>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? t('c.closeForm') : t('srv.add')}
        </button>
      </PageHead>

      {msg && <Msg kind={kind}>{msg}</Msg>}

      {showForm && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="section-title">{t('srv.formTitle')}</div>
          <div className="grid cols-2" style={{ gap: 14 }}>
            <Field label={t('srv.name')}>
              <input className="input" placeholder={t('srv.namePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={t('srv.host')}>
              <input className="input ltr" placeholder="203.0.113.10" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
            </Field>
            <Field label={t('srv.location')}>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label={t('srv.port')}>
              <input className="input ltr" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
            </Field>
            <Field label={t('srv.username')}>
              <input className="input ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label={t('srv.auth')}>
              <select className="select" value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value })}>
                <option value="password">{t('srv.authPassword')}</option>
                <option value="key">{t('srv.authKey')}</option>
              </select>
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              {form.authType === 'password' ? (
                <Field label={t('srv.password')} hint={t('srv.passwordHint')}>
                  <input className="input ltr" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </Field>
              ) : (
                <Field label={t('srv.privateKey')}>
                  <textarea className="textarea" rows={4} value={form.sshKey} onChange={(e) => setForm({ ...form, sshKey: e.target.value })} />
                </Field>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={addServer} disabled={busy === 'add'}>{t('c.save')}</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('c.cancel')}</button>
          </div>
        </div>
      )}

      {servers.length === 0 ? (
        <Empty title={t('srv.emptyTitle')} hint={t('srv.emptyHint')} />
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {servers.map((server: any) => (
            <div key={server._id} className="card hoverable">
              <div className="row" style={{ padding: 0, borderBottom: 0, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row-title">
                    <StatusDot status={server.status} />
                    {server.name}
                    <span className="badge badge-quiet">
                      {server.location || t('c.none')}{server.geoSource === 'auto' ? ` · ${t('srv.geoAuto')}` : ''}
                    </span>
                    <span className="badge badge-quiet">
                      {server.status === 'online' ? 'online' : server.status === 'error' ? 'error' : statusLabel(t, server.status)}
                    </span>
                  </div>
                  <div className="row-meta mono ltr">
                    {server.host}:{server.port} · {server.username} · {server.authType === 'key' ? 'ssh-key' : 'password'}
                  </div>
                  {server.status === 'online' && (
                    <div className="kv" style={{ marginTop: 10 }}>
                      <span>CPU <b>{server.cpuUsage ?? '?'}%</b></span>
                      <span>RAM <b>{server.ramUsage ?? '?'}%</b></span>
                      <span>Load <b>{server.load1 ?? '?'}</b></span>
                      <span>RX <b>{bytes(server.rxBytes || 0)}</b></span>
                      <span>TX <b>{bytes(server.txBytes || 0)}</b></span>
                    </div>
                  )}
                  {server.lastError && server.status !== 'online' && (
                    <div className="row-meta" style={{ color: 'var(--fg-dim)' }}>{t('srv.lastError', { msg: server.lastError })}</div>
                  )}
                  {server.lastPing && <div className="row-meta">{t('srv.lastTest', { when: fmtDate(server.lastPing) })}</div>}
                </div>
                <div className="row-actions">
                  <button className="btn btn-sm" onClick={() => testConnection(server._id)} disabled={busy === server._id}>
                    {busy === server._id ? t('srv.testing') : t('srv.test')}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteServer(server._id)}>{t('c.delete')}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

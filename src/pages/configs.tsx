import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { api, apiErrorText } from '@/lib/api';
import { useI18n } from '@/i18n';
import { PageHead, Msg, Empty, Field } from '@/components/ui';
import { assessForIran, type Assessment } from '@/lib/evasion';

const protocols = ['vmess', 'vless', 'trojan', 'shadowsocks', 'socks5', 'wireguard'];
const transports = ['tcp', 'kcp', 'ws', 'http', 'quic', 'grpc'];
const emptyForm = {
  name: '', serverId: '', protocol: 'vmess', port: 443, transport: 'ws', security: 'tls',
  domain: '', path: '/', sni: '', pbk: '', fp: 'chrome', sid: '',
  wgServerPub: '', wgAddress: '10.0.0.2/32', wgDns: '1.1.1.1',
};

/** امتیاز عبور از فیلتر از کتابخانهٔ مشترک می‌آید. */
function verdictOf(cfg: any): Assessment {
  return assessForIran({
    protocol: cfg.protocol, transport: cfg.transport, security: cfg.security,
    port: cfg.port, domain: cfg.domain, sni: cfg.sni, path: cfg.path,
    pbk: cfg.pbk, sid: cfg.sid, fp: cfg.fp, flow: cfg.flow,
  });
}

export default function ConfigsPage() {
  const { t } = useI18n();
  const [configs, setConfigs] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState<'info' | 'ok' | 'err'>('info');

  function flash(text: string, k: 'info' | 'ok' | 'err' = 'info') {
    setMsg(text);
    setKind(k);
  }

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
      flash(t('cfg.created'), 'ok');
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
  }

  async function copyLink(cfg: any) {
    try {
      const data = await api('/api/configs/link?id=' + cfg._id);
      await navigator.clipboard.writeText(data.link);
      flash(t('cfg.linkCopied', { protocol: data.protocol }), 'ok');
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
  }

  async function deleteConfig(id: string) {
    if (!confirm(t('c.confirmConfig'))) return;
    try {
      await api('/api/configs/delete?id=' + id, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
  }

  async function deployConfig(cfg: any) {
    setMsg('');
    try {
      await api('/api/configs/deploy?id=' + cfg._id, { method: 'POST' });
      flash(t('cfg.deployedMsg'), 'ok');
      await load();
    } catch (e: any) {
      flash(apiErrorText(e, t), 'err');
    }
  }

  const verdictLabel = (v: Assessment['verdict']) => t(`verdict.${v}`);

  return (
    <Layout>
      <Head><title>{`M-UI — ${t('cfg.title')}`}</title></Head>
      <PageHead eyebrow={t('cfg.eyebrow')} title={t('cfg.title')} sub={t('cfg.sub')}>
        <Link href="/advisor" className="btn btn-ghost">{t('cfg.advisor')}</Link>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? t('c.closeForm') : t('cfg.new')}</button>
      </PageHead>

      {msg && <Msg kind={kind}>{msg}</Msg>}

      {showForm && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="section-title">{t('cfg.formTitle')}</div>
          <div className="grid cols-3" style={{ gap: 14 }}>
            <Field label={t('cfg.name')}>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={t('cfg.server')}>
              <select className="select" value={form.serverId} onChange={(e) => setForm({ ...form, serverId: e.target.value })}>
                <option value="">{t('c.selectServer')}</option>
                {servers.map((sv: any) => <option key={sv._id} value={sv._id}>{sv.name}</option>)}
              </select>
            </Field>
            <Field label={t('cfg.protocol')}>
              <select className="select" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
                {protocols.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label={t('cfg.port')}>
              <input className="input ltr" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
            </Field>
            <Field label={t('cfg.transport')}>
              <select className="select" value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value })}>
                {transports.map((tr) => <option key={tr} value={tr}>{tr}</option>)}
              </select>
            </Field>
            <Field label={t('cfg.security')}>
              <select className="select" value={form.security} onChange={(e) => setForm({ ...form, security: e.target.value })}>
                <option value="none">{t('cfg.secNone')}</option>
                <option value="tls">TLS</option>
                <option value="reality">REALITY</option>
              </select>
            </Field>
            {(form.security === 'tls' || form.security === 'reality') && (
              <Field label={t('cfg.sni')} hint={t('cfg.sniHint')}>
                <input className="input ltr" value={form.sni} onChange={(e) => setForm({ ...form, sni: e.target.value })} />
              </Field>
            )}
            <Field label={t('cfg.path')}>
              <input className="input ltr" value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} />
            </Field>
            <Field label={t('cfg.cdn')}>
              <input className="input ltr" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
            </Field>

            {form.security === 'reality' && (
              <>
                <Field label={t('cfg.pbk')} hint={t('cfg.pbkHint')}>
                  <input className="input ltr" value={form.pbk} onChange={(e) => setForm({ ...form, pbk: e.target.value })} />
                </Field>
                <Field label={t('cfg.fp')}>
                  <select className="select" value={form.fp} onChange={(e) => setForm({ ...form, fp: e.target.value })}>
                    {['chrome', 'firefox', 'edge', 'safari', 'ios', 'android', '360', 'qq'].map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label={t('cfg.sid')}>
                  <input className="input ltr" value={form.sid} onChange={(e) => setForm({ ...form, sid: e.target.value })} />
                </Field>
              </>
            )}

            {form.protocol === 'wireguard' && (
              <>
                <Field label={t('cfg.wgPub')}>
                  <input className="input ltr" value={form.wgServerPub} onChange={(e) => setForm({ ...form, wgServerPub: e.target.value })} />
                </Field>
                <Field label={t('cfg.wgAddr')}>
                  <input className="input ltr" value={form.wgAddress} onChange={(e) => setForm({ ...form, wgAddress: e.target.value })} />
                </Field>
                <Field label={t('cfg.wgDns')}>
                  <input className="input ltr" value={form.wgDns} onChange={(e) => setForm({ ...form, wgDns: e.target.value })} />
                </Field>
              </>
            )}
          </div>

          <div className="divider" />
          <div className="kv">
            <span>{t('cfg.scoreLine', { score: assessForIran({ ...form }).score })}</span>
            <span className="dim">{verdictLabel(assessForIran({ ...form }).verdict)}</span>
          </div>

          {form.protocol === 'socks5' && (
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>{t('cfg.socksNote')}</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={addConfig}>{t('cfg.create')}</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('c.cancel')}</button>
          </div>
        </div>
      )}

      {configs.length === 0 ? (
        <Empty title={t('cfg.emptyTitle')} hint={t('cfg.emptyHint')} />
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {configs.map((cfg: any) => {
            const srv = servers.find((sv: any) => sv._id === cfg.serverId);
            const v = verdictOf(cfg);
            return (
              <div key={cfg._id} className="card hoverable">
                <div className="row" style={{ padding: 0, borderBottom: 0, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row-title">
                      <span className="badge">{cfg.protocol}</span>
                      {cfg.name}
                      <span className="muted" style={{ fontSize: 12 }}>
                        {t('cfg.toServer', { name: srv?.name || t('c.none'), loc: srv?.location || t('c.none') })}
                      </span>
                      {!cfg.isActive && <span className="badge">{t('cfg.disabled')}</span>}
                    </div>
                    <div className="row-meta mono ltr">
                      {srv?.host}:{cfg.port} | {cfg.transport} | {cfg.security}
                      {cfg.sni && ` | sni ${cfg.sni}`}
                      {cfg.path && cfg.path !== '/' && ` | path ${cfg.path}`}
                      {cfg.security === 'reality' && ` | fp ${cfg.fp}`}
                    </div>
                    <div className="kv" style={{ marginTop: 9 }}>
                      <span>
                        {t('cfg.filterScore')} <b>{verdictLabel(v.verdict)}</b> ({v.score}/100)
                      </span>
                      {cfg.protocol === 'socks5' && (
                        <span>
                          {cfg.deployed ? t('cfg.proxyActive') : t('cfg.proxyInactive')}
                          {cfg.deployError ? ` · ${cfg.deployError}` : ''}
                        </span>
                      )}
                      {!['socks5', 'wireguard'].includes(cfg.protocol) && (
                        <span>{t('cfg.uuid')} <b className="mono">{String(cfg.uuid || '').slice(0, 8)}…</b></span>
                      )}
                      {cfg.protocol === 'wireguard' && (
                        <span>{t('cfg.clientPub')} <b className="mono">{String(cfg.wgClientPub || '').slice(0, 10)}…</b></span>
                      )}
                    </div>
                  </div>
                  <div className="row-actions">
                    {cfg.protocol === 'socks5' && !cfg.deployed && (
                      <button className="btn btn-sm" onClick={() => deployConfig(cfg)}>{t('cfg.deployBtn')}</button>
                    )}
                    <Link className="btn btn-sm" href={`/advisor?protocol=${cfg.protocol}&transport=${cfg.transport}&security=${cfg.security}&port=${cfg.port}`}>
                      {t('cfg.inspect')}
                    </Link>
                    <button className="btn btn-sm" onClick={() => copyLink(cfg)}>
                      {cfg.protocol === 'wireguard' ? t('cfg.copyConfig') : t('cfg.copyLink')}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteConfig(cfg._id)}>{t('c.delete')}</button>
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

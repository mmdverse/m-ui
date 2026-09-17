import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api, apiErrorText } from '@/lib/api';
import { useI18n } from '@/i18n';
import { PageHead, Msg, Field } from '@/components/ui';

export default function SettingsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'security' | 'about'>('security');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState<'info' | 'ok' | 'err'>('info');
  const [version, setVersion] = useState('');

  useEffect(() => {
    api('/api/system/version').then((d) => setVersion(d.version || '')).catch(() => {});
  }, []);

  async function changePassword() {
    setMsg('');
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      setCurrent('');
      setNext('');
      setMsg(t('set.passwordChanged'));
      setKind('ok');
    } catch (e: any) {
      setMsg(apiErrorText(e, t));
      setKind('err');
    }
  }

  const security: [string, string][] = [
    [t('set.s1k'), t('set.s1v')],
    [t('set.s2k'), t('set.s2v')],
    [t('set.s3k'), t('set.s3v')],
    [t('set.s4k'), t('set.s4v')],
    [t('set.s5k'), t('set.s5v')],
    [t('set.s6k'), t('set.s6v')],
  ];

  return (
    <Layout>
      <Head><title>{`M-UI — ${t('set.title')}`}</title></Head>
      <PageHead eyebrow={t('set.eyebrow')} title={t('set.title')} sub={t('set.sub')}>
        <button className={`btn btn-sm ${tab === 'security' ? '' : 'btn-ghost'}`} onClick={() => setTab('security')}>{t('set.tabSecurity')}</button>
        <button className={`btn btn-sm ${tab === 'about' ? '' : 'btn-ghost'}`} onClick={() => setTab('about')}>{t('set.tabAbout')}</button>
      </PageHead>

      {msg && <Msg kind={kind}>{msg}</Msg>}

      {tab === 'security' && (
        <div className="split">
          <div className="card">
            <div className="section-title">{t('set.changePassword')}</div>
            <Field label={t('set.currentPassword')}>
              <input className="input ltr" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <div style={{ height: 14 }} />
            <Field label={t('set.newPassword')}>
              <input className="input ltr" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={changePassword}>{t('set.changeBtn')}</button>
          </div>

          <div className="card">
            <div className="section-title">{t('set.statusTitle')}</div>
            {security.map(([k, v]) => (
              <div className="row" key={k} style={{ padding: '11px 0' }}>
                <div>
                  <div className="row-title" style={{ fontSize: 13 }}>{k}</div>
                  <div className="row-meta">{v}</div>
                </div>
                <span className="dot dot-on" />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'about' && (
        <div className="card">
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{t('set.aboutText')}</p>
          <div className="divider" />
          <div className="kv" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <span>{t('set.versionPanel')} <b className="mono">{version || '—'}</b></span>
            <span>{t('set.versionNext')} <b className="mono">14.2.x</b></span>
            <span>{t('set.versionXray')} <b className="mono">26.3.27</b></span>
          </div>
          <div className="divider" />
          <div style={{ fontSize: 12, color: 'var(--fg-mute)' }}>
            {t('app.creditBy')} <a className="link-quiet" href="https://t.me/llllxyz" target="_blank" rel="noreferrer">Mohammad</a>
          </div>
        </div>
      )}
    </Layout>
  );
}

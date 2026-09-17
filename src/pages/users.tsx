import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api, apiErrorText } from '@/lib/api';
import { useI18n } from '@/i18n';
import { PageHead, Msg, Empty, Field } from '@/components/ui';

export default function UsersPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState<'info' | 'ok' | 'err'>('info');

  async function load() {
    setUsers(await api('/api/auth/users'));
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function addUser() {
    setMsg('');
    try {
      await api('/api/auth/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ username: '', password: '', role: 'user' });
      setShowForm(false);
      setMsg(t('usr.added'));
      setKind('ok');
      await load();
    } catch (e: any) {
      setMsg(apiErrorText(e, t));
      setKind('err');
    }
  }

  async function deleteUser(id: string) {
    if (!confirm(t('c.confirmUser'))) return;
    setMsg('');
    try {
      await api('/api/auth/users?id=' + id, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setMsg(apiErrorText(e, t));
      setKind('err');
    }
  }

  const roleLabel = (role: string) =>
    role === 'admin' ? t('role.admin') : role === 'reseller' ? t('role.reseller') : t('role.user');

  return (
    <Layout>
      <Head><title>{`M-UI — ${t('usr.title')}`}</title></Head>
      <PageHead eyebrow={t('usr.eyebrow')} title={t('usr.title')} sub={t('usr.sub')}>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? t('c.closeForm') : t('usr.new')}</button>
      </PageHead>

      {msg && <Msg kind={kind}>{msg}</Msg>}

      {showForm && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="grid" style={{ gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Field label={t('usr.username')}>
              <input className="input ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label={t('usr.password')} hint={t('usr.passwordHint')}>
              <input className="input ltr" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label={t('usr.role')}>
              <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">{t('role.user')}</option>
                <option value="reseller">{t('role.reseller')}</option>
                <option value="admin">{t('role.admin')}</option>
              </select>
            </Field>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addUser}>{t('usr.add')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {users.length === 0 ? (
          <Empty title={t('usr.emptyTitle')} />
        ) : (
          users.map((u: any, i: number) => (
            <div className="row" key={u._id} style={i === 0 ? { paddingTop: 0 } : undefined}>
              <div>
                <div className="row-title">
                  <span className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{String(u.username).slice(0, 2).toUpperCase()}</span>
                  {u.username}
                  <span className="badge badge-quiet">{roleLabel(u.role)}</span>
                </div>
                <div className="row-meta">{u.isActive ? t('usr.activeAccount') : t('usr.disabledAccount')}</div>
              </div>
              <div className="row-actions">
                <span className="badge">{u.isActive ? 'active' : 'disabled'}</span>
                <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u._id)}>{t('c.delete')}</button>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}

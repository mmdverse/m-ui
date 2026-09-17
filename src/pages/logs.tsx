import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { api, apiErrorText } from '@/lib/api';
import { useI18n } from '@/i18n';
import { PageHead, Msg, Empty } from '@/components/ui';

/**
 * رویدادهای سیستم. هر ردیف یا کد ترجمه دارد (`act.*` — ردیف‌های تازه) یا
 * متن خام ذخیره‌شده (ردیف‌های قدیمی‌تر) که دست‌نخورده نمایش داده می‌شود.
 */
export default function LogsPage() {
  const { t, fmtDate } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  // آخرین t برای ترجمهٔ خطا؛ تغییر زبان نباید درخواست را دوباره بفرستد
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    api('/api/system/activity')
      .then((data) => setLogs(Array.isArray(data) ? data : data.logs || []))
      .catch((e) => setError(apiErrorText(e, tRef.current)));
  }, []);

  const shown = logs.filter((l: any) => filter === 'all' || l.type === filter);
  const typeLabel = (type: string) =>
    type === 'error' ? t('log.typeError') : type === 'success' ? t('log.typeSuccess') : t('log.typeInfo');
  /** متن رویداد: کد ترجمه اگر باشد، وگرنه متن ذخیره‌شده. */
  const eventText = (log: any) => (log.code ? t(log.code, log.vars || undefined) : log.event || '');

  return (
    <Layout>
      <Head><title>{`M-UI — ${t('log.title')}`}</title></Head>
      <PageHead eyebrow={t('log.eyebrow')} title={t('log.title')} sub={t('log.sub')}>
        <span className="badge badge-quiet">{t('log.count', { n: shown.length })}</span>
        <select className="select" style={{ width: 150 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{t('dash.all')}</option>
          <option value="error">{t('log.typeError')}</option>
          <option value="success">{t('log.typeSuccess')}</option>
          <option value="info">{t('log.typeInfo')}</option>
        </select>
      </PageHead>

      {error && <Msg kind="err">{error}</Msg>}

      <div className="card">
        {shown.length === 0 ? (
          <Empty title={t('log.emptyTitle')} hint={t('log.emptyHint')} />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 165 }}>{t('log.colTime')}</th>
                <th style={{ width: 110 }}>{t('log.colType')}</th>
                <th style={{ width: 120 }}>{t('log.colActor')}</th>
                <th>{t('log.colEvent')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((log: any, i: number) => (
                <tr key={log._id || i}>
                  <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(log.ts || log.createdAt)}</td>
                  <td>
                    <span className="badge badge-quiet">
                      <span className={`dot ${log.type === 'error' ? 'dot-warn' : log.type === 'success' ? 'dot-on' : 'dot-off'}`} />
                      {typeLabel(log.type)}
                    </span>
                  </td>
                  <td className="muted">{log.actor || t('c.none')}</td>
                  <td>{eventText(log)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}

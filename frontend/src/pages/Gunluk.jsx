import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useLang } from '../i18n.jsx';

const PAGE_SIZE = 15;

export default function Gunluk() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { t } = useLang();

  useEffect(() => {
    api.getLogs().then((l) => setLogs(l.reverse())).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const s = search.toLowerCase();
    return logs.filter((l) => [l.Kullanici, l.Islem, l.Detay].join(' ').toLowerCase().includes(s));
  }, [logs, search]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search]);
  const visible = filtered.slice(0, visibleCount);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('log_title')}</div>
          <div className="page-sub">{t('log_sub')}</div>
        </div>
      </div>

      <div className="toolbar">
        <input className="search" placeholder={t('search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading && <div className="spinner" />}

      {!loading && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('log_col_time')}</th>
                  <th>{t('log_col_user')}</th>
                  <th>{t('log_col_action')}</th>
                  <th>{t('log_col_detail')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l, i) => (
                  <tr key={i}>
                    <td className="mono">{l.Tarih}</td>
                    <td>{l.Kullanici || '—'}</td>
                    <td><span className="badge badge-gray">{l.Islem}</span></td>
                    <td style={{ whiteSpace: 'normal' }}>{l.Detay}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4}><div className="empty-state">{t('no_results')}</div></td></tr>
                )}
              </tbody>
            </table>
          </div>

          {visibleCount < filtered.length && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                {t('btn_load_more')} ({filtered.length - visibleCount})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

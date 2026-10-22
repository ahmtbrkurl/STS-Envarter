import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useLang } from '../i18n.jsx';

const PAGE_SIZE = 10;

export default function Hareketler() {
  const [movements, setMovements] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { t } = useLang();

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.getMovements(), api.getInventory()])
      .then(([m, inv]) => { setMovements(m); setItems(inv); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Her varlik icin hareketleri kronolojik (eski->yeni) sirayla gezip, bir onceki
  // atama/hareketten bu yana kac gun gectigini hesaplar. Ilk hareket icin onceki
  // referans olarak varligin satin alma/olusturma tarihi kullanilir.
  const gapDays = useMemo(() => {
    const byAsset = {};
    const gaps = {};
    const ascending = [...movements].sort((a, b) => (a.Tarih || '').localeCompare(b.Tarih || ''));
    ascending.forEach((m) => {
      const prevMovement = byAsset[m.VarlikID];
      let prevDateStr = prevMovement ? prevMovement.Tarih : null;
      if (!prevDateStr) {
        const asset = items.find((a) => a.ID === m.VarlikID);
        prevDateStr = asset?.SatinAlmaTarihi || asset?.OlusturmaTarihi || null;
      }
      if (prevDateStr) {
        const d1 = new Date(prevDateStr);
        const d2 = new Date(m.Tarih);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          gaps[m.HareketID] = Math.max(0, Math.round((d2 - d1) / 86400000));
        }
      }
      byAsset[m.VarlikID] = m;
    });
    return gaps;
  }, [movements, items]);

  const displayMovements = useMemo(() => [...movements].reverse(), [movements]);

  const filtered = useMemo(() => {
    if (!search) return displayMovements;
    const s = search.toLowerCase();
    return displayMovements.filter((m) =>
      [m.VarlikID, m.OncekiKullanici, m.YeniKullanici, m.IslemTuru].join(' ').toLowerCase().includes(s)
    );
  }, [displayMovements, search]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search]);
  const visible = filtered.slice(0, visibleCount);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('movements_title')}</div>
          <div className="page-sub">{t('movements_sub')}</div>
        </div>
      </div>

      <div className="toolbar">
        <input className="search" placeholder={t('movements_search')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading && <div className="spinner" />}

      {error && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>⚠️ {t('error_loading_data')}: {error}</span>
            <button className="btn btn-ghost btn-sm" onClick={load}>{t('btn_retry')}</button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('col_date')}</th>
                  <th>{t('col_asset')}</th>
                  <th>{t('col_transaction')}</th>
                  <th>{t('col_prev_user')}</th>
                  <th>{t('col_new_user')}</th>
                  <th>{t('col_status_change')}</th>
                  <th>{t('movements_gap')}</th>
                  <th>{t('col_performed_by')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.HareketID} onClick={() => navigate(`/envanter/${m.VarlikID}`)}>
                    <td>{m.Tarih}</td>
                    <td className="mono">{m.VarlikID}</td>
                    <td><span className="badge badge-gray">{m.IslemTuru}</span></td>
                    <td>{m.OncekiKullanici || '—'}</td>
                    <td>{m.YeniKullanici || '—'}</td>
                    <td>{m.OncekiDurum} → {m.YeniDurum}</td>
                    <td className="mono">{gapDays[m.HareketID] !== undefined ? `${gapDays[m.HareketID]} ${t('usage_days_unit')}` : '—'}</td>
                    <td>{m.IslemYapan || '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state">{t('no_results')}</div></td></tr>
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

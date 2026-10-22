import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import { useLang } from '../i18n.jsx';
import { timestampedFilename } from '../exportUtils.js';

const EXPORT_COLUMNS = ['ID', 'Kategori', 'Marka', 'Model', 'SeriNo', 'Renk', 'AtananKisi'];

export default function MalzemeGirisCikis() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(10);
  const { t } = useLang();

  useEffect(() => {
    api.getInventory().then(setItems).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((a) => [a.ID, a.Marka, a.Model, a.SeriNo, a.AtananKisi].join(' ').toLowerCase().includes(s));
  }, [items, search]);

  useEffect(() => { setVisibleCount(10); }, [search]);
  const visible = filtered.slice(0, visibleCount);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === visible.length ? new Set() : new Set(visible.map((a) => a.ID))));
  }

  const [exportError, setExportError] = useState('');

  function exportExcel() {
    setExportError('');
    try {
      const chosen = items.filter((a) => selected.has(a.ID));
      const exportLabels = {
        ID: t('col_id'), Kategori: t('col_category'), Marka: t('col_brand'), Model: t('col_model'),
        SeriNo: t('col_serial'), Renk: t('col_color'), AtananKisi: t('col_assigned')
      };
      const rows = chosen.map((a) => {
        const row = {};
        EXPORT_COLUMNS.forEach((c) => { row[exportLabels[c]] = a[c] || ''; });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = EXPORT_COLUMNS.map(() => ({ wch: 20 }));
      const wb = XLSX.utils.book_new();
      // Excel sayfa adlarinda : \ / ? * [ ] karakterleri yasaktir - "Malzeme Giris/Cikis"
      // gibi baslikta "/" oldugu icin export sessizce hata veriyordu, bu yuzden temizliyoruz.
      const safeSheetName = t('nav_stock').replace(/[\\/:*?"<>[\]]/g, '-').slice(0, 31) || 'Sayfa1';
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      XLSX.writeFile(wb, timestampedFilename(t('nav_stock'), 'xlsx'));
    } catch (err) {
      setExportError('Export hatasi: ' + err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('stock_title')}</div>
          <div className="page-sub">{t('stock_sub')}</div>
        </div>
        <button className="btn btn-primary" onClick={exportExcel} disabled={selected.size === 0}>
          {t('btn_export_excel')} ({selected.size})
        </button>
      </div>

      {exportError && <div className="error-text" style={{ marginBottom: 12 }}>{exportError}</div>}

      <div className="toolbar">
        <input className="search" placeholder={t('search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="toolbar-spacer" />
        <span className="page-sub">{selected.size} {t('stock_selected')} / {filtered.length} {t('stock_results')}</span>
      </div>

      {loading && <div className="spinner" />}

      {!loading && (
        <>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={visible.length > 0 && selected.size === visible.length} onChange={toggleAll} />
                </th>
                <th>{t('col_id')}</th>
                <th>{t('col_brand')}</th>
                <th>{t('col_model')}</th>
                <th>{t('col_serial')}</th>
                <th>{t('col_color')}</th>
                <th>{t('col_status')}</th>
                <th>{t('col_assigned')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.ID} onClick={() => toggle(a.ID)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(a.ID)} onChange={() => toggle(a.ID)} />
                  </td>
                  <td className="mono">{a.ID}</td>
                  <td>{a.Marka}</td>
                  <td>{a.Model}</td>
                  <td className="mono">{a.SeriNo || '—'}</td>
                  <td>{a.Renk || '—'}</td>
                  <td><StatusBadge status={a.Durum} /></td>
                  <td>{a.AtananKisi || '—'}</td>
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
            <button className="btn btn-ghost" onClick={() => setVisibleCount((c) => c + 10)}>
              {t('btn_load_more')} ({filtered.length - visibleCount})
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}

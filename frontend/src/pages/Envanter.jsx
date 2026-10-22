import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import AssetForm from './AssetForm.jsx';
import { useLang, translateStatus, translateCategory } from '../i18n.jsx';
import { timestampedFilename, downloadCsv, excelSafeText } from '../exportUtils.js';
import { exportManagementReport } from '../managementReport.js';
import { buildNetworkDiagramHtml, downloadNetworkDiagram } from '../networkDiagram.js';

const PAGE_SIZE = 10;

export default function Envanter() {
  const [items, setItems] = useState([]);
  const [lists, setLists] = useState({});
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [markaFilter, setMarkaFilter] = useState('');
  const [atananFilter, setAtananFilter] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { lang, t } = useLang();

  function load() {
    setLoading(true);
    Promise.all([api.getInventory(), api.getLists(), api.getEmployees()])
      .then(([inv, l, emp]) => {
        setItems(inv);
        setLists(l);
        setEmployees(emp);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (statusFilter && a.Durum !== statusFilter) return false;
      if (locationFilter && a.Lokasyon !== locationFilter) return false;
      if (kategoriFilter && a.Kategori !== kategoriFilter) return false;
      if (markaFilter && a.Marka !== markaFilter) return false;
      if (atananFilter && a.AtananKisi !== atananFilter) return false;
      if (ownershipFilter === 'yes' && !a.AtananKisi) return false;
      if (ownershipFilter === 'no' && a.AtananKisi) return false;
      if (dateFrom && a.SatinAlmaTarihi && a.SatinAlmaTarihi < dateFrom) return false;
      if (dateTo && a.SatinAlmaTarihi && a.SatinAlmaTarihi > dateTo) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [a.ID, a.Kategori, a.Marka, a.Model, a.SeriNo, a.AtananKisi, a.Hostname, a.MAC, a.IPAdresi, a.LokasyonDetay].join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter, locationFilter, kategoriFilter, markaFilter, atananFilter, ownershipFilter, dateFrom, dateTo]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, statusFilter, locationFilter, kategoriFilter, markaFilter, atananFilter, ownershipFilter, dateFrom, dateTo]);

  const visible = filtered.slice(0, visibleCount);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === visible.length ? new Set() : new Set(visible.map((a) => a.ID))));
  }

  function printSelectedQr() {
    const chosen = items.filter((a) => selected.has(a.ID));
    navigate('/envanter/qr-yazdir', { state: { assets: chosen } });
  }

  function exportCsv() {
    const headerKeys = Object.keys(items[0] || {});
    const labelMap = {
      ID: t('col_id'), Kategori: t('col_category'), Marka: t('col_brand'), Model: t('col_model'),
      SeriNo: t('col_serial'), Renk: t('col_color'), Hostname: t('col_hostname'), MAC: t('col_mac'),
      IPAdresi: t('col_ip'), Durum: t('col_status'), Lokasyon: t('col_location'), AtananKisi: t('col_assigned'),
      Tedarikci: t('col_supplier'), Fiyat: t('col_price'), ParaBirimi: t('col_currency'), FiyatUSD: t('col_price_usd'),
      GarantiBitisTarihi: t('col_warranty'), Notlar: t('col_notes')
    };
    const headers = headerKeys.map((h) => labelMap[h] || h);
    const TEXT_SAFE_COLS = ['SeriNo', 'MAC', 'IPAdresi', 'Hostname', 'ID'];
    const rows = filtered.map((row) => headerKeys.map((h) => {
      if (h === 'Durum') return translateStatus(row[h], lang);
      if (h === 'Kategori') return translateCategory(row[h], lang);
      if (TEXT_SAFE_COLS.includes(h) && row[h]) return excelSafeText(row[h]);
      return row[h] ?? '';
    }));
    const csv = Papa.unparse({ fields: headers, data: rows });
    downloadCsv(csv, timestampedFilename(t('nav_inventory'), 'csv'));
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  const [mgmtReportLoading, setMgmtReportLoading] = useState(false);
  async function handleManagementReport() {
    setMgmtReportLoading(true);
    try {
      const [needs, rates] = await Promise.all([api.getNeeds(), api.getCurrentRates()]);
      await exportManagementReport({ items, needs, employees, rates, t, lang, translateCategory, translateStatus });
    } catch (e) {
      alert(t('mgmt_report_title') + ': ' + e.message);
    } finally {
      setMgmtReportLoading(false);
    }
  }

  const [diagramLoading, setDiagramLoading] = useState(false);
  async function handleNetworkDiagram() {
    setDiagramLoading(true);
    try {
      const [vlanRows, portRows] = await Promise.all([
        api.getNetworkRows('vlan').catch(() => []),
        api.getNetworkRows('port').catch(() => [])
      ]);
      const html = buildNetworkDiagramHtml({ items, vlanRows, portRows, title: t('net_diagram_title'), t, lang });
      downloadNetworkDiagram(html, timestampedFilename(t('net_diagram_title'), 'html'));
    } catch (e) {
      alert(t('net_diagram_title') + ': ' + e.message);
    } finally {
      setDiagramLoading(false);
    }
  }

  function clearFilters() {
    setSearch(''); setStatusFilter(''); setLocationFilter(''); setKategoriFilter('');
    setMarkaFilter(''); setAtananFilter(''); setOwnershipFilter(''); setDateFrom(''); setDateTo('');
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await api.importAssets(results.data);
          setImportMsg(res.message + (res.errors?.length ? ` (${res.errors.length} hata)` : ''));
          load();
        } catch (err) {
          setImportMsg('Hata: ' + err.message);
        } finally {
          setImporting(false);
          e.target.value = '';
        }
      },
      error: (err) => {
        setImportMsg('Dosya okunamadi: ' + err.message);
        setImporting(false);
      }
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('nav_inventory')}</div>
          <div className="page-sub">{items.length}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {selected.size > 0 && (
            <button className="btn btn-ghost" onClick={printSelectedQr}>{t('detail_qr')} ({selected.size})</button>
          )}
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleImportFile} />
          <button className="btn btn-ghost" onClick={handleImportClick} disabled={importing}>
            {importing ? '...' : t('btn_import_csv')}
          </button>
          <button className="btn btn-ghost" onClick={exportCsv}>{t('btn_export_csv')}</button>
          <button className="btn btn-ghost" onClick={handleManagementReport} disabled={mgmtReportLoading}>
            {mgmtReportLoading ? '...' : `📊 ${t('mgmt_report_title')}`}
          </button>
          <button className="btn btn-ghost" onClick={handleNetworkDiagram} disabled={diagramLoading}>
            {diagramLoading ? '...' : `🗺️ ${t('net_diagram_title')}`}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ {t('btn_add')}</button>
        </div>
      </div>

      {importMsg && <div className="card card-pad" style={{ marginBottom: 14, fontSize: 13 }}>{importMsg}</div>}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('filter_toolbar_title')}</span>
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>{t('btn_clear_filters')}</button>
        </div>
        <div className="form-grid">
          <div className="field full">
            <label>{t('search_placeholder')}</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_placeholder')} />
          </div>
          <div className="field">
            <label>{t('col_status')}</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('all')}</option>
              {(lists.Durum || []).map((d) => <option key={d} value={d}>{translateStatus(d, lang)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('col_category')}</label>
            <select value={kategoriFilter} onChange={(e) => setKategoriFilter(e.target.value)}>
              <option value="">{t('all')}</option>
              {(lists.Kategori || []).map((k) => <option key={k} value={k}>{translateCategory(k, lang)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('col_location')}</label>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">{t('all')}</option>
              {(lists.Lokasyon || []).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('col_brand')}</label>
            <select value={markaFilter} onChange={(e) => setMarkaFilter(e.target.value)}>
              <option value="">{t('all')}</option>
              {(lists.Marka || []).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('col_assigned')}</label>
            <select value={atananFilter} onChange={(e) => setAtananFilter(e.target.value)}>
              <option value="">{t('all')}</option>
              {employees.map((e) => <option key={e.AdSoyad} value={e.AdSoyad}>{e.AdSoyad}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('filter_ownership')}</label>
            <select value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value)}>
              <option value="">{t('all')}</option>
              <option value="yes">{t('filter_ownership_yes')}</option>
              <option value="no">{t('filter_ownership_no')}</option>
            </select>
          </div>
          <div className="field">
            <label>{t('filter_date_from')}</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('filter_date_to')}</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="page-sub" style={{ marginTop: 4 }}>{filtered.length} / {items.length}</div>
      </div>

      {loading && <div className="spinner" />}
      {error && <div className="empty-state">Hata: {error}</div>}

      {!loading && !error && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input type="checkbox" checked={visible.length > 0 && selected.size === visible.length} onChange={toggleSelectAll} />
                  </th>
                  <th>{t('col_id')}</th>
                  <th>{t('col_category')}</th>
                  <th>{t('col_brand_model')}</th>
                  <th>{t('col_serial')}</th>
                  <th>{t('col_status')}</th>
                  <th>{t('col_location')}</th>
                  <th>{t('col_assigned')}</th>
                  <th>{t('col_hostname')}</th>
                  <th>{t('col_ip')}</th>
                  <th>{t('col_price')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.ID}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(a.ID)} onChange={() => toggleSelect(a.ID)} />
                    </td>
                    <td className="mono" onClick={() => navigate(`/envanter/${a.ID}`)}>{a.ID}</td>
                    <td onClick={() => navigate(`/envanter/${a.ID}`)}>{translateCategory(a.Kategori, lang)}</td>
                    <td onClick={() => navigate(`/envanter/${a.ID}`)}>{a.Marka} {a.Model}</td>
                    <td className="mono" onClick={() => navigate(`/envanter/${a.ID}`)}>{a.SeriNo || '—'}</td>
                    <td onClick={() => navigate(`/envanter/${a.ID}`)}><StatusBadge status={a.Durum} lang={lang} /></td>
                    <td onClick={() => navigate(`/envanter/${a.ID}`)}>{a.Lokasyon}{a.LokasyonDetay ? ` — ${a.LokasyonDetay}` : ''}</td>
                    <td onClick={() => navigate(`/envanter/${a.ID}`)}>{a.AtananKisi || '—'}</td>
                    <td className="mono" onClick={() => navigate(`/envanter/${a.ID}`)}>{a.Hostname || '—'}</td>
                    <td className="mono" onClick={() => navigate(`/envanter/${a.ID}`)}>{a.IPAdresi || '—'}</td>
                    <td className="mono" onClick={() => navigate(`/envanter/${a.ID}`)}>{a.Fiyat ? `${a.Fiyat} ${a.ParaBirimi || ''}` : '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10}><div className="empty-state">{t('no_results')}</div></td></tr>
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

      {showForm && (
        <AssetForm
          lists={lists}
          employees={employees}
          allItems={items}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

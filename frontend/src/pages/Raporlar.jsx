import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang, translateStatus, translateCategory } from '../i18n.jsx';
import { timestampedFilename, downloadCsv } from '../exportUtils.js';
import { exportManagementReport } from '../managementReport.js';

const ALL_SECTIONS = ['durum', 'kategori', 'lokasyon', 'marka', 'butce', 'garanti', 'calisan', 'sahiplik', 'ihtiyac', 'hareketler'];
const CHART_COLORS = ['#2E7D6B', '#1E3A52', '#B4720B', '#6B7280', '#7C9CBF', '#B23A34'];
const LOCALE_MAP = { tr: 'tr-TR', ru: 'ru-RU', en: 'en-US' };

export default function Raporlar() {
  const [urlParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [lists, setLists] = useState({});
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const { lang, t } = useLang();
  const { userName } = useAuth();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [lokasyonFilter, setLokasyonFilter] = useState('');
  const [durumFilter, setDurumFilter] = useState('');
  const [markaFilter, setMarkaFilter] = useState('');
  const [atananFilter, setAtananFilter] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState('');
  const [warrantyDays, setWarrantyDays] = useState(30);
  // Sahiplik raporu artik BIRDEN FAZLA panel destekler (orn. "Bilgisayari Olmayanlar",
  // "Monitoru Olmayanlar", "Telefonu Olanlar" ayni raporda yan yana).
  const [ownershipPanels, setOwnershipPanels] = useState([]);
  const [ownershipGroupBy, setOwnershipGroupBy] = useState('isim'); // 'isim' | 'departman'
  const [sections, setSections] = useState(new Set(ALL_SECTIONS));

  useEffect(() => {
    Promise.all([api.getInventory(), api.getMovements(), api.getEmployees(), api.getLists(), api.getNeeds()])
      .then(([inv, mv, emp, l, nd]) => {
        setItems(inv); setMovements(mv); setEmployees(emp); setLists(l); setNeeds(nd);
        const initialKategori = urlParams.get('kategori');
        setOwnershipPanels([{
          id: 'p1',
          label: t('report_ownership'),
          kategoriler: new Set(initialKategori ? [initialKategori] : (l.Kategori?.[0] ? [l.Kategori[0]] : []))
        }]);
      })
      .finally(() => setLoading(false));
    api.getCurrentRates().then(setRates).catch(() => {});
  }, []);

  function addOwnershipPanel() {
    setOwnershipPanels((prev) => [...prev, { id: 'p' + Date.now(), label: '', kategoriler: new Set() }]);
  }

  function handlePrint() {
    // Tarayicilar "PDF olarak kaydet" dedigimizde document.title'i dosya adi olarak onerir.
    // Dil + tarih + saat icerecek sekilde ayarlayip yazdirdiktan sonra eski basliga donduruyoruz.
    const original = document.title;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    document.title = `BT_Varlik_Raporu_${lang.toUpperCase()}_${stamp}`;
    window.print();
    setTimeout(() => { document.title = original; }, 1000);
  }

  function removeOwnershipPanel(id) {
    setOwnershipPanels((prev) => prev.filter((p) => p.id !== id));
  }

  function updateOwnershipPanel(id, patch) {
    setOwnershipPanels((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function computeOwnership(kategoriler) {
    const activeEmployees = employees.filter((e) => (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && !e.ITMuaf && (!e.Firma || e.Firma === 'STS-Akkuyu'));
    const hasIt = new Set(items.filter((a) => kategoriler.has(a.Kategori) && a.AtananKisi).map((a) => a.AtananKisi));
    const withIt = activeEmployees.filter((e) => hasIt.has(e.AdSoyad));
    const withoutIt = activeEmployees.filter((e) => !hasIt.has(e.AdSoyad));
    const depts = {};
    activeEmployees.forEach((e) => {
      const dept = e.Departman || t('report_no_department');
      if (!depts[dept]) depts[dept] = { total: 0, has: 0 };
      depts[dept].total++;
      if (hasIt.has(e.AdSoyad)) depts[dept].has++;
    });
    const byDept = Object.entries(depts).sort((a, b) => (b[1].total - b[1].has) - (a[1].total - a[1].has));
    return { withIt, withoutIt, byDept };
  }

  function toggleSection(s) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  const filteredItems = useMemo(() => {
    return items.filter((a) => {
      if (kategoriFilter && a.Kategori !== kategoriFilter) return false;
      if (lokasyonFilter && a.Lokasyon !== lokasyonFilter) return false;
      if (durumFilter && a.Durum !== durumFilter) return false;
      if (markaFilter && a.Marka !== markaFilter) return false;
      if (atananFilter && a.AtananKisi !== atananFilter) return false;
      if (ownershipFilter === 'yes' && !a.AtananKisi) return false;
      if (ownershipFilter === 'no' && a.AtananKisi) return false;
      if (dateFrom && a.SatinAlmaTarihi && a.SatinAlmaTarihi < dateFrom) return false;
      if (dateTo && a.SatinAlmaTarihi && a.SatinAlmaTarihi > dateTo) return false;
      return true;
    });
  }, [items, kategoriFilter, lokasyonFilter, durumFilter, markaFilter, atananFilter, ownershipFilter, dateFrom, dateTo]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (dateFrom && m.Tarih && m.Tarih < dateFrom) return false;
      if (dateTo && m.Tarih && m.Tarih > dateTo) return false;
      return true;
    });
  }, [movements, dateFrom, dateTo]);

  const byDurum = useMemo(() => toChartData(filteredItems, 'Durum', (v) => translateStatus(v, lang)), [filteredItems, lang]);
  const byKategori = useMemo(() => toChartData(filteredItems, 'Kategori', (v) => translateCategory(v, lang)), [filteredItems, lang]);
  const byLokasyon = useMemo(() => toChartData(filteredItems, 'Lokasyon'), [filteredItems]);
  const byMarka = useMemo(() => toChartData(filteredItems, 'Marka'), [filteredItems]);

  const totalUSD = useMemo(() => {
    return filteredItems.reduce((sum, a) => sum + (a.FiyatUSD ? Number(a.FiyatUSD) : 0), 0);
  }, [filteredItems]);

  // ONEMLI: bugunun kuru DEGIL - her varligin FiyatTRY/FiyatRUB alani backend'de
  // o varligin SATIN ALMA TARIHINDEKI kuruyla hesaplanmis durumda. Ne kadar
  // harcandigini gosterir, bugunku piyasa degerini degil.
  const totalTRY = useMemo(() => {
    return filteredItems.reduce((sum, a) => sum + (a.FiyatTRY ? Number(a.FiyatTRY) : 0), 0);
  }, [filteredItems]);

  const totalRUB = useMemo(() => {
    return filteredItems.reduce((sum, a) => sum + (a.FiyatRUB ? Number(a.FiyatRUB) : 0), 0);
  }, [filteredItems]);

  const costByCategory = useMemo(() => {
    const result = {};
    filteredItems.forEach((a) => { if (a.FiyatUSD) { const k = translateCategory(a.Kategori, lang); result[k] = (result[k] || 0) + Number(a.FiyatUSD); } });
    return Object.entries(result).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [filteredItems, lang]);

  const monthlySpend = useMemo(() => {
    const result = {};
    filteredItems.forEach((a) => { if (a.FiyatUSD && a.SatinAlmaTarihi) { const month = a.SatinAlmaTarihi.slice(0, 7); result[month] = (result[month] || 0) + Number(a.FiyatUSD); } });
    return Object.entries(result).sort((a, b) => a[0].localeCompare(b[0])).map(([month, value]) => ({ month, value: Math.round(value) }));
  }, [filteredItems]);

  const warrantyList = useMemo(() => {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + Number(warrantyDays));
    return filteredItems
      .filter((a) => a.GarantiBitisTarihi)
      .filter((a) => { const d = new Date(a.GarantiBitisTarihi); return d <= cutoff; })
      .sort((a, b) => a.GarantiBitisTarihi.localeCompare(b.GarantiBitisTarihi));
  }, [filteredItems, warrantyDays]);

  const employeeAssetCounts = useMemo(() => {
    const counts = {};
    filteredItems.forEach((a) => { if (a.AtananKisi && a.AtananKisi !== 'Genel Kullanim') counts[a.AtananKisi] = (counts[a.AtananKisi] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredItems]);

  const needStats = useMemo(() => {
    const byDurum = {};
    let totalFiyat = {};
    needs.forEach((n) => {
      byDurum[n.Durum] = (byDurum[n.Durum] || 0) + 1;
      if (n.Fiyat) {
        const cur = n.ParaBirimi || 'TRY';
        totalFiyat[cur] = (totalFiyat[cur] || 0) + Number(n.Fiyat);
      }
    });
    return { byDurum, totalFiyat, total: needs.length };
  }, [needs]);

  const inUseCount = filteredItems.filter((a) => a.Durum === 'Kullanimda').length;
  const inStockCount = filteredItems.filter((a) => a.Durum === 'Stok').length;
  const generatedDate = new Date().toLocaleDateString(LOCALE_MAP[lang] || 'tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  function exportReportCsv() {
    const headerKeys = Object.keys(items[0] || {});
    const labelMap = {
      ID: t('col_id'), Kategori: t('col_category'), Marka: t('col_brand'), Model: t('col_model'),
      SeriNo: t('col_serial'), Renk: t('col_color'), Hostname: t('col_hostname'), MAC: t('col_mac'),
      IPAdresi: t('col_ip'), Durum: t('col_status'), Lokasyon: t('col_location'), AtananKisi: t('col_assigned'),
      Tedarikci: t('col_supplier'), Fiyat: t('col_price'), ParaBirimi: t('col_currency'), FiyatUSD: t('col_price_usd'),
      GarantiBitisTarihi: t('col_warranty'), Notlar: t('col_notes')
    };
    const headers = headerKeys.map((h) => labelMap[h] || h);
    const rows = filteredItems.map((row) => headerKeys.map((h) => {
      if (h === 'Durum') return translateStatus(row[h], lang);
      if (h === 'Kategori') return translateCategory(row[h], lang);
      return row[h] ?? '';
    }));
    const csv = Papa.unparse({ fields: headers, data: rows });
    downloadCsv(csv, timestampedFilename(t('nav_reports'), 'csv'));
  }

  function clearFilters() {
    setDateFrom(''); setDateTo(''); setKategoriFilter(''); setLokasyonFilter('');
    setDurumFilter(''); setMarkaFilter(''); setAtananFilter(''); setOwnershipFilter('');
  }

  const [mgmtReportLoading, setMgmtReportLoading] = useState(false);
  async function handleManagementReport() {
    setMgmtReportLoading(true);
    try {
      await exportManagementReport({ items, needs, employees, rates, t, lang, translateCategory, translateStatus });
    } catch (e) {
      alert(t('mgmt_report_title') + ': ' + e.message);
    } finally {
      setMgmtReportLoading(false);
    }
  }

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <div className="page-title">{t('nav_reports')}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={exportReportCsv}>{t('btn_export_csv')}</button>
          <button className="btn btn-primary" onClick={handleManagementReport} disabled={mgmtReportLoading}>
            📊 {mgmtReportLoading ? '...' : t('mgmt_report_button')}
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>{t('btn_print')}</button>
        </div>
      </div>

      <div className="card card-pad no-print" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginTop: 0 }}>{t('report_sections')}</div>
        <div className="chip-row">
          {ALL_SECTIONS.map((s) => (
            <label key={s} className={`badge ${sections.has(s) ? 'badge-accent' : 'badge-gray'}`} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <input type="checkbox" checked={sections.has(s)} onChange={() => toggleSection(s)} style={{ width: 'auto' }} />
              {sectionLabel(s, t)}
            </label>
          ))}
        </div>
      </div>

      <div className="card card-pad no-print" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('report_filters')}</span>
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>{t('btn_clear_filters')}</button>
        </div>
        <div className="form-grid">
          <div className="field"><label>{t('filter_date_from')}</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div className="field"><label>{t('filter_date_to')}</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <div className="field">
            <label>{t('col_category')}</label>
            <select value={kategoriFilter} onChange={(e) => setKategoriFilter(e.target.value)}>
              <option value="">{t('all')}</option>
              {(lists.Kategori || []).map((k) => <option key={k} value={k}>{translateCategory(k, lang)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('col_location')}</label>
            <select value={lokasyonFilter} onChange={(e) => setLokasyonFilter(e.target.value)}>
              <option value="">{t('all')}</option>
              {(lists.Lokasyon || []).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('col_status')}</label>
            <select value={durumFilter} onChange={(e) => setDurumFilter(e.target.value)}>
              <option value="">{t('all')}</option>
              {(lists.Durum || []).map((d) => <option key={d} value={d}>{translateStatus(d, lang)}</option>)}
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
          <div className="field"><label>{t('report_warranty_soon')} (gun)</label><input type="number" value={warrantyDays} onChange={(e) => setWarrantyDays(e.target.value)} /></div>
        </div>
      </div>

      <div className="report-doc-v2">
        <div className="report-hero">
          <div className="company">Sovremenniye Truboprovodniye Sistemleri Ltd. Sti.</div>
          <div className="company-sub">Rusya Federasyonu Mersin Merkez Subesi</div>
          <h1>{t('report_title')}</h1>
          <div className="meta-row">
            <div className="meta-item">{t('report_generated')}<strong>{generatedDate}</strong></div>
            <div className="meta-item">{t('report_prepared_by')}<strong>{userName || '—'}</strong></div>
            <div className="meta-item">{t('report_asset_count')}<strong>{filteredItems.length} {t('report_assets')}</strong></div>
            {(dateFrom || dateTo) && (
              <div className="meta-item">{t('report_period')}<strong>{dateFrom || '…'} → {dateTo || '…'}</strong></div>
            )}
          </div>
        </div>

        <div className="report-body">
          <div className="report-kpi-grid">
            <div className="report-kpi primary">
              <div className="icon">📦</div>
              <div className="label">{t('report_total_assets')}</div>
              <div className="value">{filteredItems.length}</div>
            </div>
            <div className="report-kpi">
              <div className="icon">✅</div>
              <div className="label">{t('report_in_use')}</div>
              <div className="value">{inUseCount}</div>
            </div>
            <div className="report-kpi gray">
              <div className="icon">🗄</div>
              <div className="label">{t('report_in_stock')}</div>
              <div className="value">{inStockCount}</div>
            </div>
            <div className="report-kpi amber">
              <div className="icon">⚠️</div>
              <div className="label">{t('report_warranty_soon')}</div>
              <div className="value">{warrantyList.length}</div>
            </div>
            {totalUSD > 0 && (
              <div className="report-kpi primary">
                <div className="icon">💰</div>
                <div className="label">{t('report_budget_total')} (USD)</div>
                <div className="value">${Number(totalUSD).toLocaleString('tr-TR')}</div>
              </div>
            )}
          </div>

          {(sections.has('durum') || sections.has('kategori')) && (
            <>
              <div className="report-section-heading">📊 {t('report_status_dist')} / {t('report_category_dist')}</div>
              <div className="report-section-grid-v2">
                {sections.has('durum') && (
                  <div className="report-card">
                    <div className="report-card-title">{t('report_status_dist')}</div>
                    <ChartBar data={byDurum} color={CHART_COLORS[0]} />
                  </div>
                )}
                {sections.has('kategori') && (
                  <div className="report-card">
                    <div className="report-card-title">{t('report_category_dist')}</div>
                    <ChartBar data={byKategori} color={CHART_COLORS[1]} />
                  </div>
                )}
              </div>
            </>
          )}

          {(sections.has('lokasyon') || sections.has('marka')) && (
            <>
              <div className="report-section-heading">📍 {t('report_location_dist')} / {t('report_brand_dist')}</div>
              <div className="report-section-grid-v2">
                {sections.has('lokasyon') && (
                  <div className="report-card">
                    <div className="report-card-title">{t('report_location_dist')}</div>
                    <ChartBar data={byLokasyon} color={CHART_COLORS[2]} />
                  </div>
                )}
                {sections.has('marka') && (
                  <div className="report-card">
                    <div className="report-card-title">{t('report_brand_dist')}</div>
                    <ChartBar data={byMarka} color={CHART_COLORS[3]} />
                  </div>
                )}
              </div>
            </>
          )}

          {sections.has('butce') && (
            <>
              <div className="report-section-heading">💰 {t('report_budget_total')} (TCMB kuruyla, satin alma tarihi bazli)</div>
              <div className="report-card" style={{ marginBottom: 14 }}>
                <div className="page-sub" style={{ marginBottom: 12 }}>{t('budget_calc_note')}</div>
                <div className="budget-currency-wrap">
                  <table className="budget-currency-table">
                    <thead>
                      <tr><th></th><th>USD</th><th>TRY</th><th>RUB</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{t('kdv_haric_label')}</td>
                        <td>${totalUSD.toLocaleString('tr-TR')}</td>
                        <td>₺{totalTRY.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                        <td>₽{totalRUB.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                      </tr>
                      <tr className="budget-row-kdv">
                        <td>{t('kdv_dahil_label')} (%20)</td>
                        <td>${(totalUSD * 1.2).toLocaleString('tr-TR')}</td>
                        <td>₺{(totalTRY * 1.2).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                        <td>₽{(totalRUB * 1.2).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="report-section-grid-v2">
                {costByCategory.length > 0 && (
                  <div className="report-card">
                    <div className="report-card-title">{t('report_budget_category')} (USD)</div>
                    <ChartBar data={costByCategory} color={CHART_COLORS[0]} />
                  </div>
                )}
              </div>
              {monthlySpend.length > 1 && (
                <div className="report-card" style={{ marginTop: 14 }}>
                  <div className="report-card-title">{t('report_budget_trend')}</div>
                  <div style={{ width: '100%', height: 180 }}>
                    <ResponsiveContainer>
                      <LineChart data={monthlySpend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}

          {sections.has('garanti') && (
            <>
              <div className="report-section-heading">⚠️ {t('report_warranty_list')}</div>
              {warrantyList.length === 0 ? (
                <div className="report-empty">{t('report_no_warranty')}</div>
              ) : (
                <table className="report-table">
                  <thead><tr><th>{t('col_id')}</th><th>{t('col_brand_model')}</th><th>{t('col_assigned')}</th><th>{t('col_warranty')}</th></tr></thead>
                  <tbody>
                    {warrantyList.map((a) => (
                      <tr key={a.ID}>
                        <td className="mono">{a.ID}</td>
                        <td>{a.Marka} {a.Model}</td>
                        <td>{a.AtananKisi || '—'}</td>
                        <td className="mono">{a.GarantiBitisTarihi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {(sections.has('calisan') || sections.has('sahiplik')) && (
            <>
              <div className="report-section-heading">👥 {t('report_per_employee')} / {t('report_ownership')}</div>
              <div className="report-section-grid-v2">
                {sections.has('calisan') && (
                  <div className="report-card">
                    <div className="report-card-title">{t('report_per_employee')}</div>
                    {employeeAssetCounts.length === 0 ? <div className="report-empty">—</div> : (
                      <table className="report-table">
                        <thead><tr><th>{t('report_owner_count')}</th><th style={{ textAlign: 'right' }}>{t('report_asset_count')}</th></tr></thead>
                        <tbody>
                          {employeeAssetCounts.map(([name, count]) => (
                            <tr key={name}><td>{name}</td><td className="mono" style={{ textAlign: 'right' }}>{count}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {sections.has('sahiplik') && (
                <>
                  <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 6px' }}>
                    <select
                      value={ownershipGroupBy}
                      onChange={(e) => setOwnershipGroupBy(e.target.value)}
                      style={{ padding: '3px 6px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border)' }}
                    >
                      <option value="isim">{t('report_group_by_name')}</option>
                      <option value="departman">{t('report_group_by_dept')}</option>
                    </select>
                    <button className="btn btn-ghost btn-sm" onClick={addOwnershipPanel}>+ {t('report_add_ownership_panel')}</button>
                  </div>

                  <div className="report-section-grid-v2">
                    {ownershipPanels.map((panel) => {
                      const own = computeOwnership(panel.kategoriler);
                      const selectedLabels = [...panel.kategoriler].map((k) => translateCategory(k, lang)).join(', ');
                      return (
                        <div className="report-card" key={panel.id}>
                          <div className="report-card-title no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              value={panel.label}
                              placeholder={t('report_ownership_panel_label_ph')}
                              onChange={(e) => updateOwnershipPanel(panel.id, { label: e.target.value })}
                              style={{ flex: 1, fontSize: 13, fontWeight: 700, border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}
                            />
                            {ownershipPanels.length > 1 && (
                              <button className="btn btn-ghost btn-sm" onClick={() => removeOwnershipPanel(panel.id)}>✕</button>
                            )}
                          </div>

                          {/* Yazdirilan/PDF ciktisinda GORUNUR baslik - hangi kriterle olusturuldugunu okuyan anlasin */}
                          <div className="report-card-title" style={{ marginTop: 0 }}>
                            {panel.label || t('report_ownership')}
                          </div>
                          <div className="page-sub" style={{ marginBottom: 10 }}>
                            {t('report_ownership_criteria_prefix')}: <strong>{selectedLabels || '—'}</strong>
                            {panel.kategoriler.size > 1 && ` (${t('report_ownership_any_of')})`}
                          </div>

                          <div className="no-print chip-row" style={{ marginBottom: 12 }}>
                            {(lists.Kategori || []).map((k) => (
                              <label
                                key={k}
                                className={`badge ${panel.kategoriler.has(k) ? 'badge-accent' : 'badge-gray'}`}
                                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={panel.kategoriler.has(k)}
                                  onChange={() => {
                                    const next = new Set(panel.kategoriler);
                                    if (next.has(k)) next.delete(k); else next.add(k);
                                    updateOwnershipPanel(panel.id, { kategoriler: next });
                                  }}
                                  style={{ width: 'auto' }}
                                />
                                {translateCategory(k, lang)}
                              </label>
                            ))}
                          </div>

                          {ownershipGroupBy === 'isim' ? (
                            <div className="two-col">
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>✓ {t('report_has_it')} ({own.withIt.length})</div>
                                <div className="report-ownership-list">
                                  {own.withIt.length === 0 && <div className="report-empty">—</div>}
                                  {own.withIt.map((e) => <div key={e.AdSoyad} className="report-ownership-item">{e.AdSoyad}</div>)}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>✕ {t('report_missing_it')} ({own.withoutIt.length})</div>
                                <div className="report-ownership-list">
                                  {own.withoutIt.length === 0 && <div className="report-empty">—</div>}
                                  {own.withoutIt.map((e) => <div key={e.AdSoyad} className="report-ownership-item">{e.AdSoyad}</div>)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <table className="report-table">
                              <thead>
                                <tr>
                                  <th>{t('col_department')}</th>
                                  <th style={{ textAlign: 'right' }}>{t('report_dept_total')}</th>
                                  <th style={{ textAlign: 'right' }}>{t('report_has_it')}</th>
                                  <th style={{ textAlign: 'right' }}>{t('report_missing_it')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {own.byDept.map(([dept, d]) => (
                                  <tr key={dept}>
                                    <td>{dept}</td>
                                    <td className="mono" style={{ textAlign: 'right' }}>{d.total}</td>
                                    <td className="mono" style={{ textAlign: 'right', color: 'var(--accent)' }}>{d.has}</td>
                                    <td className="mono" style={{ textAlign: 'right', color: d.total - d.has > 0 ? 'var(--red)' : 'inherit', fontWeight: d.total - d.has > 0 ? 700 : 400 }}>{d.total - d.has}</td>
                                  </tr>
                                ))}
                                {own.byDept.length === 0 && <tr><td colSpan={4} className="report-empty">—</td></tr>}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {sections.has('ihtiyac') && (
            <>
              <div className="report-section-heading">📋 {t('nav_needs')} ({needStats.total})</div>
              <div className="report-section-grid-v2">
                <div className="report-card">
                  <div className="report-card-title">{t('report_needs_by_status')}</div>
                  {Object.keys(needStats.byDurum).length === 0 ? <div className="report-empty">—</div> : (
                    <table className="report-table">
                      <tbody>
                        {Object.entries(needStats.byDurum).map(([durum, count]) => (
                          <tr key={durum}><td>{translateStatus(durum, lang)}</td><td className="mono" style={{ textAlign: 'right' }}>{count}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="report-card">
                  <div className="report-card-title">{t('report_needs_budget')}</div>
                  {Object.keys(needStats.totalFiyat).length === 0 ? <div className="report-empty">{t('report_no_price')}</div> : (
                    <table className="report-table">
                      <tbody>
                        {Object.entries(needStats.totalFiyat).map(([cur, val]) => (
                          <tr key={cur}><td>{cur}</td><td className="mono" style={{ textAlign: 'right' }}>{Number(val).toLocaleString('tr-TR')}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {sections.has('hareketler') && (
            <>
              <div className="report-section-heading">⇄ {t('report_movements')} ({filteredMovements.length})</div>
              {filteredMovements.length === 0 ? (
                <div className="report-empty">{t('report_no_movements')}</div>
              ) : (
                <table className="report-table">
                  <thead><tr><th>{t('col_date')}</th><th>{t('col_asset')}</th><th>{t('col_transaction')}</th><th>{t('col_prev_user')}</th><th>{t('col_new_user')}</th></tr></thead>
                  <tbody>
                    {filteredMovements.slice(0, 20).map((m) => (
                      <tr key={m.HareketID}>
                        <td className="mono">{m.Tarih}</td>
                        <td className="mono">{m.VarlikID}</td>
                        <td>{m.IslemTuru}</td>
                        <td>{m.OncekiKullanici || '—'}</td>
                        <td>{m.YeniKullanici || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function sectionLabel(s, t) {
  const map = {
    durum: t('report_status_dist'), kategori: t('report_category_dist'), lokasyon: t('report_location_dist'),
    marka: t('report_brand_dist'), butce: t('report_budget_total'), garanti: t('report_warranty_list'),
    calisan: t('report_per_employee'), sahiplik: t('report_ownership'), ihtiyac: t('nav_needs'), hareketler: t('report_movements')
  };
  return map[s] || s;
}

function ChartBar({ data, color }) {
  if (data.length === 0) return <div className="report-empty">—</div>;
  return (
    <div style={{ width: '100%', height: Math.max(100, data.length * 28) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
          <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" fill={color || '#2E7D6B'} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function toChartData(items, field, translate) {
  const counts = {};
  items.forEach((a) => {
    const raw = a[field];
    const name = translate ? translate(raw) : raw;
    counts[name] = (counts[name] || 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

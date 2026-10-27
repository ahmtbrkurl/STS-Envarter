import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { api } from '../api';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang, translateCategory } from '../i18n.jsx';
import { timestampedFilename, downloadCsv, excelSafeText } from '../exportUtils.js';
import {
  ODEME_DURUMU_OPTIONS, odemeDurumuLabel, odemeBadgeClass, fileToBase64, splitLinks,
  buildFaturaMap, faturaLabel, effectiveDocs
} from '../faturaUtils.js';

const PAGE_SIZE = 10;
import { PRE_ORDER, ORDERED_OPEN, OPEN_NEED, PLAN_STATUS_TEXT } from '../needStatus.js';
const STATUS_TABS = ['Bekleniyor', 'Onaylandi', 'Siparis Verildi', 'Yolda', 'KismenAlindi', 'Karsilandi', 'Iptal', 'Hepsi'];

// Aylik Satin Alma Plani ozelligi, satin alma sefinin GERCEK sablon dosyasini
// (frontend/public/templates/plan_zakupok_sablon.xlsx) baz alir - sadece hucre
// DEGERLERINI doldurur, tum renk/font/kenarlik/birlestirme/formul aynen kalir.
// NOT: Mutlak "/templates/..." yolu GitHub Pages gibi alt klasorde barinan
// sitelerde domain KOKUNE bakar, siteye degil - bu yuzden import.meta.env.BASE_URL
// ile projenin gercek yayin yoluna (orn. /STS-Envarter/) gore olusturuyoruz.
const PLAN_TEMPLATE_URL = `${import.meta.env.BASE_URL}templates/plan_zakupok_sablon.xlsx`;
const PLAN_SHEET_NAME = 'План закупок';
const PLAN_FIRST_DATA_ROW = 5;

const DURUM_MAP = {
  ...PLAN_STATUS_TEXT,
  Iptal: 'Отменено / İptal edildi',
  EnvanterFiyatsiz: 'Уже в наличии - цена неизвестна / Envanterde kayıtlı - fiyat bilinmiyor'
};

// Aylik Satin Alma Plani exportundaki Not (O) sutununa eklenecek odeme durumu
// metni - ODEME_DURUMU_OPTIONS ile ayni 3 secenek, RU/TR birlikte.
const ODEME_DURUMU_EXPORT_MAP = {
  TeklifFiyat: 'Ценовое предложение / Teklif Fiyat',
  Odenmedi: 'Не оплачено / Ödenmedi',
  KismenOdendi: 'Частично оплачено / Kısmen ödendi',
  Odendi: 'Оплачено / Ödendi'
};

const MONTH_NAMES_TR = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
const MONTH_NAMES_RU = ['ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ', 'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'];

const NEED_HEADERS = ['ID', 'PersonelAdi', 'Departman', 'PlanlananTarih', 'Kategori', 'Marka', 'MalzemeAdi', 'Aciklama', 'Fiyat', 'ParaBirimi', 'Tedarikci', 'SiparisTarihi', 'Durum', 'BaglantiliVarlikID', 'TahminiTeslimatTarihi', 'KargoFirmasi', 'KargoTakipNo', 'OdemeDurumu', 'OdemeTarihi'];

// Tarih filtresi icin satirin ilgili tarihi (YYYY-MM-DD). 'auto' = Aylik plan
// mantigi: Bekleniyor -> Planlanan Tarih, digerleri -> Siparis Tarihi.
function filterDateOf(n, basis) {
  let v;
  if (basis === 'auto') {
    v = PRE_ORDER.includes(n.Durum)
      ? (n.PlanlananTarih || n.OlusturmaTarihi)
      : (n.SiparisTarihi || n.PlanlananTarih || n.OlusturmaTarihi);
  } else v = n[basis];
  return String(v || '').slice(0, 10);
}

export default function Ihtiyaclar() {
  const [needs, setNeeds] = useState([]);
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [lists, setLists] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [fulfillTarget, setFulfillTarget] = useState(null);
  const [tab, setTab] = useState('Bekleniyor');
  const [filterPersonel, setFilterPersonel] = useState('');
  const [filterDepartman, setFilterDepartman] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterNotlar, setFilterNotlar] = useState('');
  const [filterFiyatMin, setFilterFiyatMin] = useState('');
  const [filterFiyatMax, setFilterFiyatMax] = useState('');
  const [dateBasis, setDateBasis] = useState('auto'); // auto | SiparisTarihi | PlanlananTarih | OlusturmaTarihi | OdemeTarihi
  const [filterMonth, setFilterMonth] = useState(''); // YYYY-MM
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [quickAddFor, setQuickAddFor] = useState(null); // { person, kategori, planlananTarih } - eksik panosundan/Calisanlar'dan hizli ekleme
  const location = useLocation();
  const [showPdfPicker, setShowPdfPicker] = useState(false);
  const [showPlanExport, setShowPlanExport] = useState(false);
  const [printMode, setPrintMode] = useState(null); // null | 'board' | STATUS_TABS eleman | 'Hepsi'
  const [rates, setRates] = useState(null);
  const [faturalar, setFaturalar] = useState([]);
  const [selected, setSelected] = useState(() => new Set()); // toplu "Faturaya bagla" icin secili ihtiyac ID'leri
  const [showLinkModal, setShowLinkModal] = useState(false);
  const fileInputRef = useRef(null);
  const { userName } = useAuth();
  const { lang, t } = useLang();

  function load() {
    setLoading(true);
    // Faturalar sayfasi/sekmesi henuz yoksa (eski Apps Script surumu) bile
    // Ihtiyac Listesi acilsin diye getFaturalar hatasi yutulur.
    Promise.all([api.getNeeds(), api.getInventory(), api.getEmployees(), api.getLists(), api.getFaturalar().catch(() => [])])
      .then(([n, inv, emp, l, fat]) => { setNeeds(n); setItems(inv); setEmployees(emp); setLists(l); setFaturalar(fat); })
      .finally(() => setLoading(false));
    api.getCurrentRates().then(setRates).catch(() => {});
  }

  useEffect(load, []);

  // Calisanlar sayfasindan "Bu Kisi Icin Ihtiyac Olustur" ile VEYA Gelen
  // Talepler'den "Onayla" ile gelindiyse, formu kisi + kategori + miktar +
  // aciklama onceden dolu sekilde acar.
  useEffect(() => {
    if (location.state?.quickAddPerson) {
      setQuickAddFor({
        person: location.state.quickAddPerson,
        kategori: location.state.quickAddKategori || '',
        planlananTarih: location.state.quickAddDate || '',
        aciklama: location.state.quickAddAciklama || '',
        miktar: location.state.quickAddMiktar || 1
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab, filterPersonel, filterDepartman, filterKategori, filterNotlar, filterFiyatMin, filterFiyatMax, filterMonth, filterDateFrom, filterDateTo, dateBasis]);

  const filtered = useMemo(() => needs.filter((n) => {
    if (tab !== 'Hepsi' && n.Durum !== tab) return false;
    if (filterPersonel && !(n.PersonelAdi || '').toLowerCase().includes(filterPersonel.toLowerCase())) return false;
    if (filterDepartman && n.Departman !== filterDepartman) return false;
    if (filterKategori && n.Kategori !== filterKategori) return false;
    if (filterNotlar && !(n.Aciklama || '').toLowerCase().includes(filterNotlar.toLowerCase())) return false;
    if (filterFiyatMin && Number(n.Fiyat || 0) < Number(filterFiyatMin)) return false;
    if (filterFiyatMax && Number(n.Fiyat || 0) > Number(filterFiyatMax)) return false;
    if (filterMonth || filterDateFrom || filterDateTo) {
      const d = filterDateOf(n, dateBasis);
      if (!d) return false;
      if (filterMonth && d.slice(0, 7) !== filterMonth) return false;
      if (filterDateFrom && d < filterDateFrom) return false;
      if (filterDateTo && d > filterDateTo) return false;
    }
    return true;
  }), [needs, tab, filterPersonel, filterDepartman, filterKategori, filterNotlar, filterFiyatMin, filterFiyatMax, filterMonth, filterDateFrom, filterDateTo, dateBasis]);
  const hasActiveFilters = filterPersonel || filterDepartman || filterKategori || filterNotlar || filterFiyatMin || filterFiyatMax || filterMonth || filterDateFrom || filterDateTo;
  function clearFilters() {
    setFilterPersonel(''); setFilterDepartman(''); setFilterKategori('');
    setFilterNotlar(''); setFilterFiyatMin(''); setFilterFiyatMax('');
    setFilterMonth(''); setFilterDateFrom(''); setFilterDateTo('');
  }
  const visible = filtered.slice(0, visibleCount);

  // Eksik ekipman panosu: "Bilgisayar" (Dizustu+Masaustu) ve "Monitor" grubu icin
  // aktif/beklemede calisanlardan hicbir kategoriye sahip olmayanlari bulur.
  const MISSING_GROUPS = [
    { label: 'Bilgisayar', kategoriler: ['Dizustu Bilgisayar', 'Masaustu Bilgisayar'] },
    { label: 'Monitor', kategoriler: ['Monitor'] }
  ];

  const missingBoards = useMemo(() => {
    const activeEmployees = employees.filter((e) => (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && !e.ITMuaf && (!e.Firma || e.Firma === 'STS-Akkuyu'));
    return MISSING_GROUPS.map((group) => {
      const hasIt = new Set(
        items.filter((a) => group.kategoriler.includes(a.Kategori) && a.AtananKisi).map((a) => a.AtananKisi)
      );
      const missing = activeEmployees.filter((e) => {
        if (hasIt.has(e.AdSoyad)) return false;
        const muafList = e.MuafKategoriler ? e.MuafKategoriler.split(',') : [];
        if (muafList.includes(group.label)) return false;
        return true;
      });
      return { ...group, missing };
    });
  }, [employees, items]);

  const budgetTotals = useMemo(() => {
    const totals = {};
    filtered.forEach((n) => {
      if (n.Fiyat && n.Durum !== 'Iptal') {
        const cur = n.ParaBirimi || 'TRY';
        totals[cur] = (totals[cur] || 0) + Number(n.Fiyat);
      }
    });
    return totals;
  }, [filtered]);

  // Her kaydin FiyatTRY alani, backend'de o kaydin DOGRU tarihindeki (Planlanan/
  // Siparis Tarihi) gercek TCMB kuruyla onceden hesaplanip saklanir. Burada
  // "bugunku kur" ile tekrar tahmin etmiyoruz, dogrudan toplaniyor - Envanter'in
  // genel toplamini (Panel/Raporlar) HICBIR SEKILDE etkilemez, ayri bir gostergedir.
  const budgetTotalTRY = useMemo(() => {
    let total = 0;
    filtered.forEach((n) => {
      if (n.Durum === 'Iptal' || !n.Fiyat) return;
      if (n.FiyatTRY) { total += Number(n.FiyatTRY); return; }
      // FiyatTRY henuz olusturulmadan once kaydedilmis eski kayitlar icin
      // guncel kurla kaba bir tahmin yapiyoruz.
      const cur = n.ParaBirimi || 'TRY';
      if (cur === 'TRY') total += Number(n.Fiyat);
      else if (rates && rates[cur]) total += Number(n.Fiyat) * rates[cur];
    });
    return total;
  }, [filtered, rates]);

  // Ihtiyac Listesi'ndeki kalemler henuz SATIN ALINMADI (planlanan gider), bu yuzden
  // Envanter'deki gibi "satin alma tarihindeki kur" degil, GUNCEL kur kullanilir -
  // amac "bu an itibariyle ne kadar paraya ihtiyacimiz var" sorusuna cevap vermek.
  // Bu tutar Envanter'in genel toplamini (Panel/Raporlar) HICBIR SEKILDE etkilemez,
  // sadece burada, ayri bir gosterge olarak hesaplanir.
  const needsBudgetConverted = useMemo(() => {
    if (!rates || !rates.USD) return null;
    const inTRY = budgetTotalTRY;
    return {
      usd: inTRY / rates.USD,
      try: inTRY,
      rub: rates.RUB ? inTRY / rates.RUB : null
    };
  }, [budgetTotalTRY, rates]);

  const faturaMap = useMemo(() => buildFaturaMap(faturalar), [faturalar]);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const selectableVisible = visible.filter((n) => n.Durum !== 'Iptal');
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((n) => selected.has(n.ID));
  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) selectableVisible.forEach((n) => next.delete(n.ID));
      else selectableVisible.forEach((n) => next.add(n.ID));
      return next;
    });
  }
  const selectedNeeds = needs.filter((n) => selected.has(n.ID));

  function exportCsv() {
    const labelMap = {
      ID: t('col_id'), PersonelAdi: t('needs_col_person'), Departman: t('col_department'),
      PlanlananTarih: t('needs_col_planned_date'), Kategori: t('col_category'), Marka: t('col_brand'),
      MalzemeAdi: t('sarf_col_name'), Aciklama: t('col_notes'), Fiyat: t('col_price'),
      ParaBirimi: t('col_currency'), Tedarikci: t('col_supplier'), SiparisTarihi: t('needs_col_order_date'),
      Durum: t('col_status'), BaglantiliVarlikID: t('needs_col_linked_asset'),
      TahminiTeslimatTarihi: t('needs_col_estimated_delivery'), KargoFirmasi: t('needs_col_cargo_company'),
      KargoTakipNo: t('needs_col_tracking_no'), OdemeDurumu: t('needs_col_payment_status'),
      OdemeTarihi: t('needs_col_payment_date')
    };
    const headers = NEED_HEADERS.map((h) => labelMap[h] || h).concat(t('inv_fatura_no_col'));
    const csv = Papa.unparse({
      fields: headers,
      data: filtered.map((row) => NEED_HEADERS.map((h) => {
        if (h === 'Durum') return tabLabel(row[h], t);
        if (h === 'Kategori') return translateCategory(row[h], lang);
        if (h === 'OdemeDurumu') return odemeDurumuLabel(row[h] || 'Odenmedi', lang);
        if (h === 'KargoTakipNo' && row[h]) return excelSafeText(row[h]);
        return row[h] ?? '';
      }).concat(faturaLabel(faturaMap[row.FaturaID]) || ''))
    });
    downloadCsv(csv, timestampedFilename(t('nav_needs'), 'csv'));
  }

  const PDF_VIEWS = [
    { key: 'board', label: t('needs_missing_board_title') },
    { key: 'Bekleniyor', label: tabLabel('Bekleniyor', t) },
    { key: 'Onaylandi', label: tabLabel('Onaylandi', t) },
    { key: 'Siparis Verildi', label: tabLabel('Siparis Verildi', t) },
    { key: 'Yolda', label: tabLabel('Yolda', t) },
    { key: 'KismenAlindi', label: tabLabel('KismenAlindi', t) },
    { key: 'Karsilandi', label: tabLabel('Karsilandi', t) },
    { key: 'Iptal', label: tabLabel('Iptal', t) },
    { key: 'Hepsi', label: tabLabel('Hepsi', t) }
  ];

  function doPrintPdf(mode) {
    setShowPdfPicker(false);
    if (mode !== 'board') {
      setTab(mode);
      setVisibleCount(9999); // sayfalamayi asip tum satirlari yazdir
    }
    setPrintMode(mode);
    setTimeout(() => {
      const original = document.title;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const nameMap = { board: 'Eksik_Ekipman_Panosu', Bekleniyor: 'Bekleyenler', Onaylandi: 'Onaylananlar', 'Siparis Verildi': 'Siparis_Verildi', Yolda: 'Yolda', KismenAlindi: 'Kismen_Alinanlar', Karsilandi: 'Karsilananlar', Iptal: 'Iptal_Edilenler', Hepsi: 'Ihtiyac_Listesi' };
      document.title = `${nameMap[mode] || 'Ihtiyac_Listesi'}_${lang.toUpperCase()}_${stamp}`;
      window.print();
      setTimeout(() => {
        document.title = original;
        setPrintMode(null);
        setVisibleCount(PAGE_SIZE);
      }, 800);
    }, 150);
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
          const res = await api.importNeeds(results.data);
          setImportMsg(res.message);
          load();
        } catch (err) {
          setImportMsg('Hata: ' + err.message);
        } finally {
          setImporting(false);
          e.target.value = '';
        }
      }
    });
  }

  async function cancelNeed(need) {
    if (!confirm(`${need.PersonelAdi || t('needs_stock_label')} - ${translateCategory(need.Kategori, lang)} ${t('needs_cancel')}?`)) return;
    await api.updateNeed(need.ID, { Durum: 'Iptal' });
    load();
  }

  async function markOrdered(need) {
    const date = prompt(t('needs_col_order_date') + ' (yyyy-mm-dd)', new Date().toISOString().slice(0, 10));
    if (date === null) return;
    await api.updateNeed(need.ID, { Durum: 'Siparis Verildi', SiparisTarihi: date });
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('needs_title')}</div>
          <div className="page-sub">{t('needs_sub')}</div>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleImportFile} />
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? '...' : t('btn_import_csv')}
          </button>
          <button className="btn btn-ghost" onClick={exportCsv}>{t('btn_export_csv')}</button>
          <button className="btn btn-ghost" onClick={() => setShowPdfPicker(true)}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => setShowPlanExport(true)}>📅 {t('needs_monthly_plan')}</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ {t('needs_new')}</button>
        </div>
      </div>

      {importMsg && <div className="card card-pad no-print" style={{ marginBottom: 14, fontSize: 13 }}>{importMsg}</div>}

      {Object.keys(budgetTotals).length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginTop: 0 }}>{t('needs_budget_total')}</div>
          <div className="page-sub no-print" style={{ marginBottom: 12 }}>{t('needs_budget_note')}</div>

          {needsBudgetConverted ? (
            <div className="budget-currency-wrap">
              <table className="budget-currency-table">
                <thead>
                  <tr><th></th><th>USD</th><th>TRY</th><th>RUB</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t('kdv_haric_label')}</td>
                    <td>${needsBudgetConverted.usd.toLocaleString('tr-TR')}</td>
                    <td>₺{needsBudgetConverted.try.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                    <td>{needsBudgetConverted.rub !== null ? `₽${needsBudgetConverted.rub.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '—'}</td>
                  </tr>
                  <tr className="budget-row-kdv">
                    <td>{t('kdv_dahil_label')} (%20)</td>
                    <td>${(needsBudgetConverted.usd * 1.2).toLocaleString('tr-TR')}</td>
                    <td>₺{(needsBudgetConverted.try * 1.2).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                    <td>{needsBudgetConverted.rub !== null ? `₽${(needsBudgetConverted.rub * 1.2).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="stat-grid">
              {Object.entries(budgetTotals).map(([cur, val]) => (
                <div key={cur} className="stat-card accent">
                  <div className="label">{t('needs_budget_total')} ({cur})</div>
                  <div className="value">{Number(val).toLocaleString('tr-TR')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`card card-pad ${printMode && printMode !== 'board' ? 'no-print' : ''}`} style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginTop: 0 }}>{t('needs_missing_board_title')}</div>
        <div className="page-sub" style={{ marginBottom: 12 }}>{t('needs_missing_board_desc')}</div>
        <div className="two-col">
          {missingBoards.map((board) => (
            <div key={board.label}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>
                ✕ {translateCategory(board.label, lang)} {t('report_missing_it')} ({board.missing.length})
              </div>
              {board.missing.length === 0 ? (
                <div className="page-sub">{t('needs_missing_none')}</div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {board.missing.map((e) => {
                    // Bu kisi icin bu gruptan (bilgisayar/monitor) zaten ACIK bir ihtiyac kaydi var mi?
                    const hasOpenNeed = needs.some((n) => n.PersonelAdi === e.AdSoyad && OPEN_NEED.includes(n.Durum) && board.kategoriler.includes(n.Kategori));
                    return (
                    <div key={e.AdSoyad} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                      <span>{e.AdSoyad}{e.Departman ? <span className="page-sub"> · {e.Departman}</span> : null}
                        {hasOpenNeed && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· ✓ {t('dash_already_in_needs_list')}</span>}
                      </span>
                      <button
                        className="btn btn-ghost btn-sm no-print"
                        onClick={() => setQuickAddFor({ person: e.AdSoyad, kategori: board.kategoriler[0] })}
                      >
                        + {t('needs_new')}
                      </button>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={`toolbar ${printMode === 'board' ? 'no-print' : ''}`}>
        {STATUS_TABS.map((s) => (
          <button key={s} className={`btn btn-sm ${tab === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(s)}>
            {tabLabel(s, t)}
          </button>
        ))}
      </div>

      <div className={`card card-pad ${printMode === 'board' ? 'no-print' : ''}`} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 160, marginBottom: 0 }}>
            <label>{t('needs_col_person')}</label>
            <input value={filterPersonel} onChange={(e) => setFilterPersonel(e.target.value)} placeholder={t('needs_filter_search_placeholder')} />
          </div>
          <div className="field" style={{ minWidth: 160, marginBottom: 0 }}>
            <label>{t('col_department')}</label>
            <select value={filterDepartman} onChange={(e) => setFilterDepartman(e.target.value)}>
              <option value="">{t('needs_filter_all')}</option>
              {lists.Departman?.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 160, marginBottom: 0 }}>
            <label>{t('col_category')}</label>
            <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}>
              <option value="">{t('needs_filter_all')}</option>
              {lists.Kategori?.map((k) => <option key={k} value={k}>{translateCategory(k, lang)}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 160, marginBottom: 0 }}>
            <label>{t('col_notes')}</label>
            <input value={filterNotlar} onChange={(e) => setFilterNotlar(e.target.value)} placeholder={t('needs_filter_search_placeholder')} />
          </div>
          <div className="field" style={{ minWidth: 100, marginBottom: 0 }}>
            <label>{t('col_price')} {t('needs_filter_min')}</label>
            <input type="number" value={filterFiyatMin} onChange={(e) => setFilterFiyatMin(e.target.value)} />
          </div>
          <div className="field" style={{ minWidth: 100, marginBottom: 0 }}>
            <label>{t('col_price')} {t('needs_filter_max')}</label>
            <input type="number" value={filterFiyatMax} onChange={(e) => setFilterFiyatMax(e.target.value)} />
          </div>
          <div className="field" style={{ minWidth: 150, marginBottom: 0 }}>
            <label>{t('needs_filter_date_basis')}</label>
            <select value={dateBasis} onChange={(e) => setDateBasis(e.target.value)}>
              <option value="auto">{t('needs_filter_date_auto')}</option>
              <option value="SiparisTarihi">{t('needs_col_order_date')}</option>
              <option value="PlanlananTarih">{t('needs_col_planned_date')}</option>
              <option value="OlusturmaTarihi">{t('needs_filter_date_created')}</option>
              <option value="OdemeTarihi">{t('needs_col_payment_date')}</option>
            </select>
          </div>
          <div className="field" style={{ minWidth: 140, marginBottom: 0 }}>
            <label>{t('needs_monthly_plan_month')}</label>
            <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
          </div>
          <div className="field" style={{ minWidth: 140, marginBottom: 0 }}>
            <label>{t('needs_filter_date_from')}</label>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          </div>
          <div className="field" style={{ minWidth: 140, marginBottom: 0 }}>
            <label>{t('needs_filter_date_to')}</label>
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
          </div>
          {hasActiveFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>✕ {t('needs_filter_clear')}</button>
          )}
        </div>
      </div>

      {loading && <div className="spinner" />}

      {!loading && !(printMode === 'board') && (
        <>
          {selected.size > 0 && (
            <div className="card card-pad no-print" style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span><strong>{selected.size}</strong> {t('inv_selected_lines')}</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowLinkModal(true)}>🧾 {t('inv_link_to')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>{t('inv_clear_selection')}</button>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <colgroup>
                <col className="no-print" style={{ width: '3%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '16%' }} />
                <col className="no-print" style={{ width: '4%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="no-print">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="select all" />
                  </th>
                  <th>{t('needs_col_person')}</th>
                  <th>{t('col_department')}</th>
                  <th>{t('col_category')}</th>
                  <th>{t('needs_col_planned_date')}</th>
                  <th>{t('col_notes')}</th>
                  <th>{t('col_price')}</th>
                  <th>{t('inv_col_invoice_payment')}</th>
                  <th>{t('col_status')}</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((n) => (
                  <tr key={n.ID}>
                    <td className="no-print">
                      <input type="checkbox" checked={selected.has(n.ID)} disabled={n.Durum === 'Iptal'} onChange={() => toggleSelect(n.ID)} />
                    </td>
                    <td style={{ fontWeight: 600 }}>{n.PersonelAdi || `📦 ${t('needs_stock_label')}`}</td>
                    <td>{n.Departman || '—'}</td>
                    <td>{translateCategory(n.Kategori, lang)}</td>
                    <td className="mono" style={{ whiteSpace: 'normal' }}>{n.PlanlananTarih || '—'}</td>
                    <td style={{ whiteSpace: 'normal' }}>{n.Aciklama || '—'}</td>
                    <td className="mono" style={{ whiteSpace: 'normal' }}>
                      {n.Fiyat ? `${n.Fiyat} ${n.ParaBirimi || ''}` : '—'}
                    </td>
                    <td style={{ whiteSpace: 'normal' }}>
                      {n.FaturaID ? (
                        <Link to="/faturalar" className="badge badge-accent" style={{ fontSize: 11, textDecoration: 'none' }} title={t('inv_linked_invoice')}>
                          🧾 {faturaLabel(faturaMap[n.FaturaID]) || n.FaturaID}
                        </Link>
                      ) : (
                        <span className="page-sub" style={{ fontSize: 11 }}>{t('inv_not_linked')}</span>
                      )}
                      {(n.Fiyat || n.FaturaID) && (
                        <div style={{ marginTop: 4 }}>
                          <span className={`badge ${odemeBadgeClass(n.OdemeDurumu || 'Odenmedi')}`} style={{ fontSize: 10 }}>
                            {odemeDurumuLabel(n.OdemeDurumu || 'Odenmedi', lang)}
                          </span>
                          {n.OdemeTarihi && <span className="page-sub" style={{ fontSize: 10.5, marginLeft: 6 }}>{n.OdemeTarihi}</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusClass(n.Durum)}`}>{tabLabel(n.Durum, t)}</span>
                      {ORDERED_OPEN.includes(n.Durum) && (n.KargoFirmasi || n.KargoTakipNo || n.TahminiTeslimatTarihi) && (
                        <div className="page-sub" style={{ marginTop: 4, fontSize: 11, whiteSpace: 'normal', lineHeight: 1.5 }}>
                          {n.KargoFirmasi && <div>{n.KargoFirmasi}</div>}
                          {n.KargoTakipNo && <div className="mono">{n.KargoTakipNo}</div>}
                          {n.TahminiTeslimatTarihi && <div>{t('needs_col_estimated_delivery')}: {n.TahminiTeslimatTarihi}</div>}
                        </div>
                      )}
                    </td>
                    <td className="no-print" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {/* Duzenle HER durumda acik - Karsilandi/Iptal satirlarinda da odeme durumu, fatura ve belgeler guncellenebilsin. */}
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(n)}>{t('needs_edit')}</button>
                      {PRE_ORDER.includes(n.Durum) && (
                        <button className="btn btn-ghost btn-sm" onClick={() => markOrdered(n)}>{t('needs_mark_ordered')}</button>
                      )}
                      {OPEN_NEED.includes(n.Durum) && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setFulfillTarget(n)}>{t('needs_mark_fulfilled')}</button>
                      )}
                      {OPEN_NEED.includes(n.Durum) && (
                        <button className="btn btn-danger btn-sm" onClick={() => cancelNeed(n)}>{t('needs_cancel')}</button>
                      )}
                      {n.Durum === 'Karsilandi' && n.BaglantiliVarlikID && (
                        <span className="mono page-sub">{n.BaglantiliVarlikID}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10}><div className="empty-state">{t('no_results')}</div></td></tr>
                )}
              </tbody>
            </table>
          </div>

          {visibleCount < filtered.length && (
            <div className="no-print" style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                {t('btn_load_more')} ({filtered.length - visibleCount})
              </button>
            </div>
          )}
        </>
      )}

      {showForm && (
        <NeedForm employees={employees} lists={lists} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}

      {quickAddFor && (
        <NeedForm
          employees={employees}
          lists={lists}
          initialPerson={quickAddFor.person}
          initialKategori={quickAddFor.kategori}
          initialPlanlananTarih={quickAddFor.planlananTarih}
          initialAciklama={quickAddFor.aciklama}
          initialMiktar={quickAddFor.miktar}
          onClose={() => setQuickAddFor(null)}
          onSaved={() => { setQuickAddFor(null); load(); }}
        />
      )}

      {showPlanExport && (
        <MonthlyPlanExportModal needs={needs} items={items} faturalar={faturalar} onClose={() => setShowPlanExport(false)} />
      )}

      {showPdfPicker && (
        <Modal
          title={t('needs_pdf_picker_title')}
          onClose={() => setShowPdfPicker(false)}
          actions={<button className="btn btn-ghost" onClick={() => setShowPdfPicker(false)}>{t('btn_cancel')}</button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PDF_VIEWS.map((v) => (
              <button key={v.key} className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => doPrintPdf(v.key)}>
                📄 {v.label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {editTarget && (
        <NeedEditModal need={editTarget} lists={lists} employees={employees} faturalar={faturalar} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); }} />
      )}

      {showLinkModal && (
        <LinkToFaturaModal
          rows={selectedNeeds}
          faturalar={faturalar}
          onClose={() => setShowLinkModal(false)}
          onDone={() => { setShowLinkModal(false); setSelected(new Set()); load(); }}
        />
      )}

      {fulfillTarget && (
        <FulfillModal
          need={fulfillTarget}
          items={items}
          userName={userName}
          onClose={() => setFulfillTarget(null)}
          onDone={() => { setFulfillTarget(null); load(); }}
        />
      )}
    </div>
  );
}

function statusClass(durum) {
  if (durum === 'Karsilandi') return 'badge-accent';
  if (durum === 'Onaylandi') return 'badge-blue';
  if (ORDERED_OPEN.includes(durum)) return 'badge-amber';
  if (durum === 'Iptal') return 'badge-red';
  return 'badge-gray';
}

function tabLabel(s, t) {
  const map = {
    'Bekleniyor': t('needs_pending'),
    'Onaylandi': t('needs_approved'),
    'Siparis Verildi': t('needs_ordered'),
    'Yolda': t('needs_in_transit'),
    'KismenAlindi': t('needs_partial'),
    'Karsilandi': t('needs_fulfilled'),
    'Iptal': t('needs_cancelled'),
    'Hepsi': t('needs_all')
  };
  return map[s] || s;
}

// ============ Yeni ihtiyac formu: personel (mevcut/yeni/stok) + ekipman listesi olusturucu ============
function NeedForm({ employees, lists, initialPerson, initialKategori, initialPlanlananTarih, initialAciklama, initialMiktar, onClose, onSaved }) {
  const { t, lang } = useLang();
  const [personMode, setPersonMode] = useState('existing'); // 'existing' | 'new' | 'stock'
  const [existingName, setExistingName] = useState(initialPerson || employees[0]?.AdSoyad || '');
  const [newName, setNewName] = useState('');
  const [newDepartman, setNewDepartman] = useState('');
  const [planlananTarih, setPlanlananTarih] = useState(initialPlanlananTarih || '');

  const [draftKategori, setDraftKategori] = useState(initialKategori || lists.Kategori?.[0] || '');
  const [draftMarka, setDraftMarka] = useState('');
  const [draftMalzemeAdi, setDraftMalzemeAdi] = useState('');
  const [draftBirim, setDraftBirim] = useState('');
  const [draftOncelik, setDraftOncelik] = useState('');
  const [draftOdemeTuru, setDraftOdemeTuru] = useState('');
  const [draftAciklama, setDraftAciklama] = useState(initialAciklama || '');
  const [draftFiyat, setDraftFiyat] = useState('');
  const [draftParaBirimi, setDraftParaBirimi] = useState('TRY');
  const [draftMiktar, setDraftMiktar] = useState(initialMiktar || 1);
  const [equipmentList, setEquipmentList] = useState([]);
  const [sarfMalzemeleri, setSarfMalzemeleri] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // "Yazici" kategorisi secildiginde, malzeme adini her seferinde elle yazmak yerine
  // Sarf Malzemeleri'nde onceden tanimladiginiz listeden secebilmeniz icin cekiyoruz.
  useEffect(() => {
    if (draftKategori === 'Yazici') {
      api.getSarfMalzemeleri().then(setSarfMalzemeleri).catch(() => {});
    }
  }, [draftKategori]);

  // Mevcut calisan secildiyse departmani zaten kayitli - tekrar sormuyoruz.
  const selectedEmployee = employees.find((e) => e.AdSoyad === existingName);

  function addToList() {
    if (!draftKategori) return;
    setEquipmentList((prev) => [...prev, { Kategori: draftKategori, Marka: draftMarka, MalzemeAdi: draftMalzemeAdi, Birim: draftBirim, Oncelik: draftOncelik, OdemeTuru: draftOdemeTuru, Aciklama: draftAciklama, Fiyat: draftFiyat, ParaBirimi: draftParaBirimi, Miktar: Math.max(1, Number(draftMiktar) || 1) }]);
    setDraftMarka('');
    setDraftMalzemeAdi('');
    setDraftBirim('');
    setDraftOncelik('');
    setDraftOdemeTuru('');
    setDraftAciklama('');
    setDraftFiyat('');
    setDraftMiktar(1);
  }

  function removeFromList(idx) {
    setEquipmentList((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (personMode === 'new' && !newName) { setError('Personel adi gerekli.'); return; }
    if (equipmentList.length === 0) { setError('En az bir ekipman eklemelisiniz.'); return; }
    setSaving(true);
    setError('');
    try {
      const personelAdi = personMode === 'existing' ? existingName : personMode === 'new' ? newName : '';
      const departman = personMode === 'existing' ? (selectedEmployee?.Departman || '') : personMode === 'new' ? newDepartman : '';
      let queuedCount = 0;
      // Bu formdan tek seferde eklenen tum kayitlar ayni TopluID'yi tasir - Aylik Plan
      // exportunda yalnizca bunlar (ayni kalemse) tek satirda birlestirilir.
      const topluId = 'B-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      for (const item of equipmentList) {
        const count = Math.max(1, Number(item.Miktar) || 1);
        for (let i = 0; i < count; i++) {
          const res = await api.createNeed({
            PersonelAdi: personelAdi,
            Departman: departman,
            TopluID: topluId,
            PlanlananTarih: planlananTarih,
            Kategori: item.Kategori,
            Marka: item.Marka,
            MalzemeAdi: item.MalzemeAdi,
            Birim: item.Birim,
            Oncelik: item.Oncelik,
            OdemeTuru: item.OdemeTuru,
            Aciklama: item.Aciklama,
            Fiyat: item.Fiyat,
            ParaBirimi: item.ParaBirimi || 'TRY'
          });
          if (res.queued) queuedCount++;
        }
      }
      if (queuedCount > 0) alert(`${queuedCount} kayit internet yok - cevrimdisi kaydedildi, baglanti gelince otomatik gonderilecek.`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t('needs_new')}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" type="submit" form="need-form" disabled={saving}>{saving ? '...' : t('btn_save')}</button>
        </>
      }
    >
      <form id="need-form" onSubmit={handleSubmit}>
        <div className="chip-row">
          <button type="button" className={`badge ${personMode === 'existing' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setPersonMode('existing')} style={{ cursor: 'pointer' }}>
            {t('needs_existing_employee')}
          </button>
          <button type="button" className={`badge ${personMode === 'new' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setPersonMode('new')} style={{ cursor: 'pointer' }}>
            {t('needs_new_employee')}
          </button>
          <button type="button" className={`badge ${personMode === 'stock' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setPersonMode('stock')} style={{ cursor: 'pointer' }}>
            📦 {t('needs_for_stock')}
          </button>
        </div>

        {personMode === 'existing' && (
          <div className="field">
            <label>{t('needs_col_person')}</label>
            <select value={existingName} onChange={(e) => setExistingName(e.target.value)}>
              {employees.map((emp) => <option key={emp.AdSoyad} value={emp.AdSoyad}>{emp.AdSoyad}</option>)}
            </select>
            {selectedEmployee?.Departman && (
              <div className="page-sub" style={{ marginTop: 4 }}>{t('col_department')}: {selectedEmployee.Departman}</div>
            )}
          </div>
        )}

        {personMode === 'new' && (
          <div className="form-grid">
            <div className="field">
              <label>{t('needs_col_person')}</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('placeholder_full_name')} required />
            </div>
            <div className="field">
              <label>{t('col_department')}</label>
              <input list="need-dep-list" value={newDepartman} onChange={(e) => setNewDepartman(e.target.value)} />
              <datalist id="need-dep-list">
                {lists.Departman?.map((d) => <option key={d} value={d} />)}
              </datalist>
            </div>
          </div>
        )}

        {personMode === 'stock' && (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{t('needs_stock_label')} — kimseye atanmadan genel stoga eklenecek.</p>
        )}

        <div className="field">
          <label>{t('needs_col_planned_date')}</label>
          <input type="date" value={planlananTarih} onChange={(e) => setPlanlananTarih(e.target.value)} />
        </div>

        <div className="section-title" style={{ marginTop: 20 }}>{t('needs_equipment_list')}</div>

        <div className="form-grid" style={{ alignItems: 'end' }}>
          <div className="field">
            <label>{t('col_category')}</label>
            <select value={draftKategori} onChange={(e) => setDraftKategori(e.target.value)}>
              {(lists.Kategori || []).map((k) => <option key={k} value={k}>{translateCategory(k, lang)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('needs_quantity')}</label>
            <input type="number" min="1" value={draftMiktar} onChange={(e) => setDraftMiktar(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('col_brand')}</label>
            <select value={draftMarka} onChange={(e) => setDraftMarka(e.target.value)}>
              <option value="">—</option>
              {(lists.Marka || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('needs_col_unit')}</label>
            <select value={draftBirim} onChange={(e) => setDraftBirim(e.target.value)}>
              <option value="">—</option>
              {(lists.Birim || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('needs_col_priority')}</label>
            <select value={draftOncelik} onChange={(e) => setDraftOncelik(e.target.value)}>
              <option value="">—</option>
              {(lists.Oncelik || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('needs_col_payment_type')}</label>
            <select value={draftOdemeTuru} onChange={(e) => setDraftOdemeTuru(e.target.value)}>
              <option value="">—</option>
              {(lists.OdemeTuru || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {draftKategori === 'Yazici' && sarfMalzemeleri.length > 0 && (
            <div className="field full">
              <label>{t('sarf_col_name')}</label>
              <select value={draftMalzemeAdi} onChange={(e) => { setDraftMalzemeAdi(e.target.value); if (e.target.value && !draftAciklama) setDraftAciklama(e.target.value); }}>
                <option value="">{t('needs_pick_material')}</option>
                {sarfMalzemeleri.map((m) => (
                  <option key={m.ID} value={m.Ad}>{m.Ad}{m.UyumluModeller ? ` (${m.UyumluModeller})` : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>{t('col_notes')}</label>
            <input value={draftAciklama} onChange={(e) => setDraftAciklama(e.target.value)} placeholder='orn. 23" monitor' />
          </div>
          <div className="field full">
            <label>{t('col_price')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" step="0.01" value={draftFiyat} onChange={(e) => setDraftFiyat(e.target.value)} style={{ flex: 1 }} />
              <select value={draftParaBirimi} onChange={(e) => setDraftParaBirimi(e.target.value)} style={{ width: 90 }}>
                {(lists.ParaBirimi?.length ? lists.ParaBirimi : ['TRY', 'USD', 'EUR', 'RUB']).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field full">
            <button type="button" className="btn btn-ghost btn-sm" onClick={addToList}>+ {t('needs_add_to_list')}</button>
          </div>
        </div>

        {equipmentList.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 6, marginBottom: 10 }}>
            {equipmentList.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: i < equipmentList.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                <span>
                  {item.Miktar > 1 && <span className="badge badge-accent" style={{ marginRight: 6 }}>×{item.Miktar}</span>}
                  <strong>{translateCategory(item.Kategori, lang)}</strong>
                  {item.Aciklama && <span className="page-sub"> · {item.Aciklama}</span>}
                  {item.Fiyat && <span className="mono"> · {item.Fiyat} {item.ParaBirimi} {item.Miktar > 1 ? `× ${item.Miktar} = ${(item.Fiyat * item.Miktar).toFixed(2)} ${item.ParaBirimi}` : ''}</span>}
                </span>
                <button type="button" onClick={() => removeFromList(i)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {error && <div className="error-text">{error}</div>}
      </form>
    </Modal>
  );
}

// ============ Mevcut bir ihtiyaci duzenleme modali ============
function NeedEditModal({ need, lists, employees, faturalar, onClose, onSaved }) {
  const { t, lang } = useLang();
  // Karsilandi/Iptal satirlarda kisi, kategori, kargo gibi "siparis" alanlari
  // kilitli (sadece odeme, fatura, belge, fiyat, tedarikci, not duzenlenir):
  // karsilanmis bir ihtiyacin kime/ne icin oldugu degismemeli.
  const limited = need.Durum === 'Karsilandi' || need.Durum === 'Iptal';
  const faturaMap = useMemo(() => buildFaturaMap(faturalar), [faturalar]);
  const [faturaId, setFaturaId] = useState(need.FaturaID || '');
  const linkedFatura = faturaId ? faturaMap[faturaId] : null;
  const locked = !!faturaId; // faturaya bagliysa odeme bilgisini fatura belirler
  const [pickFatura, setPickFatura] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [showNewFatura, setShowNewFatura] = useState(false);
  const [newFaturaNo, setNewFaturaNo] = useState('');
  const [newFaturaLabel, setNewFaturaLabel] = useState('');
  const changedRef = useRef(false); // fatura bagi degistiyse kapatirken liste tazelensin
  // Kisi degistirme: "mevcut calisan" / "genel stok" (kimseye atanmamis).
  // Yanlislikla baska bir kisi secilmis olabilecegi icin bu duzenlenebilir olmali.
  const [personMode, setPersonMode] = useState(need.PersonelAdi ? 'existing' : 'stock');
  const [personelAdi, setPersonelAdi] = useState(need.PersonelAdi || '');
  const [form, setForm] = useState({
    Departman: need.Departman || '',
    Kategori: need.Kategori || '',
    Marka: need.Marka || '',
    Birim: need.Birim || '',
    Oncelik: need.Oncelik || '',
    OdemeTuru: need.OdemeTuru || '',
    Aciklama: need.Aciklama || '',
    Fiyat: need.Fiyat || '',
    ParaBirimi: need.ParaBirimi || 'TRY',
    Tedarikci: need.Tedarikci || '',
    PlanlananTarih: need.PlanlananTarih || '',
    TahminiTeslimatTarihi: need.TahminiTeslimatTarihi || '',
    KargoFirmasi: need.KargoFirmasi || '',
    KargoTakipNo: need.KargoTakipNo || '',
    OdemeDurumu: need.OdemeDurumu || 'Odenmedi',
    OdemeTarihi: need.OdemeTarihi || '',
    Durum: need.Durum
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Proforma/fatura belgeleri - Envanter'deki FaturaLink ile AYNI mekanizma
  // (tek paylasimli Drive klasoru, birden fazla dosya = virgulle ayrilmis URL
  // listesi) - sadece sheet/alan adi parametrize edilerek burada kullaniliyor.
  const [proformaLinks, setProformaLinks] = useState(splitLinks(need.ProformaLink));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const base64 = await fileToBase64(file);
      const res = await api.uploadFile({ assetId: need.ID, filename: file.name, mimeType: file.type, base64, sheetName: 'Ihtiyaclar', linkColumn: 'ProformaLink' });
      setProformaLinks((prev) => [...prev, res.url]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function doLink() {
    if (!pickFatura) return;
    setLinkBusy(true);
    setError('');
    try {
      await api.linkFatura(pickFatura, [need.ID], []);
      const f = faturaMap[pickFatura];
      setFaturaId(pickFatura);
      setForm((fm) => ({ ...fm, OdemeDurumu: f?.OdemeDurumu || 'Odenmedi', OdemeTarihi: f?.OdemeTarihi || '' }));
      setPickFatura('');
      changedRef.current = true;
    } catch (err) {
      setError(err.message);
    } finally {
      setLinkBusy(false);
    }
  }

  // Listede uygun fatura yoksa (veya hic fatura yoksa) bu satir icin dogrudan
  // YENI fatura olustur: satirin tedarikci/fiyat/odeme bilgisiyle acilir ve satir baglanir.
  async function doCreateFatura() {
    setLinkBusy(true);
    setError('');
    try {
      const res = await api.createFatura({
        FaturaNo: newFaturaNo.trim(),
        Tedarikci: form.Tedarikci || '',
        FaturaTarihi: need.SiparisTarihi || '',
        Tutar: form.Fiyat || '',
        ParaBirimi: form.ParaBirimi || 'TRY',
        OdemeDurumu: form.OdemeDurumu || 'Odenmedi',
        OdemeTarihi: form.OdemeTarihi || ''
      }, [need.ID], []);
      setNewFaturaLabel(newFaturaNo.trim() || res.id);
      setFaturaId(res.id);
      setShowNewFatura(false);
      changedRef.current = true;
    } catch (err) {
      setError(err.message);
    } finally {
      setLinkBusy(false);
    }
  }

  async function doUnlink() {
    setLinkBusy(true);
    setError('');
    try {
      await api.unlinkFatura([need.ID], []);
      setFaturaId('');
      changedRef.current = true;
    } catch (err) {
      setError(err.message);
    } finally {
      setLinkBusy(false);
    }
  }

  function handleClose() {
    if (changedRef.current) onSaved(); else onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let payload;
      if (limited) {
        const { Aciklama, Fiyat, ParaBirimi, Tedarikci, OdemeTuru, OdemeDurumu, OdemeTarihi } = form;
        payload = { Aciklama, Fiyat, ParaBirimi, Tedarikci, OdemeTuru, OdemeDurumu, OdemeTarihi };
      } else {
        const selectedEmployee = employees.find((emp) => emp.AdSoyad === personelAdi);
        const finalPersonelAdi = personMode === 'stock' ? '' : personelAdi;
        const finalDepartman = personMode === 'stock' ? '' : (selectedEmployee?.Departman || form.Departman);
        payload = { ...form, PersonelAdi: finalPersonelAdi, Departman: finalDepartman };
      }
      // Siparis verilmis adimlara (Siparis Verildi/Yolda/Kismen alindi) ilk kez gecilirken siparis tarihi bossa bugunu yaz.
      if (payload.Durum && ORDERED_OPEN.includes(payload.Durum) && !need.SiparisTarihi) payload.SiparisTarihi = new Date().toISOString().slice(0, 10);
      // Faturaya bagli satirda odeme bilgisini fatura belirler - gondermiyoruz.
      if (faturaId) { delete payload.OdemeDurumu; delete payload.OdemeTarihi; }
      await api.updateNeed(need.ID, payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`${t('needs_edit')} · ${need.PersonelAdi || t('needs_stock_label')}`}
      onClose={handleClose}
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={handleClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" type="submit" form="need-edit-form" disabled={saving}>{saving ? '...' : t('btn_save')}</button>
        </>
      }
    >
      <form id="need-edit-form" onSubmit={handleSubmit}>
        {limited && (
          <div className="page-sub" style={{ marginBottom: 12 }}>
            <strong>{need.PersonelAdi || `📦 ${t('needs_stock_label')}`}</strong> · {translateCategory(need.Kategori, lang)} · {tabLabel(need.Durum, t)}
          </div>
        )}
        {!limited && (<>
        <div className="field">
          <label>{t('needs_supply_status')}</label>
          <select value={form.Durum} onChange={(e) => setForm({ ...form, Durum: e.target.value })}>
            {['Bekleniyor', 'Onaylandi', 'Siparis Verildi', 'Yolda', 'KismenAlindi'].map((k) => <option key={k} value={k}>{tabLabel(k, t)}</option>)}
          </select>
        </div>
        <div className="chip-row">
          <button type="button" className={`badge ${personMode === 'existing' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setPersonMode('existing')} style={{ cursor: 'pointer' }}>
            {t('needs_existing_employee')}
          </button>
          <button type="button" className={`badge ${personMode === 'stock' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setPersonMode('stock')} style={{ cursor: 'pointer' }}>
            📦 {t('needs_for_stock')}
          </button>
        </div>
        {personMode === 'existing' && (
          <div className="field">
            <label>{t('needs_col_person')}</label>
            <select value={personelAdi} onChange={(e) => setPersonelAdi(e.target.value)}>
              <option value="">—</option>
              {employees.map((emp) => <option key={emp.AdSoyad} value={emp.AdSoyad}>{emp.AdSoyad}</option>)}
            </select>
          </div>
        )}
        {personMode === 'stock' && (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{t('needs_stock_label')} — kimseye atanmadan genel stokta kalacak.</p>
        )}
        <div className="field">
          <label>{t('col_category')}</label>
          <select value={form.Kategori} onChange={(e) => setForm({ ...form, Kategori: e.target.value })}>
            {(lists.Kategori || []).map((k) => <option key={k} value={k}>{translateCategory(k, lang)}</option>)}
          </select>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t('col_brand')}</label>
            <select value={form.Marka} onChange={(e) => setForm({ ...form, Marka: e.target.value })}>
              <option value="">—</option>
              {(lists.Marka || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('needs_col_unit')}</label>
            <select value={form.Birim} onChange={(e) => setForm({ ...form, Birim: e.target.value })}>
              <option value="">—</option>
              {(lists.Birim || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        </>)}
        <div className="form-grid">
          {!limited && (
          <div className="field">
            <label>{t('needs_col_priority')}</label>
            <select value={form.Oncelik} onChange={(e) => setForm({ ...form, Oncelik: e.target.value })}>
              <option value="">—</option>
              {(lists.Oncelik || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          )}
          <div className="field">
            <label>{t('needs_col_payment_type')}</label>
            <select value={form.OdemeTuru} onChange={(e) => setForm({ ...form, OdemeTuru: e.target.value })}>
              <option value="">—</option>
              {(lists.OdemeTuru || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t('col_notes')}</label>
          <input value={form.Aciklama} onChange={(e) => setForm({ ...form, Aciklama: e.target.value })} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t('col_price')}</label>
            <input type="number" step="0.01" value={form.Fiyat} onChange={(e) => setForm({ ...form, Fiyat: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('col_currency')}</label>
            <select value={form.ParaBirimi} onChange={(e) => setForm({ ...form, ParaBirimi: e.target.value })}>
              {(lists.ParaBirimi?.length ? lists.ParaBirimi : ['TRY', 'USD', 'EUR', 'RUB']).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t('col_supplier')}</label>
          <input list="need-edit-tedarikci" value={form.Tedarikci} onChange={(e) => setForm({ ...form, Tedarikci: e.target.value })} />
          <datalist id="need-edit-tedarikci">
            {lists.Tedarikci?.map((td) => <option key={td} value={td} />)}
          </datalist>
        </div>
        {!limited && (<>
        <div className="field">
          <label>{t('needs_col_planned_date')}</label>
          <input type="date" value={form.PlanlananTarih} onChange={(e) => setForm({ ...form, PlanlananTarih: e.target.value })} />
        </div>

        <div className="section-title" style={{ marginTop: 6 }}>{t('needs_shipping_section')}</div>
        <div className="form-grid">
          <div className="field">
            <label>{t('needs_col_estimated_delivery')}</label>
            <input type="date" value={form.TahminiTeslimatTarihi} onChange={(e) => setForm({ ...form, TahminiTeslimatTarihi: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('needs_col_cargo_company')}</label>
            <select value={form.KargoFirmasi} onChange={(e) => setForm({ ...form, KargoFirmasi: e.target.value })}>
              <option value="">—</option>
              {(lists.KargoFirmasi || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t('needs_col_tracking_no')}</label>
          <input value={form.KargoTakipNo} onChange={(e) => setForm({ ...form, KargoTakipNo: e.target.value })} placeholder={t('needs_col_tracking_no_ph')} />
        </div>
        </>)}

        <div className="section-title" style={{ marginTop: 6 }}>{t('needs_payment_section')}</div>
        <div className="field">
          <label>{t('inv_linked_invoice')}</label>
          {faturaId ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge badge-accent">
                🧾 {faturaLabel(linkedFatura) || newFaturaLabel || faturaId}{linkedFatura?.Tedarikci ? ` · ${linkedFatura.Tedarikci}` : ''}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={doUnlink} disabled={linkBusy}>{t('inv_unlink')}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={pickFatura} onChange={(e) => setPickFatura(e.target.value)} style={{ flex: 1 }}>
                <option value="">{t('inv_link_action')}…</option>
                {faturalar.map((f) => (
                  <option key={f.ID} value={f.ID}>
                    {faturaLabel(f)}{f.Tedarikci ? ` · ${f.Tedarikci}` : ''} · {odemeDurumuLabel(f.OdemeDurumu || 'Odenmedi', lang)}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost btn-sm" onClick={doLink} disabled={!pickFatura || linkBusy}>{t('inv_link_btn')}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewFatura((v) => !v)}>+ {t('inv_new')}</button>
            </div>
          )}
          {!faturaId && showNewFatura && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input style={{ flex: 1 }} value={newFaturaNo} onChange={(e) => setNewFaturaNo(e.target.value)} placeholder={t('inv_no')} />
              <button type="button" className="btn btn-primary btn-sm" onClick={doCreateFatura} disabled={linkBusy}>{linkBusy ? '...' : t('inv_create_link')}</button>
            </div>
          )}
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t('needs_col_payment_status')}</label>
            <select value={form.OdemeDurumu} disabled={locked} onChange={(e) => setForm({ ...form, OdemeDurumu: e.target.value })}>
              {ODEME_DURUMU_OPTIONS.map((k) => <option key={k} value={k}>{odemeDurumuLabel(k, lang)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('needs_col_payment_date')}</label>
            <input type="date" value={form.OdemeTarihi} disabled={locked} onChange={(e) => setForm({ ...form, OdemeTarihi: e.target.value })} />
          </div>
        </div>
        {locked && <div className="page-sub" style={{ marginBottom: 10 }}>{t('inv_locked_note')}</div>}

        <div className="section-title" style={{ marginTop: 6 }}>{t('needs_proforma_section')}</div>
        {proformaLinks.length > 0
          ? proformaLinks.map((url, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <a href={url} target="_blank" rel="noreferrer">{t('needs_proforma_doc_label')} {i + 1} ↗</a>
              </div>
            ))
          : <div className="page-sub" style={{ marginBottom: 10 }}>{t('detail_no_docs')}</div>}
        <label className="btn btn-ghost btn-sm" style={{ display: 'inline-flex' }}>
          {uploading ? '...' : `+ ${t('detail_upload')}`}
          <input type="file" hidden onChange={handleFileUpload} disabled={uploading} />
        </label>
        {uploadError && <div className="error-text" style={{ marginTop: 8 }}>{uploadError}</div>}

        {linkedFatura && splitLinks(linkedFatura.BelgeLink).length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 10 }}>{t('inv_invoice_docs')} · {faturaLabel(linkedFatura)}</div>
            {splitLinks(linkedFatura.BelgeLink).map((url, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <a href={url} target="_blank" rel="noreferrer">{t('needs_proforma_doc_label')} {i + 1} ↗</a>
              </div>
            ))}
          </>
        )}

        {error && <div className="error-text">{error}</div>}
      </form>
    </Modal>
  );
}

// ============ Secili ihtiyac satirlarini toplu olarak faturaya bagla ============
function LinkToFaturaModal({ rows, faturalar, onClose, onDone }) {
  const { t, lang } = useLang();
  const [mode, setMode] = useState(faturalar.length > 0 ? 'existing' : 'new');
  const [faturaId, setFaturaId] = useState('');
  // Secili satirlarin tedarikcisi hepsinde ayniysa yeni faturaya hazir doldur.
  const commonSupplier = (() => {
    const set = new Set(rows.map((r) => (r.Tedarikci || '').trim()).filter(Boolean));
    return set.size === 1 ? [...set][0] : '';
  })();
  const [form, setForm] = useState({ FaturaNo: '', Tedarikci: commonSupplier, FaturaTarihi: '', OdemeDurumu: 'Odenmedi', OdemeTarihi: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const chosen = faturalar.find((f) => f.ID === faturaId);
  const targetStatus = mode === 'existing' ? (chosen?.OdemeDurumu || 'Odenmedi') : form.OdemeDurumu;
  const willChange = (mode === 'existing' && !chosen) ? 0 : rows.filter((r) => (r.OdemeDurumu || 'Odenmedi') !== targetStatus).length;
  const moved = rows.filter((r) => r.FaturaID && (mode === 'new' || r.FaturaID !== faturaId)).length;
  const sortedFaturalar = [...faturalar].sort((a, b) => String(b.FaturaTarihi || b.OlusturmaTarihi || '').localeCompare(String(a.FaturaTarihi || a.OlusturmaTarihi || '')));

  function setPaymentStatus(value) {
    setForm((f) => {
      let tarih = f.OdemeTarihi;
      if (value === 'Odenmedi' || value === 'TeklifFiyat') tarih = '';
      else if (!tarih) tarih = new Date().toISOString().slice(0, 10);
      return { ...f, OdemeDurumu: value, OdemeTarihi: tarih };
    });
  }

  async function handleConfirm() {
    setSaving(true);
    setError('');
    try {
      const ids = rows.map((r) => r.ID);
      if (mode === 'existing') await api.linkFatura(faturaId, ids, []);
      else await api.createFatura(form, ids, []);
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`${t('inv_link_to')} · ${rows.length} ${t('inv_selected_lines')}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={saving || (mode === 'existing' && !faturaId)}>
            {saving ? '...' : t('btn_confirm')}
          </button>
        </>
      }
    >
      <div className="chip-row">
        {faturalar.length > 0 && (
          <button type="button" className={`badge ${mode === 'existing' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setMode('existing')} style={{ cursor: 'pointer' }}>
            {t('inv_mode_existing')}
          </button>
        )}
        <button type="button" className={`badge ${mode === 'new' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setMode('new')} style={{ cursor: 'pointer' }}>
          {t('inv_mode_new')}
        </button>
      </div>

      {mode === 'existing' && (
        <div className="field">
          <label>{t('inv_pick_invoice')}</label>
          <select value={faturaId} onChange={(e) => setFaturaId(e.target.value)}>
            <option value="">—</option>
            {sortedFaturalar.map((f) => (
              <option key={f.ID} value={f.ID}>
                {faturaLabel(f)}{f.Tedarikci ? ` · ${f.Tedarikci}` : ''}{f.FaturaTarihi ? ` · ${f.FaturaTarihi}` : ''} · {odemeDurumuLabel(f.OdemeDurumu || 'Odenmedi', lang)}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'new' && (
        <>
          <div className="form-grid">
            <div className="field">
              <label>{t('inv_no')}</label>
              <input value={form.FaturaNo} onChange={(e) => setForm({ ...form, FaturaNo: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('inv_date')}</label>
              <input type="date" value={form.FaturaTarihi} onChange={(e) => setForm({ ...form, FaturaTarihi: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>{t('col_supplier')}</label>
            <input value={form.Tedarikci} onChange={(e) => setForm({ ...form, Tedarikci: e.target.value })} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>{t('needs_col_payment_status')}</label>
              <select value={form.OdemeDurumu} onChange={(e) => setPaymentStatus(e.target.value)}>
                {ODEME_DURUMU_OPTIONS.map((k) => <option key={k} value={k}>{odemeDurumuLabel(k, lang)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('needs_col_payment_date')}</label>
              <input type="date" value={form.OdemeTarihi} onChange={(e) => setForm({ ...form, OdemeTarihi: e.target.value })} />
            </div>
          </div>
        </>
      )}

      <div className="page-sub" style={{ marginTop: 6 }}>{t('inv_propagate_note')}</div>
      {willChange > 0 && (
        <div className="page-sub" style={{ marginTop: 8, color: 'var(--amber, #b7791f)' }}>⚠ {willChange} {t('inv_will_change')}</div>
      )}
      {moved > 0 && (
        <div className="page-sub" style={{ marginTop: 6, color: 'var(--amber, #b7791f)' }}>⚠ {moved} {t('inv_moved_warn')}</div>
      )}
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}

// ============ Karsilama modali: stoktan sec VEYA yeni varlik olarak ekle ============
function FulfillModal({ need, items, userName, onClose, onDone }) {
  const { t, lang } = useLang();
  const [mode, setMode] = useState('existing');
  const candidates = items.filter((a) => a.Kategori === need.Kategori && (a.Durum === 'Stok' || a.Durum === 'Rezerve'));
  const [assetId, setAssetId] = useState(candidates[0]?.ID || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isSarfMalzeme = !!need.MalzemeAdi;
  // Normal ihtiyac olarak girilmis sarf kalemleri (orn. kartus) icin 3. secenek: sarf stoguna ekle.
  const [sarfAd, setSarfAd] = useState([need.Marka, need.Aciklama].filter(Boolean).join(' ').trim());
  const [sarfNames, setSarfNames] = useState([]);
  useEffect(() => {
    if (isSarfMalzeme) return;
    api.getSarfMalzemeleri().then((list) => setSarfNames((list || []).map((m) => m.Ad).filter(Boolean))).catch(() => {});
  }, [isSarfMalzeme]);

  async function handleConfirm() {
    setSaving(true);
    setError('');
    try {
      const res = isSarfMalzeme
        ? await api.fulfillNeedAsSarfStock(need.ID, userName)
        : mode === 'sarf'
          ? await api.fulfillNeedAsSarfStock(need.ID, userName, sarfAd.trim())
          : mode === 'existing'
            ? await api.fulfillNeed(need.ID, assetId, userName)
            : await api.fulfillNeedAsNewAsset(need.ID, userName);
      alert(res.message);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (isSarfMalzeme) {
    return (
      <Modal
        title={`${need.MalzemeAdi} — ${t('sarf_title')}`}
        onClose={onClose}
        actions={
          <>
            <button className="btn btn-ghost" onClick={onClose}>{t('btn_cancel')}</button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>{saving ? '...' : t('btn_confirm')}</button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{t('needs_fulfill_sarf_desc').replace('{ad}', need.MalzemeAdi)}</p>
        {error && <div className="error-text">{error}</div>}
      </Modal>
    );
  }

  return (
    <Modal
      title={`${need.PersonelAdi || t('needs_stock_label')} — ${translateCategory(need.Kategori, lang)}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={saving || (mode === 'existing' && !assetId) || (mode === 'sarf' && !sarfAd.trim())}>
            {saving ? '...' : t('btn_confirm')}
          </button>
        </>
      }
    >
      <div className="chip-row">
        <button type="button" className={`badge ${mode === 'existing' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setMode('existing')} style={{ cursor: 'pointer' }}>
          {t('needs_fulfill_existing')}
        </button>
        <button type="button" className={`badge ${mode === 'new' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setMode('new')} style={{ cursor: 'pointer' }}>
          {t('needs_fulfill_new')}
        </button>
        <button type="button" className={`badge ${mode === 'sarf' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setMode('sarf')} style={{ cursor: 'pointer' }}>
          {t('needs_fulfill_as_sarf')}
        </button>
      </div>

      {mode === 'sarf' ? (
        <div className="field">
          <label>{t('needs_fulfill_sarf_name')}</label>
          <input list="fulfill-sarf-names" value={sarfAd} onChange={(e) => setSarfAd(e.target.value)} />
          <datalist id="fulfill-sarf-names">
            {sarfNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <div className="page-sub" style={{ marginTop: 4 }}>{t('needs_fulfill_sarf_hint')}</div>
        </div>
      ) : mode === 'existing' ? (
        candidates.length === 0 ? (
          <div className="empty-state">Bu kategoride stokta uygun varlik yok. "{t('needs_fulfill_new')}" secenegini kullanin.</div>
        ) : (
          <div className="field">
            <label>{t('col_asset')}</label>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              {candidates.map((a) => <option key={a.ID} value={a.ID}>{a.ID} · {a.Marka} {a.Model}</option>)}
            </select>
          </div>
        )
      ) : (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          {t('fulfill_new_desc_prefix')}
          {need.PersonelAdi ? <> {t('fulfill_new_desc_assigned_to')} <strong>{need.PersonelAdi}</strong>.</> : ` ${t('fulfill_new_desc_stock')}`} {t('fulfill_new_desc_suffix')}
        </p>
      )}
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}

// ============ Aylik Satin Alma Plani - satin alma sefinin sablonuyla birebir aynı format ============
export function MonthlyPlanExportModal({ needs, items, faturalar, onClose, faturaOnlyDefault = false }) {
  const { t } = useLang();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [onaylayan, setOnaylayan] = useState('');
  const [sorumlu, setSorumlu] = useState('');
  const [durumlar, setDurumlar] = useState(['Bekleniyor', 'Siparis Verildi', 'Karsilandi']);
  const [includeEnvanter, setIncludeEnvanter] = useState(false);
  const [faturaOnly, setFaturaOnly] = useState(faturaOnlyDefault);
  const [noPriceScope, setNoPriceScope] = useState('month'); // 'month' | 'all'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleDurum(d) {
    setDurumlar((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  const PLAN_LAST_TEMPLATE_DATA_ROW = 159; // sablonda hazir bicimlendirilmis son bos satir

  async function buildAndDownload() {
    setLoading(true);
    setError('');
    try {
      const [yil, ay] = month.split('-').map(Number);
      const monthPrefix = `${yil}-${String(ay).padStart(2, '0')}`;

      // Hangi ay icin planlandigini ve hangi tarihteki kurun kullanilacagini
      // AYNI mantikla belirliyoruz: "Bekleniyor" (henuz siparis verilmemis) icin
      // Planlanan Tarih (hedef/tahmini tarih), "Siparis Verildi"/"Karsilandi"
      // (zaten siparis edilmis) icin Siparis Tarihi (gercek islem tarihi ve o
      // gunku gercek odeme kuru).
      function rateDateFor(n) {
        return PRE_ORDER.includes(n.Durum)
          ? (n.PlanlananTarih || n.OlusturmaTarihi || '')
          : (n.SiparisTarihi || n.PlanlananTarih || n.OlusturmaTarihi || '');
      }

      const filtered = needs.filter((n) => {
        if (!durumlar.includes(n.Durum)) return false;
        if (faturaOnly && !n.FaturaID) return false;
        if (noPriceScope === 'all') return true; // Tumu secilirse tarih filtresi ihtiyaclar icin de gecerli olmaz
        return rateDateFor(n).slice(0, 7) === monthPrefix;
      });

      // Ayni kalemi (Kategori+Malzeme+Birim+Fiyat+tarih) birden fazla satirda
      // tekrarlamak yerine, adetlerini toplayip TEK satirda gosteriyoruz - farkli
      // tarihte (dolayisiyla farkli kurda) alinanlar ayri satirda kalir ki
      // TL tutari yanlis karismasin.
      const grouped = {};
      filtered.forEach((n) => {
        const ad = n.MalzemeAdi || n.Aciklama || '—';
        const tarih = rateDateFor(n);
        // Farkli faturalara bagli (dolayisiyla odeme durumu/belgesi farkli olabilecek) satirlar birlestirilmesin.
        // Sadece AYNI KAYIT ISLEMINDE (TopluID ayni) eklenen ayni kalemler birlestirilir;
        // ayri ayri eklenen kayitlar (TopluID farkli/yok) kendi satirinda kalir.
        const key = n.TopluID
          ? [n.TopluID, n.Kategori, ad, n.Birim, n.Fiyat, n.ParaBirimi, tarih, n.FaturaID || '', n.Durum].join('|')
          : n.ID;
        if (!grouped[key]) grouped[key] = { ...n, Ad: ad, Miktar: 0, RateDate: tarih };
        grouped[key].Miktar += 1;
      });
      const rows = Object.values(grouped);
      const faturaMap = buildFaturaMap(faturalar);

      // Istege bagli: Envanter'deki TUM cihazlari (fiyati OLAN da OLMAYAN da) rapora
      // ekliyoruz - bunlar yeni siparis DEGIL, gecmiste alinmis mevcut varliklar.
      // Fiyati olanlarda FiyatTRY (satin alma tarihindeki gercek TCMB kuruyla
      // ONCEDEN hesaplanmis) direkt kullanilir. Fiyati olmayanlarda Fiyat
      // sutunlari kasten BOS birakilir (0 degil - "bilinmiyor" ile "bedava"
      // karismasin diye), Tedarik Durumu'nda ozel bir not gosterilir.
      if (includeEnvanter && items) {
        const envanterAssets = items.filter((a) => {
          if (noPriceScope === 'all') return true;
          const tarih = a.SatinAlmaTarihi || a.OlusturmaTarihi || '';
          return tarih.slice(0, 7) === monthPrefix;
        });
        envanterAssets.forEach((a) => {
          const hasPrice = !!a.Fiyat;
          rows.push({
            Kategori: a.Kategori || '',
            Ad: `${a.Marka || ''} ${a.Model || ''}`.trim() || a.SeriNo || a.ID,
            Birim: 'Adet',
            Miktar: 1,
            NoPrice: !hasPrice,
            Fiyat: hasPrice ? a.Fiyat : '',
            ParaBirimi: hasPrice ? a.ParaBirimi : '',
            FiyatTRY: hasPrice ? a.FiyatTRY : '',
            // FiyatTRY bir sekilde bos gelirse (orn. enrichWithUsd_ o an kur
            // cekemediyse), yedek mekanizma hangi tarihin kurunu kullanacagini
            // bilsin diye - Envanter'in KENDI mantigiyla (SatinAlmaTarihi once,
            // yoksa OlusturmaTarihi) AYNI tarihi veriyoruz.
            RateDate: hasPrice ? (a.SatinAlmaTarihi || a.OlusturmaTarihi || '') : '',
            Durum: hasPrice ? 'Karsilandi' : 'EnvanterFiyatsiz',
            Departman: '',
            TahminiTeslimatTarihi: '',
            Not: `Varlik ID: ${a.ID}`
          });
        });
      }

      // Sablonun fiyat sutunlari HER ZAMAN TL (₺) bekliyor. Her ihtiyac kaydinin
      // FiyatTRY alani, backend'de KAYDEDILIRKEN dogru tarihin (siparis/plan
      // tarihi) gercek TCMB kuruyla ONCEDEN hesaplanip saklanmisti - burada onu
      // dogrudan kullaniyoruz. Sadece bu alan hic olusmadan once kaydedilmis
      // ESKI kayitlar icin (FiyatTRY bos) canli kur cekip cevirme yapiyoruz.
      const uniqueDatesNeedingRate = [...new Set(
        rows.filter((r) => !r.FiyatTRY && r.ParaBirimi && r.ParaBirimi !== 'TRY').map((r) => r.RateDate).filter(Boolean)
      )];
      const ratesByDate = {};
      await Promise.all(uniqueDatesNeedingRate.map(async (d) => {
        try { ratesByDate[d] = await api.getAndLogExchangeRate(d); } catch { ratesByDate[d] = null; }
      }));
      function toTRY(fiyat, paraBirimi, tarih) {
        if (!paraBirimi || paraBirimi === 'TRY') return fiyat;
        const rates = ratesByDate[tarih];
        if (rates && rates[paraBirimi]) return fiyat * rates[paraBirimi];
        return fiyat; // kur bulunamadi - cevrilmeden birakilir, kullaniciyi yanlis bilgilendirmemek icin
      }

      // Satin alma sefinin GERCEK sablon dosyasini yukluyoruz - tum renk/font/
      // kenarlik/birlestirme/toplam formulleri oldugu gibi korunacak, SADECE
      // hucre degerlerini dolduruyoruz.
      const resp = await fetch(PLAN_TEMPLATE_URL);
      if (!resp.ok) throw new Error('Sablon dosyasi yuklenemedi.');
      const buffer = await resp.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const ws = workbook.getWorksheet(PLAN_SHEET_NAME);
      if (!ws) throw new Error('Sablonda "' + PLAN_SHEET_NAME + '" sekmesi bulunamadi.');

      ws.getCell('C2').value = `${MONTH_NAMES_RU[ay - 1]} ${yil} / ${yil} ${MONTH_NAMES_TR[ay - 1]}`;
      if (onaylayan) ws.getCell('H2').value = onaylayan;
      if (sorumlu) ws.getCell('M2').value = sorumlu;

      // Sablonda hazir bicimlendirilmis satir sayisi yetmezse, son satirin
      // bicimini koruyarak yeni satirlar ekliyoruz (toplam satirlari da otomatik asagi kayar).
      const neededLastRow = PLAN_FIRST_DATA_ROW + rows.length - 1;
      if (neededLastRow > PLAN_LAST_TEMPLATE_DATA_ROW) {
        const extra = neededLastRow - PLAN_LAST_TEMPLATE_DATA_ROW;
        ws.duplicateRow(PLAN_LAST_TEMPLATE_DATA_ROW, extra, true);
      }

      rows.forEach((r, i) => {
        const rowNum = PLAN_FIRST_DATA_ROW + i;
        const miktar = r.Miktar;
        ws.getCell(`A${rowNum}`).value = i + 1;
        ws.getCell(`B${rowNum}`).value = r.Kategori || '';
        ws.getCell(`C${rowNum}`).value = r.Ad;
        ws.getCell(`D${rowNum}`).value = r.Birim || '';
        ws.getCell(`E${rowNum}`).value = miktar;
        if (!r.NoPrice) {
          const fiyat = r.FiyatTRY ? Number(r.FiyatTRY) : toTRY(Number(r.Fiyat) || 0, r.ParaBirimi, r.RateDate);
          ws.getCell(`F${rowNum}`).value = fiyat;
          ws.getCell(`G${rowNum}`).value = { formula: `E${rowNum}*F${rowNum}` };
          ws.getCell(`H${rowNum}`).value = 0.2;
          ws.getCell(`I${rowNum}`).value = { formula: `G${rowNum}*(1+H${rowNum})` };
        } // NoPrice ise F/G/H/I kasten bos birakilir - "bilinmiyor" ile "0/bedava" karismasin
        ws.getCell(`J${rowNum}`).value = r.Oncelik || '';
        ws.getCell(`K${rowNum}`).value = DURUM_MAP[r.Durum] || r.Durum || '';
        ws.getCell(`L${rowNum}`).value = r.Departman || '';
        ws.getCell(`M${rowNum}`).value = r.OdemeTuru || '';
        ws.getCell(`N${rowNum}`).value = r.TahminiTeslimatTarihi || '';

        // Not sutununa: serbest not + kargo takip no + (fiyati varsa) odeme
        // durumu + varsa proforma/fatura belge linkleri - hepsi " / " ile
        // ayrilarak TEK hucrede birlesik gosteriliyor.
        const notParts = [];
        if (r.PersonelAdi) notParts.push(r.PersonelAdi);
        if (r.Not) notParts.push(r.Not);
        if (r.KargoTakipNo) notParts.push(`Kargo: ${r.KargoTakipNo}`);
        if (r.Fiyat) notParts.push(ODEME_DURUMU_EXPORT_MAP[r.OdemeDurumu] || ODEME_DURUMU_EXPORT_MAP.Odenmedi);
        const bagliFatura = r.FaturaID ? faturaMap[r.FaturaID] : null;
        if (bagliFatura) notParts.push(`Счёт / Fatura: ${faturaLabel(bagliFatura)}`);
        // Bagli faturanin belgeleri + satirin kendi proforma/fatura belgeleri (tekrarsiz).
        const links = effectiveDocs(r, faturaMap);
        // Linkler numarali ve her biri ayri satirda: "1.Fatura Link: https://...".
        let notText = notParts.join(' / ');
        if (links.length) notText += (notText ? '\n' : '') + links.map((u, li) => `${li + 1}.Fatura Link: ${u}`).join('\n');
        const noteCell = ws.getCell(`O${rowNum}`);
        noteCell.value = notText;
        noteCell.alignment = { ...(noteCell.alignment || {}), wrapText: true, vertical: 'top' };
      });

      // Kullanilan kurlari (birden fazla tarih olabilir), kaynagiyla birlikte
      // dosyanin kendi icine de ekliyoruz - boylece raporu alan kisi Google
      // Sheet'e bakmadan da "hangi tarihte hangi kur kullanildi" gorur. Kurlar
      // hem onceden kaydedilmis FiyatTRY'den (efektif kur geri hesaplanarak)
      // hem de eski kayitlar icin canli cekilen kurlardan gelebilir.
      const kurTable = {};
      function ensureKurRow(tarih) {
        if (!kurTable[tarih]) kurTable[tarih] = { tarih: tarih, usd: '', eur: '', rub: '', kaynak: '' };
        return kurTable[tarih];
      }
      rows.forEach((r) => {
        if (!r.ParaBirimi || r.ParaBirimi === 'TRY' || !r.RateDate) return;
        const row = ensureKurRow(r.RateDate);
        if (r.FiyatTRY && r.Fiyat) {
          const eff = Math.round((Number(r.FiyatTRY) / Number(r.Fiyat)) * 10000) / 10000;
          const colKey = r.ParaBirimi.toLowerCase();
          if (colKey in row && !row[colKey]) row[colKey] = eff;
          if (!row.kaynak) row.kaynak = 'TCMB (T.C. Merkez Bankasi) - kayitta saklanan kur';
        } else {
          const rt = ratesByDate[r.RateDate];
          if (rt) {
            row.usd = row.usd || rt.USD || '';
            row.eur = row.eur || rt.EUR || '';
            row.rub = row.rub || rt.RUB || '';
            row.kaynak = row.kaynak || 'TCMB (T.C. Merkez Bankasi)';
          } else if (!row.kaynak) {
            row.kaynak = 'Kur bulunamadi - cevrilmedi';
          }
        }
      });

      const kurWs = workbook.addWorksheet('Kur Bilgisi');
      kurWs.columns = [
        { header: 'Tarih', key: 'tarih', width: 14 },
        { header: 'USD/TRY', key: 'usd', width: 12 },
        { header: 'EUR/TRY', key: 'eur', width: 12 },
        { header: 'RUB/TRY', key: 'rub', width: 12 },
        { header: 'Kaynak', key: 'kaynak', width: 34 }
      ];
      kurWs.getRow(1).font = { bold: true };
      Object.values(kurTable).sort((a, b) => a.tarih.localeCompare(b.tarih)).forEach((row) => kurWs.addRow(row));

      const outBuffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Satin_Alma_Plani_${MONTH_NAMES_TR[ay - 1]}_${yil}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={t('needs_monthly_plan')}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" onClick={buildAndDownload} disabled={loading}>
            {loading ? '...' : t('needs_monthly_plan_export')}
          </button>
        </>
      }
    >
      <div className="field">
        <label>{t('needs_monthly_plan_month')}</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <div className="field">
        <label>{t('needs_date_scope_label')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn btn-sm ${noPriceScope === 'month' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setNoPriceScope('month')}
          >
            {t('needs_no_price_scope_month')}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${noPriceScope === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setNoPriceScope('all')}
          >
            {t('needs_no_price_scope_all')}
          </button>
        </div>
        <div className="page-sub" style={{ marginTop: 4 }}>{t('needs_date_scope_hint')}</div>
      </div>
      <div className="field">
        <label>{t('needs_monthly_plan_statuses')}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { key: 'Bekleniyor', label: t('needs_pending') },
            { key: 'Onaylandi', label: t('needs_approved') },
            { key: 'Siparis Verildi', label: t('needs_ordered') },
            { key: 'Yolda', label: t('needs_in_transit') },
            { key: 'KismenAlindi', label: t('needs_partial') },
            { key: 'Karsilandi', label: t('needs_fulfilled') }
          ].map((d) => (
            <button
              key={d.key}
              type="button"
              className={`btn btn-sm ${durumlar.includes(d.key) ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => toggleDurum(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={faturaOnly} onChange={(e) => setFaturaOnly(e.target.checked)} />
          {t('needs_plan_fatura_only')}
        </label>
      </div>
      {items && (
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeEnvanter} onChange={(e) => setIncludeEnvanter(e.target.checked)} />
            {t('needs_include_envanter')}
          </label>
          <div className="page-sub" style={{ marginTop: 4 }}>{t('needs_include_envanter_hint')}</div>
        </div>
      )}
      <div className="field">
        <label>{t('needs_monthly_plan_approver')}</label>
        <input value={onaylayan} onChange={(e) => setOnaylayan(e.target.value)} placeholder={t('needs_monthly_plan_optional')} />
      </div>
      <div className="field">
        <label>{t('needs_monthly_plan_responsible')}</label>
        <input value={sorumlu} onChange={(e) => setSorumlu(e.target.value)} placeholder={t('needs_monthly_plan_optional')} />
      </div>
      <div className="page-sub">{t('needs_monthly_plan_hint')}</div>
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}

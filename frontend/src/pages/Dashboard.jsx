import { accessSummary, resLabel } from '../accessResources.jsx';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { useLang, translateStatus, translateCategory } from '../i18n.jsx';

const CURRENCY_SYMBOL = { TRY: '₺', USD: '$', EUR: '€', RUB: '₽' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [movements, setMovements] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [rates, setRates] = useState(null);
  const [sarf, setSarf] = useState([]);
  const [sarfLokasyonFilter, setSarfLokasyonFilter] = useState('');
  const [employees, setEmployees] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { lang, t } = useLang();

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(e.message));
    api.getMovements().then((m) => setMovements(m.slice(-6).reverse())).catch(() => {});
    api.getNeeds().then(setNeeds).catch(() => {});
    api.getCurrentRates().then(setRates).catch(() => {});
    api.getSarfMalzemeleri().then(setSarf).catch(() => {});
    api.getEmployees().then(setEmployees).catch(() => {});
    api.getInventory().then(setItems).catch(() => {});
  }, []);

  if (error) return <div className="empty-state">Hata: {error}</div>;
  if (!data) return <div className="spinner" />;

  const durumEntries = Object.entries(data.byDurum || {}).sort((a, b) => b[1] - a[1]);
  const kategoriEntries = Object.entries(data.byKategori || {}).sort((a, b) => b[1] - a[1]);
  const lokasyonEntries = Object.entries(data.byLokasyon || {}).sort((a, b) => b[1] - a[1]);
  const maxDurum = Math.max(1, ...durumEntries.map((d) => d[1]));

  // Ihtiyac Listesi'ndeki paralari, henuz harcanmamis (Bekleyen - planlanan) ile
  // zaten harcanmis (Siparis Verildi - odenmis) olarak ayri gosteriyoruz. Bu, Envanter'in
  // genel toplamini (yukaridaki Butce karti) HICBIR SEKILDE etkilemez, ayri bir gostergedir.
  function convertToThreeCurrencies(needsList) {
    let inTRY = 0;
    needsList.forEach((n) => {
      // FiyatTRY, backend'de kaydin dogru tarihindeki (Planlanan/Siparis Tarihi)
      // gercek TCMB kuruyla ONCEDEN hesaplanip saklanir - "bugunku kur" ile
      // karismasin diye burada TEKRAR hesaplamiyoruz, direkt kullaniyoruz.
      if (n.FiyatTRY) { inTRY += Number(n.FiyatTRY); return; }
      // Bu alan henuz olusturulmadan once kaydedilmis eski kayitlar icin
      // (FiyatTRY bos) guncel kurla kaba bir tahmin yapiyoruz.
      if (!n.Fiyat || !rates) return;
      const cur = n.ParaBirimi || 'TRY';
      const val = Number(n.Fiyat);
      inTRY += cur === 'TRY' ? val : (rates[cur] ? val * rates[cur] : 0);
    });
    if (!rates || !rates.USD) return { usd: null, try: inTRY, rub: null };
    return { usd: inTRY / rates.USD, try: inTRY, rub: rates.RUB ? inTRY / rates.RUB : null };
  }

  const hasNeedsBudget = needs.some((n) => (n.Durum === 'Bekleniyor' || n.Durum === 'Siparis Verildi') && n.Fiyat);

  // Yakinda ise baslayacak (veya baslama tarihi gecmis ama hala BILGISAYARI
  // olmayan) kisileri buluyoruz - IT'nin onceden hazirlik yapabilmesi icin.
  // ONEMLI: burada SADECE bilgisayar (Dizustu/Masaustu) sayilir - monitor,
  // mouse, telefon vb. baska bir sey atanmis olmasi kisiyi bu listeden
  // DUSURMEZ, cunku asil kritik eksik olan bilgisayardir (monitor onemli
  // ama bilgisayar kadar degil). Tarihi hic girilmemis olanlar HER ZAMAN
  // gosterilir (bilgi eksik, kontrol edilmeli); tarihi olanlar icin gelecege
  // sadece 2 hafta sinir konur, gecmise (ne kadar gecikmis olursa olsun)
  // sinir konmaz.
  const PC_KATEGORILERI = ['Dizustu Bilgisayar', 'Masaustu Bilgisayar'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingStarters = employees
    .filter((e) => !e.ITMuaf && (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && (!e.Firma || e.Firma === 'STS-Akkuyu'))
    .map((e) => {
      // Kisi her iki bilgisayar kategorisinden de (Dizustu VE Masaustu) muafsa,
      // zaten "eksik bilgisayari" olamaz - hic gosterilmez.
      const muafList = e.MuafKategoriler ? e.MuafKategoriler.split(',') : [];
      if (PC_KATEGORILERI.every((k) => muafList.includes(k))) return null;
      const hasEquipment = items.some((a) => a.AtananKisi === e.AdSoyad && PC_KATEGORILERI.includes(a.Kategori));
      if (hasEquipment) return null;
      // Bu kisi icin zaten acik (henuz karsilanmamis) bir ihtiyac kaydi var mi -
      // varsa "ihtiyac listesine eklendi" rozetini gosterip tekrar ekle butonunu
      // gizliyoruz, karisikligi onlemek icin.
      const hasOpenNeed = needs.some((n) => n.PersonelAdi === e.AdSoyad && (n.Durum === 'Bekleniyor' || n.Durum === 'Siparis Verildi'));
      if (!e.PlanlananBaslangicTarihi) return { ...e, diffDays: null, noDate: true, hasOpenNeed };
      const target = new Date(e.PlanlananBaslangicTarihi);
      if (isNaN(target.getTime())) return { ...e, diffDays: null, noDate: true, hasOpenNeed };
      const diffDays = Math.round((target - today) / 86400000);
      return { ...e, diffDays, noDate: false, hasOpenNeed };
    })
    .filter((e) => e && (e.noDate || e.diffDays <= 14))
    .sort((a, b) => {
      if (a.noDate && b.noDate) return 0;
      if (a.noDate) return 1;
      if (b.noDate) return -1;
      return a.diffDays - b.diffDays;
    });

  // sts-org.com adresi olmayan calisanlar - IT'nin takip etmesi icin. Yakinda-
  // baslayacaklar listesiyle AYNI zaman penceresini kullanir: tarihi olmayanlar
  // her zaman gosterilir, tarihi 2 haftadan uzakta olanlar icin henuz acele yok.
  function withinStartWindow(e) {
    if (!e.PlanlananBaslangicTarihi) return true;
    const target = new Date(e.PlanlananBaslangicTarihi);
    if (isNaN(target.getTime())) return true;
    const diffDays = Math.round((target - today) / 86400000);
    return diffDays <= 14;
  }
  const missingComEmployees = employees.filter((e) => !e.ITMuaf && (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && (!e.Firma || e.Firma === 'STS-Akkuyu') && !(e.Email && e.Email.toLowerCase().includes('@sts-org.com')) && withinStartWindow(e));
  const hasForm = (e) => String(e.TeslimFormLink || '').trim() !== '';
  const assignedCount = {};
  items.forEach((a) => { if (a.AtananKisi) assignedCount[a.AtananKisi] = (assignedCount[a.AtananKisi] || 0) + 1; });
  const missingFormEmployees = employees.filter((e) => e.AktifMi === 'Aktif' && assignedCount[e.AdSoyad] && !hasForm(e));
  const muafEmployees = employees.filter((e) => e.ITMuaf);
  const accessSummaries = accessSummary(employees);

  // ---- Veri Butunlugu Kontrolu: sistemin DOGRU calismasi icin gereken
  // alanlar (statu degistiginde girilmesi gereken tarihler, HR eslestirmesi
  // icin Sicil No vb.) eksikse, bunu kullaniciya elle kesfetmesi yerine
  // burada acikca gosteriyoruz - raporlardaki sessiz sayisal sapmalarin
  // cogu buradan kaynaklaniyor. ----
  const dataGaps = [];
  employees.forEach((e) => {
    if (!e.AdSoyad) return;
    if ((e.AktifMi === 'Pasif' || e.AktifMi === 'Iptal') && !e.IstenAyrilmaTarihi) {
      dataGaps.push({ person: e.AdSoyad, field: e.AktifMi === 'Iptal' ? t('col_iptal_tarihi') : t('col_isten_ayrilma_tarihi') });
    }
    if (e.AktifMi === 'Beklemede' && !e.PlanlananBaslangicTarihi) {
      dataGaps.push({ person: e.AdSoyad, field: t('col_planned_start') });
    }
    if ((e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && !e.SicilNo) {
      dataGaps.push({ person: e.AdSoyad, field: t('col_sicil_no') });
    }
  });

  // ---- Ayrilis Takibi: yaklasan ayrilislar (tarihine 1 hafta veya daha az
  // kaldiysa, statu ne olursa olsun) + zaten Pasif/Iptal ama uzerinde hala
  // ekipman olan veya e-postasi kapatilmamis kisiler. ----
  const upcomingDepartures = employees
    .map((e) => {
      if (!e.IstenAyrilmaTarihi) return null;
      const d = new Date(e.IstenAyrilmaTarihi);
      if (isNaN(d.getTime())) return null;
      const diffDays = Math.round((d - today) / 86400000);
      if (diffDays < 0 || diffDays > 7) return null;
      return { ...e, diffDays };
    })
    .filter(Boolean)
    .sort((a, b) => a.diffDays - b.diffDays);

  const incompleteOffboarding = employees
    .filter((e) => e.AktifMi === 'Pasif' || e.AktifMi === 'Iptal')
    .map((e) => {
      const equipmentCount = items.filter((a) => a.AtananKisi === e.AdSoyad && a.Durum === 'Kullanimda').length;
      const emailOpen = !e.EmailKapatildi;
      if (equipmentCount === 0 && !emailOpen) return null;
      return { ...e, equipmentCount, emailOpen };
    })
    .filter(Boolean);

  // "Belirli Ekipmanlardan Muaf" - kim hangi kategoriden muaf, tek bakista.
  const partialMuafEmployees = employees
    .filter((e) => e.MuafKategoriler)
    .map((e) => ({ ...e, muafList: e.MuafKategoriler.split(',').filter(Boolean) }))
    .filter((e) => e.muafList.length > 0);

  // "sts-org.com Adresi Eksik Olanlar" listesini, email basvurusunda
  // gerekecek tum bilgilerle (onerilen kullanici adi + Kiril tam ad) tek
  // tikla Excel'e aktarir - dogrudan ilgili kisiye/HR'a gonderilebilir.
  function exportMissingComEmployees() {
    const rows = missingComEmployees.map((e) => ({
      [t('col_full_name')]: e.AdSoyad || '',
      [t('col_department')]: e.Departman || '',
      [t('col_title')]: e.Unvan || '',
      [t('col_father_name')]: e.BabaAdi || '',
      [t('col_email_username')]: e.EmailAdresName || '',
      [t('col_email_basvuru_adi')]: e.EmailBasvuruAdi || '',
      [t('employees_com_missing_current_email')]: e.Email || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 26 }, { wch: 34 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 32 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Eksik Email');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Eksik_STS-org-com_Email_${stamp}.xlsx`);
  }

  const bekleyenBudget = convertToThreeCurrencies(needs.filter((n) => n.Durum === 'Bekleniyor'));
  const siparisBudget = convertToThreeCurrencies(needs.filter((n) => n.Durum === 'Siparis Verildi'));
  // Siparis verilmis ama henuz (tam) odenmemis tutar - "siparis geldi ama fatura/odeme
  // sonra yapilacak" senaryosunu takip etmek icin ayri gosteriyoruz.
  const odenmemisBudget = convertToThreeCurrencies(needs.filter((n) => n.Durum === 'Siparis Verildi' && (n.OdemeDurumu || 'Odenmedi') !== 'Odendi'));
  const hasOdenmemisBudget = needs.some((n) => n.Durum === 'Siparis Verildi' && (n.OdemeDurumu || 'Odenmedi') !== 'Odendi' && n.Fiyat);

  const sarfLokasyonlar = [...new Set(sarf.map((m) => m.Lokasyon).filter(Boolean))];
  const filteredSarf = sarfLokasyonFilter ? sarf.filter((m) => m.Lokasyon === sarfLokasyonFilter) : sarf;
  const maxSarfStok = Math.max(1, ...filteredSarf.map((m) => Number(m.Stok) || 0));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('nav_dashboard')}</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="label">{t('report_total_assets')}</div>
          <div className="value">{data.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">{t('report_in_use')}</div>
          <div className="value">{data.byDurum?.Kullanimda || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">{t('report_in_stock')}</div>
          <div className="value">{data.byDurum?.Stok || 0}</div>
        </div>
        <div className="stat-card amber">
          <div className="label">{t('report_warranty_soon')}</div>
          <div className="value">{data.warrantyExpiringSoon}</div>
        </div>
        <div className="stat-card accent" style={{ borderLeftColor: 'var(--primary)' }}>
          <div className="label">{t('report_budget_total')} (USD)</div>
          <div className="value">${Number(data.totalUSD || 0).toLocaleString('tr-TR')}</div>
        </div>
      </div>

      {dataGaps.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--amber-soft)', borderColor: 'var(--amber)' }}>
          <div className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>🛠️ {t('dash_data_gaps_title')}</div>
          <div className="page-sub" style={{ marginBottom: 8 }}>{t('dash_data_gaps_desc')}</div>
          {dataGaps.map((g, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span onClick={() => navigate(`/calisanlar/${encodeURIComponent(g.person)}`)} style={{ cursor: 'pointer' }}>
                <strong>{g.person}</strong>
              </span>
              <span className="badge badge-amber">{g.field} {t('dash_data_gaps_missing_suffix')}</span>
            </div>
          ))}
        </div>
      )}

      {(upcomingDepartures.length > 0 || incompleteOffboarding.length > 0) && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
          <div className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>🚪 {t('dash_offboarding_title')}</div>
          {upcomingDepartures.length > 0 && (
            <>
              <div className="page-sub" style={{ marginTop: 8, marginBottom: 6, fontWeight: 600 }}>{t('dash_offboarding_upcoming')}</div>
              {upcomingDepartures.map((e) => (
                <div key={e.AdSoyad} onClick={() => navigate(`/calisanlar/${encodeURIComponent(e.AdSoyad)}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
                  <span><strong>{e.AdSoyad}</strong> · {e.Departman || '—'}</span>
                  <span className="badge badge-red">{e.diffDays === 0 ? t('employees_starts_today') : `${e.diffDays} ${t('usage_days_unit')}`}</span>
                </div>
              ))}
            </>
          )}
          {incompleteOffboarding.length > 0 && (
            <>
              <div className="page-sub" style={{ marginTop: 12, marginBottom: 6, fontWeight: 600 }}>{t('dash_offboarding_incomplete')}</div>
              {incompleteOffboarding.map((e) => (
                <div key={e.AdSoyad} onClick={() => navigate(`/calisanlar/${encodeURIComponent(e.AdSoyad)}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer', flexWrap: 'wrap', gap: 4 }}>
                  <span><strong>{e.AdSoyad}</strong> · {e.Departman || '—'}</span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    {e.equipmentCount > 0 && <span className="badge badge-red">{e.equipmentCount} {t('dash_offboarding_equipment_badge')}</span>}
                    {e.emailOpen && <span className="badge badge-red">{t('dash_offboarding_email_badge')}</span>}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {partialMuafEmployees.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginTop: 0, marginBottom: 8 }}>🛡️ {t('dash_partial_muaf_title')}</div>
          {partialMuafEmployees.map((e) => (
            <div key={e.AdSoyad} onClick={() => navigate(`/calisanlar/${encodeURIComponent(e.AdSoyad)}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
              <span><strong>{e.AdSoyad}</strong> · {e.Departman || '—'}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                {e.muafList.map((k) => <span key={k} className="badge badge-gray">{translateCategory(k, lang)}</span>)}
              </span>
            </div>
          ))}
        </div>
      )}

      {upcomingStarters.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
          <div className="section-title" style={{ marginTop: 0, marginBottom: 8 }}>📅 {t('dash_upcoming_starters_title')}</div>
          {upcomingStarters.map((e) => (
            <div key={e.AdSoyad} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span>
                <strong>{e.AdSoyad}</strong>
                <span className="page-sub"> · {e.Departman || '—'}{e.Unvan ? ` · ${e.Unvan}` : ''}</span>
                {' · '}
                {e.noDate
                  ? t('employees_no_start_date')
                  : e.diffDays > 0 ? `${e.diffDays} ${t('usage_days_unit')} ${t('employees_starts_in_suffix')}` : e.diffDays === 0 ? t('employees_starts_today') : `${Math.abs(e.diffDays)} ${t('usage_days_unit')} ${t('employees_days_overdue_suffix')}`}
                {e.hasOpenNeed && (
                  <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· ✓ {t('dash_already_in_needs_list')}</span>
                )}
              </span>
              {e.hasOpenNeed ? (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ihtiyaclar')}>
                  {t('nav_needs')}
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ihtiyaclar', { state: { quickAddPerson: e.AdSoyad, quickAddDate: e.PlanlananBaslangicTarihi || '' } })}>
                  + {t('employee_create_need_for_person')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {missingFormEmployees.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--amber-soft)', borderColor: 'var(--amber)' }}>
          <div className="section-title" style={{ marginTop: 0, marginBottom: 8 }}>📄 {t('handover_missing_title')} ({missingFormEmployees.length})</div>
          {missingFormEmployees.map((e) => (
            <div key={e.AdSoyad} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span><strong>{e.AdSoyad}</strong><span className="page-sub"> · {e.Departman || '—'} · {assignedCount[e.AdSoyad]} {t('employee_detail_assigned')}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/calisanlar/${encodeURIComponent(e.AdSoyad)}`)}>{t('employees_edit')}</button>
            </div>
          ))}
        </div>
      )}

      {missingComEmployees.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--amber-soft)', borderColor: 'var(--amber)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>⚠️ {t('employees_com_missing_title')}</div>
            <button className="btn btn-ghost btn-sm" onClick={exportMissingComEmployees}>📥 {t('btn_export_excel')}</button>
          </div>
          {missingComEmployees.map((e) => (
            <div key={e.AdSoyad} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span>
                <strong>{e.AdSoyad}</strong>
                <span className="page-sub"> · {e.Departman || '—'}{e.Unvan ? ` · ${e.Unvan}` : ''}</span>
                {e.EmailAdresName && <span className="page-sub"> · {e.EmailAdresName}@sts-org.com</span>}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/calisanlar/${encodeURIComponent(e.AdSoyad)}`)}>
                {t('employees_edit')}
              </button>
            </div>
          ))}
        </div>
      )}

      {accessSummaries.some((a) => a.missing.length > 0 || a.exempt.length > 0) && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--amber-soft)', borderColor: 'var(--amber)' }}>
          <div className="section-title" style={{ marginTop: 0, marginBottom: 8 }}>🔐 {t('access_dash_title')}</div>
          {accessSummaries.map(({ res, missing, exempt }) => (
            <div key={res.key} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                {resLabel(res, lang)} <span className="badge badge-amber">{t('access_missing')}: {missing.length}</span>
                {exempt.length > 0 && <span className="badge badge-gray" style={{ marginLeft: 6 }}>{t('access_exempt')}: {exempt.length}</span>}
              </div>
              {missing.length === 0 && <div className="page-sub">{t('access_none_missing')}</div>}
              {missing.map((e) => (
                <div key={e.AdSoyad} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span>
                    <strong>{e.AdSoyad}</strong>
                    <span className="page-sub"> · {e.Unvan || '—'} · {e.Departman || '—'}</span>
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/calisanlar/${encodeURIComponent(e.AdSoyad)}`)}>{t('employees_edit')}</button>
                </div>
              ))}
              {exempt.length > 0 && (
                <div className="page-sub" style={{ marginTop: 4 }}>
                  {t('access_exempt')}: {exempt.map((e) => e.AdSoyad).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {muafEmployees.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginTop: 0, marginBottom: 8 }}>🔕 {t('dash_muaf_title')}</div>
          <div className="page-sub" style={{ marginBottom: 8 }}>{t('dash_muaf_hint')}</div>
          {muafEmployees.map((e) => (
            <div key={e.AdSoyad} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span>
                <strong>{e.AdSoyad}</strong>
                <span className="page-sub"> · {e.Departman || '—'}</span>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/calisanlar/${encodeURIComponent(e.AdSoyad)}`)}>
                {t('employees_edit')}
              </button>
            </div>
          ))}
        </div>
      )}

      {data.pendingNeeds > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--amber-soft)', borderColor: 'var(--amber)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>
              <strong>{data.pendingNeeds}</strong> bekleyen personel/ekipman ihtiyaci var.
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ihtiyaclar')}>{t('nav_needs')}</button>
          </div>
        </div>
      )}

      {hasNeedsBudget && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginTop: 0 }}>{t('dash_needs_budget_title')}</div>
          <div className="page-sub" style={{ marginBottom: 14 }}>{t('dash_needs_budget_note')}</div>
          <div className="budget-currency-wrap">
            <table className="budget-currency-table">
              <thead>
                <tr><th></th><th>USD</th><th>TRY</th><th>RUB</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('dash_needs_pending')}</td>
                  <td>${(bekleyenBudget?.usd || 0).toLocaleString('tr-TR')}</td>
                  <td>₺{(bekleyenBudget?.try || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                  <td>{bekleyenBudget?.rub !== null && bekleyenBudget?.rub !== undefined ? `₽${bekleyenBudget.rub.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '—'}</td>
                </tr>
                <tr className="budget-row-kdv">
                  <td>{t('dash_needs_ordered')}</td>
                  <td>${(siparisBudget?.usd || 0).toLocaleString('tr-TR')}</td>
                  <td>₺{(siparisBudget?.try || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                  <td>{siparisBudget?.rub !== null && siparisBudget?.rub !== undefined ? `₽${siparisBudget.rub.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '—'}</td>
                </tr>
                {hasOdenmemisBudget && (
                  <tr>
                    <td>⚠️ {t('dash_needs_unpaid')}</td>
                    <td>${(odenmemisBudget?.usd || 0).toLocaleString('tr-TR')}</td>
                    <td>₺{(odenmemisBudget?.try || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                    <td>{odenmemisBudget?.rub !== null && odenmemisBudget?.rub !== undefined ? `₽${odenmemisBudget.rub.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '—'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sarf.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            <div className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>🖨️ {t('sarf_title')}</div>
            {sarfLokasyonlar.length > 1 && (
              <select
                value={sarfLokasyonFilter}
                onChange={(e) => setSarfLokasyonFilter(e.target.value)}
                style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }}
              >
                <option value="">{t('sarf_all_locations')}</option>
                {sarfLokasyonlar.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
          </div>
          <div className="page-sub" style={{ marginBottom: 14 }}>{t('sarf_dash_note')}</div>
          {filteredSarf.map((m) => (
            <div key={m.ID} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                <span>{m.Ad}{m.Lokasyon ? <span className="page-sub"> · {m.Lokasyon}</span> : ''}</span>
                <span className="mono">{m.Stok || 0} {m.Birim || ''} {m.DusukStok && '⚠️'}</span>
              </div>
              <div style={{ background: 'var(--gray-soft)', borderRadius: 999, height: 7 }}>
                <div style={{ width: `${Math.min(100, ((Number(m.Stok) || 0) / maxSarfStok) * 100)}%`, background: m.DusukStok ? 'var(--red)' : 'var(--accent)', height: '100%', borderRadius: 999 }} />
              </div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm no-print" style={{ marginTop: 6 }} onClick={() => navigate('/sarf-malzemeleri')}>{t('nav_sarf')} →</button>
        </div>
      )}

      <div className="two-col-wide">
        <div className="card card-pad">
          <div className="section-title" style={{ marginTop: 0 }}>{t('report_status_dist')}</div>
          {durumEntries.length === 0 && <div className="page-sub">{t('report_no_movements_short')}</div>}
          {durumEntries.map(([status, count]) => (
            <div key={status} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                <span>{translateStatus(status, lang)}</span>
                <span className="mono">{count}</span>
              </div>
              <div style={{ background: 'var(--gray-soft)', borderRadius: 999, height: 7 }}>
                <div style={{ width: `${(count / maxDurum) * 100}%`, background: 'var(--accent)', height: '100%', borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card card-pad">
          <div className="section-title" style={{ marginTop: 0 }}>{t('report_budget_total')}</div>
          <div className="page-sub" style={{ marginBottom: 14 }}>{t('budget_calc_note')}</div>
          <div className="budget-currency-wrap">
            <table className="budget-currency-table">
              <thead>
                <tr><th></th><th>USD</th><th>TRY</th><th>RUB</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('kdv_haric_label')}</td>
                  <td>${Number(data.totalUSD || 0).toLocaleString('tr-TR')}</td>
                  <td>₺{Number(data.totalTRY || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                  <td>₽{Number(data.totalRUB || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                </tr>
                <tr className="budget-row-kdv">
                  <td>{t('kdv_dahil_label')} (%20)</td>
                  <td>${(Number(data.totalUSD || 0) * 1.2).toLocaleString('tr-TR')}</td>
                  <td>₺{(Number(data.totalTRY || 0) * 1.2).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                  <td>₽{(Number(data.totalRUB || 0) * 1.2).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="section-title">{t('col_category')}</div>
          {kategoriEntries.slice(0, 6).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0' }}>
              <span>{translateCategory(k, lang)}</span>
              <span className="mono">{v}</span>
            </div>
          ))}

          <div className="section-title">{t('col_location')}</div>
          {lokasyonEntries.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0' }}>
              <span>{k}</span>
              <span className="mono">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {movements.length > 0 && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('nav_movements')}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/hareketler')}>{t('all')}</button>
          </div>
          {movements.map((m) => (
            <div key={m.HareketID} onClick={() => navigate(`/envanter/${m.VarlikID}`)} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
              <span>
                <span className="badge badge-gray" style={{ marginRight: 8 }}>{m.IslemTuru}</span>
                <span className="mono">{m.VarlikID}</span> — {m.OncekiKullanici || '—'} → {m.YeniKullanici || '—'}
              </span>
              <span className="page-sub">{m.Tarih}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

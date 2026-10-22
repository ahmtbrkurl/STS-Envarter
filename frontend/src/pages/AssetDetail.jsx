import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, BASE_URL } from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import AssetForm from './AssetForm.jsx';
import { useLang, translateCategory } from '../i18n.jsx';

// GitHub Pages'te yayinladiginizda gercek adresinizi buraya yazin,
// veya .env icinde VITE_PUBLIC_BASE_URL olarak tanimlayin.
const PUBLIC_BASE = import.meta.env.VITE_PUBLIC_BASE_URL || `${window.location.origin}${window.location.pathname}#/asset/`;

// ============ Kullanim analizi icin varsayimlar (Faz 3) ============
// Gercek marka/model bazli enerji tuketimi verisi olmadigi icin KATEGORI bazli
// KABA ortalamalar kullaniliyor - bu yuzden sonuclar acikca "TAHMINI" olarak
// gosteriliyor. Elektrik sebekesi karbon yogunlugu Turkiye ortalama tahminidir.
const CATEGORY_POWER_W = {
  'Dizustu Bilgisayar': 50, 'Masaustu Bilgisayar': 150, 'Monitor': 30, 'Yazici': 300,
  'Telefon': 5, 'Tablet': 10, 'Ag Cihazi': 15, 'Sunucu': 400, 'Diger': 60
};
const CATEGORY_LIFE_MONTHS = {
  'Dizustu Bilgisayar': 36, 'Masaustu Bilgisayar': 48, 'Monitor': 60, 'Yazici': 60,
  'Telefon': 24, 'Tablet': 36, 'Ag Cihazi': 60, 'Sunucu': 60, 'Diger': 36
};
const TR_GRID_CARBON_KG_PER_KWH = 0.45; // Turkiye elektrik sebekesi icin kaba tahmin

// 6 gun/hafta (Pazar tatil sayilir) x 8 saat/gun is saatini hesaplar.
function businessHoursBetween(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0;
  let days = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (cur < endDay) {
    if (cur.getDay() !== 0) days++; // 0 = Pazar
    cur.setDate(cur.getDate() + 1);
  }
  return days * 8;
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [lists, setLists] = useState({});
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [sarfCost, setSarfCost] = useState(null);
  const { lang, t } = useLang();

  function load() {
    Promise.all([api.getInventory(), api.getMovements(), api.getLists(), api.getEmployees()])
      .then(([inv, mv, l, emp]) => {
        const found = inv.find((a) => a.ID === id) || null;
        setAsset(found);
        setAllItems(inv);
        setMovements(mv.filter((m) => m.VarlikID === id).reverse());
        setLists(l);
        setEmployees(emp);
        if (found?.Kategori === 'Yazici') {
          api.getAssetSarfCost(id).then(setSarfCost).catch(() => {});
        }
      })
      .catch((e) => setLoadError(e.message));
  }

  useEffect(load, [id]);

  // ============ Kullanim gecmisi / karbon / amortisman analizi (Faz 3) ============
  const usageStats = useMemo(() => {
    if (!asset) return null;
    const startAnchor = asset.SatinAlmaTarihi || asset.OlusturmaTarihi;
    if (!startAnchor) return null;
    const asc = [...movements].sort((a, b) => (a.Tarih || '').localeCompare(b.Tarih || ''));

    const periods = [];
    let holder = '';
    let periodStart = startAnchor;
    asc.forEach((m) => {
      periods.push({ holder, start: periodStart, end: m.Tarih });
      holder = m.YeniKullanici || '';
      periodStart = m.Tarih;
    });
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    periods.push({ holder, start: periodStart, end: nowStr });

    const byUser = {};
    let stockHours = 0;
    periods.forEach((p) => {
      const hours = businessHoursBetween(p.start, p.end);
      if (p.holder) byUser[p.holder] = (byUser[p.holder] || 0) + hours;
      else stockHours += hours;
    });

    const totalUserHours = Object.values(byUser).reduce((s, h) => s + h, 0);
    const lifetimeDays = Math.max(0, Math.round((new Date() - new Date(startAnchor)) / 86400000));

    return { byUser, stockHours, totalUserHours, uniqueUsers: Object.keys(byUser).length, lifetimeDays };
  }, [asset, movements]);

  const carbonEstimate = useMemo(() => {
    if (!usageStats || !asset) return null;
    const watt = CATEGORY_POWER_W[asset.Kategori] ?? CATEGORY_POWER_W.Diger;
    const kwh = (usageStats.totalUserHours * watt) / 1000;
    return { watt, kwh: Math.round(kwh * 10) / 10, kg: Math.round(kwh * TR_GRID_CARBON_KG_PER_KWH * 10) / 10 };
  }, [usageStats, asset]);

  const depreciation = useMemo(() => {
    if (!asset || !asset.Fiyat || !asset.SatinAlmaTarihi) return null;
    const lifeMonths = CATEGORY_LIFE_MONTHS[asset.Kategori] ?? CATEGORY_LIFE_MONTHS.Diger;
    const purchase = new Date(asset.SatinAlmaTarihi);
    if (isNaN(purchase.getTime())) return null;
    const now = new Date();
    const elapsedMonths = Math.max(0, (now.getFullYear() - purchase.getFullYear()) * 12 + (now.getMonth() - purchase.getMonth()));
    const fiyat = Number(asset.Fiyat);
    const monthlyRate = fiyat / lifeMonths;
    const amortisman = Math.min(fiyat, monthlyRate * elapsedMonths);
    return {
      lifeMonths, elapsedMonths, fiyat, cur: asset.ParaBirimi,
      amortisman: Math.round(amortisman * 100) / 100,
      kalanDeger: Math.round(Math.max(0, fiyat - amortisman) * 100) / 100
    };
  }, [asset]);

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const base64 = await fileToBase64(file);
      const res = await api.uploadFile({ assetId: id, filename: file.name, mimeType: file.type, base64 });
      load();
      alert('Belge yuklendi: ' + file.name);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  if (loadError) return <div className="empty-state">Hata: {loadError}</div>;
  if (!asset) return <div className="spinner" />;

  const qrUrl = `${PUBLIC_BASE}${id}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/envanter')} style={{ marginBottom: 10 }}>← {t('detail_back')}</button>
          <div className="page-title mono">{asset.ID}</div>
          <div className="page-sub">{translateCategory(asset.Kategori, lang)} · {asset.Marka} {asset.Model}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>{t('detail_edit')}</button>
      </div>

      <div className="chip-row" style={{ marginTop: -10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/teslim-formu?asset=${asset.ID}`)}>
          📄 {t('detail_handover_btn')}
        </button>
      </div>

      <div className="two-col-detail">
        <div className="card card-pad">
          <div className="chip-row">
            <StatusBadge status={asset.Durum} lang={lang} />
            <span className="badge badge-gray">{asset.Lokasyon}</span>
          </div>

          <div className="detail-grid">
            <div><div className="k">{t('col_serial')}</div><div className="v mono">{asset.SeriNo || '—'}</div></div>
            <div><div className="k">{t('col_hostname')}</div><div className="v mono">{asset.Hostname || '—'}</div></div>
            <div><div className="k">{t('col_mac')}</div><div className="v mono">{asset.MAC || '—'}</div></div>
            <div><div className="k">{t('col_ip')}</div><div className="v mono">{asset.IPAdresi || '—'}</div></div>
            <div><div className="k">{t('col_color')}</div><div className="v">{asset.Renk || '—'}</div></div>
            <div><div className="k">{t('col_assigned')}</div><div className="v">{asset.AtananKisi || '—'}</div></div>
            <div><div className="k">{t('form_assign_date')}</div><div className="v">{asset.AtamaTarihi || '—'}</div></div>
            <div><div className="k">{t('col_supplier')}</div><div className="v">{asset.Tedarikci || '—'}</div></div>
            <div><div className="k">{t('form_purchase_date')}</div><div className="v">{asset.SatinAlmaTarihi || '—'}</div></div>
            <div><div className="k">{t('form_delivery_date')}</div><div className="v">{asset.TeslimAlmaTarihi || '—'}</div></div>
            <div><div className="k">{t('col_price')}</div><div className="v mono">{asset.Fiyat ? `${asset.Fiyat} ${asset.ParaBirimi}` : '—'}</div></div>
            <div><div className="k">{t('col_warranty')}</div><div className="v">{asset.GarantiBitisTarihi || '—'}</div></div>
          </div>

          {asset.Notlar && (
            <>
              <div className="section-title">{t('col_notes')}</div>
              <div style={{ fontSize: 13.5 }}>{asset.Notlar}</div>
            </>
          )}

          <div className="section-title">{t('detail_documents')}</div>
          {asset.FaturaLink
            ? asset.FaturaLink.split(',').map((url, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <a href={url.trim()} target="_blank" rel="noreferrer">{`${i + 1}`} ↗</a>
                </div>
              ))
            : <div className="page-sub" style={{ marginBottom: 10 }}>{t('detail_no_docs')}</div>}
          <label className="btn btn-ghost btn-sm" style={{ display: 'inline-flex' }}>
            {uploading ? '...' : `+ ${t('detail_upload')}`}
            <input type="file" hidden onChange={handleFileUpload} disabled={uploading} />
          </label>
          {uploadError && <div className="error-text" style={{ marginTop: 8 }}>Yukleme hatasi: {uploadError}</div>}

          <div className="section-title">{t('detail_history')}</div>
          {movements.length === 0 && <div className="page-sub">{t('detail_no_history')}</div>}
          {movements.map((m) => (
            <div key={m.HareketID} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{m.IslemTuru}</strong>
                <span className="page-sub">{m.Tarih}</span>
              </div>
              <div className="page-sub" style={{ marginTop: 3 }}>
                {m.OncekiKullanici || '—'} → {m.YeniKullanici || '—'}
                {m.OncekiDurum !== m.YeniDurum && ` · ${m.OncekiDurum || '—'} → ${m.YeniDurum || '—'}`}
              </div>
              {m.IslemYapan && <div className="page-sub">{t('detail_performed_by')}: {m.IslemYapan}</div>}
            </div>
          ))}
        </div>

        <div className="card card-pad" style={{ alignSelf: 'start' }}>
          <div className="section-title" style={{ marginTop: 0 }}>{t('detail_qr')}</div>
          <div className="qr-box">
            <QRCodeSVG value={qrUrl} size={168} />
            <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{asset.SeriNo || asset.ID}</span>
            <span className="page-sub" style={{ wordBreak: 'break-all', textAlign: 'center' }}>{qrUrl}</span>
          </div>
          <p className="page-sub" style={{ marginTop: 12 }}>
            {t('detail_qr_note')}
          </p>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => window.print()}>
            {t('btn_print').split(' /')[0]}
          </button>
        </div>
      </div>

      {usageStats && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginTop: 0 }}>{t('usage_analysis_title')}</div>
          <div className="page-sub" style={{ marginBottom: 12 }}>{t('usage_analysis_desc')}</div>

          <div className="detail-grid" style={{ marginBottom: 16 }}>
            <div><div className="k">{t('usage_unique_users')}</div><div className="v">{usageStats.uniqueUsers}</div></div>
            <div><div className="k">{t('usage_total_hours')}</div><div className="v mono">{usageStats.totalUserHours} {t('usage_hours_unit')}</div></div>
            <div><div className="k">{t('usage_stock_hours')}</div><div className="v mono">{usageStats.stockHours} {t('usage_hours_unit')}</div></div>
            <div><div className="k">{t('usage_lifetime_days')}</div><div className="v mono">{usageStats.lifetimeDays} {t('usage_days_unit')}</div></div>
          </div>

          {Object.keys(usageStats.byUser).length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>{t('usage_by_user')}</div>
              <table className="report-table" style={{ marginBottom: 16 }}>
                <tbody>
                  {Object.entries(usageStats.byUser).map(([name, hours]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{hours} {t('usage_hours_unit')} ({Math.round(hours / 8)} {t('usage_days_unit')})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {carbonEstimate && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>🌱 {t('usage_carbon_title')}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{carbonEstimate.kg} kg CO₂</div>
              <div className="page-sub" style={{ marginBottom: 16 }}>
                {t('usage_carbon_assumption')}: {carbonEstimate.watt}W ({translateCategory(asset.Kategori, lang)}) × {usageStats.totalUserHours}{t('usage_hours_unit')} = {carbonEstimate.kwh} kWh × {TR_GRID_CARBON_KG_PER_KWH} kg/kWh
              </div>
            </>
          )}

          {depreciation && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>💰 {t('usage_depreciation_title')}</div>
              <div className="detail-grid">
                <div><div className="k">{t('usage_depreciation_life')}</div><div className="v">{depreciation.lifeMonths} {t('usage_months_unit')}</div></div>
                <div><div className="k">{t('usage_depreciation_elapsed')}</div><div className="v">{depreciation.elapsedMonths} {t('usage_months_unit')}</div></div>
                <div><div className="k">{t('usage_depreciation_amount')}</div><div className="v mono">{depreciation.amortisman} {depreciation.cur}</div></div>
                <div><div className="k">{t('usage_depreciation_remaining')}</div><div className="v mono">{depreciation.kalanDeger} {depreciation.cur}</div></div>
              </div>
              <div className="page-sub" style={{ marginTop: 8 }}>{t('usage_depreciation_note')}</div>
            </>
          )}
        </div>
      )}

      {asset.Kategori === 'Yazici' && sarfCost && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginTop: 0 }}>🖨️ {t('sarf_cost_title')}</div>
          {sarfCost.items.length === 0 ? (
            <div className="page-sub">{t('sarf_cost_none')}</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
                {Object.entries(sarfCost.totalByCurrency).map(([cur, val]) => (
                  <div key={cur}>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{Number(val).toLocaleString('tr-TR')}</div>
                    <div className="page-sub" style={{ fontSize: 11 }}>{cur}</div>
                  </div>
                ))}
              </div>
              <table className="report-table">
                <thead>
                  <tr><th>{t('col_date')}</th><th>{t('sarf_col_name')}</th><th style={{ textAlign: 'right' }}>{t('sarf_col_stock')}</th><th style={{ textAlign: 'right' }}>{t('sarf_col_unit_price')}</th></tr>
                </thead>
                <tbody>
                  {sarfCost.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.Tarih}</td>
                      <td>{it.Ad}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{it.Miktar}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{it.Tutar} {it.ParaBirimi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {showForm && (
        <AssetForm
          asset={asset}
          lists={lists}
          employees={employees}
          allItems={allItems}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

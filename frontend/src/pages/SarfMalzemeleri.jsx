import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';
import { useLang } from '../i18n.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { buildFaturaMap, faturaLabel } from '../faturaUtils.js';

export default function SarfMalzemeleri() {
  const [items, setItems] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [lists, setLists] = useState({});
  const [siparisler, setSiparisler] = useState([]);
  const [faturalar, setFaturalar] = useState([]);
  const [view, setView] = useState('stok'); // 'stok' | 'siparisler'
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [showSiparisForm, setShowSiparisForm] = useState(false);
  const [editSiparis, setEditSiparis] = useState(null);
  const [error, setError] = useState('');
  const { t, lang } = useLang();
  const { userName } = useAuth();

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.getSarfMalzemeleri(), api.getInventory(), api.getLists(), api.getSarfSiparisleri(), api.getFaturalar().catch(() => [])])
      .then(([sarf, inv, l, siparis, fat]) => {
        setFaturalar(fat);
        setItems(sarf);
        setPrinters(inv.filter((a) => a.Kategori === 'Yazici'));
        setLists(l);
        setSiparisler(siparis);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const faturaMap = useMemo(() => buildFaturaMap(faturalar), [faturalar]);

  async function markSiparisDurum(siparis, durum) {
    try {
      await api.updateSarfSiparis(siparis.ID, { Durum: durum });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function fulfillSiparis(siparis) {
    if (!confirm(t('sarf_siparis_fulfill_confirm'))) return;
    try {
      const res = await api.fulfillSarfSiparis(siparis.ID, userName);
      alert(res.message);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((m) => [m.Ad, m.Kategori, m.UyumluModeller, m.Lokasyon].join(' ').toLowerCase().includes(s));
  }, [items, search]);

  const lowStockCount = items.filter((m) => m.DusukStok).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('sarf_title')}</div>
          <div className="page-sub">{t('sarf_sub')}</div>
        </div>
        {view === 'stok'
          ? <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ {t('sarf_new')}</button>
          : <button className="btn btn-primary" onClick={() => setShowSiparisForm(true)}>+ {t('sarf_siparis_new')}</button>}
      </div>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        <button type="button" className={`badge ${view === 'stok' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setView('stok')} style={{ cursor: 'pointer' }}>
          {t('sarf_view_stock')}
        </button>
        <button type="button" className={`badge ${view === 'siparisler' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setView('siparisler')} style={{ cursor: 'pointer' }}>
          {t('sarf_view_orders')}
        </button>
      </div>

      {view === 'stok' && lowStockCount > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
          <span style={{ fontSize: 13 }}>⚠️ <strong>{lowStockCount}</strong> {t('sarf_low_stock_warning')}</span>
        </div>
      )}

      {view === 'stok' && (
        <div className="toolbar">
          <input className="search" placeholder={t('sarf_search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {loading && <div className="spinner" />}

      {error && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>⚠️ {t('error_loading_data')}: {error}</span>
            <button className="btn btn-ghost btn-sm" onClick={load}>{t('btn_retry')}</button>
          </div>
        </div>
      )}

      {!loading && view === 'siparisler' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('sarf_col_name')}</th>
                <th>{t('sarf_col_stock')}</th>
                <th>{t('col_supplier')}</th>
                <th>{t('col_price')}</th>
                <th>{t('col_status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {siparisler.map((s) => (
                <tr key={s.ID}>
                  <td style={{ fontWeight: 600 }}>{s.MalzemeAdi || '—'}</td>
                  <td>{s.Miktar} {s.Birim || ''}</td>
                  <td>{s.Tedarikci || '—'}</td>
                  <td className="mono" style={{ whiteSpace: 'normal' }}>
                    {s.Fiyat ? `${s.Fiyat} ${s.ParaBirimi || ''}` : '—'}
                    {s.Fiyat && (
                      <div style={{ marginTop: 4 }}>
                        <span className={`badge ${s.OdemeDurumu === 'Odendi' ? 'badge-accent' : s.OdemeDurumu === 'KismenOdendi' ? 'badge-amber' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                          {odemeDurumuLabel(s.OdemeDurumu || 'Odenmedi', lang)}
                        </span>
                      </div>
                    )}
                    {s.FaturaID && (
                      <div style={{ marginTop: 4 }}>
                        <span className="badge badge-gray" style={{ fontSize: 10 }} title={t('inv_linked_invoice')}>
                          🧾 {faturaLabel(faturaMap[s.FaturaID]) || s.FaturaID}
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${siparisStatusClass(s.Durum)}`}>{siparisDurumLabel(s.Durum, t)}</span>
                    {s.Durum === 'Siparis Verildi' && (s.KargoFirmasi || s.KargoTakipNo || s.TahminiTeslimatTarihi) && (
                      <div className="page-sub" style={{ marginTop: 4, fontSize: 11, whiteSpace: 'normal', lineHeight: 1.5 }}>
                        {s.KargoFirmasi && <div>{s.KargoFirmasi}</div>}
                        {s.KargoTakipNo && <div className="mono">{s.KargoTakipNo}</div>}
                        {s.TahminiTeslimatTarihi && <div>{t('needs_col_estimated_delivery')}: {s.TahminiTeslimatTarihi}</div>}
                      </div>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {/* Duzenle HER durumda acik - Karsilandi/Iptal siparislerde de odeme durumu ve belgeler guncellenebilsin. */}
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditSiparis(s)}>{t('btn_edit')}</button>
                    {s.Durum === 'Bekleniyor' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => markSiparisDurum(s, 'Siparis Verildi')}>{t('needs_mark_ordered')}</button>
                    )}
                    {(s.Durum === 'Bekleniyor' || s.Durum === 'Siparis Verildi') && (
                      <button className="btn btn-ghost btn-sm" onClick={() => fulfillSiparis(s)}>{t('needs_mark_fulfilled')}</button>
                    )}
                    {(s.Durum === 'Bekleniyor' || s.Durum === 'Siparis Verildi') && (
                      <button className="btn btn-danger btn-sm" onClick={() => markSiparisDurum(s, 'Iptal')}>{t('needs_cancel')}</button>
                    )}
                  </td>
                </tr>
              ))}
              {siparisler.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state">{t('no_results')}</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && view === 'stok' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('sarf_col_name')}</th>
                <th>{t('col_category')}</th>
                <th>{t('sarf_col_compatible')}</th>
                <th>{t('sarf_col_stock')}</th>
                <th>{t('col_location')}</th>
                <th>{t('sarf_col_unit_price')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.ID}>
                  <td style={{ fontWeight: 600 }}>{m.Ad}</td>
                  <td>{m.Kategori || '—'}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 220 }}>{m.UyumluModeller || '—'}</td>
                  <td>
                    <span className={`badge ${m.DusukStok ? 'badge-red' : 'badge-accent'}`}>
                      {m.Stok || 0} {m.Birim || ''} {m.DusukStok && '⚠️'}
                    </span>
                    <div className="page-sub" style={{ marginTop: 3, fontSize: 11 }}>{t('sarf_min')}: {m.MinStok || 0}</div>
                  </td>
                  <td>{m.Lokasyon || '—'}</td>
                  <td className="mono">{m.BirimFiyat ? `${m.BirimFiyat} ${m.ParaBirimi || ''}` : '—'}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setMoveTarget(m)}>{t('sarf_movement')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(m)}>{t('btn_edit')}</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state">{t('no_results')}</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <MaterialForm lists={lists} printers={printers} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
      {editTarget && (
        <MaterialForm material={editTarget} lists={lists} printers={printers} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); }} />
      )}
      {moveTarget && (
        <MovementModal material={moveTarget} printers={printers} onClose={() => setMoveTarget(null)} onSaved={() => { setMoveTarget(null); load(); }} />
      )}
      {showSiparisForm && (
        <SiparisForm items={items} lists={lists} onClose={() => setShowSiparisForm(false)} onSaved={() => { setShowSiparisForm(false); load(); }} />
      )}
      {editSiparis && (
        <SiparisForm siparis={editSiparis} items={items} lists={lists} faturaMap={faturaMap} onClose={() => setEditSiparis(null)} onSaved={() => { setEditSiparis(null); load(); }} />
      )}
    </div>
  );
}

function odemeDurumuLabel(key, lang) {
  const map = {
    TeklifFiyat: { tr: 'Teklif Fiyat', ru: 'Ценовое предложение', en: 'Price Quote' },
    Odenmedi: { tr: 'Ödenmedi', ru: 'Не оплачено', en: 'Not Paid' },
    KismenOdendi: { tr: 'Kısmen Ödendi', ru: 'Частично оплачено', en: 'Partially Paid' },
    Odendi: { tr: 'Ödendi', ru: 'Оплачено', en: 'Paid' }
  };
  return map[key]?.[lang] || map[key]?.tr || key;
}

function siparisStatusClass(durum) {
  if (durum === 'Karsilandi') return 'badge-accent';
  if (durum === 'Siparis Verildi') return 'badge-amber';
  if (durum === 'Iptal') return 'badge-gray';
  return 'badge-red';
}

function siparisDurumLabel(durum, t) {
  const map = {
    Bekleniyor: t('needs_pending'),
    'Siparis Verildi': t('needs_ordered'),
    Karsilandi: t('needs_fulfilled'),
    Iptal: t('needs_cancelled')
  };
  return map[durum] || durum;
}

const ODEME_DURUMU_OPTIONS = ['TeklifFiyat', 'Odenmedi', 'KismenOdendi', 'Odendi'];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============ Sarf Satin Alma Siparisi olusturma/duzenleme modali ============
function SiparisForm({ siparis, items, lists, faturaMap, onClose, onSaved }) {
  const { t, lang } = useLang();
  const isEdit = !!siparis;
  // Karsilanmis siparisin stoga eklenen miktari degismemeli; faturaya bagli
  // siparisin odeme bilgisini ise fatura belirler (Faturalar sayfasi).
  const fulfilled = isEdit && siparis.Durum === 'Karsilandi';
  const locked = isEdit && !!siparis.FaturaID;
  const linkedFatura = locked ? faturaMap?.[siparis.FaturaID] : null;
  const [malzemeId, setMalzemeId] = useState(siparis?.MalzemeID || '');
  const [form, setForm] = useState({
    Miktar: siparis?.Miktar || 1,
    Birim: siparis?.Birim || '',
    Tedarikci: siparis?.Tedarikci || '',
    Fiyat: siparis?.Fiyat || '',
    ParaBirimi: siparis?.ParaBirimi || 'TRY',
    SiparisTarihi: siparis?.SiparisTarihi || '',
    TahminiTeslimatTarihi: siparis?.TahminiTeslimatTarihi || '',
    KargoFirmasi: siparis?.KargoFirmasi || '',
    KargoTakipNo: siparis?.KargoTakipNo || '',
    OdemeDurumu: siparis?.OdemeDurumu || 'Odenmedi',
    OdemeTarihi: siparis?.OdemeTarihi || '',
    Notlar: siparis?.Notlar || ''
  });
  const [proformaLinks, setProformaLinks] = useState(siparis?.ProformaLink ? siparis.ProformaLink.split(',').map((s) => s.trim()).filter(Boolean) : []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const base64 = await fileToBase64(file);
      const res = await api.uploadFile({ assetId: siparis.ID, filename: file.name, mimeType: file.type, base64, sheetName: 'SarfSiparisleri', linkColumn: 'ProformaLink' });
      setProformaLinks((prev) => [...prev, res.url]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const selected = items.find((m) => m.ID === malzemeId);
      const payload = { ...form, MalzemeID: malzemeId, MalzemeAdi: selected?.Ad || siparis?.MalzemeAdi || '', Birim: form.Birim || selected?.Birim || '' };
      if (locked) { delete payload.OdemeDurumu; delete payload.OdemeTarihi; }
      if (fulfilled) delete payload.Miktar;
      if (isEdit) await api.updateSarfSiparis(siparis.ID, payload);
      else await api.createSarfSiparis(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? `${t('btn_edit')} · ${siparis.MalzemeAdi}` : t('sarf_siparis_new')}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" type="submit" form="sarf-siparis-form" disabled={saving}>{saving ? '...' : t('btn_save')}</button>
        </>
      }
    >
      <form id="sarf-siparis-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>{t('sarf_col_name')}</label>
          <select value={malzemeId} onChange={(e) => setMalzemeId(e.target.value)} required disabled={isEdit}>
            <option value="">—</option>
            {items.map((m) => <option key={m.ID} value={m.ID}>{m.Ad}</option>)}
          </select>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t('sarf_col_stock')}</label>
            <input type="number" min="1" value={form.Miktar} onChange={(e) => update('Miktar', e.target.value)} required disabled={fulfilled} />
          </div>
          <div className="field">
            <label>{t('sarf_col_unit')}</label>
            <input value={form.Birim} onChange={(e) => update('Birim', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>{t('col_supplier')}</label>
          <input list="sarf-siparis-tedarikci" value={form.Tedarikci} onChange={(e) => update('Tedarikci', e.target.value)} />
          <datalist id="sarf-siparis-tedarikci">
            {lists.Tedarikci?.map((td) => <option key={td} value={td} />)}
          </datalist>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t('col_price')}</label>
            <input type="number" step="0.01" value={form.Fiyat} onChange={(e) => update('Fiyat', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('col_currency')}</label>
            <select value={form.ParaBirimi} onChange={(e) => update('ParaBirimi', e.target.value)}>
              {(lists.ParaBirimi?.length ? lists.ParaBirimi : ['TRY', 'USD', 'EUR', 'RUB']).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t('needs_col_planned_date')}</label>
          <input type="date" value={form.SiparisTarihi} onChange={(e) => update('SiparisTarihi', e.target.value)} />
        </div>

        <div className="section-title" style={{ marginTop: 6 }}>{t('needs_shipping_section')}</div>
        <div className="form-grid">
          <div className="field">
            <label>{t('needs_col_estimated_delivery')}</label>
            <input type="date" value={form.TahminiTeslimatTarihi} onChange={(e) => update('TahminiTeslimatTarihi', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('needs_col_cargo_company')}</label>
            <select value={form.KargoFirmasi} onChange={(e) => update('KargoFirmasi', e.target.value)}>
              <option value="">—</option>
              {(lists.KargoFirmasi || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t('needs_col_tracking_no')}</label>
          <input value={form.KargoTakipNo} onChange={(e) => update('KargoTakipNo', e.target.value)} placeholder={t('needs_col_tracking_no_ph')} />
        </div>

        <div className="section-title" style={{ marginTop: 6 }}>{t('needs_payment_section')}</div>
        {locked && (
          <div className="field">
            <label>{t('inv_linked_invoice')}</label>
            <span className="badge badge-accent" style={{ alignSelf: 'flex-start' }}>
              🧾 {faturaLabel(linkedFatura) || siparis.FaturaID}{linkedFatura?.Tedarikci ? ` · ${linkedFatura.Tedarikci}` : ''}
            </span>
          </div>
        )}
        <div className="form-grid">
          <div className="field">
            <label>{t('needs_col_payment_status')}</label>
            <select value={form.OdemeDurumu} disabled={locked} onChange={(e) => update('OdemeDurumu', e.target.value)}>
              {ODEME_DURUMU_OPTIONS.map((k) => <option key={k} value={k}>{odemeDurumuLabel(k, lang)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('needs_col_payment_date')}</label>
            <input type="date" value={form.OdemeTarihi} disabled={locked} onChange={(e) => update('OdemeTarihi', e.target.value)} />
          </div>
        </div>
        {locked && <div className="page-sub" style={{ marginBottom: 10 }}>{t('inv_locked_note')}</div>}

        {isEdit && (
          <>
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
          </>
        )}

        <div className="field" style={{ marginTop: 10 }}>
          <label>{t('col_notes')}</label>
          <textarea rows={2} value={form.Notlar} onChange={(e) => update('Notlar', e.target.value)} />
        </div>
        {error && <div className="error-text">{error}</div>}
      </form>
    </Modal>
  );
}

function MaterialForm({ material, lists, printers, onClose, onSaved }) {
  const { t } = useLang();
  const isEdit = !!material;
  const [form, setForm] = useState({
    Ad: material?.Ad || '',
    Kategori: material?.Kategori || lists.SarfKategori?.[0] || '',
    UyumluModeller: material?.UyumluModeller || '',
    Stok: material?.Stok ?? 0,
    MinStok: material?.MinStok ?? 0,
    Birim: material?.Birim || 'Adet',
    Lokasyon: material?.Lokasyon || '',
    Tedarikci: material?.Tedarikci || '',
    BirimFiyat: material?.BirimFiyat || '',
    ParaBirimi: material?.ParaBirimi || 'TRY',
    Notlar: material?.Notlar || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  // Once lokasyon secilsin, "Uyumlu Yazici Ekle" acilir listesi SADECE o lokasyondaki
  // yazicilari gostersin - farkli ofislerdeki yazicilar karismasin.
  const locationPrinters = form.Lokasyon ? printers.filter((p) => p.Lokasyon === form.Lokasyon) : [];
  const selectedModels = form.UyumluModeller ? form.UyumluModeller.split(',').map((s) => s.trim()).filter(Boolean) : [];

  function addPrinterModel(printerId) {
    const p = printers.find((x) => x.ID === printerId);
    if (!p) return;
    const label = `${p.Marka} ${p.Model}`.trim();
    if (!selectedModels.includes(label)) {
      update('UyumluModeller', [...selectedModels, label].join(', '));
    }
  }

  function removeModel(label) {
    update('UyumluModeller', selectedModels.filter((m) => m !== label).join(', '));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) await api.updateSarfMalzeme(material.ID, form);
      else await api.createSarfMalzeme(form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? `${t('btn_edit')} · ${material.Ad}` : t('sarf_new')}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? '...' : t('btn_save')}</button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>{t('sarf_col_name')}</label>
          <input value={form.Ad} onChange={(e) => update('Ad', e.target.value)} required placeholder="orn. HP 87A Siyah Toner" />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t('col_category')}</label>
            <select value={form.Kategori} onChange={(e) => update('Kategori', e.target.value)}>
              <option value="">—</option>
              {(lists.SarfKategori || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('col_location')}</label>
            <select value={form.Lokasyon} onChange={(e) => update('Lokasyon', e.target.value)}>
              <option value="">—</option>
              {(lists.Lokasyon || []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t('sarf_col_compatible')}</label>
          {selectedModels.length > 0 && (
            <div className="chip-row" style={{ marginBottom: 8 }}>
              {selectedModels.map((m) => (
                <span key={m} className="badge badge-accent" style={{ cursor: 'pointer' }} onClick={() => removeModel(m)}>
                  {m} ✕
                </span>
              ))}
            </div>
          )}
          <select value="" onChange={(e) => addPrinterModel(e.target.value)} disabled={!form.Lokasyon}>
            <option value="">{form.Lokasyon ? t('sarf_add_printer_from_location') : t('sarf_pick_location_first')}</option>
            {locationPrinters.map((p) => (
              <option key={p.ID} value={p.ID}>{p.ID} · {p.Marka} {p.Model}</option>
            ))}
          </select>
          <div className="page-sub" style={{ marginTop: 4 }}>{t('sarf_compatible_hint')}</div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t('sarf_col_stock')}</label>
            <input type="number" min="0" value={form.Stok} onChange={(e) => update('Stok', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('sarf_min')}</label>
            <input type="number" min="0" value={form.MinStok} onChange={(e) => update('MinStok', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>{t('sarf_col_unit')}</label>
          <input value={form.Birim} onChange={(e) => update('Birim', e.target.value)} />
        </div>
        <div className="page-sub" style={{ marginBottom: 10 }}>{t('sarf_order_hint')}</div>
        <div className="field">
          <label>{t('col_notes')}</label>
          <textarea rows={2} value={form.Notlar} onChange={(e) => update('Notlar', e.target.value)} />
        </div>
        {error && <div className="error-text">{error}</div>}
      </form>
    </Modal>
  );
}

function MovementModal({ material, printers, onClose, onSaved }) {
  const { t } = useLang();
  const { userName } = useAuth();
  const [islemTuru, setIslemTuru] = useState('Cikis');
  const [miktar, setMiktar] = useState(1);
  const [ilgiliVarlikID, setIlgiliVarlikID] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.sarfHareket({ MalzemeID: material.ID, IslemTuru: islemTuru, Miktar: miktar, IlgiliVarlikID: ilgiliVarlikID, Aciklama: aciklama }, userName);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`${t('sarf_movement')} · ${material.Ad}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? '...' : t('btn_save')}</button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="page-sub" style={{ marginBottom: 14 }}>{t('sarf_current_stock')}: <strong>{material.Stok || 0} {material.Birim || ''}</strong></div>
        <div className="field">
          <label>{t('sarf_movement_type')}</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className={`btn ${islemTuru === 'Giris' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setIslemTuru('Giris')} style={{ flex: 1 }}>+ {t('sarf_stock_in')}</button>
            <button type="button" className={`btn ${islemTuru === 'Cikis' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setIslemTuru('Cikis')} style={{ flex: 1 }}>− {t('sarf_stock_out')}</button>
          </div>
        </div>
        <div className="field">
          <label>{t('sarf_col_stock')}</label>
          <input type="number" min="1" value={miktar} onChange={(e) => setMiktar(e.target.value)} required />
        </div>
        {islemTuru === 'Cikis' && (
          <div className="field">
            <label>{t('sarf_related_printer')}</label>
            <select value={ilgiliVarlikID} onChange={(e) => setIlgiliVarlikID(e.target.value)}>
              <option value="">—</option>
              {printers.map((p) => <option key={p.ID} value={p.ID}>{p.ID} · {p.Marka} {p.Model}</option>)}
            </select>
            <div className="page-sub" style={{ marginTop: 4 }}>{t('sarf_related_printer_hint')}</div>
          </div>
        )}
        <div className="field">
          <label>{t('col_notes')}</label>
          <input value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
        </div>
        {error && <div className="error-text">{error}</div>}
      </form>
    </Modal>
  );
}

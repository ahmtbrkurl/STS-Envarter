import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang, translateCategory, translateStatus } from '../i18n.jsx';

const CURRENCIES = ['TRY', 'USD', 'EUR', 'RUB'];

// Bu durumlardayken cihaz kimseye zimmetli sayilmaz - Atanan Kisi alani
// otomatik temizlenir ve devre disi birakilir (backend de ayni kurali uygular).
const CLEAR_ASSIGNEE_STATUSES = ['Stok', 'Hurda', 'Elden Cikarildi', 'Kayip'];

export default function AssetForm({ asset, lists, employees, allItems, onClose, onSaved }) {
  const isEdit = !!asset;
  const { userName } = useAuth();
  const { lang, t } = useLang();
  const [form, setForm] = useState(() => ({
    Kategori: asset?.Kategori || (lists.Kategori?.[0] || ''),
    Marka: asset?.Marka || '',
    Model: asset?.Model || '',
    SeriNo: asset?.SeriNo || '',
    Renk: asset?.Renk || '',
    Hostname: asset?.Hostname || '',
    MAC: asset?.MAC || '',
    IPAdresi: asset?.IPAdresi || '',
    Durum: asset?.Durum || (lists.Durum?.[0] || 'Stok'),
    Lokasyon: asset?.Lokasyon || (lists.Lokasyon?.[0] || ''),
    LokasyonDetay: asset?.LokasyonDetay || '',
    AtananKisi: asset?.AtananKisi || '',
    GenelKullanim: asset?.AtananKisi === 'Genel Kullanim',
    AtamaTarihi: asset?.AtamaTarihi || '',
    Tedarikci: asset?.Tedarikci || '',
    SatinAlmaTarihi: asset?.SatinAlmaTarihi || '',
    TeslimAlmaTarihi: asset?.TeslimAlmaTarihi || '',
    Fiyat: asset?.Fiyat || '',
    ParaBirimi: asset?.ParaBirimi || 'TRY',
    GarantiBitisTarihi: asset?.GarantiBitisTarihi || '',
    Notlar: asset?.Notlar || ''
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const assigneeCleared = CLEAR_ASSIGNEE_STATUSES.includes(form.Durum);

  // Ayni kategorideki mevcut Hostname'lerin SONUNDAKI sayiyi bulup bir sonrakini
  // onerir - otomatik doldurmaz, sadece "sirada bu numara olabilir" diye
  // gosterir. Bir onceki (en yuksek numarali) hostname'in on-eki/basamak
  // sayisi aynen korunur (orn. "PC-007" varsa "PC-008" onerilir).
  // Dizustu + Masaustu Bilgisayar kategorileri AYNI hostname sirasini
  // paylasiyor (orn. "AKK-PC-017") - lokasyondan bagimsiz, sadece bu iki
  // kategori birlikte sayiliyor. Diger kategoriler (Yazici, Monitor vb.)
  // hala kendi kategorisi icinde ayri sayiliyor.
  const PC_KATEGORILERI = ['Dizustu Bilgisayar', 'Masaustu Bilgisayar'];
  const hostnameSuggestion = (() => {
    if (!allItems || !form.Kategori) return null;
    const sharedScope = PC_KATEGORILERI.includes(form.Kategori);
    let best = null;
    allItems.forEach((a) => {
      const matchesScope = sharedScope ? PC_KATEGORILERI.includes(a.Kategori) : (a.Kategori === form.Kategori);
      if (!matchesScope || !a.Hostname || a.ID === asset?.ID) return;
      const m = String(a.Hostname).match(/^(.*?)(\d+)$/);
      if (m) {
        const num = parseInt(m[2], 10);
        if (!best || num > best.num) best = { prefix: m[1], num, width: m[2].length };
      }
    });
    if (!best) return null;
    return best.prefix + String(best.num + 1).padStart(best.width, '0');
  })();

  function update(key, value) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'Durum' && CLEAR_ASSIGNEE_STATUSES.includes(value)) {
        next.AtananKisi = '';
        next.GenelKullanim = false;
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      payload.AtananKisi = assigneeCleared ? '' : (form.GenelKullanim ? 'Genel Kullanim' : form.AtananKisi);
      delete payload.GenelKullanim;

      if (isEdit) {
        await api.updateAsset(asset.ID, payload, userName);
      } else {
        const res = await api.createAsset(payload, userName);
        if (res.queued) alert(res.message);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? `${t('form_edit_asset')} · ${asset.ID}` : t('form_new_asset')}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" type="submit" form="asset-form" disabled={saving}>
            {saving ? '...' : t('btn_save')}
          </button>
        </>
      }
    >
      <form id="asset-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label>{t('col_category')}</label>
            <select value={form.Kategori} onChange={(e) => update('Kategori', e.target.value)} required>
              {lists.Kategori?.map((k) => <option key={k} value={k}>{translateCategory(k, lang)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('col_brand')}</label>
            <input list="marka-list" value={form.Marka} onChange={(e) => update('Marka', e.target.value)} required />
            <datalist id="marka-list">
              {lists.Marka?.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>

          <div className="field">
            <label>{t('col_model')}</label>
            <input value={form.Model} onChange={(e) => update('Model', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('col_serial')}</label>
            <input value={form.SeriNo} onChange={(e) => update('SeriNo', e.target.value)} />
          </div>

          <div className="field">
            <label>{t('col_color')}</label>
            <input list="renk-list" value={form.Renk} onChange={(e) => update('Renk', e.target.value)} />
            <datalist id="renk-list">
              {lists.Renk?.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>
          <div className="field">
            <label>{t('col_hostname')}</label>
            <input value={form.Hostname} onChange={(e) => update('Hostname', e.target.value)} />
            {hostnameSuggestion && (
              <div className="page-sub" style={{ marginTop: 4 }}>
                💡 {t('asset_hostname_suggestion')}: <strong className="mono">{hostnameSuggestion}</strong>
              </div>
            )}
          </div>

          <div className="field">
            <label>{t('col_mac')}</label>
            <input
              value={form.MAC}
              onChange={(e) => update('MAC', e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="mono"
            />
          </div>
          <div className="field">
            <label>{t('col_ip')}</label>
            <input
              value={form.IPAdresi}
              onChange={(e) => update('IPAdresi', e.target.value)}
              placeholder="192.168.1.10"
              className="mono"
            />
          </div>

          <div className="field">
            <label>{t('col_status')}</label>
            <select value={form.Durum} onChange={(e) => update('Durum', e.target.value)} required>
              {lists.Durum?.map((d) => <option key={d} value={d}>{translateStatus(d, lang)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('col_location')}</label>
            <select value={form.Lokasyon} onChange={(e) => update('Lokasyon', e.target.value)} required>
              {lists.Lokasyon?.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('col_location_detay')}</label>
            <input
              type="text"
              value={form.LokasyonDetay || ''}
              onChange={(e) => update('LokasyonDetay', e.target.value)}
              placeholder={t('col_location_detay_placeholder')}
            />
            <div className="page-sub" style={{ marginTop: 4 }}>{t('col_location_detay_hint')}</div>
          </div>

          {!assigneeCleared && (
            <div className="field full">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={form.GenelKullanim} onChange={(e) => update('GenelKullanim', e.target.checked)} />
                {t('form_general_use')}
              </label>
            </div>
          )}

          {assigneeCleared ? (
            <div className="field full">
              <label>{t('col_assigned')}</label>
              <input value={t('form_assigned_to_nobody')} disabled style={{ color: 'var(--ink-faint)' }} />
            </div>
          ) : !form.GenelKullanim && (
            <div className="field full">
              <label>{t('col_assigned')}</label>
              <input
                list="employee-list"
                value={form.AtananKisi}
                onChange={(e) => update('AtananKisi', e.target.value)}
                placeholder={t('needs_col_person')}
              />
              <datalist id="employee-list">
                {employees.map((emp) => <option key={emp.AdSoyad} value={emp.AdSoyad} />)}
              </datalist>
            </div>
          )}

          <div className="field">
            <label>{t('form_assign_date')}</label>
            <input type="date" value={form.AtamaTarihi} onChange={(e) => update('AtamaTarihi', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('col_supplier')}</label>
            <input list="tedarikci-list" value={form.Tedarikci} onChange={(e) => update('Tedarikci', e.target.value)} />
            <datalist id="tedarikci-list">
              {lists.Tedarikci?.map((td) => <option key={td} value={td} />)}
            </datalist>
          </div>

          <div className="field">
            <label>{t('form_purchase_date')}</label>
            <input type="date" value={form.SatinAlmaTarihi} onChange={(e) => update('SatinAlmaTarihi', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('form_delivery_date')}</label>
            <input type="date" value={form.TeslimAlmaTarihi} onChange={(e) => update('TeslimAlmaTarihi', e.target.value)} />
          </div>

          <div className="field">
            <label>{t('col_price')}</label>
            <input type="number" step="0.01" value={form.Fiyat} onChange={(e) => update('Fiyat', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('col_currency')}</label>
            <select value={form.ParaBirimi} onChange={(e) => update('ParaBirimi', e.target.value)}>
              {(lists.ParaBirimi?.length ? lists.ParaBirimi : CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="field">
            <label>{t('col_warranty')}</label>
            <input type="date" value={form.GarantiBitisTarihi} onChange={(e) => update('GarantiBitisTarihi', e.target.value)} />
          </div>
          <div className="field" />

          <div className="field full">
            <label>{t('col_notes')}</label>
            <textarea rows={2} value={form.Notlar} onChange={(e) => update('Notlar', e.target.value)} />
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
      </form>
    </Modal>
  );
}

import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const CURRENCIES = ['TRY', 'USD', 'EUR', 'RUB'];

export default function AssetForm({ asset, lists, employees, onClose, onSaved }) {
  const isEdit = !!asset;
  const { userName } = useAuth();
  const [form, setForm] = useState(() => ({
    Kategori: asset?.Kategori || (lists.Kategori?.[0] || ''),
    Marka: asset?.Marka || '',
    Model: asset?.Model || '',
    SeriNo: asset?.SeriNo || '',
    Renk: asset?.Renk || '',
    Hostname: asset?.Hostname || '',
    MAC: asset?.MAC || '',
    Durum: asset?.Durum || (lists.Durum?.[0] || 'Stok'),
    Lokasyon: asset?.Lokasyon || (lists.Lokasyon?.[0] || ''),
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

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      payload.AtananKisi = form.GenelKullanim ? 'Genel Kullanim' : form.AtananKisi;
      delete payload.GenelKullanim;

      if (isEdit) {
        await api.updateAsset(asset.ID, payload, userName);
      } else {
        await api.createAsset(payload, userName);
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
      title={isEdit ? `Varlik duzenle · ${asset.ID}` : 'Yeni varlik ekle'}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Vazgec</button>
          <button className="btn btn-primary" type="submit" form="asset-form" disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </>
      }
    >
      <form id="asset-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label>Kategori</label>
            <select value={form.Kategori} onChange={(e) => update('Kategori', e.target.value)} required>
              {lists.Kategori?.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Marka</label>
            <input value={form.Marka} onChange={(e) => update('Marka', e.target.value)} required />
          </div>

          <div className="field">
            <label>Model</label>
            <input value={form.Model} onChange={(e) => update('Model', e.target.value)} />
          </div>
          <div className="field">
            <label>Seri No</label>
            <input value={form.SeriNo} onChange={(e) => update('SeriNo', e.target.value)} />
          </div>

          <div className="field">
            <label>Rengi</label>
            <input value={form.Renk} onChange={(e) => update('Renk', e.target.value)} />
          </div>
          <div className="field">
            <label>Hostname</label>
            <input value={form.Hostname} onChange={(e) => update('Hostname', e.target.value)} />
          </div>

          <div className="field">
            <label>MAC Adresi</label>
            <input
              value={form.MAC}
              onChange={(e) => update('MAC', e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="mono"
            />
          </div>
          <div className="field" />

          <div className="field">
            <label>Durum</label>
            <select value={form.Durum} onChange={(e) => update('Durum', e.target.value)} required>
              {lists.Durum?.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Lokasyon</label>
            <select value={form.Lokasyon} onChange={(e) => update('Lokasyon', e.target.value)} required>
              {lists.Lokasyon?.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="field full">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.GenelKullanim} onChange={(e) => update('GenelKullanim', e.target.checked)} />
              Genel kullanim (belirli bir calisana degil, ornegin firewall/AP gibi ortak cihaz)
            </label>
          </div>

          {!form.GenelKullanim && (
            <div className="field full">
              <label>Atanan Kisi</label>
              <input
                list="employee-list"
                value={form.AtananKisi}
                onChange={(e) => update('AtananKisi', e.target.value)}
                placeholder="Calisan adi yazin veya listeden secin"
              />
              <datalist id="employee-list">
                {employees.map((emp) => <option key={emp.AdSoyad} value={emp.AdSoyad} />)}
              </datalist>
            </div>
          )}

          <div className="field">
            <label>Atama Tarihi</label>
            <input type="date" value={form.AtamaTarihi} onChange={(e) => update('AtamaTarihi', e.target.value)} />
          </div>
          <div className="field">
            <label>Tedarikci</label>
            <input value={form.Tedarikci} onChange={(e) => update('Tedarikci', e.target.value)} />
          </div>

          <div className="field">
            <label>Satin Alma Tarihi</label>
            <input type="date" value={form.SatinAlmaTarihi} onChange={(e) => update('SatinAlmaTarihi', e.target.value)} />
          </div>
          <div className="field">
            <label>Teslim Alma Tarihi</label>
            <input type="date" value={form.TeslimAlmaTarihi} onChange={(e) => update('TeslimAlmaTarihi', e.target.value)} />
          </div>

          <div className="field">
            <label>Fiyat</label>
            <input type="number" step="0.01" value={form.Fiyat} onChange={(e) => update('Fiyat', e.target.value)} />
          </div>
          <div className="field">
            <label>Para Birimi</label>
            <select value={form.ParaBirimi} onChange={(e) => update('ParaBirimi', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Garanti Bitis Tarihi</label>
            <input type="date" value={form.GarantiBitisTarihi} onChange={(e) => update('GarantiBitisTarihi', e.target.value)} />
          </div>
          <div className="field" />

          <div className="field full">
            <label>Notlar</label>
            <textarea rows={2} value={form.Notlar} onChange={(e) => update('Notlar', e.target.value)} />
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
      </form>
    </Modal>
  );
}

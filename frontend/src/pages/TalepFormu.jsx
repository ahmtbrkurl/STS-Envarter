import { useState } from 'react';
import { api } from '../api';
import { useLang, translateCategory } from '../i18n.jsx';

// Bu form, tum sirket Kategori listesini (kaynasma/insaat malzemeleri dahil
// yuzlerce kalem) DEGIL, BT ekipmani icin ozel, kucuk bir alt kumeyi
// kullanir - calisanlarin karsisina anlamsiz binlerce secenek cikmasin diye.
// Bu kategoriler gercek Envanter Kategori listesiyle BIREBIR AYNI DEGIL
// (orn. "Mouse"/"Klavye"/"Yazilim" ana listede yok) - bu bilerek boyle,
// cunku admin onaylarken zaten doğru kategoriyi kendisi secip gercek
// Ihtiyac kaydini olusturuyor; bu sadece bir ON-talep.
const TALEP_KATEGORILERI = ['Dizustu Bilgisayar', 'Masaustu Bilgisayar', 'Monitor', 'Yazici', 'Telefon', 'Tablet', 'Mouse', 'Klavye', 'Yazilim', 'Diger'];

function ItemFormModal({ existingCategories, onCancel, onAdd, t, lang }) {
  const [kategori, setKategori] = useState(TALEP_KATEGORILERI[0]);
  const [adet, setAdet] = useState(1);
  const [urunLinki, setUrunLinki] = useState('');
  const [notlar, setNotlar] = useState('');

  const bilgisayarGrubu = ['Dizustu Bilgisayar', 'Masaustu Bilgisayar'];
  const hasWarning = bilgisayarGrubu.includes(kategori)
    ? existingCategories.some((c) => bilgisayarGrubu.includes(c))
    : existingCategories.includes(kategori);

  function handleAdd() {
    onAdd({ Kategori: kategori, Adet: Number(adet) || 1, UrunLinki: urunLinki, Notlar: notlar, mevcutUyari: hasWarning });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div className="public-card" style={{ maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 16, marginBottom: 14 }}>{t('talep_add_item_title')}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>{t('col_category')}</label>
            <select value={kategori} onChange={(e) => setKategori(e.target.value)} style={{ width: '100%' }}>
              {TALEP_KATEGORILERI.map((k) => <option key={k} value={k}>{translateCategory(k, lang)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>{t('talep_adet')}</label>
            <input type="number" min="1" value={adet} onChange={(e) => setAdet(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        {hasWarning && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--amber-soft, #fef3c7)', color: 'var(--amber, #92400e)', borderRadius: 8, marginBottom: 14, fontSize: 12.5 }}>
            ⚠️ {t('talep_existing_warning')}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>{t('talep_urun_linki')} <span style={{ color: 'var(--ink-soft)' }}>({t('optional')})</span></label>
          <input type="url" value={urunLinki} onChange={(e) => setUrunLinki(e.target.value)} placeholder="https://..." style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>{t('col_notes')}</label>
          <textarea rows={3} value={notlar} onChange={(e) => setNotlar(e.target.value)} placeholder={t('talep_notlar_placeholder')} style={{ width: '100%', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel} style={{ flex: 1 }}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" onClick={handleAdd} style={{ flex: 1 }}>{t('talep_add_to_cart')}</button>
        </div>
      </div>
    </div>
  );
}

export default function TalepFormu() {
  const { t, lang } = useLang();
  const [sifre, setSifre] = useState('');
  const [checking, setChecking] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [employee, setEmployee] = useState(null);

  const [cart, setCart] = useState([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setChecking(true);
    setLoginError('');
    try {
      const res = await api.talepLogin(sifre);
      setEmployee(res);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setChecking(false);
    }
  }

  function addToCart(item) {
    setCart((prev) => [...prev, item]);
    setShowItemForm(false);
  }

  function removeFromCart(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!confirmed) {
      setConfirmError(true);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.talepGonder(sifre, cart);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="public-screen">
        <div className="public-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <h1 style={{ fontSize: 18, marginBottom: 6 }}>{t('talep_submitted_title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{t('talep_submitted_desc')}</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="public-screen">
        <div className="public-card">
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0 }}>STS Envanter</p>
            <h1 style={{ fontSize: 18, margin: '4px 0 0' }}>{t('talep_form_title')}</h1>
          </div>
          <form onSubmit={handleLogin}>
            <label style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>{t('talep_password_label')}</label>
            <input
              type="password"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 10 }}
            />
            {loginError && <div className="error-text" style={{ marginBottom: 10 }}>{loginError}</div>}
            <button className="btn btn-primary" type="submit" disabled={checking} style={{ width: '100%' }}>
              {checking ? '...' : t('btn_continue')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="public-screen">
      <div className="public-card">
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0 }}>STS Envanter</p>
          <h1 style={{ fontSize: 18, margin: '4px 0 0' }}>{t('talep_form_title')}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--green-soft, #dcfce7)', borderRadius: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 18 }}>✓</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{employee.AdSoyad}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{employee.Departman || '—'}</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>{t('talep_cart_title')}</p>

        {cart.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 14, padding: '20px 0' }}>{t('talep_cart_empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {cart.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-1, #f5f5f4)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {translateCategory(item.Kategori, lang)} <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>× {item.Adet}</span>
                  </div>
                  {item.Notlar && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{item.Notlar}</div>}
                </div>
                <button onClick={() => removeFromCart(i)} aria-label={t('btn_cancel')} style={{ border: 'none', background: 'none', color: 'var(--ink-soft)', fontSize: 16, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-ghost" onClick={() => setShowItemForm(true)} style={{ width: '100%', marginBottom: 18 }}>
          + {t('talep_add_item')}
        </button>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => { setConfirmed(e.target.checked); if (e.target.checked) setConfirmError(false); }}
            style={{ marginTop: 2 }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{t('talep_confirm_label')}</span>
        </label>
        {confirmError && <div className="error-text" style={{ marginBottom: 10 }}>{t('talep_confirm_required')}</div>}

        {submitError && <div className="error-text" style={{ marginBottom: 10 }}>{submitError}</div>}

        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting || cart.length === 0}
          style={{ width: '100%' }}
        >
          {submitting ? '...' : `${t('talep_submit')} (${cart.length})`}
        </button>
      </div>

      {showItemForm && (
        <ItemFormModal
          existingCategories={employee.existingCategories || []}
          onCancel={() => setShowItemForm(false)}
          onAdd={addToCart}
          t={t}
          lang={lang}
        />
      )}
    </div>
  );
}

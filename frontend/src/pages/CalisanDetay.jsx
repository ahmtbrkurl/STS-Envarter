import { normalizeMacsOrThrow } from '../macUtils.js';
import { AccessResourcesFields } from '../accessResources.jsx';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useLang, translateCategory } from '../i18n.jsx';

export default function CalisanDetay() {
  const { name } = useParams();
  const decodedName = decodeURIComponent(name);
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [items, setItems] = useState([]);
  const [lists, setLists] = useState({});
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [uploadingForm, setUploadingForm] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [loadError, setLoadError] = useState('');
  const { lang, t } = useLang();

  const formLinks = String((employee && employee.TeslimFormLink) || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

  function load() {
    setLoading(true);
    setLoadError('');
    Promise.all([api.getEmployees(), api.getInventory(), api.getLists()])
      .then(([emp, inv, l]) => {
        setEmployee(emp.find((e) => e.AdSoyad === decodedName) || { AdSoyad: decodedName });
        setItems(inv.filter((a) => a.AtananKisi === decodedName));
        setLists(l);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [decodedName]);

  async function handleHandoverUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingForm(true);
    setUploadError('');
    try {
      let base64, mimeType, filename = file.name;
      if (file.type.startsWith('image/')) {
        // Buyuk fotograflari gereksiz yere Drive'a yuklememek icin kucultup sikistiriyoruz.
        const compressed = await compressImageFile(file);
        base64 = compressed.base64;
        mimeType = compressed.mimeType;
        filename = filename.replace(/\.[a-zA-Z0-9]+$/, '') + '.jpg';
      } else {
        base64 = await fileToBase64(file);
        mimeType = file.type || 'application/pdf';
      }
      const res = await api.uploadHandoverForm({
        personelId: employee.PersonelID,
        adSoyad: employee.AdSoyad,
        filename,
        mimeType,
        base64
      });
      alert(t('handover_upload_success') + ': ' + res.filename);
      load();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingForm(false);
      e.target.value = '';
    }
  }

  if (loading) return <div className="spinner" />;
  if (loadError) {
    return (
      <div className="card card-pad" style={{ background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>⚠️ {t('error_loading_data')}: {loadError}</span>
          <button className="btn btn-ghost btn-sm" onClick={load}>{t('btn_retry')}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/calisanlar')} style={{ marginBottom: 10 }}>← {t('employee_detail_back')}</button>
          <div className="page-title">{employee.AdSoyad}</div>
          <div className="page-sub">
            {employee.PersonelID ? `${employee.PersonelID} · ` : ''}{employee.Unvan ? `${employee.Unvan} · ` : ''}{employee.Departman ? `${employee.Departman} · ` : ''}{employee.Telefon || '—'} · {employee.Email || '—'}
            {employee.AktifMi && (
              <span className={`badge ${employee.AktifMi === 'Aktif' ? 'badge-accent' : employee.AktifMi === 'Beklemede' ? 'badge-amber' : employee.AktifMi === 'Iptal' ? 'badge-amber' : employee.AktifMi === 'Pasif' ? 'badge-red' : 'badge-gray'}`} style={{ marginLeft: 10 }}>
                {employee.AktifMi === 'Aktif' ? t('employee_status_active') : employee.AktifMi === 'Beklemede' ? t('employee_status_pending') : employee.AktifMi === 'Iptal' ? t('employee_status_cancelled') : employee.AktifMi === 'Pasif' ? t('employee_status_inactive') : employee.AktifMi}
              </span>
            )}
          </div>
          {!(employee.Email && employee.Email.toLowerCase().includes('@sts-org.com')) && employee.EmailAdresName && (
            <div className="page-sub" style={{ marginTop: 4, fontStyle: 'italic', color: 'var(--red)' }}>
              ⚠️ {employee.EmailAdresName}@sts-org.com {t('employees_com_missing')}
            </div>
          )}
          {employee.UserName && (
            <div className="page-sub" style={{ marginTop: 4 }}>{t('col_suggested_hostname')}: <span className="mono">{employee.UserName}</span></div>
          )}
          {employee.EmailAdresName && (
            <div className="page-sub" style={{ marginTop: 4 }}>{t('col_email_username')}: <span className="mono">{employee.EmailAdresName}</span></div>
          )}
          {employee.IseBaslamaTarihi && (
            <div className="page-sub" style={{ marginTop: 4 }}>{t('col_ise_baslama_tarihi')}: <strong>{employee.IseBaslamaTarihi}</strong></div>
          )}
          {employee.PlanlananBaslangicTarihi && (
            <div className="page-sub" style={{ marginTop: 4 }}>📅 {t('col_planned_start')}: <strong>{employee.PlanlananBaslangicTarihi}</strong></div>
          )}
          {employee.EmailBasvuruAdi && (
            <div className="page-sub" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{t('col_email_basvuru_adi')}: <strong className="mono">{employee.EmailBasvuruAdi}</strong></span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigator.clipboard?.writeText(employee.EmailBasvuruAdi)}
              >
                📋 {t('btn_copy')}
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/ihtiyaclar', { state: { quickAddPerson: employee.AdSoyad, quickAddDate: employee.PlanlananBaslangicTarihi || '' } })}
          >
            + {t('employee_create_need_for_person')}
          </button>
          {items.length > 0 && (
            <button className="btn btn-ghost" onClick={() => navigate(`/teslim-formu?person=${encodeURIComponent(employee.AdSoyad)}`)}>
              📄 {t('handover_mode_bulk')}
            </button>
          )}
          <input id="handover-file-input" type="file" accept="application/pdf,image/*" hidden onChange={handleHandoverUpload} disabled={uploadingForm} />
          <label htmlFor="handover-file-input" className="btn btn-ghost" style={{ cursor: uploadingForm ? 'default' : 'pointer' }}>
            {uploadingForm ? '...' : `📎 ${t('handover_upload_file')}`}
          </label>
          <input id="handover-camera-input" type="file" accept="image/*" capture="environment" hidden onChange={handleHandoverUpload} disabled={uploadingForm} />
          <label htmlFor="handover-camera-input" className="btn btn-ghost" style={{ cursor: uploadingForm ? 'default' : 'pointer' }}>
            {uploadingForm ? '...' : `📷 ${t('handover_take_photo')}`}
          </label>
          <button className="btn btn-primary" onClick={() => setShowEdit(true)}>{t('employees_edit')}</button>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 0 }}>{t('handover_forms_title')} ({formLinks.length})</div>
      {formLinks.length === 0 ? (
        <div className="page-sub" style={{ marginBottom: 12 }}>{t('handover_forms_none')}</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {formLinks.map((u, i) => (
            <a key={u} className="btn btn-ghost btn-sm" href={u} target="_blank" rel="noreferrer">📄 {i + 1}.{t('handover_form_n')}</a>
          ))}
        </div>
      )}

      {uploadError && <div className="error-text" style={{ marginBottom: 12 }}>{t('handover_upload_error')}: {uploadError}</div>}

      <div className="section-title" style={{ marginTop: 0 }}>{t('employee_detail_assigned')} ({items.length})</div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('col_id')}</th>
              <th>{t('col_brand_model')}</th>
              <th>{t('col_serial')}</th>
              <th>{t('col_color')}</th>
              <th>{t('col_mac')}</th>
              <th>{t('col_ip')}</th>
              <th>{t('col_status')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.ID} onClick={() => navigate(`/envanter/${a.ID}`)}>
                <td className="mono">{a.ID}</td>
                <td>{a.Marka} {a.Model}</td>
                <td className="mono">{a.SeriNo || '—'}</td>
                <td>{a.Renk || '—'}</td>
                <td className="mono">{a.MAC || '—'}</td>
                <td className="mono">{a.IPAdresi || '—'}</td>
                <td><StatusBadge status={a.Durum} lang={lang} /></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7}><div className="empty-state">{t('employee_detail_none')}</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showEdit && (
        <EmployeeEditModal
          employee={employee}
          lists={lists}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}
    </div>
  );
}

function EmployeeEditModal({ employee, lists, onClose, onSaved }) {
  const { t, lang } = useLang();
  const [form, setForm] = useState({
    AdSoyad: employee.AdSoyad || '',
    Telefon: employee.Telefon || '',
    Email: employee.Email || '',
    Departman: employee.Departman || '',
    AktifMi: employee.AktifMi || 'Aktif',
    IstenAyrilmaTarihi: employee.IstenAyrilmaTarihi || '',
    EmailKapatildi: employee.EmailKapatildi || '',
    Firma: employee.Firma || 'STS-Akkuyu',
    ITMuaf: employee.ITMuaf || '',
    MuafKategoriler: employee.MuafKategoriler || '',
    ErisimDosya: employee.ErisimDosya || '',
    Erisim1C: employee.Erisim1C || '',
    MuafErisimler: employee.MuafErisimler || '',
    TelefonMAC: employee.TelefonMAC || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      form.TelefonMAC = normalizeMacsOrThrow(form.TelefonMAC, t('col_phone_mac_invalid'));
      await api.updateEmployee(employee.AdSoyad, form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`${t('employees_edit')} · ${employee.AdSoyad}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" type="submit" form="emp-edit-form" disabled={saving}>{saving ? '...' : t('btn_save')}</button>
        </>
      }
    >
      <form id="emp-edit-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>{t('needs_col_person')}</label>
          <input value={form.AdSoyad} onChange={(e) => setForm({ ...form, AdSoyad: e.target.value })} required />
        </div>
        <div className="field">
          <label>{t('col_department')}</label>
          <input list="dep-list-2" value={form.Departman} onChange={(e) => setForm({ ...form, Departman: e.target.value })} />
          <datalist id="dep-list-2">
            {lists?.Departman?.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div className="field">
          <label>{t('col_phone')}</label>
          <input value={form.Telefon} onChange={(e) => setForm({ ...form, Telefon: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('col_phone_mac')}</label>
          <textarea className="mono" rows={3} value={form.TelefonMAC} onChange={(e) => setForm({ ...form, TelefonMAC: e.target.value })} placeholder={"AA:BB:CC:DD:EE:FF\n11:22:33:44:55:66"} />
          <div className="page-sub" style={{ marginTop: 4 }}>{t('col_phone_mac_hint')}</div>
        </div>
        <div className="field">
          <label>{t('col_email')}</label>
          <input type="text" value={form.Email} onChange={(e) => setForm({ ...form, Email: e.target.value })} />
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.Firma === 'STS-Akkuyu' || !form.Firma}
              onChange={(e) => setForm({ ...form, Firma: e.target.checked ? 'STS-Akkuyu' : '' })}
            />
            {t('col_sts_akkuyu_calisani')}
          </label>
          {form.Firma !== 'STS-Akkuyu' && (
            <input
              type="text"
              placeholder={t('col_firma_adi_placeholder')}
              value={form.Firma}
              onChange={(e) => setForm({ ...form, Firma: e.target.value })}
              style={{ marginTop: 6 }}
            />
          )}
          <div className="page-sub" style={{ marginTop: 4 }}>{t('col_firma_hint')}</div>
        </div>
        <div className="field">
          <label>{t('col_status')}</label>
          <select value={form.AktifMi} onChange={(e) => setForm({ ...form, AktifMi: e.target.value })}>
            <option value="Aktif">{t('employee_status_active')}</option>
            <option value="Beklemede">{t('employee_status_pending')}</option>
            <option value="Pasif">{t('employee_status_inactive')}</option>
            <option value="Iptal">{t('employee_status_cancelled')}</option>
          </select>
        </div>
        {(form.AktifMi === 'Pasif' || form.AktifMi === 'Iptal') && (
          <div className="field">
            <label>{form.AktifMi === 'Iptal' ? t('col_iptal_tarihi') : t('col_isten_ayrilma_tarihi')}</label>
            <input type="date" value={form.IstenAyrilmaTarihi} onChange={(e) => setForm({ ...form, IstenAyrilmaTarihi: e.target.value })} />
          </div>
        )}
        {(form.AktifMi === 'Pasif' || form.AktifMi === 'Iptal') && (
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.EmailKapatildi} onChange={(e) => setForm({ ...form, EmailKapatildi: e.target.checked ? 'TRUE' : '' })} />
              {t('col_email_kapatildi')}
            </label>
          </div>
        )}
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.ITMuaf} onChange={(e) => setForm({ ...form, ITMuaf: e.target.checked ? 'TRUE' : '' })} />
            {t('col_it_muaf')}
          </label>
          <div className="page-sub" style={{ marginTop: 4 }}>{t('col_it_muaf_hint')}</div>
        </div>
        <div className="field">
          <label>{t('col_kategori_muaf')}</label>
          <div className="page-sub" style={{ marginTop: 2, marginBottom: 6 }}>{t('col_kategori_muaf_hint')}</div>
          <div style={{ display: 'flex', gap: 16 }}>
            {['Bilgisayar', 'Monitor'].map((cat) => {
              const list = form.MuafKategoriler ? form.MuafKategoriler.split(',').filter(Boolean) : [];
              const checked = list.includes(cat);
              return (
                <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked ? [...list, cat] : list.filter((c) => c !== cat);
                      setForm({ ...form, MuafKategoriler: next.join(',') });
                    }}
                  />
                  {translateCategory(cat, lang)}
                </label>
              );
            })}
          </div>
        </div>
        <AccessResourcesFields form={form} setForm={setForm} />
        {error && <div className="error-text">{error}</div>}
      </form>
    </Modal>
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

// Fotograflari Drive'a yuklemeden once kucultup sikistirir - hem yukleme hizli
// olur hem de Drive'da gereksiz yere buyuk dosyalar birikmez.
function compressImageFile(file, maxDim = 1600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Resim sikistirilamadi.')); return; }
          const r2 = new FileReader();
          r2.onerror = reject;
          r2.onload = () => resolve({ base64: r2.result.split(',')[1], mimeType: 'image/jpeg' });
          r2.readAsDataURL(blob);
        }, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

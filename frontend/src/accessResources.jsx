// Calisanlarin sahip olmasi gereken kurumsal kaynak erisimleri. Yeni bir kaynak
// eklemek icin bu listeye bir satir eklemek yeterli (field = Calisanlar
// sheet'indeki sutun, backend CALISAN_HEADERS'ta da olmali).
import { useLang } from './i18n.jsx';

export const ACCESS_RESOURCES = [
  { key: 'Dosya', field: 'ErisimDosya', label: { tr: 'ООО «СТС» – Dosya Kaynağı', ru: 'ООО «СТС» – Файловый ресурс', en: 'ООО «СТС» – File Resource' } },
  { key: '1C', field: 'Erisim1C', label: { tr: 'ООО «СТС» – 1C «Doküman Akışı»', ru: 'ООО «СТС» – 1C «Документооборот»', en: 'ООО «СТС» – 1C «Document Workflow»' } }
];

export function resLabel(res, lang) {
  return res.label[lang] || res.label.tr;
}

export function hasAccess(e, res) {
  return !!e[res.field];
}

export function exemptList(e) {
  return e.MuafErisimler ? String(e.MuafErisimler).split(',').map((x) => x.trim()).filter(Boolean) : [];
}

export function isAccessExempt(e, res) {
  return exemptList(e).includes(res.key);
}

// Panelde "eksik" sayilacak calisanlar: aktif/beklemede, STS-Akkuyu, IT muaf degil.
export function isTrackedEmployee(e) {
  return !e.ITMuaf && (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && (!e.Firma || e.Firma === 'STS-Akkuyu');
}

// { res, missing: [employee], exempt: [employee] } her kaynak icin
export function accessSummary(employees) {
  return ACCESS_RESOURCES.map((res) => {
    const tracked = employees.filter(isTrackedEmployee);
    return {
      res,
      missing: tracked.filter((e) => !isAccessExempt(e, res) && !hasAccess(e, res)),
      exempt: employees.filter((e) => (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && isAccessExempt(e, res))
    };
  });
}

// Form alani: her kaynak icin Var / Yok (eksik) / Muaf secimi.
export function AccessResourcesFields({ form, setForm }) {
  const { t, lang } = useLang();
  function stateOf(res) {
    if (exemptList(form).includes(res.key)) return 'muaf';
    return form[res.field] ? 'var' : 'yok';
  }
  function setState(res, v) {
    const list = exemptList(form).filter((k) => k !== res.key);
    if (v === 'muaf') list.push(res.key);
    setForm({ ...form, [res.field]: v === 'var' ? 'TRUE' : '', MuafErisimler: list.join(',') });
  }
  return (
    <div className="field">
      <label>{t('access_section')}</label>
      <div className="page-sub" style={{ marginTop: 2, marginBottom: 6 }}>{t('access_hint')}</div>
      {ACCESS_RESOURCES.map((res) => (
        <div key={res.key} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ flex: 1, fontSize: 13 }}>{resLabel(res, lang)}</span>
          <select value={stateOf(res)} onChange={(e) => setState(res, e.target.value)} style={{ width: 170 }}>
            <option value="var">{t('access_has')}</option>
            <option value="yok">{t('access_missing')}</option>
            <option value="muaf">{t('access_exempt')}</option>
          </select>
        </div>
      ))}
    </div>
  );
}

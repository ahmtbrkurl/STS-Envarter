// Fatura (Faturalar sayfasi), Ihtiyac Listesi ve Sarf siparisleri tarafindan
// ORTAK kullanilan kucuk yardimcilar - ayni mantik birden fazla dosyada
// kopyalanmasin diye burada toplandi.

// Backend'deki ODEME_DURUMU_OPTIONS ile ayni, 3 sabit secenek.
export const ODEME_DURUMU_OPTIONS = ['Odenmedi', 'KismenOdendi', 'Odendi'];

export function odemeDurumuLabel(key, lang) {
  const map = {
    Odenmedi: { tr: 'Ödenmedi', ru: 'Не оплачено', en: 'Not Paid' },
    KismenOdendi: { tr: 'Kısmen Ödendi', ru: 'Частично оплачено', en: 'Partially Paid' },
    Odendi: { tr: 'Ödendi', ru: 'Оплачено', en: 'Paid' }
  };
  return map[key]?.[lang] || map[key]?.tr || key;
}

export function odemeBadgeClass(key) {
  if (key === 'Odendi') return 'badge-accent';
  if (key === 'KismenOdendi') return 'badge-amber';
  return 'badge-gray';
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// "url1, url2" -> ['url1', 'url2']
export function splitLinks(s) {
  return String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
}

// Birden fazla link listesini tekrarsiz birlestirir.
export function mergeLinks(lists) {
  const out = [];
  (lists || []).forEach((s) => splitLinks(s).forEach((l) => { if (out.indexOf(l) === -1) out.push(l); }));
  return out;
}

// { 'FTR-0001': fatura, ... }
export function buildFaturaMap(faturalar) {
  const map = {};
  (faturalar || []).forEach((f) => { map[f.ID] = f; });
  return map;
}

// Faturada gorunecek kisa ad: once Fatura No, yoksa kayit ID'si.
export function faturaLabel(f) {
  if (!f) return '';
  return f.FaturaNo ? String(f.FaturaNo) : f.ID;
}

// Bir ihtiyac/sarf satirinin gecerli belgeleri: bagli faturanin belgeleri +
// satirin kendi ProformaLink'i (tekrarsiz).
export function effectiveDocs(row, faturaMap) {
  const f = row.FaturaID ? faturaMap[row.FaturaID] : null;
  return mergeLinks([f?.BelgeLink, row.ProformaLink]);
}

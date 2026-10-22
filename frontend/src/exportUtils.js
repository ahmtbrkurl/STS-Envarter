// Export dosyalari icin: <menu-adi>-<tarih>-<saat>.<uzanti>
export function timestampedFilename(base, ext) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const safeBase = base.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${safeBase}-${date}-${time}.${ext}`;
}

export function downloadCsv(csvContent, filename) {
  // Basinda UTF-8 BOM olmadan Excel, Kiril/Turkce karakterleri (Ц, Ğ, İ vb.) bozuk
  // gosteriyor ("Ð´Ð¼Ð¸Ð½..." gibi). BOM eklemek Excel'e "bu dosya UTF-8" demenin
  // standart yoludur.
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Seri No, MAC, Telefon gibi alanlar rakamdan olusuyorsa (orn. "00001234" veya
// cok uzun bir sayi) Excel CSV'yi actiginda bunlari otomatik olarak sayiya
// cevirip basindaki sifirlari siler veya "2.25E+12" gibi bilimsel gosterime
// donusturur. ="deger" formulu Excel'e (ve Google Sheets'e) bu hucrenin KESINLIKLE
// metin oldugunu, oldugu gibi gosterilmesi gerektigini soyler.
// Turkce ve Kiril (Rusca) karakterleri sade Ingilizce harflere cevirir -
// backend'deki (helpers.js) ayni haritalamanin frontend kopyasi. Outlook
// gibi bazi sistemler ozel karakterleri dogru okuyamiyor, bu yuzden
// gerektiginde (orn. Outlook kisi listesi export'unda) kullaniliyor.
export function toAsciiChars(s) {
  const trMap = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
  const cyrMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y',
    'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f',
    'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y',
    'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F',
    'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };
  return String(s || '')
    .split('')
    .map((ch) => cyrMap[ch] !== undefined ? cyrMap[ch] : (trMap[ch] || ch))
    .join('');
}

// "Ahmet Burak URAL" -> { first: 'Ahmet Burak', last: 'URAL' } - son kelime
// soyad, geri kalani ad sayilir (Rusca kayitlarda isimler zaten TAMAMI
// BUYUK harfle geldigi icin bu kural onlarda da dogru calisir).
export function splitNameParts(adSoyad) {
  const parts = String(adSoyad || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export function excelSafeText(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (!s) return '';
  return '="' + s.replace(/"/g, '""') + '"';
}

// Code.gs'deki nextId_/logAction_/logMovement_/addListItem_ vb. yardimci
// fonksiyonlarin Node.js karsiligi.
const sheets = require('./sheets');

// Sheet'e YENI bir satir eklerken kullanilacak baslik sirasini dondurur:
// sheet'in GERCEK baslik satirini okur, bulamazsa (sheet henuz olusturulmamissa)
// verilen sabit diziye duser. Bu, kullanicinin Google Sheet'e elle sutun
// ekleyip sirayi degistirdigi durumlarda (Envanter'de yasanan "kayma" hatasi
// gibi) degerlerin yanlis hucrelere yazilmasini onler - HER "create" fonksiyonu
// bunu kullanmali, sabit HEADERS dizisini dogrudan degil.
async function getEffectiveHeaders(sheetName, fallbackHeaders) {
  let realHeaders;
  try {
    realHeaders = await sheets.getHeaders(sheetName);
  } catch (err) {
    // Sheet (sekme) henuz hic olusturulmamis olabilir (orn. yeni eklenen
    // "SarfSiparisleri") - Code.gs'deki ensureSheet_ ile ayni sekilde
    // otomatik olustur, kullanicinin Google Sheet'e elle sekme eklemesine
    // gerek kalmasin.
    await sheets.ensureSheetExists(sheetName, fallbackHeaders);
    return fallbackHeaders;
  }
  if (!realHeaders.length) {
    // Sekme var ama tamamen bos (hic baslik satiri yazilmamis).
    await sheets.ensureSheetExists(sheetName, fallbackHeaders);
    return fallbackHeaders;
  }
  // fallbackHeaders'da (kodda) olup sheet'te henuz olmayan - yani koda
  // sonradan eklenmis yeni bir alan (orn. OdemeDurumu) - varsa, sheet'in
  // baslik satirina otomatik olarak sona ekleriz (mevcut sirayi bozmadan).
  const missing = fallbackHeaders.filter((h) => realHeaders.indexOf(h) === -1);
  if (missing.length === 0) return realHeaders;
  return sheets.ensureHeaderColumns(sheetName, fallbackHeaders);
}

// Genel amacli ASENKRON KILIT (mutex) - ayni anda birden fazla "ID uret +
// satir ekle" islemi (orn. Ekipman Talep Formu'ndan sepetle 10 kalemin
// HEPSI, veya "Onayla (0)" gibi hizli art arda cagrilar) calisirsa, ikisi
// de "su anki en yuksek ID" olarak AYNI degeri okuyup AYNI ID'yi
// kullanabiliyordu (orn. 6 farkli ihtiyac kaydi ayni IHT-0068 ID'sini
// paylasti - bu da rapor/sayim gibi ID'yi benzersiz varsayan her yerde
// kayitlarin "kaybolmus" gibi gorunmesine yol acti). withIdLock, "ID oku +
// satiri ekle" adimlarini TEK, bolunemez bir sira haline getirir - bir
// islem bitmeden digeri baslamaz.
let idLock = Promise.resolve();
function withIdLock(fn) {
  const run = idLock.then(fn, fn);
  idLock = run.then(() => {}, () => {});
  return run;
}

const SHEET_NAMES = {
  ENVANTER: 'Envanter',
  CALISANLAR: 'Calisanlar',
  HAREKETLER: 'Hareketler',
  LISTELER: 'Listeler',
  IHTIYACLAR: 'Ihtiyaclar',
  GUNLUK: 'Gunluk',
  SARF: 'SarfMalzemeleri',
  SARF_HAREKETLERI: 'SarfHareketleri',
  SARF_SIPARISLERI: 'SarfSiparisleri',
  FATURALAR: 'Faturalar',
  PERSONEL_TALEPLERI: 'PersonelTalepleri',
  VLAN_TABLE: 'VLANlar',
  IP_INVENTORY: 'IPEnvanteri',
  PORT_MAP: 'PortHaritasi',
  FIREWALL_RULES: 'GuvenlikKurallari',
  CHANGE_LOG: 'DegisiklikGunlugu'
};

// Ag Altyapisi modulunun 5 tablosu - hepsi AYNI genel CRUD mekanizmasini
// kullanir (asagida networkTableGet/Create/Update/Delete). Her tablonun
// gercek sutun basliklari burada tanimli; ID her tabloda ilk sutundur ve
// sistem tarafindan otomatik uretilir.
const NETWORK_TABLES = {
  vlan: { sheet: SHEET_NAMES.VLAN_TABLE, prefix: 'VLAN', headers: ['ID', 'VlanID', 'Ad', 'Network', 'SubnetMask', 'Gateway', 'DhcpAralik', 'Lease', 'DhcpVarMi', 'Notlar'] },
  ip: { sheet: SHEET_NAMES.IP_INVENTORY, prefix: 'IP', headers: ['ID', 'Vlan', 'IPAdresi', 'CihazAdi', 'MacAdresi', 'Tip', 'Durum', 'Tarih', 'Notlar'] },
  port: { sheet: SHEET_NAMES.PORT_MAP, prefix: 'PORT', headers: ['ID', 'Port', 'Tip', 'Vlan', 'BagliCihaz', 'Notlar'] },
  firewall: { sheet: SHEET_NAMES.FIREWALL_RULES, prefix: 'FW', headers: ['ID', 'Sira', 'Chain', 'Aksiyon', 'Yorum', 'Kaynak', 'HedefPort', 'Tarih', 'Aciklama'] },
  changelog: { sheet: SHEET_NAMES.CHANGE_LOG, prefix: 'LOG', headers: ['ID', 'Tarih', 'YapilanDegisiklik', 'YedekDosyaAdi', 'Yapan', 'Durum'] }
};

const ENVANTER_HEADERS = [
  'ID', 'Kategori', 'Marka', 'Model', 'SeriNo', 'Renk', 'Hostname', 'MAC', 'IPAdresi',
  'Durum', 'Lokasyon', 'LokasyonDetay', 'AtananKisi', 'AtamaTarihi', 'Tedarikci',
  'SatinAlmaTarihi', 'TeslimAlmaTarihi', 'Fiyat', 'ParaBirimi',
  'GarantiBitisTarihi', 'FaturaLink', 'Notlar', 'OlusturmaTarihi', 'SonGuncelleme'
];
const HAREKET_HEADERS = [
  'HareketID', 'VarlikID', 'Tarih', 'IslemTuru', 'OncekiKullanici',
  'YeniKullanici', 'OncekiDurum', 'YeniDurum', 'OncekiLokasyon',
  'YeniLokasyon', 'Aciklama', 'IslemYapan'
];
const LISTE_HEADERS = ['Kategori', 'Lokasyon', 'Durum', 'ParaBirimi', 'Marka', 'Renk', 'Tedarikci', 'Departman', 'KargoFirmasi', 'SarfKategori', 'Birim', 'Oncelik', 'OdemeTuru'];
const IHTIYAC_HEADERS = [
  'ID', 'PersonelAdi', 'Departman', 'PlanlananTarih', 'Kategori', 'Aciklama',
  'Fiyat', 'ParaBirimi', 'Tedarikci', 'SiparisTarihi',
  'Durum', 'BaglantiliVarlikID', 'OlusturmaTarihi',
  'TahminiTeslimatTarihi', 'KargoFirmasi', 'KargoTakipNo',
  'Marka', 'MalzemeAdi', 'Birim', 'Oncelik', 'OdemeTuru', 'FiyatTRY',
  'OdemeDurumu', 'OdemeTarihi', 'ProformaLink', 'FaturaID', 'TopluID'
];
// Odeme durumu icin 3 sabit secenek - Listeler sheet'ine bagli degil,
// Durum/DURUM_MAP gibi kodda sabit tutuluyor (kullaniciya ekstra kurulum
// yaptirmamak icin).
const ODEME_DURUMU_OPTIONS = ['TeklifFiyat', 'Odenmedi', 'KismenOdendi', 'Odendi'];
const GUNLUK_HEADERS = ['Tarih', 'Kullanici', 'Islem', 'Detay'];
const CLEAR_ASSIGNEE_STATUSES = ['Stok', 'Hurda', 'Elden Cikarildi', 'Kayip'];
const SARF_HEADERS = ['ID', 'Ad', 'Kategori', 'UyumluModeller', 'Stok', 'MinStok', 'Birim', 'Lokasyon', 'Tedarikci', 'BirimFiyat', 'ParaBirimi', 'Notlar', 'OlusturmaTarihi', 'SonGuncelleme'];
const SARF_HAREKET_HEADERS = ['HareketID', 'MalzemeID', 'Tarih', 'IslemTuru', 'Miktar', 'IlgiliVarlikID', 'Aciklama', 'IslemYapan'];
// Sarf Malzemeleri icin AYRI bir satin alma siparisi takibi - stok
// hareketlerinden (giris/cikis) farkli olarak, "sipariş verdik ama henuz
// gelmedi/odenmedi" surecini (Ihtiyac Listesi'ndeki ile AYNI mantikla:
// Durum + OdemeDurumu + OdemeTarihi + ProformaLink) tutar. Karsilandi
// oldugunda sarfHareket() ile stoga eklenir (bkz. fulfillSarfSiparis).
const SARF_SIPARIS_HEADERS = [
  'ID', 'MalzemeID', 'MalzemeAdi', 'Miktar', 'Birim', 'Tedarikci',
  'Fiyat', 'ParaBirimi', 'FiyatTRY', 'SiparisTarihi', 'TahminiTeslimatTarihi',
  'KargoFirmasi', 'KargoTakipNo', 'Durum', 'OdemeDurumu', 'OdemeTarihi',
  'ProformaLink', 'Notlar', 'OlusturmaTarihi', 'SonGuncelleme', 'FaturaID'
];
// Fatura/Proforma kayitlari - birden fazla Ihtiyac satirini (ve Sarf
// siparisini) TEK bir odeme durumuna baglar. Faturanin OdemeDurumu/OdemeTarihi
// degisince baglantili tum satirlara otomatik yayilir (bkz. updateFatura).
// Satirlarda ise sadece FaturaID tutulur.
const FATURA_HEADERS = [
  'ID', 'FaturaNo', 'Tedarikci', 'FaturaTarihi', 'Tutar', 'ParaBirimi',
  'OdemeDurumu', 'OdemeTarihi', 'BelgeLink', 'Notlar', 'OlusturmaTarihi', 'SonGuncelleme'
];
const PERSONEL_TALEP_HEADERS = ['ID', 'PersonelAdi', 'Departman', 'Kategori', 'Adet', 'UrunLinki', 'Notlar', 'MevcutEkipmanUyarisi', 'Durum', 'OlusturmaTarihi'];

function nowStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Bir sheet'teki ID sutunundan (orn. "IT-0042") en yuksek sayiyi bulup bir
// sonrakini uretir - Code.gs'deki nextId_ ile ayni.
async function nextId(prefix) {
  const rows = await sheets.getSheetValues(SHEET_NAMES.ENVANTER);
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const m = String(rows[i][0] || '').match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
}

async function nextHareketId() {
  const rows = await sheets.getSheetValues(SHEET_NAMES.HAREKETLER);
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const m = String(rows[i][0] || '').match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return `HRK-${String(maxNum + 1).padStart(4, '0')}`;
}

async function logAction(user, action, detail) {
  try {
    await sheets.appendRow(SHEET_NAMES.GUNLUK, [nowStr(), user || 'Sistem', action, detail || '']);
  } catch (e) { /* log basarisiz olsa bile asil islemi engellememeli */ }
}

async function logMovement(fields, user) {
  await withIdLock(async () => {
    const hareketId = await nextHareketId();
    const headerRow = await getEffectiveHeaders(SHEET_NAMES.HAREKETLER, HAREKET_HEADERS);
    const row = headerRow.map((h) => {
      if (h === 'HareketID') return hareketId;
      if (h === 'Tarih') return nowStr();
      if (h === 'IslemYapan') return user || '';
      return fields[h] !== undefined ? fields[h] : '';
    });
    await sheets.appendRow(SHEET_NAMES.HAREKETLER, row);
  });
}

// Turkce'ye ozgu karakterleri ASCII karsiliklarina cevirir.
function turkishToAscii(s) {
  const map = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
  return String(s || '').replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => map[ch] || ch);
}

// Kiril (Rusca) karakterleri Latin alfabesine cevirir.
function transliterateCyrillicToLatin(s) {
  const map = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y',
    'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f',
    'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y',
    'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F',
    'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };
  return String(s || '').split('').map((ch) => (map[ch] !== undefined ? map[ch] : ch)).join('');
}

function computeIdentifierParts(adSoyad, babaAdi) {
  const parts = String(adSoyad || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const adFirst = parts[0];
  const soyad = parts[parts.length - 1];
  const adHarf = turkishToAscii(adFirst).charAt(0);
  const babaHarf = babaAdi ? turkishToAscii(transliterateCyrillicToLatin(String(babaAdi).trim().split(/\s+/)[0])).charAt(0) : '';
  const soyadClean = turkishToAscii(soyad).replace(/[^A-Za-z0-9]/g, '');
  return { adHarf, babaHarf, soyad: soyadClean };
}

function computeHostnameFromAdSoyad(adSoyad, babaAdi) {
  const p = computeIdentifierParts(adSoyad, babaAdi);
  if (!p) return '';
  return (p.adHarf + p.babaHarf).toUpperCase() + '_' + p.soyad.toUpperCase();
}

function computeEmailNameFromAdSoyad(adSoyad, babaAdi) {
  const p = computeIdentifierParts(adSoyad, babaAdi);
  if (!p) return '';
  return (p.adHarf + p.babaHarf).toLowerCase() + '_' + p.soyad.toLowerCase();
}

async function nextPersonelId() {
  const rows = await sheets.getSheetValues(SHEET_NAMES.CALISANLAR);
  const headers = rows[0] || CALISAN_HEADERS;
  const col = headers.indexOf('PersonelID');
  let maxNum = 0;
  if (col !== -1) {
    for (let i = 1; i < rows.length; i++) {
      const m = String(rows[i][col] || '').match(/(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
  }
  return 'P-' + String(maxNum + 1).padStart(4, '0');
}

const CALISAN_HEADERS = ['AdSoyad', 'Telefon', 'Email', 'Departman', 'AktifMi', 'PersonelID', 'SicilNo', 'Unvan', 'BabaAdi', 'UserName', 'EmailAdresName', 'IseBaslamaTarihi', 'PlanlananBaslangicTarihi', 'EmailDomain', 'ITMuaf', 'EmailBasvuruAdi', 'Cinsiyet', 'Uyruk', 'MuafKategoriler', 'HRKayipSayaci', 'TalepSifresi', 'IstenAyrilmaTarihi', 'Firma', 'EmailKapatildi', 'ErisimDosya', 'Erisim1C', 'MuafErisimler', 'TelefonMAC', 'TeslimFormLink'];

// Yeni bir calisan satiri ekler - Code.gs'deki createEmployee_ ile ayni mantik
// (GERCEK sheet baslik sirasina gore yazar, kullanici sutunlari elle
// yeniden siralamis olsa bile dogru sutuna yazar).
async function createEmployee(data) {
  if (data.AdSoyad && !data.UserName) data.UserName = computeHostnameFromAdSoyad(data.AdSoyad, data.BabaAdi);
  if (data.AdSoyad && !data.EmailAdresName) data.EmailAdresName = computeEmailNameFromAdSoyad(data.AdSoyad, data.BabaAdi);
  await withIdLock(async () => {
    const actualHeaders = await getEffectiveHeaders(SHEET_NAMES.CALISANLAR, CALISAN_HEADERS);
    const personelId = data.PersonelID || (await nextPersonelId());
    const row = actualHeaders.map((h) => {
      if (!h) return '';
      if (h === 'AktifMi') return data[h] !== undefined ? data[h] : 'Aktif';
      if (h === 'PersonelID') return personelId;
      return data[h] !== undefined ? data[h] : '';
    });
    await sheets.appendRow(SHEET_NAMES.CALISANLAR, row);
  });
  if (data.Departman) await addListItem('Departman', data.Departman);
  await logAction(null, 'Calisan Eklendi', data.AdSoyad || '');
  return { message: 'Calisan eklendi.' };
}

// originalName ile eslesen satiri bulup gunceller - Code.gs'deki updateEmployee_
// ile ayni. NOT: isim degisince Envanter/Ihtiyaclar'daki referanslarin da
// guncellenmesi Apps Script'te var ama bu ilk surumde henuz port edilmedi.
async function updateEmployee(originalName, data) {
  // Koda sonradan eklenen yeni calisan alanlari (orn. ErisimDosya) sheet'te yoksa sona eklenir.
  await getEffectiveHeaders(SHEET_NAMES.CALISANLAR, CALISAN_HEADERS);
  const rows = await sheets.getSheetValues(SHEET_NAMES.CALISANLAR);
  const actualHeaders = rows[0] || CALISAN_HEADERS;
  const nameCol = actualHeaders.indexOf('AdSoyad');
  let idx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][nameCol] === originalName) { idx = i; break; }
  }
  if (idx === -1) throw new Error('Calisan bulunamadi: ' + originalName);
  const current = {};
  actualHeaders.forEach((h, i) => { if (h) current[h] = rows[idx][i]; });

  if (data.AdSoyad !== undefined || data.BabaAdi !== undefined) {
    const finalAdSoyad = data.AdSoyad !== undefined ? data.AdSoyad : current.AdSoyad;
    const finalBabaAdi = data.BabaAdi !== undefined ? data.BabaAdi : current.BabaAdi;
    data.UserName = computeHostnameFromAdSoyad(finalAdSoyad, finalBabaAdi);
    data.EmailAdresName = computeEmailNameFromAdSoyad(finalAdSoyad, finalBabaAdi);
  }

  const newRow = actualHeaders.map((h) => (!h ? '' : (data[h] !== undefined ? data[h] : current[h])));
  await sheets.updateRow(SHEET_NAMES.CALISANLAR, idx + 1, newRow);
  if (data.Departman) await addListItem('Departman', data.Departman);
  return { message: 'Calisan guncellendi.' };
}


// ---- Calisan Teslim Formlari (Drive "Teslim Formlari" klasoru) ----
// Yuklenen formlarin Drive linkleri Calisanlar sheet'inde TeslimFormLink
// sutununda (virgulle ayrilmis) tutulur - Calisan sayfasi, Panel ve Yonetim
// Raporu buradan okur. Dosya adi: <PersonelID>_<Ad_Soyad>_<tarih>.<uzanti>
function driveFileId(url) {
  const m = String(url || '').match(/\/d\/([\w-]+)/) || String(url || '').match(/[?&]id=([\w-]+)/);
  return m ? m[1] : String(url || '').trim();
}

// urls'i calisanin mevcut TeslimFormLink listesine (tekrarsiz) ekler. Eklenen sayiyi dondurur.
async function addEmployeeTeslimFormLinks(match, urls) {
  // Satir PersonelID ile (yoksa AdSoyad ile) bulunur ve O SATIRA yazilir - ayni adli
  // iki calisan varsa form yanlis kisiye gitmesin diye updateEmployee(ad) kullanilmaz.
  await getEffectiveHeaders(SHEET_NAMES.CALISANLAR, CALISAN_HEADERS);
  const rows = await sheets.getSheetValues(SHEET_NAMES.CALISANLAR);
  const hdr = rows[0] || [];
  const idCol = hdr.indexOf('PersonelID');
  const nameCol = hdr.indexOf('AdSoyad');
  const linkCol = hdr.indexOf('TeslimFormLink');
  if (linkCol === -1) return 0;
  let idx = -1;
  if (match.personelId && idCol !== -1) {
    for (let i = 1; i < rows.length; i++) { if (rows[i][idCol] === match.personelId) { idx = i; break; } }
  }
  if (idx === -1 && match.adSoyad && nameCol !== -1) {
    for (let i = 1; i < rows.length; i++) { if (rows[i][nameCol] === match.adSoyad) { idx = i; break; } }
  }
  if (idx === -1) return 0;
  const existing = splitLinks(rows[idx][linkCol]);
  const have = new Set(existing.map(driveFileId));
  const toAdd = urls.filter((u) => u && !have.has(driveFileId(u)));
  if (!toAdd.length) return 0;
  const newRow = hdr.map((h, i) => (rows[idx][i] === undefined ? '' : rows[idx][i]));
  newRow[linkCol] = existing.concat(toAdd).join(', ');
  await sheets.updateRow(SHEET_NAMES.CALISANLAR, idx + 1, newRow);
  return toAdd.length;
}

// Drive klasorundeki MEVCUT formlari (files: [{name, url}]) dosya adindaki
// PersonelID'ye gore calisanlara eslestirir - daha once yuklenmis formlar icin tek seferlik/tekrarlanabilir.
async function syncTeslimFormLinks(files) {
  const emps = await sheets.sheetToObjects(SHEET_NAMES.CALISANLAR);
  const byId = {};
  emps.forEach((e) => { if (e.PersonelID) byId[e.PersonelID] = e; });
  const groups = {};
  const unmatched = [];
  (files || []).forEach((f) => {
    const m = String(f.name || '').match(/^(.+?)_/);
    const pid = m ? m[1] : '';
    if (pid && byId[pid]) (groups[pid] = groups[pid] || []).push(f.url);
    else unmatched.push(f.name);
  });
  let added = 0;
  let people = 0;
  for (const pid of Object.keys(groups)) {
    const n = await addEmployeeTeslimFormLinks({ personelId: pid }, groups[pid]);
    if (n) { added += n; people++; }
  }
  return { added, people, unmatched, total: (files || []).length, message: `${added} form, ${people} calisana eslestirildi.` };
}

// Ihtiyac Listesi icin: kaydin dogru tarihindeki (siparis/plan tarihi) TCMB
// kuruyla TL karsiligini hesaplar - Code.gs'deki needRateDate_/computeNeedFiyatTRY_ ile ayni.
function needRateDate(data) {
  const durum = data.Durum || 'Bekleniyor';
  const today = nowStr().slice(0, 10);
  if (durum === 'Bekleniyor' || durum === 'Onaylandi') return data.PlanlananTarih || data.OlusturmaTarihi || today;
  return data.SiparisTarihi || data.PlanlananTarih || data.OlusturmaTarihi || today;
}

async function computeNeedFiyatTRY(data, rates) {
  if (!data.Fiyat) return '';
  const tarih = needRateDate(data);
  const converted = await rates.convertCurrency(data.Fiyat, data.ParaBirimi || 'TRY', tarih, 'TRY');
  return converted !== null ? Math.round(converted * 100) / 100 : '';
}

// IHTIYACLAR sheet'indeki ID sutunundan en yuksek sayiyi bulup bir sonrakini
// uretir - Code.gs'deki nextNeedId_ ile ayni (nextId()'den FARKLI, o Envanter'e bakar).
async function nextNeedId() {
  const rows = await sheets.getSheetValues(SHEET_NAMES.IHTIYACLAR);
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const m = String(rows[i][0] || '').match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 'IHT-' + String(maxNum + 1).padStart(4, '0');
}

async function createNeed(data, rates) {
  const now = nowStr();
  const durum = data.Durum || 'Bekleniyor';
  const fiyatTRY = await computeNeedFiyatTRY({ Fiyat: data.Fiyat, ParaBirimi: data.ParaBirimi, Durum: durum, PlanlananTarih: data.PlanlananTarih, SiparisTarihi: data.SiparisTarihi, OlusturmaTarihi: now }, rates);
  const id = await withIdLock(async () => {
    const newId = await nextNeedId();
    const headerRow = await getEffectiveHeaders(SHEET_NAMES.IHTIYACLAR, IHTIYAC_HEADERS);
    const row = headerRow.map((h) => {
      if (h === 'ID') return newId;
      if (h === 'OlusturmaTarihi') return now;
      if (h === 'Durum') return durum;
      if (h === 'BaglantiliVarlikID') return '';
      if (h === 'FiyatTRY') return fiyatTRY;
      if (h === 'OdemeDurumu') return data.OdemeDurumu || 'Odenmedi';
      return data[h] !== undefined ? data[h] : '';
    });
    await sheets.appendRow(SHEET_NAMES.IHTIYACLAR, row);
    return newId;
  });
  if (data.Tedarikci) await addListItem('Tedarikci', data.Tedarikci);
  if (data.Departman) await addListItem('Departman', data.Departman);
  await logAction(null, 'Ihtiyac Olusturuldu', id + ' - ' + (data.PersonelAdi || '') + ' / ' + (data.Kategori || ''));
  return { id, message: 'Ihtiyac kaydi olusturuldu.' };
}

async function updateNeed(id, data, rates) {
  const rowIdx = await sheets.findRowIndex(SHEET_NAMES.IHTIYACLAR, 'ID', id);
  if (rowIdx === -1) throw new Error('Ihtiyac kaydi bulunamadi: ' + id);
  // Bir faturaya bagli satirin odeme bilgisini FATURA belirler: satirdan
  // gelen OdemeDurumu/OdemeTarihi degisikligi yok sayilir (fatura baglantisi
  // ayni cagrida kaldiriliyorsa - data.FaturaID === '' - serbesttir).
  if (data.FaturaID === undefined && (data.OdemeDurumu !== undefined || data.OdemeTarihi !== undefined)) {
    const cur = await getNeed(id);
    if (cur.FaturaID) {
      data = { ...data };
      delete data.OdemeDurumu;
      delete data.OdemeTarihi;
    }
  }
  // Sheet'te henuz olmayan (koda sonradan eklenmis, orn. OdemeDurumu) basliklar
  // varsa once otomatik ekler (getEffectiveHeaders'in migrasyon mantigi) -
  // ardindan guncel satirlari tekrar okuruz.
  const headerRow = await getEffectiveHeaders(SHEET_NAMES.IHTIYACLAR, IHTIYAC_HEADERS);
  const allRows = await sheets.getSheetValues(SHEET_NAMES.IHTIYACLAR);
  const currentRow = allRows[rowIdx - 1] || [];
  const current = {};
  headerRow.forEach((h, i) => { current[h] = currentRow[i] !== undefined ? currentRow[i] : ''; });

  const merged = {};
  headerRow.forEach((h) => { merged[h] = data[h] !== undefined ? data[h] : current[h]; });
  const fiyatTRY = await computeNeedFiyatTRY(merged, rates);

  const newRow = headerRow.map((h) => {
    if (h === 'ID' || h === 'OlusturmaTarihi') return current[h];
    if (h === 'FiyatTRY') return fiyatTRY;
    return data[h] !== undefined ? data[h] : current[h];
  });
  await sheets.updateRow(SHEET_NAMES.IHTIYACLAR, rowIdx, newRow);
  if (data.Tedarikci) await addListItem('Tedarikci', data.Tedarikci);
  if (data.Departman) await addListItem('Departman', data.Departman);
  return { id, message: 'Ihtiyac kaydi guncellendi.' };
}

// Envanter icin PROTECTED_FROM_BLANKING - Code.gs ile ayni: bu alanlar bos
// gonderilirse eski deger korunur (yanlislikla silinmesin diye).
const PROTECTED_FROM_BLANKING = ENVANTER_HEADERS.filter((h) => ['Durum', 'Lokasyon', 'LokasyonDetay', 'AtananKisi', 'Notlar', 'SonGuncelleme', 'ID', 'OlusturmaTarihi'].indexOf(h) === -1);

async function createAsset(data, user) {
  const now = nowStr();
  const finalAssignee = CLEAR_ASSIGNEE_STATUSES.indexOf(data.Durum) !== -1 ? '' : (data.AtananKisi || '');
  const id = await withIdLock(async () => {
    const newId = await nextId('IT');
    // ONEMLI: ENVANTER_HEADERS sabiti YERINE, sheet'in GERCEK baslik satirini
    // kullaniyoruz. Kullanici Google Sheet'e elle bir sutun ekleyip (orn.
    // LokasyonDetay'i sona ekleyip) sirayi degistirdiginde, sabit dizi ile
    // gercek sutun sirasi uyusmazsa degerler yanlis hucrelere yaziliyordu
    // ("kayma" hatasi). updateAsset zaten gercek baslik satirini okuyordu;
    // createAsset da aynı desene alindi.
    const realHeaders = await sheets.getHeaders(SHEET_NAMES.ENVANTER);
    const headerRow = realHeaders.length ? realHeaders : ENVANTER_HEADERS;
    const row = headerRow.map((h) => {
      if (h === 'ID') return newId;
      if (h === 'OlusturmaTarihi' || h === 'SonGuncelleme') return now;
      if (h === 'AtananKisi') return finalAssignee;
      return data[h] !== undefined ? data[h] : '';
    });
    await sheets.appendRow(SHEET_NAMES.ENVANTER, row);
    return newId;
  });
  if (data.Marka) await addListItem('Marka', data.Marka);
  if (data.Renk) await addListItem('Renk', data.Renk);
  if (data.Tedarikci) await addListItem('Tedarikci', data.Tedarikci);
  if (finalAssignee) {
    await logMovement({
      VarlikID: id, IslemTuru: 'Ilk Atama', OncekiKullanici: '', YeniKullanici: finalAssignee,
      OncekiDurum: '', YeniDurum: data.Durum || '', OncekiLokasyon: '', YeniLokasyon: data.Lokasyon || '',
      Aciklama: 'Varlik olusturuldu.'
    }, user);
  }
  await logAction(user, 'Varlik Olusturuldu', id + ' - ' + (data.Kategori || '') + ' ' + (data.Marka || '') + ' ' + (data.Model || ''));
  return { id, message: 'Varlik olusturuldu.' };
}

async function updateAsset(id, data, user) {
  const rowIdx = await sheets.findRowIndex(SHEET_NAMES.ENVANTER, 'ID', id);
  if (rowIdx === -1) throw new Error('Varlik bulunamadi: ' + id);
  const allRows = await sheets.getSheetValues(SHEET_NAMES.ENVANTER);
  const headerRow = allRows[0];
  const currentRow = allRows[rowIdx - 1];
  const current = {};
  headerRow.forEach((h, i) => { current[h] = currentRow[i]; });

  PROTECTED_FROM_BLANKING.forEach((h) => {
    const incoming = data[h];
    const isBlank = incoming === '' || incoming === null || incoming === undefined;
    if (isBlank && current[h]) delete data[h];
  });

  const targetDurum = data.Durum !== undefined ? data.Durum : current.Durum;
  if (CLEAR_ASSIGNEE_STATUSES.indexOf(targetDurum) !== -1) data.AtananKisi = '';

  const changedUser = data.AtananKisi !== undefined && String(data.AtananKisi) !== String(current.AtananKisi);
  const changedDurum = data.Durum !== undefined && String(data.Durum) !== String(current.Durum);
  const changedLokasyon = data.Lokasyon !== undefined && String(data.Lokasyon) !== String(current.Lokasyon);

  const newRow = headerRow.map((h) => {
    if (h === 'SonGuncelleme') return nowStr();
    if (h === 'ID' || h === 'OlusturmaTarihi') return current[h];
    return data[h] !== undefined ? data[h] : current[h];
  });
  await sheets.updateRow(SHEET_NAMES.ENVANTER, rowIdx, newRow);

  if (data.Marka) await addListItem('Marka', data.Marka);
  if (data.Renk) await addListItem('Renk', data.Renk);
  if (data.Tedarikci) await addListItem('Tedarikci', data.Tedarikci);

  if (changedUser || changedDurum || changedLokasyon) {
    await logMovement({
      VarlikID: id, IslemTuru: 'Guncelleme',
      OncekiKullanici: current.AtananKisi || '', YeniKullanici: data.AtananKisi !== undefined ? data.AtananKisi : current.AtananKisi,
      OncekiDurum: current.Durum || '', YeniDurum: targetDurum || '',
      OncekiLokasyon: current.Lokasyon || '', YeniLokasyon: data.Lokasyon !== undefined ? data.Lokasyon : current.Lokasyon,
      Aciklama: 'Kayit guncellendi.'
    }, user);
  }
  return { id, message: 'Varlik guncellendi.' };
}

async function addListItem(listName, value) {
  if (LISTE_HEADERS.indexOf(listName) === -1) throw new Error('Gecersiz liste: ' + listName);
  const rows = await sheets.getSheetValues(SHEET_NAMES.LISTELER);
  const headers = rows[0] || LISTE_HEADERS;
  const col = headers.indexOf(listName);
  const existing = rows.slice(1).map((r) => r[col]).filter(Boolean);
  if (existing.indexOf(value) !== -1) return { message: 'Zaten listede var.' };
  // Ilk bos satiri bul, yoksa sona ekle.
  let targetRowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][col]) { targetRowIdx = i + 1; break; }
  }
  if (targetRowIdx === -1) targetRowIdx = rows.length + 1;
  const colLetter = sheets.columnLetter(col + 1);
  // Tek hucre guncellemesi icin sheets.js'teki updateRow (tam satir) yerine
  // ozel, sadece o hucreyi hedefleyen bir istek kullaniyoruz.
  await updateSingleCell(SHEET_NAMES.LISTELER, `${colLetter}${targetRowIdx}`, value);
  sheets.invalidateCache(SHEET_NAMES.LISTELER);
  return { message: 'Eklendi.' };
}

async function removeListItem(listName, value) {
  if (LISTE_HEADERS.indexOf(listName) === -1) throw new Error('Gecersiz liste: ' + listName);
  const rows = await sheets.getSheetValues(SHEET_NAMES.LISTELER);
  const headers = rows[0] || LISTE_HEADERS;
  const col = headers.indexOf(listName);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][col] === value) {
      const colLetter = sheets.columnLetter(col + 1);
      await updateSingleCell(SHEET_NAMES.LISTELER, `${colLetter}${i + 1}`, '');
      sheets.invalidateCache(SHEET_NAMES.LISTELER);
      return { message: 'Kaldirildi.' };
    }
  }
  return { message: 'Bulunamadi.' };
}

// sheets.js disina cikmadan, TEK bir hucreyi guncellemek icin kucuk bir yardimci.
const { GoogleAuth } = require('google-auth-library');
require('dotenv').config();
const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
let cachedClient = null;
async function updateSingleCell(sheetName, cellA1, value) {
  if (!cachedClient) cachedClient = await auth.getClient();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheets.SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!' + cellA1)}?valueInputOption=USER_ENTERED`;
  await cachedClient.request({ url, method: 'PUT', data: { values: [[value]] } });
}

// ---- Ihtiyac Listesi tek kayit okuma - Code.gs'deki getNeed_ ile ayni ----
async function getNeed(needId) {
  const rowIdx = await sheets.findRowIndex(SHEET_NAMES.IHTIYACLAR, 'ID', needId);
  if (rowIdx === -1) throw new Error('Ihtiyac kaydi bulunamadi: ' + needId);
  const rows = await sheets.getSheetValues(SHEET_NAMES.IHTIYACLAR);
  const need = {};
  rows[0].forEach((h, i) => { need[h] = rows[rowIdx - 1][i]; });
  return need;
}

// ---- Sarf Malzemeleri ----
async function nextSarfId() {
  const rows = await sheets.getSheetValues(SHEET_NAMES.SARF);
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const m = String(rows[i][0] || '').match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 'SRF-' + String(maxNum + 1).padStart(4, '0');
}

async function nextSarfHareketId() {
  const rows = await sheets.getSheetValues(SHEET_NAMES.SARF_HAREKETLERI);
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const m = String(rows[i][0] || '').match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 'SHK-' + String(maxNum + 1).padStart(4, '0');
}

async function getSarfMalzemeleri() {
  const items = await sheets.sheetToObjects(SHEET_NAMES.SARF);
  return items.map((m) => {
    m.DusukStok = Number(m.Stok || 0) <= Number(m.MinStok || 0);
    return m;
  });
}

async function createSarfMalzeme(data) {
  const now = nowStr();
  const id = await withIdLock(async () => {
    const newId = await nextSarfId();
    const headerRow = await getEffectiveHeaders(SHEET_NAMES.SARF, SARF_HEADERS);
    const row = headerRow.map((h) => {
      if (h === 'ID') return newId;
      if (h === 'OlusturmaTarihi' || h === 'SonGuncelleme') return now;
      if (h === 'Stok') return data.Stok !== undefined ? data.Stok : 0;
      if (h === 'MinStok') return data.MinStok !== undefined ? data.MinStok : 0;
      return data[h] || '';
    });
    await sheets.appendRow(SHEET_NAMES.SARF, row);
    return newId;
  });
  if (data.Kategori) await addListItem('SarfKategori', data.Kategori);
  if (data.Tedarikci) await addListItem('Tedarikci', data.Tedarikci);
  await logAction(null, 'Sarf Malzeme Eklendi', id + ' - ' + (data.Ad || ''));
  return { id, message: 'Malzeme eklendi.' };
}

async function updateSarfMalzeme(id, data) {
  const rowIdx = await sheets.findRowIndex(SHEET_NAMES.SARF, 'ID', id);
  if (rowIdx === -1) throw new Error('Malzeme bulunamadi: ' + id);
  const rows = await sheets.getSheetValues(SHEET_NAMES.SARF);
  const headerRow = rows[0];
  const current = {};
  headerRow.forEach((h, i) => { current[h] = rows[rowIdx - 1][i]; });
  const newRow = headerRow.map((h) => {
    if (h === 'ID' || h === 'OlusturmaTarihi') return current[h];
    if (h === 'SonGuncelleme') return nowStr();
    return data[h] !== undefined ? data[h] : current[h];
  });
  await sheets.updateRow(SHEET_NAMES.SARF, rowIdx, newRow);
  if (data.Kategori) await addListItem('SarfKategori', data.Kategori);
  if (data.Tedarikci) await addListItem('Tedarikci', data.Tedarikci);
  return { id, message: 'Malzeme guncellendi.' };
}

async function sarfHareket(data, user) {
  const { yeniStok, hareketId } = await withIdLock(async () => {
    const rowIdx = await sheets.findRowIndex(SHEET_NAMES.SARF, 'ID', data.MalzemeID);
    if (rowIdx === -1) throw new Error('Malzeme bulunamadi: ' + data.MalzemeID);
    const rows = await sheets.getSheetValues(SHEET_NAMES.SARF);
    const headerRow = rows[0];
    const stokCol = headerRow.indexOf('Stok');
    const guncellemeCol = headerRow.indexOf('SonGuncelleme');
    const currentStok = Number(rows[rowIdx - 1][stokCol]) || 0;
    const miktar = Number(data.Miktar) || 0;
    const yeniStok = data.IslemTuru === 'Giris' ? currentStok + miktar : Math.max(0, currentStok - miktar);

    const newRow = rows[rowIdx - 1].slice();
    newRow[stokCol] = yeniStok;
    newRow[guncellemeCol] = nowStr();
    await sheets.updateRow(SHEET_NAMES.SARF, rowIdx, newRow);

    const hareketId = await nextSarfHareketId();
    const sarfHareketHeaderRow = await getEffectiveHeaders(SHEET_NAMES.SARF_HAREKETLERI, SARF_HAREKET_HEADERS);
    const hareketRow = sarfHareketHeaderRow.map((h) => {
      if (h === 'HareketID') return hareketId;
      if (h === 'Tarih') return nowStr();
      if (h === 'IslemYapan') return user || '';
      return data[h] !== undefined ? data[h] : '';
    });
    await sheets.appendRow(SHEET_NAMES.SARF_HAREKETLERI, hareketRow);
    return { yeniStok, hareketId };
  });

  const miktar = Number(data.Miktar) || 0;
  await logAction(user, 'Sarf Malzeme Hareketi', data.MalzemeID + ' - ' + data.IslemTuru + ' ' + miktar);
  return { message: 'Hareket kaydedildi.', yeniStok };
}

async function getAssetSarfCost(assetId) {
  const hareketler = (await sheets.sheetToObjects(SHEET_NAMES.SARF_HAREKETLERI))
    .filter((h) => h.IlgiliVarlikID === assetId && h.IslemTuru === 'Cikis');
  const malzemeMap = {};
  (await sheets.sheetToObjects(SHEET_NAMES.SARF)).forEach((m) => { malzemeMap[m.ID] = m; });

  const items = [];
  const totalByCurrency = {};
  hareketler.forEach((h) => {
    const m = malzemeMap[h.MalzemeID];
    if (!m) return;
    const miktar = Number(h.Miktar) || 0;
    const birimFiyat = Number(m.BirimFiyat) || 0;
    const tutar = miktar * birimFiyat;
    const cur = m.ParaBirimi || 'TRY';
    totalByCurrency[cur] = (totalByCurrency[cur] || 0) + tutar;
    items.push({ Tarih: h.Tarih, Ad: m.Ad, Miktar: miktar, Tutar: tutar, ParaBirimi: cur });
  });
  return { items, totalByCurrency };
}

// ---- Sarf Satin Alma Siparisleri ----
// Sarf Malzemeleri sayfasindaki stok giris/cikis hareketlerinden AYRI,
// kendi basina duran bir "siparis verdik, henuz gelmedi/odenmedi" takibi.
// Ihtiyac Listesi'ndeki Durum/OdemeDurumu/OdemeTarihi/ProformaLink ile AYNI
// mantik - sadece MalzemeID'ye (var olan bir Sarf Malzemesi kaydina) baglidir.
async function nextSarfSiparisId() {
  let rows;
  try {
    rows = await sheets.getSheetValues(SHEET_NAMES.SARF_SIPARISLERI);
  } catch (err) {
    // Sekme henuz yok - ilk siparis bu olacak.
    return 'SSP-0001';
  }
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const m = String(rows[i][0] || '').match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 'SSP-' + String(maxNum + 1).padStart(4, '0');
}

async function getSarfSiparisleri() {
  try {
    return await sheets.sheetToObjects(SHEET_NAMES.SARF_SIPARISLERI);
  } catch (err) {
    // Sekme henuz olusturulmamis olabilir (hic siparis girilmemis) - bos liste donduruyoruz,
    // sekme ilk createSarfSiparis cagrisinda otomatik olusur.
    return [];
  }
}

async function createSarfSiparis(data, rates) {
  const now = nowStr();
  const durum = data.Durum || 'Bekleniyor';
  const fiyatTRY = await computeNeedFiyatTRY({ Fiyat: data.Fiyat, ParaBirimi: data.ParaBirimi, Durum: durum, SiparisTarihi: data.SiparisTarihi, OlusturmaTarihi: now }, rates);
  const id = await withIdLock(async () => {
    const newId = await nextSarfSiparisId();
    const headerRow = await getEffectiveHeaders(SHEET_NAMES.SARF_SIPARISLERI, SARF_SIPARIS_HEADERS);
    const row = headerRow.map((h) => {
      if (h === 'ID') return newId;
      if (h === 'OlusturmaTarihi' || h === 'SonGuncelleme') return now;
      if (h === 'Durum') return durum;
      if (h === 'FiyatTRY') return fiyatTRY;
      if (h === 'OdemeDurumu') return data.OdemeDurumu || 'Odenmedi';
      return data[h] !== undefined ? data[h] : '';
    });
    await sheets.appendRow(SHEET_NAMES.SARF_SIPARISLERI, row);
    return newId;
  });
  if (data.Tedarikci) await addListItem('Tedarikci', data.Tedarikci);
  await logAction(null, 'Sarf Siparisi Olusturuldu', id + ' - ' + (data.MalzemeAdi || ''));
  return { id, message: 'Sarf siparisi olusturuldu.' };
}

async function updateSarfSiparis(id, data, rates) {
  const rowIdx = await sheets.findRowIndex(SHEET_NAMES.SARF_SIPARISLERI, 'ID', id);
  if (rowIdx === -1) throw new Error('Sarf siparisi bulunamadi: ' + id);
  const headerRow = await getEffectiveHeaders(SHEET_NAMES.SARF_SIPARISLERI, SARF_SIPARIS_HEADERS);
  const allRows = await sheets.getSheetValues(SHEET_NAMES.SARF_SIPARISLERI);
  const currentRow = allRows[rowIdx - 1] || [];
  const current = {};
  headerRow.forEach((h, i) => { current[h] = currentRow[i] !== undefined ? currentRow[i] : ''; });
  // Faturaya bagli siparisin odeme bilgisini fatura belirler (bkz. updateNeed).
  if (current.FaturaID && data.FaturaID === undefined && (data.OdemeDurumu !== undefined || data.OdemeTarihi !== undefined)) {
    data = { ...data };
    delete data.OdemeDurumu;
    delete data.OdemeTarihi;
  }

  const merged = {};
  headerRow.forEach((h) => { merged[h] = data[h] !== undefined ? data[h] : current[h]; });
  const fiyatTRY = await computeNeedFiyatTRY(merged, rates);

  const newRow = headerRow.map((h) => {
    if (h === 'ID' || h === 'OlusturmaTarihi') return current[h];
    if (h === 'FiyatTRY') return fiyatTRY;
    if (h === 'SonGuncelleme') return nowStr();
    return data[h] !== undefined ? data[h] : current[h];
  });
  await sheets.updateRow(SHEET_NAMES.SARF_SIPARISLERI, rowIdx, newRow);
  return { id, message: 'Sarf siparisi guncellendi.' };
}

// Siparisi "Karsilandi" yapar ve Miktar kadar Sarf Malzemesi stoguna ekler
// (sarfHareket ile AYNI mekanizma - fulfillNeedAsSarfStock'taki desenle ayni).
async function fulfillSarfSiparis(id, user) {
  const siparis = (await getSarfSiparisleri()).find((s) => s.ID === id);
  if (!siparis) throw new Error('Sarf siparisi bulunamadi: ' + id);
  if (siparis.Durum === 'Karsilandi') throw new Error('Bu siparis zaten karsilanmis.');
  if (!siparis.MalzemeID) throw new Error('Bu siparisin bagli oldugu bir Sarf Malzemesi yok.');
  const miktar = Number(siparis.Miktar) || 1;
  await sarfHareket({ MalzemeID: siparis.MalzemeID, IslemTuru: 'Giris', Miktar: miktar, Aciklama: 'Satin Alma Siparisi karsilandi: ' + id }, user);
  await updateSarfSiparis(id, { Durum: 'Karsilandi' }, require('./rates'));
  await logAction(user, 'Sarf Siparisi Karsilandi', id + ' -> ' + siparis.MalzemeID + ' (+' + miktar + ')');
  return { message: (siparis.MalzemeAdi || siparis.MalzemeID) + ' stoguna ' + miktar + ' adet eklendi.' };
}

// ---- Faturalar ----
// Bir Fatura/Proforma kaydi, birden fazla Ihtiyac satirini (ve Sarf
// siparisini) TEK bir odeme durumuna baglar: faturanin OdemeDurumu /
// OdemeTarihi'si degisince baglantili TUM satirlara otomatik yayilir.
// Satirlarda yalnizca FaturaID (ve yayilan odeme alanlari) tutulur; satirlarin
// kendi ProformaLink belgeleri ASLA silinmez (faturaya sadece KOPYALANIR),
// bu yuzden baglama/ayirma/silme hicbir belgeyi kaybettirmez.
function splitLinks(s) {
  return String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
}
function mergeLinks(lists) {
  const out = [];
  (lists || []).forEach((s) => splitLinks(s).forEach((l) => { if (out.indexOf(l) === -1) out.push(l); }));
  return out.join(', ');
}

// Birden fazla satirin odeme durumundan tek bir "ozet" cikarir (otomatik
// gruplamada fatura baslangic durumu icin): hepsi Odendi -> Odendi, hepsi
// Odenmedi -> Odenmedi, karisiksa KismenOdendi.
function aggregatePayment(rows) {
  const st = rows.map((r) => r.OdemeDurumu || 'Odenmedi');
  let durum = 'KismenOdendi';
  if (st.length && st.every((s) => s === 'Odendi')) durum = 'Odendi';
  else if (st.length && st.every((s) => s === 'TeklifFiyat')) durum = 'TeklifFiyat';
  else if (st.every((s) => s === 'TeklifFiyat' || s === 'Odenmedi')) durum = 'Odenmedi';
  else if (!st.length || st.every((s) => s === 'Odenmedi')) durum = 'Odenmedi';
  const dates = rows
    .filter((r) => (r.OdemeDurumu === 'Odendi' || r.OdemeDurumu === 'KismenOdendi') && r.OdemeTarihi)
    .map((r) => String(r.OdemeTarihi)).sort();
  return { OdemeDurumu: durum, OdemeTarihi: dates.length ? dates[dates.length - 1] : '' };
}

// Bir sheet'teki birden fazla satira (ID -> kismi veri) toplu yama uygular:
// sheet TEK kez okunur, her etkilenen satir GERCEK baslik sirasina gore yazilir
// ("kayma" olmaz).
async function patchRowsById(sheetName, fallbackHeaders, patchesById) {
  if (!Object.keys(patchesById).length) return 0;
  const headerRow = await getEffectiveHeaders(sheetName, fallbackHeaders);
  const rows = await sheets.getSheetValues(sheetName);
  const idCol = headerRow.indexOf('ID');
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const patch = patchesById[String(rows[i][idCol] === undefined ? '' : rows[i][idCol])];
    if (!patch) continue;
    const newRow = headerRow.map((h, c) => (patch[h] !== undefined ? patch[h] : (rows[i][c] !== undefined ? rows[i][c] : '')));
    await sheets.updateRow(sheetName, i + 1, newRow);
    count++;
  }
  return count;
}

async function nextFaturaId() {
  let rows;
  try {
    rows = await sheets.getSheetValues(SHEET_NAMES.FATURALAR);
  } catch (err) {
    return 'FTR-0001';
  }
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const m = String(rows[i][0] || '').match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 'FTR-' + String(maxNum + 1).padStart(4, '0');
}

async function getFaturalar() {
  try {
    return await sheets.sheetToObjects(SHEET_NAMES.FATURALAR);
  } catch (err) {
    return []; // sekme henuz yok - ilk createFatura'da otomatik olusur
  }
}

async function getFaturaLinkedRows(faturaId) {
  const needs = (await sheets.sheetToObjects(SHEET_NAMES.IHTIYACLAR)).filter((n) => n.FaturaID === faturaId);
  const sarf = (await getSarfSiparisleri()).filter((s) => s.FaturaID === faturaId);
  return { needs, sarf };
}

// Faturanin guncel OdemeDurumu/OdemeTarihi degerini, ondan farkli olan tum
// baglantili satirlara yazar.
async function propagateFaturaPayment(fatura) {
  const { needs, sarf } = await getFaturaLinkedRows(fatura.ID);
  const want = { OdemeDurumu: fatura.OdemeDurumu || 'Odenmedi', OdemeTarihi: fatura.OdemeTarihi || '' };
  const patchOf = (rows) => {
    const p = {};
    rows.forEach((r) => {
      if (String(r.OdemeDurumu || 'Odenmedi') !== want.OdemeDurumu || String(r.OdemeTarihi || '') !== want.OdemeTarihi) p[r.ID] = { ...want };
    });
    return p;
  };
  await patchRowsById(SHEET_NAMES.IHTIYACLAR, IHTIYAC_HEADERS, patchOf(needs));
  if (sarf.length) await patchRowsById(SHEET_NAMES.SARF_SIPARISLERI, SARF_SIPARIS_HEADERS, patchOf(sarf));
}

// Verilen ihtiyac/sarf siparis satirlarini faturaya BAGLAR: satirlara FaturaID
// ve faturanin odeme durumu yazilir; satirlarin mevcut belgeleri faturanin
// BelgeLink'ine eklenir (satirlardan silinmez).
async function linkFatura(faturaId, needIds, sarfIds) {
  needIds = needIds || [];
  sarfIds = sarfIds || [];
  sheets.invalidateCache(SHEET_NAMES.FATURALAR);
  const fatura = (await getFaturalar()).find((f) => f.ID === faturaId);
  if (!fatura) throw new Error('Fatura bulunamadi: ' + faturaId);
  const needRows = needIds.length ? (await sheets.sheetToObjects(SHEET_NAMES.IHTIYACLAR)).filter((n) => needIds.indexOf(n.ID) !== -1) : [];
  const sarfRows = sarfIds.length ? (await getSarfSiparisleri()).filter((s) => sarfIds.indexOf(s.ID) !== -1) : [];
  const want = { FaturaID: faturaId, OdemeDurumu: fatura.OdemeDurumu || 'Odenmedi', OdemeTarihi: fatura.OdemeTarihi || '' };
  const needPatch = {};
  needRows.forEach((n) => { needPatch[n.ID] = { ...want }; });
  const sarfPatch = {};
  sarfRows.forEach((s) => { sarfPatch[s.ID] = { ...want }; });
  await patchRowsById(SHEET_NAMES.IHTIYACLAR, IHTIYAC_HEADERS, needPatch);
  if (sarfRows.length) await patchRowsById(SHEET_NAMES.SARF_SIPARISLERI, SARF_SIPARIS_HEADERS, sarfPatch);

  const docs = mergeLinks([fatura.BelgeLink].concat(needRows.map((n) => n.ProformaLink), sarfRows.map((s) => s.ProformaLink)));
  if (docs !== String(fatura.BelgeLink || '')) {
    await patchRowsById(SHEET_NAMES.FATURALAR, FATURA_HEADERS, { [faturaId]: { BelgeLink: docs, SonGuncelleme: nowStr() } });
  }
  await logAction(null, 'Faturaya Baglandi', faturaId + ' <- ' + needRows.length + ' ihtiyac, ' + sarfRows.length + ' sarf siparisi');
  return { message: (needRows.length + sarfRows.length) + ' satir faturaya baglandi.' };
}

// Satirlarin fatura baglantisini kaldirir. Odeme durumu oldugu gibi kalir
// (sonradan satirdan elle degistirilebilir), satirin kendi belgeleri zaten
// yerinde durur.
async function unlinkFatura(needIds, sarfIds) {
  needIds = needIds || [];
  sarfIds = sarfIds || [];
  const needPatch = {};
  needIds.forEach((id) => { needPatch[id] = { FaturaID: '' }; });
  const sarfPatch = {};
  sarfIds.forEach((id) => { sarfPatch[id] = { FaturaID: '' }; });
  await patchRowsById(SHEET_NAMES.IHTIYACLAR, IHTIYAC_HEADERS, needPatch);
  if (sarfIds.length) await patchRowsById(SHEET_NAMES.SARF_SIPARISLERI, SARF_SIPARIS_HEADERS, sarfPatch);
  return { message: 'Fatura baglantisi kaldirildi.' };
}

// needIds/sarfIds verilirse: faturanin baglantili satir listesi TAM OLARAK
// bu liste olur (listede olmayanlarin baglantisi kalkar, yeniler baglanir).
async function createFatura(data, needIds, sarfIds) {
  const now = nowStr();
  const id = await withIdLock(async () => {
    const newId = await nextFaturaId();
    const headerRow = await getEffectiveHeaders(SHEET_NAMES.FATURALAR, FATURA_HEADERS);
    const row = headerRow.map((h) => {
      if (h === 'ID') return newId;
      if (h === 'OlusturmaTarihi' || h === 'SonGuncelleme') return now;
      if (h === 'OdemeDurumu') return data.OdemeDurumu || 'Odenmedi';
      return data[h] !== undefined ? data[h] : '';
    });
    await sheets.appendRow(SHEET_NAMES.FATURALAR, row);
    sheets.invalidateCache(SHEET_NAMES.FATURALAR);
    return newId;
  });
  if (data.Tedarikci) await addListItem('Tedarikci', data.Tedarikci);
  await logAction(null, 'Fatura Olusturuldu', id + ' - ' + (data.FaturaNo || ''));
  if ((needIds && needIds.length) || (sarfIds && sarfIds.length)) await linkFatura(id, needIds, sarfIds);
  return { id, message: 'Fatura olusturuldu.' };
}

async function updateFatura(id, data, needIds, sarfIds) {
  const existing = (await getFaturalar()).find((f) => f.ID === id);
  if (!existing) throw new Error('Fatura bulunamadi: ' + id);
  const patch = { SonGuncelleme: nowStr() };
  FATURA_HEADERS.forEach((h) => {
    if (h !== 'ID' && h !== 'OlusturmaTarihi' && h !== 'SonGuncelleme' && data[h] !== undefined) patch[h] = data[h];
  });
  await patchRowsById(SHEET_NAMES.FATURALAR, FATURA_HEADERS, { [id]: patch });
  if (data.Tedarikci) await addListItem('Tedarikci', data.Tedarikci);

  if (needIds !== undefined || sarfIds !== undefined) {
    const linked = await getFaturaLinkedRows(id);
    const keepNeed = needIds || linked.needs.map((n) => n.ID);
    const keepSarf = sarfIds || linked.sarf.map((s) => s.ID);
    const dropNeed = linked.needs.map((n) => n.ID).filter((x) => keepNeed.indexOf(x) === -1);
    const dropSarf = linked.sarf.map((s) => s.ID).filter((x) => keepSarf.indexOf(x) === -1);
    if (dropNeed.length || dropSarf.length) await unlinkFatura(dropNeed, dropSarf);
    const addNeed = keepNeed.filter((x) => !linked.needs.some((n) => n.ID === x));
    const addSarf = keepSarf.filter((x) => !linked.sarf.some((s) => s.ID === x));
    if (addNeed.length || addSarf.length) await linkFatura(id, addNeed, addSarf);
  }
  // Faturanin (guncel) odeme bilgisini tum baglantili satirlara yay.
  const fresh = (await getFaturalar()).find((f) => f.ID === id);
  await propagateFaturaPayment(fresh);
  await logAction(null, 'Fatura Guncellendi', id + ' - ' + (fresh.OdemeDurumu || ''));
  return { id, message: 'Fatura guncellendi.' };
}

async function deleteFatura(id) {
  const rowIdx = await sheets.findRowIndex(SHEET_NAMES.FATURALAR, 'ID', id);
  if (rowIdx === -1) throw new Error('Fatura bulunamadi: ' + id);
  const linked = await getFaturaLinkedRows(id);
  await unlinkFatura(linked.needs.map((n) => n.ID), linked.sarf.map((s) => s.ID));
  const freshIdx = await sheets.findRowIndex(SHEET_NAMES.FATURALAR, 'ID', id);
  await sheets.deleteRow(SHEET_NAMES.FATURALAR, freshIdx);
  await logAction(null, 'Fatura Silindi', id);
  return { deleted: id, message: 'Fatura silindi (baglantili satirlar oldugu gibi kaldi).' };
}

// Henuz faturaya baglanmamis, SIPARIS VERILMIS/KARSILANMIS satirlari ayni
// Tedarikci + Siparis Tarihi'ne gore gruplar (ayni gun ayni tedarikciye verilen
// siparisler genelde tek faturadir). Hicbir sey YAZMAZ - sadece oneri dondurur.
async function suggestFaturaGroups() {
  const okDurum = ['Siparis Verildi', 'Yolda', 'KismenAlindi', 'Karsilandi'];
  const eligible = (r) => okDurum.indexOf(r.Durum) !== -1 && !r.FaturaID && r.Tedarikci && r.SiparisTarihi;
  const needs = (await sheets.sheetToObjects(SHEET_NAMES.IHTIYACLAR)).filter(eligible);
  const sarf = (await getSarfSiparisleri()).filter(eligible);
  const groups = {};
  const keyOf = (r) => String(r.Tedarikci).trim().toLowerCase() + '|' + String(r.SiparisTarihi).slice(0, 10);
  const add = (r, kind) => {
    const k = keyOf(r);
    if (!groups[k]) groups[k] = { key: k, Tedarikci: String(r.Tedarikci).trim(), SiparisTarihi: String(r.SiparisTarihi).slice(0, 10), needs: [], sarf: [] };
    groups[k][kind].push(r);
  };
  needs.forEach((r) => add(r, 'needs'));
  sarf.forEach((r) => add(r, 'sarf'));
  return Object.values(groups)
    .filter((g) => g.needs.length + g.sarf.length >= 2)
    .map((g) => {
      const all = g.needs.concat(g.sarf);
      const agg = aggregatePayment(all);
      return {
        key: g.key, Tedarikci: g.Tedarikci, SiparisTarihi: g.SiparisTarihi,
        needIds: g.needs.map((r) => r.ID), sarfIds: g.sarf.map((r) => r.ID),
        OdemeDurumu: agg.OdemeDurumu, OdemeTarihi: agg.OdemeTarihi,
        BelgeLink: mergeLinks(all.map((r) => r.ProformaLink))
      };
    })
    .sort((a, b) => (b.SiparisTarihi > a.SiparisTarihi ? 1 : -1));
}

// Kullanicinin onayladigi gruplardan fatura olusturur. Gruplarin durumu,
// onizlemeden bu yana degismis olabilecegi icin sunucuda YENIDEN hesaplanir.
async function createFaturalarFromGroups(groups) {
  const current = await suggestFaturaGroups();
  let created = 0;
  for (const g of groups || []) {
    const fresh = current.find((c) => c.key === g.key);
    if (!fresh) continue;
    await createFatura({
      Tedarikci: fresh.Tedarikci, FaturaTarihi: fresh.SiparisTarihi,
      OdemeDurumu: fresh.OdemeDurumu, OdemeTarihi: fresh.OdemeTarihi,
      BelgeLink: fresh.BelgeLink,
      Notlar: 'Otomatik gruplandi: ' + fresh.Tedarikci + ' / ' + fresh.SiparisTarihi
    }, fresh.needIds, fresh.sarfIds);
    created++;
  }
  return { created, message: created + ' fatura olusturuldu.' };
}

// ---- Ihtiyac Karsilama (fulfillNeed variantlari) ----
async function fulfillNeed(needId, assetId, user) {
  const need = await getNeed(needId);
  await updateNeed(needId, { Durum: 'Karsilandi', BaglantiliVarlikID: assetId }, require('./rates'));
  if (assetId && need.PersonelAdi) {
    await updateAsset(assetId, { AtananKisi: need.PersonelAdi, Durum: 'Kullanimda' }, user);
  }
  await logAction(user, 'Ihtiyac Karsilandi (Stoktan)', needId + ' -> ' + assetId);
  return { message: need.PersonelAdi ? `Ihtiyac karsilandi ve ${assetId} varligi ${need.PersonelAdi} kisisine atandi.` : `${assetId} varligi stok icin ayrildi.` };
}

async function fulfillNeedAsNewAsset(needId, user) {
  const need = await getNeed(needId);
  const forStock = !need.PersonelAdi;
  const created = await createAsset({
    Kategori: need.Kategori, Marka: need.Marka || '', Model: '', Notlar: need.Aciklama || '',
    Durum: forStock ? 'Stok' : 'Kullanimda', Lokasyon: '', AtananKisi: forStock ? '' : need.PersonelAdi,
    Tedarikci: need.Tedarikci || '', SatinAlmaTarihi: need.SiparisTarihi || '',
    Fiyat: need.Fiyat || '', ParaBirimi: need.ParaBirimi || 'TRY'
  }, user);
  await updateNeed(needId, { Durum: 'Karsilandi', BaglantiliVarlikID: created.id }, require('./rates'));
  await logAction(user, 'Ihtiyac Karsilandi (Yeni Varlik)', needId + ' -> ' + created.id);
  return { message: `Yeni varlik (${created.id}) olusturuldu` + (forStock ? ' ve stoga eklendi.' : ` ve ${need.PersonelAdi} kisisine atandi.`), assetId: created.id };
}

async function fulfillNeedAsSarfStock(needId, user) {
  const need = await getNeed(needId);
  if (!need.MalzemeAdi) throw new Error('Bu ihtiyacin bir Sarf Malzemesi adi yok.');
  const existing = (await sheets.sheetToObjects(SHEET_NAMES.SARF)).find((m) => m.Ad === need.MalzemeAdi);
  let malzemeId;
  if (existing) {
    malzemeId = existing.ID;
  } else {
    const created = await createSarfMalzeme({
      Ad: need.MalzemeAdi, Kategori: '', UyumluModeller: '', Stok: 0, MinStok: 0, Birim: 'Adet',
      Lokasyon: '', Tedarikci: need.Tedarikci || '', BirimFiyat: need.Fiyat || '', ParaBirimi: need.ParaBirimi || 'TRY'
    });
    malzemeId = created.id;
  }
  await sarfHareket({ MalzemeID: malzemeId, IslemTuru: 'Giris', Miktar: 1, Aciklama: "Ihtiyac Listesi'nden karsilandi: " + needId }, user);
  await updateNeed(needId, { Durum: 'Karsilandi', BaglantiliVarlikID: malzemeId }, require('./rates'));
  await logAction(user, 'Ihtiyac Karsilandi (Sarf Malzeme Stoguna Eklendi)', needId + ' -> ' + malzemeId);
  return { message: need.MalzemeAdi + ' stoguna 1 adet eklendi.', malzemeId };
}

// Teslim Formu numara sayaci - Apps Script'te PropertiesService'te tutulur,
// burada basit bir yerel dosyada. UYARI: Bu sayac Apps Script'teki
// TESLIM_FORM_COUNTER ile SENKRON DEGIL - ikisini paralel kullanirsaniz
// numaralar cakisabilir. Apps Script'i tamamen birakip sadece bu sunucuyu
// kullanmaya basladiginizda, asagidaki dosyayi olusturup mevcut sayaci
// (Apps Script Script Properties > TESLIM_FORM_COUNTER) elle yazabilirsiniz.
const fs = require('fs');
const path = require('path');
const COUNTER_FILE = path.join(__dirname, 'teslim-form-counter.json');

async function nextTeslimFormNo() {
  // Ayni idLock'u kullaniyoruz - dosya okuma+yazma da AYNI cakisma riskini
  // tasir (iki istek ayni anda okursa ayni "current" degerini gorup ayni
  // form numarasini uretebilir).
  return withIdLock(async () => {
    let current = 0;
    try {
      current = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')).counter || 0;
    } catch (e) { /* dosya yoksa 0'dan basla */ }
    const next = current + 1;
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ counter: next }));
    return { formNo: 'TF-' + String(next).padStart(4, '0') };
  });
}

// ---- Toplu Ice Aktarma (CSV import) ----
async function importAssets(rows, user) {
  let created = 0, updated = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existingId = row.ID && (await sheets.findRowIndex(SHEET_NAMES.ENVANTER, 'ID', row.ID)) !== -1 ? row.ID : null;
      if (existingId) {
        await updateAsset(existingId, row, user || 'Import');
        updated++;
      } else {
        await createAsset(row, user || 'Import');
        created++;
      }
    } catch (err) {
      errors.push(`Satir ${i + 2}: ${err.message}`);
    }
  }
  const summary = `${created} yeni, ${updated} guncellenen kayit.`;
  await logAction(user, 'CSV Ice Aktarma (Envanter)', summary);
  return { created, updated, errors, message: summary };
}

// rows: [{AdSoyad, Telefon, Email, AktifMi}, ...] - AdSoyad eslesirse GUNCELLENIR,
// eslesmezse YENI KAYIT eklenir. Code.gs'deki importEmployees_ ile ayni.
async function importEmployees(rows) {
  const allRows = await sheets.getSheetValues(SHEET_NAMES.CALISANLAR);
  const headers = allRows[0] || CALISAN_HEADERS;
  const nameCol = headers.indexOf('AdSoyad');
  const personelIdCol = headers.indexOf('PersonelID');
  let created = 0, updated = 0;

  for (const row of rows) {
    let idx = -1;
    for (let i = 1; i < allRows.length; i++) {
      if (allRows[i][nameCol] === row.AdSoyad) { idx = i; break; }
    }
    const currentPersonelId = idx !== -1 ? allRows[idx][personelIdCol] : '';
    const personelId = row.PersonelID || currentPersonelId || (await nextPersonelId());
    const newRow = headers.map((h) => {
      if (h === 'AktifMi') return row[h] || 'Aktif';
      if (h === 'PersonelID') return personelId;
      return row[h] || '';
    });
    if (idx !== -1) {
      await sheets.updateRow(SHEET_NAMES.CALISANLAR, idx + 1, newRow);
      allRows[idx] = newRow;
      updated++;
    } else {
      await sheets.appendRow(SHEET_NAMES.CALISANLAR, newRow);
      allRows.push(newRow);
      created++;
    }
  }
  const summary = `${created} yeni, ${updated} guncellenen calisan.`;
  await logAction(null, 'CSV Ice Aktarma (Calisanlar)', summary);
  return { created, updated, message: summary };
}

// rows: [{ID, PersonelAdi, ...}, ...] - ID doluysa ve mevcutsa GUNCELLENIR,
// bossa/bulunamazsa YENI KAYIT eklenir. Code.gs'deki importNeeds_ ile ayni.
async function importNeeds(rows, ratesModule) {
  let created = 0, updated = 0;
  for (const row of rows) {
    const existingId = row.ID && (await sheets.findRowIndex(SHEET_NAMES.IHTIYACLAR, 'ID', row.ID)) !== -1 ? row.ID : null;
    if (existingId) {
      await updateNeed(existingId, row, ratesModule);
      updated++;
    } else {
      await createNeed(row, ratesModule);
      created++;
    }
  }
  const summary = `${created} yeni, ${updated} guncellenen ihtiyac kaydi.`;
  await logAction(null, 'CSV Ice Aktarma (Ihtiyac Listesi)', summary);
  return { created, updated, message: summary };
}

// Genel (public) QR sayfasi icin sadece finansal olmayan alanlar donuyor.
// PUBLIC_QR_CODE .env'de tanimliysa, dogru kod girilmeden veri donmez.
async function getPublicAsset(id, code) {
  const requiredCode = process.env.PUBLIC_QR_CODE;
  if (requiredCode) {
    if (!code) return { needsCode: true };
    if (code !== requiredCode) return { needsCode: true, error: 'Kod hatali.' };
  }
  const all = await sheets.sheetToObjects(SHEET_NAMES.ENVANTER);
  const asset = all.find((a) => a.ID === id);
  if (!asset) return { error: 'Varlik bulunamadi.' };
  return {
    ID: asset.ID, Kategori: asset.Kategori, Marka: asset.Marka, Model: asset.Model,
    SeriNo: asset.SeriNo, Renk: asset.Renk, Durum: asset.Durum, Lokasyon: asset.Lokasyon, AtananKisi: asset.AtananKisi
  };
}

// ---- Talep Formu sifreleri: her calisan icin 6 haneli, sadece harf
// (buyuk/kucuk karisik), rastgele bir sifre - IK'daki e-postadan bagimsiz,
// tamamen ayri bir kimlik dogrulama alani. Eksik olanlara uretilir, zaten
// sifresi olanlara DOKUNULMAZ (var olan sifreyi degistirmez).
function generateTalepSifresi() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function generateMissingTalepSifreleri() {
  const employees = await sheets.sheetToObjects(SHEET_NAMES.CALISANLAR);
  const generated = [];
  for (const e of employees) {
    if (e.TalepSifresi) continue;
    const sifre = generateTalepSifresi();
    await updateEmployee(e.AdSoyad, { TalepSifresi: sifre });
    generated.push(e.AdSoyad);
  }
  // Yeni uretilenler dahil, TUM calisanlarin GUNCEL halini tek listede donduruyoruz
  // - boylece kullanici tek seferde hem yeni hem eski sifreleri gorebiliyor.
  const allEmployees = generated.length > 0 ? await sheets.sheetToObjects(SHEET_NAMES.CALISANLAR) : employees;
  const all = allEmployees
    .filter((e) => e.TalepSifresi)
    .map((e) => ({ AdSoyad: e.AdSoyad, Email: e.Email || '', TalepSifresi: e.TalepSifresi, isNew: generated.includes(e.AdSoyad) }));
  return { all, newCount: generated.length };
}

// ---- Personel Talepleri (Ekipman Talep Formu - genel/public erisimli) ----
async function nextTalepId() {
  const rows = await sheets.getSheetValues(SHEET_NAMES.PERSONEL_TALEPLERI);
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const m = String(rows[i][0] || '').match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 'TLP-' + String(maxNum + 1).padStart(4, '0');
}

// Talep Sifresi ile calisan dogrulama - Ekipman Talep Formu'nun giris adimi.
// Sifre eslesirse calisanin temel bilgilerini VE zaten uzerine kayitli
// kategorileri (uyari icin) dondurur.
async function verifyTalepSifresi(sifre) {
  if (!sifre) return null;
  const employees = await sheets.sheetToObjects(SHEET_NAMES.CALISANLAR);
  const employee = employees.find((e) => e.TalepSifresi && String(e.TalepSifresi) === String(sifre).trim());
  if (!employee) return null;
  const items = await sheets.sheetToObjects(SHEET_NAMES.ENVANTER);
  const myItems = items.filter((a) => a.AtananKisi === employee.AdSoyad);
  const existingCategories = [...new Set(myItems.map((a) => a.Kategori))];
  return { AdSoyad: employee.AdSoyad, Departman: employee.Departman, existingCategories, myItems: myItems.map((a) => ({ Kategori: a.Kategori, Marka: a.Marka, Model: a.Model })) };
}

// data: { personelAdi, items: [{ Kategori, Adet, UrunLinki, Notlar, mevcutUyari }] }
// Her kalem AYRI bir PersonelTalepleri satiri olarak kaydedilir (sepette
// birlikte gonderilseler bile onay/red islemi kalem bazli kalir).
async function createPersonelTalepleri(personelAdi, departman, items) {
  const created = [];
  for (const item of items) {
    const id = await withIdLock(async () => {
      const newId = await nextTalepId();
      const headerRow = await getEffectiveHeaders(SHEET_NAMES.PERSONEL_TALEPLERI, PERSONEL_TALEP_HEADERS);
      const row = headerRow.map((h) => {
        if (h === 'ID') return newId;
        if (h === 'PersonelAdi') return personelAdi;
        if (h === 'Departman') return departman || '';
        if (h === 'Durum') return 'Bekliyor';
        if (h === 'OlusturmaTarihi') return nowStr();
        if (h === 'MevcutEkipmanUyarisi') return item.mevcutUyari ? 'TRUE' : '';
        return item[h] !== undefined ? item[h] : '';
      });
      await sheets.appendRow(SHEET_NAMES.PERSONEL_TALEPLERI, row);
      return newId;
    });
    created.push(id);
  }
  return { created, count: created.length };
}

async function getPersonelTalepleri() {
  const all = await sheets.sheetToObjects(SHEET_NAMES.PERSONEL_TALEPLERI);
  return all.filter((t) => t.Durum === 'Bekliyor');
}

async function updatePersonelTalepDurum(id, durum) {
  const rowIdx = await sheets.findRowIndex(SHEET_NAMES.PERSONEL_TALEPLERI, 'ID', id);
  if (rowIdx === -1) throw new Error('Talep bulunamadi: ' + id);
  const rows = await sheets.getSheetValues(SHEET_NAMES.PERSONEL_TALEPLERI);
  const headerRow = rows[0];
  const durumCol = headerRow.indexOf('Durum');
  const newRow = rows[rowIdx - 1].slice();
  newRow[durumCol] = durum;
  await sheets.updateRow(SHEET_NAMES.PERSONEL_TALEPLERI, rowIdx, newRow);
  return { id, durum };
}

// ---- Ag Altyapisi: 5 tabloyu (vlan/ip/port/firewall/changelog) TEK bir
// genel mekanizma ile yonetiyoruz - her biri icin ayri ayri fonksiyon
// yazmiyoruz, NETWORK_TABLES'daki tanima gore calisiyor. ----
function getNetworkTableDef(table) {
  const def = NETWORK_TABLES[table];
  if (!def) throw new Error('Bilinmeyen ag tablosu: ' + table);
  return def;
}

async function nextNetworkRowId(table) {
  const def = getNetworkTableDef(table);
  const rows = await sheets.getSheetValues(def.sheet);
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const m = String(rows[i][0] || '').match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return def.prefix + '-' + String(maxNum + 1).padStart(4, '0');
}

async function getNetworkRows(table) {
  const def = getNetworkTableDef(table);
  return sheets.sheetToObjects(def.sheet);
}

async function createNetworkRow(table, data) {
  const def = getNetworkTableDef(table);
  const id = await withIdLock(async () => {
    const newId = await nextNetworkRowId(table);
    const headerRow = await getEffectiveHeaders(def.sheet, def.headers);
    const row = headerRow.map((h) => (h === 'ID' ? newId : (data[h] !== undefined ? data[h] : '')));
    await sheets.appendRow(def.sheet, row);
    return newId;
  });
  await logAction('sistem', `${def.prefix} eklendi`, id);
  return { ID: id, ...data };
}

async function updateNetworkRow(table, id, data) {
  const def = getNetworkTableDef(table);
  const rowIdx = await sheets.findRowIndex(def.sheet, 'ID', id);
  if (rowIdx === -1) throw new Error('Kayit bulunamadi: ' + id);
  const rows = await sheets.getSheetValues(def.sheet);
  const actualHeaders = rows[0];
  const current = {};
  actualHeaders.forEach((h, i) => { if (h) current[h] = rows[rowIdx - 1][i]; });
  const newRow = actualHeaders.map((h) => {
    if (!h) return '';
    if (h === 'ID') return id;
    return data[h] !== undefined ? data[h] : current[h];
  });
  await sheets.updateRow(def.sheet, rowIdx, newRow);
  await logAction('sistem', `${def.prefix} guncellendi`, id);
  return { ID: id, ...data };
}

async function deleteNetworkRow(table, id) {
  const def = getNetworkTableDef(table);
  const rowIdx = await sheets.findRowIndex(def.sheet, 'ID', id);
  if (rowIdx === -1) throw new Error('Kayit bulunamadi: ' + id);
  await sheets.deleteRow(def.sheet, rowIdx);
  await logAction('sistem', `${def.prefix} silindi`, id);
  return { deleted: id };
}

module.exports = {
  SHEET_NAMES, ENVANTER_HEADERS, HAREKET_HEADERS, LISTE_HEADERS, IHTIYAC_HEADERS,
  ODEME_DURUMU_OPTIONS, GUNLUK_HEADERS, CLEAR_ASSIGNEE_STATUSES, SARF_HEADERS, SARF_HAREKET_HEADERS,
  nowStr, nextId, nextHareketId, nextNeedId, logAction, logMovement, addListItem, removeListItem,
  turkishToAscii, transliterateCyrillicToLatin, computeIdentifierParts,
  computeHostnameFromAdSoyad, computeEmailNameFromAdSoyad, nextPersonelId,
  createEmployee, updateEmployee, needRateDate, computeNeedFiyatTRY, createNeed, updateNeed,
  createAsset, updateAsset, getNeed,
  getSarfMalzemeleri, createSarfMalzeme, updateSarfMalzeme, sarfHareket, getAssetSarfCost,
  getSarfSiparisleri, createSarfSiparis, updateSarfSiparis, fulfillSarfSiparis,
  FATURA_HEADERS, getFaturalar, createFatura, updateFatura, deleteFatura, linkFatura, unlinkFatura,
  suggestFaturaGroups, createFaturalarFromGroups,
  addEmployeeTeslimFormLinks, syncTeslimFormLinks,
  fulfillNeed, fulfillNeedAsNewAsset, fulfillNeedAsSarfStock, nextTeslimFormNo,
  importAssets, importEmployees, importNeeds, getPublicAsset, generateMissingTalepSifreleri,
  verifyTalepSifresi, createPersonelTalepleri, getPersonelTalepleri, updatePersonelTalepDurum,
  getNetworkRows, createNetworkRow, updateNetworkRow, deleteNetworkRow
};

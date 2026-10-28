/**
 * STS-BT VARLIK YONETIMI - Apps Script Backend
 * ---------------------------------------------
 * Bu dosya Google Sheets'e baglanan bir Apps Script projesidir.
 * Kurulum icin apps-script/README.md dosyasina bakin.
 */

// ============ AYARLAR ============
// Bu degerleri Script Properties uzerinden ayarlayin (kod icine yazmayin):
// File > Project Settings > Script Properties
//   APP_TOKEN        -> uygulamaya giris icin kullanilacak gizli anahtar
//   DRIVE_FOLDER_ID   -> faturalarin/belgelerin yuklenecegi Drive klasoru ID'si
//   PUBLIC_BASE_URL   -> QR kodun acacagi genel (public) sayfa adresi (GitHub Pages)
//     ornek: https://kullaniciadi.github.io/envanter-app/#/asset/

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ============ SHEET ISIMLERI ============
const SHEETS = {
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
  PERSONEL_TALEPLERI: 'PersonelTalepleri'
};

const ENVANTER_HEADERS = [
  'ID', 'Kategori', 'Marka', 'Model', 'SeriNo', 'Renk', 'Hostname', 'MAC', 'IPAdresi',
  'Durum', 'Lokasyon', 'AtananKisi', 'AtamaTarihi', 'Tedarikci',
  'SatinAlmaTarihi', 'TeslimAlmaTarihi', 'Fiyat', 'ParaBirimi',
  'GarantiBitisTarihi', 'FaturaLink', 'Notlar', 'OlusturmaTarihi', 'SonGuncelleme',
  'LokasyonDetay'
];

const CALISAN_HEADERS = ['AdSoyad', 'Telefon', 'Email', 'Departman', 'AktifMi', 'PersonelID', 'SicilNo', 'Unvan', 'BabaAdi', 'UserName', 'EmailAdresName', 'IseBaslamaTarihi', 'PlanlananBaslangicTarihi', 'EmailDomain', 'ITMuaf', 'EmailBasvuruAdi', 'Cinsiyet', 'Uyruk', 'MuafKategoriler', 'HRKayipSayaci', 'TalepSifresi', 'IstenAyrilmaTarihi', 'Firma', 'EmailKapatildi', 'ErisimDosya', 'Erisim1C', 'MuafErisimler', 'TelefonMAC', 'TeslimFormLink'];

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
// helpers.js'deki ODEME_DURUMU_OPTIONS ile ayni - 3 sabit secenek.
const ODEME_DURUMU_OPTIONS = ['TeklifFiyat', 'Odenmedi', 'KismenOdendi', 'Odendi', 'Iade', 'Iptal'];

const GUNLUK_HEADERS = ['Tarih', 'Kullanici', 'Islem', 'Detay'];

// Sarf malzemeleri (toner, kartus, yedek parca vb.) - adet bazli stok takibi.
// Envanter'deki gibi "her biri benzersiz cihaz" degil, "X adet stokta var" mantigi.
const SARF_HEADERS = [
  'ID', 'Ad', 'Kategori', 'UyumluModeller', 'Stok', 'MinStok', 'Birim',
  'Lokasyon', 'Tedarikci', 'BirimFiyat', 'ParaBirimi', 'Notlar',
  'OlusturmaTarihi', 'SonGuncelleme'
];

const SARF_HAREKET_HEADERS = [
  'HareketID', 'MalzemeID', 'Tarih', 'IslemTuru', 'Miktar', 'IlgiliVarlikID', 'Aciklama', 'IslemYapan'
];

// helpers.js'deki SARF_SIPARIS_HEADERS ile ayni.
const SARF_SIPARIS_HEADERS = [
  'ID', 'MalzemeID', 'MalzemeAdi', 'Miktar', 'Birim', 'Tedarikci',
  'Fiyat', 'ParaBirimi', 'FiyatTRY', 'SiparisTarihi', 'TahminiTeslimatTarihi',
  'KargoFirmasi', 'KargoTakipNo', 'Durum', 'OdemeDurumu', 'OdemeTarihi',
  'ProformaLink', 'Notlar', 'OlusturmaTarihi', 'SonGuncelleme', 'FaturaID'
];

// helpers.js'deki FATURA_HEADERS ile ayni - Fatura/Proforma kayitlari, birden
// fazla Ihtiyac satirini (ve Sarf siparisini) TEK bir odeme durumuna baglar.
const FATURA_HEADERS = [
  'ID', 'FaturaNo', 'Tedarikci', 'FaturaTarihi', 'Tutar', 'ParaBirimi',
  'OdemeDurumu', 'OdemeTarihi', 'BelgeLink', 'Notlar', 'OlusturmaTarihi', 'SonGuncelleme'
];

const PERSONEL_TALEP_HEADERS = [
  'ID', 'PersonelAdi', 'Departman', 'Kategori', 'Adet', 'UrunLinki', 'Notlar', 'MevcutEkipmanUyarisi', 'Durum', 'OlusturmaTarihi'
];

const DEFAULT_LISTS = {
  Kategori: [
    'Dizustu Bilgisayar', 'Masaustu Bilgisayar', 'Monitor', 'Yazici', 'Telefon', 'Tablet', 'Ag Cihazi', 'Sunucu',
    'Электроды (УОНИ, АНО, МР)', 'Сварочная проволока (сплошная, порошковая, омедненная)', 'Флюс сварочный',
    'Газ (аргон, углекислота, пропан, кислород, ацетилен)', 'Сварочные аппараты (инверторы, полуавтоматы, трансформаторы)',
    'Горелки, резаки, вставки, сопла', 'Маски, щитки, светофильтры', 'Краги, рукавицы, спецодежда сварщика',
    'Зажимы заземления, кабельные наконечники', 'Трубы (э/с, в/г, н/д, профильные, нержавеющие)',
    'Фитинги (отводы, тройники, переходы, заглушки)', 'Фланцы (плоские, воротниковые, ответные)',
    'Задвижки, краны, вентили, клапаны обратные', 'Крепеж для труб (хомуты, опоры, подвесы, скобы)',
    'Уплотнители (паронит, фум-лента, льняная прядь, герметики)', 'Изоляция трубная (ППУ, минвата, кожухи оцинкованные)',
    'Балки (двутавр, швеллер, уголок, тавр)', 'Лист металлический (г/к, х/к, рифленый, оцинкованный)',
    'Профнастил (стеновой, кровельный, несущий)', 'Металлочерепица, доборные элементы',
    'Заклепки, болты (высокопрочные, оцинкованные, анкерные)', 'Гайки, шайбы, шплинты',
    'Сетка сварная, рабица, перфолист', 'Грунтовка, эмаль, цинкосодержащие составы (холодное цинкование)',
    'Бетон, раствор, пескобетон', 'Песок, щебень, гравий, ПГС', 'Кирпич, блоки (пеноблок, газоблок, керамоблок)',
    'Доска обрезная, брус, фанера, ОСБ', 'Саморезы, дюбели, анкеры, нейлоновые вставки',
    'Утеплитель (минвата, пенопласт, ЭППС, базальт)', 'Бумага офисная (А4, А3)',
    'Канцелярия (ручки, карандаши, маркеры, корректоры)', 'Папки, скоросшиватели, файлы, разделители',
    'Картриджи для принтеров/МФУ (тонер, чернила)', 'Канцелярские принадлежности (степлеры, дыроколы, ножницы)',
    'Хозтовары (мыло, бумага туалетная, полотенца, мешки для мусора)', 'Вода питьевая, кулеры, одноразовая посуда',
    'Оргтехника (принтеры, сканеры, клавиатуры, мышки)', 'Чистящие средства для офиса', 'Diger'
  ],
  Lokasyon: ['Tasucu Ofis', 'Tasucu Depo', 'Akkuyu Ofis-1', 'Akkuyu Ofis-2', 'Akkuyu Depo'],
  Durum: ['Stok', 'Kullanimda', 'Rezerve', 'Onarimda', 'Arizali', 'Kayip', 'Hurda', 'Elden Cikarildi', 'Kartus Bitti', 'Iade'],
  ParaBirimi: ['TRY', 'USD', 'EUR', 'RUB'],
  Marka: ['Huawei', 'Asus', 'Lenovo', 'Logitech', 'HP', 'Dell', 'Apple'],
  Renk: ['Siyah', 'Gri', 'Beyaz'],
  Tedarikci: [],
  Departman: [],
  KargoFirmasi: ['Yurtici Kargo', 'Aras Kargo', 'MNG Kargo', 'PTT Kargo', 'UPS', 'DHL', 'FedEx'],
  SarfKategori: ['Toner', 'Kartus', 'Drum/Tambur', 'Yedek Parca', 'Kablo/Aksesuar', 'Diger'],
  // Bu 3 liste, satin alma sefinin Excel sablonundaki (Списки sekmesi) degerlerle
  // BIREBIR AYNI yazildi - boylece Aylik Satin Alma Plani disa aktarilirken hicbir
  // ceviri/eslestirme gerekmez, secilen deger dogrudan dosyaya yazilir.
  Birim: ['шт / adet', 'м / m', 'кг / kg', 'т / ton', 'компл / takım', 'л / litre', 'м² / m²', 'м³ / m³', 'пог.м / mt', 'лист / levha', 'уп / paket'],
  Oncelik: ['Срочно / Acil', 'Высокий / Yüksek', 'Средний / Orta', 'Низкий / Düşük'],
  OdemeTuru: ['Безнал / Banka havalesi', 'Наличные / Nakit', 'Постоплата / Ertelenmiş ödeme', 'Предоплата 50% / %50 ön ödeme', 'Предоплата 100% / %100 ön ödeme']
};

// Cihaz bu durumlardan birine gecince artik kimseye zimmetli sayilmaz,
// AtananKisi otomatik olarak temizlenir.
const CLEAR_ASSIGNEE_STATUSES = ['Stok', 'Hurda', 'Elden Cikarildi', 'Kayip'];

// ============ KURULUM: sheet'leri ilk kez olustur ============
function setupSheets() {
  const spreadsheet = ss_();
  ensureSheet_(spreadsheet, SHEETS.ENVANTER, ENVANTER_HEADERS);
  ensureSheet_(spreadsheet, SHEETS.CALISANLAR, CALISAN_HEADERS);
  ensureSheet_(spreadsheet, SHEETS.HAREKETLER, HAREKET_HEADERS);
  ensureSheet_(spreadsheet, SHEETS.LISTELER, LISTE_HEADERS);
  ensureSheet_(spreadsheet, SHEETS.IHTIYACLAR, IHTIYAC_HEADERS);
  ensureSheet_(spreadsheet, SHEETS.GUNLUK, GUNLUK_HEADERS);

  const listeSheet = spreadsheet.getSheetByName(SHEETS.LISTELER);
  if (listeSheet.getLastRow() < 2) {
    const maxLen = Math.max.apply(null, Object.keys(DEFAULT_LISTS).map(function(k) { return DEFAULT_LISTS[k].length; }));
    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      rows.push(LISTE_HEADERS.map(function(h) { return DEFAULT_LISTS[h][i] || ''; }));
    }
    listeSheet.getRange(2, 1, rows.length, LISTE_HEADERS.length).setValues(rows);
  }
  return 'Kurulum tamamlandi.';
}

// Mevcut (bos olmayan) Listeler sekmenize, DEFAULT_LISTS'e sonradan eklenen yeni
// varsayilan degerleri (Birim, Oncelik, Odeme Turu, genisletilmis Kategori listesi)
// ekler. setupSheets() sadece BOS bir Listeler sekmesinde calisir, bu yuzden bu
// fonksiyonu Apps Script editorunde BIR KERE calistirmaniz gerekiyor. addListItem_
// zaten var olanlari atladigi icin birden fazla calistirsaniz da sorun olmaz.
function seedProcurementLists_() {
  let eklenen = 0;
  ['Birim', 'Oncelik', 'OdemeTuru', 'Kategori'].forEach(function(key) {
    DEFAULT_LISTS[key].forEach(function(v) {
      const before = getLists_()[key].length;
      addListItem_(key, v);
      if (getLists_()[key].length > before) eklenen++;
    });
  });
  return eklenen + ' yeni liste degeri eklendi.';
}

// Bir sheet'e YENI satir eklerken kullanilacak baslik sirasini dondurur:
// sheet'in GERCEK baslik satirini okur (kullanici elle sutun eklemis/sira
// degistirmis olsa bile). Boylece sabit HEADERS dizisiyle gercek sutun sirasi
// uyusmadiginda degerlerin yanlis hucrelere yazilmasi ("kayma" hatasi) onlenir.
function getEffectiveHeaders_(sheet, fallbackHeaders) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return fallbackHeaders;
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (!headerRow.some(function(h) { return h; })) return fallbackHeaders;
  // fallbackHeaders'da (kodda) olup sheet'in gercek baslik satirinda henuz
  // olmayan - yani sonradan koda eklenmis yeni bir alan (orn. OdemeDurumu) -
  // basliklari, MEVCUT SIRAYI hic bozmadan sona ekliyoruz. Boylece kod yeni
  // bir alan eklediginde kullanicinin Google Sheet'e elle sutun eklemesi
  // gerekmez - "kayma" hatasina yol acmadan otomatik gocurulur (migration).
  const missing = fallbackHeaders.filter(function(h) { return headerRow.indexOf(h) === -1; });
  if (missing.length === 0) return headerRow;
  // Izgara sutun sayisi yetmiyorsa genislet (aksi halde "outside dimensions" hatasi).
  const needed = headerRow.length + missing.length;
  if (sheet.getMaxColumns() < needed) sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns());
  sheet.getRange(1, headerRow.length + 1, 1, missing.length).setValues([missing]);
  return headerRow.concat(missing);
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    // Sheet zaten doluysa ama HEADERS sabitine sonradan yeni bir sutun eklendiyse
    // (orn. PersonelID), eksik basliklari mevcut basliklarin sagina ekler.
    // Mevcut sutun sirasina/veriye dokunmaz, sadece eksik olani tamamlar.
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missing = headers.filter(function(h) { return existingHeaders.indexOf(h) === -1; });
    if (missing.length > 0) {
      const needed = existingHeaders.length + missing.length;
      if (sheet.getMaxColumns() < needed) sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns());
      sheet.getRange(1, existingHeaders.length + 1, 1, missing.length).setValues([missing]);
      sheet.getRange(1, existingHeaders.length + 1, 1, missing.length).setFontWeight('bold');
    }
  }
  applyTextFormatColumns_(sheet, headers);
  return sheet;
}

// "00123" gibi basindaki sifirlar onemli olan alanlar - Sheets bunlari sayi sanip
// otomatik sildigi icin bu sutunlari kalici olarak "Duz metin" bicimine ceviriyoruz.
const TEXT_FORMAT_COLUMNS = ['SeriNo', 'MAC', 'IPAdresi', 'Hostname', 'ID', 'Telefon', 'SicilNo', 'KargoTakipNo', 'UserName', 'TelefonMAC'];

function applyTextFormatColumns_(sheet, headers) {
  TEXT_FORMAT_COLUMNS.forEach(function(colName) {
    const idx = headers.indexOf(colName);
    if (idx === -1) return;
    sheet.getRange(1, idx + 1, Math.max(sheet.getMaxRows(), 1000), 1).setNumberFormat('@');
  });
}

// Sheet'iniz zaten kuruluysa ve Seri No gibi alanlarda basindaki sifirlar
// siliniyorsa, bunu Apps Script editorunde BIR KERE calistirin - tum ilgili
// sutunlari "Duz metin" bicimine cevirir (mevcut veriyi SILMEZ, sadece bicimi
// degistirir; halihazirda sayiya donusmus degerleri elle duzeltmeniz gerekebilir).
function fixTextFormatting_() {
  applyTextFormatColumns_(ss_().getSheetByName(SHEETS.ENVANTER), ENVANTER_HEADERS);
  applyTextFormatColumns_(ss_().getSheetByName(SHEETS.CALISANLAR), CALISAN_HEADERS);
  return 'Metin bicimi uygulandi. Eger bir hucre onceden sayiya donusup basindaki sifirlari kaybettiyse, o hucreleri elle duzeltmeniz gerekir (bicim degisikligi gecmis veriyi geri getirmez).';
}

// ============ YARDIMCI: sheet <-> JSON ============
const DATE_FIELDS = ['AtamaTarihi', 'SatinAlmaTarihi', 'TeslimAlmaTarihi', 'GarantiBitisTarihi'];

// Sheets'teki bir tarih hucresini her zaman 'yyyy-MM-dd' formatina cevirir - bu format
// hem HTML tarih secicilerinin (input type=date) beklediyi format, hem de tutarli goruntuleme icin gerekli.
// Gercek Date nesnesi, veya "12.08.2026" / "08/12/2026" gibi metin olarak girilmis tarihleri de tanir.
function normalizeDate_(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // zaten dogru format
  const dmY = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/); // 12.08.2026 veya 12/08/2026
  if (dmY) {
    const day = dmY[1].padStart(2, '0');
    const month = dmY[2].padStart(2, '0');
    return dmY[3] + '-' + month + '-' + day;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return s; // tanimlanamadi, oldugu gibi birak
}

function sheetToObjects_(sheetName) {
  const sheet = ss_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);
  return rows
    .filter(function(row) { return row.some(function(cell) { return cell !== '' && cell !== null; }); })
    .map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) {
        let val = row[i];
        if (DATE_FIELDS.indexOf(h) !== -1) {
          val = normalizeDate_(val);
        } else if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        }
        obj[h] = val;
      });
      return obj;
    });
}

function findRowIndexById_(sheetName, idColumnName, idValue) {
  const sheet = ss_().getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idColumnName);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(idValue)) return i + 1; // 1-indexed sheet row
  }
  return -1;
}

function nextId_(prefix) {
  const sheet = ss_().getSheetByName(SHEETS.ENVANTER);
  const lastRow = sheet.getLastRow();
  let maxNum = 0;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(r) {
      const m = String(r[0]).match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
  }
  const next = maxNum + 1;
  return prefix + '-' + ('0000' + next).slice(-4);
}

function nextHareketId_() {
  const sheet = ss_().getSheetByName(SHEETS.HAREKETLER);
  const lastRow = sheet.getLastRow();
  let maxNum = 0;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(r) {
      const m = String(r[0]).match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
  }
  return 'HRK-' + ('0000' + (maxNum + 1)).slice(-4);
}

function nowStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

// Sistem genelinde onemli islemleri kaydeder (Gunluk sekmesi / "Sistem Gunlugu" sayfasi icin).
function logAction_(user, action, detail) {
  try {
    const sheet = ensureSheet_(ss_(), SHEETS.GUNLUK, GUNLUK_HEADERS);
    sheet.appendRow([nowStr_(), user || 'Sistem', action, detail || '']);
  } catch (err) {
    // Log basarisiz olsa bile asil islemi engellememeli
  }
}

// ============ HTTP GIRIS NOKTALARI ============
function doGet(e) {
  const action = e.parameter.action;
  // === AkkuyuMikrotik modulu (ayri dosya: AkkuyuMikrotik.gs) - ek/additive, mevcut mantiga dokunmaz ===
  if (action && action.indexOf('mk_') === 0) {
    return mkDoGet_(e);
  }
  // Ekipman Talep Formu - JSON API DEGIL, tam bir HTML sayfasi dondurur.
  // Ayri bir Apps Script HTML dosyasindan (TalepFormu.html) okunur, kendi
  // Talep Sifresi'yle calisir, google.script.run ile sunucu fonksiyonlarini
  // dogrudan cagirir (doGet/doPost JSON API'sinden BAGIMSIZ bir yol).
  if (e.parameter.page === 'talep') {
    return HtmlService.createHtmlOutputFromFile('TalepFormu')
      .setTitle('Ekipman Talebi')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  try {
    // Genel (auth gerektirmeyen) tek islem: QR kod ile acilan varlik goruntuleme.
    // Ayri bir "genel erisim kodu" (PUBLIC_QR_CODE) ile korunur - kullanici adi
    // gerekmez, sadece paylastiginiz sifreyi bilen gorebilir.
    if (action === 'publicAsset') {
      return jsonOut_(getPublicAsset_(e.parameter.id, e.parameter.code));
    }
    // Ekipman Talep Formu girisi - APP_TOKEN degil, calisanin KENDI Talep
    // Sifresi ile dogrulanir. Herkese acik (genel link).
    if (action === 'talepLogin') {
      const result = verifyTalepSifresi_(e.parameter.sifre);
      if (!result) return jsonOut_({ error: 'Sifre hatali.' }, 401);
      return jsonOut_(result);
    }

    if (!checkAuth_(e.parameter.token)) {
      return jsonOut_({ error: 'Yetkisiz erisim.' }, 401);
    }

    switch (action) {
      case 'inventory':
        return jsonOut_(enrichWithUsd_(sheetToObjects_(SHEETS.ENVANTER)));
      case 'employees':
        return jsonOut_(sheetToObjects_(SHEETS.CALISANLAR));
      case 'movements':
        return jsonOut_(sheetToObjects_(SHEETS.HAREKETLER));
      case 'lists':
        return jsonOut_(getLists_());
      case 'currentRates':
        return jsonOut_(getTcmbRates_(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')) || {});
      case 'exchangeRateForExport':
        return jsonOut_(getAndLogExchangeRate_(e.parameter.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')));
      case 'dashboard':
        return jsonOut_(getDashboard_());
      case 'needs':
        return jsonOut_(sheetToObjects_(SHEETS.IHTIYACLAR));
      case 'logs':
        return jsonOut_(sheetToObjects_(SHEETS.GUNLUK));
      case 'previewHRSync':
        return jsonOut_(previewHRSync_());
      case 'personelTalepleri':
        return jsonOut_(getPersonelTalepleri_());
      case 'sarfMalzemeleri':
        return jsonOut_(getSarfMalzemeleri_());
      case 'sarfHareketleri':
        return jsonOut_(sheetToObjects_(SHEETS.SARF_HAREKETLERI));
      case 'sarfSiparisleri':
        return jsonOut_(getSarfSiparisleri_());
      case 'assetSarfCost':
        return jsonOut_(getAssetSarfCost_(e.parameter.id));
      case 'faturalar':
        return jsonOut_(getFaturalar_());
      case 'suggestFaturaGroups':
        return jsonOut_(suggestFaturaGroups_());
      default:
        return jsonOut_({ error: 'Bilinmeyen islem: ' + action }, 400);
    }
  } catch (err) {
    return jsonOut_({ error: err.message }, 500);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    // === AkkuyuMikrotik modulu (ayri dosya: AkkuyuMikrotik.gs) - farkli auth (MK_SECRET)
    // kullandigi icin mevcut checkAuth_(APP_TOKEN) kontrolunden ONCE devredilir ===
    if (body.action && body.action.indexOf('mk_') === 0) {
      return mkDoPost_(e);
    }
    // Ekipman Talep Formu gonderimi - APP_TOKEN degil, gonderen kisinin Talep
    // Sifresi'yle (body.data.sifre) dogrulanir. Herkese acik (genel link).
    if (body.action === 'talepGonder') {
      const employee = verifyTalepSifresi_(body.data.sifre);
      if (!employee) return jsonOut_({ error: 'Sifre hatali.' }, 401);
      return jsonOut_(createPersonelTalepleri_(employee.AdSoyad, employee.Departman, body.data.items));
    }
    if (!checkAuth_(body.token)) {
      return jsonOut_({ error: 'Yetkisiz erisim.' }, 401);
    }
    const action = body.action;
    switch (action) {
      case 'reddetPersonelTalep':
        return jsonOut_(updatePersonelTalepDurum_(body.id, 'Reddedildi'));
      case 'onaylaPersonelTalep':
        return jsonOut_(updatePersonelTalepDurum_(body.id, 'Onaylandi'));
      case 'createAsset':
        return jsonOut_(createAsset_(body.data, body.user));
      case 'updateAsset':
        return jsonOut_(updateAsset_(body.id, body.data, body.user));
      case 'assignAsset':
        return jsonOut_(assignAsset_(body.data, body.user));
      case 'createEmployee':
        return jsonOut_(createEmployee_(body.data));
      case 'updateEmployee':
        return jsonOut_(updateEmployee_(body.id, body.data));
      case 'uploadFile':
        return jsonOut_(uploadFile_(body.data));
      case 'uploadHandoverForm':
        return jsonOut_(uploadHandoverForm_(body.data));
      case 'syncTeslimFormLinks':
        return jsonOut_(syncTeslimFormLinks_());
      case 'addListItem':
        return jsonOut_(addListItem_(body.data.listName, body.data.value));
      case 'removeListItem':
        return jsonOut_(removeListItem_(body.data.listName, body.data.value));
      case 'importAssets':
        return jsonOut_(importAssets_(body.data.rows, body.user));
      case 'importEmployees':
        return jsonOut_(importEmployees_(body.data.rows));
      case 'createNeed':
        return jsonOut_(createNeed_(body.data));
      case 'updateNeed':
        return jsonOut_(updateNeed_(body.id, body.data));
      case 'fulfillNeed':
        return jsonOut_(fulfillNeed_(body.id, body.data.assetId, body.user));
      case 'fulfillNeedAsNewAsset':
        return jsonOut_(fulfillNeedAsNewAsset_(body.id, body.user));
      case 'fulfillNeedAsSarfStock':
        return jsonOut_(fulfillNeedAsSarfStock_(body.id, body.user, body.data && body.data.ad));
      case 'importNeeds':
        return jsonOut_(importNeeds_(body.data.rows));
      case 'applyHRSync':
        return jsonOut_(applyHRSync_(body.data.items, body.user));
      case 'logAuditSummary':
        return jsonOut_(logAuditSummary_(body.data, body.user));
      case 'nextTeslimFormNo':
        return jsonOut_(nextTeslimFormNo_());
      case 'generateMissingTalepSifreleri':
        return jsonOut_(generateMissingTalepSifreleri_());
      case 'createBackup':
        return jsonOut_(createBackup_(body.user));
      case 'createSarfMalzeme':
        return jsonOut_(createSarfMalzeme_(body.data));
      case 'updateSarfMalzeme':
        return jsonOut_(updateSarfMalzeme_(body.id, body.data));
      case 'sarfHareket':
        return jsonOut_(sarfHareket_(body.data, body.user));
      case 'createSarfSiparis':
        return jsonOut_(createSarfSiparis_(body.data));
      case 'updateSarfSiparis':
        return jsonOut_(updateSarfSiparis_(body.id, body.data));
      case 'fulfillSarfSiparis':
        return jsonOut_(fulfillSarfSiparis_(body.id, body.user));
      case 'createFatura':
        return jsonOut_(createFatura_(body.data.fatura, body.data.needIds, body.data.sarfIds));
      case 'updateFatura':
        return jsonOut_(updateFatura_(body.id, body.data.fatura, body.data.needIds, body.data.sarfIds));
      case 'deleteFatura':
        return jsonOut_(deleteFatura_(body.id));
      case 'linkFatura':
        return jsonOut_(linkFatura_(body.id, body.data.needIds, body.data.sarfIds));
      case 'unlinkFatura':
        return jsonOut_(unlinkFatura_(body.data.needIds, body.data.sarfIds));
      case 'createFaturalarFromGroups':
        return jsonOut_(createFaturalarFromGroups_(body.data.groups));
      default:
        return jsonOut_({ error: 'Bilinmeyen islem: ' + action }, 400);
    }
  } catch (err) {
    return jsonOut_({ error: err.message }, 500);
  }
}

function checkAuth_(token) {
  const expected = getProp_('APP_TOKEN');
  return expected && token === expected;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ ISLEMLER ============
function getLists_() {
  const items = sheetToObjects_(SHEETS.LISTELER);
  const result = { Kategori: [], Lokasyon: [], Durum: [], ParaBirimi: [], Marka: [], Renk: [], Tedarikci: [], Departman: [], KargoFirmasi: [], SarfKategori: [], Birim: [], Oncelik: [], OdemeTuru: [] };
  items.forEach(function(row) {
    Object.keys(result).forEach(function(k) {
      if (row[k]) result[k].push(row[k]);
    });
  });
  return result;
}

// Bir listeye (Kategori/Lokasyon/Durum/Marka/Renk) yeni deger ekler.
function addListItem_(listName, value) {
  if (LISTE_HEADERS.indexOf(listName) === -1) throw new Error('Gecersiz liste: ' + listName);
  const sheet = ensureSheet_(ss_(), SHEETS.LISTELER, LISTE_HEADERS);
  const col = LISTE_HEADERS.indexOf(listName) + 1;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const existing = lastRow >= 2 ? sheet.getRange(2, col, lastRow - 1, 1).getValues().flat() : [];
  if (existing.indexOf(value) !== -1) return { message: 'Zaten listede var.' };
  const firstEmptyRow = existing.findIndex(function(v) { return !v; });
  const targetRow = firstEmptyRow !== -1 ? firstEmptyRow + 2 : lastRow + 1;
  sheet.getRange(targetRow, col).setValue(value);
  return { message: 'Eklendi.' };
}

// Bir listeden deger kaldirir (hucreyi bosaltir).
function removeListItem_(listName, value) {
  if (LISTE_HEADERS.indexOf(listName) === -1) throw new Error('Gecersiz liste: ' + listName);
  const sheet = ensureSheet_(ss_(), SHEETS.LISTELER, LISTE_HEADERS);
  const col = LISTE_HEADERS.indexOf(listName) + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { message: 'Liste bos.' };
  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === value) {
      sheet.getRange(i + 2, col).setValue('');
      return { message: 'Kaldirildi.' };
    }
  }
  return { message: 'Bulunamadi.' };
}

function createAsset_(data, user) {
  const sheet = ensureSheet_(ss_(), SHEETS.ENVANTER, ENVANTER_HEADERS);
  const id = nextId_('IT');
  const now = nowStr_();
  const finalAssignee = CLEAR_ASSIGNEE_STATUSES.indexOf(data.Durum) !== -1 ? '' : (data.AtananKisi || '');
  // ONEMLI: ENVANTER_HEADERS sabiti YERINE sheet'in GERCEK baslik satirini
  // kullaniyoruz (sheet.getLastColumn() genisliginde). Aksi halde kullanici
  // Google Sheet'e elle bir sutun ekleyip (orn. LokasyonDetay'i sona ekleyip)
  // sirayi degistirdiginde, sabit dizi ile gercek sutun sirasi uyusmaz ve
  // degerler yanlis hucrelere yazilir ("kayma" hatasi). updateAsset_ zaten
  // gercek baslik satirini okuyordu; createAsset_ da aynı desene alindi.
  const lastCol = Math.max(sheet.getLastColumn(), ENVANTER_HEADERS.length);
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const row = headerRow.map(function(h) {
    if (h === 'ID') return id;
    if (h === 'OlusturmaTarihi' || h === 'SonGuncelleme') return now;
    if (h === 'AtananKisi') return finalAssignee;
    return data[h] !== undefined ? data[h] : '';
  });
  sheet.appendRow(row);

  // Yeni bir Marka/Renk/Tedarikci girildiyse, bir dahaki sefere listeden secebilmeniz icin otomatik ekle.
  if (data.Marka) addListItem_('Marka', data.Marka);
  if (data.Renk) addListItem_('Renk', data.Renk);
  if (data.Tedarikci) addListItem_('Tedarikci', data.Tedarikci);

  // Ilk atama varsa hareket kaydi olustur
  if (finalAssignee) {
    logMovement_({
      VarlikID: id,
      IslemTuru: 'Ilk Atama',
      OncekiKullanici: '',
      YeniKullanici: finalAssignee,
      OncekiDurum: '',
      YeniDurum: data.Durum || '',
      OncekiLokasyon: '',
      YeniLokasyon: data.Lokasyon || '',
      Aciklama: 'Varlik olusturuldu.'
    }, user);
  }

  logAction_(user, 'Varlik Olusturuldu', id + ' - ' + (data.Kategori || '') + ' ' + (data.Marka || '') + ' ' + (data.Model || ''));
  return { id: id, message: 'Varlik olusturuldu.' };
}

// Bu alanlar "prosedur/tarihce" niteliginde onemli verilerdir - bir kere girildikten sonra
// yanlislikla (ekran hatasi, bos birakma, vs.) BOS deger ile ezilmelerini engelliyoruz.
// Kullanici gercekten yeni bir deger girerse (bos olmayan) normal sekilde guncellenir;
// sadece "bos gonderilmesi" durumunda eski deger korunur.
const PROTECTED_FROM_BLANKING = ENVANTER_HEADERS.filter(function(h) {
  return ['Durum', 'Lokasyon', 'LokasyonDetay', 'AtananKisi', 'Notlar', 'SonGuncelleme', 'ID', 'OlusturmaTarihi'].indexOf(h) === -1;
});

function updateAsset_(id, data, user) {
  const sheet = ensureSheet_(ss_(), SHEETS.ENVANTER, ENVANTER_HEADERS);
  const rowIdx = findRowIndexById_(SHEETS.ENVANTER, 'ID', id);
  if (rowIdx === -1) throw new Error('Varlik bulunamadi: ' + id);

  // ENVANTER_HEADERS.length DEGIL, sheet'in GERCEK sutun genisligi kullanilir -
  // yoksa kullanicinin elle sona ekledigi sutunlar (LokasyonDetay gibi) bu
  // fonksiyonun goremedigi/guncelleyemedigi bir alan haline gelir.
  const lastCol = Math.max(sheet.getLastColumn(), ENVANTER_HEADERS.length);
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const currentRow = sheet.getRange(rowIdx, 1, 1, lastCol).getValues()[0];
  const current = {};
  headerRow.forEach(function(h, i) { current[h] = currentRow[i]; });

  // Guvenlik onlemi: korumali bir alan bos gonderildiyse ve eski deger doluysa, bos degeri yok say.
  PROTECTED_FROM_BLANKING.forEach(function(h) {
    const incoming = data[h];
    const isBlank = incoming === '' || incoming === null || incoming === undefined;
    if (isBlank && current[h]) {
      delete data[h]; // undefined say - asagida current[h] kullanilacak
    }
  });

  // Durum, "kimsede degil" anlamina gelen bir duruma cekiliyorsa AtananKisi'yi
  // otomatik temizle - kullanici formdan bir isim gondermis olsa bile gecersiz sayilir.
  const targetDurum = data.Durum !== undefined ? data.Durum : current.Durum;
  if (CLEAR_ASSIGNEE_STATUSES.indexOf(targetDurum) !== -1) {
    data = Object.assign({}, data, { AtananKisi: '' });
  }

  const changedUser = data.AtananKisi !== undefined && String(data.AtananKisi) !== String(current.AtananKisi);
  const changedDurum = data.Durum !== undefined && String(data.Durum) !== String(current.Durum);
  const changedLokasyon = data.Lokasyon !== undefined && String(data.Lokasyon) !== String(current.Lokasyon);

  const newRow = headerRow.map(function(h) {
    if (h === 'SonGuncelleme') return nowStr_();
    if (h === 'ID' || h === 'OlusturmaTarihi') return current[h];
    return data[h] !== undefined ? data[h] : current[h];
  });
  sheet.getRange(rowIdx, 1, 1, newRow.length).setValues([newRow]);

  if (data.Marka) addListItem_('Marka', data.Marka);
  if (data.Renk) addListItem_('Renk', data.Renk);
  if (data.Tedarikci) addListItem_('Tedarikci', data.Tedarikci);

  if (changedUser || changedDurum || changedLokasyon) {
    let islemTuru = 'Durum Degisikligi';
    if (changedUser && !data.AtananKisi) islemTuru = 'Iade';
    else if (changedUser) islemTuru = 'Transfer';
    logMovement_({
      VarlikID: id,
      IslemTuru: islemTuru,
      OncekiKullanici: current.AtananKisi || '',
      YeniKullanici: data.AtananKisi !== undefined ? data.AtananKisi : current.AtananKisi,
      OncekiDurum: current.Durum || '',
      YeniDurum: data.Durum !== undefined ? data.Durum : current.Durum,
      OncekiLokasyon: current.Lokasyon || '',
      YeniLokasyon: data.Lokasyon !== undefined ? data.Lokasyon : current.Lokasyon,
      Aciklama: data.Aciklama || ''
    }, user);
  }

  return { id: id, message: 'Varlik guncellendi.' };
}

function assignAsset_(data, user) {
  // Sadece atama/iade amacli kisa yol: updateAsset_ ile ayni mantik
  return updateAsset_(data.VarlikID, {
    AtananKisi: data.YeniKullanici,
    Durum: data.YeniDurum,
    Lokasyon: data.YeniLokasyon,
    Aciklama: data.Aciklama
  }, user);
}

function logMovement_(fields, user) {
  const sheet = ensureSheet_(ss_(), SHEETS.HAREKETLER, HAREKET_HEADERS);
  const headerRow = getEffectiveHeaders_(sheet, HAREKET_HEADERS);
  const row = headerRow.map(function(h) {
    if (h === 'HareketID') return nextHareketId_();
    if (h === 'Tarih') return nowStr_();
    if (h === 'IslemYapan') return user || '';
    return fields[h] !== undefined ? fields[h] : '';
  });
  sheet.appendRow(row);
}

// Turkce'ye ozgu karakterleri (ç,ğ,ı,ö,ş,ü) ASCII karsiliklarina cevirir - Hostname
// gibi teknik alanlarda ozel karakter bulunmamasi gerektigi icin kullanilir.
function turkishToAscii_(s) {
  const map = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
  return String(s || '').replace(/[çÇğĞıİöÖşŞüÜ]/g, function(ch) { return map[ch] || ch; });
}

// Kiril (Rusca) karakterleri Latin alfabesine cevirir - HR kaynagindaki "Отчество"
// (baba adi) gibi alanlar Kiril yazildiginda kullanilir. Latin metin oldugu gibi geçer.
function transliterateCyrillicToLatin_(s) {
  const map = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y',
    'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f',
    'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y',
    'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F',
    'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };
  return String(s || '').split('').map(function(ch) { return map[ch] !== undefined ? map[ch] : ch; }).join('');
}

// Ad Soyad + Baba Adi'ndan Hostname/Email kullanici adi uretmek icin ortak parcalari
// cikarir: Ad'in ilk kelimesinin ilk harfi, Baba Adi'nin ilk harfi, Soyad (temiz).
// AdSoyad'da birden fazla "ad" kelimesi varsa (orn. "Ali Can Yilmaz") sadece ILK
// kelimeyi ad, EN SON kelimeyi soyad olarak alir (ortadaki kelimeler yok sayilir).
// NOT: Baba Adi kayitlarda KIRIL olarak saklanir (orn. "Владимирович") - ama
// UserName/EmailAdresName gibi teknik alanlar Roman/Latin harf gerektirir, bu
// yuzden SADECE burada, ilk harfi cikarirken Kiril->Latin cevirisi uygulanir.
function computeIdentifierParts_(adSoyad, babaAdi) {
  const parts = String(adSoyad || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const adFirst = parts[0];
  const soyad = parts[parts.length - 1];
  const adHarf = turkishToAscii_(adFirst).charAt(0);
  const babaHarf = babaAdi ? turkishToAscii_(transliterateCyrillicToLatin_(String(babaAdi).trim().split(/\s+/)[0])).charAt(0) : '';
  const soyadClean = turkishToAscii_(soyad).replace(/[^A-Za-z0-9]/g, '');
  return { adHarf: adHarf, babaHarf: babaHarf, soyad: soyadClean };
}

// "[Ad ilk harfi][Baba adi ilk harfi]_[SOYADI]" formatinda hostname onerisi (BUYUK harf).
function computeHostnameFromAdSoyad_(adSoyad, babaAdi) {
  const p = computeIdentifierParts_(adSoyad, babaAdi);
  if (!p) return '';
  return (p.adHarf + p.babaHarf).toUpperCase() + '_' + p.soyad.toUpperCase();
}

// Ayni format ama e-posta kullanici adi geleneginde KUCUK harfle.
function computeEmailNameFromAdSoyad_(adSoyad, babaAdi) {
  const p = computeIdentifierParts_(adSoyad, babaAdi);
  if (!p) return '';
  return (p.adHarf + p.babaHarf).toLowerCase() + '_' + p.soyad.toLowerCase();
}

// Calisanlar sekmesindeki PersonelID sutunundaki en buyuk numarayi bulup bir sonrakini uretir.
// Ad-soyad ayni olan iki farkli kisiyi ayirt etmek icin kullanilir (rapor/export'larda).
function nextPersonelId_() {
  const sheet = ss_().getSheetByName(SHEETS.CALISANLAR);
  const col = CALISAN_HEADERS.indexOf('PersonelID') + 1;
  const lastRow = sheet ? sheet.getLastRow() : 0;
  let maxNum = 0;
  if (lastRow >= 2 && col > 0) {
    const ids = sheet.getRange(2, col, lastRow - 1, 1).getValues();
    ids.forEach(function(r) {
      const m = String(r[0]).match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
  }
  return 'P-' + ('0000' + (maxNum + 1)).slice(-4);
}

// Sheet zaten kuruluysa ve eski calisan kayitlarinda PersonelID bossa (Faz 2 oncesi
// eklenmis kayitlar), bunlari BIR KERE calistirarak doldurabilirsiniz. Apps Script
// editorunde fonksiyon secim kutusundan "backfillPersonelId_" secip Run'a basin.
function backfillPersonelId_() {
  const sheet = ensureSheet_(ss_(), SHEETS.CALISANLAR, CALISAN_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Calisan kaydi yok.';
  const col = CALISAN_HEADERS.indexOf('PersonelID') + 1;
  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  let filled = 0;
  for (let i = 0; i < values.length; i++) {
    if (!values[i][0]) {
      sheet.getRange(i + 2, col).setValue(nextPersonelId_());
      filled++;
    }
  }
  return filled + ' calisana PersonelID atandi.';
}

function createEmployee_(data) {
  const sheet = ensureSheet_(ss_(), SHEETS.CALISANLAR, CALISAN_HEADERS);
  if (data.AdSoyad && !data.UserName) {
    data.UserName = computeHostnameFromAdSoyad_(data.AdSoyad, data.BabaAdi);
  }
  if (data.AdSoyad && !data.EmailAdresName) {
    data.EmailAdresName = computeEmailNameFromAdSoyad_(data.AdSoyad, data.BabaAdi);
  }
  // Sutun sirasini CALISAN_HEADERS sabitine gore DEGIL, sheet'teki GERCEK
  // baslik satirina gore olusturuyoruz - kullanici sutunlari elle yeniden
  // siralamis/tasimis olsa bile veri her zaman dogru sutuna yazilir.
  const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = actualHeaders.map(function(h) {
    if (!h) return '';
    if (h === 'AktifMi') return data[h] !== undefined ? data[h] : 'Aktif';
    if (h === 'PersonelID') return data.PersonelID || nextPersonelId_();
    return data[h] !== undefined ? data[h] : '';
  });
  sheet.appendRow(row);
  if (data.Departman) addListItem_('Departman', data.Departman);
  logAction_(null, 'Calisan Eklendi', data.AdSoyad || '');
  return { message: 'Calisan eklendi.' };
}

// originalName ile eslesen satiri bulup guncelle - isim de dahil her alan degistirilebilir.
function updateEmployee_(originalName, data) {
  const sheet = ensureSheet_(ss_(), SHEETS.CALISANLAR, CALISAN_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Calisan bulunamadi: ' + originalName);
  // Yine GERCEK baslik satirini kullaniyoruz (bkz. createEmployee_'daki not).
  const actualHeaders = getEffectiveHeaders_(sheet, CALISAN_HEADERS);
  const nameCol = actualHeaders.indexOf('AdSoyad');
  const values = sheet.getRange(2, 1, lastRow - 1, actualHeaders.length).getValues();
  const idx = values.findIndex(function(r) { return r[nameCol] === originalName; });
  if (idx === -1) throw new Error('Calisan bulunamadi: ' + originalName);
  const current = {};
  actualHeaders.forEach(function(h, i) { if (h) current[h] = values[idx][i]; });

  // Ad Soyad veya Baba Adi degistiyse, UserName/EmailAdresName onerilerini otomatik yeniden hesapla.
  if (data.AdSoyad !== undefined || data.BabaAdi !== undefined) {
    const finalAdSoyad = data.AdSoyad !== undefined ? data.AdSoyad : current.AdSoyad;
    const finalBabaAdi = data.BabaAdi !== undefined ? data.BabaAdi : current.BabaAdi;
    data.UserName = computeHostnameFromAdSoyad_(finalAdSoyad, finalBabaAdi);
    data.EmailAdresName = computeEmailNameFromAdSoyad_(finalAdSoyad, finalBabaAdi);
  }

  const newRow = actualHeaders.map(function(h) {
    if (!h) return '';
    return data[h] !== undefined ? data[h] : current[h];
  });
  sheet.getRange(idx + 2, 1, 1, newRow.length).setValues([newRow]);
  if (data.Departman) addListItem_('Departman', data.Departman);

  // Isim degistiyse, Envanter'deki ve Ihtiyaclar'daki referanslari da guncelle ki baglanti kopmasin.
  if (data.AdSoyad && data.AdSoyad !== originalName) {
    const envSheet = ss_().getSheetByName(SHEETS.ENVANTER);
    const envLastRow = envSheet.getLastRow();
    if (envLastRow >= 2) {
      const col = ENVANTER_HEADERS.indexOf('AtananKisi') + 1;
      const assignees = envSheet.getRange(2, col, envLastRow - 1, 1).getValues();
      assignees.forEach(function(r, i) {
        if (r[0] === originalName) envSheet.getRange(i + 2, col).setValue(data.AdSoyad);
      });
    }
    const needSheet = ss_().getSheetByName(SHEETS.IHTIYACLAR);
    const needLastRow = needSheet ? needSheet.getLastRow() : 0;
    if (needLastRow >= 2) {
      const col = IHTIYAC_HEADERS.indexOf('PersonelAdi') + 1;
      const names = needSheet.getRange(2, col, needLastRow - 1, 1).getValues();
      names.forEach(function(r, i) {
        if (r[0] === originalName) needSheet.getRange(i + 2, col).setValue(data.AdSoyad);
      });
    }
  }

  logAction_(null, 'Calisan Guncellendi', originalName);
  return { message: 'Calisan guncellendi.' };
}

// ============ ICE AKTARMA (CSV IMPORT) ============
// rows: [{ID, Kategori, ...}, ...] - Envanter export formatiyla birebir ayni sutunlar beklenir.
// ID sutunu doluysa ve o ID zaten varsa GUNCELLENIR, ID bossa veya bulunamazsa YENI KAYIT olarak eklenir.
function importAssets_(rows, user) {
  const sheet = ensureSheet_(ss_(), SHEETS.ENVANTER, ENVANTER_HEADERS);
  let created = 0;
  let updated = 0;
  const errors = [];

  rows.forEach(function(row, i) {
    try {
      const existingId = row.ID && findRowIndexById_(SHEETS.ENVANTER, 'ID', row.ID) !== -1 ? row.ID : null;
      if (existingId) {
        updateAsset_(existingId, row, user || 'Import');
        updated++;
      } else {
        createAsset_(row, user || 'Import');
        created++;
      }
    } catch (err) {
      errors.push('Satir ' + (i + 2) + ': ' + err.message);
    }
  });

  logAction_(user, 'CSV Ice Aktarma (Envanter)', created + ' yeni, ' + updated + ' guncellenen kayit.');
  return { created: created, updated: updated, errors: errors, message: created + ' yeni, ' + updated + ' guncellenen kayit.' };
}

// rows: [{AdSoyad, Telefon, Email, AktifMi}, ...]
// AdSoyad eslesirse GUNCELLENIR, eslesmezse YENI KAYIT eklenir.
function importEmployees_(rows) {
  const sheet = ensureSheet_(ss_(), SHEETS.CALISANLAR, CALISAN_HEADERS);
  const headerRow = getEffectiveHeaders_(sheet, CALISAN_HEADERS);
  const lastRow = sheet.getLastRow();
  const existing = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, headerRow.length).getValues() : [];
  const personelIdCol = headerRow.indexOf('PersonelID');
  let created = 0;
  let updated = 0;

  rows.forEach(function(row) {
    const idx = existing.findIndex(function(r) { return r[0] === row.AdSoyad; });
    const currentPersonelId = idx !== -1 && personelIdCol !== -1 ? existing[idx][personelIdCol] : '';
    const newRow = headerRow.map(function(h) {
      if (h === 'AktifMi') return row[h] || 'Aktif';
      if (h === 'PersonelID') return row[h] || currentPersonelId || nextPersonelId_();
      return row[h] || '';
    });
    if (idx !== -1) {
      sheet.getRange(idx + 2, 1, 1, headerRow.length).setValues([newRow]);
      updated++;
    } else {
      sheet.appendRow(newRow);
      existing.push(newRow);
      created++;
    }
  });

  logAction_(null, 'CSV Ice Aktarma (Calisanlar)', created + ' yeni, ' + updated + ' guncellenen calisan.');
  return { created: created, updated: updated, message: created + ' yeni, ' + updated + ' guncellenen calisan.' };
}

// Genel (public) QR sayfasi icin sadece finansal olmayan alanlar donuyor.
// PUBLIC_QR_CODE Script Property'si tanimliysa, dogru kod girilmeden veri donmez.
function getPublicAsset_(id, code) {
  const requiredCode = getProp_('PUBLIC_QR_CODE');
  if (requiredCode) {
    if (!code) return { needsCode: true };
    if (code !== requiredCode) return { needsCode: true, error: 'Kod hatali.' };
  }

  const all = sheetToObjects_(SHEETS.ENVANTER);
  const asset = all.filter(function(a) { return a.ID === id; })[0];
  if (!asset) return { error: 'Varlik bulunamadi.' };
  return {
    ID: asset.ID,
    Kategori: asset.Kategori,
    Marka: asset.Marka,
    Model: asset.Model,
    SeriNo: asset.SeriNo,
    Renk: asset.Renk,
    Durum: asset.Durum,
    Lokasyon: asset.Lokasyon,
    AtananKisi: asset.AtananKisi
  };
}

function uploadFile_(data) {
  // data: { assetId, filename, mimeType, base64, sheetName?, linkColumn? }
  // sheetName/linkColumn opsiyonel - verilmezse eskisi gibi Envanter/FaturaLink
  // kullanilir (geriye donuk uyumluluk) - helpers.js/drive.js'deki Node
  // karsiligi ile ayni mantik, Ihtiyaclar (ProformaLink) gibi baska
  // sheet/alanlar icin de kullanilabilsin diye parametrize edildi.
  const folderId = getProp_('DRIVE_FOLDER_ID');
  if (!folderId) throw new Error('DRIVE_FOLDER_ID ayarlanmamis.');
  const folder = DriveApp.getFolderById(folderId);
  const decoded = Utilities.base64Decode(data.base64);
  const blob = Utilities.newBlob(decoded, data.mimeType, data.assetId + '_' + data.filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = file.getUrl();

  const sheetName = data.sheetName || SHEETS.ENVANTER;
  const linkColumn = data.linkColumn || 'FaturaLink';
  if (data.assetId) {
    const rowIdx = findRowIndexById_(sheetName, 'ID', data.assetId);
    if (rowIdx !== -1) {
      const sheet = ss_().getSheetByName(sheetName);
      const fallback = sheetName === SHEETS.IHTIYACLAR ? IHTIYAC_HEADERS
        : sheetName === SHEETS.FATURALAR ? FATURA_HEADERS
        : sheetName === SHEETS.SARF_SIPARISLERI ? SARF_SIPARIS_HEADERS
        : ENVANTER_HEADERS;
      const headerRow = getEffectiveHeaders_(sheet, fallback);
      let col = headerRow.indexOf(linkColumn) + 1;
      if (col === 0) {
        sheet.getRange(1, headerRow.length + 1).setValue(linkColumn);
        col = headerRow.length + 1;
      }
      const existing = sheet.getRange(rowIdx, col).getValue();
      const combined = existing ? existing + ', ' + url : url;
      sheet.getRange(rowIdx, col).setValue(combined);
    }
  }
  return { url: url, message: 'Dosya yuklendi.' };
}

// Calisan Teslim Formlarini (imzali PDF/foto) sabit bir Drive klasorune yukler.
// data: { personelId, adSoyad, filename, mimeType, base64 }
// Klasor ID'si TESLIM_FORM_FOLDER_ID Script Property'sinden okunur - varsayilan
// olarak kullanicinin verdigi "Teslim Formlari" klasorune isaret eder.
function uploadHandoverForm_(data) {
  const folderId = getProp_('TESLIM_FORM_FOLDER_ID');
  if (!folderId) throw new Error('TESLIM_FORM_FOLDER_ID ayarlanmamis.');
  const folder = DriveApp.getFolderById(folderId);
  const decoded = Utilities.base64Decode(data.base64);

  // Dosya adi: IDNo_Adi_Soyadi_Tarih_Saat - ayni isimli iki calisan olsa bile
  // PersonelID sayesinde dosyalar birbirine karismaz.
  const now = new Date();
  const stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'ddMMyyyy_HHmm');
  const safeName = String(data.adSoyad || 'Calisan').replace(/[^\p{L}\p{N}]+/gu, '_');
  const idPart = data.personelId || 'NOID';
  const ext = (data.filename || '').match(/\.[a-zA-Z0-9]+$/);
  const finalName = idPart + '_' + safeName + '_' + stamp + (ext ? ext[0] : '');

  const blob = Utilities.newBlob(decoded, data.mimeType, finalName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  logAction_(null, 'Teslim Formu Yuklendi', finalName);
  // Formun linkini calisanin kaydina da yaz (Calisan sayfasi/Panel/Rapor gostersin).
  try { addEmployeeTeslimFormLinks_({ personelId: data.personelId, adSoyad: data.adSoyad }, [file.getUrl()]); } catch (e) { /* link yazilamazsa yukleme yine basarili sayilir */ }
  return { url: file.getUrl(), filename: finalName, message: 'Teslim formu yuklendi.' };
}

// ---- Calisan Teslim Formlari: linkler Calisanlar!TeslimFormLink'te (virgulle ayrilmis) ----
function driveFileId_(url) {
  const m = String(url || '').match(/\/d\/([\w-]+)/) || String(url || '').match(/[?&]id=([\w-]+)/);
  return m ? m[1] : String(url || '').trim();
}

function addEmployeeTeslimFormLinks_(match, urls) {
  const sheet = ss_().getSheetByName(SHEETS.CALISANLAR);
  if (!sheet) return 0;
  const headers = getEffectiveHeaders_(sheet, CALISAN_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const idCol = headers.indexOf('PersonelID');
  const nameCol = headers.indexOf('AdSoyad');
  const linkCol = headers.indexOf('TeslimFormLink');
  let idx = -1;
  if (match.personelId) idx = values.findIndex(function(r) { return r[idCol] === match.personelId; });
  if (idx === -1 && match.adSoyad) idx = values.findIndex(function(r) { return r[nameCol] === match.adSoyad; });
  if (idx === -1) return 0;
  const existing = splitLinks_(values[idx][linkCol]);
  const have = {};
  existing.forEach(function(u) { have[driveFileId_(u)] = true; });
  const toAdd = urls.filter(function(u) { return u && !have[driveFileId_(u)]; });
  if (!toAdd.length) return 0;
  sheet.getRange(idx + 2, linkCol + 1).setValue(existing.concat(toAdd).join(', '));
  return toAdd.length;
}

// Klasordeki MEVCUT formlari dosya adindaki PersonelID'ye gore calisanlara eslestirir.
function syncTeslimFormLinks_() {
  const folderId = getProp_('TESLIM_FORM_FOLDER_ID');
  if (!folderId) throw new Error('TESLIM_FORM_FOLDER_ID ayarlanmamis.');
  const folder = DriveApp.getFolderById(folderId);
  const it = folder.getFiles();
  const groups = {};
  const unmatched = [];
  let total = 0;
  const sheet = ss_().getSheetByName(SHEETS.CALISANLAR);
  if (!sheet) throw new Error('Calisanlar sayfasi bulunamadi.');
  const headers = getEffectiveHeaders_(sheet, CALISAN_HEADERS);
  const lastRow = sheet.getLastRow();
  const ids = {};
  if (lastRow >= 2) {
    const idCol = headers.indexOf('PersonelID');
    sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues().forEach(function(r) { if (r[0]) ids[r[0]] = true; });
  }
  while (it.hasNext()) {
    const f = it.next();
    total++;
    const m = String(f.getName()).match(/^(.+?)_/);
    const pid = m ? m[1] : '';
    if (pid && ids[pid]) { (groups[pid] = groups[pid] || []).push(f.getUrl()); } else { unmatched.push(f.getName()); }
  }
  let added = 0;
  let people = 0;
  Object.keys(groups).forEach(function(pid) {
    const n = addEmployeeTeslimFormLinks_({ personelId: pid }, groups[pid]);
    if (n) { added += n; people++; }
  });
  return { added: added, people: people, unmatched: unmatched, total: total, message: added + ' form, ' + people + ' calisana eslestirildi.' };
}

// ============ IHTIYAC LISTESI (bekleyen personel / planlanan ekipman) ============
// Yeni personel gelecekse ama envanter henuz alinmadiysa, buraya bir "ihtiyac" kaydi
// dusersiniz (kim, hangi kategori cihaz, ne zamana kadar). Envanter geldiginde
// fulfillNeed_ ile gercek varlik ID'sine baglanir ve otomatik olarak o kisiye atanir.
function nextNeedId_() {
  const sheet = ss_().getSheetByName(SHEETS.IHTIYACLAR);
  const lastRow = sheet ? sheet.getLastRow() : 0;
  let maxNum = 0;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(r) {
      const m = String(r[0]).match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
  }
  return 'IHT-' + ('0000' + (maxNum + 1)).slice(-4);
}

// Bir ihtiyacin TL karsiligi hangi TARIHTEKI resmi kurla hesaplanmali:
// "Bekleniyor" (henuz siparis verilmemis) -> Planlanan Tarih (hedef/tahmini tarih,
// cunku parayi HENUZ o gunku kurla harcamadik, tahmini kur budur);
// "Siparis Verildi"/"Karsilandi" (zaten siparis edilmis) -> Siparis Tarihi
// (gercek odeme o gun yapildigi icin gercek kur budur).
function needRateDate_(data) {
  const durum = data.Durum || 'Bekleniyor';
  const today = nowStr_().slice(0, 10);
  if (durum === 'Bekleniyor' || durum === 'Onaylandi') return data.PlanlananTarih || data.OlusturmaTarihi || today;
  return data.SiparisTarihi || data.PlanlananTarih || data.OlusturmaTarihi || today;
}

// Fiyat + ParaBirimi'ni, DOGRU TARIHTEKI TCMB kuruyla TL karsiligina cevirip
// yuvarlar - boylece ihtiyaclar tablosunda saklanan TL degeri her zaman o
// kaydin gercek/planlanan tarihine gore dogru olur, "bugunku kur" ile karismaz.
function computeNeedFiyatTRY_(data) {
  if (!data.Fiyat) return '';
  const tarih = needRateDate_(data);
  const converted = convertCurrency_(data.Fiyat, data.ParaBirimi || 'TRY', tarih, 'TRY');
  return converted !== null ? Math.round(converted * 100) / 100 : '';
}

function createNeed_(data) {
  const sheet = ensureSheet_(ss_(), SHEETS.IHTIYACLAR, IHTIYAC_HEADERS);
  const id = nextNeedId_();
  const now = nowStr_();
  const durum = data.Durum || 'Bekleniyor';
  const fiyatTRY = computeNeedFiyatTRY_({ Fiyat: data.Fiyat, ParaBirimi: data.ParaBirimi, Durum: durum, PlanlananTarih: data.PlanlananTarih, SiparisTarihi: data.SiparisTarihi, OlusturmaTarihi: now });
  const headerRow = getEffectiveHeaders_(sheet, IHTIYAC_HEADERS);
  const row = headerRow.map(function(h) {
    if (h === 'ID') return id;
    if (h === 'OlusturmaTarihi') return now;
    if (h === 'Durum') return durum;
    if (h === 'BaglantiliVarlikID') return '';
    if (h === 'FiyatTRY') return fiyatTRY;
    if (h === 'OdemeDurumu') return data.OdemeDurumu || 'Odenmedi';
    return data[h] !== undefined ? data[h] : '';
  });
  sheet.appendRow(row);

  if (data.Tedarikci) addListItem_('Tedarikci', data.Tedarikci);
  if (data.Departman) addListItem_('Departman', data.Departman);

  // Personel henuz Calisanlar listesinde yoksa "Beklemede" durumuyla otomatik ekle -
  // ise baslamadan once ekipman planlamasi yapabilmeniz icin tekrar elle girmenize gerek kalmaz.
  if (data.PersonelAdi) {
    ensureEmployeeExists_(data.PersonelAdi, data.Departman);
  }

  logAction_(null, 'Ihtiyac Olusturuldu', id + ' - ' + (data.PersonelAdi || '') + ' / ' + (data.Kategori || ''));
  return { id: id, message: 'Ihtiyac kaydi olusturuldu.' };
}

// Calisanlar sayfasinda bu isim yoksa "Beklemede" durumuyla yeni bir satir ekler.
function ensureEmployeeExists_(name, departman) {
  const sheet = ensureSheet_(ss_(), SHEETS.CALISANLAR, CALISAN_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    if (names.indexOf(name) !== -1) return; // zaten var
  }
  sheet.appendRow([name, '', '', departman || '', 'Beklemede']);
}

function updateNeed_(id, data) {
  const sheet = ensureSheet_(ss_(), SHEETS.IHTIYACLAR, IHTIYAC_HEADERS);
  const rowIdx = findRowIndexById_(SHEETS.IHTIYACLAR, 'ID', id);
  if (rowIdx === -1) throw new Error('Ihtiyac kaydi bulunamadi: ' + id);
  const headerRow = getEffectiveHeaders_(sheet, IHTIYAC_HEADERS);
  const currentRow = sheet.getRange(rowIdx, 1, 1, headerRow.length).getValues()[0];
  const current = {};
  headerRow.forEach(function(h, i) { current[h] = currentRow[i]; });
  // Bir faturaya bagli satirin odeme bilgisini FATURA belirler: satirdan gelen
  // OdemeDurumu/OdemeTarihi degisikligi yok sayilir (fatura baglantisi ayni
  // cagrida kaldiriliyorsa - data.FaturaID === '' - serbesttir).
  if (current.FaturaID && data.FaturaID === undefined && (data.OdemeDurumu !== undefined || data.OdemeTarihi !== undefined)) {
    data = Object.assign({}, data);
    delete data.OdemeDurumu;
    delete data.OdemeTarihi;
  }

  // Fiyat/ParaBirimi/tarihler/durum degismis olabilir - TL karsiligini HER
  // GUNCELLEMEDE, guncel (birlesmis) degerlerle yeniden hesapliyoruz. Boylece
  // orn. "Siparis Verildi" yapip Siparis Tarihi girdiginizde TL karsiligi
  // otomatik o gunun gercek kuruna gore duzelir.
  const merged = {};
  headerRow.forEach(function(h) { merged[h] = data[h] !== undefined ? data[h] : current[h]; });
  const fiyatTRY = computeNeedFiyatTRY_(merged);

  const newRow = headerRow.map(function(h) {
    if (h === 'ID' || h === 'OlusturmaTarihi') return current[h];
    if (h === 'FiyatTRY') return fiyatTRY;
    return data[h] !== undefined ? data[h] : current[h];
  });
  sheet.getRange(rowIdx, 1, 1, newRow.length).setValues([newRow]);
  if (data.Tedarikci) addListItem_('Tedarikci', data.Tedarikci);
  if (data.Departman) addListItem_('Departman', data.Departman);
  return { id: id, message: 'Ihtiyac kaydi guncellendi.' };
}

function getNeed_(needId) {
  const rowIdx = findRowIndexById_(SHEETS.IHTIYACLAR, 'ID', needId);
  if (rowIdx === -1) throw new Error('Ihtiyac kaydi bulunamadi: ' + needId);
  const sheet = ss_().getSheetByName(SHEETS.IHTIYACLAR);
  const headerRow = getEffectiveHeaders_(sheet, IHTIYAC_HEADERS);
  const currentRow = sheet.getRange(rowIdx, 1, 1, headerRow.length).getValues()[0];
  const need = {};
  headerRow.forEach(function(h, i) { need[h] = currentRow[i]; });
  return need;
}

// Bir ihtiyaci, gercekten alinmis/mevcut bir Envanter varligina baglayip "Karsilandi" yapar.
// Ayrica o varligi otomatik olarak ilgili kisiye atar (elle tekrar atamaniza gerek kalmaz).
function fulfillNeed_(needId, assetId, user) {
  const need = getNeed_(needId);
  updateNeed_(needId, { Durum: 'Karsilandi', BaglantiliVarlikID: assetId });

  if (assetId && need.PersonelAdi) {
    updateAsset_(assetId, { AtananKisi: need.PersonelAdi, Durum: 'Kullanimda' }, user);
  }

  logAction_(user, 'Ihtiyac Karsilandi (Stoktan)', needId + ' -> ' + assetId);
  return { message: need.PersonelAdi ? ('Ihtiyac karsilandi ve ' + assetId + ' varligi ' + need.PersonelAdi + ' kisisine atandi.') : (assetId + ' varligi stok icin ayrildi.') };
}

// Bir ihtiyaci, ELDE mevcut bir stok varligi olmadan, DOGRUDAN yeni bir Envanter kaydi
// olusturarak karsilar (siparis gelip kutudan cikan cihaz icin). Ihtiyactaki Kategori/Fiyat/
// Tedarikci bilgileri yeni varliga aktarilir, Aciklama Notlar alanina yazilir.
function fulfillNeedAsNewAsset_(needId, user) {
  const need = getNeed_(needId);
  const forStock = !need.PersonelAdi;
  const created = createAsset_({
    Kategori: need.Kategori,
    Marka: need.Marka || '',
    Model: '',
    Notlar: need.Aciklama || '',
    Durum: forStock ? 'Stok' : 'Kullanimda',
    Lokasyon: '',
    AtananKisi: forStock ? '' : need.PersonelAdi,
    Tedarikci: need.Tedarikci || '',
    SatinAlmaTarihi: need.SiparisTarihi || '',
    Fiyat: need.Fiyat || '',
    ParaBirimi: need.ParaBirimi || 'TRY'
  }, user);

  updateNeed_(needId, { Durum: 'Karsilandi', BaglantiliVarlikID: created.id });
  logAction_(user, 'Ihtiyac Karsilandi (Yeni Varlik)', needId + ' -> ' + created.id);
  return { message: 'Yeni varlik (' + created.id + ') olusturuldu' + (forStock ? ' ve stoga eklendi.' : ' ve ' + need.PersonelAdi + ' kisisine atandi.'), assetId: created.id };
}

// Bir Ihtiyac Listesi kaydi bir SARF MALZEMESI siparisiyse (MalzemeAdi doluysa -
// kullanici "Yeni Ihtiyac" formunda Sarf Malzemeleri listesinden bir isim secmisse),
// yeni bir Envanter varligi OLUSTURMAZ - bunun yerine ilgili sarf malzemesinin
// stoguna 1 adet ekler (malzeme sistemde yoksa, Ihtiyac'taki fiyat/tedarikci
// bilgisiyle otomatik olusturur). Boylece fiyat/tedarikci iki yerde tekrar girilmez.
function fulfillNeedAsSarfStock_(needId, user, ad) {
  const need = getNeed_(needId);
  const sarfAd = String(ad || need.MalzemeAdi || '').trim();
  if (!sarfAd) throw new Error('Sarf Malzemesi adi gerekli.');
  need.MalzemeAdi = sarfAd;

  const existing = sheetToObjects_(SHEETS.SARF).find(function(m) { return m.Ad === need.MalzemeAdi; });
  let malzemeId;
  if (existing) {
    malzemeId = existing.ID;
  } else {
    const created = createSarfMalzeme_({
      Ad: need.MalzemeAdi,
      Kategori: '',
      UyumluModeller: '',
      Stok: 0,
      MinStok: 0,
      Birim: 'Adet',
      Lokasyon: '',
      Tedarikci: need.Tedarikci || '',
      BirimFiyat: need.Fiyat || '',
      ParaBirimi: need.ParaBirimi || 'TRY'
    });
    malzemeId = created.id;
  }

  sarfHareket_({ MalzemeID: malzemeId, IslemTuru: 'Giris', Miktar: 1, Aciklama: 'Ihtiyac Listesi\'nden karsilandi: ' + needId }, user);
  updateNeed_(needId, { Durum: 'Karsilandi', BaglantiliVarlikID: malzemeId });
  logAction_(user, 'Ihtiyac Karsilandi (Sarf Malzeme Stoguna Eklendi)', needId + ' -> ' + malzemeId);
  return { message: need.MalzemeAdi + ' stoguna 1 adet eklendi.', malzemeId: malzemeId };
}

// rows: [{ID, PersonelAdi, Departman, PlanlananTarih, Kategori, Aciklama, Fiyat, ParaBirimi,
//          Tedarikci, SiparisTarihi, Durum}, ...]
// ID doluysa ve mevcutsa GUNCELLENIR (orn. tedarikcinin doldurup geri gonderdigi fiyat bilgisi),
// ID bossa/bulunamazsa YENI KAYIT olarak eklenir. Boylece "disa aktar -> tedarikciye gonder ->
// doldurulmus halini ice aktar" akisi calisir.
function importNeeds_(rows) {
  let created = 0;
  let updated = 0;
  rows.forEach(function(row) {
    const existingId = row.ID && findRowIndexById_(SHEETS.IHTIYACLAR, 'ID', row.ID) !== -1 ? row.ID : null;
    if (existingId) {
      updateNeed_(existingId, row);
      updated++;
    } else {
      createNeed_(row);
      created++;
    }
  });
  logAction_(null, 'CSV Ice Aktarma (Ihtiyac Listesi)', created + ' yeni, ' + updated + ' guncellenen kayit.');
  return { created: created, updated: updated, message: created + ' yeni, ' + updated + ' guncellenen kayit.' };
}

// ============ IK (HR) SENKRONIZASYONU - ONIZLEME + ONAY MODELI ============
// Ayri bir Google Sheet'te (IK'nin tuttugu personel listesi) tutulan calisan
// bilgilerini okuyup bizim Calisanlar sekmemizle karsilastirir. HICBIR SEYI
// OTOMATIK YAZMAZ - sadece farklari doner, kullanici hangisini onaylarsa
// (applyHRSync_ ile) o uygulanir. Sadece "Beyaz Yaka" personeli alir.
// Kaynak sheet'in sutun duzeni: B=Soyadi, D=Adi, T=Yaka, AA=Telefon,
// AC=Ise Giris Tarihi, AD=Cikis Tarihi, AE=Durum, AH=Departman.
//
// HR_SHEET_ID Script Property olarak ayarlanmalidir (bkz. apps-script/README.md).
// SicilNo karsilastirmalarini bastaki sifirlardan bagimsiz yapmak icin normalize
// eder - "00003" ve "3" ayni kisiyi temsil ediyor olabilir (gecmiste metin
// formati korunmadan yazilmis bir kayittan dolayi). Eslestirme HER ZAMAN bu
// normalize edilmis degerle yapilir, boylece bozulmus eski kayitlar bile dogru
// kisiyle eslesir.
function normalizeSicil_(s) {
  const stripped = String(s || '').trim().replace(/^0+/, '');
  return stripped || '0';
}

// HR Master Log'daki tarih hucresi bazen metin (Date degil) olarak farkli
// bicimlerde (dd.MM.yyyy vb.) gelebiliyor - bu da ayni tarihin "degisti"
// sanilmasina yol aciyordu. Ne gelirse gelsin HEP ayni ISO formatina
// (yyyy-MM-dd) cevirip oyle karsilastiriyoruz.
function normalizeDateStr_(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[1] + '-' + isoMatch[2] + '-' + isoMatch[3];
  const dmyMatch = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (dmyMatch) {
    return dmyMatch[3] + '-' + String(dmyMatch[2]).padStart(2, '0') + '-' + String(dmyMatch[1]).padStart(2, '0');
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  return s;
}

// Iki isim (soyad/ad) arasinda EN AZ bir ortak, anlamli (3+ harfli) kelime
// var mi? Varsa "muhtemelen ayni kisi, sadece kucuk bir yazim duzeltmesi"
// sayilir. Hicbir ortak kelime yoksa "muhtemelen FARKLI bir kisi, ayni Sicil
// No yeniden kullanilmis olabilir" diye isaretlenir - otomatik karar
// VERILMEZ, sadece kullaniciya sorulacak bir uyari uretilir.
function namesOverlap_(nameA, nameB) {
  const tokensOf = function(s) { return String(s || '').toLowerCase().split(/\s+/).filter(function(t) { return t.length >= 3; }); };
  const a = {};
  tokensOf(nameA).forEach(function(t) { a[t] = true; });
  return tokensOf(nameB).some(function(t) { return a[t]; });
}

function getHRSheet_() {
  const sheetId = getProp_('HR_SHEET_ID');
  if (!sheetId) throw new Error('HR_SHEET_ID Script Property tanimli degil.');
  const hrSpreadsheet = SpreadsheetApp.openById(sheetId);
  const hrTabName = getProp_('HR_SHEET_TAB');
  const hrSheet = hrTabName ? hrSpreadsheet.getSheetByName(hrTabName) : hrSpreadsheet.getSheets()[0];
  if (!hrSheet) throw new Error('IK sheet sekmesi bulunamadi.');
  return hrSheet;
}

// SABIT SUTUN HARFLERI KULLANMIYORUZ - HR Master Log'da sutun eklenip
// cikarilabiliyor (kontrolumuz disinda), bu yuzden her sutunu BASLIK
// METNINE GORE ARAYIP buluyoruz. HR sutun sirasini degistirse bile bu
// otomatik dogru sutunu bulur, elle COL indexi guncellemeye gerek kalmaz.
function normalizeForSearch_(s) {
  return String(s || '').replace(/[\s\u00A0\u200B\uFEFF]+/g, ' ').trim();
}

function findCol_(headers, substr) {
  const target = normalizeForSearch_(substr);
  for (let i = 0; i < headers.length; i++) {
    if (normalizeForSearch_(headers[i]).indexOf(target) !== -1) return i;
  }
  const preview = headers.slice(0, 6).map(function(h) { return '"' + h + '"'; }).join(', ');
  throw new Error('HR Master Log\'da "' + substr + '" iceren bir sutun bulunamadi. Okunan ilk basliklar: ' + preview + (headers.length > 6 ? '...' : '') + ' (toplam ' + headers.length + ' sutun)');
}

// HR Master Log'un ilk birkac satirinda sirket adi/dokuman basligi gibi
// "sifir" satirlar olabiliyor (dogrulandigi gibi: baslik aslinda 4. satirda).
// Bu yuzden "0. satir = baslik" diye VARSAYMIYORUZ - "Sicil No" iceren
// SATIRI arayip GERCEK baslik satirini buluyoruz.
function findHeaderRowIndex_(values) {
  var limit = Math.min(values.length, 15);
  for (var i = 0; i < limit; i++) {
    var found = values[i].some(function(cell) { return normalizeForSearch_(cell).indexOf('Sicil No') !== -1; });
    if (found) return i;
  }
  throw new Error('HR Master Log\'un ilk 15 satirinda "Sicil No" iceren bir baslik satiri bulunamadi.');
}

function buildColMap_(headers) {
  return {
    SICIL: findCol_(headers, 'Sicil No'),
    SOYAD: findCol_(headers, 'Soyadı(Türkçe)'),
    SOYAD_RU: findCol_(headers, 'Soyadı(Rusça)'),
    AD: findCol_(headers, 'Adı(Türkçe)'),
    AD_RU: findCol_(headers, 'Adı(Rusça)'),
    BABA_ADI: findCol_(headers, 'Baba ad'),
    YAKA: findCol_(headers, 'Yaka'),
    UNVAN_TR: findCol_(headers, 'Unvan(Türkçe)'),
    UNVAN_RU: findCol_(headers, 'Unvan(Rusça)'),
    CINSIYET: findCol_(headers, 'Cinsiyet'),
    UYRUK: findCol_(headers, 'Uyruk'),
    TELEFON: findCol_(headers, 'Cep Telefonu'),
    GIRIS: findCol_(headers, 'İşe Giriş Tarihi'),
    CIKIS: findCol_(headers, 'İşten Çıkış Tarihi'),
    DURUM: findCol_(headers, '/Durum'),
    DEPARTMAN: findCol_(headers, '2. Seviye Birim')
  };
}

// HR Master Log satirlarini islenmis "incoming" objelerine ve bu senkronda
// gorulen Sicil No'larin kumesine cevirir - hem preview hem applyHRSync_'in
// HRKayipSayaci guncellemesi icin ortak kullanilir.
function parseHRRows_(values) {
  const headerRowIdx = findHeaderRowIndex_(values);
  const COL = buildColMap_(values[headerRowIdx]);
  const incomingList = [];
  const seenSicilSet = {};
  let skippedMaviYaka = 0, skippedBossAd = 0;

  for (let i = headerRowIdx + 1; i < values.length; i++) {
    const row = values[i];
    const yaka = String(row[COL.YAKA] || '').trim();
    if (yaka.toLowerCase().indexOf('beyaz yaka') === -1) { skippedMaviYaka++; continue; }

    const ad = String(row[COL.AD] || '').trim();
    const soyad = String(row[COL.SOYAD] || '').trim();
    if (!ad && !soyad) { skippedBossAd++; continue; }
    const adSoyad = (ad + ' ' + soyad).trim();
    const sicilNo = String(row[COL.SICIL] || '').trim();
    if (sicilNo) seenSicilSet[normalizeSicil_(sicilNo)] = true;

    const telefon = row[COL.TELEFON] ? String(row[COL.TELEFON]) : '';
    const departman = row[COL.DEPARTMAN] ? String(row[COL.DEPARTMAN]) : '';
    const unvanTR = String(row[COL.UNVAN_TR] || '').trim();
    const unvanRU = String(row[COL.UNVAN_RU] || '').trim();
    const unvan = [unvanTR, unvanRU].filter(Boolean).join('/');
    const babaAdiRawKiril = String(row[COL.BABA_ADI] || '').trim();
    const babaAdi = transliterateCyrillicToLatin_(babaAdiRawKiril);
    const soyadRu = String(row[COL.SOYAD_RU] || '').trim();
    const adRu = String(row[COL.AD_RU] || '').trim();
    const emailBasvuruAdi = [soyadRu, adRu, babaAdiRawKiril].filter(Boolean).join(' ');
    const girisTarihiRaw = row[COL.GIRIS];
    const iseBaslamaTarihi = girisTarihiRaw
      ? (girisTarihiRaw instanceof Date ? Utilities.formatDate(girisTarihiRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd') : normalizeDateStr_(girisTarihiRaw))
      : '';
    const cikisTarihi = row[COL.CIKIS];
    const durum = String(row[COL.DURUM] || '');

    let aktifMi;
    if (cikisTarihi || /Уволен|Isten Ayrildi|İşten Ayrıldı/i.test(durum)) aktifMi = 'Pasif';
    else if (/Активный|Aktif/i.test(durum)) aktifMi = 'Aktif';
    else aktifMi = 'Beklemede';

    incomingList.push({ SicilNo: sicilNo, AdSoyad: adSoyad, Telefon: telefon, Departman: departman, AktifMi: aktifMi, Unvan: unvan, BabaAdi: babaAdi, IseBaslamaTarihi: iseBaslamaTarihi, EmailBasvuruAdi: emailBasvuruAdi, Cinsiyet: String(row[COL.CINSIYET] || '').trim(), Uyruk: String(row[COL.UYRUK] || '').trim() });
  }

  return { incomingList: incomingList, seenSicilSet: seenSicilSet, skippedMaviYaka: skippedMaviYaka, skippedBossAd: skippedBossAd };
}

function previewHRSync_() {
  const values = getHRSheet_().getDataRange().getValues();
  const parsed = parseHRRows_(values);

  const currentEmployees = sheetToObjects_(SHEETS.CALISANLAR);
  // Eslestirme ARTIK ISME DEGIL, IK'nin benzersiz Tabelli No/Sicil No'suna gore
  // yapiliyor - isim degisse (evlilik, yazim duzeltmesi vb.) bile ayni kisi olarak
  // taninir. Henuz SicilNo'su islenmemis eski kayitlar icin isim eslestirmesi
  // yedek (fallback) olarak kullanilir.
  const bySicil = {};
  const byName = {};
  currentEmployees.forEach(function(e) {
    if (e.SicilNo) bySicil[normalizeSicil_(e.SicilNo)] = e;
    byName[e.AdSoyad] = e;
  });

  const changes = [];
  parsed.incomingList.forEach(function(incoming) {
    const sicilNo = incoming.SicilNo;
    const adSoyad = incoming.AdSoyad;
    const current = (sicilNo && bySicil[normalizeSicil_(sicilNo)]) || byName[adSoyad];

    if (!current) {
      let possibleDuplicateOf = null;
      if (incoming.Telefon) {
        const phoneMatch = currentEmployees.find(function(e) { return e.Telefon && String(e.Telefon) === String(incoming.Telefon); });
        if (phoneMatch) possibleDuplicateOf = phoneMatch.AdSoyad;
      }
      changes.push({ key: sicilNo || adSoyad, changeType: 'new', incoming: incoming, current: null, changedFields: [], possibleDuplicateOf: possibleDuplicateOf });
    } else {
      const changedFields = [];
      ['AdSoyad', 'Telefon', 'Departman', 'AktifMi', 'Unvan', 'BabaAdi', 'EmailBasvuruAdi', 'Cinsiyet', 'Uyruk'].forEach(function(f) {
        if (String(current[f] || '') !== String(incoming[f] || '')) changedFields.push(f);
      });
      if (normalizeDateStr_(current.IseBaslamaTarihi) !== normalizeDateStr_(incoming.IseBaslamaTarihi)) changedFields.push('IseBaslamaTarihi');
      if (sicilNo && normalizeSicil_(current.SicilNo || '') !== normalizeSicil_(sicilNo)) changedFields.push('SicilNo');
      if (changedFields.length > 0) {
        // Isim degisiyor VE Sicil No zaten eslesmisse - eski/yeni isim
        // arasinda hic ortak kelime yoksa bu bir "yazim duzeltmesi" degil,
        // "Sicil No yeniden kullanilmis olabilir" durumu olabilir. Otomatik
        // karar VERMEYIZ, sadece isaretleyip kullaniciya soruyoruz.
        const possibleDifferentPerson = changedFields.indexOf('AdSoyad') !== -1 && sicilNo && normalizeSicil_(current.SicilNo || '') === normalizeSicil_(sicilNo) && !namesOverlap_(current.AdSoyad, adSoyad);
        changes.push({ key: sicilNo || adSoyad, changeType: 'updated', incoming: incoming, current: current, changedFields: changedFields, possibleDifferentPerson: possibleDifferentPerson });
      }
    }
  });

  // HR'da artik bulunamayan, hala Aktif/Beklemede sayilan kisiler. Sadece TEK
  // seferlik kayip HENUZ uyari verdirmez - ayni kisi ART ARDA 2. kez de
  // kayipsa (mevcut HRKayipSayaci >= 1) kullaniciya "kontrol et" diye
  // gosteririz. Hicbir durumda OTOMATIK Pasif YAPILMAZ.
  const missingEmployees = currentEmployees
    .filter(function(e) { return e.SicilNo && String(e.SicilNo).indexOf('(eski)') === -1 && (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede'); })
    .filter(function(e) { return !parsed.seenSicilSet[normalizeSicil_(e.SicilNo)]; })
    .map(function(e) { return { AdSoyad: e.AdSoyad, SicilNo: e.SicilNo, Departman: e.Departman, Unvan: e.Unvan, hrKayipSayaci: parseInt(e.HRKayipSayaci, 10) || 0 }; })
    .filter(function(e) { return e.hrKayipSayaci >= 1; });

  return { changes: changes, skippedMaviYaka: parsed.skippedMaviYaka, skippedBossAd: parsed.skippedBossAd, missingEmployees: missingEmployees };
}

// Sadece kullanicinin onayladigi (secip gonderdigi) kayitlari uygular.
// items: previewHRSync_'in dondurdugu "incoming" objelerinin (SicilNo dahil)
// aynen geri gonderilmis hali - "farkli kisi" onaylanan ogeler ayrica
// _action: 'differentPerson' ve _eskiAdSoyad tasir.
function applyHRSync_(items, user) {
  const currentEmployees = sheetToObjects_(SHEETS.CALISANLAR);
  const bySicil = {};
  const byName = {};
  currentEmployees.forEach(function(e) {
    if (e.SicilNo) bySicil[normalizeSicil_(e.SicilNo)] = e;
    byName[e.AdSoyad] = e;
  });
  let created = 0, updated = 0, reassigned = 0;

  items.forEach(function(item) {
    if (item._action === 'differentPerson') {
      // Kullanici, Sicil No'nun YENIDEN KULLANILDIGINI (farkli bir kisi
      // oldugunu) onayladi. Eski kisi PASIF olur, verisi/gecmisi (uzerine
      // atanmis envanter, actigi ihtiyac talepleri) OLDUGU GIBI KALIR -
      // hicbir sey silinmez/tasinmaz, sadece Sicil No'su isaretlenir ki bir
      // dahaki senkronda bu kayitla tekrar eslesmesin. Yeni kisi SIFIRDAN,
      // ayri bir kayit olarak eklenir.
      const oldEmployee = item._eskiAdSoyad ? byName[item._eskiAdSoyad] : null;
      if (oldEmployee) {
        updateEmployee_(oldEmployee.AdSoyad, { AktifMi: 'Pasif', SicilNo: oldEmployee.SicilNo + ' (eski)' });
        reassigned++;
      }
      createEmployee_({ AdSoyad: item.AdSoyad, Telefon: item.Telefon, Email: '', Departman: item.Departman, AktifMi: item.AktifMi, SicilNo: item.SicilNo, Unvan: item.Unvan, BabaAdi: item.BabaAdi, IseBaslamaTarihi: item.IseBaslamaTarihi, EmailBasvuruAdi: item.EmailBasvuruAdi, Cinsiyet: item.Cinsiyet, Uyruk: item.Uyruk });
      created++;
      return;
    }

    const existing = (item.SicilNo && bySicil[normalizeSicil_(item.SicilNo)]) || byName[item.AdSoyad];
    if (existing) {
      // updateEmployee_ zaten AdSoyad degisikligini destekliyor (Envanter/Ihtiyaclar
      // referanslarini otomatik gunceller) - isim degismis olsa bile dogru calisir.
      updateEmployee_(existing.AdSoyad, {
        AdSoyad: item.AdSoyad, Telefon: item.Telefon, Departman: item.Departman,
        AktifMi: item.AktifMi, SicilNo: item.SicilNo, Unvan: item.Unvan, BabaAdi: item.BabaAdi, IseBaslamaTarihi: item.IseBaslamaTarihi, EmailBasvuruAdi: item.EmailBasvuruAdi,
        Cinsiyet: item.Cinsiyet, Uyruk: item.Uyruk
      });
      updated++;
    } else {
      createEmployee_({ AdSoyad: item.AdSoyad, Telefon: item.Telefon, Email: '', Departman: item.Departman, AktifMi: item.AktifMi, SicilNo: item.SicilNo, Unvan: item.Unvan, BabaAdi: item.BabaAdi, IseBaslamaTarihi: item.IseBaslamaTarihi, EmailBasvuruAdi: item.EmailBasvuruAdi, Cinsiyet: item.Cinsiyet, Uyruk: item.Uyruk });
      created++;
    }
  });

  // HRKayipSayaci guncellemesi: HER senkron ONAYLANDIGINDA, tum Aktif/Beklemede
  // calisanlar icin HR'da bu sefer gorulup gorulmedigine gore sayac
  // guncellenir - goruldiyse 0'a resetlenir, gorulmediyse +1 artar. Bu
  // sayede "art arda 2 senkron kayip" kurali calisir.
  try {
    const values2 = getHRSheet_().getDataRange().getValues();
    const parsed2 = parseHRRows_(values2);
    const freshEmployees = sheetToObjects_(SHEETS.CALISANLAR);
    freshEmployees.forEach(function(e) {
      if (!e.SicilNo || String(e.SicilNo).indexOf('(eski)') !== -1) return;
      if (e.AktifMi !== 'Aktif' && e.AktifMi !== 'Beklemede') return;
      const seen = !!parsed2.seenSicilSet[normalizeSicil_(e.SicilNo)];
      const currentCount = parseInt(e.HRKayipSayaci, 10) || 0;
      const nextCount = seen ? 0 : currentCount + 1;
      if (nextCount !== currentCount) updateEmployee_(e.AdSoyad, { HRKayipSayaci: nextCount });
    });
  } catch (e) {
    Logger.log('HRKayipSayaci guncelleme hatasi: ' + e.message);
  }

  const summary = created + ' yeni, ' + updated + ' guncellenen calisan (HR onayli).' + (reassigned > 0 ? ' ' + reassigned + ' kisi Pasif yapildi (Sicil No yeniden kullanildi).' : '');
  logAction_(user, 'IK Senkronizasyonu Onaylandi', summary);
  return { created: created, updated: updated, reassigned: reassigned, message: summary };
}


function getDashboard_() {
  const items = enrichWithUsd_(sheetToObjects_(SHEETS.ENVANTER));
  const byDurum = {};
  const byKategori = {};
  const byLokasyon = {};
  const valueByCurrency = {};
  let totalUSD = 0, totalTRY = 0, totalRUB = 0;
  let warrantyExpiringSoon = 0;
  const today = new Date();
  const in30 = new Date();
  in30.setDate(today.getDate() + 30);

  items.forEach(function(a) {
    byDurum[a.Durum] = (byDurum[a.Durum] || 0) + 1;
    byKategori[a.Kategori] = (byKategori[a.Kategori] || 0) + 1;
    byLokasyon[a.Lokasyon] = (byLokasyon[a.Lokasyon] || 0) + 1;
    if (a.Fiyat) {
      const cur = a.ParaBirimi || 'TRY';
      valueByCurrency[cur] = (valueByCurrency[cur] || 0) + Number(a.Fiyat);
      if (a.FiyatUSD) totalUSD += Number(a.FiyatUSD);
      if (a.FiyatTRY) totalTRY += Number(a.FiyatTRY);
      if (a.FiyatRUB) totalRUB += Number(a.FiyatRUB);
    }
    if (a.GarantiBitisTarihi) {
      const d = new Date(a.GarantiBitisTarihi);
      if (d >= today && d <= in30) warrantyExpiringSoon++;
    }
  });

  return {
    total: items.length,
    byDurum: byDurum,
    byKategori: byKategori,
    byLokasyon: byLokasyon,
    valueByCurrency: valueByCurrency,
    totalUSD: Math.round(totalUSD * 100) / 100,
    totalTRY: Math.round(totalTRY * 100) / 100,
    totalRUB: Math.round(totalRUB * 100) / 100,
    warrantyExpiringSoon: warrantyExpiringSoon,
    pendingNeeds: sheetToObjects_(SHEETS.IHTIYACLAR).filter(function(n) { return n.Durum === 'Bekleniyor' || n.Durum === 'Onaylandi'; }).length,
    lowStockCount: sheetToObjects_(SHEETS.SARF).filter(function(m) { return Number(m.Stok || 0) <= Number(m.MinStok || 0); }).length
  };
}

// ============ TCMB DOVIZ KURU DONUSUMU (raporlarda tek ve tutarli USD degeri icin) ============
// tcmb.gov.tr'nin gunluk XML arsivinden (satin alma tarihine gore) resmi kuru ceker.
// Hafta sonu/tatil gunlerinde kur yayinlanmadigi icin en yakin onceki is gununu dener.
// Sonuclar 6 saat CacheService'te tutulur, tekrar tekrar internet cekmez.
//
// ONEMLI KURULUM ADIMI: Bu fonksiyonlar internete cikmak icin yeni bir izin turu
// gerektirir (once sadece Sheets/Drive izni vardi, simdi "disaridaki bir servise
// baglan" izni de gerekiyor). Kodu yapistirip deploy ettikten sonra, fonksiyon
// secim kutusundan "testTcmbConnection_" secip BIR KERE Calistir/Run'a basin -
// izin penceresi cikacak, onaylayin. Onaylamazsaniz TL/RUB gibi USD-disi
// fiyatlar sessizce donusturulemez (USD alanlari bos kalir).
function testTcmbConnection_() {
  const rates = getTcmbRates_(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  if (!rates || !rates.USD) {
    throw new Error('TCMB baglantisi basarisiz. Internet erisimi izni verilmemis olabilir - bu fonksiyonu tekrar calistirip izin penceresini onaylayin.');
  }
  return 'Basarili! Bugunku kur: 1 USD = ' + rates.USD + ' TRY' + (rates.RUB ? ', 1 RUB = ' + rates.RUB + ' TRY' : '');
}

function getTcmbRates_(dateStr) {
  if (!dateStr) return null;
  const cache = CacheService.getScriptCache();
  const cacheKey = 'tcmb_' + dateStr;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const baseDate = new Date(dateStr);
  if (isNaN(baseDate.getTime())) return null;

  for (let i = 0; i < 8; i++) {
    const tryDate = new Date(baseDate);
    tryDate.setDate(baseDate.getDate() - i);
    const dd = Utilities.formatDate(tryDate, Session.getScriptTimeZone(), 'ddMMyyyy');
    const yyyymm = Utilities.formatDate(tryDate, Session.getScriptTimeZone(), 'yyyyMM');
    const url = 'https://www.tcmb.gov.tr/kurlar/' + yyyymm + '/' + dd + '.xml';
    try {
      const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) continue;
      const xml = XmlService.parse(resp.getContentText());
      const root = xml.getRootElement();
      const currencyEls = root.getChildren('Currency');
      const rates = {};
      currencyEls.forEach(function(el) {
        const codeAttr = el.getAttribute('CurrencyCode');
        const code = codeAttr ? codeAttr.getValue() : null;
        const sellingEl = el.getChild('ForexSelling');
        const sellingText = sellingEl ? sellingEl.getText() : '';
        const selling = parseFloat(sellingText.replace(',', '.'));
        if (code && selling) rates[code] = selling;
      });
      if (rates.USD) {
        cache.put(cacheKey, JSON.stringify(rates), 21600);
        return rates;
      }
    } catch (e) {
      continue; // bu tarih icin XML yok/hata var, bir onceki gunu dene
    }
  }
  return null;
}

// Her kullanilan TCMB kurunu, tarih bazinda ayri bir "KurGecmisi" sekmesine
// kaydeder - boylece "hangi tarihte, hangi kuru, nereden aldik" sorusuna her
// zaman cevap verilebilir (muhasebe/denetim izi). Ayni tarih icin zaten kayit
// varsa tekrar eklemez. BILINCLI OLARAK sadece disa aktarma gibi ozel
// islemlerde CAGRILIR (getTcmbRates_ icinden DEGIL) - yoksa envanter listesi
// gibi sik kullanilan ekranlarda her fiyat cevriminde Sheets'e yazip
// uygulamayi yavaslatir.
function logKurGecmisi_(dateStr, rates) {
  const headers = ['Tarih', 'USD', 'EUR', 'RUB', 'Kaynak', 'KayitZamani'];
  const sheet = ensureSheet_(ss_(), 'KurGecmisi', headers);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const existingDates = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(r) { return String(r[0]); });
    if (existingDates.indexOf(dateStr) !== -1) return;
  }
  sheet.appendRow([dateStr, rates.USD || '', rates.EUR || '', rates.RUB || '', 'TCMB (T.C. Merkez Bankasi)', nowStr_()]);
}

// Aylik Satin Alma Plani disa aktarilirken cagrilir: o gunun TCMB kurunu
// getirir VE KurGecmisi sekmesine kaydeder (bilinclu, tek seferlik bir islem -
// export basina bir kere calisir, sistemi yavaslatmaz).
function getAndLogExchangeRate_(dateStr) {
  const rates = getTcmbRates_(dateStr);
  if (rates) logKurGecmisi_(dateStr, rates);
  return rates || {};
}

// amount'u (currency cinsinden) dateStr gunundeki resmi TCMB kuruyla istenen hedef
// para birimine cevirir. Donusum yapilamazsa null doner.
function convertCurrency_(amount, currency, dateStr, targetCur) {
  if (!amount) return null;
  amount = Number(amount);
  if (isNaN(amount)) return null;
  const cur = currency || 'TRY';
  if (cur === targetCur) return amount;

  const rates = getTcmbRates_(dateStr) || getTcmbRates_(nowStr_().slice(0, 10));
  if (!rates || !rates.USD) return null;

  let inTRY;
  if (cur === 'TRY') inTRY = amount;
  else if (rates[cur]) inTRY = amount * rates[cur];
  else return null;

  if (targetCur === 'TRY') return inTRY;
  if (targetCur === 'USD') return inTRY / rates.USD;
  if (rates[targetCur]) return inTRY / rates[targetCur];
  return null;
}

function convertToUsd_(amount, currency, dateStr) {
  return convertCurrency_(amount, currency, dateStr, 'USD');
}

// Envanter listesine, her varligin fiyatinin SATIN ALMA TARIHINDEKI resmi kurla
// USD/TRY/RUB karsiligini ekler (raporlama icin) - "bugunku kur" DEGIL, o gunku kur,
// cunku amac ne kadar harcandigini gostermek, gunluk piyasa dalgalanmasi degil.
function enrichWithUsd_(items) {
  return items.map(function(a) {
    if (a.Fiyat) {
      const dateStr = a.SatinAlmaTarihi || a.OlusturmaTarihi;
      const usd = convertCurrency_(a.Fiyat, a.ParaBirimi, dateStr, 'USD');
      const tryVal = convertCurrency_(a.Fiyat, a.ParaBirimi, dateStr, 'TRY');
      const rub = convertCurrency_(a.Fiyat, a.ParaBirimi, dateStr, 'RUB');
      a.FiyatUSD = usd !== null ? Math.round(usd * 100) / 100 : '';
      a.FiyatTRY = tryVal !== null ? Math.round(tryVal * 100) / 100 : '';
      a.FiyatRUB = rub !== null ? Math.round(rub * 100) / 100 : '';
    } else {
      a.FiyatUSD = '';
      a.FiyatTRY = '';
      a.FiyatRUB = '';
    }
    return a;
  });
}

// Fiziksel Sayim (QR kamera denetimi) tamamlandiginda ozet bilgiyi Sistem Gunlugu'ne
// kaydeder - boylece ne zaman denetim yapildigi, kac cihazin bulunup kac cihazin
// bulunamadigi gecmiste kalir, kaybolmaz.
function logAuditSummary_(data, user) {
  const detail = 'Toplam: ' + data.toplam + ', Bulunan: ' + data.bulunan + ', Bulunamayan: ' + data.bulunamayan;
  logAction_(user, 'Fiziksel Sayim Tamamlandi', detail);
  return { message: 'Sayim ozeti kaydedildi.' };
}

// Teslim Formu icin kisa, benzersiz, otomatik artan bir numara uretir (TF-0001 gibi).
// Birden fazla kisi ayni anda form olusturursa cakismayi onlemek icin LockService
// kullanilir (Script Properties'teki sayaci guvenli sekilde artirir).
function nextTeslimFormNo_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const props = PropertiesService.getScriptProperties();
    const current = parseInt(props.getProperty('TESLIM_FORM_COUNTER') || '0', 10);
    const next = current + 1;
    props.setProperty('TESLIM_FORM_COUNTER', String(next));
    return { formNo: 'TF-' + ('0000' + next).slice(-4) };
  } finally {
    lock.releaseLock();
  }
}

// Talep Formu sifreleri: her calisan icin 6 haneli, sadece harf (buyuk/kucuk
// karisik), rastgele bir sifre - IK'daki e-postadan bagimsiz, ayri bir
// kimlik dogrulama alani. Eksik olanlara uretilir, mevcut sifrelere DOKUNULMAZ.
function generateTalepSifresi_() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

// ---- Personel Talepleri (Ekipman Talep Formu - genel/public erisimli) ----
function nextTalepId_() {
  const sheet = ensureSheet_(ss_(), SHEETS.PERSONEL_TALEPLERI, PERSONEL_TALEP_HEADERS);
  const values = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < values.length; i++) {
    const m = String(values[i][0] || '').match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 'TLP-' + ('0000' + (maxNum + 1)).slice(-4);
}

// Talep Sifresi ile calisan dogrulama - Ekipman Talep Formu'nun giris adimi.
function verifyTalepSifresi_(sifre) {
  if (!sifre) return null;
  const employees = sheetToObjects_(SHEETS.CALISANLAR);
  const employee = employees.find(function(e) { return e.TalepSifresi && String(e.TalepSifresi) === String(sifre).trim(); });
  if (!employee) return null;
  const items = sheetToObjects_(SHEETS.ENVANTER);
  const myItems = items.filter(function(a) { return a.AtananKisi === employee.AdSoyad; });
  const existingCategories = [...new Set(myItems.map(function(a) { return a.Kategori; }))];
  return { AdSoyad: employee.AdSoyad, Departman: employee.Departman, existingCategories: existingCategories, myItems: myItems.map(function(a) { return { Kategori: a.Kategori, Marka: a.Marka, Model: a.Model }; }) };
}

// ---- TalepFormu.html sayfasindan google.script.run ile DOGRUDAN cagirilan
// (JSON API'den bagimsiz) temiz sarmalayicilar. Isim sonunda "_" YOK -
// bilerek boyle, cunku bu ikisi istemciden cagrilmasi GEREKEN, ozel olarak
// disari acilmis fonksiyonlar. ----
function talepFormLogin(sifre) {
  const result = verifyTalepSifresi_(sifre);
  if (!result) throw new Error('Sifre hatali.');
  return result;
}

function talepFormGonder(sifre, items) {
  const employee = verifyTalepSifresi_(sifre);
  if (!employee) throw new Error('Sifre hatali.');
  return createPersonelTalepleri_(employee.AdSoyad, employee.Departman, items);
}

// data.items: [{ Kategori, Adet, UrunLinki, Notlar, mevcutUyari }] - her
// kalem AYRI bir PersonelTalepleri satiri olur.
function createPersonelTalepleri_(personelAdi, departman, items) {
  const sheet = ensureSheet_(ss_(), SHEETS.PERSONEL_TALEPLERI, PERSONEL_TALEP_HEADERS);
  const headerRow = getEffectiveHeaders_(sheet, PERSONEL_TALEP_HEADERS);
  const created = [];
  items.forEach(function(item) {
    const id = nextTalepId_();
    const row = headerRow.map(function(h) {
      if (h === 'ID') return id;
      if (h === 'PersonelAdi') return personelAdi;
      if (h === 'Departman') return departman || '';
      if (h === 'Durum') return 'Bekliyor';
      if (h === 'OlusturmaTarihi') return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      if (h === 'MevcutEkipmanUyarisi') return item.mevcutUyari ? 'TRUE' : '';
      return item[h] !== undefined ? item[h] : '';
    });
    sheet.appendRow(row);
    created.push(id);
  });
  return { created: created, count: created.length };
}

function getPersonelTalepleri_() {
  ensureSheet_(ss_(), SHEETS.PERSONEL_TALEPLERI, PERSONEL_TALEP_HEADERS);
  const all = sheetToObjects_(SHEETS.PERSONEL_TALEPLERI);
  return all.filter(function(t) { return t.Durum === 'Bekliyor'; });
}

function updatePersonelTalepDurum_(id, durum) {
  const sheet = ss_().getSheetByName(SHEETS.PERSONEL_TALEPLERI);
  const rowIdx = findRowIndexById_(SHEETS.PERSONEL_TALEPLERI, 'ID', id);
  if (rowIdx === -1) throw new Error('Talep bulunamadi: ' + id);
  const durumCol = PERSONEL_TALEP_HEADERS.indexOf('Durum') + 1;
  sheet.getRange(rowIdx, durumCol).setValue(durum);
  return { id: id, durum: durum };
}

function generateMissingTalepSifreleri_() {
  const employees = sheetToObjects_(SHEETS.CALISANLAR);
  const generatedNames = [];
  employees.forEach(function(e) {
    if (e.TalepSifresi) return;
    const sifre = generateTalepSifresi_();
    updateEmployee_(e.AdSoyad, { TalepSifresi: sifre });
    generatedNames.push(e.AdSoyad);
  });
  const allEmployees = generatedNames.length > 0 ? sheetToObjects_(SHEETS.CALISANLAR) : employees;
  const all = allEmployees
    .filter(function(e) { return e.TalepSifresi; })
    .map(function(e) { return { AdSoyad: e.AdSoyad, Email: e.Email || '', TalepSifresi: e.TalepSifresi, isNew: generatedNames.indexOf(e.AdSoyad) !== -1 }; });
  return { all: all, newCount: generatedNames.length };
}

// ============ YEDEKLEME (BACKUP) ============
// Butun Google Sheet'i (Envanter, Calisanlar, Hareketler, Listeler, Ihtiyaclar,
// Gunluk sekmelerinin hepsi) tek bir .xlsx dosyasi olarak disari aktarip
// belirlenen Drive klasorune kaydeder. Dosya adi: "GG-AA-YYYY_SS-DD_BT Varlik Yonetimi.xlsx"
function createBackup_(user) {
  const ss = ss_();
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Yedekleme basarisiz (HTTP ' + response.getResponseCode() + ').');
  }
  const blob = response.getBlob();
  const now = new Date();
  const stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd-MM-yyyy_HH-mm');
  const filename = stamp + '_BT Varlik Yonetimi.xlsx';
  blob.setName(filename);

  const folderId = getProp_('BACKUP_FOLDER_ID') || '1GsL-bBU_fuKU7eoJrVxhBYCcrKQoQTw5';
  const folder = DriveApp.getFolderById(folderId);
  folder.createFile(blob);

  logAction_(user || 'Otomatik Yedekleme', 'Yedek Alindi', filename);
  return { message: 'Yedek olusturuldu: ' + filename, filename: filename };
}

// Bu fonksiyonu Apps Script editorunde BIR KERE calistirin (fonksiyon secim
// kutusundan "setupBackupTriggers_" secip Run/Calistir'a basin) - boylece her
// gun otomatik olarak 07:00, 12:00 ve 19:00 civarinda yedek alinir. Tekrar
// calistirirsaniz eski tetikleyiciler silinip yenileri kurulur, coklama olmaz.
function setupBackupTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'createBackup_') ScriptApp.deleteTrigger(t);
  });
  [7, 12, 19].forEach(function(hour) {
    ScriptApp.newTrigger('createBackup_').timeBased().everyDays(1).atHour(hour).create();
  });
  return 'Otomatik yedekleme kuruldu: her gun 07:00, 12:00 ve 19:00 civarinda calisacak.';
}

// ============ SARF MALZEMELERI (toner, kartus, yedek parca - adet bazli stok) ============
function nextSarfId_() {
  const sheet = ss_().getSheetByName(SHEETS.SARF);
  const lastRow = sheet ? sheet.getLastRow() : 0;
  let maxNum = 0;
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function(r) {
      const m = String(r[0]).match(/(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  return 'SRF-' + ('0000' + (maxNum + 1)).slice(-4);
}

function nextSarfHareketId_() {
  const sheet = ss_().getSheetByName(SHEETS.SARF_HAREKETLERI);
  const lastRow = sheet ? sheet.getLastRow() : 0;
  let maxNum = 0;
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function(r) {
      const m = String(r[0]).match(/(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  return 'SRH-' + ('0000' + (maxNum + 1)).slice(-4);
}

// Sarf malzemesi listesini, her birine "DusukStok" (min seviyenin altinda mi) bilgisi ekleyerek doner.
function getSarfMalzemeleri_() {
  return sheetToObjects_(SHEETS.SARF).map(function(m) {
    m.DusukStok = Number(m.Stok || 0) <= Number(m.MinStok || 0);
    return m;
  });
}

function createSarfMalzeme_(data) {
  const sheet = ensureSheet_(ss_(), SHEETS.SARF, SARF_HEADERS);
  const id = nextSarfId_();
  const now = nowStr_();
  const headerRow = getEffectiveHeaders_(sheet, SARF_HEADERS);
  const row = headerRow.map(function(h) {
    if (h === 'ID') return id;
    if (h === 'OlusturmaTarihi' || h === 'SonGuncelleme') return now;
    if (h === 'Stok') return data.Stok !== undefined ? data.Stok : 0;
    if (h === 'MinStok') return data.MinStok !== undefined ? data.MinStok : 0;
    return data[h] || '';
  });
  sheet.appendRow(row);
  if (data.Kategori) addListItem_('SarfKategori', data.Kategori);
  if (data.Tedarikci) addListItem_('Tedarikci', data.Tedarikci);
  logAction_(null, 'Sarf Malzeme Eklendi', id + ' - ' + (data.Ad || ''));
  return { id: id, message: 'Malzeme eklendi.' };
}

function updateSarfMalzeme_(id, data) {
  const sheet = ensureSheet_(ss_(), SHEETS.SARF, SARF_HEADERS);
  const rowIdx = findRowIndexById_(SHEETS.SARF, 'ID', id);
  if (rowIdx === -1) throw new Error('Malzeme bulunamadi: ' + id);
  const headerRow = getEffectiveHeaders_(sheet, SARF_HEADERS);
  const currentRow = sheet.getRange(rowIdx, 1, 1, headerRow.length).getValues()[0];
  const current = {};
  headerRow.forEach(function(h, i) { current[h] = currentRow[i]; });
  const newRow = headerRow.map(function(h) {
    if (h === 'ID' || h === 'OlusturmaTarihi') return current[h];
    if (h === 'SonGuncelleme') return nowStr_();
    return data[h] !== undefined ? data[h] : current[h];
  });
  sheet.getRange(rowIdx, 1, 1, newRow.length).setValues([newRow]);
  if (data.Kategori) addListItem_('SarfKategori', data.Kategori);
  if (data.Tedarikci) addListItem_('Tedarikci', data.Tedarikci);
  return { id: id, message: 'Malzeme guncellendi.' };
}

// Giris (stok ekleme) veya Cikis (stok kullanma) hareketi kaydeder, stok miktarini
// otomatik gunceller. IlgiliVarlikID verilirse (orn. bir yaziciya takilan toner),
// o varligin sarf malzeme maliyeti hesaplarken kullanilir (bkz. getAssetSarfCost_).
function sarfHareket_(data, user) {
  const sheet = ensureSheet_(ss_(), SHEETS.SARF, SARF_HEADERS);
  const rowIdx = findRowIndexById_(SHEETS.SARF, 'ID', data.MalzemeID);
  if (rowIdx === -1) throw new Error('Malzeme bulunamadi: ' + data.MalzemeID);

  const sarfHeaderRow = getEffectiveHeaders_(sheet, SARF_HEADERS);
  const stokCol = sarfHeaderRow.indexOf('Stok') + 1;
  const currentStok = Number(sheet.getRange(rowIdx, stokCol).getValue()) || 0;
  const miktar = Number(data.Miktar) || 0;
  const yeniStok = data.IslemTuru === 'Giris' ? currentStok + miktar : Math.max(0, currentStok - miktar);
  sheet.getRange(rowIdx, stokCol).setValue(yeniStok);
  sheet.getRange(rowIdx, sarfHeaderRow.indexOf('SonGuncelleme') + 1).setValue(nowStr_());

  const hareketSheet = ensureSheet_(ss_(), SHEETS.SARF_HAREKETLERI, SARF_HAREKET_HEADERS);
  const hareketHeaderRow = getEffectiveHeaders_(hareketSheet, SARF_HAREKET_HEADERS);
  const hareketRow = hareketHeaderRow.map(function(h) {
    if (h === 'HareketID') return nextSarfHareketId_();
    if (h === 'Tarih') return nowStr_();
    if (h === 'IslemYapan') return user || '';
    return data[h] !== undefined ? data[h] : '';
  });
  hareketSheet.appendRow(hareketRow);

  logAction_(user, 'Sarf Malzeme Hareketi', data.MalzemeID + ' - ' + data.IslemTuru + ' ' + miktar);
  return { message: 'Hareket kaydedildi.', yeniStok: yeniStok };
}

// SURPRIZ OZELLIK: Bir varligin (orn. bir yazicinin) uzerine simdiye kadar ne kadar
// sarf malzeme maliyeti bindigini hesaplar - "bu yazici bize toplam ne kadara mal oldu"
// sorusuna cevap verir. SarfHareketleri'ndeki "Cikis" (kullanilan) hareketlerini,
// o an gecerli olan BirimFiyat ile carpip para birimine gore toplar.
function getAssetSarfCost_(assetId) {
  const hareketler = sheetToObjects_(SHEETS.SARF_HAREKETLERI).filter(function(h) {
    return h.IlgiliVarlikID === assetId && h.IslemTuru === 'Cikis';
  });
  const malzemeMap = {};
  sheetToObjects_(SHEETS.SARF).forEach(function(m) { malzemeMap[m.ID] = m; });

  const items = [];
  const totalByCurrency = {};
  hareketler.forEach(function(h) {
    const m = malzemeMap[h.MalzemeID];
    if (!m) return;
    const miktar = Number(h.Miktar) || 0;
    const birimFiyat = Number(m.BirimFiyat) || 0;
    const tutar = miktar * birimFiyat;
    const cur = m.ParaBirimi || 'TRY';
    totalByCurrency[cur] = (totalByCurrency[cur] || 0) + tutar;
    items.push({ Tarih: h.Tarih, Ad: m.Ad, Miktar: miktar, Tutar: tutar, ParaBirimi: cur });
  });

  return { items: items, totalByCurrency: totalByCurrency };
}

// ---- Sarf Satin Alma Siparisleri (helpers.js'deki Node karsiligi ile ayni) ----
function nextSarfSiparisId_() {
  const sheet = ss_().getSheetByName(SHEETS.SARF_SIPARISLERI);
  const lastRow = sheet ? sheet.getLastRow() : 0;
  let maxNum = 0;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(r) {
      const m = String(r[0]).match(/(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  return 'SSP-' + ('0000' + (maxNum + 1)).slice(-4);
}

function getSarfSiparisleri_() {
  return sheetToObjects_(SHEETS.SARF_SIPARISLERI);
}

function createSarfSiparis_(data) {
  const sheet = ensureSheet_(ss_(), SHEETS.SARF_SIPARISLERI, SARF_SIPARIS_HEADERS);
  const id = nextSarfSiparisId_();
  const now = nowStr_();
  const durum = data.Durum || 'Bekleniyor';
  const fiyatTRY = computeNeedFiyatTRY_({ Fiyat: data.Fiyat, ParaBirimi: data.ParaBirimi, Durum: durum, SiparisTarihi: data.SiparisTarihi, OlusturmaTarihi: now });
  const headerRow = getEffectiveHeaders_(sheet, SARF_SIPARIS_HEADERS);
  const row = headerRow.map(function(h) {
    if (h === 'ID') return id;
    if (h === 'OlusturmaTarihi' || h === 'SonGuncelleme') return now;
    if (h === 'Durum') return durum;
    if (h === 'FiyatTRY') return fiyatTRY;
    if (h === 'OdemeDurumu') return data.OdemeDurumu || 'Odenmedi';
    return data[h] !== undefined ? data[h] : '';
  });
  sheet.appendRow(row);
  if (data.Tedarikci) addListItem_('Tedarikci', data.Tedarikci);
  logAction_(null, 'Sarf Siparisi Olusturuldu', id + ' - ' + (data.MalzemeAdi || ''));
  return { id: id, message: 'Sarf siparisi olusturuldu.' };
}

function updateSarfSiparis_(id, data) {
  const sheet = ensureSheet_(ss_(), SHEETS.SARF_SIPARISLERI, SARF_SIPARIS_HEADERS);
  const rowIdx = findRowIndexById_(SHEETS.SARF_SIPARISLERI, 'ID', id);
  if (rowIdx === -1) throw new Error('Sarf siparisi bulunamadi: ' + id);
  const headerRow = getEffectiveHeaders_(sheet, SARF_SIPARIS_HEADERS);
  const currentRow = sheet.getRange(rowIdx, 1, 1, headerRow.length).getValues()[0];
  const current = {};
  headerRow.forEach(function(h, i) { current[h] = currentRow[i]; });
  // Faturaya bagli siparisin odeme bilgisini fatura belirler (bkz. updateNeed_).
  if (current.FaturaID && data.FaturaID === undefined && (data.OdemeDurumu !== undefined || data.OdemeTarihi !== undefined)) {
    data = Object.assign({}, data);
    delete data.OdemeDurumu;
    delete data.OdemeTarihi;
  }

  const merged = {};
  headerRow.forEach(function(h) { merged[h] = data[h] !== undefined ? data[h] : current[h]; });
  const fiyatTRY = computeNeedFiyatTRY_(merged);

  const newRow = headerRow.map(function(h) {
    if (h === 'ID' || h === 'OlusturmaTarihi') return current[h];
    if (h === 'FiyatTRY') return fiyatTRY;
    if (h === 'SonGuncelleme') return nowStr_();
    return data[h] !== undefined ? data[h] : current[h];
  });
  sheet.getRange(rowIdx, 1, 1, newRow.length).setValues([newRow]);
  return { id: id, message: 'Sarf siparisi guncellendi.' };
}

// Siparisi "Karsilandi" yapar ve Miktar kadar Sarf Malzemesi stoguna ekler.
function fulfillSarfSiparis_(id, user) {
  const siparis = getSarfSiparisleri_().filter(function(s) { return s.ID === id; })[0];
  if (!siparis) throw new Error('Sarf siparisi bulunamadi: ' + id);
  if (siparis.Durum === 'Karsilandi') throw new Error('Bu siparis zaten karsilanmis.');
  if (!siparis.MalzemeID) throw new Error('Bu siparisin bagli oldugu bir Sarf Malzemesi yok.');
  const miktar = Number(siparis.Miktar) || 1;
  sarfHareket_({ MalzemeID: siparis.MalzemeID, IslemTuru: 'Giris', Miktar: miktar, Aciklama: 'Satin Alma Siparisi karsilandi: ' + id }, user);
  updateSarfSiparis_(id, { Durum: 'Karsilandi' });
  logAction_(user, 'Sarf Siparisi Karsilandi', id + ' -> ' + siparis.MalzemeID + ' (+' + miktar + ')');
  return { message: (siparis.MalzemeAdi || siparis.MalzemeID) + ' stoguna ' + miktar + ' adet eklendi.' };
}

// ---- Faturalar (helpers.js'deki Node karsiligi ile AYNI mantik) ----
// Bir Fatura/Proforma kaydi, birden fazla Ihtiyac satirini (ve Sarf
// siparisini) TEK bir odeme durumuna baglar: faturanin OdemeDurumu /
// OdemeTarihi'si degisince baglantili TUM satirlara otomatik yayilir.
// Satirlarin kendi ProformaLink belgeleri ASLA silinmez (faturaya sadece
// KOPYALANIR) - baglama/ayirma/silme hicbir belgeyi kaybettirmez.
function splitLinks_(s) {
  return String(s || '').split(',').map(function(x) { return x.trim(); }).filter(function(x) { return x; });
}

function mergeLinks_(lists) {
  const out = [];
  (lists || []).forEach(function(s) {
    splitLinks_(s).forEach(function(l) { if (out.indexOf(l) === -1) out.push(l); });
  });
  return out.join(', ');
}

// Birden fazla satirin odeme durumundan tek bir ozet cikarir (otomatik gruplama).
function aggregatePayment_(rows) {
  const all = rows.map(function(r) { return r.OdemeDurumu || 'Odenmedi'; });
  // Iptal edilmis satirlar ozeti etkilemez (hepsi iptalse ozet de Iptal).
  const st = all.filter(function(x) { return x !== 'Iptal'; });
  let durum = 'KismenOdendi';
  if (all.length && !st.length) durum = 'Iptal';
  else if (st.every(function(x) { return x === 'Iade'; })) durum = 'Iade';
  else if (st.length && st.every(function(x) { return x === 'Odendi'; })) durum = 'Odendi';
  else if (st.length && st.every(function(x) { return x === 'TeklifFiyat'; })) durum = 'TeklifFiyat';
  else if (st.every(function(x) { return x === 'TeklifFiyat' || x === 'Odenmedi'; })) durum = 'Odenmedi';
  else if (!st.length || st.every(function(x) { return x === 'Odenmedi'; })) durum = 'Odenmedi';
  const dates = rows
    .filter(function(r) { return (r.OdemeDurumu === 'Odendi' || r.OdemeDurumu === 'KismenOdendi') && r.OdemeTarihi; })
    .map(function(r) { return String(r.OdemeTarihi); }).sort();
  return { OdemeDurumu: durum, OdemeTarihi: dates.length ? dates[dates.length - 1] : '' };
}

// Bir sheet'teki birden fazla satira (ID -> kismi veri) toplu yama uygular.
// Sadece DEGISEN satirlar, GERCEK baslik sirasina gore yazilir ("kayma" olmaz).
function patchRowsById_(sheetName, fallbackHeaders, patchesById) {
  if (!Object.keys(patchesById).length) return 0;
  const sheet = ensureSheet_(ss_(), sheetName, fallbackHeaders);
  const headerRow = getEffectiveHeaders_(sheet, fallbackHeaders);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, 1, lastRow - 1, headerRow.length).getValues();
  const idCol = headerRow.indexOf('ID');
  let count = 0;
  values.forEach(function(row, i) {
    const patch = patchesById[String(row[idCol])];
    if (!patch) return;
    headerRow.forEach(function(h, c) { if (patch[h] !== undefined) row[c] = patch[h]; });
    sheet.getRange(i + 2, 1, 1, headerRow.length).setValues([row]);
    count++;
  });
  return count;
}

function nextFaturaId_() {
  const sheet = ss_().getSheetByName(SHEETS.FATURALAR);
  const lastRow = sheet ? sheet.getLastRow() : 0;
  let maxNum = 0;
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function(r) {
      const m = String(r[0]).match(/(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  return 'FTR-' + ('0000' + (maxNum + 1)).slice(-4);
}

function getFaturalar_() {
  return sheetToObjects_(SHEETS.FATURALAR);
}

function getFaturaLinkedRows_(faturaId) {
  return {
    needs: sheetToObjects_(SHEETS.IHTIYACLAR).filter(function(n) { return n.FaturaID === faturaId; }),
    sarf: getSarfSiparisleri_().filter(function(s) { return s.FaturaID === faturaId; })
  };
}

// Faturanin guncel odeme bilgisini, ondan farkli olan tum baglantili satirlara yazar.
function propagateFaturaPayment_(fatura) {
  const linked = getFaturaLinkedRows_(fatura.ID);
  const want = { OdemeDurumu: fatura.OdemeDurumu || 'Odenmedi', OdemeTarihi: fatura.OdemeTarihi || '' };
  function patchOf(rows) {
    const p = {};
    rows.forEach(function(r) {
      if (String(r.OdemeDurumu || 'Odenmedi') !== want.OdemeDurumu || String(r.OdemeTarihi || '') !== want.OdemeTarihi) p[r.ID] = Object.assign({}, want);
    });
    return p;
  }
  patchRowsById_(SHEETS.IHTIYACLAR, IHTIYAC_HEADERS, patchOf(linked.needs));
  if (linked.sarf.length) patchRowsById_(SHEETS.SARF_SIPARISLERI, SARF_SIPARIS_HEADERS, patchOf(linked.sarf));
}

function linkFatura_(faturaId, needIds, sarfIds) {
  needIds = needIds || [];
  sarfIds = sarfIds || [];
  const fatura = getFaturalar_().filter(function(f) { return f.ID === faturaId; })[0];
  if (!fatura) throw new Error('Fatura bulunamadi: ' + faturaId);
  const needRows = needIds.length ? sheetToObjects_(SHEETS.IHTIYACLAR).filter(function(n) { return needIds.indexOf(n.ID) !== -1; }) : [];
  const sarfRows = sarfIds.length ? getSarfSiparisleri_().filter(function(s) { return sarfIds.indexOf(s.ID) !== -1; }) : [];
  const want = { FaturaID: faturaId, OdemeDurumu: fatura.OdemeDurumu || 'Odenmedi', OdemeTarihi: fatura.OdemeTarihi || '' };
  const needPatch = {};
  needRows.forEach(function(n) { needPatch[n.ID] = Object.assign({}, want); });
  const sarfPatch = {};
  sarfRows.forEach(function(s) { sarfPatch[s.ID] = Object.assign({}, want); });
  patchRowsById_(SHEETS.IHTIYACLAR, IHTIYAC_HEADERS, needPatch);
  if (sarfRows.length) patchRowsById_(SHEETS.SARF_SIPARISLERI, SARF_SIPARIS_HEADERS, sarfPatch);

  const docs = mergeLinks_([fatura.BelgeLink].concat(needRows.map(function(n) { return n.ProformaLink; }), sarfRows.map(function(s) { return s.ProformaLink; })));
  if (docs !== String(fatura.BelgeLink || '')) {
    const patch = {};
    patch[faturaId] = { BelgeLink: docs, SonGuncelleme: nowStr_() };
    patchRowsById_(SHEETS.FATURALAR, FATURA_HEADERS, patch);
  }
  logAction_(null, 'Faturaya Baglandi', faturaId + ' <- ' + needRows.length + ' ihtiyac, ' + sarfRows.length + ' sarf siparisi');
  return { message: (needRows.length + sarfRows.length) + ' satir faturaya baglandi.' };
}

function unlinkFatura_(needIds, sarfIds) {
  needIds = needIds || [];
  sarfIds = sarfIds || [];
  const needPatch = {};
  needIds.forEach(function(id) { needPatch[id] = { FaturaID: '' }; });
  const sarfPatch = {};
  sarfIds.forEach(function(id) { sarfPatch[id] = { FaturaID: '' }; });
  patchRowsById_(SHEETS.IHTIYACLAR, IHTIYAC_HEADERS, needPatch);
  if (sarfIds.length) patchRowsById_(SHEETS.SARF_SIPARISLERI, SARF_SIPARIS_HEADERS, sarfPatch);
  return { message: 'Fatura baglantisi kaldirildi.' };
}

function createFatura_(data, needIds, sarfIds) {
  const sheet = ensureSheet_(ss_(), SHEETS.FATURALAR, FATURA_HEADERS);
  const id = nextFaturaId_();
  const now = nowStr_();
  const headerRow = getEffectiveHeaders_(sheet, FATURA_HEADERS);
  const row = headerRow.map(function(h) {
    if (h === 'ID') return id;
    if (h === 'OlusturmaTarihi' || h === 'SonGuncelleme') return now;
    if (h === 'OdemeDurumu') return data.OdemeDurumu || 'Odenmedi';
    return data[h] !== undefined ? data[h] : '';
  });
  sheet.appendRow(row);
  if (data.Tedarikci) addListItem_('Tedarikci', data.Tedarikci);
  logAction_(null, 'Fatura Olusturuldu', id + ' - ' + (data.FaturaNo || ''));
  if ((needIds && needIds.length) || (sarfIds && sarfIds.length)) linkFatura_(id, needIds, sarfIds);
  return { id: id, message: 'Fatura olusturuldu.' };
}

// needIds/sarfIds verilirse: faturanin baglantili satir listesi TAM OLARAK bu
// liste olur (listede olmayanlarin baglantisi kalkar, yeniler baglanir).
function updateFatura_(id, data, needIds, sarfIds) {
  const existing = getFaturalar_().filter(function(f) { return f.ID === id; })[0];
  if (!existing) throw new Error('Fatura bulunamadi: ' + id);
  const patch = { SonGuncelleme: nowStr_() };
  FATURA_HEADERS.forEach(function(h) {
    if (h !== 'ID' && h !== 'OlusturmaTarihi' && h !== 'SonGuncelleme' && data[h] !== undefined) patch[h] = data[h];
  });
  const patches = {};
  patches[id] = patch;
  patchRowsById_(SHEETS.FATURALAR, FATURA_HEADERS, patches);
  if (data.Tedarikci) addListItem_('Tedarikci', data.Tedarikci);

  if (needIds !== undefined || sarfIds !== undefined) {
    const linked = getFaturaLinkedRows_(id);
    const linkedNeedIds = linked.needs.map(function(n) { return n.ID; });
    const linkedSarfIds = linked.sarf.map(function(s) { return s.ID; });
    const keepNeed = needIds || linkedNeedIds;
    const keepSarf = sarfIds || linkedSarfIds;
    const dropNeed = linkedNeedIds.filter(function(x) { return keepNeed.indexOf(x) === -1; });
    const dropSarf = linkedSarfIds.filter(function(x) { return keepSarf.indexOf(x) === -1; });
    if (dropNeed.length || dropSarf.length) unlinkFatura_(dropNeed, dropSarf);
    const addNeed = keepNeed.filter(function(x) { return linkedNeedIds.indexOf(x) === -1; });
    const addSarf = keepSarf.filter(function(x) { return linkedSarfIds.indexOf(x) === -1; });
    if (addNeed.length || addSarf.length) linkFatura_(id, addNeed, addSarf);
  }
  const fresh = getFaturalar_().filter(function(f) { return f.ID === id; })[0];
  propagateFaturaPayment_(fresh);
  logAction_(null, 'Fatura Guncellendi', id + ' - ' + (fresh.OdemeDurumu || ''));
  return { id: id, message: 'Fatura guncellendi.' };
}

function deleteFatura_(id) {
  const rowIdx = findRowIndexById_(SHEETS.FATURALAR, 'ID', id);
  if (rowIdx === -1) throw new Error('Fatura bulunamadi: ' + id);
  const linked = getFaturaLinkedRows_(id);
  unlinkFatura_(linked.needs.map(function(n) { return n.ID; }), linked.sarf.map(function(s) { return s.ID; }));
  ss_().getSheetByName(SHEETS.FATURALAR).deleteRow(rowIdx);
  logAction_(null, 'Fatura Silindi', id);
  return { deleted: id, message: 'Fatura silindi (baglantili satirlar oldugu gibi kaldi).' };
}

// Henuz faturaya baglanmamis, SIPARIS VERILMIS/KARSILANMIS satirlari ayni
// Tedarikci + Siparis Tarihi'ne gore gruplar. Hicbir sey YAZMAZ - sadece oneri dondurur.
function suggestFaturaGroups_() {
  const okDurum = ['Siparis Verildi', 'Yolda', 'KismenAlindi', 'Karsilandi'];
  function eligible(r) { return okDurum.indexOf(r.Durum) !== -1 && !r.FaturaID && r.Tedarikci && r.SiparisTarihi; }
  const needs = sheetToObjects_(SHEETS.IHTIYACLAR).filter(eligible);
  const sarf = getSarfSiparisleri_().filter(eligible);
  const groups = {};
  function add(r, kind) {
    const k = String(r.Tedarikci).trim().toLowerCase() + '|' + String(r.SiparisTarihi).slice(0, 10);
    if (!groups[k]) groups[k] = { key: k, Tedarikci: String(r.Tedarikci).trim(), SiparisTarihi: String(r.SiparisTarihi).slice(0, 10), needs: [], sarf: [] };
    groups[k][kind].push(r);
  }
  needs.forEach(function(r) { add(r, 'needs'); });
  sarf.forEach(function(r) { add(r, 'sarf'); });
  return Object.keys(groups).map(function(k) { return groups[k]; })
    .filter(function(g) { return g.needs.length + g.sarf.length >= 2; })
    .map(function(g) {
      const all = g.needs.concat(g.sarf);
      const agg = aggregatePayment_(all);
      return {
        key: g.key, Tedarikci: g.Tedarikci, SiparisTarihi: g.SiparisTarihi,
        needIds: g.needs.map(function(r) { return r.ID; }), sarfIds: g.sarf.map(function(r) { return r.ID; }),
        OdemeDurumu: agg.OdemeDurumu, OdemeTarihi: agg.OdemeTarihi,
        BelgeLink: mergeLinks_(all.map(function(r) { return r.ProformaLink; }))
      };
    })
    .sort(function(a, b) { return b.SiparisTarihi > a.SiparisTarihi ? 1 : -1; });
}

// Kullanicinin onayladigi gruplardan fatura olusturur (durum sunucuda yeniden hesaplanir).
function createFaturalarFromGroups_(groups) {
  const current = suggestFaturaGroups_();
  let created = 0;
  (groups || []).forEach(function(g) {
    const fresh = current.filter(function(c) { return c.key === g.key; })[0];
    if (!fresh) return;
    createFatura_({
      Tedarikci: fresh.Tedarikci, FaturaTarihi: fresh.SiparisTarihi,
      OdemeDurumu: fresh.OdemeDurumu, OdemeTarihi: fresh.OdemeTarihi,
      BelgeLink: fresh.BelgeLink,
      Notlar: 'Otomatik gruplandi: ' + fresh.Tedarikci + ' / ' + fresh.SiparisTarihi
    }, fresh.needIds, fresh.sarfIds);
    created++;
  });
  return { created: created, message: created + ' fatura olusturuldu.' };
}

// TEK SEFERLIK MIGRASYON: Calisanlar sekmesinde elle olusturulmus eski
// "Email Adres Name" (boslukluu) sutunundaki GERCEK veriyi, kodun kullandigi
// "EmailAdresName" (boslukssuz) sutununa tasir ve eskisini temizler. Ayrica
// "İşe Başlama Tarihi" basligini kodun bekledigi "IseBaslamaTarihi" ile
// degistirir. Basliklari SUTUN ADINA gore bulur (fiziksel pozisyona degil),
// bu yuzden sutunlar elle yeniden siralanmis olsa bile guvenle calisir.
// Apps Script editorunde BIR KERE calistirin.
function migrateCalisanlarColumns_() {
  const sheet = ss_().getSheetByName(SHEETS.CALISANLAR);
  if (!sheet) return 'Calisanlar sekmesi bulunamadi.';
  const report = [];

  // 1) Eski "Email Adres Name" (bosluklu) -> dogru "EmailAdresName" (bosluksuz)
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const oldEmailCol = headers.indexOf('Email Adres Name');
  const newEmailCol = headers.indexOf('EmailAdresName');
  const lastRow = sheet.getLastRow();
  if (oldEmailCol !== -1 && newEmailCol !== -1 && lastRow >= 2) {
    const oldValues = sheet.getRange(2, oldEmailCol + 1, lastRow - 1, 1).getValues();
    const newValues = sheet.getRange(2, newEmailCol + 1, lastRow - 1, 1).getValues();
    let copied = 0;
    const merged = oldValues.map(function(row, i) {
      if (!newValues[i][0] && row[0]) { copied++; return [row[0]]; }
      return [newValues[i][0]];
    });
    sheet.getRange(2, newEmailCol + 1, lastRow - 1, 1).setValues(merged);
    sheet.getRange(1, oldEmailCol + 1, lastRow, 1).clearContent(); // eski sutunu (baslik dahil) temizle
    report.push(copied + ' satir "EmailAdresName" sutununa tasindi, eski "Email Adres Name" sutunu temizlendi.');
  } else if (oldEmailCol === -1) {
    report.push('"Email Adres Name" (bosluklu) sutunu zaten yok, atlandi.');
  } else {
    report.push('"EmailAdresName" sutunu bulunamadi, tasima yapilamadi.');
  }

  // 2) "İşe Başlama Tarihi" basligini "IseBaslamaTarihi" ile degistir (veri kaybi yok, sadece baslik metni).
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]; // yeniden oku, sutunlar degismis olabilir
  const oldStartCol = headers.indexOf('İşe Başlama Tarihi');
  if (oldStartCol !== -1) {
    sheet.getRange(1, oldStartCol + 1).setValue('IseBaslamaTarihi');
    report.push('"İşe Başlama Tarihi" basligi "IseBaslamaTarihi" olarak yeniden adlandirildi.');
  } else {
    report.push('"İşe Başlama Tarihi" basligi bulunamadi (belki zaten duzeltilmis), atlandi.');
  }

  return report.join(' ');
}


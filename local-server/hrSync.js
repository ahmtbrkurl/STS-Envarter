// HR Senkronizasyonu - Code.gs'deki previewHRSync_/applyHRSync_ ile AYNI mantik.
// HR Master Log, ANA STS-Envarter sheet'inden FARKLI bir Google Sheet'tir -
// bu yuzden servis hesabinizin o sheet'e de (en az Goruntuleyen olarak)
// eklenmis olmasi gerekir - bkz. README.md.
require('dotenv').config();
const sheets = require('./sheets');
const helpers = require('./helpers');

const HR_SHEET_ID = process.env.HR_SHEET_ID;
const HR_SHEET_TAB = process.env.HR_SHEET_TAB || ''; // bos ise ilk sekme kullanilir

// SABIT SUTUN HARFLERI KULLANMIYORUZ - HR Master Log'da sutun eklenip
// cikarilabiliyor (kontrolumuz disinda), bu yuzden her sutunu BASLIK
// METNINE GORE ARAYIP buluyoruz. HR sutun sirasini degistirse bile bu
// otomatik dogru sutunu bulur, elle COL indexi guncellemeye gerek kalmaz.
// findCol_ ile eslesen alt-metinler, gercek HR Master Log basliklarindan
// (17.09.2026'da dogrulandi) alinmistir - BUYUK/kucuk harf ONEMLI, ozellikle
// "Adı(Türkçe)" (buyuk A) ile "Soyadı(Türkçe)" (kucuk a) birbirinden bu
// sekilde ayirt ediliyor.
function normalizeForSearch(s) {
  // Google Sheets/Excel'den kopyala-yapistirda bazen normal bosluk (U+0020)
  // yerine goze gorunmeyen ozel bosluk karakterleri (non-breaking space vb.)
  // gelebiliyor - bunlarin hepsini normal bosluga cevirip aramayi buna gore
  // yapiyoruz, yoksa gozle "ayni" gorunen metin eslesmeyebiliyor.
  return String(s || '').replace(/[\s\u00A0\u200B\uFEFF]+/g, ' ').trim();
}

function findCol(headers, substr) {
  const target = normalizeForSearch(substr);
  const idx = headers.findIndex((h) => normalizeForSearch(h).includes(target));
  if (idx === -1) {
    // Tum basliklari gosteriyoruz ki hangi sutunun adinin degistigi tek bakista anlasilsin.
    const all = headers.map((h, i) => `${i + 1}:"${normalizeForSearch(h)}"`).join(', ');
    throw new Error(`HR Master Log'da "${substr}" iceren bir sutun bulunamadi. Tum basliklar (${headers.length} sutun): ${all}`);
  }
  return idx;
}

// Aksan/Turkce harf farkini yok sayan esleme (U/Ü, ı/i, ş/s ...) - "Unvan" basligi
// HR dosyasinda "Ünvan" ya da farkli dil etiketiyle yazilabiliyor.
function foldForSearch(s) {
  return normalizeForSearch(s).toLowerCase()
    .replace(/[üÜ]/g, 'u').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's').replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g');
}
// Unvan sutunu: lang 'tr' veya 'ru'. Bulunamazsa -1 doner (zorunlu degil - senkron unvansiz da calisir).
function findUnvanCol(headers, lang) {
  const isRu = (f) => f.indexOf('rusca') !== -1 || f.indexOf('рус') !== -1 || f.indexOf('(ru') !== -1;
  const isTr = (f) => f.indexOf('turkce') !== -1 || f.indexOf('тур') !== -1 || f.indexOf('(tr') !== -1;
  const cand = headers.map((h, i) => ({ i, f: foldForSearch(h) }))
    .filter((x) => x.f.indexOf('unvan') !== -1 || x.f.indexOf('должност') !== -1 || x.f.indexOf('gorev') !== -1);
  const pick = cand.find((x) => (lang === 'ru' ? isRu(x.f) : isTr(x.f)))
    || (lang === 'tr' ? cand.find((x) => !isRu(x.f)) : cand.find((x) => isRu(x.f)));
  return pick ? pick.i : -1;
}

// HR "Статус/Durum" -> uygulamadaki AktifMi. "Отмена/Iptal" (ise girisi iptal
// olan) ARTIK 'Iptal' olur - eskiden 'Beklemede'ye dusuyordu ve iptal olan kisi
// yanlislikla bekleyen/aktif calisan gibi sayiliyordu. Iptal, cikis tarihi
// dolu olsa bile Pasif'e ustun gelir (uygulamada Iptal tarihi de ayni alanda tutulur).
function mapHRStatus(durum, cikisTarihi) {
  const d = String(durum || '');
  if (/Отмена|\bIptal\b|İptal/i.test(d)) return 'Iptal';
  if (cikisTarihi || /Уволен|Isten Ayrildi|İşten Ayrıldı/i.test(d)) return 'Pasif';
  if (/Активный|Aktif/i.test(d)) return 'Aktif';
  return 'Beklemede'; // Трансфер РНР/Visa, Прием приостановлен, bos vb.
}

// Telefon karsilastirmasi icin yalniz rakamlar (bicim farki "degisiklik" sayilmasin).
function phoneKey(s) { return String(s || '').replace(/\D/g, ''); }
// HR'da bos gelen alan IT'nin elle girdigi veriyi EZMEZ (diff'e girmez, yazilmaz).
const KEEP_IF_EMPTY = ['Telefon', 'Departman', 'Unvan', 'BabaAdi', 'Cinsiyet', 'Uyruk', 'IseBaslamaTarihi'];
function cleanDept(s) { const t = String(s || '').trim(); return t === '-' ? '' : t; }
function isVacant(soyad, ad) { return /^vacant$/i.test(String(soyad || '').trim()) || /^vacant$/i.test(String(ad || '').trim()); }

// Once Sicil No ile eslestir. Isim yedegi SADECE kayitta Sicil No yoksa (veya ayniysa)
// kullanilir - farkli Sicil'li ayni isimli eski kayit (yeniden ise alim) sessizce ezilmesin.
function matchExisting(bySicil, byName, sicilNo, adSoyad) {
  const bs = sicilNo && bySicil[normalizeSicil(sicilNo)];
  if (bs) return bs;
  const bn = byName[adSoyad];
  if (bn && (!bn.SicilNo || !sicilNo || normalizeSicil(bn.SicilNo) === normalizeSicil(sicilNo))) return bn;
  return null;
}

function buildColMap(headers) {
  return {
    SICIL: findCol(headers, 'Sicil No'),
    SOYAD: findCol(headers, 'Soyadı(Türkçe)'),
    SOYAD_RU: findCol(headers, 'Soyadı(Rusça)'),
    AD: findCol(headers, 'Adı(Türkçe)'),
    AD_RU: findCol(headers, 'Adı(Rusça)'),
    BABA_ADI: findCol(headers, 'Baba ad'),
    YAKA: findCol(headers, 'Yaka'),
    UNVAN_TR: findUnvanCol(headers, 'tr'),
    UNVAN_RU: findUnvanCol(headers, 'ru'),
    CINSIYET: findCol(headers, 'Cinsiyet'),
    UYRUK: findCol(headers, 'Uyruk'),
    TELEFON: findCol(headers, 'Cep Telefonu'),
    GIRIS: findCol(headers, 'İşe Giriş Tarihi'),
    CIKIS: findCol(headers, 'İşten Çıkış Tarihi'),
    DURUM: findCol(headers, '/Durum'),
    DEPARTMAN: findCol(headers, '2. Seviye Birim') // kullanicinin secimi
  };
}

function normalizeSicil(s) {
  const stripped = String(s || '').trim().replace(/^0+/, '');
  return stripped || '0';
}

// HR Master Log'daki tarih hucresinin gorunum formati (dd.MM.yyyy, yyyy-MM-dd
// vb.) hucrenin kendi bicimlendirmesine gore degisebiliyor - bu da ayni
// tarihin farkli yazilip "degisti" sanilmasina yol aciyordu. Ne gelirse gelsin
// HEP ayni ISO formatina (yyyy-MM-dd) cevirip oyle karsilastiriyoruz/saklıyoruz.
function normalizeDateStr(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmyMatch = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return s;
}

// Iki isim (soyad/ad) arasinda EN AZ bir ortak, anlamli (3+ harfli) kelime
// var mi? Varsa "muhtemelen ayni kisi, sadece kucuk bir yazim duzeltmesi"
// sayilir. Hicbir ortak kelime yoksa "muhtemelen FARKLI bir kisi, ayni Sicil
// No yeniden kullanilmis olabilir" diye isaretlenir - otomatik karar
// VERILMEZ, sadece kullaniciya sorulacak bir uyari uretilir.
function namesOverlap(nameA, nameB) {
  const tokensOf = (s) => foldForSearch(s).split(/\s+/).filter((t) => t.length >= 2);
  const a = new Set(tokensOf(nameA));
  const b = tokensOf(nameB);
  return b.some((t) => a.has(t));
}

// HR Master Log'un ilk birkac satirinda sirket adi/dokuman basligi gibi
// "sifir" satirlar olabiliyor (dogrulandigi gibi: baslik aslinda 4. satirda).
// Bu yuzden "0. satir = baslik" diye VARSAYMIYORUZ - "Sicil No" iceren
// SATIRI arayip GERCEK baslik satirini buluyoruz.
function findHeaderRowIndex(values) {
  for (let i = 0; i < Math.min(values.length, 15); i++) {
    if (values[i].some((cell) => normalizeForSearch(cell).includes('Sicil No'))) return i;
  }
  throw new Error('HR Master Log\'un ilk 15 satirinda "Sicil No" iceren bir baslik satiri bulunamadi.');
}

async function fetchHRRows() {
  if (!HR_SHEET_ID) throw new Error('.env dosyasinda HR_SHEET_ID tanimli degil.');
  const tabName = HR_SHEET_TAB || (await sheets.getFirstSheetName(HR_SHEET_ID));
  if (!tabName) throw new Error('IK sheet sekmesi bulunamadi.');
  return sheets.getSheetValues(tabName, HR_SHEET_ID);
}

// HR satirlarini islenmis (beyaz yaka, dolu isim) "incoming" objelerine ve bu
// senkronda gorulen Sicil No'larin kumesine cevirir - hem preview hem de
// applyHRSync'in HRKayipSayaci guncellemesi icin ortak kullanilir.
function parseHRRows(values) {
  const headerRowIdx = findHeaderRowIndex(values);
  const COL = buildColMap(values[headerRowIdx]);
  const incomingList = [];
  const seenSicilSet = new Set();
  let skippedMaviYaka = 0, skippedBossAd = 0;

  for (let i = headerRowIdx + 1; i < values.length; i++) {
    const row = values[i];
    // "Gorulen Sicil" kumesi: yaka/isim filtresinden ONCE, sheet'teki TUM Sicil No'lar
    // (ismi bos ya da Mavi Yaka'ya gecen biri "HR'da kayip" sanilmasin).
    const sicilNo = String(row[COL.SICIL] || '').trim();
    if (sicilNo) seenSicilSet.add(normalizeSicil(sicilNo));
    const yaka = String(row[COL.YAKA] || '').trim();
    if (yaka.toLowerCase().indexOf('beyaz yaka') === -1) { skippedMaviYaka++; continue; }

    const ad = String(row[COL.AD] || '').trim();
    const soyad = String(row[COL.SOYAD] || '').trim();
    if ((!ad && !soyad) || isVacant(soyad, ad)) { skippedBossAd++; continue; } // bos kadro (VACANT) calisan degildir
    const adSoyad = (ad + ' ' + soyad).trim();

    const telefon = row[COL.TELEFON] ? String(row[COL.TELEFON]) : '';
    const departman = row[COL.DEPARTMAN] ? cleanDept(row[COL.DEPARTMAN]) : '';
    const unvanTR = COL.UNVAN_TR === -1 ? '' : String(row[COL.UNVAN_TR] || '').trim();
    const unvanRU = COL.UNVAN_RU === -1 ? '' : String(row[COL.UNVAN_RU] || '').trim();
    const unvan = [unvanTR, unvanRU].filter(Boolean).join('/');
    const babaAdiRawKiril = String(row[COL.BABA_ADI] || '').trim();
    const babaAdi = helpers.transliterateCyrillicToLatin(babaAdiRawKiril);
    const soyadRu = String(row[COL.SOYAD_RU] || '').trim();
    const adRu = String(row[COL.AD_RU] || '').trim();
    const emailBasvuruAdi = [soyadRu, adRu, babaAdiRawKiril].filter(Boolean).join(' ');
    const iseBaslamaTarihi = normalizeDateStr(row[COL.GIRIS]);
    const cikisTarihi = row[COL.CIKIS];
    const durum = String(row[COL.DURUM] || '');

    const aktifMi = mapHRStatus(durum, cikisTarihi);

    const cinsiyet = String(row[COL.CINSIYET] || '').trim();
    const uyruk = String(row[COL.UYRUK] || '').trim();
    incomingList.push({ SicilNo: sicilNo, AdSoyad: adSoyad, Telefon: telefon, Departman: departman, AktifMi: aktifMi, Unvan: unvan, BabaAdi: babaAdi, IseBaslamaTarihi: iseBaslamaTarihi, IstenAyrilmaTarihi: normalizeDateStr(cikisTarihi), EmailBasvuruAdi: emailBasvuruAdi, Cinsiyet: cinsiyet, Uyruk: uyruk });
  }

  return { incomingList, seenSicilSet, skippedMaviYaka, skippedBossAd };
}

async function previewHRSync() {
  const values = await fetchHRRows();
  const { incomingList, seenSicilSet, skippedMaviYaka, skippedBossAd } = parseHRRows(values);

  const currentEmployees = await sheets.sheetToObjects(helpers.SHEET_NAMES.CALISANLAR);
  const bySicil = {};
  const byName = {};
  currentEmployees.forEach((e) => {
    if (e.SicilNo) bySicil[normalizeSicil(e.SicilNo)] = e;
    byName[e.AdSoyad] = e;
  });

  const changes = [];
  incomingList.forEach((incoming) => {
    const sicilNo = incoming.SicilNo;
    const adSoyad = incoming.AdSoyad;
    const current = matchExisting(bySicil, byName, sicilNo, adSoyad);

    if (!current) {
      let possibleDuplicateOf = null;
      if (phoneKey(incoming.Telefon)) {
        const phoneMatch = currentEmployees.find((e) => e.Telefon && phoneKey(e.Telefon) === phoneKey(incoming.Telefon));
        if (phoneMatch) possibleDuplicateOf = phoneMatch.AdSoyad;
      }
      changes.push({ key: sicilNo || adSoyad, changeType: 'new', incoming, current: null, changedFields: [], possibleDuplicateOf });
    } else {
      const changedFields = [];
      ['AdSoyad', 'Telefon', 'Departman', 'AktifMi', 'Unvan', 'BabaAdi', 'EmailBasvuruAdi', 'Cinsiyet', 'Uyruk'].forEach((f) => {
        if (KEEP_IF_EMPTY.includes(f) && !String(incoming[f] || '').trim()) return;
        const a = String(current[f] || ''), b = String(incoming[f] || '');
        if (f === 'Telefon' ? phoneKey(a) !== phoneKey(b) : f === 'AdSoyad' ? foldForSearch(a) !== foldForSearch(b) : a !== b) changedFields.push(f);
      });
      if (incoming.IseBaslamaTarihi && normalizeDateStr(current.IseBaslamaTarihi) !== normalizeDateStr(incoming.IseBaslamaTarihi)) changedFields.push('IseBaslamaTarihi');
      if (normalizeDateStr(current.IstenAyrilmaTarihi) !== normalizeDateStr(incoming.IstenAyrilmaTarihi)) changedFields.push('IstenAyrilmaTarihi');
      if (sicilNo && normalizeSicil(current.SicilNo || '') !== normalizeSicil(sicilNo)) changedFields.push('SicilNo');
      if (changedFields.length > 0) {
        const possibleDifferentPerson = changedFields.includes('AdSoyad') && sicilNo && normalizeSicil(current.SicilNo || '') === normalizeSicil(sicilNo) && !namesOverlap(current.AdSoyad, adSoyad);
        changes.push({ key: sicilNo || adSoyad, changeType: 'updated', incoming, current, changedFields, possibleDifferentPerson });
      }
    }
  });

  const missingEmployees = currentEmployees
    .filter((e) => e.SicilNo && !String(e.SicilNo).includes('(eski)') && (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede'))
    .filter((e) => !seenSicilSet.has(normalizeSicil(e.SicilNo)))
    .map((e) => ({ AdSoyad: e.AdSoyad, SicilNo: e.SicilNo, Departman: e.Departman, Unvan: e.Unvan, hrKayipSayaci: parseInt(e.HRKayipSayaci, 10) || 0 }))
    .filter((e) => e.hrKayipSayaci >= 1);

  return { changes, skippedMaviYaka, skippedBossAd, missingEmployees };
}

async function applyHRSync(items, user) {
  const currentEmployees = await sheets.sheetToObjects(helpers.SHEET_NAMES.CALISANLAR);
  const bySicil = {};
  const byName = {};
  currentEmployees.forEach((e) => {
    if (e.SicilNo) bySicil[normalizeSicil(e.SicilNo)] = e;
    byName[e.AdSoyad] = e;
  });
  let created = 0, updated = 0, reassigned = 0;

  for (const item of items) {
    if (item._action === 'differentPerson') {
      const oldEmployee = item._eskiAdSoyad ? byName[item._eskiAdSoyad] : null;
      if (oldEmployee) {
        await helpers.updateEmployee(oldEmployee.AdSoyad, {
          AktifMi: 'Pasif',
          SicilNo: `${oldEmployee.SicilNo} (eski)`
        });
        reassigned++;
      }
      await helpers.createEmployee({
        AdSoyad: item.AdSoyad, Telefon: item.Telefon, Email: '', Departman: item.Departman,
        AktifMi: item.AktifMi, SicilNo: item.SicilNo, Unvan: item.Unvan, BabaAdi: item.BabaAdi,
        IseBaslamaTarihi: item.IseBaslamaTarihi, IstenAyrilmaTarihi: item.IstenAyrilmaTarihi, EmailBasvuruAdi: item.EmailBasvuruAdi,
        Cinsiyet: item.Cinsiyet, Uyruk: item.Uyruk, Firma: 'STS-Akkuyu'
      });
      created++;
      continue;
    }

    const existing = matchExisting(bySicil, byName, item.SicilNo, item.AdSoyad);
    if (existing) {
      const payload = {
        AdSoyad: item.AdSoyad, Telefon: item.Telefon, Departman: item.Departman,
        AktifMi: item.AktifMi, SicilNo: item.SicilNo, Unvan: item.Unvan, BabaAdi: item.BabaAdi,
        IseBaslamaTarihi: item.IseBaslamaTarihi, IstenAyrilmaTarihi: item.IstenAyrilmaTarihi, EmailBasvuruAdi: item.EmailBasvuruAdi,
        Cinsiyet: item.Cinsiyet, Uyruk: item.Uyruk,
        // Firma'yi sadece bos ise doldur - elle degistirilmis Firma ezilmesin.
        ...(existing.Firma ? {} : { Firma: 'STS-Akkuyu' })
      };
      KEEP_IF_EMPTY.forEach((f) => { if (!String(payload[f] || '').trim()) delete payload[f]; });
      await helpers.updateEmployee(existing.AdSoyad, payload);
      updated++;
    } else {
      await helpers.createEmployee({
        AdSoyad: item.AdSoyad, Telefon: item.Telefon, Email: '', Departman: item.Departman,
        AktifMi: item.AktifMi, SicilNo: item.SicilNo, Unvan: item.Unvan, BabaAdi: item.BabaAdi,
        IseBaslamaTarihi: item.IseBaslamaTarihi, IstenAyrilmaTarihi: item.IstenAyrilmaTarihi, EmailBasvuruAdi: item.EmailBasvuruAdi,
        Cinsiyet: item.Cinsiyet, Uyruk: item.Uyruk, Firma: 'STS-Akkuyu'
      });
      created++;
    }
  }

  let hrKayipSayaciUyari = '';
  try {
    const freshEmployeesCheck = await sheets.getSheetValues(helpers.SHEET_NAMES.CALISANLAR);
    const actualHeaders = freshEmployeesCheck[0] || [];
    if (!actualHeaders.includes('HRKayipSayaci')) {
      hrKayipSayaciUyari = ' ⚠️ UYARI: "Calisanlar" sekmesinde "HRKayipSayaci" sutunu bulunamadi - HR kayip takibi calismiyor, bu sutunu eklemeniz gerekiyor.';
    } else {
      const values = await fetchHRRows();
      const { seenSicilSet, incomingList: hrNow } = parseHRRows(values);
      if (hrNow.length === 0) throw new Error('HR sheet bos/okunamadi - kayip sayaci guncellenmedi.');
      const freshEmployees = await sheets.sheetToObjects(helpers.SHEET_NAMES.CALISANLAR);
      for (const e of freshEmployees) {
        if (!e.SicilNo || String(e.SicilNo).includes('(eski)')) continue;
        if (e.AktifMi !== 'Aktif' && e.AktifMi !== 'Beklemede') continue;
        const seen = seenSicilSet.has(normalizeSicil(e.SicilNo));
        const currentCount = parseInt(e.HRKayipSayaci, 10) || 0;
        const nextCount = seen ? 0 : currentCount + 1;
        if (nextCount !== currentCount) {
          await helpers.updateEmployee(e.AdSoyad, { HRKayipSayaci: nextCount });
        }
      }
    }
  } catch (e) {
    console.error('HRKayipSayaci guncelleme hatasi:', e.message);
    hrKayipSayaciUyari = ' ⚠️ UYARI: HR kayip takibi guncellenirken bir hata olustu: ' + e.message;
  }

  const summary = `${created} yeni, ${updated} guncellenen calisan (HR onayli).` + (reassigned > 0 ? ` ${reassigned} kisi Pasif yapildi (Sicil No yeniden kullanildi).` : '') + hrKayipSayaciUyari;
  await helpers.logAction(user, 'IK Senkronizasyonu Onaylandi', summary);
  return { created, updated, reassigned, message: summary };
}

module.exports = { previewHRSync, applyHRSync, mapHRStatus };

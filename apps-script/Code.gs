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
  LISTELER: 'Listeler'
};

const ENVANTER_HEADERS = [
  'ID', 'Kategori', 'Marka', 'Model', 'SeriNo', 'Renk', 'Hostname', 'MAC',
  'Durum', 'Lokasyon', 'AtananKisi', 'AtamaTarihi', 'Tedarikci',
  'SatinAlmaTarihi', 'TeslimAlmaTarihi', 'Fiyat', 'ParaBirimi',
  'GarantiBitisTarihi', 'FaturaLink', 'Notlar', 'OlusturmaTarihi', 'SonGuncelleme'
];

const CALISAN_HEADERS = ['AdSoyad', 'Telefon', 'Email', 'AktifMi'];

const HAREKET_HEADERS = [
  'HareketID', 'VarlikID', 'Tarih', 'IslemTuru', 'OncekiKullanici',
  'YeniKullanici', 'OncekiDurum', 'YeniDurum', 'OncekiLokasyon',
  'YeniLokasyon', 'Aciklama', 'IslemYapan'
];

const LISTE_HEADERS = ['Kategori', 'Lokasyon', 'Durum', 'ParaBirimi'];

const DEFAULT_LISTS = {
  Kategori: ['Dizustu Bilgisayar', 'Masaustu Bilgisayar', 'Monitor', 'Yazici', 'Telefon', 'Tablet', 'Ag Cihazi', 'Sunucu', 'Diger'],
  Lokasyon: ['Tasucu Ofis', 'Tasucu Depo', 'Akkuyu Ofis-1', 'Akkuyu Ofis-2', 'Akkuyu Depo'],
  Durum: ['Stok', 'Kullanimda', 'Rezerve', 'Onarimda', 'Arizali', 'Kayip', 'Hurda', 'Elden Cikarildi', 'Kartus Bitti', 'Iade'],
  ParaBirimi: ['TRY', 'USD', 'EUR', 'RUB']
};

// ============ KURULUM: sheet'leri ilk kez olustur ============
function setupSheets() {
  const spreadsheet = ss_();
  ensureSheet_(spreadsheet, SHEETS.ENVANTER, ENVANTER_HEADERS);
  ensureSheet_(spreadsheet, SHEETS.CALISANLAR, CALISAN_HEADERS);
  ensureSheet_(spreadsheet, SHEETS.HAREKETLER, HAREKET_HEADERS);
  ensureSheet_(spreadsheet, SHEETS.LISTELER, LISTE_HEADERS);

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

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ============ YARDIMCI: sheet <-> JSON ============
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
        if (val instanceof Date) {
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

// ============ HTTP GIRIS NOKTALARI ============
function doGet(e) {
  const action = e.parameter.action;
  try {
    // Genel (auth gerektirmeyen) tek islem: QR kod ile acilan varlik goruntuleme
    if (action === 'publicAsset') {
      return jsonOut_(getPublicAsset_(e.parameter.id));
    }

    if (!checkAuth_(e.parameter.token)) {
      return jsonOut_({ error: 'Yetkisiz erisim.' }, 401);
    }

    switch (action) {
      case 'inventory':
        return jsonOut_(sheetToObjects_(SHEETS.ENVANTER));
      case 'employees':
        return jsonOut_(sheetToObjects_(SHEETS.CALISANLAR));
      case 'movements':
        return jsonOut_(sheetToObjects_(SHEETS.HAREKETLER));
      case 'lists':
        return jsonOut_(getLists_());
      case 'dashboard':
        return jsonOut_(getDashboard_());
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
    if (!checkAuth_(body.token)) {
      return jsonOut_({ error: 'Yetkisiz erisim.' }, 401);
    }
    const action = body.action;
    switch (action) {
      case 'createAsset':
        return jsonOut_(createAsset_(body.data, body.user));
      case 'updateAsset':
        return jsonOut_(updateAsset_(body.id, body.data, body.user));
      case 'assignAsset':
        return jsonOut_(assignAsset_(body.data, body.user));
      case 'createEmployee':
        return jsonOut_(createEmployee_(body.data));
      case 'uploadFile':
        return jsonOut_(uploadFile_(body.data));
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
  const result = { Kategori: [], Lokasyon: [], Durum: [], ParaBirimi: [] };
  items.forEach(function(row) {
    Object.keys(result).forEach(function(k) {
      if (row[k]) result[k].push(row[k]);
    });
  });
  return result;
}

function createAsset_(data, user) {
  const sheet = ensureSheet_(ss_(), SHEETS.ENVANTER, ENVANTER_HEADERS);
  const id = nextId_('IT');
  const now = nowStr_();
  const row = ENVANTER_HEADERS.map(function(h) {
    if (h === 'ID') return id;
    if (h === 'OlusturmaTarihi' || h === 'SonGuncelleme') return now;
    return data[h] !== undefined ? data[h] : '';
  });
  sheet.appendRow(row);

  // Ilk atama varsa hareket kaydi olustur
  if (data.AtananKisi) {
    logMovement_({
      VarlikID: id,
      IslemTuru: 'Ilk Atama',
      OncekiKullanici: '',
      YeniKullanici: data.AtananKisi,
      OncekiDurum: '',
      YeniDurum: data.Durum || '',
      OncekiLokasyon: '',
      YeniLokasyon: data.Lokasyon || '',
      Aciklama: 'Varlik olusturuldu.'
    }, user);
  }

  return { id: id, message: 'Varlik olusturuldu.' };
}

function updateAsset_(id, data, user) {
  const sheet = ss_().getSheetByName(SHEETS.ENVANTER);
  const rowIdx = findRowIndexById_(SHEETS.ENVANTER, 'ID', id);
  if (rowIdx === -1) throw new Error('Varlik bulunamadi: ' + id);

  const headerRow = sheet.getRange(1, 1, 1, ENVANTER_HEADERS.length).getValues()[0];
  const currentRow = sheet.getRange(rowIdx, 1, 1, ENVANTER_HEADERS.length).getValues()[0];
  const current = {};
  headerRow.forEach(function(h, i) { current[h] = currentRow[i]; });

  const changedUser = data.AtananKisi !== undefined && String(data.AtananKisi) !== String(current.AtananKisi);
  const changedDurum = data.Durum !== undefined && String(data.Durum) !== String(current.Durum);
  const changedLokasyon = data.Lokasyon !== undefined && String(data.Lokasyon) !== String(current.Lokasyon);

  const newRow = headerRow.map(function(h) {
    if (h === 'SonGuncelleme') return nowStr_();
    if (h === 'ID' || h === 'OlusturmaTarihi') return current[h];
    return data[h] !== undefined ? data[h] : current[h];
  });
  sheet.getRange(rowIdx, 1, 1, newRow.length).setValues([newRow]);

  if (changedUser || changedDurum || changedLokasyon) {
    let islemTuru = 'Durum Degisikligi';
    if (changedUser) islemTuru = 'Transfer';
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
  const row = HAREKET_HEADERS.map(function(h) {
    if (h === 'HareketID') return nextHareketId_();
    if (h === 'Tarih') return nowStr_();
    if (h === 'IslemYapan') return user || '';
    return fields[h] !== undefined ? fields[h] : '';
  });
  sheet.appendRow(row);
}

function createEmployee_(data) {
  const sheet = ensureSheet_(ss_(), SHEETS.CALISANLAR, CALISAN_HEADERS);
  const row = CALISAN_HEADERS.map(function(h) {
    if (h === 'AktifMi') return data[h] !== undefined ? data[h] : 'Aktif';
    return data[h] || '';
  });
  sheet.appendRow(row);
  return { message: 'Calisan eklendi.' };
}

// Genel (public) QR sayfasi icin sadece finansal olmayan alanlar donuyor
function getPublicAsset_(id) {
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
  // data: { assetId, filename, mimeType, base64 }
  const folderId = getProp_('DRIVE_FOLDER_ID');
  if (!folderId) throw new Error('DRIVE_FOLDER_ID ayarlanmamis.');
  const folder = DriveApp.getFolderById(folderId);
  const decoded = Utilities.base64Decode(data.base64);
  const blob = Utilities.newBlob(decoded, data.mimeType, data.assetId + '_' + data.filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = file.getUrl();

  // Envanter satirindaki FaturaLink alanini guncelle
  if (data.assetId) {
    const rowIdx = findRowIndexById_(SHEETS.ENVANTER, 'ID', data.assetId);
    if (rowIdx !== -1) {
      const sheet = ss_().getSheetByName(SHEETS.ENVANTER);
      const col = ENVANTER_HEADERS.indexOf('FaturaLink') + 1;
      const existing = sheet.getRange(rowIdx, col).getValue();
      const combined = existing ? existing + ', ' + url : url;
      sheet.getRange(rowIdx, col).setValue(combined);
    }
  }
  return { url: url, message: 'Dosya yuklendi.' };
}

// ============ DASHBOARD ============
function getDashboard_() {
  const items = sheetToObjects_(SHEETS.ENVANTER);
  const byDurum = {};
  const byKategori = {};
  const byLokasyon = {};
  const valueByCurrency = {};
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
    warrantyExpiringSoon: warrantyExpiringSoon
  };
}

// Google Sheets API'ye DOGRUDAN baglanan yardimci katman - Apps Script'in
// SpreadsheetApp.getActiveSpreadsheet() yerine gecer. Code.gs'deki
// sheetToObjects_/ensureSheet_ fonksiyonlarinin es degeridir.
//
// NOT: Devasa "googleapis" paketi YERINE, cok daha hafif "google-auth-library"
// ile kimlik dogrulama yapip Sheets REST API'sini dogrudan fetch() ile
// cagiriyoruz - hem daha az bagimlilik/dosya (Google Drive gibi senkronize
// klasorlerde npm install sorununu onler), hem de daha hizli kurulum.
require('dotenv').config();
const { GoogleAuth } = require('google-auth-library');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
if (!SPREADSHEET_ID) {
  console.error('HATA: .env dosyasinda SPREADSHEET_ID tanimli degil. .env.example dosyasina bakin.');
  process.exit(1);
}

const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

let cachedClient = null;
async function getAuthedFetch() {
  if (!cachedClient) cachedClient = await auth.getClient();
  return cachedClient;
}

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Basit bellek-ici onbellek: ayni sheet'i art arda cok kez okumamak icin.
// TTL kisa tutulur (5 saniye) - veri tazeligini bozmadan gereksiz API cagrisini azaltir.
const cache = new Map();
const CACHE_TTL_MS = 5000;

function invalidateCache(sheetName) {
  if (sheetName) {
    const suffix = '::' + sheetName;
    for (const key of Array.from(cache.keys())) {
      if (key === sheetName || key.endsWith(suffix)) cache.delete(key);
    }
  } else cache.clear();
}

// Bir sheet'in TUM verisini [][] (satir dizisi) olarak okur. sourceSpreadsheetId
// verilmezse ana STS-Envarter sheet'i kullanilir - HR Master Log gibi FARKLI bir
// sheet'ten okumak icin (previewHRSync) bu parametre ile baska bir ID verilebilir.
async function getSheetValues(sheetName, sourceSpreadsheetId) {
  const spreadsheetId = sourceSpreadsheetId || SPREADSHEET_ID;
  const cacheKey = spreadsheetId + '::' + sheetName;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.values;

  const client = await getAuthedFetch();
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const res = await client.request({ url });
  const values = res.data.values || [];
  cache.set(cacheKey, { values, time: Date.now() });
  return values;
}

// Bir spreadsheet'teki sekme (tab) isimlerini sirayla dondurur - HR Master
// Log'da hangi sekmenin "ilk sekme" oldugunu bulmak icin kullanilir
// (previewHRSync, HR_SHEET_TAB bos birakilirsa ilk sekmeyi kullanir).
async function getFirstSheetName(spreadsheetId) {
  const client = await getAuthedFetch();
  const url = `${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets.properties.title`;
  const res = await client.request({ url });
  const sheetsList = res.data.sheets || [];
  return sheetsList[0]?.properties?.title || null;
}

// Code.gs'deki sheetToObjects_ ile ayni davranis: ilk satiri baslik kabul edip
// geri kalan satirlari {baslik: deger} objelerine cevirir. Bos satirlari atlar.
async function sheetToObjects(sheetName) {
  const rows = await getSheetValues(sheetName);
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1)
    .filter((row) => row.some((cell) => cell !== '' && cell !== undefined && cell !== null))
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        if (!h) return;
        const v = row[i];
        obj[h] = v === undefined || v === null ? '' : v;
      });
      return obj;
    });
}

// Bir sheet'in gercek baslik satirini (sirasini KORUYARAK) dondurur - kullanici
// sutunlari elle yeniden siralamis olsa bile dogru sutuna yazmak icin sarttir.
async function getHeaders(sheetName) {
  const rows = await getSheetValues(sheetName);
  return rows[0] || [];
}

// Verilen headers dizisine sahip yeni bir satiri sheet'in SONUNA ekler.
async function appendRow(sheetName, rowValues) {
  const client = await getAuthedFetch();
  const url = `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  await client.request({ url, method: 'POST', data: { values: [rowValues] } });
  invalidateCache(sheetName);
}

// Belirli bir satiri (1-index, baslik dahil - yani veri 2'den baslar) tamamen gunceller.
async function updateRow(sheetName, rowIndex1Based, rowValues) {
  const lastCol = columnLetter(rowValues.length);
  const range = `${sheetName}!A${rowIndex1Based}:${lastCol}${rowIndex1Based}`;
  const client = await getAuthedFetch();
  const url = `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await client.request({ url, method: 'PUT', data: { values: [rowValues] } });
  invalidateCache(sheetName);
}

// Sheet (tab) hic yoksa olusturur, VARSA ama bos ise (hic satiri yoksa)
// baslik satirini yazar - Code.gs'deki ensureSheet_ ile ayni amaca hizmet
// eder (orn. yeni eklenen "SarfSiparisleri" sekmesi, kullanicinin Google
// Sheet'e elle gidip olusturmasina gerek kalmadan ilk kullanimda otomatik
// kurulsun diye).
// Sheet'in izgara (grid) sutun sayisi yetmiyorsa genisletir - Google, izgara
// disina yazmayi "Range exceeds grid limits" hatasiyla reddeder (yeni baslik
// sutunlari eklenirken sheet'in son sutunu zaten izgaranin sonundaysa olur).
async function ensureGridColumns(sheetName, neededCols) {
  const client = await getAuthedFetch();
  const res = await client.request({ url: `${SHEETS_API_BASE}/${SPREADSHEET_ID}?fields=sheets.properties`, method: 'GET' });
  const sheet = (res.data.sheets || []).find((x) => x.properties.title === sheetName);
  if (!sheet) return;
  const have = (sheet.properties.gridProperties || {}).columnCount || 0;
  if (have >= neededCols) return;
  await client.request({
    url: `${SHEETS_API_BASE}/${SPREADSHEET_ID}:batchUpdate`,
    method: 'POST',
    data: { requests: [{ appendDimension: { sheetId: sheet.properties.sheetId, dimension: 'COLUMNS', length: neededCols - have } }] }
  });
}

async function ensureSheetExists(sheetName, headers) {
  const client = await getAuthedFetch();
  const metaUrl = `${SHEETS_API_BASE}/${SPREADSHEET_ID}?fields=sheets.properties.title`;
  const meta = await client.request({ url: metaUrl, method: 'GET' });
  const titles = (meta.data.sheets || []).map((s) => s.properties.title);
  if (titles.indexOf(sheetName) === -1) {
    await client.request({
      url: `${SHEETS_API_BASE}/${SPREADSHEET_ID}:batchUpdate`,
      method: 'POST',
      data: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
    });
    invalidateCache(sheetName);
  }
  const existingValues = await getSheetValues(sheetName);
  if (existingValues.length === 0) {
    await ensureGridColumns(sheetName, headers.length);
  const range = `${sheetName}!A1:${columnLetter(headers.length)}1`;
    await client.request({
      url: `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      method: 'PUT',
      data: { values: [headers] }
    });
    invalidateCache(sheetName);
  }
}

// Sheet'in baslik satirinda eksik olan (koda sonradan eklenmis, orn.
// OdemeDurumu gibi) sutun adlarini SONA ekler - mevcut sutunlarin sirasini
// hic degistirmez (kayma riski yok). Boylece kod yeni bir alan eklediginde
// kullanicinin Google Sheet'e elle gidip sutun eklemesine gerek kalmaz.
async function ensureHeaderColumns(sheetName, requiredHeaders) {
  const existing = await getHeaders(sheetName);
  const missing = requiredHeaders.filter((h) => existing.indexOf(h) === -1);
  if (missing.length === 0) return existing;
  const startCol = existing.length + 1;
  const endCol = existing.length + missing.length;
  await ensureGridColumns(sheetName, endCol);
  const range = `${sheetName}!${columnLetter(startCol)}1:${columnLetter(endCol)}1`;
  const client = await getAuthedFetch();
  const url = `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await client.request({ url, method: 'PUT', data: { values: [missing] } });
  invalidateCache(sheetName);
  return existing.concat(missing);
}

function columnLetter(n) {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Bir ID sutununda belirli bir degeri arayip, o satirin 1-index (baslik dahil)
// sheet satir numarasini dondurur - bulunamazsa -1. Code.gs'deki
// findRowIndexById_ ile ayni.
async function findRowIndex(sheetName, idColumnName, idValue) {
  const rows = await getSheetValues(sheetName);
  if (rows.length === 0) return -1;
  const idCol = rows[0].indexOf(idColumnName);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(idValue)) return i + 1;
  }
  return -1;
}

// Bir sheet'in Google'in kendi ICSEL sayisal sheetId'sini (isim degil)
// dondurur - batchUpdate (orn. satir silme) bunu ister, isim yetmez.
let sheetIdCache = null;
async function getSheetId(sheetName) {
  // Sekme sonradan (orn. otomatik olusturulan "Faturalar") eklenmis olabilir -
  // onbellekte yoksa bir kez taze okuyup tekrar deneriz.
  if (!sheetIdCache || sheetIdCache[sheetName] === undefined) {
    const client = await getAuthedFetch();
    const url = `${SHEETS_API_BASE}/${SPREADSHEET_ID}?fields=sheets.properties`;
    const res = await client.request({ url, method: 'GET' });
    sheetIdCache = {};
    (res.data.sheets || []).forEach((s) => { sheetIdCache[s.properties.title] = s.properties.sheetId; });
  }
  if (sheetIdCache[sheetName] === undefined) throw new Error(`"${sheetName}" adinda bir sekme bulunamadi - Google Sheet'te bu sekmeyi olusturmaniz gerekiyor.`);
  return sheetIdCache[sheetName];
}

// Belirli bir satiri (1-index, baslik dahil) TAMAMEN SILER (asagidaki
// satirlar yukari kayar) - updateRow'un aksine bos birakmaz.
async function deleteRow(sheetName, rowIndex1Based) {
  const sheetId = await getSheetId(sheetName);
  const client = await getAuthedFetch();
  const url = `${SHEETS_API_BASE}/${SPREADSHEET_ID}:batchUpdate`;
  await client.request({
    url, method: 'POST',
    data: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex1Based - 1, endIndex: rowIndex1Based } } }] }
  });
  invalidateCache(sheetName);
}

module.exports = { getSheetValues, getFirstSheetName, sheetToObjects, getHeaders, appendRow, updateRow, findRowIndex, columnLetter, invalidateCache, deleteRow, ensureHeaderColumns, ensureSheetExists, SPREADSHEET_ID };

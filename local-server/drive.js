// Google Drive'a dosya yukleme ve Sheet'i .xlsx olarak yedekleme - Code.gs'deki
// uploadFile_/uploadHandoverForm_/createBackup_ ile AYNI mantik.
//
// ONEMLI: Servis hesaplarinin Drive'da kendi depolama kotasi YOKTUR ("Service
// Accounts do not have storage quota" hatasi verir). Bu yuzden Drive
// islemleri icin servis hesabi DEGIL, SIZIN KENDI Google hesabiniza ait bir
// OAuth token kullanilir (bkz. oauthSetup.js - tek seferlik kurulum).
// Sheets islemleri (sheets.js) hala servis hesabini kullanmaya devam eder,
// bu SADECE Drive icin gecerlidir.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const sheets = require('./sheets');

const TOKEN_PATH = path.join(__dirname, 'oauth-token.json');
const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;

let cachedClient = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('Drive icin henuz yetkilendirme yapilmamis. Terminalde "node oauthSetup.js" calistirip README.md > "Drive icin OAuth kurulumu" adimlarini takip edin.');
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
  client.setCredentials(tokens);
  // Erisim tokeni suresi dolarsa google-auth-library otomatik yeniler
  // (refresh_token sayesinde) - burada yeni tokenlari diske geri yaziyoruz
  // ki bir sonraki calistirmada da gecerli kalsin.
  client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });
  cachedClient = client;
  return client;
}

function nowStamp(fmt) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  if (fmt === 'ddMMyyyy_HHmm') return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

// Drive API v3 - multipart upload ile bir dosyayi belirli bir klasore yukler,
// "herkes baglantiyla goruntuleyebilir" izniyle paylasir, dosyanin URL'ini dondurur.
async function uploadToFolder(folderId, filename, mimeType, buffer) {
  const client = await getClient();
  const boundary = '-------314159265358979323846';
  const metadata = { name: filename, parents: [folderId] };
  const multipartBody =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(multipartBody, 'utf8'),
    buffer,
    Buffer.from(closeDelim, 'utf8')
  ]);

  const uploadRes = await client.request({
    url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: bodyBuffer
  });
  const fileId = uploadRes.data.id;

  // "Baglantiya sahip herkes goruntuleyebilir" izni ver (Code.gs'deki
  // file.setSharing(ANYONE_WITH_LINK, VIEW) ile ayni).
  await client.request({
    url: `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    method: 'POST',
    data: { role: 'reader', type: 'anyone' }
  });

  return { fileId, url: `https://drive.google.com/file/d/${fileId}/view` };
}

// data: { assetId, filename, mimeType, base64, sheetName?, linkColumn? }
// sheetName/linkColumn opsiyonel - verilmezse eskisi gibi Envanter/FaturaLink
// kullanilir (geriye donuk uyumluluk). Ihtiyaclar (ProformaLink) gibi baska
// sheet/alanlar icin de AYNI mantik (tek paylasimli Drive klasoru, birden
// fazla dosya = virgulle ayrilmis URL listesi) kullanilabilsin diye
// parametrize edildi.
async function uploadFile(data) {
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('.env dosyasinda DRIVE_FOLDER_ID tanimli degil.');
  const sheetName = data.sheetName || 'Envanter';
  const linkColumn = data.linkColumn || 'FaturaLink';
  const buffer = Buffer.from(data.base64, 'base64');
  const finalName = `${data.assetId}_${data.filename}`;
  const { url } = await uploadToFolder(folderId, finalName, data.mimeType, buffer);

  if (data.assetId) {
    const rowIdx = await sheets.findRowIndex(sheetName, 'ID', data.assetId);
    if (rowIdx !== -1) {
      let headerRow = await sheets.getHeaders(sheetName);
      let col = headerRow.indexOf(linkColumn);
      if (col === -1) {
        // Hedef sheet'te bu baslik henuz yoksa (orn. Ihtiyaclar'a yeni
        // eklenen ProformaLink), sona otomatik ekleriz. ensureHeaderColumns'un
        // DONDURDUGU diziyi dogrudan kullaniyoruz - tekrar okuma yapmak,
        // kisa sureli onbellek/gecikme yuzunden henuz guncellenmemis eski
        // veriyi donup col'un yine -1 kalmasina (ve "Unable to parse range"
        // hatasina) yol acabiliyordu.
        headerRow = await sheets.ensureHeaderColumns(sheetName, [linkColumn]);
        col = headerRow.indexOf(linkColumn);
      }
      if (col === -1) throw new Error(`"${linkColumn}" sutunu "${sheetName}" sayfasina eklenemedi.`);
      // Mevcut degeri de ARTIK dogru (migrasyon sonrasi) sutun sayisiyla
      // tekrar okuyoruz - eski "rows" degiskeni baslik eklenmeden once
      // alinmis olabilir, satir uzunlugu yeni sutunu kapsamayabilirdi.
      const dataRows = await sheets.getSheetValues(sheetName);
      const existing = (dataRows[rowIdx - 1] || [])[col];
      const combined = existing ? existing + ', ' + url : url;
      const colLetter = sheets.columnLetter(col + 1);
      await client_updateCell(sheetName, `${colLetter}${rowIdx}`, combined);
      // Okuma onbellegi (5 sn) eski linkleri dondurmesin - aksi halde liste/kayit eski veriyi gorur ve yeni belge "kaybolur".
      sheets.invalidateCache(sheetName);
    }
  }
  return { url, message: 'Dosya yuklendi.' };
}

// data: { personelId, adSoyad, filename, mimeType, base64 }
async function uploadHandoverForm(data) {
  const folderId = process.env.TESLIM_FORM_FOLDER_ID;
  if (!folderId) throw new Error('.env dosyasinda TESLIM_FORM_FOLDER_ID tanimli degil.');
  const buffer = Buffer.from(data.base64, 'base64');
  const stamp = nowStamp('ddMMyyyy_HHmm');
  const safeName = String(data.adSoyad || 'Calisan').replace(/[^\p{L}\p{N}]+/gu, '_');
  const idPart = data.personelId || 'NOID';
  const extMatch = (data.filename || '').match(/\.[a-zA-Z0-9]+$/);
  const finalName = `${idPart}_${safeName}_${stamp}${extMatch ? extMatch[0] : ''}`;

  const { url } = await uploadToFolder(folderId, finalName, data.mimeType, buffer);
  return { url, filename: finalName, message: 'Teslim formu yuklendi.' };
}

// Google Sheet'i .xlsx olarak disa aktarip yedek klasorune kaydeder.
async function createBackup() {
  const folderId = process.env.BACKUP_FOLDER_ID || '1GsL-bBU_fuKU7eoJrVxhBYCcrKQoQTw5';
  const client = await getClient();
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheets.SPREADSHEET_ID}/export?format=xlsx`;
  const res = await client.request({ url: exportUrl, responseType: 'arraybuffer' });
  const buffer = Buffer.from(res.data);
  const filename = `${nowStamp()}_BT Varlik Yonetimi.xlsx`;
  await uploadToFolder(folderId, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer);
  return { message: 'Yedek olusturuldu: ' + filename, filename };
}

// Yardimci: tek hucre guncelleme (helpers.js'teki updateSingleCell ile ayni fikir,
// burada Drive modulunun kendi authed client'iyla).
async function client_updateCell(sheetName, cellA1, value) {
  const client = await getClient();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheets.SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!' + cellA1)}?valueInputOption=USER_ENTERED`;
  await client.request({ url, method: 'PUT', data: { values: [[value]] } });
}

// Teslim Formlari klasorundeki tum dosyalar: [{ name, url }]
async function listHandoverForms() {
  const folderId = process.env.TESLIM_FORM_FOLDER_ID;
  if (!folderId) throw new Error('.env dosyasinda TESLIM_FORM_FOLDER_ID tanimli degil.');
  const client = await getClient();
  const out = [];
  let pageToken = '';
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=1000${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await client.request({ url });
    (res.data.files || []).forEach((f) => out.push({ name: f.name, url: `https://drive.google.com/file/d/${f.id}/view` }));
    pageToken = res.data.nextPageToken || '';
  } while (pageToken);
  return out;
}

module.exports = { uploadFile, uploadHandoverForm, listHandoverForms, createBackup };

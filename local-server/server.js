// STS Envanter - YEREL SUNUCU
// Bu sunucu, Google Apps Script Web App'in yerini alir: React frontend ayni
// action-tabanli GET/POST sozlesmesiyle buraya baglanir, ama istekler Google'in
// sunucularina degil DOGRUDAN buraya (bilgisayariniza) gelir - Apps Script'in
// calisma-zamani gecikmesi tamamen ortadan kalkar, sadece Google Sheets API'ye
// yapilan (cok daha hizli) cagrilar kalir.
//
// NOT: Bu, buyuk bir tasima islemi - Code.gs'deki 1700+ satirlik mantik
// asama asama buraya port ediliyor. Su an SADECE asagida listelenen action'lar
// calisir; digerleri henuz Apps Script'te kaliyor demektir (frontend'in
// VITE_APPS_SCRIPT_URL'i degistirmeden once TUM action'lar port edilmis olmali).
// Guncel "hangi action tasindi" listesi icin README.md'ye bakin.
// override: true - Windows'ta sistem genelinde tanimli bir PORT (veya baska)
// ortam degiskeni varsa bile, BU .env dosyasindaki degeri ONCELIKLI kilar.
// Normalde dotenv zaten var olan process.env degerlerini EZMEZ - bu da
// "kodda 8787 yaziyor ama .env de 8787 diyor, sunucu yine de farkli bir
// porta acildi" gibi kafa karistirici durumlara yol acabiliyordu.
require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const sheets = require('./sheets');
const helpers = require('./helpers');
const rates = require('./rates');
const hrSync = require('./hrSync');
const drive = require('./drive');

const app = express();
app.use(cors());
app.use(express.text({ type: '*/*', limit: '25mb' })); // frontend text/plain ile JSON govde gonderiyor - dosya yuklemeleri buyuk olabilir

const PORT = process.env.PORT || 8787;
const APP_TOKEN = process.env.APP_TOKEN || '';
const SN = helpers.SHEET_NAMES;

function checkAuth(token) {
  if (!APP_TOKEN) return true; // .env'de token tanimlanmamissa auth atlanir (sadece yerel gelistirme icin)
  return token === APP_TOKEN;
}

function jsonOut(res, data, status = 200) {
  res.status(status).json(data);
}

function notPorted(res, action) {
  return jsonOut(res, { error: `Bu action henuz yerel sunucuya tasinmadi: "${action}". Apps Script uzerinden calismaya devam ediyor olmali - VITE_APPS_SCRIPT_URL'i henuz degistirmediyseniz bu otomatik olarak Apps Script'e gider.` }, 501);
}

// Listeler.jsx'in dropdown'lari icin: Listeler sheet'indeki her sutunu
// {SutunAdi: [deger1, deger2, ...]} seklinde dondurur (Code.gs'deki getLists_ ile ayni).
async function getLists() {
  const rows = await sheets.getSheetValues(SN.LISTELER);
  if (rows.length === 0) return {};
  const headers = rows[0];
  const result = {};
  headers.forEach((h, colIdx) => {
    if (!h) return;
    const values = [];
    for (let r = 1; r < rows.length; r++) {
      const v = rows[r][colIdx];
      if (v !== undefined && v !== null && v !== '') values.push(v);
    }
    result[h] = values;
  });
  return result;
}

// Code.gs'deki getDashboard_ ile ayni mantik.
async function getDashboard() {
  const items = await rates.enrichWithUsd(await sheets.sheetToObjects(SN.ENVANTER));
  const byDurum = {}, byKategori = {}, byLokasyon = {}, valueByCurrency = {};
  let totalUSD = 0, totalTRY = 0, totalRUB = 0, warrantyExpiringSoon = 0;
  const today = new Date();
  const in30 = new Date();
  in30.setDate(today.getDate() + 30);

  items.forEach((a) => {
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

  const needs = await sheets.sheetToObjects(SN.IHTIYACLAR);
  const sarf = await sheets.sheetToObjects(SN.SARF);

  return {
    total: items.length, byDurum, byKategori, byLokasyon, valueByCurrency,
    totalUSD: Math.round(totalUSD * 100) / 100,
    totalTRY: Math.round(totalTRY * 100) / 100,
    totalRUB: Math.round(totalRUB * 100) / 100,
    warrantyExpiringSoon,
    pendingNeeds: needs.filter((n) => n.Durum === 'Bekleniyor' || n.Durum === 'Onaylandi').length,
    lowStockCount: sarf.filter((m) => Number(m.Stok || 0) <= Number(m.MinStok || 0)).length
  };
}

// =================== GET ===================
app.get('/', async (req, res) => {
  const action = req.query.action;
  const token = req.query.token;

  try {
    // "publicAsset" QR koduyla herkesin erisebilecegi bir sayfa - token GEREKMEZ,
    // kendi PUBLIC_QR_CODE kontrolu var (Code.gs'deki doGet'teki gibi, checkAuth_'tan ONCE devredilir).
    if (action === 'publicAsset') {
      return jsonOut(res, await helpers.getPublicAsset(req.query.id, req.query.code));
    }
    // Ekipman Talep Formu girisi - APP_TOKEN degil, calisanin KENDI Talep
    // Sifresi ile dogrulanir. Herkese acik (genel link).
    if (action === 'talepLogin') {
      const result = await helpers.verifyTalepSifresi(req.query.sifre);
      if (!result) return jsonOut(res, { error: 'Sifre hatali.' }, 401);
      return jsonOut(res, result);
    }

    if (!checkAuth(token)) return jsonOut(res, { error: 'Yetkisiz erisim.' }, 401);

    switch (action) {
      case 'inventory':
        return jsonOut(res, await rates.enrichWithUsd(await sheets.sheetToObjects(SN.ENVANTER)));
      case 'employees':
        return jsonOut(res, await sheets.sheetToObjects(SN.CALISANLAR));
      case 'movements':
        return jsonOut(res, await sheets.sheetToObjects(SN.HAREKETLER));
      case 'lists':
        return jsonOut(res, await getLists());
      case 'needs':
        return jsonOut(res, await sheets.sheetToObjects(SN.IHTIYACLAR));
      case 'sarfMalzemeleri':
        return jsonOut(res, await helpers.getSarfMalzemeleri());
      case 'sarfHareketleri':
        return jsonOut(res, await sheets.sheetToObjects(SN.SARF_HAREKETLERI));
      case 'sarfSiparisleri':
        return jsonOut(res, await helpers.getSarfSiparisleri());
      case 'assetSarfCost':
        return jsonOut(res, await helpers.getAssetSarfCost(req.query.id));
      case 'faturalar':
        return jsonOut(res, await helpers.getFaturalar());
      case 'suggestFaturaGroups':
        return jsonOut(res, await helpers.suggestFaturaGroups());
      case 'gunluk':
      case 'logs':
        return jsonOut(res, await sheets.sheetToObjects(SN.GUNLUK));
      case 'dashboard':
        return jsonOut(res, await getDashboard());
      case 'currentRates': {
        const today = new Date().toISOString().slice(0, 10);
        return jsonOut(res, (await rates.getTcmbRates(today)) || {});
      }
      case 'exchangeRateForExport': {
        const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
        return jsonOut(res, await rates.getAndLogExchangeRate(dateStr));
      }
      case 'previewHRSync':
        return jsonOut(res, await hrSync.previewHRSync());
      case 'personelTalepleri':
        return jsonOut(res, await helpers.getPersonelTalepleri());
      case 'networkRows':
        return jsonOut(res, await helpers.getNetworkRows(req.query.table));
      default:
        return notPorted(res, action);
    }
  } catch (err) {
    console.error(err);
    return jsonOut(res, { error: err.message || String(err) }, 500);
  }
});

// =================== POST ===================
app.post('/', async (req, res) => {
  let body;
  try {
    body = JSON.parse(req.body);
  } catch (e) {
    return jsonOut(res, { error: 'Gecersiz istek govdesi.' }, 400);
  }
  const { action, data, token, user, id } = body;

  try {
    // Ekipman Talep Formu gonderimi - APP_TOKEN degil, gonderen kisinin Talep
    // Sifresi'yle (data.sifre) dogrulanir. Herkese acik (genel link).
    if (action === 'talepGonder') {
      const employee = await helpers.verifyTalepSifresi(data.sifre);
      if (!employee) return jsonOut(res, { error: 'Sifre hatali.' }, 401);
      return jsonOut(res, await helpers.createPersonelTalepleri(employee.AdSoyad, employee.Departman, data.items));
    }

    if (!checkAuth(token)) return jsonOut(res, { error: 'Yetkisiz erisim.' }, 401);

    switch (action) {
      case 'createAsset':
        return jsonOut(res, await helpers.createAsset(data, user));
      case 'updateAsset':
        return jsonOut(res, await helpers.updateAsset(id, data, user));
      case 'assignAsset':
        return jsonOut(res, await helpers.updateAsset(data.VarlikID, {
          AtananKisi: data.YeniKullanici, Durum: data.YeniDurum, Lokasyon: data.YeniLokasyon, Aciklama: data.Aciklama
        }, user));
      case 'createEmployee':
        return jsonOut(res, await helpers.createEmployee(data));
      case 'updateEmployee':
        return jsonOut(res, await helpers.updateEmployee(id, data));
      case 'createNeed':
        return jsonOut(res, await helpers.createNeed(data, rates));
      case 'updateNeed':
        return jsonOut(res, await helpers.updateNeed(id, data, rates));
      case 'addListItem':
        return jsonOut(res, await helpers.addListItem(data.listName, data.value));
      case 'removeListItem':
        return jsonOut(res, await helpers.removeListItem(data.listName, data.value));
      case 'fulfillNeed':
        return jsonOut(res, await helpers.fulfillNeed(id, data.assetId, user));
      case 'fulfillNeedAsNewAsset':
        return jsonOut(res, await helpers.fulfillNeedAsNewAsset(id, user));
      case 'fulfillNeedAsSarfStock':
        return jsonOut(res, await helpers.fulfillNeedAsSarfStock(id, user));
      case 'createSarfMalzeme':
        return jsonOut(res, await helpers.createSarfMalzeme(data));
      case 'updateSarfMalzeme':
        return jsonOut(res, await helpers.updateSarfMalzeme(id, data));
      case 'sarfHareket':
        return jsonOut(res, await helpers.sarfHareket(data, user));
      case 'createSarfSiparis':
        return jsonOut(res, await helpers.createSarfSiparis(data, rates));
      case 'updateSarfSiparis':
        return jsonOut(res, await helpers.updateSarfSiparis(id, data, rates));
      case 'fulfillSarfSiparis':
        return jsonOut(res, await helpers.fulfillSarfSiparis(id, user));
      case 'createFatura':
        return jsonOut(res, await helpers.createFatura(data.fatura, data.needIds, data.sarfIds));
      case 'updateFatura':
        return jsonOut(res, await helpers.updateFatura(id, data.fatura, data.needIds, data.sarfIds));
      case 'deleteFatura':
        return jsonOut(res, await helpers.deleteFatura(id));
      case 'linkFatura':
        return jsonOut(res, await helpers.linkFatura(id, data.needIds, data.sarfIds));
      case 'unlinkFatura':
        return jsonOut(res, await helpers.unlinkFatura(data.needIds, data.sarfIds));
      case 'createFaturalarFromGroups':
        return jsonOut(res, await helpers.createFaturalarFromGroups(data.groups));
      case 'reddetPersonelTalep':
        return jsonOut(res, await helpers.updatePersonelTalepDurum(id, 'Reddedildi'));
      case 'onaylaPersonelTalep':
        return jsonOut(res, await helpers.updatePersonelTalepDurum(id, 'Onaylandi'));
      case 'createNetworkRow':
        return jsonOut(res, await helpers.createNetworkRow(data.table, data.row));
      case 'updateNetworkRow':
        return jsonOut(res, await helpers.updateNetworkRow(data.table, id, data.row));
      case 'deleteNetworkRow':
        return jsonOut(res, await helpers.deleteNetworkRow(data.table, id));
      case 'nextTeslimFormNo':
        return jsonOut(res, await helpers.nextTeslimFormNo());
      case 'generateMissingTalepSifreleri':
        return jsonOut(res, await helpers.generateMissingTalepSifreleri());
      case 'applyHRSync':
        return jsonOut(res, await hrSync.applyHRSync(data.items, user));
      case 'importAssets':
        return jsonOut(res, await helpers.importAssets(data.rows, user));
      case 'importEmployees':
        return jsonOut(res, await helpers.importEmployees(data.rows));
      case 'importNeeds':
        return jsonOut(res, await helpers.importNeeds(data.rows, rates));
      case 'logAuditSummary':
        await helpers.logAction(user, 'Fiziksel Sayim Tamamlandi', `Toplam: ${data.toplam}, Bulunan: ${data.bulunan}, Bulunamayan: ${data.bulunamayan}`);
        return jsonOut(res, { message: 'Sayim ozeti kaydedildi.' });
      case 'uploadFile':
        return jsonOut(res, await drive.uploadFile(data));
      case 'uploadHandoverForm': {
        const up = await drive.uploadHandoverForm(data);
        // Formun linkini calisanin kaydina da yaz (Calisan sayfasi/Panel/Rapor gostersin).
        try { await helpers.addEmployeeTeslimFormLinks({ personelId: data.personelId, adSoyad: data.adSoyad }, [up.url]); }
        catch (linkErr) { console.error('Teslim formu linki calisan kaydina yazilamadi:', linkErr.message); }
        return jsonOut(res, up);
      }
      case 'syncTeslimFormLinks':
        return jsonOut(res, await helpers.syncTeslimFormLinks(await drive.listHandoverForms()));
      case 'createBackup':
        return jsonOut(res, await drive.createBackup());
      default:
        return notPorted(res, action);
    }
  } catch (err) {
    console.error(err);
    return jsonOut(res, { error: err.message || String(err) }, 500);
  }
});

app.listen(PORT, () => {
  console.log(`\nSTS Envanter yerel sunucusu calisiyor: http://localhost:${PORT}`);
  console.log(`Spreadsheet ID: ${sheets.SPREADSHEET_ID}`);
  if (APP_TOKEN) {
    const masked = APP_TOKEN.length > 6
      ? `${APP_TOKEN.slice(0, 3)}...${APP_TOKEN.slice(-3)} (uzunluk: ${APP_TOKEN.length})`
      : `${APP_TOKEN} (uzunluk: ${APP_TOKEN.length})`;
    console.log(`Token korumasi AKTIF. Yuklenen APP_TOKEN: ${masked}`);
  } else {
    console.log('UYARI: .env dosyasinda APP_TOKEN tanimli degil, herkes erisebilir (sadece yerel test icin uygundur).');
  }
});

import { enqueue, cacheGet, cacheSet, isNetworkError } from './offlineQueue.js';

// Apps Script Web App URL'niz - deploy ettikten sonra buraya yapıştırın
// veya .env dosyası ile VITE_APPS_SCRIPT_URL olarak verin.
const BASE_URL = import.meta.env.VITE_APPS_SCRIPT_URL || 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

// Bu GET action'larinin sonucu, internet yokken kullanilabilmesi icin localStorage'a
// otomatik onbelleklenir (formlarin acilir listelerinin calismasi icin gerekli).
const CACHEABLE_ACTIONS = ['inventory', 'employees', 'lists', 'needs', 'movements', 'dashboard'];

function getToken() {
  return sessionStorage.getItem('envanter_token') || '';
}

export function setToken(token) {
  sessionStorage.setItem('envanter_token', token);
}

export function clearToken() {
  sessionStorage.removeItem('envanter_token');
}

async function get(action, params = {}) {
  const cacheable = CACHEABLE_ACTIONS.includes(action);
  try {
    const url = new URL(BASE_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('token', getToken());
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    if (cacheable) cacheSet(action, json);
    return json;
  } catch (err) {
    if (cacheable && isNetworkError(err)) {
      const cached = cacheGet(action);
      if (cached) return cached.data;
    }
    if (isNetworkError(err)) {
      throw new Error('Bu islem icin internet baglantisi gerekiyor. Baglanti saglaninca tekrar deneyin.');
    }
    throw err;
  }
}

// Public (auth gerektirmeyen) GET - token olmadan da calisir
async function getPublic(action, params = {}) {
  const url = new URL(BASE_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { cache: 'no-store' });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function post(action, data = {}, user = '') {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data, token: getToken(), user, id: data.id })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function postRaw(body) {
  let res;
  try {
    res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: getToken() })
    });
  } catch (err) {
    if (isNetworkError(err)) {
      throw new Error('Bu islem icin internet baglantisi gerekiyor. Baglanti saglaninca tekrar deneyin.');
    }
    throw err;
  }
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

// Internet yokken "olustur" turu bir istek atilirsa, hatayi kullaniciya firlatmak yerine
// kuyruga ekler ve "cevrimdisi kaydedildi" seklinde basarili bir yanit doner.
async function createWithOfflineQueue(action, queueType, data, user) {
  try {
    return await post(action, data, user);
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueue(queueType, data, user);
      return { queued: true, message: 'Internet yok - cevrimdisi kaydedildi, baglanti gelince otomatik gonderilecek.' };
    }
    throw err;
  }
}

export const api = {
  getInventory: () => get('inventory'),
  getEmployees: () => get('employees'),
  getMovements: () => get('movements'),
  getLists: () => get('lists'),
  getCurrentRates: () => get('currentRates'),
  getAndLogExchangeRate: (date) => get('exchangeRateForExport', { date }),
  getDashboard: () => get('dashboard'),
  getPublicAsset: (id, code) => getPublic('publicAsset', code ? { id, code } : { id }),
  talepLogin: (sifre) => getPublic('talepLogin', { sifre }),
  talepGonder: (sifre, items) => post('talepGonder', { sifre, items }),
  getPersonelTalepleri: () => get('personelTalepleri'),
  getNetworkRows: (table) => get('networkRows', { table }),
  createNetworkRow: (table, row) => post('createNetworkRow', { table, row }),
  updateNetworkRow: (table, id, row) => postRaw({ action: 'updateNetworkRow', id, data: { table, row } }),
  deleteNetworkRow: (table, id) => postRaw({ action: 'deleteNetworkRow', id, data: { table } }),
  onaylaPersonelTalep: (id) => postRaw({ action: 'onaylaPersonelTalep', id }),
  reddetPersonelTalep: (id) => postRaw({ action: 'reddetPersonelTalep', id }),

  createAsset: (data, user) => createWithOfflineQueue('createAsset', 'createAsset', data, user),
  updateAsset: (id, data, user) => postRaw({ action: 'updateAsset', id, data, user }),
  createEmployee: (data) => createWithOfflineQueue('createEmployee', 'createEmployee', data),
  updateEmployee: (originalName, data) => postRaw({ action: 'updateEmployee', id: originalName, data }),
  uploadFile: (payload) => postRaw({ action: 'uploadFile', data: payload }),
  syncTeslimFormLinks: () => postRaw({ action: 'syncTeslimFormLinks', data: {} }),
  uploadHandoverForm: (payload) => postRaw({ action: 'uploadHandoverForm', data: payload }),

  addListItem: (listName, value) => post('addListItem', { listName, value }),
  removeListItem: (listName, value) => post('removeListItem', { listName, value }),

  importAssets: (rows, user) => post('importAssets', { rows }, user),
  importEmployees: (rows) => post('importEmployees', { rows }),
  sendReportNow: () => post('sendReportNow', {}),

  getNeeds: () => get('needs'),
  createNeed: (data) => createWithOfflineQueue('createNeed', 'createNeed', data),
  updateNeed: (id, data) => postRaw({ action: 'updateNeed', id, data }),
  fulfillNeed: (id, assetId, user) => postRaw({ action: 'fulfillNeed', id, data: { assetId }, user }),
  fulfillNeedAsNewAsset: (id, user) => postRaw({ action: 'fulfillNeedAsNewAsset', id, data: {}, user }),
  fulfillNeedAsSarfStock: (id, user, ad) => postRaw({ action: 'fulfillNeedAsSarfStock', id, data: { ad }, user }),
  importNeeds: (rows) => post('importNeeds', { rows }),
  previewHRSync: () => get('previewHRSync'),
  applyHRSync: (items, user) => post('applyHRSync', { items }, user),
  logAuditSummary: (data, user) => post('logAuditSummary', data, user),
  nextTeslimFormNo: () => post('nextTeslimFormNo', {}),
  generateMissingTalepSifreleri: () => post('generateMissingTalepSifreleri', {}),
  createBackup: (user) => post('createBackup', {}, user),
  getSarfMalzemeleri: () => get('sarfMalzemeleri'),
  getSarfHareketleri: () => get('sarfHareketleri'),
  getAssetSarfCost: (id) => get('assetSarfCost', { id }),
  createSarfMalzeme: (data) => post('createSarfMalzeme', data),
  updateSarfMalzeme: (id, data) => postRaw({ action: 'updateSarfMalzeme', id, data }),
  sarfHareket: (data, user) => post('sarfHareket', data, user),
  getSarfSiparisleri: () => get('sarfSiparisleri'),
  createSarfSiparis: (data) => post('createSarfSiparis', data),
  updateSarfSiparis: (id, data) => postRaw({ action: 'updateSarfSiparis', id, data }),
  fulfillSarfSiparis: (id, user) => postRaw({ action: 'fulfillSarfSiparis', id, data: {}, user }),
  getFaturalar: () => get('faturalar'),
  suggestFaturaGroups: () => get('suggestFaturaGroups'),
  createFatura: (fatura, needIds, sarfIds) => postRaw({ action: 'createFatura', data: { fatura, needIds, sarfIds } }),
  updateFatura: (id, fatura, needIds, sarfIds) => postRaw({ action: 'updateFatura', id, data: { fatura, needIds, sarfIds } }),
  deleteFatura: (id) => postRaw({ action: 'deleteFatura', id, data: {} }),
  linkFatura: (id, needIds, sarfIds) => postRaw({ action: 'linkFatura', id, data: { needIds, sarfIds } }),
  unlinkFatura: (needIds, sarfIds) => postRaw({ action: 'unlinkFatura', data: { needIds, sarfIds } }),
  createFaturalarFromGroups: (groups) => postRaw({ action: 'createFaturalarFromGroups', data: { groups } }),
  getLogs: () => get('logs'),

  checkToken: async (token) => {
    const url = new URL(BASE_URL);
    url.searchParams.set('action', 'lists');
    url.searchParams.set('token', token);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const json = await res.json();
    return !json.error;
  }
};

// offlineQueue.js'in kuyruktaki islemleri gonderirken kullanacagi gercek (kuyruksuz) fonksiyonlar.
// Not: burada api.createAsset degil, dogrudan post() kullaniyoruz - yoksa senkronizasyon
// sirasinda tekrar hata alinirsa sonsuz kuyruklama donguleri olusabilir.
export const syncHandlers = {
  createAsset: (data, user) => post('createAsset', data, user),
  createEmployee: (data) => post('createEmployee', data),
  createNeed: (data) => post('createNeed', data)
};

export { BASE_URL };

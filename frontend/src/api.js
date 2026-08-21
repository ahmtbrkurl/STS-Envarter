// Apps Script Web App URL'niz - deploy ettikten sonra buraya yapıştırın
// veya .env dosyası ile VITE_APPS_SCRIPT_URL olarak verin.
const BASE_URL = import.meta.env.VITE_APPS_SCRIPT_URL || 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

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
  const url = new URL(BASE_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('token', getToken());
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

// Public (auth gerektirmeyen) GET - token olmadan da calisir
async function getPublic(action, params = {}) {
  const url = new URL(BASE_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function post(action, data = {}, user = '') {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Apps Script preflight sorunlarini onlemek icin
    body: JSON.stringify({ action, data, token: getToken(), user, id: data.id })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

export const api = {
  getInventory: () => get('inventory'),
  getEmployees: () => get('employees'),
  getMovements: () => get('movements'),
  getLists: () => get('lists'),
  getDashboard: () => get('dashboard'),
  getPublicAsset: (id) => getPublic('publicAsset', { id }),

  createAsset: (data, user) => post('createAsset', data, user),
  updateAsset: (id, data, user) =>
    fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'updateAsset', id, data, token: getToken(), user })
    }).then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error); return j; }),
  createEmployee: (data) => post('createEmployee', data),
  uploadFile: (payload) =>
    fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'uploadFile', data: payload, token: getToken() })
    }).then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error); return j; }),

  checkToken: async (token) => {
    const url = new URL(BASE_URL);
    url.searchParams.set('action', 'lists');
    url.searchParams.set('token', token);
    const res = await fetch(url.toString());
    const json = await res.json();
    return !json.error;
  }
};

export { BASE_URL };

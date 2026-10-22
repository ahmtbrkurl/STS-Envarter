import * as fsStore from './fsQueueStore.js';

const QUEUE_KEY = 'envanter_offline_queue';
const CACHE_PREFIX = 'envanter_cache_';

let folderHandle = null; // aktif klasor - secildiyse/onaylandiysa dolu olur

function uid() {
  return 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function notifyChanged() {
  window.dispatchEvent(new CustomEvent('offline-queue-changed'));
}

// ============ Baslangicta cagrilir: daha once secilmis klasore izin hala varsa kullan ============
export async function initFolderBackend() {
  folderHandle = await fsStore.getVerifiedHandle();
  return folderHandle;
}

export function isFolderSupported() {
  return fsStore.isSupported();
}

export function hasFolderBackend() {
  return !!folderHandle;
}

export function folderName() {
  return folderHandle?.name || '';
}

export async function hasStoredButUnverifiedFolder() {
  if (folderHandle) return false;
  return await fsStore.hasStoredHandle();
}

export async function pickQueueFolder() {
  folderHandle = await fsStore.pickFolder();
  notifyChanged();
  return folderHandle;
}

export async function confirmFolderAccess() {
  folderHandle = await fsStore.requestPermissionForStoredHandle();
  notifyChanged();
  return folderHandle;
}

// ============ Tarayici depolamasi (varsayilan / yedek) ============
function getLocalQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notifyChanged();
}

// ============ Ortak kuyruk API'si (klasor veya tarayici - hangisi aktifse) ============
export async function getQueue() {
  if (folderHandle) {
    try {
      return await fsStore.listItems(folderHandle);
    } catch {
      return getLocalQueue();
    }
  }
  return getLocalQueue();
}

export async function enqueue(type, payload, user) {
  const item = { id: uid(), type, payload, user, timestamp: new Date().toISOString(), status: 'pending' };
  if (folderHandle) {
    await fsStore.writeItem(folderHandle, `${item.id}.json`, item);
  } else {
    const queue = getLocalQueue();
    queue.push(item);
    saveLocalQueue(queue);
    return;
  }
  notifyChanged();
}

export async function removeFromQueue(id) {
  if (folderHandle) {
    await fsStore.deleteItem(folderHandle, `${id}.json`);
  } else {
    saveLocalQueue(getLocalQueue().filter((q) => q.id !== id));
  }
  notifyChanged();
}

async function updateStatus(id, patch) {
  if (folderHandle) {
    const items = await fsStore.listItems(folderHandle);
    const item = items.find((i) => i.id === id);
    if (item) {
      const updated = { ...item, ...patch };
      delete updated.filename;
      await fsStore.writeItem(folderHandle, `${id}.json`, updated);
    }
  } else {
    const queue = getLocalQueue();
    const idx = queue.findIndex((q) => q.id === id);
    if (idx !== -1) {
      queue[idx] = { ...queue[idx], ...patch };
      saveLocalQueue(queue);
      return;
    }
  }
  notifyChanged();
}

export async function clearFailedFromQueue() {
  const queue = await getQueue();
  const failed = queue.filter((q) => q.status === 'error');
  for (const item of failed) {
    await removeFromQueue(item.id);
  }
}

// api.js dairesel importu onlemek icin fonksiyonlari disaridan alir.
export async function processQueue(handlers) {
  const queue = await getQueue();
  const pending = queue.filter((q) => q.status !== 'syncing');
  let successCount = 0;
  let errorCount = 0;

  for (const item of pending) {
    await updateStatus(item.id, { status: 'syncing' });
    try {
      const handler = handlers[item.type];
      if (!handler) throw new Error('Bilinmeyen islem turu: ' + item.type);
      await handler(item.payload, item.user);
      await removeFromQueue(item.id);
      successCount++;
    } catch (err) {
      await updateStatus(item.id, { status: 'error', errorMsg: err.message });
      errorCount++;
    }
  }

  return { successCount, errorCount };
}

// ============ Cevrimdisi okuma icin basit onbellek (her zaman tarayici depolamasi) ============
export function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, cachedAt: new Date().toISOString() }));
  } catch {
    // depolama dolu olabilir, sessizce yok say
  }
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Fetch/network hatasi mi yoksa API'nin dondurdugu gercek bir hata mi ayirt eder.
export function isNetworkError(err) {
  return err instanceof TypeError || /Failed to fetch|NetworkError|network/i.test(err.message || '');
}

// Modern tarayicilarda (Chrome/Edge) File System Access API ile kullanicinin
// sectigi bir yerel klasore dogrudan dosya yazip okuyabiliriz. Bu sayede
// cevrimdisi kuyruk, tarayici depolamasi yerine gercek, gorulebilir dosyalar
// olarak kullanicinin sectigi klasorde durur (istenirse Google Drive ile
// senkronize olan bir klasor bile secilebilir).

const DB_NAME = 'envanter_fs_store';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'queueDir';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDirHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export function isSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// Kullanicidan bir klasor sectirir (bir tiklama/gesture gerektirir).
export async function pickFolder() {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await saveDirHandle(handle);
  return handle;
}

// Sayfa yeniden acildiginda daha once secilmis klasore izin hala varsa sessizce dondurur.
export async function getVerifiedHandle() {
  if (!isSupported()) return null;
  try {
    const handle = await loadDirHandle();
    if (!handle) return null;
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    return perm === 'granted' ? handle : null;
  } catch {
    return null;
  }
}

// Izin "prompt" durumundaysa (tarayici guvenlik geregi periyodik olarak sorar),
// kullanicinin tiklamasiyla tekrar izin ister.
export async function requestPermissionForStoredHandle() {
  const handle = await loadDirHandle();
  if (!handle) return null;
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  return perm === 'granted' ? handle : null;
}

export async function hasStoredHandle() {
  return !!(await loadDirHandle());
}

export async function writeItem(dirHandle, filename, data) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function deleteItem(dirHandle, filename) {
  try {
    await dirHandle.removeEntry(filename);
  } catch {
    // dosya zaten yoksa sorun degil
  }
}

export async function listItems(dirHandle) {
  const items = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file' && name.endsWith('.json')) {
      try {
        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        items.push({ ...data, filename: name });
      } catch {
        // bozuk/okunamayan dosyayi atla
      }
    }
  }
  items.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  return items;
}

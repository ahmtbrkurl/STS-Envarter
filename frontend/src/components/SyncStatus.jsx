import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import {
  getQueue, processQueue, removeFromQueue, clearFailedFromQueue,
  initFolderBackend, isFolderSupported, hasFolderBackend, folderName,
  hasStoredButUnverifiedFolder, pickQueueFolder, confirmFolderAccess
} from '../offlineQueue.js';
import { syncHandlers } from '../api.js';
import { useLang } from '../i18n.jsx';

export default function SyncStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [folderReady, setFolderReady] = useState(false);
  const [needsReconfirm, setNeedsReconfirm] = useState(false);
  const { t } = useLang();

  async function refreshQueue() {
    setQueue(await getQueue());
  }

  useEffect(() => {
    (async () => {
      await initFolderBackend();
      setFolderReady(hasFolderBackend());
      setNeedsReconfirm(!hasFolderBackend() && await hasStoredButUnverifiedFolder());
      refreshQueue();
    })();

    function goOnline() { setOnline(true); sync(); }
    function goOffline() { setOnline(false); }

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('offline-queue-changed', refreshQueue);

    const interval = setInterval(() => {
      if (navigator.onLine) sync();
    }, 30000);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('offline-queue-changed', refreshQueue);
      clearInterval(interval);
    };
  }, []);

  async function sync() {
    const current = await getQueue();
    if (current.length === 0) return;
    setSyncing(true);
    try {
      await processQueue(syncHandlers);
    } finally {
      setSyncing(false);
      refreshQueue();
    }
  }

  async function handlePickFolder() {
    try {
      await pickQueueFolder();
      setFolderReady(true);
      setNeedsReconfirm(false);
      refreshQueue();
    } catch {
      // kullanici klasor secimini iptal etti
    }
  }

  async function handleReconfirm() {
    const handle = await confirmFolderAccess();
    if (handle) {
      setFolderReady(true);
      setNeedsReconfirm(false);
      refreshQueue();
    }
  }

  const pendingCount = queue.filter((q) => q.status !== 'error').length;
  const errorCount = queue.filter((q) => q.status === 'error').length;

  return (
    <>
      <button
        className="sync-status-btn no-print"
        onClick={() => setShowDetail(true)}
        title={online ? t('sync_online') : t('sync_offline')}
      >
        <span className={`sync-dot ${online ? 'online' : 'offline'}`} />
        {online ? t('sync_online') : t('sync_offline')}
        {queue.length > 0 && <span className="sync-badge">{queue.length}</span>}
      </button>

      {showDetail && (
        <Modal
          title={t('sync_queue_title')}
          onClose={() => setShowDetail(false)}
          actions={
            <>
              {errorCount > 0 && <button className="btn btn-ghost" onClick={() => clearFailedFromQueue().then(refreshQueue)}>{t('sync_clear_failed')}</button>}
              <button className="btn btn-ghost" onClick={() => setShowDetail(false)}>{t('btn_cancel')}</button>
              <button className="btn btn-primary" onClick={sync} disabled={!online || syncing || pendingCount === 0}>
                {syncing ? '...' : t('sync_now')}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
            {online ? t('sync_desc_online') : t('sync_desc_offline')}
          </p>

          <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--bg)' }}>
            <div className="section-title" style={{ marginTop: 0 }}>{t('sync_storage_title')}</div>
            {isFolderSupported() ? (
              folderReady ? (
                <div style={{ fontSize: 13 }}>📁 <strong>{folderName() || t('sync_folder_active')}</strong> — {t('sync_folder_desc')}</div>
              ) : needsReconfirm ? (
                <div>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>{t('sync_folder_reconfirm_desc')}</div>
                  <button className="btn btn-primary btn-sm" onClick={handleReconfirm}>{t('sync_folder_reconfirm')}</button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>{t('sync_folder_pick_desc')}</div>
                  <button className="btn btn-primary btn-sm" onClick={handlePickFolder}>📁 {t('sync_folder_pick')}</button>
                </div>
              )
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{t('sync_folder_not_supported')}</div>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="empty-state">{t('sync_no_pending')}</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {queue.map((q) => (
                <div key={q.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{queueTypeLabel(q.type, t)}</strong>
                    <span className={`badge ${q.status === 'error' ? 'badge-red' : q.status === 'syncing' ? 'badge-amber' : 'badge-gray'}`}>
                      {q.status === 'error' ? t('sync_status_error') : q.status === 'syncing' ? t('sync_status_syncing') : t('sync_status_pending')}
                    </span>
                  </div>
                  <div className="page-sub" style={{ marginTop: 3 }}>
                    {summarize(q)}
                  </div>
                  {q.errorMsg && <div className="error-text" style={{ marginTop: 3 }}>{q.errorMsg}</div>}
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => removeFromQueue(q.id).then(refreshQueue)}>
                    {t('btn_delete')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function queueTypeLabel(type, t) {
  const map = { createAsset: t('nav_inventory'), createEmployee: t('nav_employees'), createNeed: t('nav_needs') };
  return map[type] || type;
}

function summarize(q) {
  if (q.type === 'createAsset') return `${q.payload.Kategori || ''} ${q.payload.Marka || ''} ${q.payload.Model || ''}`;
  if (q.type === 'createEmployee') return q.payload.AdSoyad || '';
  if (q.type === 'createNeed') return `${q.payload.PersonelAdi || ''} · ${q.payload.Kategori || ''}`;
  return '';
}

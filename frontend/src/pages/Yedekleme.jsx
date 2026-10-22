import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLang } from '../i18n.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Yedekleme() {
  const { t } = useLang();
  const { userName } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.getLogs().then(setLogs).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const backupLogs = logs.filter((l) => l.Islem === 'Yedek Alindi').slice(-10).reverse();

  async function handleBackup() {
    setBackingUp(true);
    setError('');
    setResult(null);
    try {
      const res = await api.createBackup(userName);
      setResult(res.filename);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBackingUp(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('backup_title')}</div>
          <div className="page-sub">{t('backup_sub')}</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16, textAlign: 'center', padding: '32px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>💾</div>
        <p className="page-sub" style={{ marginBottom: 18 }}>{t('backup_desc')}</p>
        <button className="btn btn-primary" onClick={handleBackup} disabled={backingUp}>
          {backingUp ? '...' : `💾 ${t('backup_now')}`}
        </button>
        {result && <div style={{ marginTop: 14, color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>✓ {t('backup_success')}: {result}</div>}
        {error && <div className="error-text" style={{ marginTop: 14 }}>{error}</div>}
      </div>

      <div className="card card-pad">
        <div className="section-title" style={{ marginTop: 0 }}>{t('backup_auto_title')}</div>
        <p className="page-sub" style={{ marginBottom: 16 }}>{t('backup_auto_desc')}</p>

        <div className="section-title">{t('backup_history')}</div>
        {loading && <div className="spinner" />}
        {!loading && backupLogs.length === 0 && <div className="empty-state">{t('backup_no_history')}</div>}
        {!loading && backupLogs.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {backupLogs.map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span className="mono">{l.Detay}</span>
                <span className="page-sub">{l.Tarih} · {l.Kullanici}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useLang, translateStatus, translateCategory } from '../i18n.jsx';

export default function PublicView() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [checking, setChecking] = useState(false);
  const { lang, t } = useLang();

  function load(code) {
    setChecking(true);
    setError('');
    api.getPublicAsset(id, code).then((a) => {
      if (a.needsCode) {
        setNeedsCode(true);
        if (a.error) setError(a.error);
      } else if (a.error) {
        setError(a.error);
      } else {
        setNeedsCode(false);
        setAsset(a);
      }
    }).catch((e) => setError(e.message)).finally(() => setChecking(false));
  }

  useEffect(() => { load(); }, [id]);

  function handleSubmitCode(e) {
    e.preventDefault();
    load(codeInput);
  }

  return (
    <div className="public-screen">
      <div className="public-card">
        {needsCode && !asset && (
          <form onSubmit={handleSubmitCode}>
            <h1 style={{ fontSize: 18, marginBottom: 6 }}>{t('public_code_title')}</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14 }}>{t('public_code_desc')}</p>
            <input
              type="password"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder={t('public_code_placeholder')}
              autoFocus
              style={{ width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 10 }}
            />
            {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={checking} style={{ width: '100%' }}>
              {checking ? '...' : t('public_code_submit')}
            </button>
          </form>
        )}
        {!needsCode && error && <div className="empty-state">{error}</div>}
        {!needsCode && !error && !asset && <div className="spinner" />}
        {asset && (
          <>
            <div className="asset-id">{asset.ID}</div>
            <h1>{asset.Marka} {asset.Model}</h1>
            <div className="public-row"><span className="k">{t('col_category')}</span><span className="v">{translateCategory(asset.Kategori, lang)}</span></div>
            <div className="public-row"><span className="k">{t('col_serial')}</span><span className="v">{asset.SeriNo || '—'}</span></div>
            <div className="public-row"><span className="k">{t('col_color')}</span><span className="v">{asset.Renk || '—'}</span></div>
            <div className="public-row"><span className="k">{t('col_status')}</span><span className="v">{translateStatus(asset.Durum, lang)}</span></div>
            <div className="public-row"><span className="k">{t('col_location')}</span><span className="v">{asset.Lokasyon}</span></div>
            <div className="public-row"><span className="k">{t('col_assigned')}</span><span className="v">{asset.AtananKisi || 'Genel Kullanim'}</span></div>
          </>
        )}
      </div>
    </div>
  );
}

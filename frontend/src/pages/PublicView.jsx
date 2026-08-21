import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

export default function PublicView() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPublicAsset(id).then((a) => {
      if (a.error) setError(a.error);
      else setAsset(a);
    }).catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="public-screen">
      <div className="public-card">
        {error && <div className="empty-state">{error}</div>}
        {!error && !asset && <div className="spinner" />}
        {asset && (
          <>
            <div className="asset-id">{asset.ID}</div>
            <h1>{asset.Marka} {asset.Model}</h1>
            <div className="public-row"><span className="k">Kategori</span><span className="v">{asset.Kategori}</span></div>
            <div className="public-row"><span className="k">Seri No</span><span className="v">{asset.SeriNo || '—'}</span></div>
            <div className="public-row"><span className="k">Renk</span><span className="v">{asset.Renk || '—'}</span></div>
            <div className="public-row"><span className="k">Durum</span><span className="v">{asset.Durum}</span></div>
            <div className="public-row"><span className="k">Lokasyon</span><span className="v">{asset.Lokasyon}</span></div>
            <div className="public-row"><span className="k">Atanan Kisi</span><span className="v">{asset.AtananKisi || 'Genel Kullanim'}</span></div>
          </>
        )}
      </div>
    </div>
  );
}

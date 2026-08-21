import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, BASE_URL } from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import AssetForm from './AssetForm.jsx';

// GitHub Pages'te yayinladiginizda gercek adresinizi buraya yazin,
// veya .env icinde VITE_PUBLIC_BASE_URL olarak tanimlayin.
const PUBLIC_BASE = import.meta.env.VITE_PUBLIC_BASE_URL || `${window.location.origin}${window.location.pathname}#/asset/`;

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [movements, setMovements] = useState([]);
  const [lists, setLists] = useState({});
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function load() {
    Promise.all([api.getInventory(), api.getMovements(), api.getLists(), api.getEmployees()])
      .then(([inv, mv, l, emp]) => {
        setAsset(inv.find((a) => a.ID === id) || null);
        setMovements(mv.filter((m) => m.VarlikID === id).reverse());
        setLists(l);
        setEmployees(emp);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, [id]);

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const base64 = await fileToBase64(file);
      await api.uploadFile({ assetId: id, filename: file.name, mimeType: file.type, base64 });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  if (error) return <div className="empty-state">Hata: {error}</div>;
  if (!asset) return <div className="spinner" />;

  const qrUrl = `${PUBLIC_BASE}${id}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/envanter')} style={{ marginBottom: 10 }}>← Envantere don</button>
          <div className="page-title mono">{asset.ID}</div>
          <div className="page-sub">{asset.Kategori} · {asset.Marka} {asset.Model}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>Duzenle</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="card card-pad">
          <div className="chip-row">
            <StatusBadge status={asset.Durum} />
            <span className="badge badge-gray">{asset.Lokasyon}</span>
          </div>

          <div className="detail-grid">
            <div><div className="k">Seri No</div><div className="v mono">{asset.SeriNo || '—'}</div></div>
            <div><div className="k">Hostname</div><div className="v mono">{asset.Hostname || '—'}</div></div>
            <div><div className="k">MAC Adresi</div><div className="v mono">{asset.MAC || '—'}</div></div>
            <div><div className="k">Renk</div><div className="v">{asset.Renk || '—'}</div></div>
            <div><div className="k">Atanan Kisi</div><div className="v">{asset.AtananKisi || '—'}</div></div>
            <div><div className="k">Atama Tarihi</div><div className="v">{asset.AtamaTarihi || '—'}</div></div>
            <div><div className="k">Tedarikci</div><div className="v">{asset.Tedarikci || '—'}</div></div>
            <div><div className="k">Satin Alma Tarihi</div><div className="v">{asset.SatinAlmaTarihi || '—'}</div></div>
            <div><div className="k">Teslim Alma Tarihi</div><div className="v">{asset.TeslimAlmaTarihi || '—'}</div></div>
            <div><div className="k">Fiyat</div><div className="v mono">{asset.Fiyat ? `${asset.Fiyat} ${asset.ParaBirimi}` : '—'}</div></div>
            <div><div className="k">Garanti Bitis</div><div className="v">{asset.GarantiBitisTarihi || '—'}</div></div>
          </div>

          {asset.Notlar && (
            <>
              <div className="section-title">Notlar</div>
              <div style={{ fontSize: 13.5 }}>{asset.Notlar}</div>
            </>
          )}

          <div className="section-title">Faturalar / Belgeler</div>
          {asset.FaturaLink
            ? asset.FaturaLink.split(',').map((url, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <a href={url.trim()} target="_blank" rel="noreferrer">{`Belge ${i + 1}`} ↗</a>
                </div>
              ))
            : <div className="page-sub" style={{ marginBottom: 10 }}>Henuz belge yuklenmemis.</div>}
          <label className="btn btn-ghost btn-sm" style={{ display: 'inline-flex' }}>
            {uploading ? 'Yukleniyor...' : '+ Belge Yukle'}
            <input type="file" hidden onChange={handleFileUpload} disabled={uploading} />
          </label>

          <div className="section-title">Kullanim Gecmisi</div>
          {movements.length === 0 && <div className="page-sub">Henuz hareket kaydi yok.</div>}
          {movements.map((m) => (
            <div key={m.HareketID} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{m.IslemTuru}</strong>
                <span className="page-sub">{m.Tarih}</span>
              </div>
              <div className="page-sub" style={{ marginTop: 3 }}>
                {m.OncekiKullanici || '—'} → {m.YeniKullanici || '—'}
                {m.OncekiDurum !== m.YeniDurum && ` · ${m.OncekiDurum || '—'} → ${m.YeniDurum || '—'}`}
              </div>
              {m.IslemYapan && <div className="page-sub">Islemi yapan: {m.IslemYapan}</div>}
            </div>
          ))}
        </div>

        <div className="card card-pad" style={{ alignSelf: 'start' }}>
          <div className="section-title" style={{ marginTop: 0 }}>QR Kod</div>
          <div className="qr-box">
            <QRCodeSVG value={qrUrl} size={168} />
            <span className="page-sub" style={{ wordBreak: 'break-all', textAlign: 'center' }}>{qrUrl}</span>
          </div>
          <p className="page-sub" style={{ marginTop: 12 }}>
            Bu kodu cihazin uzerine yapistirin. Okutuldugunda kategori, marka, model ve atanan kisi
            gibi bilgiler herkese acik olarak gorunur; fiyat ve tedarikci bilgisi gosterilmez.
          </p>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => window.print()}>
            Yazdir
          </button>
        </div>
      </div>

      {showForm && (
        <AssetForm
          asset={asset}
          lists={lists}
          employees={employees}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

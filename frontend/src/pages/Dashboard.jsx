import { useEffect, useState } from 'react';
import { api } from '../api';

const CURRENCY_SYMBOL = { TRY: '₺', USD: '$', EUR: '€', RUB: '₽' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="empty-state">Hata: {error}</div>;
  if (!data) return <div className="spinner" />;

  const durumEntries = Object.entries(data.byDurum || {}).sort((a, b) => b[1] - a[1]);
  const kategoriEntries = Object.entries(data.byKategori || {}).sort((a, b) => b[1] - a[1]);
  const lokasyonEntries = Object.entries(data.byLokasyon || {}).sort((a, b) => b[1] - a[1]);
  const maxDurum = Math.max(1, ...durumEntries.map((d) => d[1]));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Panel</div>
          <div className="page-sub">Envanterin genel durumu</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="label">Toplam Varlik</div>
          <div className="value">{data.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">Kullanimda</div>
          <div className="value">{data.byDurum?.Kullanimda || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Stokta</div>
          <div className="value">{data.byDurum?.Stok || 0}</div>
        </div>
        <div className="stat-card amber">
          <div className="label">30 Gun Icinde Garanti Bitecek</div>
          <div className="value">{data.warrantyExpiringSoon}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <div className="card card-pad">
          <div className="section-title" style={{ marginTop: 0 }}>Durum Dagilimi</div>
          {durumEntries.length === 0 && <div className="page-sub">Henuz kayit yok.</div>}
          {durumEntries.map(([status, count]) => (
            <div key={status} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                <span>{status}</span>
                <span className="mono">{count}</span>
              </div>
              <div style={{ background: 'var(--gray-soft)', borderRadius: 999, height: 7 }}>
                <div style={{ width: `${(count / maxDurum) * 100}%`, background: 'var(--accent)', height: '100%', borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card card-pad">
          <div className="section-title" style={{ marginTop: 0 }}>Toplam Deger</div>
          {Object.keys(data.valueByCurrency || {}).length === 0 && <div className="page-sub">Fiyat girilmemis.</div>}
          {Object.entries(data.valueByCurrency || {}).map(([cur, val]) => (
            <div key={cur} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{cur}</span>
              <span className="mono" style={{ fontWeight: 700 }}>
                {CURRENCY_SYMBOL[cur] || ''}{Number(val).toLocaleString('tr-TR')}
              </span>
            </div>
          ))}

          <div className="section-title">Kategoriye Gore</div>
          {kategoriEntries.slice(0, 6).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0' }}>
              <span>{k}</span>
              <span className="mono">{v}</span>
            </div>
          ))}

          <div className="section-title">Lokasyona Gore</div>
          {lokasyonEntries.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0' }}>
              <span>{k}</span>
              <span className="mono">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

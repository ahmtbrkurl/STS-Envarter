import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Hareketler() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.getMovements().then((m) => setMovements(m.reverse())).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return movements;
    const s = search.toLowerCase();
    return movements.filter((m) =>
      [m.VarlikID, m.OncekiKullanici, m.YeniKullanici, m.IslemTuru].join(' ').toLowerCase().includes(s)
    );
  }, [movements, search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Hareketler</div>
          <div className="page-sub">Tum zimmet, iade ve transfer gecmisi</div>
        </div>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Varlik ID veya kisi ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading && <div className="spinner" />}

      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Varlik</th>
                <th>Islem</th>
                <th>Onceki Kullanici</th>
                <th>Yeni Kullanici</th>
                <th>Durum Degisimi</th>
                <th>Islemi Yapan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.HareketID} onClick={() => navigate(`/envanter/${m.VarlikID}`)}>
                  <td>{m.Tarih}</td>
                  <td className="mono">{m.VarlikID}</td>
                  <td><span className="badge badge-gray">{m.IslemTuru}</span></td>
                  <td>{m.OncekiKullanici || '—'}</td>
                  <td>{m.YeniKullanici || '—'}</td>
                  <td>{m.OncekiDurum} → {m.YeniDurum}</td>
                  <td>{m.IslemYapan || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state">Kayit bulunamadi.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

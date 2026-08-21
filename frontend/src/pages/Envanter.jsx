import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import AssetForm from './AssetForm.jsx';

export default function Envanter() {
  const [items, setItems] = useState([]);
  const [lists, setLists] = useState({});
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    Promise.all([api.getInventory(), api.getLists(), api.getEmployees()])
      .then(([inv, l, emp]) => {
        setItems(inv);
        setLists(l);
        setEmployees(emp);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (statusFilter && a.Durum !== statusFilter) return false;
      if (locationFilter && a.Lokasyon !== locationFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [a.ID, a.Kategori, a.Marka, a.Model, a.SeriNo, a.AtananKisi, a.Hostname, a.MAC].join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter, locationFilter]);

  function exportCsv() {
    const headers = Object.keys(items[0] || {});
    const rows = [headers.join(',')].concat(
      filtered.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'envanter.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Envanter</div>
          <div className="page-sub">{items.length} kayitli varlik</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={exportCsv}>CSV Disa Aktar</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Yeni Varlik</button>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="ID, marka, model, seri no, kisi ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tum Durumlar</option>
          {(lists.Durum || []).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
          <option value="">Tum Lokasyonlar</option>
          {(lists.Lokasyon || []).map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <div className="toolbar-spacer" />
        <span className="page-sub">{filtered.length} sonuc</span>
      </div>

      {loading && <div className="spinner" />}
      {error && <div className="empty-state">Hata: {error}</div>}

      {!loading && !error && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Kategori</th>
                <th>Marka / Model</th>
                <th>Seri No</th>
                <th>Durum</th>
                <th>Lokasyon</th>
                <th>Atanan Kisi</th>
                <th>Fiyat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.ID} onClick={() => navigate(`/envanter/${a.ID}`)}>
                  <td className="mono">{a.ID}</td>
                  <td>{a.Kategori}</td>
                  <td>{a.Marka} {a.Model}</td>
                  <td className="mono">{a.SeriNo || '—'}</td>
                  <td><StatusBadge status={a.Durum} /></td>
                  <td>{a.Lokasyon}</td>
                  <td>{a.AtananKisi || '—'}</td>
                  <td className="mono">{a.Fiyat ? `${a.Fiyat} ${a.ParaBirimi || ''}` : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state">Kayit bulunamadi.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <AssetForm
          lists={lists}
          employees={employees}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

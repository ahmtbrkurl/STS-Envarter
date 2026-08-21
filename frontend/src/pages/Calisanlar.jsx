import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';

export default function Calisanlar() {
  const [employees, setEmployees] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.getEmployees(), api.getInventory()])
      .then(([emp, inv]) => { setEmployees(emp); setInventory(inv); })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = employees.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [e.AdSoyad, e.Email, e.Telefon].join(' ').toLowerCase().includes(s);
  });

  function assetCountFor(name) {
    return inventory.filter((a) => a.AtananKisi === name).length;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Calisanlar</div>
          <div className="page-sub">{employees.length} kayitli calisan</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Yeni Calisan</button>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Isim, telefon, e-posta ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading && <div className="spinner" />}

      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Telefon</th>
                <th>E-posta</th>
                <th>Durum</th>
                <th>Zimmetli Varlik</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{e.AdSoyad}</td>
                  <td className="mono">{e.Telefon || '—'}</td>
                  <td>{e.Email || '—'}</td>
                  <td>
                    <span className={`badge ${e.AktifMi === 'Aktif' ? 'badge-accent' : 'badge-gray'}`}>{e.AktifMi || '—'}</span>
                  </td>
                  <td className="mono">{assetCountFor(e.AdSoyad)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state">Kayit bulunamadi.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <EmployeeForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function EmployeeForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ AdSoyad: '', Telefon: '', Email: '', AktifMi: 'Aktif' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createEmployee(form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Yeni calisan"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Vazgec</button>
          <button className="btn btn-primary" type="submit" form="emp-form" disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </>
      }
    >
      <form id="emp-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>Ad Soyad</label>
          <input value={form.AdSoyad} onChange={(e) => setForm({ ...form, AdSoyad: e.target.value })} required />
        </div>
        <div className="field">
          <label>Telefon</label>
          <input value={form.Telefon} onChange={(e) => setForm({ ...form, Telefon: e.target.value })} />
        </div>
        <div className="field">
          <label>E-posta</label>
          <input type="email" value={form.Email} onChange={(e) => setForm({ ...form, Email: e.target.value })} />
        </div>
        <div className="field">
          <label>Durum</label>
          <select value={form.AktifMi} onChange={(e) => setForm({ ...form, AktifMi: e.target.value })}>
            <option value="Aktif">Aktif</option>
            <option value="Pasif">Pasif (isten ayrildi)</option>
          </select>
        </div>
        {error && <div className="error-text">{error}</div>}
      </form>
    </Modal>
  );
}

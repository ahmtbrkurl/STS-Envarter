import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useLang } from '../i18n.jsx';

// Her tablonun sutun tanimi burada - TEK bir sayfa bilesenini (asagida)
// bu config'e gore yeniden kullaniyoruz, 5 ayri sayfa yazmiyoruz.
const TABLE_CONFIGS = {
  vlan: {
    titleKey: 'net_vlan_title',
    columns: [
      { field: 'VlanID', labelKey: 'net_col_vlan_id', type: 'text', width: 70 },
      { field: 'Ad', labelKey: 'net_col_ad', type: 'text' },
      { field: 'Network', labelKey: 'net_col_network', type: 'text' },
      { field: 'SubnetMask', labelKey: 'net_col_subnet', type: 'text' },
      { field: 'Gateway', labelKey: 'net_col_gateway', type: 'text' },
      { field: 'DhcpAralik', labelKey: 'net_col_dhcp_araligi', type: 'text' },
      { field: 'Lease', labelKey: 'net_col_lease', type: 'text' },
      { field: 'DhcpVarMi', labelKey: 'net_col_dhcp_var_mi', type: 'select', options: ['Evet', 'Hayir'] },
      { field: 'Notlar', labelKey: 'col_notes', type: 'textarea' }
    ]
  },
  ip: {
    titleKey: 'net_ip_title',
    columns: [
      { field: 'Vlan', labelKey: 'net_col_vlan', type: 'text', width: 60 },
      { field: 'IPAdresi', labelKey: 'net_col_ip_adresi', type: 'text' },
      { field: 'CihazAdi', labelKey: 'net_col_cihaz_adi', type: 'text' },
      { field: 'MacAdresi', labelKey: 'net_col_mac_adresi', type: 'text' },
      { field: 'Tip', labelKey: 'net_col_tip', type: 'select', options: ['Static', 'DHCP'] },
      { field: 'Durum', labelKey: 'col_status', type: 'select', options: ['Active', 'Planned', 'Reserved'] },
      { field: 'Tarih', labelKey: 'net_col_tarih', type: 'date' },
      { field: 'Notlar', labelKey: 'col_notes', type: 'textarea' }
    ]
  },
  port: {
    titleKey: 'net_port_title',
    columns: [
      { field: 'Port', labelKey: 'net_col_port', type: 'text', width: 80 },
      { field: 'Tip', labelKey: 'net_col_tip', type: 'select', options: ['WAN', 'Access', 'Trunk', '—'] },
      { field: 'Vlan', labelKey: 'net_col_vlan', type: 'text' },
      { field: 'BagliCihaz', labelKey: 'net_col_bagli_cihaz', type: 'text' },
      { field: 'Notlar', labelKey: 'col_notes', type: 'textarea' }
    ]
  },
  firewall: {
    titleKey: 'net_firewall_title',
    columns: [
      { field: 'Sira', labelKey: 'net_col_sira', type: 'text', width: 50 },
      { field: 'Chain', labelKey: 'net_col_chain', type: 'select', options: ['input', 'forward', 'output', 'nat'] },
      { field: 'Aksiyon', labelKey: 'net_col_aksiyon', type: 'select', options: ['accept', 'drop', 'reject'] },
      { field: 'Yorum', labelKey: 'net_col_yorum', type: 'text' },
      { field: 'Kaynak', labelKey: 'net_col_kaynak', type: 'text' },
      { field: 'HedefPort', labelKey: 'net_col_hedef_port', type: 'text' },
      { field: 'Tarih', labelKey: 'net_col_tarih', type: 'date' },
      { field: 'Aciklama', labelKey: 'net_col_aciklama', type: 'textarea' }
    ]
  },
  changelog: {
    titleKey: 'net_changelog_title',
    columns: [
      { field: 'Tarih', labelKey: 'net_col_tarih', type: 'date', width: 100 },
      { field: 'YapilanDegisiklik', labelKey: 'net_col_yapilan_degisiklik', type: 'textarea' },
      { field: 'YedekDosyaAdi', labelKey: 'net_col_yedek_dosya', type: 'text' },
      { field: 'Yapan', labelKey: 'net_col_yapan', type: 'text' },
      { field: 'Durum', labelKey: 'col_status', type: 'select', options: ['Completed', 'In Progress', 'Tested', 'Planned'] }
    ]
  }
};

function emptyForm(columns) {
  const f = {};
  columns.forEach((c) => { f[c.field] = ''; });
  return f;
}

function RowForm({ config, row, onClose, onSaved, tableKey }) {
  const { t } = useLang();
  const isEdit = !!row;
  const [form, setForm] = useState(row ? { ...row } : emptyForm(config.columns));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) await api.updateNetworkRow(tableKey, row.ID, form);
      else await api.createNetworkRow(tableKey, form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '20px 22px' }}>
        <h2 style={{ fontSize: 16, marginBottom: 14 }}>{isEdit ? t('btn_edit') : t('btn_add')}</h2>
        {config.columns.map((c) => (
          <div className="field" key={c.field}>
            <label>{t(c.labelKey)}</label>
            {c.type === 'select' ? (
              <select value={form[c.field] || ''} onChange={(e) => setForm({ ...form, [c.field]: e.target.value })}>
                <option value="">—</option>
                {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : c.type === 'textarea' ? (
              <textarea rows={2} value={form[c.field] || ''} onChange={(e) => setForm({ ...form, [c.field]: e.target.value })} />
            ) : (
              <input type={c.type} value={form[c.field] || ''} onChange={(e) => setForm({ ...form, [c.field]: e.target.value })} />
            )}
          </div>
        ))}
        {error && <div className="error-text">{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>{t('btn_cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? '...' : t('btn_save')}</button>
        </div>
      </form>
    </div>
  );
}

export default function NetworkTable() {
  const { table } = useParams();
  const { t } = useLang();
  const config = TABLE_CONFIGS[table];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);

  function load() {
    setLoading(true);
    api.getNetworkRows(table)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [table]);

  async function handleDelete(row) {
    if (!window.confirm(t('net_delete_confirm'))) return;
    try {
      await api.deleteNetworkRow(table, row.ID);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!config) return <div className="error-text">{t('net_unknown_table')}</div>;
  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t(config.titleKey)}</h1>
        <button className="btn btn-primary" onClick={() => { setEditRow(null); setShowForm(true); }}>+ {t('btn_add')}</button>
      </div>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {config.columns.map((c) => <th key={c.field}>{t(c.labelKey)}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ID}>
                {config.columns.map((c) => <td key={c.field}>{row[c.field] || '—'}</td>)}
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditRow(row); setShowForm(true); }}>{t('btn_edit')}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(row)}>{t('btn_delete')}</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={config.columns.length + 1} className="empty-state">{t('net_empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {showForm && (
        <RowForm
          config={config}
          row={editRow}
          tableKey={table}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

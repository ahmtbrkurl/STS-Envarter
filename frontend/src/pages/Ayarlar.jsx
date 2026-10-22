import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLang } from '../i18n.jsx';

export default function Ayarlar() {
  const [lists, setLists] = useState({});
  const [loading, setLoading] = useState(true);
  const [newValues, setNewValues] = useState({});
  const [busy, setBusy] = useState('');
  const { t } = useLang();

  const LIST_META = {
    Kategori: t('settings_categories'),
    Lokasyon: t('settings_locations'),
    Durum: t('settings_statuses'),
    Marka: t('settings_brands'),
    Renk: t('settings_colors'),
    ParaBirimi: t('settings_currencies'),
    Tedarikci: t('settings_suppliers'),
    Departman: t('settings_departments'),
    KargoFirmasi: t('settings_cargo_companies'),
    SarfKategori: t('sarf_settings_categories')
  };

  function load() {
    setLoading(true);
    api.getLists().then(setLists).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAdd(listName) {
    const value = (newValues[listName] || '').trim();
    if (!value) return;
    setBusy(listName);
    try {
      await api.addListItem(listName, value);
      setNewValues((v) => ({ ...v, [listName]: '' }));
      load();
    } finally {
      setBusy('');
    }
  }

  async function handleRemove(listName, value) {
    setBusy(listName);
    try {
      await api.removeListItem(listName, value);
      load();
    } finally {
      setBusy('');
    }
  }

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('settings_title')}</div>
          <div className="page-sub">{t('settings_sub')}</div>
        </div>
      </div>

      <div className="two-col">
        {Object.keys(LIST_META).map((listName) => (
          <div key={listName} className="card card-pad">
            <div className="section-title" style={{ marginTop: 0 }}>{LIST_META[listName]}</div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                placeholder={`${t('settings_add_new')}`}
                value={newValues[listName] || ''}
                onChange={(e) => setNewValues((v) => ({ ...v, [listName]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd(listName)}
              />
              <button className="btn btn-primary btn-sm" onClick={() => handleAdd(listName)} disabled={busy === listName}>
                {t('btn_add')}
              </button>
            </div>

            <div className="chip-row" style={{ marginBottom: 0 }}>
              {(lists[listName] || []).map((val) => (
                <span key={val} className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {val}
                  <button
                    onClick={() => handleRemove(listName, val)}
                    disabled={busy === listName}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-faint)', padding: 0 }}
                    aria-label={`${val}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {(!lists[listName] || lists[listName].length === 0) && <span className="page-sub">{t('settings_no_values')}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

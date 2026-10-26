import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal.jsx';
import { MonthlyPlanExportModal } from './Ihtiyaclar.jsx';
import { useLang, translateCategory } from '../i18n.jsx';
import {
  ODEME_DURUMU_OPTIONS, odemeDurumuLabel, odemeBadgeClass, fileToBase64, splitLinks, faturaLabel
} from '../faturaUtils.js';

const STATUS_FILTERS = ['Hepsi', ...ODEME_DURUMU_OPTIONS];
const MAX_PICKER_ROWS = 150;

function needText(n, lang) {
  const what = n.MalzemeAdi || n.Aciklama;
  return `${n.PersonelAdi || '📦'} · ${translateCategory(n.Kategori, lang)}${what ? ' · ' + what : ''}`;
}
function sarfText(s, t) {
  return `${t('inv_sarf_order')}: ${s.MalzemeAdi || s.MalzemeID}${s.Miktar ? ' ×' + s.Miktar : ''}`;
}
function rowDate(r) {
  return String(r.SiparisTarihi || r.PlanlananTarih || r.OlusturmaTarihi || '').slice(0, 10);
}

export default function Faturalar() {
  const { t, lang } = useLang();
  const [faturalar, setFaturalar] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [siparisler, setSiparisler] = useState([]);
  const [lists, setLists] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('Hepsi');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | { mode: 'new' } | { id: <fatura ID> }
  const [showAuto, setShowAuto] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    return Promise.all([api.getFaturalar(), api.getNeeds(), api.getSarfSiparisleri(), api.getLists()])
      .then(([f, n, s, l]) => { setFaturalar(f); setNeeds(n); setSiparisler(s); setLists(l); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const linkedByFatura = useMemo(() => {
    const map = {};
    needs.forEach((n) => { if (n.FaturaID) (map[n.FaturaID] = map[n.FaturaID] || { needs: [], sarf: [] }).needs.push(n); });
    siparisler.forEach((s) => { if (s.FaturaID) (map[s.FaturaID] = map[s.FaturaID] || { needs: [], sarf: [] }).sarf.push(s); });
    return map;
  }, [needs, siparisler]);

  const counts = useMemo(() => {
    const c = { TeklifFiyat: 0, Odenmedi: 0, KismenOdendi: 0, Odendi: 0 };
    faturalar.forEach((f) => { c[f.OdemeDurumu || 'Odenmedi'] = (c[f.OdemeDurumu || 'Odenmedi'] || 0) + 1; });
    return c;
  }, [faturalar]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faturalar
      .filter((f) => (filter === 'Hepsi' || (f.OdemeDurumu || 'Odenmedi') === filter))
      .filter((f) => !q || [f.FaturaNo, f.ID, f.Tedarikci, f.Notlar].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => String(b.FaturaTarihi || b.OlusturmaTarihi || '').localeCompare(String(a.FaturaTarihi || a.OlusturmaTarihi || '')));
  }, [faturalar, filter, search]);

  // Kaydettikten sonra listeyi tazele; "Kaydet ve belge yukle" ise fatura
  // artik KAYITLI (ID'si var) oldugundan, belge yukleyebilmek icin duzenleme
  // modunda yeniden ac.
  async function handleSaved(id, openAgain) {
    await load();
    setModal(openAgain && id ? { id } : null);
  }

  const modalFatura = modal && modal.id ? faturalar.find((f) => f.ID === modal.id) || null : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('inv_title')}</div>
          <div className="page-sub">{t('inv_sub')}</div>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setShowPlan(true)}>📅 {t('needs_monthly_plan')}</button>
          <button className="btn btn-ghost" onClick={() => setShowAuto(true)}>✨ {t('inv_auto_group')}</button>
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'new' })}>+ {t('inv_new')}</button>
        </div>
      </div>

      {error && <div className="card card-pad error-text" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {ODEME_DURUMU_OPTIONS.map((k) => (
          <div key={k} className="stat-card">
            <div className="label">{odemeDurumuLabel(k, lang)}</div>
            <div className="value">{counts[k] || 0}</div>
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((s) => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(s)}>
            {s === 'Hepsi' ? t('needs_all') : odemeDurumuLabel(s, lang)}
          </button>
        ))}
        <input
          style={{ marginLeft: 'auto', minWidth: 220 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`${t('inv_no')} / ${t('col_supplier')}`}
        />
      </div>

      {loading && <div className="spinner" />}

      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('inv_no')}</th>
                <th>{t('col_supplier')}</th>
                <th>{t('inv_date')}</th>
                <th>{t('inv_amount')}</th>
                <th>{t('inv_col_linked')}</th>
                <th>{t('needs_col_payment_status')}</th>
                <th>{t('inv_docs')}</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const linked = linkedByFatura[f.ID] || { needs: [], sarf: [] };
                const total = linked.needs.length + linked.sarf.length;
                const preview = linked.needs.slice(0, 2).map((n) => needText(n, lang))
                  .concat(linked.sarf.slice(0, Math.max(0, 2 - linked.needs.length)).map((s) => sarfText(s, t)));
                const docs = splitLinks(f.BelgeLink);
                const st = f.OdemeDurumu || 'Odenmedi';
                return (
                  <tr key={f.ID} style={{ cursor: 'pointer' }} onClick={() => setModal({ id: f.ID })}>
                    <td style={{ fontWeight: 600 }}>
                      {faturaLabel(f)}
                      {f.FaturaNo && <div className="mono page-sub" style={{ fontSize: 11 }}>{f.ID}</div>}
                    </td>
                    <td>{f.Tedarikci || '—'}</td>
                    <td>{f.FaturaTarihi || '—'}</td>
                    <td className="mono">{f.Tutar ? `${Number(f.Tutar).toLocaleString('tr-TR')} ${f.ParaBirimi || ''}` : '—'}</td>
                    <td style={{ whiteSpace: 'normal', fontSize: 12.5 }}>
                      <strong>{total}</strong>
                      {preview.map((p, i) => <div key={i} className="page-sub" style={{ fontSize: 11.5 }}>{p}</div>)}
                      {total > 2 && <div className="page-sub" style={{ fontSize: 11.5 }}>+{total - 2}</div>}
                    </td>
                    <td>
                      <span className={`badge ${odemeBadgeClass(st)}`}>{odemeDurumuLabel(st, lang)}</span>
                      {f.OdemeTarihi && <div className="page-sub" style={{ fontSize: 11 }}>{f.OdemeTarihi}</div>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {docs.length === 0 ? '—' : docs.map((u, i) => (
                        <div key={i}><a href={u} target="_blank" rel="noreferrer">{t('needs_proforma_doc_label')} {i + 1} ↗</a></div>
                      ))}
                    </td>
                    <td className="no-print" onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal({ id: f.ID })}>{t('needs_edit')}</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state">{faturalar.length === 0 ? t('inv_none') : t('no_results')}</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (modal.mode === 'new' || modalFatura) && (
        <FaturaModal
          key={modal.mode === 'new' ? 'new' : modal.id}
          fatura={modal.mode === 'new' ? null : modalFatura}
          needs={needs}
          siparisler={siparisler}
          lists={lists}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDocsChanged={load}
        />
      )}

      {showPlan && (
        <MonthlyPlanExportModal needs={needs} faturalar={faturalar} faturaOnlyDefault onClose={() => setShowPlan(false)} />
      )}

      {showAuto && (
        <AutoGroupModal
          needs={needs}
          siparisler={siparisler}
          onClose={() => setShowAuto(false)}
          onDone={() => { setShowAuto(false); load(); }}
        />
      )}
    </div>
  );
}

// ============ Fatura olustur / duzenle ============
function FaturaModal({ fatura, needs, siparisler, lists, onClose, onSaved, onDocsChanged }) {
  const { t, lang } = useLang();
  const isNew = !fatura;
  const [form, setForm] = useState({
    FaturaNo: fatura?.FaturaNo || '',
    Tedarikci: fatura?.Tedarikci || '',
    FaturaTarihi: fatura?.FaturaTarihi || '',
    Tutar: fatura?.Tutar || '',
    ParaBirimi: fatura?.ParaBirimi || 'TRY',
    OdemeDurumu: fatura?.OdemeDurumu || 'Odenmedi',
    OdemeTarihi: fatura?.OdemeTarihi || '',
    Notlar: fatura?.Notlar || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [docs, setDocs] = useState(splitLinks(fatura?.BelgeLink));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [rowSearch, setRowSearch] = useState('');

  // Bu faturaya HALEN bagli satirlar (modal acildigi andaki) - secimin baslangici.
  const initialKeys = useMemo(() => {
    const s = new Set();
    if (fatura) {
      needs.forEach((n) => { if (n.FaturaID === fatura.ID) s.add('need:' + n.ID); });
      siparisler.forEach((o) => { if (o.FaturaID === fatura.ID) s.add('sarf:' + o.ID); });
    }
    return s;
  }, [fatura, needs, siparisler]);
  const [selected, setSelected] = useState(() => new Set(initialKeys));

  // Secilebilir satirlar: TUM durumlar (Bekleyen/Siparis Verildi/Karsilandi/Iptal).
  // Baska faturaya bagli satirlar da listelenir (sonda, fatura ID'siyle); secilirse bu faturaya tasinir.
  const candidates = useMemo(() => {
    const out = [];
    needs.forEach((n) => {
      out.push({ key: 'need:' + n.ID, kind: 'need', row: n, text: needText(n, lang) });
    });
    siparisler.forEach((s) => {
      out.push({ key: 'sarf:' + s.ID, kind: 'sarf', row: s, text: sarfText(s, t) });
    });
    out.sort((a, b) => {
      const rank = (c) => (initialKeys.has(c.key) ? 0 : c.row.FaturaID ? 2 : 1);
      const ai = rank(a);
      const bi = rank(b);
      if (ai !== bi) return ai - bi;
      return rowDate(b.row).localeCompare(rowDate(a.row));
    });
    return out;
  }, [needs, siparisler, fatura, initialKeys, lang, t]);

  const shownRows = useMemo(() => {
    const q = rowSearch.trim().toLowerCase();
    const list = q
      ? candidates.filter((c) => (c.text + ' ' + (c.row.Tedarikci || '') + ' ' + (c.row.Durum || '')).toLowerCase().includes(q))
      : candidates;
    return list;
  }, [candidates, rowSearch]);

  const selectedTotals = useMemo(() => {
    const totals = {};
    candidates.forEach((c) => {
      if (!selected.has(c.key) || c.kind !== 'need' || !c.row.Fiyat) return;
      const cur = c.row.ParaBirimi || 'TRY';
      totals[cur] = (totals[cur] || 0) + Number(c.row.Fiyat);
    });
    return totals;
  }, [candidates, selected]);

  // Yeni secilen satirlardan kacinin odeme durumu faturanin durumundan FARKLI (uyari icin).
  const willChange = useMemo(() => {
    let n = 0;
    candidates.forEach((c) => {
      if (!selected.has(c.key) || initialKeys.has(c.key)) return;
      if ((c.row.OdemeDurumu || 'Odenmedi') !== form.OdemeDurumu) n++;
    });
    return n;
  }, [candidates, selected, initialKeys, form.OdemeDurumu]);

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function setPaymentStatus(value) {
    setForm((f) => {
      const today = new Date().toISOString().slice(0, 10);
      let tarih = f.OdemeTarihi;
      if (value === 'Odenmedi' || value === 'TeklifFiyat') tarih = '';
      else if (!tarih) tarih = today;
      return { ...f, OdemeDurumu: value, OdemeTarihi: tarih };
    });
  }

  async function submit(openDocsAfter) {
    setSaving(true);
    setError('');
    try {
      const needIds = [...selected].filter((k) => k.startsWith('need:')).map((k) => k.slice(5));
      const sarfIds = [...selected].filter((k) => k.startsWith('sarf:')).map((k) => k.slice(5));
      let id = fatura?.ID;
      if (isNew) {
        const res = await api.createFatura(form, needIds, sarfIds);
        id = res.id;
      } else {
        await api.updateFatura(fatura.ID, form, needIds, sarfIds);
      }
      onSaved(id, openDocsAfter);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !fatura) return;
    setUploading(true);
    setUploadError('');
    try {
      const base64 = await fileToBase64(file);
      const res = await api.uploadFile({ assetId: fatura.ID, filename: file.name, mimeType: file.type, base64, sheetName: 'Faturalar', linkColumn: 'BelgeLink' });
      setDocs((prev) => [...prev, res.url]);
      if (onDocsChanged) onDocsChanged(); // liste de yeni belgeyi hemen gorsun
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete() {
    if (!confirm(t('inv_delete_confirm'))) return;
    setSaving(true);
    try {
      await api.deleteFatura(fatura.ID);
      onSaved(null, false);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isNew ? t('inv_new') : `${t('inv_edit')} · ${faturaLabel(fatura)}`}
      onClose={onClose}
      actions={
        <>
          {!isNew && <button className="btn btn-danger" type="button" onClick={handleDelete} disabled={saving} style={{ marginRight: 'auto' }}>{t('btn_delete')}</button>}
          <button className="btn btn-ghost" type="button" onClick={onClose}>{t('btn_cancel')}</button>
          {isNew && <button className="btn btn-ghost" type="button" onClick={() => submit(true)} disabled={saving}>{t('inv_save_and_upload')}</button>}
          <button className="btn btn-primary" type="button" onClick={() => submit(false)} disabled={saving}>{saving ? '...' : t('btn_save')}</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(false); }}>
        <div className="form-grid">
          <div className="field">
            <label>{t('inv_no')}</label>
            <input value={form.FaturaNo} onChange={(e) => setForm({ ...form, FaturaNo: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('inv_date')}</label>
            <input type="date" value={form.FaturaTarihi} onChange={(e) => setForm({ ...form, FaturaTarihi: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>{t('col_supplier')}</label>
          <input list="fatura-tedarikci" value={form.Tedarikci} onChange={(e) => setForm({ ...form, Tedarikci: e.target.value })} />
          <datalist id="fatura-tedarikci">
            {lists.Tedarikci?.map((td) => <option key={td} value={td} />)}
          </datalist>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t('inv_amount')}</label>
            <input type="number" step="0.01" value={form.Tutar} onChange={(e) => setForm({ ...form, Tutar: e.target.value })} />
            {Object.keys(selectedTotals).length > 0 && (
              <div className="page-sub" style={{ marginTop: 4 }}>
                Σ {Object.entries(selectedTotals).map(([cur, v]) => `${Number(v).toLocaleString('tr-TR')} ${cur}`).join(' + ')}
              </div>
            )}
          </div>
          <div className="field">
            <label>{t('col_currency')}</label>
            <select value={form.ParaBirimi} onChange={(e) => setForm({ ...form, ParaBirimi: e.target.value })}>
              {(lists.ParaBirimi?.length ? lists.ParaBirimi : ['TRY', 'USD', 'EUR', 'RUB']).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 6 }}>{t('needs_payment_section')}</div>
        <div className="form-grid">
          <div className="field">
            <label>{t('needs_col_payment_status')}</label>
            <select value={form.OdemeDurumu} onChange={(e) => setPaymentStatus(e.target.value)}>
              {ODEME_DURUMU_OPTIONS.map((k) => <option key={k} value={k}>{odemeDurumuLabel(k, lang)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('needs_col_payment_date')}</label>
            <input type="date" value={form.OdemeTarihi} onChange={(e) => setForm({ ...form, OdemeTarihi: e.target.value })} />
          </div>
        </div>
        <div className="page-sub" style={{ marginBottom: 8 }}>{t('inv_propagate_note')}</div>

        <div className="field">
          <label>{t('col_notes')}</label>
          <input value={form.Notlar} onChange={(e) => setForm({ ...form, Notlar: e.target.value })} />
        </div>

        <div className="section-title" style={{ marginTop: 6 }}>{t('inv_docs')}</div>
        {isNew ? (
          <div className="page-sub" style={{ marginBottom: 10 }}>{t('inv_docs_save_first')}</div>
        ) : (
          <>
            {docs.length > 0
              ? docs.map((url, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <a href={url} target="_blank" rel="noreferrer">{t('needs_proforma_doc_label')} {i + 1} ↗</a>
                  </div>
                ))
              : <div className="page-sub" style={{ marginBottom: 10 }}>{t('detail_no_docs')}</div>}
            <label className="btn btn-ghost btn-sm" style={{ display: 'inline-flex' }}>
              {uploading ? '...' : `+ ${t('detail_upload')}`}
              <input type="file" hidden onChange={handleFileUpload} disabled={uploading} />
            </label>
            {uploadError && <div className="error-text" style={{ marginTop: 8 }}>{uploadError}</div>}
          </>
        )}

        <div className="section-title" style={{ marginTop: 14 }}>
          {t('inv_linked_rows')} <span className="page-sub">({selected.size} {t('inv_selected_count')})</span>
        </div>
        <div className="page-sub" style={{ marginBottom: 8 }}>{t('inv_pick_hint')}</div>
        <input
          value={rowSearch}
          onChange={(e) => setRowSearch(e.target.value)}
          placeholder={t('inv_search_rows')}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
          {shownRows.slice(0, MAX_PICKER_ROWS).map((c) => {
            const r = c.row;
            return (
              <label key={c.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggle(c.key)} style={{ marginTop: 3 }} />
                <span style={{ flex: 1 }}>
                  <div>{c.text}</div>
                  <div className="page-sub" style={{ fontSize: 11.5 }}>
                    {[r.Tedarikci, rowDate(r), r.Fiyat ? `${r.Fiyat} ${r.ParaBirimi || ''}` : '', r.Durum, r.FaturaID && !initialKeys.has(c.key) ? `🧾 ${r.FaturaID}` : ''].filter(Boolean).join(' · ')}
                  </div>
                </span>
                <span className={`badge ${odemeBadgeClass(r.OdemeDurumu || 'Odenmedi')}`} style={{ fontSize: 10 }}>
                  {odemeDurumuLabel(r.OdemeDurumu || 'Odenmedi', lang)}
                </span>
              </label>
            );
          })}
          {shownRows.length === 0 && <div className="empty-state">{t('no_results')}</div>}
          {shownRows.length > MAX_PICKER_ROWS && (
            <div className="page-sub" style={{ padding: 8 }}>+{shownRows.length - MAX_PICKER_ROWS} … ({t('inv_search_rows')})</div>
          )}
        </div>
        {willChange > 0 && (
          <div className="page-sub" style={{ marginTop: 8, color: 'var(--amber, #b7791f)' }}>
            ⚠ {willChange} {t('inv_will_change')}
          </div>
        )}

        {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
      </form>
    </Modal>
  );
}

// ============ Mevcut satirlardan otomatik fatura onerisi ============
function AutoGroupModal({ needs, siparisler, onClose, onDone }) {
  const { t, lang } = useLang();
  const [groups, setGroups] = useState(null);
  const [checked, setChecked] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.suggestFaturaGroups()
      .then((g) => {
        setGroups(g);
        const c = {};
        g.forEach((x) => { c[x.key] = true; });
        setChecked(c);
      })
      .catch((e) => { setError(e.message); setGroups([]); });
  }, []);

  const needById = useMemo(() => { const m = {}; needs.forEach((n) => { m[n.ID] = n; }); return m; }, [needs]);
  const sarfById = useMemo(() => { const m = {}; siparisler.forEach((s) => { m[s.ID] = s; }); return m; }, [siparisler]);

  async function create() {
    setSaving(true);
    setError('');
    try {
      const chosen = groups.filter((g) => checked[g.key]).map((g) => ({ key: g.key }));
      const res = await api.createFaturalarFromGroups(chosen);
      alert(`${res.created} ${t('inv_auto_group_done')}`);
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const chosenCount = groups ? groups.filter((g) => checked[g.key]).length : 0;

  return (
    <Modal
      title={t('inv_auto_group_title')}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" onClick={create} disabled={saving || chosenCount === 0}>
            {saving ? '...' : `${t('inv_auto_group_create')} (${chosenCount})`}
          </button>
        </>
      }
    >
      <div className="page-sub" style={{ marginBottom: 12 }}>{t('inv_auto_group_desc')}</div>
      {groups === null && <div className="spinner" />}
      {groups && groups.length === 0 && !error && <div className="empty-state">{t('inv_auto_group_none')}</div>}
      {groups && groups.map((g) => {
        const labels = g.needIds.map((id) => needById[id] && needText(needById[id], lang))
          .concat(g.sarfIds.map((id) => sarfById[id] && sarfText(sarfById[id], t))).filter(Boolean);
        const docCount = splitLinks(g.BelgeLink).length;
        return (
          <label key={g.key} style={{ display: 'flex', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checked[g.key]} onChange={(e) => setChecked({ ...checked, [g.key]: e.target.checked })} style={{ marginTop: 3 }} />
            <span style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {g.Tedarikci} · {g.SiparisTarihi}{' '}
                <span className={`badge ${odemeBadgeClass(g.OdemeDurumu)}`} style={{ fontSize: 10 }}>{odemeDurumuLabel(g.OdemeDurumu, lang)}</span>
              </div>
              <div className="page-sub" style={{ fontSize: 12, whiteSpace: 'normal' }}>
                {g.needIds.length + g.sarfIds.length} {t('inv_selected_lines')}{docCount > 0 ? ` · ${docCount} ${t('inv_invoice_docs').toLowerCase()}` : ''}
              </div>
              <div className="page-sub" style={{ fontSize: 11.5, whiteSpace: 'normal' }}>{labels.join(' | ')}</div>
            </span>
          </label>
        );
      })}
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}

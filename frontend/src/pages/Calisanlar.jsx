import { normalizeMacsOrThrow } from '../macUtils.js';
import { AccessResourcesFields } from '../accessResources.jsx';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { api } from '../api';
import Modal from '../components/Modal.jsx';
import { useLang, translateCategory } from '../i18n.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { timestampedFilename, downloadCsv, excelSafeText, toAsciiChars, splitNameParts } from '../exportUtils.js';
import { exportPrinterAddressBooks } from '../printerExport.js';

const PAGE_SIZE = 10;

export default function Calisanlar() {
  const [employees, setEmployees] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [lists, setLists] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [durumFilter, setDurumFilter] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [syncingHR, setSyncingHR] = useState(false);
  const [hrChanges, setHrChanges] = useState(null);
  const [hrSelected, setHrSelected] = useState(new Set());
  const [hrMissingEmployees, setHrMissingEmployees] = useState([]);
  const [hrDifferentPersonKeys, setHrDifferentPersonKeys] = useState(new Set());
  const [showHRModal, setShowHRModal] = useState(false);
  const [applyingHR, setApplyingHR] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useLang();
  const { userName } = useAuth();

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.getEmployees(), api.getInventory(), api.getLists()])
      .then(([emp, inv, l]) => { setEmployees(emp); setInventory(inv); setLists(l); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Firma bos ise varsayilan olarak STS-Akkuyu sayilir.
  const firmaOf = (e) => e.Firma || 'STS-Akkuyu';
  const firmaOptions = useMemo(() => [...new Set(employees.map((e) => e.Firma || 'STS-Akkuyu'))].sort((a, b) => a.localeCompare(b)), [employees]);

  const filtered = useMemo(() => employees.filter((e) => {
    if (durumFilter && e.AktifMi !== durumFilter) return false;
    if (firmaFilter && firmaOf(e) !== firmaFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return [e.AdSoyad, e.Email, e.Telefon, e.Departman, e.PersonelID, e.SicilNo].join(' ').toLowerCase().includes(s);
  }), [employees, search, durumFilter, firmaFilter]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, durumFilter, firmaFilter]);
  const visible = filtered.slice(0, visibleCount);
  const missingComCount = employees.filter((e) => !e.ITMuaf && (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && (!e.Firma || e.Firma === 'STS-Akkuyu') && !(e.Email && e.Email.toLowerCase().includes('@sts-org.com'))).length;

  function assetCountFor(name) {
    return inventory.filter((a) => a.AtananKisi === name).length;
  }

  function exportCsv() {
    const headers = ['PersonelID', 'AdSoyad', 'Unvan', 'Departman', 'Firma', 'Telefon', 'TelefonMAC', 'Email', 'AktifMi'];
    const labels = [t('col_personel_id'), t('col_full_name'), t('col_title'), t('col_department'), t('col_firma_label'), t('col_phone'), t('col_phone_mac'), t('col_email'), t('col_status')];
    const csv = Papa.unparse({ fields: labels, data: filtered.map((row) => headers.map((h) => (h === 'Firma' ? firmaOf(row) : (h === 'Telefon' || h === 'TelefonMAC') && row[h] ? excelSafeText(row[h]) : row[h] ?? ''))) });
    downloadCsv(csv, timestampedFilename(t('nav_employees'), 'csv'));
  }

  // Outlook (Office 2024) icin "Kisi ice aktar" (Import Contacts) formatinda
  // CSV - SADECE Aktif + STS-Akkuyu calisanlarini icerir. Bu liste surekli
  // degistigi icin TEK SEFERLIK bir dosya degil, istediginiz zaman tekrar
  // calistirabileceginiz bir buton - her calistirdiginizda o anki guncel
  // listeyi verir, Outlook'a tekrar tekrar import edip eski kisi grubunu
  // guncelleyebilirsiniz.
  function exportOutlookContacts() {
    const list = employees.filter((e) => e.AktifMi === 'Aktif' && (!e.Firma || e.Firma === 'STS-Akkuyu'));
    const headers = ['Name', 'Last Name', 'Job Title', 'Department', 'Company', 'E-mail Address', 'E-mail 2 Address'];
    const rows = list.map((e) => {
      const { first, last } = splitNameParts(e.AdSoyad);
      // Bazi kisilerin birden fazla e-postasi (virgulle ayrilmis) oluyor -
      // ikisini de aliyoruz, Outlook'un kendi "E-mail 2 Address" alanina.
      const emails = e.Email ? e.Email.split(',').map((x) => x.trim()).filter(Boolean) : [];
      return [
        toAsciiChars(first),
        toAsciiChars(last).toUpperCase(),
        e.Unvan || '',
        e.Departman || '',
        'STS-Akkuyu',
        emails[0] || '',
        emails[1] || ''
      ];
    });
    const csv = Papa.unparse({ fields: headers, data: rows });
    // Dosya ADINDA Kiril karakter olursa Windows/tarayici bazen dosyayi
    // "???" gibi bozuk bir isimle kaydediyor (goruldu) - bu yuzden dosya
    // ADI sade Latin harflerle kalsin.
    downloadCsv(csv, 'STS-Akkuyu-Outlook-Kisiler.csv');
  }

  const [syncingForms, setSyncingForms] = useState(false);
  async function handleSyncForms() {
    setSyncingForms(true);
    try {
      const r = await api.syncTeslimFormLinks();
      alert(`${t('handover_sync_done')}: ${r.message}${r.unmatched && r.unmatched.length ? `\n(${r.unmatched.length} ?)` : ''}`);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSyncingForms(false);
    }
  }

  async function handleSyncHR() {
    setSyncingHR(true);
    setImportMsg('');
    try {
      const res = await api.previewHRSync();
      setHrChanges(res.changes);
      setHrMissingEmployees(res.missingEmployees || []);
      setHrDifferentPersonKeys(new Set());
      // Guvenlik icin: sadece "yeni" kayitlar varsayilan olarak isaretli - mevcut
      // birinin bilgisini degistirmek her zaman elle onay ister.
      setHrSelected(new Set(res.changes.filter((c) => c.changeType === 'new' && !c.possibleDuplicateOf).map((c) => c.key)));
      setShowHRModal(true);
    } catch (err) {
      setImportMsg('Hata: ' + err.message);
    } finally {
      setSyncingHR(false);
    }
  }

  function toggleHRKey(key) {
    setHrSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // "Sicil No yeniden kullanilmis olabilir" uyarisinda kullanicinin verdigi
  // karar: true = farkli kisi (eski kisi Pasif olur, yeni kisi ayri eklenir),
  // false/yok = sadece isim duzeltmesi (normal guncelleme).
  function setDifferentPerson(key, isDifferent) {
    setHrDifferentPersonKeys((prev) => {
      const next = new Set(prev);
      if (isDifferent) next.add(key); else next.delete(key);
      return next;
    });
  }

  async function handleMarkInactive(name, durum) {
    try {
      await api.updateEmployee(name, { AktifMi: durum });
      setHrMissingEmployees((prev) => prev.filter((e) => e.AdSoyad !== name));
      load();
    } catch (err) {
      setImportMsg('Hata: ' + err.message);
    }
  }

  const [generatingPasswords, setGeneratingPasswords] = useState(false);
  const [generatedPasswords, setGeneratedPasswords] = useState(null);

  async function handleGeneratePasswords() {
    setGeneratingPasswords(true);
    try {
      const res = await api.generateMissingTalepSifreleri();
      setGeneratedPasswords(res.all);
    } catch (err) {
      setImportMsg('Hata: ' + err.message);
    } finally {
      setGeneratingPasswords(false);
    }
  }

  async function handleApplyHR() {
    setApplyingHR(true);
    try {
      const items = hrChanges.filter((c) => hrSelected.has(c.key)).map((c) => {
        if (hrDifferentPersonKeys.has(c.key)) {
          return { ...c.incoming, _action: 'differentPerson', _eskiAdSoyad: c.current?.AdSoyad };
        }
        return c.incoming;
      });
      const res = await api.applyHRSync(items, userName);
      setImportMsg(res.message);
      setShowHRModal(false);
      setHrChanges(null);
      load();
    } catch (err) {
      setImportMsg('Hata: ' + err.message);
    } finally {
      setApplyingHR(false);
    }
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await api.importEmployees(results.data);
          setImportMsg(res.message);
          load();
        } catch (err) {
          setImportMsg('Hata: ' + err.message);
        } finally {
          setImporting(false);
          e.target.value = '';
        }
      }
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('employees_title')}</div>
          <div className="page-sub">{employees.length} {t('employees_count')}</div>
          {missingComCount > 0 && (
            <div className="page-sub" style={{ color: 'var(--red)', marginTop: 2 }}>⚠️ {missingComCount} {t('employees_com_missing_count')}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={handleSyncHR} disabled={syncingHR}>
            {syncingHR ? '...' : `🔄 ${t('hr_sync_button')}`}
          </button>
          <button className="btn btn-ghost" onClick={handleSyncForms} disabled={syncingForms}>
            {syncingForms ? '...' : `📄 ${t('handover_sync_btn')}`}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleImportFile} />
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? '...' : t('btn_import_csv')}
          </button>
          <button className="btn btn-ghost" onClick={exportCsv}>{t('btn_export_csv')}</button>
          <button className="btn btn-ghost" onClick={exportOutlookContacts}>📇 {t('btn_export_outlook')}</button>
          <button className="btn btn-ghost" onClick={() => exportPrinterAddressBooks(employees)}>🖨️ {t('btn_export_printer')}</button>
          <button className="btn btn-ghost" onClick={handleGeneratePasswords} disabled={generatingPasswords}>
            {generatingPasswords ? '...' : `🔑 ${t('talep_generate_passwords')}`}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ {t('employees_new')}</button>
        </div>
      </div>

      {importMsg && <div className="card card-pad" style={{ marginBottom: 14, fontSize: 13 }}>{importMsg}</div>}

      <div className="toolbar">
        <input className="search" placeholder={t('search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={durumFilter} onChange={(e) => setDurumFilter(e.target.value)}>
          <option value="">{t('employees_all_statuses')}</option>
          <option value="Aktif">{t('employee_status_active')}</option>
          <option value="Beklemede">{t('employee_status_pending')}</option>
          <option value="Pasif">{t('employee_status_inactive')}</option>
          <option value="Iptal">{t('employee_status_cancelled')}</option>
        </select>
        <select value={firmaFilter} onChange={(e) => setFirmaFilter(e.target.value)}>
          <option value="">{t('employees_all_firms')}</option>
          {firmaOptions.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {loading && <div className="spinner" />}

      {error && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>⚠️ {t('error_loading_data')}: {error}</span>
            <button className="btn btn-ghost btn-sm" onClick={load}>{t('btn_retry')}</button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('col_personel_id')}</th>
                  <th>{t('needs_col_person')}</th>
                  <th>{t('col_title')}</th>
                  <th>{t('col_department')}</th>
                  <th>{t('col_phone')}</th>
                  <th>{t('col_phone_mac')}</th>
                  <th>{t('col_email')}</th>
                  <th>{t('col_status')}</th>
                  <th>{t('employees_assigned_count')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e, i) => (
                  <tr key={i} onClick={() => navigate(`/calisanlar/${encodeURIComponent(e.AdSoyad)}`)}>
                    <td className="mono page-sub">{e.PersonelID || '—'}</td>
                    <td style={{ fontWeight: 600 }}>
                      {e.AdSoyad}
                      {e.ITMuaf && (
                        <span className="badge badge-gray" style={{ marginLeft: 6, fontWeight: 400, fontSize: 11 }}>{t('col_it_muaf_badge')}</span>
                      )}
                      {e.PlanlananBaslangicTarihi && (
                        <div className="page-sub" style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>
                          {startDateBadge(e.PlanlananBaslangicTarihi, t)}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{e.Unvan || '—'}</td>
                    <td>{e.Departman || '—'}</td>
                    <td className="mono">{e.Telefon || '—'}</td>
                    <td className="mono" style={{ fontSize: 12, whiteSpace: 'pre-line' }}>{e.TelefonMAC ? e.TelefonMAC.split(',').map((x) => x.trim()).join('\n') : '—'}</td>
                    <td>
                      {(() => {
                        const hasCom = e.Email && e.Email.toLowerCase().includes('@sts-org.com');
                        return (
                          <>
                            {e.Email ? <div>{e.Email}</div> : '—'}
                            {!hasCom && e.EmailAdresName && (
                              <div className="page-sub" style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--red)' }}>
                                ⚠️ {e.EmailAdresName}@sts-org.com {t('employees_com_missing')}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td>
                      <span className={`badge ${e.AktifMi === 'Aktif' ? 'badge-accent' : e.AktifMi === 'Beklemede' ? 'badge-amber' : e.AktifMi === 'Iptal' ? 'badge-amber' : e.AktifMi === 'Pasif' ? 'badge-red' : 'badge-gray'}`}>
                        {e.AktifMi === 'Aktif' ? t('employee_status_active') : e.AktifMi === 'Beklemede' ? t('employee_status_pending') : e.AktifMi === 'Iptal' ? t('employee_status_cancelled') : e.AktifMi === 'Pasif' ? t('employee_status_inactive') : e.AktifMi || '—'}
                      </span>
                    </td>
                    <td className="mono">{assetCountFor(e.AdSoyad)}</td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(e)}>{t('employees_edit')}</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9}><div className="empty-state">{t('no_results')}</div></td></tr>
                )}
              </tbody>
            </table>
          </div>

          {visibleCount < filtered.length && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                {t('btn_load_more')} ({filtered.length - visibleCount})
              </button>
            </div>
          )}
        </>
      )}

      {showForm && (
        <EmployeeForm lists={lists} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
      {editTarget && (
        <EmployeeForm lists={lists} employee={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); }} />
      )}

      {showHRModal && (
        <HRSyncModal
          changes={hrChanges}
          selected={hrSelected}
          onToggle={toggleHRKey}
          onSelectAllUpdates={() => setHrSelected((prev) => {
            const next = new Set(prev);
            hrChanges.filter((c) => c.changeType === 'updated').forEach((c) => next.add(c.key));
            return next;
          })}
          onClose={() => setShowHRModal(false)}
          onApply={handleApplyHR}
          applying={applyingHR}
          missingEmployees={hrMissingEmployees}
          onMarkInactive={handleMarkInactive}
          differentPersonKeys={hrDifferentPersonKeys}
          onSetDifferentPerson={setDifferentPerson}
        />
      )}
      {generatedPasswords && (
        <Modal
          title={t('talep_generate_passwords')}
          onClose={() => setGeneratedPasswords(null)}
          actions={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const text = generatedPasswords.map((p) => `${p.AdSoyad}\t${p.Email}\t${p.TalepSifresi}`).join('\n');
                  navigator.clipboard.writeText(text);
                }}
              >
                📋 {t('btn_copy')}
              </button>
              <button className="btn btn-primary" onClick={() => setGeneratedPasswords(null)}>{t('btn_close')}</button>
            </>
          }
        >
          {generatedPasswords.length === 0 ? (
            <div className="empty-state">{t('talep_passwords_none')}</div>
          ) : (
            <>
              <div className="page-sub" style={{ marginBottom: 10 }}>{t('talep_passwords_desc')}</div>
              <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {generatedPasswords.map((p) => (
                  <div key={p.AdSoyad} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.AdSoyad}
                      {p.isNew && <span className="badge badge-accent" style={{ fontSize: 10 }}>{t('talep_new_badge')}</span>}
                    </span>
                    <span className="page-sub" style={{ flex: 1, textAlign: 'right' }}>{p.Email || '—'}</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{p.TalepSifresi}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function HRSyncModal({ changes, selected, onToggle, onSelectAllUpdates, onClose, onApply, applying, missingEmployees, onMarkInactive, differentPersonKeys, onSetDifferentPerson }) {
  const { t } = useLang();
  const FIELD_LABELS = { AdSoyad: t('needs_col_person'), Telefon: t('col_phone'), Departman: t('col_department'), AktifMi: t('col_status'), SicilNo: t('col_sicil_no'), Unvan: t('col_title'), BabaAdi: t('col_father_name'), IseBaslamaTarihi: t('col_ise_baslama_tarihi'), EmailBasvuruAdi: t('col_email_basvuru_adi'), Cinsiyet: t('col_cinsiyet'), Uyruk: t('col_uyruk') };

  return (
    <Modal
      title={t('hr_sync_modal_title')}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" onClick={onApply} disabled={applying}>
            {applying ? '...' : `${t('hr_sync_apply')} (${selected.size})`}
          </button>
        </>
      }
    >
      {missingEmployees && missingEmployees.length > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--amber-soft)', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--amber)', marginBottom: 6 }}>⚠️ {t('hr_sync_missing_title')}</div>
          <div className="page-sub" style={{ marginBottom: 8 }}>{t('hr_sync_missing_desc')}</div>
          {missingEmployees.map((e) => (
            <div key={e.AdSoyad} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13, flexWrap: 'wrap', gap: 6 }}>
              <span><strong>{e.AdSoyad}</strong> · {e.Departman || '—'}{e.Unvan ? ` · ${e.Unvan}` : ''}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => onMarkInactive(e.AdSoyad, 'Pasif')}>{t('hr_sync_mark_left')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onMarkInactive(e.AdSoyad, 'Iptal')}>{t('hr_sync_mark_cancelled')}</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {changes.length === 0 ? (
        <div>
          <div className="empty-state">{t('hr_sync_no_changes')}</div>
          <p className="page-sub" style={{ textAlign: 'center', marginTop: 6 }}>{t('hr_sync_apply_anyway_hint')}</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={onSelectAllUpdates}>{t('hr_sync_select_all_updates')}</button>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 420, overflowY: 'auto' }}>
            {changes.map((c) => (
              <div
                key={c.key}
                style={{ display: 'flex', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}
              >
                <input type="checkbox" checked={selected.has(c.key)} onChange={() => onToggle(c.key)} style={{ marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{c.incoming.AdSoyad}</strong>
                    <span className={`badge ${c.changeType === 'new' ? 'badge-accent' : 'badge-amber'}`}>
                      {c.changeType === 'new' ? t('hr_sync_new') : t('hr_sync_updated')}
                    </span>
                  </div>
                  {c.changeType === 'new' ? (
                    <div className="page-sub" style={{ marginTop: 3 }}>
                      {c.incoming.Departman || '—'} · {c.incoming.Telefon || '—'} · {c.incoming.AktifMi}
                    </div>
                  ) : (
                    <div style={{ marginTop: 3 }}>
                      {c.changedFields.map((f) => (
                        <div key={f} className="page-sub">
                          {FIELD_LABELS[f]}: <span style={{ textDecoration: 'line-through' }}>{c.current[f] || '—'}</span> → <strong>{c.incoming[f] || '—'}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  {c.possibleDuplicateOf && (
                    <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--amber-soft)', color: 'var(--amber)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      ⚠️ {t('hr_sync_possible_duplicate')}: <strong>{c.possibleDuplicateOf}</strong>
                    </div>
                  )}
                  {c.possibleDifferentPerson && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--red-soft, #fee2e2)', borderRadius: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red, #dc2626)', marginBottom: 6 }}>
                        🚨 {t('hr_sync_different_person_warning')}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className={`badge ${!differentPersonKeys.has(c.key) ? 'badge-accent' : 'badge-gray'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => onSetDifferentPerson(c.key, false)}
                        >
                          {t('hr_sync_just_name_fix')}
                        </button>
                        <button
                          type="button"
                          className={`badge ${differentPersonKeys.has(c.key) ? 'badge-accent' : 'badge-gray'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => onSetDifferentPerson(c.key, true)}
                        >
                          {t('hr_sync_different_person')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

// Planlanan baslangic tarihine gore kisa bir "X gun sonra basliyor" / "gecikti"
// rozeti uretir - HR'in bazen bos biraktigi baslama tarihini IT'nin kendi
// takip etmesi icin.
function startDateBadge(dateStr, t) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays > 0) return `📅 ${diffDays} ${t('usage_days_unit')} ${t('employees_starts_in_suffix')}`;
  if (diffDays === 0) return `📅 ${t('employees_starts_today')}`;
  return `📅 ${Math.abs(diffDays)} ${t('usage_days_unit')} ${t('employees_days_overdue_suffix')}`;
}

function EmployeeForm({ employee, lists, onClose, onSaved }) {
  const { t, lang } = useLang();
  const isEdit = !!employee;
  const [form, setForm] = useState({
    AdSoyad: employee?.AdSoyad || '',
    Telefon: employee?.Telefon || '',
    Email: employee?.Email || '',
    Departman: employee?.Departman || '',
    AktifMi: employee?.AktifMi || 'Aktif',
    IstenAyrilmaTarihi: employee?.IstenAyrilmaTarihi || '',
    EmailKapatildi: employee?.EmailKapatildi || '',
    Firma: employee?.Firma || 'STS-Akkuyu',
    Unvan: employee?.Unvan || '',
    BabaAdi: employee?.BabaAdi || '',
    PlanlananBaslangicTarihi: employee?.PlanlananBaslangicTarihi || '',
    EmailDomain: employee?.EmailDomain || '',
    ITMuaf: employee?.ITMuaf || '',
    MuafKategoriler: employee?.MuafKategoriler || '',
    ErisimDosya: employee?.ErisimDosya || '',
    Erisim1C: employee?.Erisim1C || '',
    MuafErisimler: employee?.MuafErisimler || '',
    TelefonMAC: employee?.TelefonMAC || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      form.TelefonMAC = normalizeMacsOrThrow(form.TelefonMAC, t('col_phone_mac_invalid'));
      if (isEdit) {
        await api.updateEmployee(employee.AdSoyad, form);
      } else {
        const res = await api.createEmployee(form);
        if (res.queued) alert(res.message);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? `${t('employees_edit')} · ${employee.AdSoyad}` : t('employees_new')}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>{t('btn_cancel')}</button>
          <button className="btn btn-primary" type="submit" form="emp-form" disabled={saving}>{saving ? '...' : t('btn_save')}</button>
        </>
      }
    >
      <form id="emp-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>{t('needs_col_person')}</label>
          <input value={form.AdSoyad} onChange={(e) => setForm({ ...form, AdSoyad: e.target.value })} required />
        </div>
        <div className="field">
          <label>{t('col_department')}</label>
          <input list="dep-list" value={form.Departman} onChange={(e) => setForm({ ...form, Departman: e.target.value })} />
          <datalist id="dep-list">
            {lists?.Departman?.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div className="field">
          <label>{t('col_title')}</label>
          <input value={form.Unvan} onChange={(e) => setForm({ ...form, Unvan: e.target.value })} placeholder="TR/RU" />
        </div>
        <div className="field">
          <label>{t('col_father_name')}</label>
          <input value={form.BabaAdi} onChange={(e) => setForm({ ...form, BabaAdi: e.target.value })} />
          <div className="page-sub" style={{ marginTop: 4 }}>{t('col_father_name_hint')}</div>
        </div>
        <div className="field">
          <label>{t('col_planned_start')}</label>
          <input type="date" value={form.PlanlananBaslangicTarihi} onChange={(e) => setForm({ ...form, PlanlananBaslangicTarihi: e.target.value })} />
          <div className="page-sub" style={{ marginTop: 4 }}>{t('col_planned_start_hint')}</div>
        </div>
        <div className="field">
          <label>{t('col_email_domain')}</label>
          <select value={form.EmailDomain} onChange={(e) => setForm({ ...form, EmailDomain: e.target.value })}>
            <option value="">{t('col_email_domain_unknown')}</option>
            <option value="sts-org.com">sts-org.com</option>
            <option value="sts-org.ru">sts-org.ru</option>
          </select>
          <div className="page-sub" style={{ marginTop: 4 }}>{t('col_email_domain_hint')}</div>
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.ITMuaf} onChange={(e) => setForm({ ...form, ITMuaf: e.target.checked ? 'TRUE' : '' })} />
            {t('col_it_muaf')}
          </label>
          <div className="page-sub" style={{ marginTop: 4 }}>{t('col_it_muaf_hint')}</div>
        </div>
        <div className="field">
          <label>{t('col_kategori_muaf')}</label>
          <div className="page-sub" style={{ marginTop: 2, marginBottom: 6 }}>{t('col_kategori_muaf_hint')}</div>
          <div style={{ display: 'flex', gap: 16 }}>
            {['Bilgisayar', 'Monitor'].map((cat) => {
              const list = form.MuafKategoriler ? form.MuafKategoriler.split(',').filter(Boolean) : [];
              const checked = list.includes(cat);
              return (
                <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked ? [...list, cat] : list.filter((c) => c !== cat);
                      setForm({ ...form, MuafKategoriler: next.join(',') });
                    }}
                  />
                  {translateCategory(cat, lang)}
                </label>
              );
            })}
          </div>
        </div>
        <AccessResourcesFields form={form} setForm={setForm} />
        <div className="field">
          <label>{t('col_phone')}</label>
          <input value={form.Telefon} onChange={(e) => setForm({ ...form, Telefon: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('col_phone_mac')}</label>
          <textarea className="mono" rows={3} value={form.TelefonMAC} onChange={(e) => setForm({ ...form, TelefonMAC: e.target.value })} placeholder={"AA:BB:CC:DD:EE:FF\n11:22:33:44:55:66"} />
          <div className="page-sub" style={{ marginTop: 4 }}>{t('col_phone_mac_hint')}</div>
        </div>
        <div className="field">
          <label>{t('col_email')}</label>
          <input type="text" value={form.Email} onChange={(e) => setForm({ ...form, Email: e.target.value })} placeholder={t('col_email_multi_hint')} />
          <div className="page-sub" style={{ marginTop: 4 }}>{t('col_email_multi_hint')}</div>
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.Firma === 'STS-Akkuyu' || !form.Firma}
              onChange={(e) => setForm({ ...form, Firma: e.target.checked ? 'STS-Akkuyu' : '' })}
            />
            {t('col_sts_akkuyu_calisani')}
          </label>
          {form.Firma !== 'STS-Akkuyu' && (
            <input
              type="text"
              placeholder={t('col_firma_adi_placeholder')}
              value={form.Firma}
              onChange={(e) => setForm({ ...form, Firma: e.target.value })}
              style={{ marginTop: 6 }}
            />
          )}
          <div className="page-sub" style={{ marginTop: 4 }}>{t('col_firma_hint')}</div>
        </div>
        <div className="field">
          <label>{t('col_status')}</label>
          <select value={form.AktifMi} onChange={(e) => setForm({ ...form, AktifMi: e.target.value })}>
            <option value="Aktif">{t('employee_status_active')}</option>
            <option value="Beklemede">{t('employee_status_pending')}</option>
            <option value="Pasif">{t('employee_status_inactive')}</option>
            <option value="Iptal">{t('employee_status_cancelled')}</option>
          </select>
        </div>
        {(form.AktifMi === 'Pasif' || form.AktifMi === 'Iptal') && (
          <div className="field">
            <label>{form.AktifMi === 'Iptal' ? t('col_iptal_tarihi') : t('col_isten_ayrilma_tarihi')}</label>
            <input type="date" value={form.IstenAyrilmaTarihi} onChange={(e) => setForm({ ...form, IstenAyrilmaTarihi: e.target.value })} />
          </div>
        )}
        {(form.AktifMi === 'Pasif' || form.AktifMi === 'Iptal') && (
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.EmailKapatildi} onChange={(e) => setForm({ ...form, EmailKapatildi: e.target.checked ? 'TRUE' : '' })} />
              {t('col_email_kapatildi')}
            </label>
          </div>
        )}
        {error && <div className="error-text">{error}</div>}
      </form>
    </Modal>
  );
}

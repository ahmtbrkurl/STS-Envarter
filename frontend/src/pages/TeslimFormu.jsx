import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useLang } from '../i18n.jsx';

const LABELS = {
  titleSingle: { tr: 'BT VARLIK TESLIM / IADE / TRANSFER FORMU', ru: 'АКТ ПРИЕМА-ПЕРЕДАЧИ ИМУЩЕСТВА', en: 'IT ASSET DELIVERY / RETURN / TRANSFER FORM' },
  titleBulk: { tr: 'BT VARLIK TOPLU TESLIM FORMU', ru: 'АКТ ПРИЕМА-ПЕРЕДАЧИ IT-ИМУЩЕСТВА', en: 'IT ASSET BULK HANDOVER FORM' },
  islemTuru: { tr: 'Islem Turu', ru: 'Тип операции', en: 'Transaction Type' },
  tarih: { tr: 'Tarih', ru: 'Дата', en: 'Date' },
  varlikId: { tr: 'Varlik No', ru: 'Инвентарный №', en: 'Asset ID' },
  kategori: { tr: 'Kategori', ru: 'Категория', en: 'Category' },
  markaModel: { tr: 'Marka / Model', ru: 'Марка / Модель', en: 'Brand / Model' },
  seriNo: { tr: 'Seri No', ru: 'Серийный №', en: 'Serial No' },
  eskiKullanici: { tr: 'Eski Kullanici (Teslim Eden)', ru: 'Предыдущий пользователь (сдающий)', en: 'Previous User (Handing Over)' },
  yeniKullanici: { tr: 'Yeni Kullanici (Teslim Alan)', ru: 'Новый пользователь (принимающий)', en: 'New User (Receiving)' },
  kisi: { tr: 'Personel', ru: 'Сотрудник', en: 'Employee' },
  lokasyon: { tr: 'Lokasyon', ru: 'Местоположение', en: 'Location' },
  aciklama: { tr: 'Aciklama / Notlar', ru: 'Примечания', en: 'Notes' },
  toplamAdet: { tr: 'Toplam Kalem', ru: 'Всего позиций', en: 'Total Items' },
  teslimEden: { tr: 'Teslim Eden (Imza)', ru: 'Сдал (Подпись)', en: 'Handed over by (Signature)' },
  teslimAlan: { tr: 'Teslim Alan (Imza)', ru: 'Принял (Подпись)', en: 'Received by (Signature)' },
  unvan: { tr: 'Unvan', ru: 'Должность', en: 'Title' },
  renk: { tr: 'Renk', ru: 'Цвет', en: 'Color' },
  atamaTarihi: { tr: 'Atama Tarihi', ru: 'Дата назначения', en: 'Assignment Date' }
};

const ISLEM_TURLERI = [
  { value: 'Teslim', tr: 'Teslim', ru: 'Выдача', en: 'Handover' },
  { value: 'Iade', tr: 'Iade', ru: 'Возврат', en: 'Return' },
  { value: 'Transfer', tr: 'Transfer', ru: 'Передача', en: 'Transfer' }
];

function TriLabel({ k }) {
  const l = LABELS[k];
  return (
    <span className="label-tri">
      {l.tr}
      <small>{l.ru} / {l.en}</small>
    </span>
  );
}

// Toplu (bir kisiye ait tum varliklar) ve "Hepsi" (her kisi icin ayri sayfa)
// modlarinin ikisi de AYNI kisi-basi belge govdesini kullanir - tekrar yazmamak icin ayri bilesen.
function PersonDocBlock({ personName, personAssets, unvan, formNo, tarih, islem, aciklama, pageBreak }) {
  return (
    <div className={`teslim-form-doc ${pageBreak ? 'teslim-page-break' : ''}`} style={{ maxWidth: 720, marginBottom: pageBreak ? 24 : 0 }}>
      <div className="teslim-letterhead">
        <div className="teslim-company-name">Sovremenniye Truboprovodniye Sistemleri Ltd. Sti.</div>
        <div className="teslim-company-sub">Rusya Federasyonu Mersin Merkez Subesi</div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>{formNo}</div>
      <h2>{LABELS.titleBulk.tr}</h2>
      <div className="subtitle">{LABELS.titleBulk.ru} · {LABELS.titleBulk.en}</div>

      <div className="teslim-row"><TriLabel k="islemTuru" /><div className="value">{islem?.tr} / {islem?.ru} / {islem?.en}</div></div>
      <div className="teslim-row"><TriLabel k="tarih" /><div className="value">{tarih}</div></div>
      <div className="teslim-row"><TriLabel k="kisi" /><div className="value">{personName}{unvan ? ` — ${unvan}` : ''}</div></div>
      <div className="teslim-row"><TriLabel k="toplamAdet" /><div className="value">{personAssets.length}</div></div>
      <table className="report-table" style={{ marginTop: 14, marginBottom: 14, tableLayout: 'fixed', width: '100%' }}>
        <colgroup>
          <col style={{ width: '4%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>{LABELS.varlikId.tr}</th>
            <th>{LABELS.kategori.tr}</th>
            <th>{LABELS.markaModel.tr}</th>
            <th>{LABELS.seriNo.tr}</th>
            <th>{LABELS.renk.tr}</th>
            <th>{LABELS.atamaTarihi.tr}</th>
          </tr>
        </thead>
        <tbody>
          {personAssets.map((a, i) => (
            <tr key={a.ID}>
              <td>{i + 1}</td>
              <td className="mono" style={{ wordBreak: 'break-all' }}>{a.ID}</td>
              <td>{a.Kategori}</td>
              <td style={{ overflowWrap: 'break-word' }}>{a.Marka} {a.Model}</td>
              <td className="mono" style={{ wordBreak: 'break-all' }}>{a.SeriNo || '—'}</td>
              <td>{a.Renk || '—'}</td>
              <td className="mono">{a.AtamaTarihi || '—'}</td>
            </tr>

          ))}
        </tbody>
      </table>

      <div className="teslim-row"><TriLabel k="aciklama" /><div className="value">{aciklama || '—'}</div></div>

      <div className="teslim-sign-grid">
        <div className="teslim-sign-box"><TriLabel k="teslimEden" /></div>
        <div className="teslim-sign-box"><TriLabel k="teslimAlan" /></div>
      </div>
    </div>
  );
}

export default function TeslimFormu() {
  const [params] = useSearchParams();
  const { t } = useLang();

  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState(params.get('person') ? 'bulk' : 'single');
  const [assetId, setAssetId] = useState(params.get('asset') || '');
  const [personName, setPersonName] = useState(params.get('person') || '');
  const [islemTuru, setIslemTuru] = useState('Teslim');
  const [eskiKullanici, setEskiKullanici] = useState('');
  const [yeniKullanici, setYeniKullanici] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [showDoc, setShowDoc] = useState(false);
  const [formNo, setFormNo] = useState('');
  const [allFormNos, setAllFormNos] = useState({}); // {personName: formNo} - "Hepsi" modu icin
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.getInventory(), api.getEmployees()])
      .then(([inv, emp]) => { setAssets(inv); setEmployees(emp); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const asset = useMemo(() => assets.find((a) => a.ID === assetId), [assets, assetId]);
  const personAssets = useMemo(() => assets.filter((a) => a.AtananKisi === personName), [assets, personName]);
  const yeniKullaniciData = useMemo(() => employees.find((e) => e.AdSoyad === (mode === 'bulk' ? personName : yeniKullanici)), [employees, personName, yeniKullanici, mode]);

  // "Hepsi" modu: en az 1 varligi olan HERKESI, kisi basina ayri sayfa olacak sekilde listeler.
  const allPersonsWithAssets = useMemo(() => {
    const names = [...new Set(assets.map((a) => a.AtananKisi).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b)).map((name) => ({
      name,
      assets: assets.filter((a) => a.AtananKisi === name),
      unvan: employees.find((e) => e.AdSoyad === name)?.Unvan || ''
    }));
  }, [assets, employees]);

  useEffect(() => {
    if (mode === 'single' && asset) setEskiKullanici(asset.AtananKisi || '');
    if (mode === 'bulk' && personName) { setEskiKullanici(''); setYeniKullanici(personName); }
  }, [asset, mode, personName]);

  async function handleGenerate() {
    if (mode === 'all') {
      const nos = {};
      for (const p of allPersonsWithAssets) {
        try {
          const res = await api.nextTeslimFormNo();
          nos[p.name] = res.formNo;
        } catch {
          nos[p.name] = '—';
        }
      }
      setAllFormNos(nos);
      setShowDoc(true);
      return;
    }
    try {
      const res = await api.nextTeslimFormNo();
      setFormNo(res.formNo);
    } catch {
      setFormNo('—');
    }
    setShowDoc(true);
  }

  if (loading) return <div className="spinner" />;
  if (error) {
    return (
      <div className="card card-pad" style={{ background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>⚠️ {t('error_loading_data')}: {error}</span>
          <button className="btn btn-ghost btn-sm" onClick={load}>{t('btn_retry')}</button>
        </div>
      </div>
    );
  }

  if (showDoc && mode === 'all' && allPersonsWithAssets.length > 0) {
    const islem = ISLEM_TURLERI.find((i) => i.value === islemTuru);
    return (
      <div>
        <div className="page-header no-print">
          <div>
            <div className="page-title">{t('handover_title')}</div>
            <div className="page-sub">TR / RU / EN · {allPersonsWithAssets.length} {t('needs_col_person')}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setShowDoc(false)}>{t('handover_back')}</button>
            <button className="btn btn-primary" onClick={() => window.print()}>{t('btn_print').split(' /')[0]}</button>
          </div>
        </div>
        {allPersonsWithAssets.map((p, i) => (
          <PersonDocBlock
            key={p.name}
            personName={p.name}
            personAssets={p.assets}
            unvan={p.unvan}
            formNo={allFormNos[p.name]}
            tarih={tarih}
            islem={islem}
            aciklama={aciklama}
            pageBreak={i < allPersonsWithAssets.length - 1}
          />
        ))}
      </div>
    );
  }


  if (showDoc && ((mode === 'single' && asset) || (mode === 'bulk' && personAssets.length > 0))) {
    const islem = ISLEM_TURLERI.find((i) => i.value === islemTuru);

    if (mode === 'bulk') {
      return (
        <div>
          <div className="page-header no-print">
            <div>
              <div className="page-title">{t('handover_title')}</div>
              <div className="page-sub">TR / RU / EN</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setShowDoc(false)}>{t('handover_back')}</button>
              <button className="btn btn-primary" onClick={() => window.print()}>{t('btn_print').split(' /')[0]}</button>
            </div>
          </div>
          <PersonDocBlock
            personName={personName}
            personAssets={personAssets}
            unvan={yeniKullaniciData?.Unvan}
            formNo={formNo}
            tarih={tarih}
            islem={islem}
            aciklama={aciklama}
            pageBreak={false}
          />
        </div>
      );
    }

    return (
      <div>
        <div className="page-header no-print">
          <div>
            <div className="page-title">{t('handover_title')}</div>
            <div className="page-sub">TR / RU / EN</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setShowDoc(false)}>{t('handover_back')}</button>
            <button className="btn btn-primary" onClick={() => window.print()}>{t('btn_print').split(' /')[0]}</button>
          </div>
        </div>

        <div className="teslim-form-doc">
          <div className="teslim-letterhead">
            <div className="teslim-company-name">Sovremenniye Truboprovodniye Sistemleri Ltd. Sti.</div>
            <div className="teslim-company-sub">Rusya Federasyonu Mersin Merkez Subesi</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>{formNo}</div>
          <h2>{LABELS.titleSingle.tr}</h2>
          <div className="subtitle">{LABELS.titleSingle.ru} · {LABELS.titleSingle.en}</div>

          <div className="teslim-row"><TriLabel k="islemTuru" /><div className="value">{islem?.tr} / {islem?.ru} / {islem?.en}</div></div>
          <div className="teslim-row"><TriLabel k="tarih" /><div className="value">{tarih}</div></div>

          <div className="teslim-row"><TriLabel k="varlikId" /><div className="value mono">{asset.ID}</div></div>
          <div className="teslim-row"><TriLabel k="kategori" /><div className="value">{asset.Kategori}</div></div>
          <div className="teslim-row"><TriLabel k="markaModel" /><div className="value">{asset.Marka} {asset.Model}</div></div>
          <div className="teslim-row"><TriLabel k="seriNo" /><div className="value mono">{asset.SeriNo || '—'}</div></div>
          <div className="teslim-row"><span className="label-tri">{LABELS.renk.tr}<small>{LABELS.renk.ru} / {LABELS.renk.en}</small></span><div className="value">{asset.Renk || '—'}</div></div>
          <div className="teslim-row"><TriLabel k="lokasyon" /><div className="value">{asset.Lokasyon}</div></div>
          <div className="teslim-row"><TriLabel k="eskiKullanici" /><div className="value">{eskiKullanici || '—'}</div></div>
          <div className="teslim-row"><TriLabel k="yeniKullanici" /><div className="value">{yeniKullanici || '—'}{yeniKullaniciData?.Unvan ? ` (${yeniKullaniciData.Unvan})` : ''}</div></div>

          <div className="teslim-row"><TriLabel k="aciklama" /><div className="value">{aciklama || '—'}</div></div>

          <div className="teslim-sign-grid">
            <div className="teslim-sign-box"><TriLabel k="teslimEden" /></div>
            <div className="teslim-sign-box"><TriLabel k="teslimAlan" /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('handover_title')}</div>
          <div className="page-sub">{t('handover_sub')}</div>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <div className="chip-row">
          <button type="button" className={`badge ${mode === 'single' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setMode('single')} style={{ cursor: 'pointer' }}>
            {t('handover_mode_single')}
          </button>
          <button type="button" className={`badge ${mode === 'bulk' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setMode('bulk')} style={{ cursor: 'pointer' }}>
            {t('handover_mode_bulk')}
          </button>
          <button type="button" className={`badge ${mode === 'all' ? 'badge-accent' : 'badge-gray'}`} onClick={() => setMode('all')} style={{ cursor: 'pointer' }}>
            {t('handover_mode_all')}
          </button>
        </div>

        {mode === 'single' ? (
          <div className="field">
            <label>{t('handover_select_asset')}</label>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)} required>
              <option value="">{t('handover_select')}</option>
              {assets.map((a) => (
                <option key={a.ID} value={a.ID}>{a.ID} · {a.Marka} {a.Model}</option>
              ))}
            </select>
          </div>
        ) : mode === 'bulk' ? (
          <div className="field">
            <label>{t('needs_col_person')}</label>
            <select value={personName} onChange={(e) => setPersonName(e.target.value)} required>
              <option value="">{t('handover_select')}</option>
              {employees.map((emp) => <option key={emp.AdSoyad} value={emp.AdSoyad}>{emp.AdSoyad}</option>)}
            </select>
            {personName && (
              <div className="page-sub" style={{ marginTop: 6 }}>
                {personAssets.length > 0
                  ? `${personAssets.length} ${t('report_assets')}: ${personAssets.map((a) => a.ID).join(', ')}`
                  : t('handover_no_assets')}
              </div>
            )}
          </div>
        ) : (
          <div className="field">
            <div className="page-sub">
              {t('handover_all_hint')} — <strong>{allPersonsWithAssets.length} {t('needs_col_person')}</strong>, {t('handover_all_pages_hint')}
            </div>
          </div>
        )}

        <div className="field">
          <label>{t('handover_type')}</label>
          <select value={islemTuru} onChange={(e) => setIslemTuru(e.target.value)}>
            {ISLEM_TURLERI.map((i) => <option key={i.value} value={i.value}>{i.tr} ({i.en})</option>)}
          </select>
        </div>

        <div className="field">
          <label>{t('col_date')}</label>
          <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
        </div>

        {mode === 'single' && (
          <>
            <div className="field">
              <label>{t('handover_prev_user')}</label>
              <input list="tf-employee-list" value={eskiKullanici} onChange={(e) => setEskiKullanici(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('handover_new_user')}</label>
              <input list="tf-employee-list" value={yeniKullanici} onChange={(e) => setYeniKullanici(e.target.value)} />
              <datalist id="tf-employee-list">
                {employees.map((emp) => <option key={emp.AdSoyad} value={emp.AdSoyad} />)}
              </datalist>
            </div>
          </>
        )}

        <div className="field">
          <label>{t('handover_notes')}</label>
          <textarea rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
        </div>

        <button
          className="btn btn-primary"
          disabled={mode === 'single' ? !assetId : mode === 'bulk' ? (!personName || personAssets.length === 0) : allPersonsWithAssets.length === 0}
          onClick={handleGenerate}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {t('handover_generate')}
        </button>
      </div>
    </div>
  );
}

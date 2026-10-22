import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { api } from '../api';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import AssetForm from './AssetForm.jsx';
import { useLang, translateCategory } from '../i18n.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Kayip/hurdaya cikmis zaten bilinen durumlar sayimda "bulunmasi beklenen" listesine girmez.
const EXPECTED_STATUSES = ['Kullanimda', 'Stok', 'Rezerve', 'Onarimda', 'Kartus Bitti'];

export default function Sayim() {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { userName } = useAuth();

  const [items, setItems] = useState([]);
  const [lists, setLists] = useState({});
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanned, setScanned] = useState({}); // { assetId: { timestamp } }
  const [lastFeedback, setLastFeedback] = useState(null); // { type: 'ok'|'unknown'|'duplicate', text }
  const [manualId, setManualId] = useState('');
  const [finished, setFinished] = useState(false);
  const [fixTarget, setFixTarget] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastScanRef = useRef({ id: null, time: 0 });

  useEffect(() => {
    Promise.all([api.getInventory(), api.getLists(), api.getEmployees()])
      .then(([inv, l, emp]) => { setItems(inv); setLists(l); setEmployees(emp); })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => stopCamera(), []);

  function extractAssetId(qrText) {
    // QR icerigi tam URL (https://.../#/asset/IT-0001) veya dogrudan ID olabilir.
    const match = String(qrText).match(/([A-Za-z]+-\d+)\s*$/);
    return match ? match[1] : qrText.trim();
  }

  async function startCamera() {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      rafRef.current = requestAnimationFrame(tickScan);
    } catch (err) {
      setCameraError(t('audit_camera_error'));
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }

  function tickScan() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tickScan);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      handleScanResult(code.data);
    }
    rafRef.current = requestAnimationFrame(tickScan);
  }

  function handleScanResult(rawText) {
    const id = extractAssetId(rawText);
    const now = Date.now();
    // Ayni kodu ust uste kare kare tekrar islememek icin 1.5 saniye bekleme.
    if (lastScanRef.current.id === id && now - lastScanRef.current.time < 1500) return;
    lastScanRef.current = { id, time: now };

    const asset = items.find((a) => a.ID === id);
    if (!asset) {
      setLastFeedback({ type: 'unknown', text: `${id} - ${t('audit_unknown_code')}` });
      return;
    }
    registerScan(id, asset);
  }

  function registerScan(id, asset) {
    setScanned((prev) => {
      if (prev[id]) {
        setLastFeedback({ type: 'duplicate', text: `${id} - ${t('audit_already_scanned')}` });
        return prev;
      }
      setLastFeedback({ type: 'ok', text: `${id} · ${asset.Marka} ${asset.Model}` });
      return { ...prev, [id]: { timestamp: new Date().toISOString() } };
    });
  }

  function handleManualAdd(e) {
    e.preventDefault();
    if (!manualId.trim()) return;
    const id = manualId.trim().toUpperCase();
    const asset = items.find((a) => a.ID === id);
    if (!asset) {
      setLastFeedback({ type: 'unknown', text: `${id} - ${t('audit_unknown_code')}` });
    } else {
      registerScan(id, asset);
    }
    setManualId('');
  }

  const expectedItems = useMemo(() => items.filter((a) => EXPECTED_STATUSES.includes(a.Durum)), [items]);
  const scannedIds = Object.keys(scanned);
  const foundExpected = expectedItems.filter((a) => scanned[a.ID]);
  const missingExpected = expectedItems.filter((a) => !scanned[a.ID]);
  const unexpectedScans = scannedIds.filter((id) => {
    const a = items.find((x) => x.ID === id);
    return a && !EXPECTED_STATUSES.includes(a.Durum);
  });

  async function finishAudit() {
    stopCamera();
    setFinished(true);
    try {
      await api.logAuditSummary({
        toplam: expectedItems.length,
        bulunan: foundExpected.length,
        bulunamayan: missingExpected.length
      }, userName);
    } catch {
      // log basarisiz olsa bile denetim sonucunu gostermeye devam et
    }
  }

  function handlePrint() {
    const original = document.title;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    document.title = `Sayim_Raporu_${lang.toUpperCase()}_${stamp}`;
    window.print();
    setTimeout(() => { document.title = original; }, 800);
  }

  if (loading) return <div className="spinner" />;
  if (loadError) return <div className="empty-state">Hata: {loadError}</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('audit_title')}</div>
          <div className="page-sub">{t('audit_sub')}</div>
        </div>
        {finished && (
          <div className="no-print" style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => { setFinished(false); setScanned({}); setLastFeedback(null); }}>
              {t('audit_restart')}
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>{t('btn_print').split(' /')[0]}</button>
          </div>
        )}
      </div>

      {!finished && (
        <>
          <div className="card card-pad no-print" style={{ marginBottom: 16 }}>
            {!scanning ? (
              <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📷</div>
                <p className="page-sub" style={{ marginBottom: 16 }}>{t('audit_intro')}</p>
                <button className="btn btn-primary" onClick={startCamera}>{t('audit_start_scan')}</button>
                {cameraError && <div className="error-text" style={{ marginTop: 10 }}>{cameraError}</div>}
              </div>
            ) : (
              <div>
                <div className="audit-camera-wrap">
                  <video ref={videoRef} playsInline muted className="audit-camera-video" />
                  <div className="audit-camera-frame" />
                </div>
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                  <span className="page-sub">{t('audit_scanned_count')}: <strong>{scannedIds.length}</strong></span>
                  <button className="btn btn-ghost btn-sm" onClick={stopCamera}>{t('audit_stop_camera')}</button>
                </div>
                {lastFeedback && (
                  <div className={`audit-feedback audit-feedback-${lastFeedback.type}`}>
                    {lastFeedback.type === 'ok' && '✓ '}
                    {lastFeedback.type === 'duplicate' && '↻ '}
                    {lastFeedback.type === 'unknown' && '✕ '}
                    {lastFeedback.text}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleManualAdd} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder={t('audit_manual_placeholder')}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
              />
              <button className="btn btn-ghost" type="submit">{t('audit_manual_add')}</button>
            </form>
          </div>

          {scannedIds.length > 0 && (
            <div className="card card-pad no-print" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginTop: 0 }}>{t('audit_scanned_list')} ({scannedIds.length})</div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {scannedIds.map((id) => {
                  const a = items.find((x) => x.ID === id);
                  if (!a) return null;
                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span>
                        <span className="mono" style={{ fontWeight: 700 }}>{id}</span> · {a.Marka} {a.Model}
                        <span className="page-sub" style={{ marginLeft: 8 }}>{a.AtananKisi || t('audit_no_owner')} · {a.Lokasyon}</span>
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setFixTarget(a)}>{t('audit_fix')}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="no-print" style={{ textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={finishAudit} disabled={scannedIds.length === 0}>
              {t('audit_finish')}
            </button>
          </div>
        </>
      )}

      {finished && (
        <div className="report-doc-v2" id="audit-report">
          <div className="report-hero">
            <div className="company">Sovremenniye Truboprovodniye Sistemleri Ltd. Sti.</div>
            <div className="company-sub">Rusya Federasyonu Mersin Merkez Subesi</div>
            <h1>{t('audit_report_title')}</h1>
            <div className="meta-row">
              <div className="meta-item">{t('report_generated')}<strong>{new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : lang === 'ru' ? 'ru-RU' : 'en-US')}</strong></div>
              <div className="meta-item">{t('report_prepared_by')}<strong>{userName || '—'}</strong></div>
            </div>
          </div>
          <div className="report-body">
            <div className="report-kpi-grid">
              <div className="report-kpi primary">
                <div className="label">{t('audit_expected_total')}</div>
                <div className="value">{expectedItems.length}</div>
              </div>
              <div className="report-kpi">
                <div className="label">{t('audit_found')}</div>
                <div className="value" style={{ color: 'var(--accent)' }}>{foundExpected.length}</div>
              </div>
              <div className="report-kpi red">
                <div className="label">{t('audit_missing')}</div>
                <div className="value" style={{ color: missingExpected.length > 0 ? 'var(--red)' : 'inherit' }}>{missingExpected.length}</div>
              </div>
            </div>

            <div className="report-section-heading">✕ {t('audit_missing_list')} ({missingExpected.length})</div>
            {missingExpected.length === 0 ? (
              <div className="report-empty">{t('audit_none_missing')}</div>
            ) : (
              <table className="report-table" style={{ marginBottom: 20 }}>
                <thead>
                  <tr>
                    <th>{t('col_id')}</th><th>{t('col_brand_model')}</th><th>{t('col_assigned')}</th><th>{t('col_location')}</th><th>{t('col_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {missingExpected.map((a) => (
                    <tr key={a.ID}>
                      <td className="mono">{a.ID}</td>
                      <td>{a.Marka} {a.Model}</td>
                      <td>{a.AtananKisi || '—'}</td>
                      <td>{a.Lokasyon}</td>
                      <td><StatusBadge status={a.Durum} lang={lang} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="report-section-heading">✓ {t('audit_found_list')} ({foundExpected.length})</div>
            {foundExpected.length === 0 ? (
              <div className="report-empty">—</div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>{t('col_id')}</th><th>{t('col_brand_model')}</th><th>{t('col_assigned')}</th><th>{t('col_location')}</th>
                  </tr>
                </thead>
                <tbody>
                  {foundExpected.map((a) => (
                    <tr key={a.ID}>
                      <td className="mono">{a.ID}</td>
                      <td>{a.Marka} {a.Model}</td>
                      <td>{a.AtananKisi || '—'}</td>
                      <td>{a.Lokasyon}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {fixTarget && (
        <AssetForm
          asset={fixTarget}
          lists={lists}
          employees={employees}
          allItems={items}
          onClose={() => setFixTarget(null)}
          onSaved={() => {
            setFixTarget(null);
            api.getInventory().then(setItems);
          }}
        />
      )}
    </div>
  );
}

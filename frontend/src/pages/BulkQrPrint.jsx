import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useLang } from '../i18n.jsx';

const PUBLIC_BASE = import.meta.env.VITE_PUBLIC_BASE_URL || `${window.location.origin}${window.location.pathname}#/asset/`;

export default function BulkQrPrint() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();
  const assets = location.state?.assets || [];

  useEffect(() => {
    if (assets.length === 0) return;
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [assets.length]);

  if (assets.length === 0) {
    return (
      <div>
        <div className="empty-state">
          {t('qr_bulk_none_selected')}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => navigate('/envanter')}>{t('detail_back')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <div className="page-title">{t('qr_bulk_title')}</div>
          <div className="page-sub">{assets.length} {t('qr_bulk_sub')}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/envanter')}>{t('btn_back')}</button>
          <button className="btn btn-primary" onClick={() => window.print()}>{t('btn_print').split(' /')[0]}</button>
        </div>
      </div>

      <div className="qr-print-grid">
        {assets.map((a) => (
          <div key={a.ID} className="qr-print-label">
            <QRCodeSVG value={`${PUBLIC_BASE}${a.ID}`} size={110} />
            <div className="qr-print-id mono">{a.ID}</div>
            <div className="qr-print-name">{a.Marka} {a.Model}</div>
            {a.SeriNo && <div className="qr-print-name mono">SN: {a.SeriNo}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

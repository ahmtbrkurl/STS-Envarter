import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Envanter from './pages/Envanter.jsx';
import AssetDetail from './pages/AssetDetail.jsx';
import Calisanlar from './pages/Calisanlar.jsx';
import Hareketler from './pages/Hareketler.jsx';
import PublicView from './pages/PublicView.jsx';
import TeslimFormu from './pages/TeslimFormu.jsx';
import Ayarlar from './pages/Ayarlar.jsx';
import BulkQrPrint from './pages/BulkQrPrint.jsx';
import Raporlar from './pages/Raporlar.jsx';
import Ihtiyaclar from './pages/Ihtiyaclar.jsx';
import MalzemeGirisCikis from './pages/MalzemeGirisCikis.jsx';
import CalisanDetay from './pages/CalisanDetay.jsx';
import Sayim from './pages/Sayim.jsx';
import Yedekleme from './pages/Yedekleme.jsx';
import SarfMalzemeleri from './pages/SarfMalzemeleri.jsx';
import Faturalar from './pages/Faturalar.jsx';

import Gunluk from './pages/Gunluk.jsx';
import TalepFormu from './pages/TalepFormu.jsx';
import GelenTalepler from './pages/GelenTalepler.jsx';
import NetworkTable from './pages/NetworkTable.jsx';
import { useLang } from './i18n.jsx';
import SyncStatus from './components/SyncStatus.jsx';

function TopBar() {
  const { lang } = useLang();
  const localeMap = { tr: 'tr-TR', ru: 'ru-RU', en: 'en-US' };
  const dateStr = new Date().toLocaleDateString(localeMap[lang], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="topbar no-print">
      <SyncStatus />
      <span>{dateStr}</span>
    </div>
  );
}

function Protected({ children }) {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <TopBar />
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* QR kod okutunca acilan herkese acik sayfa - giris gerekmez */}
      <Route path="/asset/:id" element={<PublicView />} />
      {/* Ekipman Talep Formu - genel link, calisanin kendi Talep Sifresi ile - giris gerekmez */}
      <Route path="/talep" element={<TalepFormu />} />

      <Route path="/login" element={<Login />} />

      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/envanter" element={<Protected><Envanter /></Protected>} />
      <Route path="/envanter/qr-yazdir" element={<Protected><BulkQrPrint /></Protected>} />
      <Route path="/envanter/:id" element={<Protected><AssetDetail /></Protected>} />
      <Route path="/calisanlar" element={<Protected><Calisanlar /></Protected>} />
      <Route path="/calisanlar/:name" element={<Protected><CalisanDetay /></Protected>} />
      <Route path="/hareketler" element={<Protected><Hareketler /></Protected>} />
      <Route path="/teslim-formu" element={<Protected><TeslimFormu /></Protected>} />
      <Route path="/raporlar" element={<Protected><Raporlar /></Protected>} />
      <Route path="/ihtiyaclar" element={<Protected><Ihtiyaclar /></Protected>} />
      <Route path="/faturalar" element={<Protected><Faturalar /></Protected>} />
      <Route path="/gelen-talepler" element={<Protected><GelenTalepler /></Protected>} />
      <Route path="/ag-altyapisi/:table" element={<Protected><NetworkTable /></Protected>} />
      <Route path="/malzeme-giris-cikis" element={<Protected><MalzemeGirisCikis /></Protected>} />
      <Route path="/sayim" element={<Protected><Sayim /></Protected>} />
      <Route path="/yedekleme" element={<Protected><Yedekleme /></Protected>} />
      <Route path="/sarf-malzemeleri" element={<Protected><SarfMalzemeleri /></Protected>} />
      <Route path="/ayarlar" element={<Protected><Ayarlar /></Protected>} />
      <Route path="/gunluk" element={<Protected><Gunluk /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

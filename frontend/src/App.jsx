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

function Protected({ children }) {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">{children}</div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* QR kod okutunca acilan herkese acik sayfa - giris gerekmez */}
      <Route path="/asset/:id" element={<PublicView />} />

      <Route path="/login" element={<Login />} />

      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/envanter" element={<Protected><Envanter /></Protected>} />
      <Route path="/envanter/:id" element={<Protected><AssetDetail /></Protected>} />
      <Route path="/calisanlar" element={<Protected><Calisanlar /></Protected>} />
      <Route path="/hareketler" element={<Protected><Hareketler /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

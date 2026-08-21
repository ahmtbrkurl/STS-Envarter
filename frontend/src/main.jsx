import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles.css';

// HashRouter kullaniyoruz cunku GitHub Pages statik hosting'de
// server-side route yonlendirmesi yok; #/asset/IT-0001 gibi linkler
// dogrudan calisir ve QR kodlar da bu URL'leri kullanir.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);

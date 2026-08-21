import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await login(token, name || 'Kullanici');
      if (ok) navigate('/');
      else setError('Erisim anahtari hatali.');
    } catch (err) {
      setError('Baglanti hatasi: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>BT Varlik Yonetimi</h1>
        <p>Devam etmek icin adinizi ve erisim anahtarini girin.</p>

        <div className="field">
          <label htmlFor="name">Adiniz</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" required />
        </div>

        <div className="field">
          <label htmlFor="token">Erisim anahtari</label>
          <input id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="••••••••" required />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading}>
          {loading ? 'Kontrol ediliyor...' : 'Giris yap'}
        </button>
      </form>
    </div>
  );
}

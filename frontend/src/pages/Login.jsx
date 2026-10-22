import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang, LANGS, LANG_LABELS } from '../i18n.jsx';

export default function Login() {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { lang, setLang, t } = useLang();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await login(token, name || 'Kullanici');
      if (ok) navigate('/');
      else setError(t('login_error'));
    } catch (err) {
      setError('Baglanti hatasi: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="lang-switch" style={{ padding: 0, marginBottom: 16, justifyContent: 'flex-end' }}>
          {LANGS.map((l) => (
            <button key={l} type="button" className={`lang-btn ${lang === l ? 'active' : ''}`} style={{ color: lang === l ? '#fff' : 'var(--ink-soft)', borderColor: 'var(--border)', flex: 'none', padding: '4px 10px' }} onClick={() => setLang(l)}>
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>

        <h1>{t('login_title')}</h1>
        <p>{t('login_sub')}</p>

        <div className="field">
          <label htmlFor="name">{t('login_name')}</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('placeholder_full_name')} required />
        </div>

        <div className="field">
          <label htmlFor="token">{t('login_token')}</label>
          <input id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="••••••••" required />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading}>
          {loading ? t('login_checking') : t('login_submit')}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useLang, translateCategory } from '../i18n.jsx';

export default function GelenTalepler() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [talepler, setTalepler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.getPersonelTalepleri()
      .then(setTalepler)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(talep) {
    setBusyId(talep.ID);
    try {
      await api.onaylaPersonelTalep(talep.ID);
      // Notlar'a, varsa Urun Linki'ni de ekleyip tek bir aciklama metni
      // olustur - NeedForm'un tek bir "Aciklama" alani var, ayri degil.
      const parcalar = [];
      if (talep.Notlar) parcalar.push(talep.Notlar);
      if (talep.UrunLinki) parcalar.push(`${t('talep_urun_linki')}: ${talep.UrunLinki}`);
      if (talep.MevcutEkipmanUyarisi === 'TRUE') parcalar.push(`⚠️ ${t('talep_existing_warning')}`);
      navigate('/ihtiyaclar', {
        state: {
          quickAddPerson: talep.PersonelAdi,
          quickAddKategori: talep.Kategori,
          quickAddMiktar: talep.Adet,
          quickAddAciklama: parcalar.join(' — ')
        }
      });
    } catch (e) {
      setError(e.message);
      setBusyId(null);
    }
  }

  async function handleReject(talep) {
    setBusyId(talep.ID);
    try {
      await api.reddetPersonelTalep(talep.ID);
      setTalepler((prev) => prev.filter((x) => x.ID !== talep.ID));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav_incoming_requests')}</h1>
          <div className="page-sub">{t('gelen_talepler_desc')}</div>
        </div>
      </div>

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {talepler.length === 0 ? (
        <div className="empty-state">{t('gelen_talepler_empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {talepler.map((talep) => (
            <div key={talep.ID} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{talep.PersonelAdi}</div>
                  <div className="page-sub">{talep.Departman || '—'} · {talep.OlusturmaTarihi}</div>
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    <strong>{translateCategory(talep.Kategori, lang)}</strong>
                    <span style={{ color: 'var(--ink-soft)' }}> × {talep.Adet}</span>
                  </div>
                  {talep.Notlar && <div className="page-sub" style={{ marginTop: 4 }}>{talep.Notlar}</div>}
                  {talep.UrunLinki && (
                    <div style={{ marginTop: 4 }}>
                      <a href={talep.UrunLinki} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>🔗 {t('talep_urun_linki')}</a>
                    </div>
                  )}
                  {talep.MevcutEkipmanUyarisi === 'TRUE' && (
                    <div style={{ marginTop: 6, padding: '4px 10px', background: 'var(--amber-soft)', color: 'var(--amber)', borderRadius: 6, fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
                      ⚠️ {t('talep_existing_warning')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleReject(talep)} disabled={busyId === talep.ID}>
                    {t('btn_reject')}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleApprove(talep)} disabled={busyId === talep.ID}>
                    {t('btn_approve')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

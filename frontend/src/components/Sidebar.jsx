import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang, LANGS, LANG_LABELS } from '../i18n.jsx';

export default function Sidebar() {
  const { userName, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const location = useLocation();
  const [networkOpen, setNetworkOpen] = useState(location.pathname.startsWith('/ag-altyapisi'));

  const links = [
    { to: '/', label: t('nav_dashboard'), icon: '◧', end: true },
    { to: '/envanter', label: t('nav_inventory'), icon: '▤' },
    { to: '/calisanlar', label: t('nav_employees'), icon: '◍' },
    { to: '/ihtiyaclar', label: t('nav_needs'), icon: '🕒' },
    { to: '/faturalar', label: t('nav_invoices'), icon: '🧾' },
    { to: '/gelen-talepler', label: t('nav_incoming_requests'), icon: '📥' },
    { to: '/hareketler', label: t('nav_movements'), icon: '⇄' },
    { to: '/sayim', label: t('nav_audit'), icon: '🔍' },
    { to: '/malzeme-giris-cikis', label: t('nav_stock'), icon: '📦' },
    { to: '/sarf-malzemeleri', label: t('nav_sarf'), icon: '🖨️' },
    { to: '/raporlar', label: t('nav_reports'), icon: '📊' },
    { to: '/teslim-formu', label: t('nav_handover'), icon: '📄' },
    { to: '/gunluk', label: t('nav_logs'), icon: '🗒' },
    { to: '/yedekleme', label: t('nav_backup'), icon: '💾' },
    { to: '/ayarlar', label: t('nav_settings'), icon: '⚙' }
  ];

  const networkSubLinks = [
    { to: '/ag-altyapisi/vlan', label: t('net_vlan_title') },
    { to: '/ag-altyapisi/ip', label: t('net_ip_title') },
    { to: '/ag-altyapisi/port', label: t('net_port_title') },
    { to: '/ag-altyapisi/firewall', label: t('net_firewall_title') },
    { to: '/ag-altyapisi/changelog', label: t('net_changelog_title') }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="name">{t('appName')}</div>
        <div className="sub">STS · Envanter Sistemi</div>
      </div>

      <div className="lang-switch">
        {LANGS.map((l) => (
          <button key={l} className={`lang-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
        >
          <span aria-hidden="true">{l.icon}</span>
          {l.label}
        </NavLink>
      ))}

      <button
        className="nav-link"
        onClick={() => setNetworkOpen((v) => !v)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
      >
        <span aria-hidden="true">🌐</span>
        {t('nav_network')}
        <span aria-hidden="true" style={{ marginLeft: 'auto' }}>{networkOpen ? '▾' : '▸'}</span>
      </button>
      {networkOpen && networkSubLinks.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          style={{ paddingLeft: 34, fontSize: 13 }}
        >
          {l.label}
        </NavLink>
      ))}

      <div className="sidebar-footer">
        <div style={{ marginBottom: 8 }}>{userName}</div>
        <button className="btn btn-ghost btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} onClick={logout}>
          {t('btn_logout')}
        </button>
      </div>
    </div>
  );
}

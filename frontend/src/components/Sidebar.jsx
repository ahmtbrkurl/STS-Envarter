import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/', label: 'Panel', icon: '◧', end: true },
  { to: '/envanter', label: 'Envanter', icon: '▤' },
  { to: '/calisanlar', label: 'Calisanlar', icon: '◍' },
  { to: '/hareketler', label: 'Hareketler', icon: '⇄' }
];

export default function Sidebar() {
  const { userName, logout } = useAuth();
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="name">BT Varlik Yonetimi</div>
        <div className="sub">STS · Envanter Sistemi</div>
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
      <div className="sidebar-footer">
        <div style={{ marginBottom: 8 }}>{userName}</div>
        <button className="btn btn-ghost btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} onClick={logout}>
          Cikis yap
        </button>
      </div>
    </div>
  );
}

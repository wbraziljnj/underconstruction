import { NavLink } from 'react-router-dom';

type Item = { to: string; label: string; icon: string };

const items: Item[] = [
  { to: '/home', label: 'Home', icon: '🏠' },
  { to: '/obra', label: 'Obra', icon: '🏡' },
  { to: '/cadastros', label: 'Usuarios', icon: '👤' },
  { to: '/fases', label: 'Fases', icon: '🏗️' },
  { to: '/fatura', label: 'Faturas', icon: '🧾' },
  { to: '/documentacoes', label: 'Documentações', icon: '📄' }
];

export function Sidebar({
  collapsed,
  onToggle
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className="card"
      style={{
        width: collapsed ? 64 : 240,
        transition: 'width 160ms ease',
        padding: 10,
        position: 'sticky',
        top: 12,
        height: 'calc(100vh - 24px)',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(124, 92, 255, 0.22)',
            border: '1px solid rgba(124, 92, 255, 0.5)'
          }}
        >
          UC
        </div>
        {!collapsed && (
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700 }}>Under</div>
            <div style={{ fontWeight: 700 }}>Construction</div>
          </div>
        )}
      </div>

      <button className="btn" onClick={onToggle} style={{ width: '100%', marginTop: 8 }}>
        {collapsed ? '»' : '«'}
      </button>

      <nav style={{ marginTop: 10, display: 'grid', gap: 6 }}>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            title={collapsed ? it.label : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 12,
              textDecoration: 'none',
              border: '1px solid var(--border)',
              background: isActive ? 'rgba(124, 92, 255, 0.22)' : 'transparent'
            })}
          >
            <span style={{ width: 22, textAlign: 'center' }}>{it.icon}</span>
            {!collapsed && <span>{it.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

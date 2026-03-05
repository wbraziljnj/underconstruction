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
  onLogout,
  onToggleTheme,
  onToggle
}: {
  collapsed: boolean;
  onLogout: () => void;
  onToggleTheme: () => void;
  onToggle: () => void;
}) {
  const sideBtnBase: React.CSSProperties = {
    boxSizing: 'border-box',
    width: '100%',
    height: 44,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'transparent',
    textDecoration: 'none',
    color: 'inherit'
  };
  const sideBtnCollapsed: React.CSSProperties = collapsed
    ? { width: 44, margin: '0 auto', justifyContent: 'center', padding: 0, gap: 0 }
    : {};

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
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
        <button
          type="button"
          className="btn"
          onClick={onToggleTheme}
          title="Claro/Escuro"
          style={{
            ...sideBtnBase,
            ...sideBtnCollapsed,
            background: 'rgba(124, 92, 255, 0.12)',
            borderColor: 'rgba(124, 92, 255, 0.45)',
            justifyContent: collapsed ? 'center' : 'flex-start'
          }}
        >
          <span
            style={{
              width: collapsed ? 36 : 28,
              height: collapsed ? 36 : 28,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 10,
              border: '1px solid rgba(124, 92, 255, 0.35)',
              background: 'rgba(0,0,0,0.10)',
              overflow: 'hidden'
            }}
          >
            <img
              src={`${(import.meta as any).env?.BASE_URL ?? '/'}underconstruction-logo.png`}
              alt="Under Construction"
              style={{
                width: collapsed ? 34 : 26,
                height: collapsed ? 34 : 26,
                objectFit: 'contain',
                display: 'block'
              }}
            />
          </span>
          {!collapsed ? <span>Tema</span> : null}
        </button>

        <button
          className="btn"
          onClick={onToggle}
          type="button"
          title="Expandir/Recolher"
          style={{
            ...sideBtnBase,
            ...sideBtnCollapsed,
            justifyContent: collapsed ? 'center' : 'flex-start'
          }}
        >
          <span style={{ width: 22, textAlign: 'center' }}>{collapsed ? '»' : '«'}</span>
          {!collapsed ? <span>Menu</span> : null}
        </button>
      </div>

      <nav style={{ marginTop: 10, display: 'grid', gap: 6, flex: 1, alignContent: 'start' }}>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            title={collapsed ? it.label : undefined}
            style={({ isActive }) => ({
              ...sideBtnBase,
              ...(collapsed ? { ...sideBtnCollapsed, justifyContent: 'center' } : {}),
              background: isActive ? 'rgba(124, 92, 255, 0.22)' : 'transparent'
            })}
          >
            <span style={{ width: 22, textAlign: 'center' }}>{it.icon}</span>
            {!collapsed && <span>{it.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        className="btn"
        type="button"
        onClick={onLogout}
        title="Sair"
        style={{
          ...sideBtnBase,
          ...sideBtnCollapsed,
          justifyContent: 'center',
          marginTop: 10
        }}
      >
        <span style={{ width: 22, textAlign: 'center' }}>⏻</span>
      </button>
    </aside>
  );
}

import { Outlet } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './Sidebar';
import { applyTheme, getStoredTheme, toggleTheme } from '../ui/theme';
import { useAuth } from '../auth/auth';

const NAV_KEY = 'uc_nav_collapsed';

function getStoredCollapsed(): boolean {
  const v = localStorage.getItem(NAV_KEY);
  if (v === '0') return false;
  if (v === '1') return true;
  return true; // default recolhido
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);

  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  const headerRight = useMemo(() => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn" onClick={() => toggleTheme()} title="Tema">
          🌓
        </button>
        <div style={{ opacity: 0.8, fontSize: 12 }}>{user?.nome}</div>
        <button className="btn" onClick={() => logout()} title="Sair">
          Sair
        </button>
      </div>
    );
  }, [logout, user?.nome]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, padding: 12 }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          const next = !collapsed;
          setCollapsed(next);
          localStorage.setItem(NAV_KEY, next ? '1' : '0');
        }}
      />
      <main style={{ minWidth: 0 }}>
        <header
          className="card"
          style={{
            padding: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>Under Construction</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {user?.tipoUsuario ? `Tipo: ${user.tipoUsuario}` : 'Organização da obra'}
            </div>
          </div>
          {headerRight}
        </header>
        <Outlet />
      </main>
    </div>
  );
}

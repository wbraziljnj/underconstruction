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
  const { user, logout, selectObra } = useAuth();
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
        {user?.codes?.length ? (
          <select
            className="input"
            style={{ width: 160 }}
            value={user.activeCode ?? ''}
            onChange={async (e) => {
              const codigo = e.target.value;
              if (!codigo) return;
              try {
                await selectObra(codigo);
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Falha ao selecionar obra');
              }
            }}
            title="Obra ativa"
          >
            {user.codes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
        <div style={{ display: 'grid', lineHeight: 1.1 }}>
          <div style={{ opacity: 0.9, fontSize: 12 }}>{user?.nome}</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>{user?.tipoUsuario || ''}</div>
        </div>
        <button className="btn" onClick={() => logout()} title="Sair">
          Sair
        </button>
      </div>
    );
  }, [logout, selectObra, user?.activeCode, user?.codes, user?.nome, user?.tipoUsuario]);

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
            <div style={{ opacity: 0.7, fontSize: 12 }}>Organização da obra</div>
          </div>
          {headerRight}
        </header>
        <Outlet />
      </main>
    </div>
  );
}

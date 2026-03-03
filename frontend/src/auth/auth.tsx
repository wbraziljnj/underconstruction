import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';

export type AuthUser = {
  userId: string;
  nome: string;
  email: string;
  tipoUsuario: string;
  codes: string[];
  activeCode: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  selectObra: (codigo: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const ACTIVE_CODE_KEY = 'uc_active_code';

  function storeActiveCode(code: string | null) {
    if (!code) {
      localStorage.removeItem(ACTIVE_CODE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_CODE_KEY, code);
  }

  async function refresh() {
    try {
      const me = await apiFetch<AuthUser | null>('/me', { method: 'GET' });
      setUser(me);
      if (me) {
        const stored = localStorage.getItem(ACTIVE_CODE_KEY);
        if (stored && me.codes?.includes(stored) && me.activeCode !== stored) {
          await apiFetch('/obras/select', { method: 'POST', json: { codigo: stored } });
          setUser({ ...me, activeCode: stored });
          storeActiveCode(stored);
        } else {
          storeActiveCode(me.activeCode ?? null);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const u = await apiFetch<AuthUser>('/login', { method: 'POST', json: { email, password } });
        setUser(u);
        storeActiveCode(u.activeCode ?? null);
      },
      logout: async () => {
        await apiFetch('/logout', { method: 'POST' });
        setUser(null);
        storeActiveCode(null);
      },
      refresh
      ,
      selectObra: async (codigo: string) => {
        await apiFetch('/obras/select', { method: 'POST', json: { codigo } });
        setUser((prev) => (prev ? { ...prev, activeCode: codigo } : prev));
        storeActiveCode(codigo);
      }
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

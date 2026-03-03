import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';

export type AuthUser = {
  userId: string;
  nome: string;
  email: string;
  tipoUsuario: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await apiFetch<AuthUser | null>('/me', { method: 'GET' });
      setUser(me);
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
      },
      logout: async () => {
        await apiFetch('/logout', { method: 'POST' });
        setUser(null);
      },
      refresh
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


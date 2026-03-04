import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/auth';

type Summary = {
  activeCode: string;
  fases: {
    abertas: number;
    andamentos: number;
    pendentes: number;
    finalizadas: number;
  };
  faturas: {
    aberto: number;
    pendente: number;
    pago: number;
  };
  usuariosTotal: number;
};

export default function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await apiFetch<Summary>('/home/summary', { method: 'GET' });
        if (!alive) return;
        setSummary(s);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Falha ao carregar totalizadores');
        setSummary(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.activeCode]);

  const v = summary;
  const phases = v?.fases;
  const faturas = v?.faturas;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {error ? (
        <div className="card" style={{ padding: 12, color: 'var(--danger)' }}>
          {error}
        </div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Fases abertas</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{loading ? '—' : phases?.abertas ?? 0}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Fases andamentos</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{loading ? '—' : phases?.andamentos ?? 0}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Fases pendentes</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{loading ? '—' : phases?.pendentes ?? 0}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Fases finalizadas</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{loading ? '—' : phases?.finalizadas ?? 0}</div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>Faturas</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(255, 193, 7, 0.18)',
                border: '1px solid rgba(255, 193, 7, 0.35)'
              }}
            >
              <span style={{ opacity: 0.8, fontSize: 12 }}>Aberto</span>
              <b>{loading ? '—' : faturas?.aberto ?? 0}</b>
            </div>
            <div
              style={{
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(244, 67, 54, 0.14)',
                border: '1px solid rgba(244, 67, 54, 0.28)'
              }}
            >
              <span style={{ opacity: 0.8, fontSize: 12 }}>Pendente</span>
              <b>{loading ? '—' : faturas?.pendente ?? 0}</b>
            </div>
            <div
              style={{
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(76, 175, 80, 0.14)',
                border: '1px solid rgba(76, 175, 80, 0.28)'
              }}
            >
              <span style={{ opacity: 0.8, fontSize: 12 }}>Pago</span>
              <b>{loading ? '—' : faturas?.pago ?? 0}</b>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Usuários (obra ativa)</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{loading ? '—' : v?.usuariosTotal ?? 0}</div>
          <div style={{ opacity: 0.6, fontSize: 12, marginTop: 4 }}>{v?.activeCode ? `Código: ${v.activeCode}` : ''}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Timeline</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>As fases cadastradas aparecerão aqui, ordenadas por data início.</div>
      </section>
    </div>
  );
}

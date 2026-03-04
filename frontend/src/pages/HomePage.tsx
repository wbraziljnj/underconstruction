import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/auth';
import { useNavigate } from 'react-router-dom';
import { getPhaseIcon } from '../ui/phaseIcons';

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
  documentos?: {
    aberto: number;
    pendente: number;
    finalizado: number;
  };
  usuariosTotal: number;
};

type TimelineItem = {
  faseId: string;
  fase: string;
  subfase: string | null;
  status: 'ABERTO' | 'ANDAMENTO' | 'PENDENTE' | 'FINALIZADO' | string;
  dataInicio: string;
  previsaoFinalizacao: string;
  dataFinalizacao: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  faturasCount: number;
  docsCount: number;
};

function formatBrDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function statusStyle(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'ABERTO') return { label: 'Aberto', bg: 'rgba(255, 193, 7, 0.18)', bd: 'rgba(255, 193, 7, 0.35)', fg: '#d4a000' };
  if (s === 'ANDAMENTO')
    return { label: 'Andamento', bg: 'rgba(33, 150, 243, 0.14)', bd: 'rgba(33, 150, 243, 0.28)', fg: '#1c7ed6' };
  if (s === 'PENDENTE') return { label: 'Pendente', bg: 'rgba(244, 67, 54, 0.14)', bd: 'rgba(244, 67, 54, 0.28)', fg: '#d64545' };
  if (s === 'FINALIZADO') return { label: 'Finalizado', bg: 'rgba(76, 175, 80, 0.14)', bd: 'rgba(76, 175, 80, 0.28)', fg: '#2f9e44' };
  return { label: status || '—', bg: 'rgba(255,255,255,0.06)', bd: 'rgba(255,255,255,0.12)', fg: 'inherit' };
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);

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

  useEffect(() => {
    let alive = true;
    (async () => {
      setTimelineLoading(true);
      setTimelineError(null);
      try {
        const res = await apiFetch<{ items: TimelineItem[] }>('/home/timeline', { method: 'GET' });
        if (!alive) return;
        setTimeline(res.items || []);
      } catch (e) {
        if (!alive) return;
        setTimelineError(e instanceof Error ? e.message : 'Falha ao carregar timeline');
        setTimeline([]);
      } finally {
        if (!alive) return;
        setTimelineLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.activeCode]);

  const v = summary;
  const phases = v?.fases;
  const faturas = v?.faturas;
  const timelineRows = timeline || [];
  const hasTimeline = timelineRows.length > 0;
  const timelineTitle = useMemo(() => (hasTimeline ? 'Timeline da obra' : 'Timeline'), [hasTimeline]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {error ? (
        <div className="card" style={{ padding: 12, color: 'var(--danger)' }}>
          {error}
        </div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>Fases</div>
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
              <span style={{ opacity: 0.8, fontSize: 12 }}>Abertas</span>
              <b>{loading ? '—' : phases?.abertas ?? 0}</b>
            </div>
            <div
              style={{
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(33, 150, 243, 0.14)',
                border: '1px solid rgba(33, 150, 243, 0.28)'
              }}
            >
              <span style={{ opacity: 0.8, fontSize: 12 }}>Andamentos</span>
              <b>{loading ? '—' : phases?.andamentos ?? 0}</b>
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
              <span style={{ opacity: 0.8, fontSize: 12 }}>Pendentes</span>
              <b>{loading ? '—' : phases?.pendentes ?? 0}</b>
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
              <span style={{ opacity: 0.8, fontSize: 12 }}>Finalizadas</span>
              <b>{loading ? '—' : phases?.finalizadas ?? 0}</b>
            </div>
          </div>
        </div>

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
          <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>Documentos</div>
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
              <b>{loading ? '—' : v?.documentos?.aberto ?? 0}</b>
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
              <b>{loading ? '—' : v?.documentos?.pendente ?? 0}</b>
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
              <span style={{ opacity: 0.8, fontSize: 12 }}>Finalizado</span>
              <b>{loading ? '—' : v?.documentos?.finalizado ?? 0}</b>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontWeight: 800 }}>{timelineTitle}</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>{v?.activeCode ? `Código: ${v.activeCode}` : ''}</div>
        </div>

        <style>{`
          .uc-timeline{ position:relative; padding: 14px 0; }
          .uc-timeline::before{ content:""; position:absolute; left:50%; top:10px; bottom:10px; width:2px; transform:translateX(-50%); background:rgba(255,255,255,0.14); }
          /* Mantém a bolinha exatamente no centro vertical do card do lado. */
          .uc-tl-item{ position:relative; display:grid; grid-template-columns: 1fr 64px 1fr; align-items:stretch; margin: 14px 0; }
          .uc-tl-item:nth-child(odd) .uc-tl-card{ grid-column: 1 / 2; justify-self:end; }
          .uc-tl-item:nth-child(even) .uc-tl-card{ grid-column: 3 / 4; justify-self:start; }
          /* Garante que a bolinha sempre alinhe no centro vertical do retângulo (lado esquerdo/direito) */
          .uc-tl-center{ position:absolute; left:50%; top:50%; transform:translate(-50%, -50%); display:flex; pointer-events:none; }
          .uc-tl-dot{ width:44px; height:44px; margin:auto; border-radius:999px; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.16); box-shadow: 0 8px 22px rgba(0,0,0,0.15); }
          .uc-tl-card{ width:min(520px, 44vw); align-self:stretch; display:flex; }
          .uc-tl-card-inner{ width:100%; }
          .uc-tl-card-inner{ padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 10px 26px rgba(0,0,0,0.14); }
          .uc-tl-top{ display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
          .uc-tl-title{ font-weight: 800; font-size: 14px; }
          .uc-tl-sub{ opacity: 0.75; font-size: 12px; margin-top: 2px; }
          .uc-tl-date{ opacity: 0.8; font-size: 12px; white-space:nowrap; }
          .uc-tl-body{ margin-top: 10px; display:flex; flex-wrap:wrap; gap:8px; }
          .uc-chip{ display:inline-flex; align-items:center; gap:6px; padding: 6px 10px; border-radius:999px; font-size:12px; opacity:0.95; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); }
          .uc-tl-footer{ margin-top: 12px; display:flex; justify-content:space-between; gap:10px; align-items:center; }
          .uc-tl-resp{ opacity:0.85; font-size: 12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 55%; }
          @media (max-width: 860px){
            .uc-timeline::before{ left:18px; transform:none; }
            .uc-tl-item{ grid-template-columns: 44px 1fr; }
            .uc-tl-center{ left:18px; transform: translateY(-50%); }
            .uc-tl-card{ grid-column: 2 / 3 !important; justify-self:stretch !important; width: 100%; }
          }
        `}</style>

        {timelineError ? (
          <div style={{ marginTop: 10, color: 'var(--danger)', fontSize: 13 }}>{timelineError}</div>
        ) : timelineLoading ? (
          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>Carregando timeline...</div>
        ) : !hasTimeline ? (
          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
            Nenhuma fase cadastrada ainda. Cadastre em <b>Fases</b> para aparecer aqui.
          </div>
        ) : (
          <div className="uc-timeline">
            {timelineRows.map((t, idx) => {
              const st = statusStyle(t.status);
              return (
                <div className="uc-tl-item" key={t.faseId || `${t.fase}-${idx}`}>
                  <div className="uc-tl-card">
                    <div className="uc-tl-card-inner">
                      <div className="uc-tl-top">
                        <div>
                          <div className="uc-tl-title">{t.fase}</div>
                          <div className="uc-tl-sub">{t.subfase ? t.subfase : '—'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="uc-tl-date">{formatBrDate(t.dataInicio)}</div>
                          <div
                            style={{
                              display: 'inline-flex',
                              marginTop: 6,
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: st.bg,
                              border: `1px solid ${st.bd}`,
                              color: st.fg,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {st.label}
                          </div>
                        </div>
                      </div>

                      <div className="uc-tl-body">
                        <span className="uc-chip">🧾 {t.faturasCount} faturas</span>
                        <span className="uc-chip">📎 {t.docsCount} documentos</span>
                      </div>

                      <div className="uc-tl-footer">
                        <button className="btn" type="button" onClick={() => navigate('/fases')}>
                          Ver
                        </button>
                        <div className="uc-tl-resp">
                          <span style={{ opacity: 0.75 }}>Responsável:</span>{' '}
                          <b>{t.responsavelNome || '—'}</b>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="uc-tl-center">
                    <div className="uc-tl-dot" title={t.fase}>
                      {getPhaseIcon(t.fase)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

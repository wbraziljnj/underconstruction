import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/auth';
import { useNavigate } from 'react-router-dom';
import { getPhaseIcon } from '../ui/phaseIcons';
import Modal from '../ui/Modal';

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

type FaturaResumo = {
  faturaId: string;
  descricao?: string;
  valor?: string;
  pagamento?: string;
  status?: string;
};

type DocumentoResumo = {
  docsId: number;
  documento: string;
  pagamentoStatus?: string;
  status?: string;
  valor?: string;
  responsavelNome?: string | null;
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

function paymentColor(status: string) {
  const s = (status || '').toUpperCase();
  if (s === 'ABERTO') return '#d4a000';
  if (s === 'PENDENTE') return '#d64545';
  if (s === 'PAGO') return '#2f9e44';
  return 'inherit';
}

function formatCurrency(value: any) {
  const num = Number(value);
  if (Number.isFinite(num)) return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return value ?? '-';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalFaturas, setModalFaturas] = useState<FaturaResumo[]>([]);
  const [modalDocs, setModalDocs] = useState<DocumentoResumo[]>([]);
  const [selected, setSelected] = useState<TimelineItem | null>(null);

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

  async function openDetails(item: TimelineItem) {
    setSelected(item);
    setModalOpen(true);
    setModalLoading(true);
    setModalFaturas([]);
    setModalDocs([]);
    try {
      const [fRes, dRes] = await Promise.all([
        apiFetch<{ items: any[] }>(`/faturas?fase_id=${encodeURIComponent(item.faseId)}`, { method: 'GET' }).catch(() => ({ items: [] })),
        apiFetch<{ items: any[] }>(`/documentacoes?fase=${encodeURIComponent(item.fase)}`, { method: 'GET' }).catch(() => ({ items: [] }))
      ]);
      const faturasResumo: FaturaResumo[] = (fRes.items || []).map((f: any) => ({
        faturaId: String(f.faturaId || f.fatura_id || f.id || ''),
        descricao: f.descricao || f.titulo || f.nome || '',
        valor: f.valor ?? f.total ?? '',
        total: f.total ?? '',
        quantidade: f.quantidade ?? f.qtd ?? '',
        pagamento: f.pagamento || '',
        status: f.status || '',
        fase: f.faseNome || f.fase || '',
        responsavel: f.responsavelNome || '',
        empresa: f.empresaNome || '',
        vencimento: f.dataVencimento || f.vencimento || f.data_vencimento || ''
      }));
      const docsResumo: DocumentoResumo[] = (dRes.items || []).map((d: any) => ({
        docsId: Number(d.docsId || d.docs_id || 0),
        documento: d.documento || '',
        pagamentoStatus: d.pagamentoStatus || d.pagamento_status || '',
        status: d.status || '',
        valor: d.valor ?? '',
        fase: d.fase || '',
        subfase: d.subfase || '',
        responsavelNome: d.responsavelNome ?? d.responsavel_nome ?? null,
        tipoAssinatura: d.tipoAssinatura || d.tipo_assinatura || '',
        assinaturaNome: d.assinaturaNome || d.assinatura_nome || '',
        dataInclusao: d.dataInclusao || d.data_inclusao || '',
        dataEntrega: d.dataEntrega || d.data_entrega || '',
        notas: d.notas || ''
      }));
      setModalFaturas(faturasResumo);
      setModalDocs(docsResumo);
    } finally {
      setModalLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      {error ? (
        <div className="card" style={{ padding: 12, color: 'var(--danger)' }}>
          {error}
        </div>
      ) : null}

      <style>{`
        .uc-home-summary { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:12px; min-width:0; }
        @media (max-width: 720px){
          .uc-home-summary { grid-template-columns: 1fr; }
        }
      `}</style>

      <section className="uc-home-summary">
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

      <section className="card" style={{ padding: 12, minWidth: 0, overflowX: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontWeight: 800 }}>{timelineTitle}</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>{v?.activeCode ? `Código: ${v.activeCode}` : ''}</div>
        </div>

        <style>{`
          .uc-timeline{ position:relative; padding: 14px 0; --uc-line: rgba(255,255,255,0.14); --uc-card-bg: rgba(255,255,255,0.04); --uc-card-bd: rgba(255,255,255,0.10); --uc-dot-bd: rgba(255,255,255,0.16); --uc-chip-bg: rgba(255,255,255,0.05); --uc-chip-bd: rgba(255,255,255,0.10); }
          @media (prefers-color-scheme: light){
            /* Linha em azul escuro no modo claro */
            .uc-timeline{ --uc-line: rgba(10, 52, 89, 0.65); --uc-card-bg: rgba(0,0,0,0.02); --uc-card-bd: rgba(0,0,0,0.10); --uc-dot-bd: rgba(0,0,0,0.14); --uc-chip-bg: rgba(0,0,0,0.04); --uc-chip-bd: rgba(0,0,0,0.08); }
          }
          .uc-timeline::before{ content:""; position:absolute; left:50%; top:10px; bottom:10px; width:2px; transform:translateX(-50%); background:var(--uc-line); }
          /* Mantém a bolinha exatamente no centro vertical do card do lado. */
          .uc-tl-item{ position:relative; display:grid; grid-template-columns: 1fr 64px 1fr; align-items:stretch; margin: 14px 0; }
          .uc-tl-item:nth-child(odd) .uc-tl-card{ grid-column: 1 / 2; justify-self:end; }
          .uc-tl-item:nth-child(even) .uc-tl-card{ grid-column: 3 / 4; justify-self:start; }
          /* Garante que a bolinha sempre alinhe no centro vertical do retângulo (lado esquerdo/direito) */
          .uc-tl-center{ position:absolute; left:50%; top:50%; transform:translate(-50%, -50%); display:flex; pointer-events:none; }
          .uc-tl-dot{ width:44px; height:44px; margin:auto; border-radius:999px; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.07); border: 1px solid var(--uc-dot-bd); box-shadow: 0 8px 22px rgba(0,0,0,0.15); }
          .uc-tl-card{ width:min(520px, 44vw); align-self:stretch; display:flex; }
          .uc-tl-card-inner{ width:100%; }
          .uc-tl-card-inner{ padding: 14px; border-radius: 12px; background: var(--uc-card-bg); border: 1px solid var(--uc-card-bd); box-shadow: 0 10px 26px rgba(0,0,0,0.14); }
          .uc-tl-top{ display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
          .uc-tl-title{ font-weight: 800; font-size: 14px; }
          .uc-tl-sub{ opacity: 0.75; font-size: 12px; margin-top: 2px; }
          .uc-tl-date{ opacity: 0.8; font-size: 12px; white-space:nowrap; }
          .uc-tl-body{ margin-top: 10px; display:flex; flex-wrap:wrap; gap:8px; }
          .uc-chip{ display:inline-flex; align-items:center; gap:6px; padding: 6px 10px; border-radius:999px; font-size:12px; opacity:0.95; background: var(--uc-chip-bg); border: 1px solid var(--uc-chip-bd); }
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
                    <button className="btn" type="button" onClick={() => openDetails(t)}>
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
                    <div
                      className="uc-tl-dot"
                      title={t.fase}
                      style={{ background: statusStyle(t.status).bg, borderColor: statusStyle(t.status).bd, color: statusStyle(t.status).fg }}
                    >
                      {getPhaseIcon(t.fase)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={modalOpen} title="Detalhes da fase" onClose={() => setModalOpen(false)} footer={null}>
        {selected ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontWeight: 800 }}>{selected.fase}</div>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: statusStyle(selected.status).bg, border: `1px solid ${statusStyle(selected.status).bd}`, color: statusStyle(selected.status).fg }}>
                  {statusStyle(selected.status).label}
                </span>
              </div>
              <div style={{ opacity: 0.8, marginTop: 4 }}>{selected.subfase || '—'}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, marginTop: 8 }}>
                <span>Início: <b>{formatBrDate(selected.dataInicio)}</b></span>
                <span>Previsão: <b>{formatBrDate(selected.previsaoFinalizacao)}</b></span>
                <span>Finalização: <b>{formatBrDate(selected.dataFinalizacao)}</b></span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <span style={{ opacity: 0.8 }}>Responsável: </span>
                <b>{selected.responsavelNome || '—'}</b>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, display: 'flex', gap: 8 }}>
                <span style={{ opacity: 0.8 }}>Faturas:</span>
                <b>{selected.faturasCount}</b>
                <span style={{ opacity: 0.8 }}>Documentos:</span>
                <b>{selected.docsCount}</b>
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Faturas</div>
              {modalLoading ? (
                <div style={{ opacity: 0.7, fontSize: 12 }}>Carregando faturas...</div>
              ) : modalFaturas.length === 0 ? (
                <div style={{ opacity: 0.7, fontSize: 12 }}>Nenhuma fatura.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {modalFaturas.map((f) => (
                    <div key={f.faturaId} className="card" style={{ padding: 10, borderColor: 'var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <div style={{ fontWeight: 700 }}>{f.descricao || `Fatura ${f.faturaId}`}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {f.pagamento ? (
                            <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 999, background: 'rgba(255,193,7,0.14)', border: '1px solid rgba(255,193,7,0.28)', color: paymentColor((f.pagamento || '').toUpperCase()) }}>
                              Pagamento: {f.pagamento}
                            </span>
                          ) : null}
                          {f.status ? (
                            <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 999, background: statusStyle(f.status).bg, border: `1px solid ${statusStyle(f.status).bd}`, color: statusStyle(f.status).fg }}>
                              {statusStyle(f.status).label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{f.fase || '—'}</div>
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span>Valor: <b>{formatCurrency(f.valor)}</b></span>
                        {f.quantidade ? <span>Qtd: <b>{f.quantidade}</b></span> : null}
                        {f.total ? <span>Total: <b>{formatCurrency(f.total)}</b></span> : null}
                        {f.vencimento ? <span>Vencimento: <b>{formatBrDate(f.vencimento)}</b></span> : null}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {f.responsavel ? <span>Responsável: <b>{f.responsavel}</b></span> : null}
                        {f.empresa ? <span>Empresa: <b>{f.empresa}</b></span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Documentos</div>
              {modalLoading ? (
                <div style={{ opacity: 0.7, fontSize: 12 }}>Carregando documentos...</div>
              ) : modalDocs.length === 0 ? (
                <div style={{ opacity: 0.7, fontSize: 12 }}>Nenhum documento.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {modalDocs.map((d) => (
                    <div key={d.docsId} className="card" style={{ padding: 10, borderColor: 'var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <div style={{ fontWeight: 700 }}>{d.documento}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {d.pagamentoStatus ? (
                            <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 999, background: 'rgba(255,193,7,0.14)', border: '1px solid rgba(255,193,7,0.28)', color: paymentColor((d.pagamentoStatus || '').toUpperCase()) }}>
                              Pagamento: {d.pagamentoStatus}
                            </span>
                          ) : null}
                          {d.status ? (
                            <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 999, background: statusStyle(d.status).bg, border: `1px solid ${statusStyle(d.status).bd}`, color: statusStyle(d.status).fg }}>
                              {statusStyle(d.status).label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{d.subfase || d.fase || '—'}</div>
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span>Valor: <b>{formatCurrency(d.valor)}</b></span>
                        {d.dataInclusao ? <span>Inclusão: <b>{formatBrDate(d.dataInclusao)}</b></span> : null}
                        {d.dataEntrega ? <span>Entrega: <b>{formatBrDate(d.dataEntrega)}</b></span> : null}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {d.tipoAssinatura ? <span>Tipo assinatura: <b>{d.tipoAssinatura}</b></span> : null}
                        {d.assinaturaNome ? <span>Assinatura: <b>{d.assinaturaNome}</b></span> : null}
                        <span>Responsável: <b>{d.responsavelNome || '—'}</b></span>
                      </div>
                      {d.notas ? (
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                          Notas: {d.notas}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

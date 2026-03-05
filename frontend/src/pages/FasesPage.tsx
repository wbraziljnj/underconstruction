import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/auth';
import { getPhaseIcon } from '../ui/phaseIcons';

const PHASES: { fase: string; subfases: string[] }[] = [
  {
    fase: '01 - Estudo e Planejamento',
    subfases: [
      '01.01 - Levantamento do terreno',
      '01.02 - Levantamento topográfico',
      '01.03 - Sondagem do solo (SPT)',
      '01.04 - Estudo de viabilidade da obra',
      '01.05 - Definição do programa da obra',
      '01.06 - Estimativa inicial de custo'
    ]
  },
  {
    fase: '02 - Projetos Técnicos',
    subfases: [
      '02.01 - Projeto arquitetônico',
      '02.02 - Projeto estrutural',
      '02.03 - Projeto elétrico',
      '02.04 - Projeto hidráulico',
      '02.05 - Projeto sanitário',
      '02.06 - Projeto de águas pluviais',
      '02.07 - Projeto de fundação',
      '02.08 - Projeto de cobertura',
      '02.09 - Compatibilização de projetos'
    ]
  },
  {
    fase: '03 - Aprovações e Documentação',
    subfases: [
      '03.01 - Aprovação do projeto na prefeitura',
      '03.02 - Emissão do alvará de construção',
      '03.03 - Registro da ART no CREA',
      '03.04 - Cadastro da obra no CNO/INSS',
      '03.05 - Elaboração do PGRCC'
    ]
  },
  {
    fase: '04 - Preparação da Obra',
    subfases: [
      '04.01 - Limpeza do terreno',
      '04.02 - Terraplanagem',
      '04.03 - Marcação da obra (gabarito)',
      '04.04 - Instalação do canteiro de obras',
      '04.05 - Ligação provisória de água',
      '04.06 - Ligação provisória de energia'
    ]
  },
  {
    fase: '05 - Fundação',
    subfases: [
      '05.01 - Escavação das fundações',
      '05.02 - Execução de estacas ou brocas',
      '05.03 - Execução de sapatas ou blocos',
      '05.04 - Execução de vigas baldrame',
      '05.05 - Impermeabilização da fundação',
      '05.06 - Aterro e compactação'
    ]
  },
  {
    fase: '06 - Estrutura',
    subfases: [
      '06.01 - Execução de pilares',
      '06.02 - Execução de vigas estruturais',
      '06.03 - Execução de lajes',
      '06.04 - Execução de escadas',
      '06.05 - Cura do concreto'
    ]
  },
  {
    fase: '07 - Alvenaria',
    subfases: [
      '07.01 - Levantamento de paredes externas',
      '07.02 - Levantamento de paredes internas',
      '07.03 - Execução de vergas',
      '07.04 - Execução de contravergas',
      '07.05 - Amarrações estruturais'
    ]
  },
  {
    fase: '08 - Cobertura',
    subfases: [
      '08.01 - Estrutura do telhado',
      '08.02 - Instalação de caibros e ripas',
      '08.03 - Instalação das telhas',
      '08.04 - Instalação de cumeeiras',
      '08.05 - Instalação de calhas',
      '08.06 - Instalação de rufos'
    ]
  },
  {
    fase: '09 - Instalações',
    subfases: [
      '09.01 - Infraestrutura elétrica',
      '09.02 - Infraestrutura hidráulica',
      '09.03 - Instalação de rede de esgoto',
      '09.04 - Instalação de rede de água fria',
      '09.05 - Instalação de água quente',
      '09.06 - Sistema de drenagem'
    ]
  },
  {
    fase: '10 - Fechamentos',
    subfases: [
      '10.01 - Instalação de portas',
      '10.02 - Instalação de janelas',
      '10.03 - Instalação de portões'
    ]
  },
  {
    fase: '11 - Revestimentos',
    subfases: [
      '11.01 - Execução de chapisco',
      '11.02 - Execução de emboço',
      '11.03 - Execução de reboco',
      '11.04 - Instalação de gesso ou drywall',
      '11.05 - Regularização de pisos'
    ]
  },
  {
    fase: '12 - Acabamentos',
    subfases: [
      '12.01 - Instalação de pisos',
      '12.02 - Instalação de revestimentos cerâmicos',
      '12.03 - Pintura interna',
      '12.04 - Pintura externa',
      '12.05 - Instalação de rodapés',
      '12.06 - Instalação de forros'
    ]
  },
  {
    fase: '13 - Instalações Finais',
    subfases: [
      '13.01 - Instalação de tomadas',
      '13.02 - Instalação de interruptores',
      '13.03 - Instalação de luminárias',
      '13.04 - Instalação de louças sanitárias',
      '13.05 - Instalação de metais (torneiras e registros)',
      '13.06 - Instalação de chuveiros'
    ]
  },
  {
    fase: '14 - Área Externa',
    subfases: [
      '14.01 - Execução de calçadas',
      '14.02 - Execução de garagem',
      '14.03 - Construção de muros',
      '14.04 - Instalação de portão',
      '14.05 - Paisagismo'
    ]
  },
  {
    fase: '15 - Finalização',
    subfases: [
      '15.01 - Limpeza final da obra',
      '15.02 - Testes das instalações',
      '15.03 - Vistoria final',
      '15.04 - Emissão do habite-se',
      '15.05 - Entrega da obra'
    ]
  }
];

function getSubfasesByFase(fase: string): string[] {
  const entry = PHASES.find((p) => p.fase === fase);
  return entry ? entry.subfases : [];
}

const schema = z.object({
  fase: z.string().min(1, 'Fase obrigatória'),
  subfase: z.string().min(1, 'Subfase obrigatória'),
  status: z.enum(['ABERTO', 'ANDAMENTO', 'PENDENTE', 'FINALIZADO']),
  data_inicio: z.string().min(1, 'Data início obrigatória'),
  previsao_finalizacao: z.string().min(1, 'Previsão obrigatória'),
  data_finalizacao: z.string().optional(),
  responsavel_id: z.string().optional(),
  valor_previsao: z.coerce.number().nonnegative('Valor previsão inválido'),
  notas: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

type UserOption = { userId: string; nome: string; tipoUsuario: string; status: string };

function formatBrDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toDateOnlyLocal(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function statusColor(status?: string) {
  const s = (status || '').toUpperCase();
  if (s === 'ABERTO') return '#d4aa00'; // amarelo
  if (s === 'PENDENTE') return '#d33'; // vermelho
  if (s === 'FINALIZADO') return '#229954'; // verde
  return 'inherit';
}

function PencilIcon({ title = 'Editar' }: { title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export default function FasesPage() {
  const { user } = useAuth();
  const canWrite = ['Owner', 'Proprietario', 'Gerente', 'Engenheiro', 'Arquiteto'].includes(user?.tipoUsuario || '');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [subfasesOptions, setSubfasesOptions] = useState<string[]>(getSubfasesByFase(PHASES[0]?.fase ?? ''));

  const defaults = useMemo<FormValues>(
    () => ({
      fase: PHASES[0]?.fase ?? '',
      subfase: PHASES[0]?.subfases?.[0] ?? '',
      status: 'ABERTO',
      data_inicio: '',
      previsao_finalizacao: '',
      data_finalizacao: '',
      responsavel_id: '',
      valor_previsao: 0,
      notas: ''
    }),
    []
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults
  });

  const selectedFase = form.watch('fase');

  function openEditModal(row: any) {
    setMode('edit');
    setEditingRow(row);
    const subs = getSubfasesByFase(row?.fase || '');
    setSubfasesOptions(subs);
    form.reset({
      fase: row?.fase || '',
      subfase: row?.subfase || subs[0] || '',
      status: row?.status || 'ABERTO',
      data_inicio: toDateOnlyLocal(row?.dataInicio),
      previsao_finalizacao: toDateOnlyLocal(row?.previsaoFinalizacao),
      data_finalizacao: toDateOnlyLocal(row?.dataFinalizacao),
      responsavel_id: row?.responsavelId ? String(row.responsavelId) : '',
      valor_previsao: Number(row?.valorPrevisao || 0),
      notas: row?.notas || ''
    });
    setOpen(true);
  }

  async function load() {
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (statusFilter) params.set('status', statusFilter);
      const res = await apiFetch<{ items: any[] }>(`/fases?${params.toString()}`, { method: 'GET' });
      setRows(res.items || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Falha ao carregar fases');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.activeCode]);

  useEffect(() => {
    const subs = selectedFase ? getSubfasesByFase(selectedFase) : [];
    setSubfasesOptions(subs);
    if (subs.length && !subs.includes(form.watch('subfase'))) {
      form.setValue('subfase', subs[0] ?? '', { shouldValidate: true });
    }
    if (!subs.length) {
      form.setValue('subfase', '', { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFase]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        setOptionsError(null);
        const u = await apiFetch<UserOption[]>('/cadastros/options', { method: 'GET' });
        if (!alive) return;
        setUsers(u || []);
      } catch (e) {
        if (!alive) return;
        setOptionsError(e instanceof Error ? e.message : 'Falha ao carregar usuários');
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, user?.activeCode]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Fases</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Cadastro e acompanhamento das fases da obra</div>
        </div>
        <button
          className="btn primary"
          disabled={!canWrite}
          onClick={() => {
            setMode('create');
            setEditingRow(null);
            form.reset(defaults);
            setSubfasesOptions(getSubfasesByFase(defaults.fase));
            setOpen(true);
          }}
        >
          + Nova
        </button>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10 }}>
        <input
          className="input"
          placeholder="Buscar por fase / responsável"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div />
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Status (todos)</option>
          <option value="ABERTO">Aberto</option>
          <option value="ANDAMENTO">Andamento</option>
          <option value="FINALIZADO">Finalizado</option>
          <option value="PENDENTE">Pendente</option>
        </select>
        <button className="btn" onClick={() => load()} disabled={loading}>
          Filtrar
        </button>
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.8 }}>
              <th style={{ padding: 10 }}>Fase</th>
              <th style={{ padding: 10 }}>Subfase</th>
              <th style={{ padding: 10 }}>Início</th>
              <th style={{ padding: 10 }}>Previsão</th>
              <th style={{ padding: 10 }}>Finalização</th>
              <th style={{ padding: 10 }}>Responsável</th>
              <th style={{ padding: 10 }}>Status</th>
              <th style={{ padding: 10 }}>Valor Atual</th>
            </tr>
          </thead>
          <tbody>
            {listError ? (
              <tr>
                <td colSpan={8} style={{ padding: 12, color: 'var(--danger)' }}>
                  {listError}
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                  Nenhuma fase encontrada.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.faseId}
                  style={{ borderTop: '1px solid var(--border)' }}
                  onClick={() => {
                    setDetailsRow(r);
                    setDetailsOpen(true);
                  }}
                >
                  <td style={{ padding: 10 }}>{r.fase}</td>
                  <td style={{ padding: 10, opacity: 0.8 }}>{r.subfase || '-'}</td>
                  <td style={{ padding: 10 }}>{formatBrDate(r.dataInicio)}</td>
                  <td style={{ padding: 10 }}>{formatBrDate(r.previsaoFinalizacao)}</td>
                  <td style={{ padding: 10 }}>{r.dataFinalizacao ? formatBrDate(r.dataFinalizacao) : '-'}</td>
                  <td style={{ padding: 10 }}>{r.responsavelNome || '-'}</td>
                  <td style={{ padding: 10, color: statusColor(r.status), fontWeight: 600 }}>{r.status}</td>
                  <td style={{ padding: 10 }}>{r.valorAtual ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={detailsOpen}
        title="Detalhes da fase"
        onClose={() => setDetailsOpen(false)}
        footer={null}
      >
        {detailsRow ? (
          <>
            <style>{`
              .uc-fase-card{ padding:14px; display:grid; gap:12px; max-width: 680px; margin: 0 auto; width:100%; }
              .uc-fase-avatar{ width:120px; height:120px; border-radius:999px; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:44px; margin: 4px auto 0; background: rgba(255,255,255,0.04); box-shadow: 0 8px 22px rgba(0,0,0,0.18); }
              .uc-fase-title{ font-weight:900; font-size:18px; text-align:center; letter-spacing:0.1px; }
              .uc-fase-sub{ text-align:center; opacity:0.75; font-size:12px; margin-top:-6px; }
              .uc-fase-field{ display:grid; grid-template-columns: 120px 1fr; gap:6px; font-size:13px; align-items:baseline; }
              .uc-fase-field b{ font-weight:800; text-align:right; }
              .uc-fase-scroll{ max-height: 78vh; overflow:auto; padding-right: 2px; }
            `}</style>

            <div className="uc-fase-scroll">
              <div className="card uc-fase-card">
                <div className="uc-fase-avatar" title={detailsRow.fase || ''}>
                  {getPhaseIcon(String(detailsRow.fase || ''))}
                </div>
                <div className="uc-fase-title">{detailsRow.fase || '—'}</div>
                <div className="uc-fase-sub">{detailsRow.subfase || '—'}</div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <div className="uc-fase-field">
                    <b>ID:</b> <span>{String(detailsRow.faseId ?? '—')}</span>
                  </div>
                  <div className="uc-fase-field">
                    <b>Status:</b>{' '}
                    <span style={{ color: statusColor(detailsRow.status), fontWeight: 800 }}>{detailsRow.status || '—'}</span>
                  </div>
                  <div className="uc-fase-field">
                    <b>Início:</b> <span>{detailsRow.dataInicio ? formatBrDate(detailsRow.dataInicio) : '—'}</span>
                  </div>
                  <div className="uc-fase-field">
                    <b>Previsão:</b> <span>{detailsRow.previsaoFinalizacao ? formatBrDate(detailsRow.previsaoFinalizacao) : '—'}</span>
                  </div>
                  <div className="uc-fase-field">
                    <b>Finalização:</b> <span>{detailsRow.dataFinalizacao ? formatBrDate(detailsRow.dataFinalizacao) : '—'}</span>
                  </div>
                  <div className="uc-fase-field">
                    <b>Responsável:</b> <span>{detailsRow.responsavelNome || '—'}</span>
                  </div>
                  <div className="uc-fase-field">
                    <b>Previsão R$:</b> <span>{detailsRow.valorPrevisao ?? '—'}</span>
                  </div>
                  <div className="uc-fase-field">
                    <b>Atual R$:</b> <span>{detailsRow.valorAtual ?? '—'}</span>
                  </div>
                  <div className="uc-fase-field">
                    <b>Notas:</b> <span style={{ wordBreak: 'break-word' }}>{detailsRow.notas || '—'}</span>
                  </div>
                  <div className="uc-fase-field">
                    <b>created_at:</b> <span>{detailsRow.createdAt || '—'}</span>
                  </div>
                  <div className="uc-fase-field">
                    <b>updated_at:</b> <span>{detailsRow.updatedAt || '—'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={!canWrite}
                    onClick={() => {
                      setDetailsOpen(false);
                      openEditModal(detailsRow);
                    }}
                    title="Editar fase"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <PencilIcon /> Editar
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ opacity: 0.7, fontSize: 13 }}>Nenhuma fase selecionada.</div>
        )}
      </Modal>

      <Modal
        open={open}
        title={mode === 'edit' ? 'Editar fase' : 'Nova fase'}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {mode === 'edit' ? (
              <button
                className="btn danger"
                type="button"
                disabled={!canWrite}
                onClick={() => {
                  setDeletePassword('');
                  setDeleteOpen(true);
                }}
              >
                Excluir
              </button>
            ) : null}
            <button className="btn" onClick={() => setOpen(false)} type="button">
              Cancelar
            </button>
            <button
              className="btn primary"
              disabled={saving}
              onClick={form.handleSubmit(async (values) => {
                try {
                  setSaving(true);
                  if (mode === 'edit' && editingRow?.faseId) {
                    await apiFetch(`/fases/${editingRow.faseId}`, { method: 'PUT', json: values });
                  } else {
                    await apiFetch('/fases', { method: 'POST', json: values });
                  }
                  await load();
                  setOpen(false);
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Falha ao salvar fase');
                } finally {
                  setSaving(false);
                }
              })}
              type="button"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        }
      >
        {optionsError ? (
          <div className="card" style={{ padding: 10, marginBottom: 10, borderColor: 'rgba(255,77,109,0.55)' }}>
            <div style={{ color: 'var(--danger)', fontSize: 12 }}>{optionsError}</div>
          </div>
        ) : null}
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}
        >
          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Fase</div>
            <select
              className="input"
              {...form.register('fase')}
              onChange={(e) => {
                const value = e.target.value;
                form.setValue('fase', value, { shouldValidate: true });
                const subs = getSubfasesByFase(value);
                setSubfasesOptions(subs);
                form.setValue('subfase', subs[0] ?? '', { shouldValidate: true });
              }}
            >
              <option value="">Selecione...</option>
              {PHASES.map((p) => (
                <option key={p.fase} value={p.fase}>
                  {p.fase}
                </option>
              ))}
            </select>
            {form.formState.errors.fase && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.fase.message}</div>
            )}
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Subfase</div>
            <select
              className="input"
              {...form.register('subfase')}
              onChange={(e) => form.setValue('subfase', e.target.value, { shouldValidate: true })}
            >
              <option value="">Selecione...</option>
              {subfasesOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {form.formState.errors.subfase && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.subfase.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
            <select className="input" {...form.register('status')}>
              <option value="ABERTO">Aberto</option>
              <option value="ANDAMENTO">Andamento</option>
              <option value="FINALIZADO">Finalizado</option>
              <option value="PENDENTE">Pendente</option>
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Data início</div>
            <input className="input" type="date" {...form.register('data_inicio')} />
            {form.formState.errors.data_inicio && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.data_inicio.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Previsão finalização</div>
            <input className="input" type="date" {...form.register('previsao_finalizacao')} />
            {form.formState.errors.previsao_finalizacao && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>
                {form.formState.errors.previsao_finalizacao.message}
              </div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Data finalização (opcional)</div>
            <input className="input" type="date" {...form.register('data_finalizacao')} />
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Responsável</div>
            <select className="input" {...form.register('responsavel_id')} defaultValue="">
              <option value="">(opcional)</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Valor previsão</div>
            <input className="input" type="number" step="0.01" {...form.register('valor_previsao')} />
            {form.formState.errors.valor_previsao && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.valor_previsao.message}</div>
            )}
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Notas (text)</div>
            <textarea className="input" {...form.register('notas')} />
          </label>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, opacity: 0.75, fontSize: 12 }}>
            <div>
              <b>created_at:</b> {mode === 'edit' ? (editingRow?.createdAt || '—') : '—'}
            </div>
            <div>
              <b>updated_at:</b> {mode === 'edit' ? (editingRow?.updatedAt || '—') : '—'}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteOpen}
        title="Confirmar exclusão"
        onClose={() => setDeleteOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" type="button" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancelar
            </button>
            <button
              className="btn danger"
              type="button"
              disabled={deleting}
              onClick={async () => {
                if (!editingRow?.faseId) return;
                try {
                  setDeleting(true);
                  await apiFetch(`/fases/${editingRow.faseId}`, { method: 'DELETE', json: { password: deletePassword } });
                  await load();
                  setDeleteOpen(false);
                  setOpen(false);
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Falha ao excluir fase');
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        }
      >
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
          Digite sua senha para confirmar a exclusão desta fase.
        </div>
        <input
          className="input"
          type="password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          placeholder="Sua senha"
          autoComplete="current-password"
        />
      </Modal>
    </div>
  );
}

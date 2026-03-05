import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/auth';
import Modal from '../ui/Modal';
import ConfirmPasswordModal from '../ui/ConfirmPasswordModal';
import { useConfirmPassword } from '../ui/useConfirmPassword';
import { getPhaseIcon } from '../ui/phaseIcons';

type Documento = {
  docsId: number;
  documento: string;
  fase: string;
  subfase: string | null;
  faturaId: string | null;
  faturaDescricao?: string | null;
  dadosPagamento: string | null;
  dataInclusao: string;
  dataEntrega: string | null;
  status: 'ABERTO' | 'ANDAMENTO' | 'PENDENTE' | 'FINALIZADO';
  tipoAssinatura?: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  assinatura?: string | null;
  assinaturaNome?: string | null;
  notas: string | null;
  arquivoPath: string | null;
  arquivoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserOption = { userId: string; nome: string; tipoUsuario: string; status: string };
type FaturaOption = { faturaId: string; label: string };

const DOC_STATUS = ['ABERTO', 'ANDAMENTO', 'PENDENTE', 'FINALIZADO'] as const;
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
    fase: '02 - Projeto Arquitetônico',
    subfases: [
      '02.01 - Desenvolvimento do partido arquitetônico',
      '02.02 - Anteprojeto',
      '02.03 - Projeto executivo arquitetônico',
      '02.04 - Detalhamento de acabamentos',
      '02.05 - Compatibilização com demais projetos'
    ]
  },
  {
    fase: '03 - Projetos Complementares',
    subfases: [
      '03.01 - Projeto estrutural',
      '03.02 - Projeto elétrico',
      '03.03 - Projeto hidrossanitário',
      '03.04 - Projeto de prevenção e combate a incêndio (PPCI)',
      '03.05 - Projeto de climatização',
      '03.06 - Projeto de SPDA',
      '03.07 - Projeto de gás'
    ]
  },
  {
    fase: '04 - Licenciamento e Legalização',
    subfases: [
      '04.01 - Protocolo na prefeitura',
      '04.02 - Análise e exigências',
      '04.03 - Adequações solicitadas',
      '04.04 - Emissão do alvará de construção',
      '04.05 - Registro de responsáveis técnicos (RRT/ART)'
    ]
  },
  {
    fase: '05 - Mobilização do Canteiro',
    subfases: [
      '05.01 - Implantação do canteiro',
      '05.02 - Ligações provisórias (água, energia)',
      '05.03 - Tapumes e sinalização',
      '05.04 - Vestiários e áreas de apoio',
      '05.05 - Planejamento de segurança (EPC/EPI)'
    ]
  },
  {
    fase: '06 - Terraplenagem e Fundação',
    subfases: [
      '06.01 - Limpeza e terraplenagem',
      '06.02 - Escavações',
      '06.03 - Fundações profundas',
      '06.04 - Fundações rasas',
      '06.05 - Blocos e baldrames',
      '06.06 - Impermeabilização de fundação'
    ]
  },
  {
    fase: '07 - Estrutura',
    subfases: [
      '07.01 - Pilares',
      '07.02 - Vigas',
      '07.03 - Lajes',
      '07.04 - Escadas',
      '07.05 - Concretagens e cura'
    ]
  },
  {
    fase: '08 - Vedações e Alvenaria',
    subfases: [
      '08.01 - Alvenaria externa',
      '08.02 - Alvenaria interna',
      '08.03 - Vergas e contravergas',
      '08.04 - Reforços e grauteamentos',
      '08.05 - Chumbadores e marcações'
    ]
  },
  {
    fase: '09 - Cobertura',
    subfases: [
      '09.01 - Estrutura de cobertura',
      '09.02 - Telhamento',
      '09.03 - Rufos e calhas',
      '09.04 - Isolamentos e mantas',
      '09.05 - Rufos finais e arremates'
    ]
  },
  {
    fase: '10 - Esquadrias',
    subfases: [
      '10.01 - Caixilhos metálicos',
      '10.02 - Caixilhos de madeira ou PVC',
      '10.03 - Vidros',
      '10.04 - Portas internas',
      '10.05 - Portas externas'
    ]
  },
  {
    fase: '11 - Instalações Elétricas',
    subfases: [
      '11.01 - Eletrodutos e caixas',
      '11.02 - Cabeamento',
      '11.03 - Quadros e disjuntores',
      '11.04 - Tomadas e interruptores',
      '11.05 - Iluminação'
    ]
  },
  {
    fase: '12 - Instalações Hidrossanitárias',
    subfases: [
      '12.01 - Água fria',
      '12.02 - Água quente',
      '12.03 - Esgoto e ventilação',
      '12.04 - Águas pluviais',
      '12.05 - Testes de estanqueidade'
    ]
  },
  {
    fase: '13 - Revestimentos Internos',
    subfases: [
      '13.01 - Chapisco e emboço',
      '13.02 - Reboco e massa fina',
      '13.03 - Pisos frios',
      '13.04 - Revestimento de paredes',
      '13.05 - Forros',
      '13.06 - Pintura interna'
    ]
  },
  {
    fase: '14 - Revestimentos Externos',
    subfases: [
      '14.01 - Revestimento externo (massa)',
      '14.02 - Pastilhas ou cerâmicas',
      '14.03 - Texturas e pinturas',
      '14.04 - Pingadeiras e arremates'
    ]
  },
  {
    fase: '15 - Acabamentos e Finalização',
    subfases: [
      '15.01 - Esquadrias finais e ferragens',
      '15.02 - Louças e metais',
      '15.03 - Vidros finais e espelhos',
      '15.04 - Iluminação decorativa',
      '15.05 - Limpeza final e entrega'
    ]
  }
] as const;

type UploadResponse = { path?: string; url?: string; filename?: string };

function apiBaseUrl() {
  const baseUrl = (import.meta as any).env?.BASE_URL ?? '/';
  return `${String(baseUrl).replace(/\/?$/, '/')}`;
}

async function uploadDocumento(file: File): Promise<UploadResponse> {
  const url = `${apiBaseUrl()}api/upload-documento`;
  const fd = new FormData();
  fd.append('arquivo', file);
  const res = await fetch(url, { method: 'POST', credentials: 'include', body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.detail || data?.error || 'Falha no upload';
    throw new Error(msg);
  }
  return data as UploadResponse;
}

function formatBrDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function getSubfasesByFase(fase: string) {
  const found = PHASES.find((p) => p.fase === fase);
  return found ? found.subfases : [];
}

function statusColor(status: string) {
  const s = status.toUpperCase();
  if (s === 'ABERTO') return '#d4a000';
  if (s === 'PENDENTE') return '#d64545';
  if (s === 'FINALIZADO') return '#2f9e44';
  return 'inherit';
}

const schema = z.object({
  documento: z.string().min(1, 'Documento obrigatório'),
  fase: z.string().min(1, 'Fase obrigatória'),
  subfase: z.string().min(1, 'Subfase obrigatória'),
  fatura: z
    .string()
    .optional()
    .refine((v) => !v || v === '' || /^\d+$/.test(v), 'Fatura inválida'),
  dados_pagamento: z.string().optional(),
  data_inclusao: z.string().optional(),
  data_entrega: z.string().optional(),
  status: z.enum(DOC_STATUS),
  responsavel_id: z.string().min(1, 'Responsável obrigatório'),
  tipo_assinatura: z.enum(['Sem Assinatura', 'Assinatura Digital', 'Assinatura Gov', 'Assinatura Cartorio']),
  assinatura: z.string().min(1, 'Assinatura obrigatória'),
  notas: z.string().optional(),
  arquivo_path: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

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

export default function DocumentacoesPage() {
  const { user } = useAuth();
  const canWrite = useMemo(() => ['Owner', 'Engenheiro', 'Gerente'].includes(user?.tipoUsuario || ''), [user?.tipoUsuario]);

  const [rows, setRows] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<Documento | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState<Documento | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmPwd = useConfirmPassword();

  const [users, setUsers] = useState<UserOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [faturas, setFaturas] = useState<FaturaOption[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [subfasesOptions, setSubfasesOptions] = useState<string[]>([]);

  const [q, setQ] = useState('');
  const [faseFilter, setFaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchReadOnly, setSearchReadOnly] = useState(true);

  const defaults = useMemo<FormValues>(
    () => ({
      documento: '',
      fase: '',
      subfase: '',
      fatura: '',
      dados_pagamento: '',
      data_inclusao: new Date().toISOString().slice(0, 10),
      data_entrega: '',
      status: 'ABERTO',
      responsavel_id: '',
      tipo_assinatura: 'Sem Assinatura',
      assinatura: '',
      notas: '',
      arquivo_path: ''
    }),
    []
  );

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const selectedFase = form.watch('fase');
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [users]
  );

  useEffect(() => {
    if (!open) return;
    const subs = getSubfasesByFase(selectedFase);
    setSubfasesOptions(subs);
    if (subs.length > 0) {
      const current = form.getValues('subfase');
      if (!current || !subs.includes(current)) {
        form.setValue('subfase', subs[0], { shouldValidate: true });
      }
    } else {
      form.setValue('subfase', '', { shouldValidate: true });
    }
  }, [selectedFase, open, form]);

  async function load() {
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (faseFilter) params.set('fase', faseFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await apiFetch<{ items: Documento[] }>(`/documentacoes?${params.toString()}`, { method: 'GET' });
      setRows(res.items || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Falha ao carregar documentações');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.activeCode]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        setOptionsError(null);
        const [u, f] = await Promise.all([
          apiFetch<UserOption[]>('/cadastros/options', { method: 'GET' }),
          apiFetch<{ items: any[] }>('/faturas', { method: 'GET' }).catch(() => ({ items: [] }))
        ]);
        if (!alive) return;
        setUsers(u || []);
        const opts: FaturaOption[] = (f.items || []).map((it: any) => {
          const id = String(it.faturaId || it.fatura_id || it.id || '');
          const desc = String(it.fatura || it.descricao || '').trim();
          const fase = String(it.faseNome || it.fase || '').trim();
          const labelBase = desc || `Fatura #${id}`;
          const label = fase ? `${labelBase} — ${fase}` : labelBase;
          return { faturaId: id, label };
        }).filter((it: FaturaOption) => it.faturaId);
        setFaturas(opts.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')));
      } catch (e) {
        if (!alive) return;
        setOptionsError(e instanceof Error ? e.message : 'Falha ao carregar usuários');
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, user?.activeCode]);

  function openCreate() {
    setQ('');
    setSearchReadOnly(true);
    setMode('create');
    setEditing(null);
    setSelectedFile(null);
    setSubfasesOptions([]);
    form.reset(defaults);
    setOpen(true);
  }

  function openEdit(row: Documento) {
    setQ('');
    setSearchReadOnly(true);
    setMode('edit');
    setEditing(row);
    setSelectedFile(null);
    setSubfasesOptions(getSubfasesByFase(row.fase));
    form.reset({
      documento: row.documento,
      fase: row.fase,
      subfase: row.subfase || '',
      fatura: row.faturaId || '',
      dados_pagamento: row.dadosPagamento || '',
      data_inclusao: row.dataInclusao ? row.dataInclusao.slice(0, 10) : '',
      data_entrega: row.dataEntrega ? row.dataEntrega.slice(0, 10) : '',
      status: row.status,
      responsavel_id: row.responsavelId || '',
      tipo_assinatura: row.tipoAssinatura || 'Sem Assinatura',
      assinatura: row.assinatura || '',
      notas: row.notas || '',
      arquivo_path: row.arquivoPath || ''
    });
    setOpen(true);
  }

  function openDetails(row: Documento) {
    setDetailsRow(row);
    setDetailsOpen(true);
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Documentações</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Registros e documentos da obra</div>
        </div>
        <button className="btn primary" type="button" onClick={openCreate} disabled={!canWrite}>
          + Nova
        </button>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10 }}>
        <input
          className="input"
          type="search"
          name="uc-doc-search-off"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          readOnly={searchReadOnly}
          onFocus={() => setSearchReadOnly(false)}
          placeholder="Buscar (documento, fase, subfase, responsável)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={faseFilter} onChange={(e) => setFaseFilter(e.target.value)}>
          <option value="">Fase (todas)</option>
          {PHASES.map((f) => (
            <option key={f.fase} value={f.fase}>
              {f.fase}
            </option>
          ))}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Status (todos)</option>
          {DOC_STATUS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => load()} disabled={loading}>
          Filtrar
        </button>
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.8 }}>
              <th style={{ padding: 10 }}>Documento</th>
              <th style={{ padding: 10 }}>Fase</th>
              <th style={{ padding: 10 }}>Subfase</th>
              <th style={{ padding: 10 }}>Fatura</th>
              <th style={{ padding: 10 }}>Status</th>
              <th style={{ padding: 10 }}>Responsável</th>
              <th style={{ padding: 10 }}>Inclusão</th>
              <th style={{ padding: 10 }}>Entrega</th>
              <th style={{ padding: 10 }}>Arquivo</th>
            </tr>
          </thead>
          <tbody>
            {listError ? (
              <tr>
                <td colSpan={9} style={{ padding: 12, color: 'var(--danger)' }}>
                  {listError}
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={9} style={{ padding: 12, opacity: 0.7 }}>
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 12, opacity: 0.7 }}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.docsId}
                  style={{ borderTop: '1px solid var(--border)' }}
                  onClick={() => openDetails(r)}
                >
                  <td style={{ padding: 10 }}>{r.documento}</td>
                  <td style={{ padding: 10, opacity: 0.85 }}>{r.fase}</td>
                  <td style={{ padding: 10, opacity: 0.85 }}>{r.subfase || '-'}</td>
                  <td style={{ padding: 10 }}>
                    {r.faturaDescricao || (r.faturaId ? `#${r.faturaId}` : '-')}
                  </td>
                  <td style={{ padding: 10, color: statusColor(r.status) }}>{r.status}</td>
                  <td style={{ padding: 10 }}>{r.responsavelNome || '-'}</td>
                  <td style={{ padding: 10 }}>{formatBrDate(r.dataInclusao)}</td>
                  <td style={{ padding: 10 }}>{formatBrDate(r.dataEntrega)}</td>
                  <td style={{ padding: 10 }}>
                    {r.arquivoUrl ? (
                      <a href={r.arquivoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        Abrir
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={detailsOpen} title="Detalhes do documento" onClose={() => setDetailsOpen(false)} footer={null}>
        {detailsRow ? (
          <>
            <style>{`
              .uc-doc-card{ padding:14px; display:grid; gap:12px; max-width: 720px; margin: 0 auto; width:100%; }
              .uc-doc-avatar{ width:120px; height:120px; border-radius:999px; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:44px; margin: 4px auto 0; background: rgba(255,255,255,0.04); box-shadow: 0 8px 22px rgba(0,0,0,0.18); }
              .uc-doc-title{ font-weight:900; font-size:18px; text-align:center; letter-spacing:0.1px; }
              .uc-doc-sub{ text-align:center; opacity:0.75; font-size:12px; margin-top:-6px; }
              .uc-doc-field{ display:grid; grid-template-columns: 140px 1fr; gap:6px; font-size:13px; align-items:baseline; }
              .uc-doc-field b{ font-weight:800; text-align:right; }
              .uc-doc-scroll{ max-height: 78vh; overflow:auto; padding-right: 2px; }
            `}</style>
            <div className="uc-doc-scroll">
              <div className="card uc-doc-card">
                <div className="uc-doc-avatar" title={detailsRow.fase || ''}>
                  {getPhaseIcon(String(detailsRow.fase || ''))}
                </div>
                <div className="uc-doc-title">{detailsRow.documento || '—'}</div>
                <div className="uc-doc-sub">{detailsRow.subfase || detailsRow.fase || '—'}</div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <div className="uc-doc-field">
                    <b>ID:</b> <span>{String(detailsRow.docsId ?? '—')}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Status:</b>{' '}
                    <span style={{ color: statusColor(detailsRow.status), fontWeight: 800 }}>{detailsRow.status || '—'}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Fase:</b> <span>{detailsRow.fase || '—'}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Subfase:</b> <span>{detailsRow.subfase || '—'}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Fatura:</b>{' '}
                    <span>{detailsRow.faturaDescricao || (detailsRow.faturaId ? `#${detailsRow.faturaId}` : '—')}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Responsável:</b> <span>{detailsRow.responsavelNome || '—'}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Inclusão:</b> <span>{detailsRow.dataInclusao ? formatBrDate(detailsRow.dataInclusao) : '—'}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Entrega:</b> <span>{detailsRow.dataEntrega ? formatBrDate(detailsRow.dataEntrega) : '—'}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Arquivo:</b>{' '}
                    {detailsRow.arquivoUrl ? (
                      <a href={detailsRow.arquivoUrl} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <div className="uc-doc-field">
                    <b>Dados pgto:</b>{' '}
                    <span style={{ wordBreak: 'break-word' }}>{detailsRow.dadosPagamento || '—'}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Tipo assinatura:</b> <span style={{ wordBreak: 'break-word' }}>{detailsRow.tipoAssinatura || '—'}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Assinatura:</b> <span style={{ wordBreak: 'break-word' }}>{detailsRow.assinaturaNome || '—'}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>Notas:</b> <span style={{ wordBreak: 'break-word' }}>{detailsRow.notas || '—'}</span>
                  </div>
                  <div className="uc-doc-field">
                    <b>created_at:</b> <span>{detailsRow.createdAt || '—'}</span>
                  </div>
                  <div className="uc-doc-field">
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
                      openEdit(detailsRow);
                    }}
                    title="Editar documento"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <PencilIcon /> Editar
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ opacity: 0.7, fontSize: 13 }}>Nenhum documento selecionado.</div>
        )}
      </Modal>

      <Modal
        open={open}
        title={mode === 'edit' ? 'Editar documentação' : 'Nova documentação'}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {mode === 'edit' ? (
              <button
                className="btn danger"
                type="button"
                disabled={!canWrite || deleting}
                onClick={async () => {
                  if (!editing?.docsId) return;
                  try {
                    const password = await confirmPwd.request({
                      title: 'Confirmar exclusão de documentação',
                      confirmLabel: 'Excluir',
                      danger: true
                    });
                    setDeleting(true);
                    await apiFetch(`/documentacoes/${editing.docsId}`, { method: 'DELETE', json: { password } });
                    await load();
                    setOpen(false);
                  } catch (e) {
                    if (e instanceof Error && e.message === 'cancelled') return;
                    alert(e instanceof Error ? e.message : 'Falha ao excluir');
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            ) : null}
            <button className="btn" onClick={() => setOpen(false)} type="button">
              Cancelar
            </button>
            <button
              className="btn primary"
              disabled={!canWrite || saving}
              onClick={form.handleSubmit(async (values) => {
                try {
                  const password = await confirmPwd.request({
                    title: mode === 'edit' ? 'Confirmar edição de documentação' : 'Confirmar nova documentação',
                    confirmLabel: 'Salvar'
                  });
                  setSaving(true);

                  let arquivoPath = values.arquivo_path || editing?.arquivoPath || '';
                  if (selectedFile) {
                    const uploaded = await uploadDocumento(selectedFile);
                    if (uploaded.path) {
                      arquivoPath = uploaded.path;
                    } else if (uploaded.url) {
                      // Normaliza para salvar sempre o caminho relativo (ex.: "uploads/arquivo.pdf")
                      // aceitando URLs antigas tipo "/api/uploads/..." ou "/underconstruction/api/uploads/..."
                      const u = String(uploaded.url);
                      const m = u.match(/\/api\/(uploads\/.+)$/);
                      if (m?.[1]) {
                        arquivoPath = m[1];
                      } else {
                        arquivoPath = u.replace(/^\/+/, '');
                      }
                    } else if (uploaded.filename) {
                      arquivoPath = `uploads/${uploaded.filename}`;
                    } else {
                      arquivoPath = '';
                    }
                  }

                  const payload = {
                    ...values,
                    tipo_assinatura: values.tipo_assinatura || 'Sem Assinatura',
                    assinatura: values.assinatura || '',
                    arquivo_path: arquivoPath || undefined,
                    password
                  };

                  if (mode === 'edit' && editing?.docsId) {
                    await apiFetch(`/documentacoes/${editing.docsId}`, { method: 'PUT', json: payload });
                  } else {
                    await apiFetch('/documentacoes', { method: 'POST', json: payload });
                  }
                  await load();
                  setOpen(false);
                } catch (e) {
                  if (e instanceof Error && e.message === 'cancelled') return;
                  alert(e instanceof Error ? e.message : 'Falha ao salvar');
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
          autoComplete="off"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}
        >
          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Documento</div>
            <input className="input" {...form.register('documento')} />
            {form.formState.errors.documento ? (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.documento.message}</div>
            ) : null}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Fase</div>
            <select
              className="input"
              {...form.register('fase')}
              onChange={(e) => {
                form.setValue('fase', e.target.value, { shouldValidate: true });
                const subs = getSubfasesByFase(e.target.value);
                setSubfasesOptions(subs);
                form.setValue('subfase', subs[0] ?? '', { shouldValidate: true });
              }}
            >
              <option value="">Selecione...</option>
              {PHASES.map((f) => (
                <option key={f.fase} value={f.fase}>
                  {f.fase}
                </option>
              ))}
            </select>
            {form.formState.errors.fase ? (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.fase.message}</div>
            ) : null}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Subfase</div>
            <select
              className="input"
              {...form.register('subfase')}
              disabled={subfasesOptions.length === 0}
              onChange={(e) => form.setValue('subfase', e.target.value, { shouldValidate: true })}
            >
              <option value="">Selecione...</option>
              {subfasesOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {form.formState.errors.subfase ? (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.subfase.message}</div>
            ) : null}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
            <select className="input" {...form.register('status')}>
              <option value="ABERTO">Aberto</option>
              <option value="ANDAMENTO">Andamento</option>
              <option value="PENDENTE">Pendente</option>
              <option value="FINALIZADO">Finalizado</option>
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Fatura</div>
            {(() => {
              const reg = form.register('fatura');
              const value = form.watch('fatura') || '';
              return (
                <select
                  className="input"
                  {...reg}
                  value={value}
                  onChange={(e) => {
                    reg.onChange(e);
                    form.setValue('fatura', e.target.value, { shouldValidate: true });
                  }}
                >
                  <option value="">Sem fatura</option>
                  {faturas.map((ft) => (
                    <option key={ft.faturaId} value={ft.faturaId}>
                      {ft.label}
                    </option>
                  ))}
                </select>
              );
            })()}
            {form.formState.errors.fatura ? (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{String(form.formState.errors.fatura.message)}</div>
            ) : null}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Tipo de assinatura</div>
            <select className="input" {...form.register('tipo_assinatura')}>
              <option value="Sem Assinatura">Sem Assinatura</option>
              <option value="Assinatura Digital">Assinatura Digital</option>
              <option value="Assinatura Gov">Assinatura Gov</option>
              <option value="Assinatura Cartorio">Assinatura Cartorio</option>
            </select>
            {form.formState.errors.tipo_assinatura ? (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>
                {form.formState.errors.tipo_assinatura.message}
              </div>
            ) : null}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Assinatura (usuário)</div>
            {(() => {
              const reg = form.register('assinatura');
              const value = form.watch('assinatura') || '';
              return (
                <select
                  className="input"
                  {...reg}
                  value={value}
                  onChange={(e) => {
                    reg.onChange(e);
                    form.setValue('assinatura', e.target.value, { shouldValidate: true });
                  }}
                >
                  <option value="">Selecione...</option>
                  {sortedUsers.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              );
            })()}
            {form.formState.errors.assinatura ? (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>
                {form.formState.errors.assinatura.message}
              </div>
            ) : null}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Responsável</div>
            {(() => {
              const reg = form.register('responsavel_id');
              const value = form.watch('responsavel_id') || '';
              return (
                <select
                  className="input"
                  {...reg}
                  value={value}
                  onChange={(e) => {
                    reg.onChange(e);
                    form.setValue('responsavel_id', e.target.value, { shouldValidate: true });
                  }}
                >
                  <option value="">Selecione...</option>
                  {sortedUsers.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              );
            })()}
            {form.formState.errors.responsavel_id ? (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>
                {form.formState.errors.responsavel_id.message}
              </div>
            ) : null}
          </label>

          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Data inclusão</div>
              <input className="input" type="date" {...form.register('data_inclusao')} />
            </label>

            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Data entrega</div>
              <input className="input" type="date" {...form.register('data_entrega')} />
            </label>
          </div>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Dados para pagamento</div>
            <textarea className="input" rows={3} {...form.register('dados_pagamento')} />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Notas</div>
            <textarea className="input" rows={3} {...form.register('notas')} />
          </label>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Arquivo</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {selectedFile ? selectedFile.name : mode === 'edit' && editing?.arquivoUrl ? 'Arquivo já enviado' : 'Nenhum arquivo selecionado'}
                </div>
                {mode === 'edit' && !selectedFile && editing?.arquivoUrl ? (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <a href={editing.arquivoUrl} target="_blank" rel="noreferrer">
                      Abrir arquivo
                    </a>
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label className="btn" style={{ cursor: 'pointer' }}>
                  Selecionar
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button className="btn" type="button" onClick={() => setSelectedFile(null)} disabled={!selectedFile}>
                  Remover
                </button>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, opacity: 0.75, fontSize: 12 }}>
            <div>
              <b>created_at:</b> {mode === 'edit' ? editing?.createdAt || '—' : '—'}
            </div>
            <div>
              <b>updated_at:</b> {mode === 'edit' ? editing?.updatedAt || '—' : '—'}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmPasswordModal
        open={confirmPwd.state.open}
        title={confirmPwd.state.title}
        confirmLabel={confirmPwd.state.confirmLabel}
        danger={confirmPwd.state.danger}
        onCancel={confirmPwd.cancel}
        onConfirm={confirmPwd.confirm}
      />
    </div>
  );
}

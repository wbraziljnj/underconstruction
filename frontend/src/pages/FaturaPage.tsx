import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';
import { useEffect } from 'react';
import { useAuth } from '../auth/auth';
import { FASES_FIXAS } from '../ui/fasesFixas';
import { getPhaseIcon } from '../ui/phaseIcons';

const schema = z
  .object({
    comprovante: z.string().optional(),
    data: z.string().min(1, 'Data obrigatória'),
    lancamento: z.string().optional(),
    data_pagamento: z.string().optional(),
    dados_pagamento: z.string().optional(),
    nfe: z.string().optional(),
    status: z.enum(['ATIVO', 'INATIVO']),
    pagamento: z.enum(['aberto', 'pendente', 'pago']),
    valor: z.coerce.number().nonnegative('Valor inválido'),
    quantidade: z.coerce.number().int('Quantidade inválida').nonnegative('Quantidade inválida'),
    descricao: z.string().min(1, 'Fatura obrigatória'),
    subfase: z.string().min(1, 'Subfase obrigatória'),
    notas: z.string().optional(),
    total: z.coerce.number().nonnegative('Total inválido'),
    fase_id: z.string().min(1, 'Fase ID obrigatório'),
    responsavel_id: z.string().optional(),
    empresa_id: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.pagamento === 'pago' && (!v.data_pagamento || v.data_pagamento.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['data_pagamento'],
        message: 'Se pagamento = pago, data_pagamento é obrigatório'
      });
    }
  });

type FormValues = z.infer<typeof schema>;
type UploadResponse = { path?: string; url?: string; filename?: string };

type UserOption = { userId: string; nome: string; tipoUsuario: string; status: string };
type FaseOption = { faseId: string; fase: string; subfase?: string | null };

function formatBrDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function toDateOnlyLocal(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function nowLocalDatetime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function pagamentoColor(value?: string) {
  const v = (value || '').toLowerCase();
  if (v === 'aberto') return '#d4aa00'; // amarelo
  if (v === 'pendente') return '#d33'; // vermelho
  if (v === 'pago') return '#229954'; // verde
  return 'inherit';
}

function apiBaseUrl() {
  const baseUrl = (import.meta as any).env?.BASE_URL ?? '/';
  return `${String(baseUrl).replace(/\/?$/, '/')}`;
}

async function uploadComprovante(file: File): Promise<UploadResponse> {
  const url = `${apiBaseUrl()}api/upload-documento`;
  const fd = new FormData();
  fd.append('arquivo', file);
  const res = await fetch(url, { method: 'POST', credentials: 'include', body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data as any)?.detail || (data as any)?.error || 'Falha no upload';
    throw new Error(msg);
  }
  return data as UploadResponse;
}

export default function FaturaPage() {
  const { user } = useAuth();
  const canWrite = ['Owner', 'Proprietario', 'Gerente', 'Engenheiro', 'Arquiteto'].includes(user?.tipoUsuario || '');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fases, setFases] = useState<FaseOption[]>([]);
  const [faseNome, setFaseNome] = useState('');
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [selectedComprovanteFile, setSelectedComprovanteFile] = useState<File | null>(null);
  const [removeComprovante, setRemoveComprovante] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [faseFilter, setFaseFilter] = useState('');

  const sortedFases = useMemo(
    () =>
      [...fases].sort((a, b) => a.fase.localeCompare(b.fase, 'pt-BR', { sensitivity: 'base' })),
    [fases]
  );

  const faseOptions = useMemo(() => FASES_FIXAS.map((x) => x.fase), []);

  const subfaseOptions = useMemo(() => {
    const phase = faseNome.trim();
    const found = FASES_FIXAS.find((x) => x.fase === phase);
    return found ? found.subfases : [];
  }, [faseNome]);

  const defaults = useMemo<FormValues>(
    () => ({
      comprovante: '',
      data: '',
      lancamento: new Date().toISOString().slice(0, 10),
      data_pagamento: '',
      dados_pagamento: '',
      nfe: '',
      status: 'ATIVO',
      pagamento: 'aberto',
      valor: 0,
      quantidade: 1,
      descricao: '',
      subfase: '',
      notas: '',
      total: 0,
      fase_id: '',
      responsavel_id: '',
      empresa_id: '',
    }),
    []
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults
  });

  const valor = form.watch('valor');
  const quantidade = form.watch('quantidade');

  function openEditModal(row: any) {
    setMode('edit');
    setEditingRow(row);
    setFaseNome(String(row?.faseNome || ''));
    setSelectedComprovanteFile(null);
    setRemoveComprovante(false);
    form.reset({
      comprovante: row?.comprovantePath || '',
      descricao: row?.fatura || '',
      data: toDateOnlyLocal(row?.data),
      lancamento: toDateOnlyLocal(row?.lancamento) || toDateOnlyLocal(new Date().toISOString()),
      data_pagamento: toDateOnlyLocal(row?.dataPagamento),
      dados_pagamento: row?.dadosPagamento || '',
      nfe: row?.nfe || '',
      notas: row?.notas || '',
      status: row?.status || 'ATIVO',
      pagamento: row?.pagamento || 'aberto',
      valor: Number(row?.valor || 0),
      quantidade: Number(row?.quantidade || 0),
      total: Number(row?.total || 0),
      fase_id: String(row?.faseId ?? ''),
      subfase: row?.subfase || '',
      responsavel_id: row?.responsavelId ? String(row.responsavelId) : '',
      empresa_id: row?.empresaId ? String(row.empresaId) : ''
    });
    setOpen(true);
  }

  async function load() {
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (statusFilter) params.set('pagamento', statusFilter);
      if (faseFilter) params.set('fase_id', faseFilter);
      const res = await apiFetch<{ items: any[] }>(`/faturas?${params.toString()}`, { method: 'GET' });
      setRows(res.items || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Falha ao carregar faturas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.activeCode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setOptionsError(null);
        const [u, f] = await Promise.all([
          apiFetch<UserOption[]>('/cadastros/options', { method: 'GET' }),
          apiFetch<FaseOption[]>('/fases/options', { method: 'GET' })
        ]);
        if (!alive) return;
        setUsers(u || []);
        setFases(f);
      } catch (e) {
        if (!alive) return;
        setOptionsError(e instanceof Error ? e.message : 'Falha ao carregar options');
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.activeCode]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Faturas</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Lançamentos e pagamentos</div>
        </div>
        <button
          className="btn primary"
          disabled={!canWrite}
          onClick={() => {
            setMode('create');
            setEditingRow(null);
            setFaseNome('');
            setSelectedComprovanteFile(null);
            setRemoveComprovante(false);
            form.reset(defaults);
            // recalcula total no front só para UX (backend vai recalcular depois)
            form.setValue('total', (Number(valor) || 0) * (Number(quantidade) || 0), { shouldValidate: true });
            setOpen(true);
          }}
        >
          + Nova
        </button>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10 }}>
        <input
          className="input"
          placeholder="Buscar por fatura / fase / responsável / empresa"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Status (todos)</option>
          <option value="aberto">Aberto</option>
          <option value="pago">Pago</option>
          <option value="pendente">Pendente</option>
        </select>
        <select className="input" value={faseFilter} onChange={(e) => setFaseFilter(e.target.value)}>
          <option value="">Fase (todas)</option>
          {sortedFases.map((f) => (
            <option key={f.faseId} value={f.faseId}>
              {f.subfase ? `${f.fase} • ${f.subfase}` : f.fase}
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
              <th style={{ padding: 10 }}>Descrição</th>
              <th style={{ padding: 10 }}>Fase</th>
              <th style={{ padding: 10 }}>Data</th>
              <th style={{ padding: 10 }}>Quantidade</th>
              <th style={{ padding: 10 }}>Valor</th>
              <th style={{ padding: 10 }}>Total</th>
              <th style={{ padding: 10 }}>Pagamento</th>
              <th style={{ padding: 10 }}>Comprovante</th>
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
                  Nenhuma fatura encontrada.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.faturaId}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => {
                    setDetailsRow(r);
                    setDetailsOpen(true);
                  }}
                >
                  <td style={{ padding: 10 }}>{r.fatura}</td>
                  <td style={{ padding: 10, opacity: 0.7, fontSize: 12 }}>{r.faseNome || '-'}</td>
                  <td style={{ padding: 10 }}>{formatBrDate(r.data)}</td>
                  <td style={{ padding: 10 }}>{r.quantidade}</td>
                  <td style={{ padding: 10 }}>{r.valor}</td>
                  <td style={{ padding: 10 }}>{r.total}</td>
                  <td style={{ padding: 10, color: pagamentoColor(r.pagamento), fontWeight: 600 }}>{r.pagamento}</td>
                  <td style={{ padding: 10 }}>
                    {r.comprovanteUrl ? (
                      <a href={r.comprovanteUrl} target="_blank" rel="noreferrer">
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

      <Modal open={detailsOpen} title="Detalhes da fatura" onClose={() => setDetailsOpen(false)} footer={null}>
        {detailsRow ? (
          <>
            <style>{`
              .uc-fat-card{ padding:14px; display:grid; gap:12px; max-width: 720px; margin: 0 auto; width:100%; }
              .uc-fat-avatar{ width:120px; height:120px; border-radius:999px; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:44px; margin: 4px auto 0; background: rgba(255,255,255,0.04); box-shadow: 0 8px 22px rgba(0,0,0,0.18); }
              .uc-fat-title{ font-weight:900; font-size:18px; text-align:center; letter-spacing:0.1px; }
              .uc-fat-sub{ text-align:center; opacity:0.75; font-size:12px; margin-top:-6px; }
              .uc-fat-field{ display:grid; grid-template-columns: 140px 1fr; gap:6px; font-size:13px; align-items:baseline; }
              .uc-fat-field b{ font-weight:800; text-align:right; }
              .uc-fat-scroll{ max-height: 78vh; overflow:auto; padding-right: 2px; }
            `}</style>
            <div className="uc-fat-scroll">
              <div className="card uc-fat-card">
                <div className="uc-fat-avatar" title={detailsRow.faseNome || ''}>
                  {getPhaseIcon(String(detailsRow.faseNome || detailsRow.fase || ''))}
                </div>
                <div className="uc-fat-title">{detailsRow.fatura || '—'}</div>
                <div className="uc-fat-sub">{detailsRow.subfase || detailsRow.faseNome || '—'}</div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <div className="uc-fat-field">
                    <b>ID:</b> <span>{String(detailsRow.faturaId ?? '—')}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Fase:</b> <span>{detailsRow.faseNome || '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Subfase:</b> <span>{detailsRow.subfase || '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Data:</b> <span>{detailsRow.data ? formatBrDate(detailsRow.data) : '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Lançamento:</b> <span>{detailsRow.lancamento ? formatBrDate(detailsRow.lancamento) : '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Pagamento:</b>{' '}
                    <span style={{ color: pagamentoColor(detailsRow.pagamento), fontWeight: 800 }}>{detailsRow.pagamento || '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Data pgto:</b> <span>{detailsRow.dataPagamento ? formatBrDate(detailsRow.dataPagamento) : '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Valor:</b> <span>{detailsRow.valor ?? '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Quantidade:</b> <span>{detailsRow.quantidade ?? '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Total:</b> <span>{detailsRow.total ?? '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Responsável:</b> <span>{detailsRow.responsavelNome || '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Empresa:</b> <span>{detailsRow.empresaNome || '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Dados pgto:</b> <span style={{ wordBreak: 'break-word' }}>{detailsRow.dadosPagamento || '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>NF-e:</b> <span style={{ wordBreak: 'break-word' }}>{detailsRow.nfe || '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Notas:</b> <span style={{ wordBreak: 'break-word' }}>{detailsRow.notas || '—'}</span>
                  </div>
                  <div className="uc-fat-field">
                    <b>Comprovante:</b>{' '}
                    {detailsRow.comprovanteUrl ? (
                      <a href={detailsRow.comprovanteUrl} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <div className="uc-fat-field">
                    <b>created_at:</b> <span>{detailsRow.createdAt || '—'}</span>
                  </div>
                  <div className="uc-fat-field">
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
                    title="Editar fatura"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <PencilIcon /> Editar
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ opacity: 0.7, fontSize: 13 }}>Nenhuma fatura selecionada.</div>
        )}
      </Modal>

      <Modal
        open={open}
        title={mode === 'edit' ? 'Editar fatura' : 'Nova fatura'}
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
                // UX: recalcula total antes de enviar; backend vai recalcular também.
                const totalCalc = (Number(values.valor) || 0) * (Number(values.quantidade) || 0);
                let comprovantePath = values.comprovante || editingRow?.comprovantePath || '';
                if (selectedComprovanteFile) {
                  const uploaded = await uploadComprovante(selectedComprovanteFile);
                  if (uploaded.path) {
                    comprovantePath = uploaded.path;
                  } else if (uploaded.url) {
                    const u = String(uploaded.url);
                    const m = u.match(/\/api\/(uploads\/.+)$/);
                    if (m?.[1]) {
                      comprovantePath = m[1];
                    } else {
                      comprovantePath = u.replace(/^\/+/, '');
                    }
                  } else if (uploaded.filename) {
                    comprovantePath = `uploads/${uploaded.filename}`;
                  }
                } else if (removeComprovante) {
                  comprovantePath = '';
                }

                const payload = { ...values, comprovante: removeComprovante ? '' : (comprovantePath || undefined), total: totalCalc };

                // Regra: se pagamento != pago, limpar data_pagamento
                if (payload.pagamento !== 'pago') payload.data_pagamento = '';

                try {
                  setSaving(true);
                  if (mode === 'edit' && editingRow?.faturaId) {
                    await apiFetch(`/faturas/${editingRow.faturaId}`, { method: 'PUT', json: payload });
                  } else {
                    await apiFetch('/faturas', { method: 'POST', json: payload });
                  }
                  await load();
                  setOpen(false);
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Falha ao salvar fatura');
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
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Comprovante</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {selectedComprovanteFile ? selectedComprovanteFile.name : editingRow?.comprovanteUrl ? 'Arquivo já enviado' : 'Nenhum arquivo selecionado'}
                </div>
                {mode === 'edit' && editingRow?.comprovanteUrl ? (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <a href={editingRow.comprovanteUrl} target="_blank" rel="noreferrer">
                      Abrir comprovante
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
                    onChange={(e) => {
                      setSelectedComprovanteFile(e.target.files?.[0] ?? null);
                      setRemoveComprovante(false);
                    }}
                  />
                </label>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setSelectedComprovanteFile(null);
                    setRemoveComprovante(true);
                    form.setValue('comprovante', '', { shouldValidate: false });
                  }}
                  disabled={!selectedComprovanteFile && !editingRow?.comprovanteUrl}
                  title="Remove o comprovante salvo ao salvar"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Fatura</div>
            <input className="input" {...form.register('descricao')} placeholder="Nome da fatura" />
            {form.formState.errors.descricao && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.descricao.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Data (datetime)</div>
            <input className="input" type="date" {...form.register('data')} />
            {form.formState.errors.data && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.data.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Lançamento (auto)</div>
            <input className="input" type="date" disabled value={toDateOnlyLocal(form.watch('lancamento') || '')} />
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Pagamento</div>
            <select
              className="input"
              {...form.register('pagamento')}
              onChange={(e) => {
                form.setValue('pagamento', e.target.value as FormValues['pagamento'], { shouldValidate: true });
                if (e.target.value !== 'pago') {
                  form.setValue('data_pagamento', '', { shouldValidate: true });
                }
              }}
            >
              <option value="aberto">Aberto</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Data pagamento (opcional)</div>
            <input className="input" type="date" {...form.register('data_pagamento')} />
            {form.formState.errors.data_pagamento && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>
                {form.formState.errors.data_pagamento.message}
              </div>
            )}
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Dados pagamento</div>
            <textarea
              className="input"
              rows={3}
              placeholder="Ex: pix, banco, parcela, observações..."
              {...form.register('dados_pagamento')}
            />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>NF-e</div>
            <input className="input" placeholder="Código de barras / linha digitável" {...form.register('nfe')} />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Notas</div>
            <textarea className="input" rows={3} {...form.register('notas')} />
          </label>

          <input type="hidden" {...form.register('status')} />

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Fase</div>
            <select
              className="input"
              value={faseNome}
              onChange={(e) => {
                const next = e.target.value;
                setFaseNome(next);
                const found = FASES_FIXAS.find((x) => x.fase === next);
                const firstSub = found?.subfases?.[0] || '';
                form.setValue('subfase', firstSub, { shouldValidate: true });
                const match = sortedFases.find(
                  (x) => (x.fase || '').trim() === next && String(x.subfase || '').trim() === firstSub
                );
                form.setValue('fase_id', match?.faseId ? String(match.faseId) : '', { shouldValidate: true });
              }}
            >
              <option value="">Selecione...</option>
              {faseOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Subfase</div>
            <select
              className="input"
              {...form.register('subfase')}
              disabled={!faseNome}
              onChange={(e) => {
                const sub = e.target.value;
                form.setValue('subfase', sub, { shouldValidate: true });
                const match = sortedFases.find(
                  (x) => (x.fase || '').trim() === faseNome.trim() && String(x.subfase || '').trim() === sub.trim()
                );
                form.setValue('fase_id', match?.faseId ? String(match.faseId) : '', { shouldValidate: true });
              }}
            >
              <option value="">Selecione...</option>
              {subfaseOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {form.formState.errors.fase_id && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>
                {form.formState.errors.fase_id.message} (cadastre esta fase em <b>Fases</b>)
              </div>
            )}
            {form.formState.errors.subfase && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.subfase.message}</div>
            )}
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
            <div style={{ fontSize: 12, opacity: 0.8 }}>Empresa</div>
            <select className="input" {...form.register('empresa_id')} defaultValue="">
              <option value="">(opcional)</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Valor</div>
            <input
              className="input"
              type="number"
              step="0.01"
              {...form.register('valor')}
              onChange={(e) => {
                form.setValue('valor', Number(e.target.value || 0), { shouldValidate: true });
                form.setValue('total', (Number(e.target.value || 0) * (Number(form.getValues('quantidade')) || 0)) as any, {
                  shouldValidate: true
                });
              }}
            />
            {form.formState.errors.valor && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.valor.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Quantidade</div>
            <input
              className="input"
              type="number"
              step="1"
              {...form.register('quantidade')}
              onChange={(e) => {
                const q = Number(e.target.value || 0);
                form.setValue('quantidade', q, { shouldValidate: true });
                form.setValue('total', ((Number(form.getValues('valor')) || 0) * q) as any, { shouldValidate: true });
              }}
            />
            {form.formState.errors.quantidade && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.quantidade.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Total (auto)</div>
            <input className="input" type="number" step="0.01" disabled value={Number(form.watch('total') || 0)} />
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
                if (!editingRow?.faturaId) return;
                try {
                  setDeleting(true);
                  await apiFetch(`/faturas/${editingRow.faturaId}`, {
                    method: 'DELETE',
                    json: { password: deletePassword }
                  });
                  await load();
                  setDeleteOpen(false);
                  setOpen(false);
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Falha ao excluir fatura');
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
          Digite sua senha para confirmar a exclusão desta fatura.
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

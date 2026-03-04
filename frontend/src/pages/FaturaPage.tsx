import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';
import { useEffect } from 'react';
import { useAuth } from '../auth/auth';

const schema = z
  .object({
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

type UserOption = { userId: string; nome: string; tipoUsuario: string; status: string };
type FaseOption = { faseId: string; fase: string };

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

export default function FaturaPage() {
  const { user } = useAuth();
  const canWrite = ['Owner', 'Engenheiro', 'Gerente'].includes(user?.tipoUsuario || '');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fases, setFases] = useState<FaseOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [faseFilter, setFaseFilter] = useState('');

  const defaults = useMemo<FormValues>(
    () => ({
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
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        setOptionsError(null);
        const [u, f] = await Promise.all([
          apiFetch<UserOption[]>('/cadastros/options', { method: 'GET' }),
          apiFetch<FaseOption[]>('/fases/options', { method: 'GET' })
        ]);
        if (!alive) return;
        setUsers(u);
        setFases(f);
      } catch (e) {
        if (!alive) return;
        setOptionsError(e instanceof Error ? e.message : 'Falha ao carregar options');
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
          <div style={{ fontWeight: 700 }}>Faturas</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Lançamentos e pagamentos</div>
        </div>
        <button
          className="btn primary"
          disabled={!canWrite}
          onClick={() => {
            setMode('create');
            setEditingRow(null);
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
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
        <select className="input" value={faseFilter} onChange={(e) => setFaseFilter(e.target.value)}>
          <option value="">Fase (todas)</option>
          {fases.map((f) => (
            <option key={f.faseId} value={f.faseId}>
              {f.fase}
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
              <th style={{ padding: 10 }}>Ações</th>
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
                <tr key={r.faturaId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 10 }}>{r.fatura}</td>
                  <td style={{ padding: 10, opacity: 0.7, fontSize: 12 }}>{r.faseNome || '-'}</td>
                  <td style={{ padding: 10 }}>{formatBrDate(r.data)}</td>
                  <td style={{ padding: 10 }}>{r.quantidade}</td>
                  <td style={{ padding: 10 }}>{r.valor}</td>
                  <td style={{ padding: 10 }}>{r.total}</td>
                  <td style={{ padding: 10, color: pagamentoColor(r.pagamento), fontWeight: 600 }}>{r.pagamento}</td>
                  <td style={{ padding: 10 }}>
                    <button
                      className="btn"
                      type="button"
                      title="Editar"
                      disabled={!canWrite}
                      onClick={() => {
                        setMode('edit');
                        setEditingRow(r);
                        form.reset({
                          descricao: r.fatura || '',
                          data: toDateOnlyLocal(r.data),
                          lancamento: toDateOnlyLocal(r.lancamento) || toDateOnlyLocal(new Date().toISOString()),
                          data_pagamento: toDateOnlyLocal(r.dataPagamento),
                          dados_pagamento: r.dadosPagamento || '',
                          nfe: r.nfe || '',
                          status: r.status || 'ATIVO',
                          pagamento: r.pagamento || 'aberto',
                          valor: Number(r.valor || 0),
                          quantidade: Number(r.quantidade || 0),
                          total: Number(r.total || 0),
                          fase_id: String(r.faseId ?? ''),
                          responsavel_id: r.responsavelId ? String(r.responsavelId) : '',
                          empresa_id: r.empresaId ? String(r.empresaId) : ''
                        });
                        setOpen(true);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <PencilIcon />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
                const payload = { ...values, total: totalCalc };

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
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
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

          <input type="hidden" {...form.register('status')} />

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Fase</div>
            <select className="input" {...form.register('fase_id')} defaultValue="">
              <option value="">Selecione...</option>
              {fases.map((f) => (
                <option key={f.faseId} value={f.faseId}>
                  {f.fase}
                </option>
              ))}
            </select>
            {form.formState.errors.fase_id && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.fase_id.message}</div>
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

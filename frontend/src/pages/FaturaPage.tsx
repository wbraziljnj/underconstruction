import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';
import { useEffect } from 'react';

const schema = z
  .object({
    data: z.string().min(1, 'Data obrigatória'),
    lancamento: z.string().optional(),
    data_pagamento: z.string().optional(),
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

function nowLocalDatetime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export default function FaturaPage() {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fases, setFases] = useState<FaseOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const defaults = useMemo<FormValues>(
    () => ({
      data: '',
      lancamento: nowLocalDatetime(),
      data_pagamento: '',
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
  }, [open]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Faturas</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Lançamentos e pagamentos</div>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            form.reset(defaults);
            // recalcula total no front só para UX (backend vai recalcular depois)
            form.setValue('total', (Number(valor) || 0) * (Number(quantidade) || 0), { shouldValidate: true });
            setOpen(true);
          }}
        >
          + Nova
        </button>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10 }}>
        <input className="input" placeholder="Buscar por descrição / fase / responsável" />
        <select className="input" defaultValue="">
          <option value="">Pagamento (todos)</option>
          <option value="aberto">Aberto</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
        <select className="input" defaultValue="">
          <option value="">Status (todos)</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </select>
        <input className="input" placeholder="Data (YYYY-MM-DD)" />
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.8 }}>
              <th style={{ padding: 10 }}>Data</th>
              <th style={{ padding: 10 }}>Descrição</th>
              <th style={{ padding: 10 }}>Quantidade</th>
              <th style={{ padding: 10 }}>Valor</th>
              <th style={{ padding: 10 }}>Total</th>
              <th style={{ padding: 10 }}>Pagamento</th>
              <th style={{ padding: 10 }} />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
                Carregando/sem dados (API será integrada na próxima etapa).
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title="Nova fatura"
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={() => setOpen(false)} type="button">
              Cancelar
            </button>
            <button
              className="btn primary"
              onClick={form.handleSubmit(async (values) => {
                // UX: recalcula total antes de enviar; backend vai recalcular também.
                const totalCalc = (Number(values.valor) || 0) * (Number(values.quantidade) || 0);
                const payload = { ...values, total: totalCalc };

                // Regra: se pagamento != pago, limpar data_pagamento
                if (payload.pagamento !== 'pago') payload.data_pagamento = '';

                // TODO: integrar POST /api/faturas (uc_faturas)
                console.log('nova_fatura', payload);
                setOpen(false);
              })}
              type="button"
            >
              Salvar
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
            <input className="input" type="datetime-local" {...form.register('data')} />
            {form.formState.errors.data && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.data.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Lançamento (auto)</div>
            <input className="input" type="datetime-local" disabled value={form.watch('lancamento') || ''} />
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
              <option value="aberto">aberto</option>
              <option value="pendente">pendente</option>
              <option value="pago">pago</option>
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Data pagamento (opcional)</div>
            <input className="input" type="datetime-local" {...form.register('data_pagamento')} />
            {form.formState.errors.data_pagamento && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>
                {form.formState.errors.data_pagamento.message}
              </div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
            <select className="input" {...form.register('status')}>
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </label>

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
              <b>created_at:</b> —
            </div>
            <div>
              <b>updated_at:</b> —
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

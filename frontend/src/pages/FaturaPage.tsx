import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z
  .object({
    data: z.string().min(1, 'Data obrigatória'),
    lancamento: z.string().optional(),
    data_pagamento: z.string().optional(),
    status: z.enum(['ATIVO', 'INATIVO']),
    pagamento: z.enum(['aberto', 'pendente', 'pago']),
    valor: z.coerce.number().nonnegative('Valor inválido'),
    quantidade: z.coerce.number().int('Quantidade inválida').nonnegative('Quantidade inválida'),
    descricao: z.string().min(1, 'Descrição obrigatória'),
    total: z.coerce.number().nonnegative('Total inválido'),
    fase_id: z.string().min(1, 'Fase ID obrigatório'),
    responsavel_id: z.string().optional(),
    empresa_id: z.string().optional(),
    code: z.string().min(1, 'Code (obra) obrigatório')
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

function nowLocalDatetime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export default function FaturaPage() {
  const [open, setOpen] = useState(false);

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
      code: ''
    }),
    []
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults
  });

  const valor = form.watch('valor');
  const quantidade = form.watch('quantidade');

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
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}
        >
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
            <div style={{ fontSize: 12, opacity: 0.8 }}>Fase ID (char(36))</div>
            <input className="input" {...form.register('fase_id')} />
            {form.formState.errors.fase_id && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.fase_id.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Responsável ID (char(36))</div>
            <input className="input" {...form.register('responsavel_id')} placeholder="(opcional)" />
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Empresa ID (char(36))</div>
            <input className="input" {...form.register('empresa_id')} placeholder="(opcional)" />
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

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Descrição (text)</div>
            <textarea className="input" {...form.register('descricao')} />
            {form.formState.errors.descricao && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.descricao.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Total (auto)</div>
            <input className="input" type="number" step="0.01" disabled value={Number(form.watch('total') || 0)} />
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Code (obra)</div>
            <input className="input" {...form.register('code')} placeholder="Ex: minhacasa" />
            {form.formState.errors.code && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.code.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>created_at</div>
            <input className="input" disabled value="(auto)" />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>updated_at</div>
            <input className="input" disabled value="(auto)" />
          </label>
        </form>
      </Modal>
    </div>
  );
}

import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z
  .object({
    fase: z.string().min(1, 'Fase obrigatória'),
    data_inicio: z.string().min(1, 'Data início obrigatória'),
    previsao_finalizacao: z.string().min(1, 'Previsão obrigatória'),
    data_finalizacao: z.string().optional(),
    responsavel_id: z.string().optional(),
    valor_total: z.coerce.number().nonnegative('Valor total inválido'),
    valor_parcial: z.coerce.number().nonnegative('Valor parcial inválido'),
    notas: z.string().optional(),
    code: z.string().min(1, 'Code (obra) obrigatório')
  })
  .refine((v) => v.valor_parcial <= v.valor_total, {
    message: 'Valor parcial não pode ser maior que o valor total',
    path: ['valor_parcial']
  });

type FormValues = z.infer<typeof schema>;

function toLocalDatetimeInputValue(value?: string) {
  if (!value) return '';
  // aceita YYYY-MM-DDTHH:mm (input) ou datas completas; mantém simples
  return value;
}

export default function FasesPage() {
  const [open, setOpen] = useState(false);

  const defaults = useMemo<FormValues>(
    () => ({
      fase: '',
      data_inicio: '',
      previsao_finalizacao: '',
      data_finalizacao: '',
      responsavel_id: '',
      valor_total: 0,
      valor_parcial: 0,
      notas: '',
      code: ''
    }),
    []
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults
  });

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Fases</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Cadastro e acompanhamento das fases da obra</div>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            form.reset(defaults);
            setOpen(true);
          }}
        >
          + Nova
        </button>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <input className="input" placeholder="Buscar por fase / responsável" />
        <input className="input" placeholder="Data início (YYYY-MM-DD)" />
        <select className="input" defaultValue="">
          <option value="">Status (todos)</option>
          <option value="ABERTA">Aberta</option>
          <option value="PENDENTE">Pendente</option>
          <option value="FINALIZADA">Finalizada</option>
        </select>
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.8 }}>
              <th style={{ padding: 10 }}>Fase</th>
              <th style={{ padding: 10 }}>Início</th>
              <th style={{ padding: 10 }}>Previsão</th>
              <th style={{ padding: 10 }}>Finalização</th>
              <th style={{ padding: 10 }}>Responsável</th>
              <th style={{ padding: 10 }}>Valor total</th>
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
        title="Nova fase"
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={() => setOpen(false)} type="button">
              Cancelar
            </button>
            <button
              className="btn primary"
              onClick={form.handleSubmit(async (values) => {
                // TODO: integrar POST /api/fases (uc_fases)
                console.log('nova_fase', values);
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
          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Fase</div>
            <input className="input" {...form.register('fase')} />
            {form.formState.errors.fase && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.fase.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Data início (datetime)</div>
            <input
              className="input"
              type="datetime-local"
              value={toLocalDatetimeInputValue(form.watch('data_inicio'))}
              onChange={(e) => form.setValue('data_inicio', e.target.value, { shouldValidate: true })}
            />
            {form.formState.errors.data_inicio && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.data_inicio.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Previsão finalização (datetime)</div>
            <input
              className="input"
              type="datetime-local"
              value={toLocalDatetimeInputValue(form.watch('previsao_finalizacao'))}
              onChange={(e) => form.setValue('previsao_finalizacao', e.target.value, { shouldValidate: true })}
            />
            {form.formState.errors.previsao_finalizacao && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>
                {form.formState.errors.previsao_finalizacao.message}
              </div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Data finalização (opcional)</div>
            <input
              className="input"
              type="datetime-local"
              value={toLocalDatetimeInputValue(form.watch('data_finalizacao'))}
              onChange={(e) => form.setValue('data_finalizacao', e.target.value, { shouldValidate: true })}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Responsável ID (char(36))</div>
            <input className="input" {...form.register('responsavel_id')} placeholder="(opcional)" />
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Valor total</div>
            <input className="input" type="number" step="0.01" {...form.register('valor_total')} />
            {form.formState.errors.valor_total && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.valor_total.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Valor parcial</div>
            <input className="input" type="number" step="0.01" {...form.register('valor_parcial')} />
            {form.formState.errors.valor_parcial && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.valor_parcial.message}</div>
            )}
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Notas (text)</div>
            <textarea className="input" {...form.register('notas')} />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
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

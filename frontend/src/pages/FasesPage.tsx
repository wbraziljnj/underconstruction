import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';
import { apiFetch } from '../api/client';

const schema = z
  .object({
    fase: z.string().min(1, 'Fase obrigatória'),
    status: z.enum(['ABERTO', 'ANDAMENTO', 'PENDENTE', 'FINALIZADO']),
    data_inicio: z.string().min(1, 'Data início obrigatória'),
    previsao_finalizacao: z.string().min(1, 'Previsão obrigatória'),
    data_finalizacao: z.string().optional(),
    responsavel_id: z.string().optional(),
    valor_total: z.coerce.number().nonnegative('Valor total inválido'),
    valor_parcial: z.coerce.number().nonnegative('Valor parcial inválido'),
    notas: z.string().optional()
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
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  const defaults = useMemo<FormValues>(
    () => ({
      fase: '',
      status: 'ABERTO',
      data_inicio: '',
      previsao_finalizacao: '',
      data_finalizacao: '',
      responsavel_id: '',
      valor_total: 0,
      valor_parcial: 0,
      notas: ''
    }),
    []
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults
  });

  async function load() {
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
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
  }, []);

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

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10 }}>
        <input
          className="input"
          placeholder="Buscar por fase / responsável"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input className="input" placeholder="Data início (filtro depois)" disabled />
        <select className="input" defaultValue="" disabled>
          <option value="">Status (todos)</option>
          <option value="ABERTA">Aberta</option>
          <option value="PENDENTE">Pendente</option>
          <option value="FINALIZADA">Finalizada</option>
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
              <th style={{ padding: 10 }}>Início</th>
              <th style={{ padding: 10 }}>Previsão</th>
              <th style={{ padding: 10 }}>Finalização</th>
              <th style={{ padding: 10 }}>Responsável</th>
              <th style={{ padding: 10 }}>Valor total</th>
              <th style={{ padding: 10 }} />
            </tr>
          </thead>
          <tbody>
            {listError ? (
              <tr>
                <td colSpan={7} style={{ padding: 12, color: 'var(--danger)' }}>
                  {listError}
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
                  Nenhuma fase encontrada.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.faseId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 10 }}>{r.fase}</td>
                  <td style={{ padding: 10 }}>{r.dataInicio}</td>
                  <td style={{ padding: 10 }}>{r.previsaoFinalizacao}</td>
                  <td style={{ padding: 10 }}>{r.dataFinalizacao || '-'}</td>
                  <td style={{ padding: 10 }}>{r.responsavelNome || '-'}</td>
                  <td style={{ padding: 10 }}>{r.valorTotal}</td>
                  <td style={{ padding: 10 }} />
                </tr>
              ))
            )}
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
              disabled={saving}
              onClick={form.handleSubmit(async (values) => {
                try {
                  setSaving(true);
                  await apiFetch('/fases', {
                    method: 'POST',
                    json: values
                  });
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
            <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
            <select className="input" {...form.register('status')}>
              <option value="ABERTO">Aberto</option>
              <option value="ANDAMENTO">Andamento</option>
              <option value="PENDENTE">Pendente</option>
              <option value="FINALIZADO">Finalizado</option>
            </select>
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

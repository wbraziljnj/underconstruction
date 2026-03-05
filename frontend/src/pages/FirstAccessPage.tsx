import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/auth';

const schema = z
  .object({
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    confirm: z.string().min(6, 'Confirme a senha'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Senhas não conferem' });

type FormValues = z.infer<typeof schema>;

export default function FirstAccessPage() {
  const { user, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaults = useMemo<FormValues>(() => ({ password: '', confirm: '' }), []);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 120px)' }}>
      <div className="card" style={{ width: 420, maxWidth: '92vw', padding: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Primeiro acesso</div>
        <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
          Olá{user?.nome ? `, ${user.nome}` : ''}. Sua senha está como padrão. Crie uma nova senha para continuar.
        </div>

        {error ? (
          <div className="card" style={{ padding: 10, marginTop: 12, borderColor: 'rgba(255,77,109,0.55)' }}>
            <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>
          </div>
        ) : null}

        <form
          onSubmit={(e) => e.preventDefault()}
          autoComplete="off"
          style={{ display: 'grid', gap: 10, marginTop: 12 }}
        >
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Nova senha</div>
            <input className="input" type="password" {...form.register('password')} />
            {form.formState.errors.password ? (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.password.message}</div>
            ) : null}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Confirmar nova senha</div>
            <input className="input" type="password" {...form.register('confirm')} />
            {form.formState.errors.confirm ? (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.confirm.message}</div>
            ) : null}
          </label>

          <button
            className="btn primary"
            type="button"
            disabled={saving}
            onClick={form.handleSubmit(async (values) => {
              setError(null);
              try {
                setSaving(true);
                await apiFetch('/password/change', {
                  method: 'POST',
                  json: { current_password: 'UnderConstruction', new_password: values.password },
                });
                await refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Falha ao salvar nova senha');
              } finally {
                setSaving(false);
              }
            })}
          >
            {saving ? 'Salvando...' : 'Salvar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}


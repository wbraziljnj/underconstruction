import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../auth/auth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória')
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' }
  });

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          try {
            await login(values.email, values.password);
            navigate('/home', { replace: true });
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Falha no login');
          }
        })}
        style={{
          width: 'min(420px, 100%)',
          border: '1px solid rgba(0,0,0,0.15)',
          borderRadius: 12,
          padding: 16
        }}
      >
        <h1 style={{ margin: '0 0 12px 0', fontSize: 18 }}>Under Construction</h1>
        <div style={{ margin: '0 0 12px 0', fontSize: 12, opacity: 0.7 }}>Entrar</div>

        <label style={{ display: 'block', marginBottom: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Email</div>
          <input
            {...form.register('email')}
            type="email"
            autoComplete="username"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          />
          {form.formState.errors.email && (
            <div style={{ color: '#b00020', fontSize: 12 }}>{form.formState.errors.email.message}</div>
          )}
        </label>

        <label style={{ display: 'block', marginBottom: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Senha</div>
          <input
            {...form.register('password')}
            type="password"
            autoComplete="current-password"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          />
          {form.formState.errors.password && (
            <div style={{ color: '#b00020', fontSize: 12 }}>{form.formState.errors.password.message}</div>
          )}
        </label>

        {error && <div style={{ color: '#b00020', fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: 0,
            background: '#111',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          {form.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  foto: z.string().optional(),
  tipo_usuario: z.enum([
    'Pedreiro',
    'Ajudante',
    'FornecedorMateriais',
    'Engenheiro',
    'PrestadorServico',
    'Gerente',
    'Owner'
  ]),
  nome: z.string().min(1, 'Nome obrigatório'),
  cpf_cnpj: z.string().min(1, 'CPF/CNPJ obrigatório'),
  telefone: z.string().min(1, 'Telefone obrigatório'),
  endereco: z.string().min(1, 'Endereço obrigatório'),
  email: z.string().email('Email inválido'),
  password_hash: z.string().min(1, 'Password hash obrigatório'),
  notas: z.string().optional(),
  status: z.enum(['ATIVO', 'INATIVO']),
  code: z.string().min(1, 'Code (obra) obrigatório')
});

type FormValues = z.infer<typeof schema>;

export default function CadastrosPage() {
  const [open, setOpen] = useState(false);

  const defaults = useMemo<FormValues>(
    () => ({
      foto: '',
      tipo_usuario: 'Pedreiro',
      nome: '',
      cpf_cnpj: '',
      telefone: '',
      endereco: '',
      email: '',
      password_hash: '',
      notas: '',
      status: 'ATIVO',
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
          <div style={{ fontWeight: 700 }}>Usuarios</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Usuários (pedreiro, ajudante, fornecedor, etc.)</div>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            form.reset(defaults);
            setOpen(true);
          }}
        >
          + Novo
        </button>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <input className="input" placeholder="Buscar por nome / CPF/CNPJ / email" />
        <select className="input" defaultValue="">
          <option value="">Tipo (todos)</option>
          <option value="Pedreiro">Pedreiro</option>
          <option value="Ajudante">Ajudante</option>
          <option value="FornecedorMateriais">Fornecedor Materiais</option>
          <option value="Engenheiro">Engenheiro</option>
          <option value="PrestadorServico">Prestador Serviço</option>
          <option value="Gerente">Gerente</option>
          <option value="Owner">Owner</option>
        </select>
        <select className="input" defaultValue="">
          <option value="">Status (todos)</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </select>
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.8 }}>
              <th style={{ padding: 10 }}>Nome</th>
              <th style={{ padding: 10 }}>Tipo</th>
              <th style={{ padding: 10 }}>CPF/CNPJ</th>
              <th style={{ padding: 10 }}>Telefone</th>
              <th style={{ padding: 10 }}>Email</th>
              <th style={{ padding: 10 }}>Status</th>
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
        title="Novo usuário"
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={() => setOpen(false)} type="button">
              Cancelar
            </button>
            <button
              className="btn primary"
              onClick={form.handleSubmit(async (values) => {
                // TODO: integrar POST /api/cadastros (uc_users)
                console.log('novo_usuario', values);
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
            <div style={{ fontSize: 12, opacity: 0.8 }}>Foto (text)</div>
            <input className="input" {...form.register('foto')} placeholder="uploads/..." />
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Tipo de usuário</div>
            <select className="input" {...form.register('tipo_usuario')}>
              <option value="Pedreiro">Pedreiro</option>
              <option value="Ajudante">Ajudante</option>
              <option value="FornecedorMateriais">Fornecedor Materiais</option>
              <option value="Engenheiro">Engenheiro</option>
              <option value="PrestadorServico">Prestador Serviço</option>
              <option value="Gerente">Gerente</option>
              <option value="Owner">Owner</option>
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Nome</div>
            <input className="input" {...form.register('nome')} />
            {form.formState.errors.nome && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.nome.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>CPF/CNPJ</div>
            <input className="input" {...form.register('cpf_cnpj')} />
            {form.formState.errors.cpf_cnpj && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.cpf_cnpj.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Telefone</div>
            <input className="input" {...form.register('telefone')} />
            {form.formState.errors.telefone && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.telefone.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Endereço</div>
            <input className="input" {...form.register('endereco')} />
            {form.formState.errors.endereco && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.endereco.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Email</div>
            <input className="input" type="email" {...form.register('email')} />
            {form.formState.errors.email && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.email.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
            <select className="input" {...form.register('status')}>
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Password hash (varchar(255))</div>
            <input className="input" {...form.register('password_hash')} placeholder="$2y$10$..." />
            {form.formState.errors.password_hash && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>
                {form.formState.errors.password_hash.message}
              </div>
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

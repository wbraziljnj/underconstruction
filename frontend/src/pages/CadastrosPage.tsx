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
  notas: z.string().optional(),
  status: z.enum(['ATIVO', 'INATIVO']),
  reset_senha: z.boolean().optional()
});

type FormValues = z.infer<typeof schema>;

export default function CadastrosPage() {
  const [open, setOpen] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);

  const defaults = useMemo<FormValues>(
    () => ({
      foto: '',
      tipo_usuario: 'Pedreiro',
      nome: '',
      cpf_cnpj: '',
      telefone: '',
      endereco: '',
      email: '',
      notas: '',
      status: 'ATIVO',
      reset_senha: false
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
            setSelectedPhotoFile(null);
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
                // Se reset_senha = true (edição), backend deve setar senha padrão "UnderConstruction".
                console.log('usuario_payload', {
                  ...values,
                  fotoFile: selectedPhotoFile ? { name: selectedPhotoFile.name, type: selectedPhotoFile.type } : null
                });
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
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Foto (imagem)</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {selectedPhotoFile ? selectedPhotoFile.name : 'Nenhum arquivo selecionado'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label className="btn" style={{ cursor: 'pointer' }}>
                  Selecionar
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setSelectedPhotoFile(file);
                    }}
                  />
                </label>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setSelectedPhotoFile(null);
                  }}
                  disabled={!selectedPhotoFile}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>

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
            <div style={{ fontSize: 12, opacity: 0.8 }}>Resetar Senha?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <input type="checkbox" {...form.register('reset_senha')} />
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Se SIM, ao salvar a edição o backend volta a senha para o padrão <b>UnderConstruction</b>.
              </div>
            </div>
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

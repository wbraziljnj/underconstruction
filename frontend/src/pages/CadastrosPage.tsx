import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';

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
type UploadResponse = { path?: string; url?: string; filename?: string };

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

function apiBaseUrl() {
  const baseUrl = (import.meta as any).env?.BASE_URL ?? '/';
  return `${String(baseUrl).replace(/\/?$/, '/')}`;
}

async function uploadFoto(file: File): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append('foto', file);

  const res = await fetch(`${apiBaseUrl()}api/upload-foto`, {
    method: 'POST',
    credentials: 'include',
    body: fd
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as any)?.detail || (data as any)?.error || 'Falha no upload';
    throw new Error(detail);
  }
  return data as UploadResponse;
}

export default function CadastrosPage() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  async function load() {
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (tipoFilter) params.set('tipo_usuario', tipoFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await apiFetch<{ items: any[] }>(`/cadastros?${params.toString()}`, { method: 'GET' });
      setRows(res.items || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Falha ao carregar usuários');
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
          <div style={{ fontWeight: 700 }}>Usuarios</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Usuários (pedreiro, ajudante, fornecedor, etc.)</div>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            setMode('create');
            setEditingRow(null);
            form.reset(defaults);
            setSelectedPhotoFile(null);
            setOpen(true);
          }}
        >
          + Novo
        </button>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10 }}>
        <input
          className="input"
          placeholder="Buscar por nome / CPF/CNPJ / email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
          <option value="">Tipo (todos)</option>
          <option value="Pedreiro">Pedreiro</option>
          <option value="Ajudante">Ajudante</option>
          <option value="FornecedorMateriais">Fornecedor Materiais</option>
          <option value="Engenheiro">Engenheiro</option>
          <option value="PrestadorServico">Prestador Serviço</option>
          <option value="Gerente">Gerente</option>
          <option value="Owner">Owner</option>
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Status (todos)</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </select>
        <button className="btn" onClick={() => load()} disabled={loading}>
          Filtrar
        </button>
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
              <th style={{ padding: 10 }}>Ações</th>
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
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.userId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 10 }}>{r.nome}</td>
                  <td style={{ padding: 10 }}>{r.tipoUsuario}</td>
                  <td style={{ padding: 10 }}>{r.cpfCnpj}</td>
                  <td style={{ padding: 10 }}>{r.telefone}</td>
                  <td style={{ padding: 10 }}>{r.email}</td>
                  <td style={{ padding: 10 }}>{r.status}</td>
                  <td style={{ padding: 10 }}>
                    <button
                      className="btn"
                      type="button"
                      title="Editar"
                      onClick={() => {
                        setMode('edit');
                        setEditingRow(r);
                        setSelectedPhotoFile(null);
                        form.reset({
                          foto: r.foto || '',
                          tipo_usuario: r.tipoUsuario,
                          nome: r.nome,
                          cpf_cnpj: r.cpfCnpj,
                          telefone: r.telefone,
                          endereco: r.endereco,
                          email: r.email,
                          notas: r.notas || '',
                          status: r.status,
                          reset_senha: false
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
        title={mode === 'edit' ? 'Editar usuário' : 'Novo usuário'}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {mode === 'edit' ? (
              <button
                className="btn danger"
                type="button"
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
                try {
                  setSaving(true);
                  let fotoPath = values.foto || '';
                  if (selectedPhotoFile) {
                    const uploaded = await uploadFoto(selectedPhotoFile);
                    fotoPath = uploaded.path || uploaded.url || uploaded.filename || '';
                  }
                  const payload = {
                    ...values,
                    foto: fotoPath || null,
                    reset_senha: Boolean(values.reset_senha)
                  };
                  if (mode === 'edit' && editingRow?.userId) {
                    await apiFetch(`/cadastros/${editingRow.userId}`, { method: 'PUT', json: payload });
                  } else {
                    await apiFetch('/cadastros', { method: 'POST', json: payload });
                  }
                  await load();
                  setOpen(false);
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Falha ao salvar usuário');
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
                if (!editingRow?.userId) return;
                try {
                  setDeleting(true);
                  await apiFetch(`/cadastros/${editingRow.userId}`, {
                    method: 'DELETE',
                    json: { password: deletePassword }
                  });
                  await load();
                  setDeleteOpen(false);
                  setOpen(false);
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Falha ao excluir usuário');
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
          Digite sua senha para confirmar a exclusão deste usuário.
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

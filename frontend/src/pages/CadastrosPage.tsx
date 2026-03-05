import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/auth';

function maskCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3').trim();
  }
  return digits.replace(/^(\d{2})(\d{5})(\d{0,4})$/, '($1) $2-$3').trim();
}

const schema = z.object({
  id_principal: z.string().optional(),
  foto: z.string().optional(),
  tipo_usuario: z.enum([
    'Owner',
    'Proprietario',
    'Gerente',
    'Engenheiro',
    'Arquiteto',
    'Operacional',
    'Pedreiro',
    'Ajudante',
    'Fornecedor',
    'Fiscalizacao'
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
  const { user } = useAuth();
  const canWrite = ['Owner', 'Proprietario', 'Gerente', 'Engenheiro'].includes(user?.tipoUsuario || '');
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
  const [linkedPrincipal, setLinkedPrincipal] = useState<any | null>(null);

  const defaults = useMemo<FormValues>(
    () => ({
      id_principal: '',
      foto: '',
      tipo_usuario: '',
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
  const tipoUsuarioValue = form.watch('tipo_usuario');
  const isLinkedPrincipal = Boolean(linkedPrincipal);
  const emailValue = form.watch('email') || '';
  const emailReady = emailValue.trim().length > 0;
  const lockFields = !emailReady || isLinkedPrincipal;

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
  }, [user?.activeCode]);

  async function handleEmailLookup(email: string) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setLinkedPrincipal(null);
      return;
    }
    try {
      const res = await apiFetch<any | null>(`/cadastros/lookup?email=${encodeURIComponent(trimmed)}`, { method: 'GET' });
      if (!res) {
        setLinkedPrincipal(null);
        form.setValue('id_principal', '');
        return;
      }
      setLinkedPrincipal(res);
      form.setValue('id_principal', res.idPrincipal || '');
      form.setValue('nome', res.nome || '');
      form.setValue('cpf_cnpj', res.cpfCnpj || '');
      form.setValue('telefone', res.telefone || '');
      form.setValue('endereco', res.endereco || '');
      form.setValue('status', res.status || 'ATIVO');
      form.setValue('foto', res.foto || '');
      // tipo_usuario permanece para escolha; notas limpa para novo contexto.
    } catch (e) {
      console.error(e);
      setLinkedPrincipal(null);
    }
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Usuarios</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Usuários (pedreiro, ajudante, fornecedor, etc.)</div>
        </div>
        <button
          className="btn primary"
          disabled={!canWrite}
          onClick={() => {
            setMode('create');
            setEditingRow(null);
            form.reset(defaults);
            setSelectedPhotoFile(null);
            setLinkedPrincipal(null);
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
          <option value="Ajudante">Ajudante</option>
          <option value="Arquiteto">Arquiteto</option>
          <option value="Engenheiro">Engenheiro</option>
          <option value="Fiscalizacao">Fiscalização</option>
          <option value="Fornecedor">Fornecedor</option>
          <option value="Gerente">Gerente</option>
          <option value="Operacional">Operacional</option>
          <option value="Pedreiro">Pedreiro</option>
          <option value="Proprietario">Proprietário</option>
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
                  <td style={{ padding: 10 }}>{maskCpfCnpj(r.cpfCnpj || '')}</td>
                  <td style={{ padding: 10 }}>{maskPhone(r.telefone || '')}</td>
                  <td style={{ padding: 10 }}>{r.email}</td>
                  <td style={{ padding: 10 }}>{r.status}</td>
                  <td style={{ padding: 10 }}>
                    <button
                      className="btn"
                      type="button"
                      title="Editar"
                      disabled={
                        !canWrite ||
                        (String(r.tipoUsuario || '') === 'Owner' && String(user?.userId || '') !== String(r.userId || ''))
                      }
                      onClick={() => {
                        setMode('edit');
                        setEditingRow(r);
                        setSelectedPhotoFile(null);
                        setLinkedPrincipal(null);
                        form.reset({
                          id_principal: r.idPrincipal || '',
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
                try {
                  setSaving(true);
                  let fotoPath = values.foto || '';
                  if (selectedPhotoFile) {
                    const uploaded = await uploadFoto(selectedPhotoFile);
                    fotoPath = uploaded.path || uploaded.url || uploaded.filename || '';
                  }
                  const payload = {
                    ...values,
                    id_principal: values.id_principal || undefined,
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
          {isLinkedPrincipal ? (
            <div style={{ gridColumn: '1 / -1', padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }}>
              Este email já possui cadastro principal. Dados bloqueados; preencha apenas <b>Tipo de usuário</b> e <b>Notas</b>. Senha e demais campos seguem o cadastro principal.
            </div>
          ) : null}

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Foto (imagem)</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {selectedPhotoFile ? selectedPhotoFile.name : 'Nenhum arquivo selecionado'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label className="btn" style={{ cursor: lockFields ? 'not-allowed' : 'pointer', opacity: lockFields ? 0.6 : 1 }}>
                  Selecionar
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    disabled={lockFields}
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
                  disabled={!selectedPhotoFile || lockFields}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>

          <label style={{ gridColumn: '1 / -1' }}>
            <input type="hidden" {...form.register('id_principal')} />
            <div style={{ fontSize: 12, opacity: 0.8 }}>Email</div>
            <input
              className="input"
              type="email"
              {...form.register('email')}
              onBlur={(e) => handleEmailLookup(e.target.value)}
              disabled={isLinkedPrincipal}
            />
            {form.formState.errors.email && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.email.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Tipo de usuário</div>
            <select
              className="input"
              {...form.register('tipo_usuario')}
              disabled={tipoUsuarioValue === 'Owner' ? true : !emailReady}
            >
              <option value="">Selecione uma função...</option>
              {tipoUsuarioValue === 'Owner' ? <option value="Owner">Owner (reservado)</option> : null}
              <option value="Proprietario">Proprietário</option>
              <option value="Gerente">Gerente</option>
              <option value="Engenheiro">Engenheiro</option>
              <option value="Arquiteto">Arquiteto</option>
              <option value="Operacional">Operacional</option>
              <option value="Ajudante">Ajudante</option>
              <option value="Fornecedor">Fornecedor</option>
              <option value="Pedreiro">Pedreiro</option>
              <option value="Fiscalizacao">Fiscalização</option>
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Nome</div>
            <input className="input" {...form.register('nome')} disabled={lockFields} />
            {form.formState.errors.nome && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.nome.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>CPF/CNPJ</div>
            <input
              className="input"
              {...form.register('cpf_cnpj')}
              value={maskCpfCnpj(form.watch('cpf_cnpj'))}
              disabled={lockFields}
              onChange={(e) => {
                const masked = maskCpfCnpj(e.target.value);
                form.setValue('cpf_cnpj', masked, { shouldValidate: true });
              }}
            />
            {form.formState.errors.cpf_cnpj && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.cpf_cnpj.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Telefone</div>
            <input
              className="input"
              {...form.register('telefone')}
              value={maskPhone(form.watch('telefone'))}
              disabled={lockFields}
              onChange={(e) => {
                const masked = maskPhone(e.target.value);
                form.setValue('telefone', masked, { shouldValidate: true });
              }}
            />
            {form.formState.errors.telefone && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.telefone.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Endereço</div>
            <input className="input" {...form.register('endereco')} disabled={lockFields} />
            {form.formState.errors.endereco && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{form.formState.errors.endereco.message}</div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Status</div>
            <select className="input" {...form.register('status')} disabled={lockFields}>
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Resetar Senha?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <input type="checkbox" {...form.register('reset_senha')} disabled={lockFields} />
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Se SIM, ao salvar a edição o backend volta a senha para o padrão <b>UnderConstruction</b>.
              </div>
            </div>
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Notas (text)</div>
            <textarea className="input" {...form.register('notas')} disabled={!emailReady} />
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

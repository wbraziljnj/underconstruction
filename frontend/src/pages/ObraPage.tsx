import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/auth';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  foto: z.string().optional(),
  nome: z.string().min(1, 'Nome obrigatório'),
  caderneta: z.string().optional(),
  responsavel_id: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  cep: z.string().optional(),
  matricula: z.string().optional(),
  engenheiro_responsavel_id: z.string().optional(),
  data_inicio: z.string().optional(),
  data_previsao_finalizacao: z.string().optional(),
  notas: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

type Obra = {
  obraId: number;
  foto: string | null;
  nome: string;
  caderneta: string | null;
  responsavel: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  matricula: string | null;
  engenheiroResponsavel: string | null;
  dataInicio: string | null;
  dataPrevisaoFinalizacao: string | null;
  codigo: string;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
};

function apiBaseUrl() {
  const baseUrl = (import.meta as any).env?.BASE_URL ?? '/';
  return `${String(baseUrl).replace(/\/?$/, '/')}`;
}

async function uploadFoto(file: File) {
  const fd = new FormData();
  fd.append('foto', file);
  const res = await fetch(`${apiBaseUrl()}api/upload-foto`, { method: 'POST', credentials: 'include', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.detail || 'Falha no upload');
  return data as { path?: string; url?: string; filename?: string };
}

export default function ObraPage() {
  const { user } = useAuth();
  const canWrite = ['Owner', 'Engenheiro', 'Gerente'].includes(user?.tipoUsuario || '');

  const [obra, setObra] = useState<Obra | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [users, setUsers] = useState<{ userId: string; nome: string; tipoUsuario: string; status: string }[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const defaults = useMemo<FormValues>(
    () => ({
      foto: '',
      nome: '',
      caderneta: '',
      responsavel_id: '',
      rua: '',
      numero: '',
      bairro: '',
      cidade: '',
      cep: '',
      matricula: '',
      engenheiro_responsavel_id: '',
      data_inicio: '',
      data_previsao_finalizacao: '',
      notas: ''
    }),
    []
  );

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<Obra | null>('/obra', { method: 'GET' });
      setObra(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar obra');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.activeCode]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        setOptionsError(null);
        const u = await apiFetch<{ userId: string; nome: string; tipoUsuario: string; status: string }[]>(
          '/cadastros/options',
          { method: 'GET' }
        );
        if (!alive) return;
        setUsers(u || []);
      } catch (e) {
        if (!alive) return;
        setOptionsError(e instanceof Error ? e.message : 'Falha ao carregar usuários');
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, user?.activeCode]);

  const responsaveis = useMemo(() => users, [users]);
  const engenheiros = useMemo(() => users, [users]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800 }}>Obra</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Perfil da obra (codigo = obra ativa do usuário)</div>
          </div>
          <button
            className="btn primary"
            disabled={!canWrite}
            onClick={() => {
              setSelectedPhotoFile(null);
              const v = obra
                ? {
                    foto: obra.foto || '',
                    nome: obra.nome || '',
                    caderneta: obra.caderneta || '',
                    responsavel_id: '',
                    rua: obra.rua || '',
                    numero: obra.numero || '',
                    bairro: obra.bairro || '',
                    cidade: obra.cidade || '',
                    cep: obra.cep || '',
                    matricula: obra.matricula || '',
                    engenheiro_responsavel_id: '',
                    data_inicio: obra.dataInicio || '',
                    data_previsao_finalizacao: obra.dataPrevisaoFinalizacao || '',
                    notas: obra.notas || ''
                  }
                : defaults;
              form.reset(v);
              setOpen(true);
            }}
          >
            {obra ? 'Editar' : 'Criar'}
          </button>
        </div>

        {loading ? (
          <div style={{ opacity: 0.7, marginTop: 10 }}>Carregando...</div>
        ) : error ? (
          <div style={{ color: 'var(--danger)', marginTop: 10 }}>{error}</div>
        ) : !obra ? (
          <div style={{ opacity: 0.7, marginTop: 10 }}>Nenhuma obra cadastrada para este código.</div>
        ) : (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Nome</div>
              <div style={{ fontWeight: 800 }}>{obra.nome}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Código</div>
              <div style={{ fontFamily: 'monospace' }}>{obra.codigo}</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Responsável</div>
              <div>{obra.responsavel || '-'}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Engenheiro responsável</div>
              <div>{obra.engenheiroResponsavel || '-'}</div>
            </div>
            <div className="card" style={{ padding: 12, gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Endereço</div>
              <div>
                {[obra.rua, obra.numero, obra.bairro, obra.cidade, obra.cep].filter(Boolean).join(' • ') || '-'}
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Data início</div>
              <div>{obra.dataInicio || '-'}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Previsão finalização</div>
              <div>{obra.dataPrevisaoFinalizacao || '-'}</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Matrícula</div>
              <div>{obra.matricula || '-'}</div>
            </div>
            <div className="card" style={{ padding: 12, gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Notas</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{obra.notas || '-'}</div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={open}
        title={obra ? 'Editar obra' : 'Criar obra'}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" type="button" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={saving}
              onClick={form.handleSubmit(async (values) => {
                try {
                  setSaving(true);
                  let fotoPath = values.foto || '';
                  if (selectedPhotoFile) {
                    const uploaded = await uploadFoto(selectedPhotoFile);
                    fotoPath = uploaded.path || uploaded.url || uploaded.filename || '';
                  }
                  const payload = { ...values, foto: fotoPath || null };
                  if (obra) {
                    await apiFetch('/obra', { method: 'PUT', json: payload });
                  } else {
                    await apiFetch('/obra', { method: 'POST', json: payload });
                  }
                  setOpen(false);
                  await load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Falha ao salvar obra');
                } finally {
                  setSaving(false);
                }
              })}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        }
      >
        {optionsError ? (
          <div className="card" style={{ padding: 10, marginBottom: 10, borderColor: 'rgba(255,77,109,0.55)' }}>
            <div style={{ color: 'var(--danger)', fontSize: 12 }}>{optionsError}</div>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Foto (imagem)</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {selectedPhotoFile ? selectedPhotoFile.name : 'Nenhum arquivo selecionado'}
                </div>
              </div>
              <label className="btn" style={{ cursor: 'pointer' }}>
                Selecionar
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => setSelectedPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Nome</div>
            <input className="input" {...form.register('nome')} />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Caderneta</div>
            <input className="input" {...form.register('caderneta')} />
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Responsável</div>
            <select className="input" {...form.register('responsavel_id')} defaultValue="">
              <option value="">Selecione...</option>
              {responsaveis.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Engenheiro responsável</div>
            <select className="input" {...form.register('engenheiro_responsavel_id')} defaultValue="">
              <option value="">Selecione (Engenheiro)...</option>
              {engenheiros.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Rua</div>
            <input className="input" {...form.register('rua')} />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Número</div>
            <input className="input" {...form.register('numero')} />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Bairro</div>
            <input className="input" {...form.register('bairro')} />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Cidade</div>
            <input className="input" {...form.register('cidade')} />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>CEP</div>
            <input className="input" {...form.register('cep')} />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Matrícula</div>
            <input className="input" {...form.register('matricula')} />
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Data início</div>
            <input className="input" type="date" {...form.register('data_inicio')} />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Previsão finalização</div>
            <input className="input" type="date" {...form.register('data_previsao_finalizacao')} />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Notas</div>
            <textarea className="input" {...form.register('notas')} />
          </label>
        </div>
      </Modal>
    </div>
  );
}

export type ApiError = {
  error?: string;
  detail?: string;
  message?: string;
};

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const baseUrl = (import.meta as any).env?.BASE_URL ?? '/';
  const apiBase = String(baseUrl).replace(/\/?$/, '/');
  const res = await fetch(`${apiBase}api${path}`, {
    ...init,
    credentials: 'include',
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      // Se o servidor devolver HTML (ex.: 404/rewrite), dá erro mais claro.
      throw new Error(`Resposta inválida da API (não JSON). HTTP ${res.status}`);
    }
  }
  if (!res.ok) {
    const err = (data ?? {}) as ApiError;
    const msg = err.detail || err.error || err.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

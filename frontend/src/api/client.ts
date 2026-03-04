export type ApiError = {
  error?: string;
  detail?: string;
  message?: string;
};

const LOG_BUFFER_KEY = 'uc_client_log_buffer';
const LOG_BUFFER_LIMIT = 200;

function apiBase(): string {
  const baseUrl = (import.meta as any).env?.BASE_URL ?? '/';
  return String(baseUrl).replace(/\/?$/, '/');
}

function genRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readBuffer(): any[] {
  try {
    const raw = localStorage.getItem(LOG_BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBuffer(events: any[]) {
  try {
    localStorage.setItem(LOG_BUFFER_KEY, JSON.stringify(events.slice(-LOG_BUFFER_LIMIT)));
  } catch {
    // ignore
  }
}

export function pushClientLog(event: any) {
  const buf = readBuffer();
  buf.push(event);
  writeBuffer(buf);
}

export async function flushClientLogs(): Promise<void> {
  const buf = readBuffer();
  if (buf.length === 0) return;
  writeBuffer([]); // optimistic clear
  try {
    await fetch(`${apiBase()}api/client-log`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buf)
    });
  } catch {
    const current = readBuffer();
    writeBuffer(current.concat(buf).slice(-LOG_BUFFER_LIMIT));
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const requestId = genRequestId();
  headers.set('X-Request-Id', requestId);

  const base = apiBase();
  const url = `${base}api${path}`;
  const started = performance.now();

  if (path !== '/client-log') {
    pushClientLog({
      event: 'api_call_start',
      request_id: requestId,
      url: path,
      method: init.method || 'GET',
      ts: new Date().toISOString()
    });
  }

  try {
    const res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body
    });

    const duration = Math.round(performance.now() - started);
    if (path !== '/client-log') {
      pushClientLog({
        event: res.ok ? 'api_call_end' : 'api_call_error',
        request_id: requestId,
        url: path,
        method: init.method || 'GET',
        status: res.status,
        duration_ms: duration,
        ts: new Date().toISOString()
      });
      if (!res.ok) {
        flushClientLogs();
      }
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    let data: unknown = null;
    if (text) {
      try {
        if (!contentType.includes('application/json')) {
          const snippet = text.slice(0, 180).replace(/\s+/g, ' ').trim();
          throw new Error(`Resposta inválida da API (não JSON). HTTP ${res.status}. CT=${contentType}. URL=${url}. Body="${snippet}"`);
        }
        data = JSON.parse(text) as unknown;
      } catch {
        const snippet = text.slice(0, 180).replace(/\s+/g, ' ').trim();
        throw new Error(`Resposta inválida da API (não JSON). HTTP ${res.status}. URL=${url}. Body="${snippet}"`);
      }
    }
    if (!res.ok) {
      const err = (data ?? {}) as ApiError;
      const msg = err.detail || err.error || err.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data as T;
  } catch (e) {
    if (path !== '/client-log') {
      pushClientLog({
        event: 'api_call_error',
        request_id: requestId,
        url: path,
        method: init.method || 'GET',
        ts: new Date().toISOString(),
        message: e instanceof Error ? e.message : String(e)
      });
      flushClientLogs();
    }
    throw e;
  }
}

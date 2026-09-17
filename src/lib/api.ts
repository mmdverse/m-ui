import type { TFunc } from '@/i18n/core';

/**
 * Client-side fetch helper: attaches the stored JWT and unwraps errors.
 * Token storage is resilient: localStorage when available (normal browsers),
 * otherwise an in-memory fallback (e.g. sandboxed preview frames where
 * localStorage access throws).
 */

const KEY = 'mui_token';
let memoryToken: string | null = null;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // sandboxed iframe without allow-same-origin
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const s = storage();
  if (s) {
    try {
      const v = s.getItem(KEY);
      if (v) return v;
    } catch {
      /* fall through to memory */
    }
  }
  return memoryToken;
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  memoryToken = token;
  const s = storage();
  if (s) {
    try {
      if (token) s.setItem(KEY, token);
      else s.removeItem(KEY);
    } catch {
      /* memory only */
    }
  }
}

/**
 * An API failure that keeps the server's machine-readable `code` (and its
 * `vars`) so the UI can say it in the user's language. `message` stays as-is,
 * which is what an unknown code falls back to.
 */
export class ApiError extends Error {
  status?: number;
  code?: string;
  vars?: Record<string, string | number>;
  constructor(message: string, status?: number, code?: string, vars?: Record<string, string | number>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.vars = vars;
  }
}

/** Server error → text in the active language; falls back to the raw message. */
export function apiErrorText(err: unknown, t: TFunc): string {
  const e = err as { message?: string; code?: string; vars?: Record<string, string | number> } | null;
  if (e?.code && e.code.startsWith('api.')) {
    const text = t(e.code, e.vars);
    if (text !== e.code) return text;
  }
  if (e?.message === 'network') return t('nav.connError');
  if (e?.message === 'unauthorized') return t('api.unauthorized');
  return e?.message || t('api.internal');
}

export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('network'); // server unreachable — NOT an auth problem
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    setToken(null);
    if (typeof window !== 'undefined') window.location.href = '/';
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new ApiError(data.error || `HTTP ${res.status}`, res.status, data.code, data.vars);
  return data;
}

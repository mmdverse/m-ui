/** Client-side fetch helper: attaches the stored JWT and unwraps errors. */

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('mui_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem('mui_token', token);
  else window.localStorage.removeItem('mui_token');
}

export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    setToken(null);
    if (typeof window !== 'undefined') window.location.href = '/';
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

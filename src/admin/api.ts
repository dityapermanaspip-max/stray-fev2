// Talks to the admin lab API through the Vite proxy, which adds the token from stray-bev1/.env.
// A manually entered token (sessionStorage only) is a fallback when the proxy has none.

const TOKEN_KEY = 'runstray.admin.token';

export function getToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage blocked: the token only lasts for this page
  }
  memoryToken = token;
}

let memoryToken = getToken();

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/admin-api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-admin-lab': '1', ...(memoryToken ? { 'x-admin-token': memoryToken } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as T & { error?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

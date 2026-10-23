const BASE_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

// In-memory copy of the auth token (persisted by AuthProvider via storage.secureSet).
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 && authToken && onUnauthorized) onUnauthorized();
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : "Eingabe ungültig";
    } catch {
      // ignore parse errors, keep status detail
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

function headers(json: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (authToken) h.Authorization = `Bearer ${authToken}`;
  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: headers(false) });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: headers(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: headers(true),
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

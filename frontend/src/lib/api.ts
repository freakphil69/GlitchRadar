const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").trim().replace(/\/+$/, "");
const BASE_URL = `${BACKEND_URL}/api`;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

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
    throw new ApiError(detail, res.status);
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
  return request<T>(path, { headers: headers(false) });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: headers(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }, path === "/scan" || path.endsWith("/enrich") ? 210_000 : 20_000);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    headers: headers(true),
    body: JSON.stringify(body),
  });
}

async function request<T>(path: string, init: RequestInit, timeoutMs = 20_000): Promise<T> {
  if (!/^https?:\/\/[^/]+/.test(BACKEND_URL)) {
    throw new Error("Backend ist nicht konfiguriert. Bitte die App-Konfiguration prüfen.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal });
    return await handle<T>(res);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Zeitüberschreitung. Bitte Verbindung prüfen und erneut versuchen.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'mf_token';

// localStorage token store — persists session JWT across page loads.
// The server returns a fresh JWT in X-Session-Token on every response,
// keeping it up-to-date when Google OAuth tokens are refreshed.
export const tokenStore = {
  get:   ()  => localStorage.getItem(TOKEN_KEY),
  set:   (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: ()  => localStorage.removeItem(TOKEN_KEY),
};

// CSRF token — fetched once, reused for all state-changing requests
let csrfToken = null;

function authHeaders() {
  const token = tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${BASE}/api/csrf-token`, {
      credentials: 'include',
      headers: authHeaders(),
    });
    const data = await res.json();
    csrfToken = data.csrfToken;
  } catch {
    // Silent — CSRF endpoint may not be available in dev
  }
  return csrfToken;
}

export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...options.headers,
  };

  // Attach CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const token = await ensureCsrfToken();
    if (token) headers['x-csrf-token'] = token;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  // Server returns a fresh session JWT when OAuth tokens are refreshed
  const freshToken = res.headers.get('X-Session-Token');
  if (freshToken) tokenStore.set(freshToken);

  const data = await res.json().catch(() => ({}));

  // CSRF token expired — refresh and retry once
  if (res.status === 403 && data.error?.includes?.('csrf')) {
    csrfToken = null;
    const newToken = await ensureCsrfToken();
    if (newToken) {
      headers['x-csrf-token'] = newToken;
      const retry = await fetch(`${BASE}${path}`, { ...options, credentials: 'include', headers });
      const retryFresh = retry.headers.get('X-Session-Token');
      if (retryFresh) tokenStore.set(retryFresh);
      const retryData = await retry.json().catch(() => ({}));
      if (!retry.ok) throw new Error(retryData.error || `HTTP ${retry.status}`);
      return retryData;
    }
  }

  // Session expired — clear local token and broadcast
  if (res.status === 401) {
    tokenStore.clear();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Session expired — please sign in again');
  }

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

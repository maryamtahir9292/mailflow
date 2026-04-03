const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

// CSRF token — fetched once, reused for all state-changing requests
let csrfToken = null;

async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${BASE}/api/csrf-token`, { credentials: 'include' });
    const data = await res.json();
    csrfToken = data.csrfToken;
  } catch {
    // Silent — CSRF endpoint may not be available in dev
  }
  return csrfToken;
}

export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  // Attach CSRF token for state-changing requests (POST, PUT, DELETE)
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const token = await ensureCsrfToken();
    if (token) headers['x-csrf-token'] = token;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const data = await res.json().catch(() => ({}));

  // CSRF token expired — refresh and retry once
  if (res.status === 403 && data.error?.includes?.('csrf')) {
    csrfToken = null;
    const newToken = await ensureCsrfToken();
    if (newToken) {
      headers['x-csrf-token'] = newToken;
      const retry = await fetch(`${BASE}${path}`, { ...options, credentials: 'include', headers });
      const retryData = await retry.json().catch(() => ({}));
      if (!retry.ok) throw new Error(retryData.error || `HTTP ${retry.status}`);
      return retryData;
    }
  }

  // Session expired — broadcast so App can redirect to login
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Session expired — please sign in again');
  }

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

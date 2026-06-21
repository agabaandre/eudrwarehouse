export class ManagementAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ManagementAuthError';
    this.authExpired = true;
  }
}

export function getManagementToken() {
  return localStorage.getItem('eudr_token');
}

export function clearManagementSession() {
  localStorage.removeItem('eudr_token');
}

export async function ensureManagementSession() {
  const token = getManagementToken();
  if (!token) {
    throw new ManagementAuthError('Please sign in to continue.');
  }

  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    clearManagementSession();
    const err = await res.json().catch(() => ({}));
    throw new ManagementAuthError(err.error || 'Session expired. Please sign in again.');
  }

  return res.json();
}

import { computed, ref } from 'vue';

export class ManagementAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ManagementAuthError';
    this.authExpired = true;
  }
}

const sessionTick = ref(0);

export function touchManagementSession() {
  sessionTick.value += 1;
}

export function getManagementToken() {
  return localStorage.getItem('eudr_token');
}

export function setManagementToken(token) {
  if (token) {
    localStorage.setItem('eudr_token', token);
  } else {
    localStorage.removeItem('eudr_token');
  }
  touchManagementSession();
}

export function clearManagementSession() {
  setManagementToken(null);
}

export function useManagementSession() {
  const isLoggedIn = computed(() => {
    sessionTick.value;
    return !!getManagementToken();
  });

  return { isLoggedIn };
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

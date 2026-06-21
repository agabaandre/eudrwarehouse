import { clearManagementSession } from '@/composables/managementAuth';

export function formatNumber(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return n;
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
}

export async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function apiAuth(path, options = {}) {
  const token = localStorage.getItem('eudr_token');
  const isFormData = options.body instanceof FormData;
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearManagementSession();
    }
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function statusBadgeClass(status) {
  const map = { compliant: 'badge-green', non_compliant: 'badge-red', pending: 'badge-yellow' };
  return map[status] || 'badge-yellow';
}

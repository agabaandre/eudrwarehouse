const API_BASE = '';

async function api(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiAuth(path, options = {}) {
  const token = localStorage.getItem('eudr_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function formatNumber(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function initHighcharts() {
  if (typeof Highcharts !== 'undefined') {
    Highcharts.setOptions({
      credits: { enabled: false },
      chart: { style: { fontFamily: 'Segoe UI, system-ui, sans-serif' } },
    });
  }
}

document.addEventListener('DOMContentLoaded', initHighcharts);

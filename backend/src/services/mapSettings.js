const db = require('../db/postgres');
const config = require('../config');
const cache = require('./cache');

const DEFAULTS = {
  google_maps_enabled: true,
  api_key: '',
  default_layer: 'districts',
  default_metric: 'compliance_rate',
  hidden_layer_ids: ['farm-clusters'],
  show_highcharts_district_panel: true,
};

let cacheMem = null;
let cacheAt = 0;
const CACHE_MS = 5000;

function envDefaults() {
  return {
    google_maps_enabled: true,
    api_key: config.googleMaps.apiKey || '',
    default_layer: 'districts',
    default_metric: 'compliance_rate',
    hidden_layer_ids: ['farm-clusters'],
    show_highcharts_district_panel: true,
  };
}

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    if (Array.isArray(v)) {
      out[k] = v;
    } else if (v && typeof v === 'object' && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], v);
    } else if (v !== undefined && v !== null) {
      out[k] = v;
    }
  }
  return out;
}

function maskApiKey(key) {
  if (!key || key.length < 8) return key ? '••••••••' : '';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

function isMaskedValue(val) {
  return typeof val === 'string' && val.includes('••••');
}

async function loadStoredSettings() {
  try {
    const { rows } = await db.query('SELECT settings FROM map_settings WHERE id = 1');
    return rows[0]?.settings || {};
  } catch {
    return {};
  }
}

async function getEffectiveSettings(force = false) {
  if (!force && cacheMem && Date.now() - cacheAt < CACHE_MS) {
    return cacheMem;
  }
  const stored = await loadStoredSettings();
  const merged = deepMerge(deepMerge(DEFAULTS, envDefaults()), stored);
  cacheMem = merged;
  cacheAt = Date.now();
  return merged;
}

function invalidateCache() {
  cacheMem = null;
  cacheAt = 0;
}

async function saveSettings(patch) {
  const current = await getEffectiveSettings(true);
  const next = deepMerge(current, patch);

  if (patch.api_key && isMaskedValue(patch.api_key)) {
    next.api_key = current.api_key || '';
  }

  if (Array.isArray(patch.hidden_layer_ids)) {
    next.hidden_layer_ids = patch.hidden_layer_ids.filter((id) => typeof id === 'string' && id.trim());
  }

  await db.query(
    `INSERT INTO map_settings (id, settings, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()`,
    [JSON.stringify(next)]
  );
  invalidateCache();
  await cache.invalidateNamespace('config');
  return next;
}

async function getAdminView() {
  const s = await getEffectiveSettings();
  const envKey = config.googleMaps.apiKey || '';
  return {
    google_maps_enabled: s.google_maps_enabled !== false,
    api_key_masked: maskApiKey(s.api_key),
    api_key_configured: !!s.api_key,
    api_key_source: s.api_key && s.api_key === envKey && envKey ? 'environment' : (s.api_key ? 'database' : 'none'),
    default_layer: s.default_layer,
    default_metric: s.default_metric,
    hidden_layer_ids: s.hidden_layer_ids || [],
    show_highcharts_district_panel: s.show_highcharts_district_panel !== false,
    available_layers: [
      { id: 'districts', name: 'District Boundaries' },
      { id: 'regions', name: 'Regional Boundaries' },
      { id: 'coffee-belt', name: 'Coffee Production Belt' },
      { id: 'risk-zones', name: 'Deforestation Risk Zones' },
      { id: 'farm-clusters', name: 'Registered Farm Clusters' },
    ],
    available_metrics: [
      { id: 'compliance_rate', name: 'Compliance rate' },
      { id: 'risk_score', name: 'Risk score' },
      { id: 'production_tons', name: 'Production (tons)' },
    ],
  };
}

function getPublicView(settings) {
  const s = settings || {};
  const key = s.google_maps_enabled !== false ? (s.api_key || '') : '';
  return {
    enabled: !!key,
    api_key: key,
    default_layer: s.default_layer || 'districts',
    default_metric: s.default_metric || 'compliance_rate',
    hidden_layer_ids: s.hidden_layer_ids || ['farm-clusters'],
    show_highcharts_district_panel: s.show_highcharts_district_panel !== false,
  };
}

module.exports = {
  getEffectiveSettings,
  saveSettings,
  getAdminView,
  getPublicView,
  invalidateCache,
  DEFAULTS,
};

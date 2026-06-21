const db = require('../db/postgres');
const config = require('../config');

const SETTINGS_KEY = 'assistant';
let cache = null;
let cacheAt = 0;
const CACHE_MS = 5000;

const DEFAULTS = {
  enabled: true,
  default_model: 'gpt-4o-mini',
  pro_requires_auth: true,
  include_compliance_data: true,
  search_internet_enabled: true,
  search_internet_default: false,
  system_prompt_extra: '',
  providers: {
    openai: { api_key: '', base_url: 'https://api.openai.com/v1' },
    gemini: { api_key: '' },
    deepseek: { api_key: '', base_url: 'https://api.deepseek.com/v1' },
    custom: { api_key: '', base_url: '', model: 'default' },
  },
  web_search: {
    provider: 'duckduckgo',
    serper_api_key: '',
    max_results: 5,
  },
};

function envDefaults() {
  return {
    enabled: config.ai.enabled,
    default_model: config.ai.defaultModel,
    pro_requires_auth: config.ai.proRequiresAuth,
    include_compliance_data: true,
    search_internet_enabled: true,
    search_internet_default: false,
    system_prompt_extra: '',
    providers: {
      openai: {
        api_key: config.ai.providers.openai.apiKey || '',
        base_url: config.ai.providers.openai.baseUrl || 'https://api.openai.com/v1',
      },
      gemini: { api_key: config.ai.providers.gemini.apiKey || '' },
      deepseek: {
        api_key: config.ai.providers.deepseek.apiKey || '',
        base_url: config.ai.providers.deepseek.baseUrl || 'https://api.deepseek.com/v1',
      },
      custom: {
        api_key: config.ai.providers.custom.apiKey || '',
        base_url: config.ai.providers.custom.baseUrl || '',
        model: config.ai.providers.custom.model || 'default',
      },
    },
    web_search: {
      provider: 'duckduckgo',
      serper_api_key: process.env.SERPER_API_KEY || '',
      max_results: 5,
    },
  };
}

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object') {
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
    const { rows } = await db.query('SELECT settings FROM ai_settings WHERE id = 1');
    return rows[0]?.settings || {};
  } catch {
    return {};
  }
}

async function getEffectiveSettings(force = false) {
  if (!force && cache && Date.now() - cacheAt < CACHE_MS) {
    return cache;
  }
  const stored = await loadStoredSettings();
  const merged = deepMerge(deepMerge(DEFAULTS, envDefaults()), stored);
  cache = merged;
  cacheAt = Date.now();
  return merged;
}

function invalidateCache() {
  cache = null;
  cacheAt = 0;
}

async function saveSettings(patch) {
  const current = await getEffectiveSettings(true);
  const next = deepMerge(current, patch);

  if (patch.providers) {
    for (const [name, prov] of Object.entries(patch.providers)) {
      if (prov?.api_key && isMaskedValue(prov.api_key)) {
        next.providers[name].api_key = current.providers[name]?.api_key || '';
      }
    }
  }
  if (patch.web_search?.serper_api_key && isMaskedValue(patch.web_search.serper_api_key)) {
    next.web_search.serper_api_key = current.web_search?.serper_api_key || '';
  }

  await db.query(
    `INSERT INTO ai_settings (id, settings, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()`,
    [JSON.stringify(next)]
  );
  invalidateCache();
  return next;
}

async function getAdminView() {
  const s = await getEffectiveSettings();
  return {
    enabled: s.enabled,
    default_model: s.default_model,
    pro_requires_auth: s.pro_requires_auth,
    include_compliance_data: s.include_compliance_data,
    search_internet_enabled: s.search_internet_enabled,
    search_internet_default: s.search_internet_default,
    system_prompt_extra: s.system_prompt_extra,
    providers: {
      openai: {
        configured: !!s.providers.openai.api_key,
        api_key_masked: maskApiKey(s.providers.openai.api_key),
        base_url: s.providers.openai.base_url,
      },
      gemini: {
        configured: !!s.providers.gemini.api_key,
        api_key_masked: maskApiKey(s.providers.gemini.api_key),
      },
      deepseek: {
        configured: !!s.providers.deepseek.api_key,
        api_key_masked: maskApiKey(s.providers.deepseek.api_key),
        base_url: s.providers.deepseek.base_url,
      },
      custom: {
        configured: !!(s.providers.custom.api_key && s.providers.custom.base_url),
        api_key_masked: maskApiKey(s.providers.custom.api_key),
        base_url: s.providers.custom.base_url,
        model: s.providers.custom.model,
      },
    },
    web_search: {
      provider: s.web_search.provider,
      serper_configured: !!s.web_search.serper_api_key,
      serper_api_key_masked: maskApiKey(s.web_search.serper_api_key),
      max_results: s.web_search.max_results,
    },
  };
}

function providerReady(settings, envKey) {
  const p = settings.providers?.[envKey];
  if (!p?.api_key) return false;
  if (envKey === 'custom' && !p.base_url) return false;
  return true;
}

module.exports = {
  getEffectiveSettings,
  saveSettings,
  getAdminView,
  invalidateCache,
  maskApiKey,
  providerReady,
  DEFAULTS,
};

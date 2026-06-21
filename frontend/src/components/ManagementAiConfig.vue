<script setup>
import { inject, onMounted, ref } from 'vue';
import { apiAuth } from '@/composables/api';
import { ensureManagementSession } from '@/composables/managementAuth';

const auth = inject('managementAuth', null);

const loading = ref(true);
const saving = ref(false);
const saveMsg = ref('');
const saveError = ref('');
const preview = ref('');
const testInput = ref('');
const testReply = ref('');
const testLoading = ref(false);
const testSearch = ref(true);
const testCompliance = ref(true);

const configured = ref({
  openai: false,
  gemini: false,
  deepseek: false,
  custom: false,
  serper: false,
});

const form = ref({
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
});

const modelOptions = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'gpt-4o', label: 'GPT-4o (Pro)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Pro)' },
  { id: 'deepseek-chat', label: 'DeepSeek Chat' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (Pro)' },
  { id: 'openai-compat', label: 'Custom OpenAI-compatible' },
  { id: 'platform-guide', label: 'Platform Guide (offline)' },
];

function isAuthError(message) {
  return /expired|authentication|invalid or expired token|sign in/i.test(message || '');
}

function handleApiError(e) {
  if (isAuthError(e.message)) {
    auth?.handleAuthError?.(e.message);
  }
  return e.message;
}

function stripMaskedSecrets(payload) {
  const next = JSON.parse(JSON.stringify(payload));
  for (const name of Object.keys(next.providers || {})) {
    const key = next.providers[name].api_key;
    if (!key || key.includes('••••') || key.includes('****')) {
      delete next.providers[name].api_key;
    }
  }
  if (next.web_search?.serper_api_key?.includes('••••')) {
    delete next.web_search.serper_api_key;
  }
  return next;
}

async function loadConfig() {
  loading.value = true;
  saveError.value = '';
  try {
    await ensureManagementSession();
    const data = await apiAuth('/api/assistant/admin/config');
    preview.value = data.compliance_context_preview || '';
    configured.value = {
      openai: !!data.providers?.openai?.configured,
      gemini: !!data.providers?.gemini?.configured,
      deepseek: !!data.providers?.deepseek?.configured,
      custom: !!data.providers?.custom?.configured,
      serper: !!data.web_search?.serper_configured,
    };
    form.value = {
      enabled: data.enabled !== false,
      default_model: data.default_model || 'gpt-4o-mini',
      pro_requires_auth: data.pro_requires_auth !== false,
      include_compliance_data: data.include_compliance_data !== false,
      search_internet_enabled: data.search_internet_enabled !== false,
      search_internet_default: !!data.search_internet_default,
      system_prompt_extra: data.system_prompt_extra || '',
      providers: {
        openai: {
          api_key: '',
          base_url: data.providers?.openai?.base_url || 'https://api.openai.com/v1',
        },
        gemini: { api_key: '' },
        deepseek: {
          api_key: '',
          base_url: data.providers?.deepseek?.base_url || 'https://api.deepseek.com/v1',
        },
        custom: {
          api_key: '',
          base_url: data.providers?.custom?.base_url || '',
          model: data.providers?.custom?.model || 'default',
        },
      },
      web_search: {
        provider: data.web_search?.provider || 'duckduckgo',
        serper_api_key: '',
        max_results: data.web_search?.max_results || 5,
      },
    };
  } catch (e) {
    saveError.value = handleApiError(e);
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  saving.value = true;
  saveMsg.value = '';
  saveError.value = '';
  try {
    await ensureManagementSession();
    const payload = stripMaskedSecrets(form.value);
    await apiAuth('/api/assistant/admin/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    saveMsg.value = 'AI configuration saved.';
    await loadConfig();
  } catch (e) {
    saveError.value = handleApiError(e);
  } finally {
    saving.value = false;
  }
}

async function refreshPreview() {
  try {
    await ensureManagementSession();
    const data = await apiAuth('/api/assistant/admin/compliance-preview');
    preview.value = data.context || '';
  } catch (e) {
    saveError.value = handleApiError(e);
  }
}

async function testAssistant() {
  if (!testInput.value.trim()) return;
  testLoading.value = true;
  testReply.value = '';
  try {
    await ensureManagementSession();
    const res = await apiAuth('/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        model: form.value.default_model,
        include_compliance_data: testCompliance.value,
        search_internet: testSearch.value,
        messages: [{ role: 'user', content: testInput.value }],
      }),
    });
    let text = res.reply;
    if (res.used_compliance_data) text += '\n\n[Used platform compliance data]';
    if (res.used_web_search && res.sources?.length) {
      text += `\n\n[Web sources: ${res.sources.map((s) => s.title).join('; ')}]`;
    }
    testReply.value = text;
  } catch (e) {
    testReply.value = `Error: ${handleApiError(e)}`;
  } finally {
    testLoading.value = false;
  }
}

onMounted(loadConfig);
</script>

<template>
  <div class="card ai-config-card">
    <h3>AI Compliance Assistant</h3>
    <p class="ai-config-intro">
      Configure GPT, Gemini, DeepSeek, or any OpenAI-compatible model. The assistant can use
      <strong>live platform compliance demo data</strong> and optional <strong>internet search</strong>.
    </p>

    <p v-if="loading" style="color:var(--muted)">Loading configuration…</p>

    <template v-else>
      <div class="ai-config-grid">
        <fieldset class="ai-fieldset">
          <legend>General</legend>
          <label class="ai-check"><input v-model="form.enabled" type="checkbox"> Assistant enabled</label>
          <label class="ai-check"><input v-model="form.pro_requires_auth" type="checkbox"> Pro models require login</label>
          <label class="ai-check"><input v-model="form.include_compliance_data" type="checkbox"> Feed live compliance demo data</label>
          <label class="ai-check"><input v-model="form.search_internet_enabled" type="checkbox"> Allow internet search</label>
          <label class="ai-check"><input v-model="form.search_internet_default" type="checkbox"> Search internet by default</label>
          <label>
            Default model<br>
            <select v-model="form.default_model">
              <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.label }}</option>
            </select>
          </label>
          <label>
            Extra system instructions<br>
            <textarea v-model="form.system_prompt_extra" rows="3" placeholder="Officer-specific guidance for the assistant…" />
          </label>
        </fieldset>

        <fieldset class="ai-fieldset">
          <legend>OpenAI / GPT</legend>
          <label>API key<br>
            <input v-model="form.providers.openai.api_key" type="password" :placeholder="configured.openai ? 'Configured — enter new key to replace' : 'sk-…'" autocomplete="off">
          </label>
          <label>Base URL<br><input v-model="form.providers.openai.base_url" type="url" placeholder="https://api.openai.com/v1"></label>
        </fieldset>

        <fieldset class="ai-fieldset">
          <legend>Google Gemini</legend>
          <label>API key<br>
            <input v-model="form.providers.gemini.api_key" type="password" :placeholder="configured.gemini ? 'Configured — enter new key to replace' : 'AIza…'" autocomplete="off">
          </label>
        </fieldset>

        <fieldset class="ai-fieldset">
          <legend>DeepSeek</legend>
          <label>API key<br>
            <input v-model="form.providers.deepseek.api_key" type="password" :placeholder="configured.deepseek ? 'Configured — enter new key to replace' : 'API key'" autocomplete="off">
          </label>
          <label>Base URL<br><input v-model="form.providers.deepseek.base_url" type="url"></label>
        </fieldset>

        <fieldset class="ai-fieldset">
          <legend>Custom (OpenAI-compatible / MCP gateway)</legend>
          <label>API key<br>
            <input v-model="form.providers.custom.api_key" type="password" :placeholder="configured.custom ? 'Configured — enter new key to replace' : 'API key'" autocomplete="off">
          </label>
          <label>Base URL<br><input v-model="form.providers.custom.base_url" type="url" placeholder="https://your-gateway/v1"></label>
          <label>Model name<br><input v-model="form.providers.custom.model" type="text" placeholder="model-id"></label>
        </fieldset>

        <fieldset class="ai-fieldset">
          <legend>Internet search</legend>
          <label>Serper API key (optional, better Google results)<br>
            <input v-model="form.web_search.serper_api_key" type="password" :placeholder="configured.serper ? 'Configured — enter new key to replace' : 'Optional'" autocomplete="off">
          </label>
          <label>Max results<br>
            <input v-model.number="form.web_search.max_results" type="number" min="1" max="10">
          </label>
          <p class="ai-hint">Without Serper, uses DuckDuckGo + official EU EUDR reference links.</p>
        </fieldset>
      </div>

      <div class="ai-actions">
        <button class="btn btn-primary" type="button" :disabled="saving" @click="saveConfig">
          {{ saving ? 'Saving…' : 'Save AI Configuration' }}
        </button>
        <button class="btn btn-secondary" type="button" @click="refreshPreview">Refresh compliance preview</button>
      </div>
      <p v-if="saveMsg" class="form-msg success">{{ saveMsg }}</p>
      <p v-if="saveError" class="form-msg error">{{ saveError }}</p>

      <details class="ai-preview">
        <summary>Compliance data preview (fed to AI when enabled)</summary>
        <pre>{{ preview || 'No data yet — run seed/migrate first.' }}</pre>
      </details>

      <div class="ai-test">
        <h4>Test assistant</h4>
        <div class="ai-test-options">
          <label class="ai-check"><input v-model="testCompliance" type="checkbox"> Include compliance data</label>
          <label class="ai-check"><input v-model="testSearch" type="checkbox"> Search internet</label>
        </div>
        <div class="ai-test-row">
          <input v-model="testInput" type="text" placeholder="e.g. Which districts have lowest EUDR compliance?" @keyup.enter="testAssistant">
          <button class="btn btn-primary" type="button" :disabled="testLoading" @click="testAssistant">Test</button>
        </div>
        <pre v-if="testReply" class="ai-test-reply">{{ testReply }}</pre>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ai-config-card { margin-top: 0; }
.ai-config-intro { font-size: 0.9rem; color: var(--muted); margin-bottom: 1.25rem; max-width: 720px; }
.ai-config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.ai-fieldset { border: 1px solid var(--border-light); border-radius: var(--radius); padding: 1rem; background: var(--bg); }
.ai-fieldset legend { font-weight: 700; font-size: 0.85rem; padding: 0 0.35rem; color: var(--green-dark); }
.ai-fieldset label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 0.75rem; }
.ai-fieldset input[type="text"], .ai-fieldset input[type="url"], .ai-fieldset input[type="password"], .ai-fieldset input[type="number"], .ai-fieldset select, .ai-fieldset textarea {
  width: 100%; margin-top: 0.25rem; padding: 0.45rem 0.6rem; border: 1px solid var(--border); border-radius: 8px; font-family: var(--font); font-size: 0.85rem;
}
.ai-check { display: flex !important; align-items: center; gap: 0.5rem; color: var(--text) !important; font-size: 0.875rem !important; }
.ai-check input { width: auto; margin: 0; }
.ai-hint { font-size: 0.75rem; color: var(--muted); margin-top: 0.5rem; }
.ai-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem; }
.ai-preview { margin-top: 1rem; }
.ai-preview pre { margin-top: 0.75rem; padding: 1rem; background: var(--bg); border-radius: 8px; font-size: 0.75rem; max-height: 240px; overflow: auto; white-space: pre-wrap; }
.ai-test { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border-light); }
.ai-test h4 { margin-bottom: 0.75rem; }
.ai-test-options { display: flex; gap: 1.25rem; margin-bottom: 0.75rem; }
.ai-test-row { display: flex; gap: 0.5rem; }
.ai-test-row input { flex: 1; padding: 0.55rem 0.75rem; border: 1px solid var(--border); border-radius: 8px; }
.ai-test-reply { margin-top: 0.75rem; padding: 1rem; background: var(--green-50); border-radius: 8px; font-size: 0.85rem; white-space: pre-wrap; }
.form-msg.success { color: var(--green-dark); font-size: 0.875rem; }
</style>

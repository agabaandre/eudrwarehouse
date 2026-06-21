<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { api, apiAuth } from '@/composables/api';

const enabled = ref(true);
const models = ref([]);
const selectedModel = ref('platform-guide');
const proRequiresAuth = ref(true);
const searchInternetEnabled = ref(false);
const searchInternetDefault = ref(false);
const includeComplianceData = ref(true);
const searchInternet = ref(false);
const messages = ref([
  {
    role: 'assistant',
    content: 'Hello! I am the MAAIF EUDR Compliance Assistant. Ask me about farmer registration, geospatial mapping, supply chain traceability, due diligence, or EU deforestation rules.',
  },
]);
const input = ref('');
const loading = ref(false);
const error = ref('');
const chatEl = ref(null);

const suggestions = [
  'What is EUDR and who does it affect?',
  'How do I register a coffee farm?',
  'What geolocation data is required for export?',
  'How does USSD *284# work?',
];

async function loadConfig() {
  try {
    const cfg = await api('/api/assistant/config');
    enabled.value = cfg.enabled !== false;
    models.value = cfg.models || [];
    proRequiresAuth.value = cfg.pro_requires_auth !== false;
    searchInternetEnabled.value = cfg.search_internet_enabled !== false;
    searchInternetDefault.value = !!cfg.search_internet_default;
    includeComplianceData.value = cfg.include_compliance_data !== false;
    searchInternet.value = searchInternetDefault.value;
    if (cfg.default_model && models.value.some((m) => m.id === cfg.default_model)) {
      selectedModel.value = cfg.default_model;
    } else if (models.value.length) {
      selectedModel.value = models.value.find((m) => !m.pro)?.id || models.value[0].id;
    }
  } catch {
    models.value = [{ id: 'platform-guide', label: 'Platform Guide (offline)', tier: 'standard', pro: false }];
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight;
  });
}

async function sendMessage(text) {
  const question = (text || input.value).trim();
  if (!question || loading.value) return;

  error.value = '';
  messages.value.push({ role: 'user', content: question });
  input.value = '';
  loading.value = true;
  scrollToBottom();

  const history = messages.value
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const body = {
      model: selectedModel.value,
      messages: history,
      include_compliance_data: includeComplianceData.value,
      search_internet: searchInternet.value,
    };
    const token = localStorage.getItem('eudr_token');
    const res = token
      ? await apiAuth('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      : await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Request failed');
        return data;
      });

    messages.value.push({ role: 'assistant', content: res.reply });
    if (res.sources?.length) {
      const srcText = res.sources.map((s) => (s.url ? `${s.title} (${s.url})` : s.title)).join('\n');
      messages.value.push({
        role: 'assistant',
        content: `Sources consulted:\n${srcText}`,
        meta: true,
      });
    }
    if (res.used_compliance_data) {
      messages.value.push({
        role: 'assistant',
        content: 'ℹ️ Answer used live MAAIF platform compliance demo data.',
        meta: true,
      });
    }
    if (res.note) {
      messages.value.push({ role: 'assistant', content: `ℹ️ ${res.note}`, meta: true });
    }
  } catch (e) {
    if (e.message?.includes('Pro models require')) {
      error.value = 'Pro models require officer login — sign in at /management';
    } else {
      error.value = e.message || 'Assistant unavailable';
    }
  } finally {
    loading.value = false;
    scrollToBottom();
  }
}

function onSubmit() {
  sendMessage();
}

onMounted(loadConfig);
</script>

<template>
  <section class="assistant-section" aria-labelledby="assistant-title">
    <div class="assistant-header">
      <div>
        <div class="assistant-badge">AI</div>
        <h2 id="assistant-title">EUDR Compliance Assistant</h2>
        <p class="assistant-subtitle">
          Instant answers on EU deforestation rules, registration, mapping, and export due diligence.
        </p>
      </div>
      <div v-if="models.length" class="assistant-controls">
        <label for="assistant-model">Model</label>
        <select id="assistant-model" v-model="selectedModel" :disabled="loading">
          <option v-for="m in models" :key="m.id" :value="m.id">
            {{ m.label }}{{ m.pro ? ' · Pro' : '' }}
          </option>
        </select>
        <p v-if="proRequiresAuth" class="assistant-pro-note">
          <span class="pro-pill">Pro</span> models unlock with officer login
        </p>
      </div>
    </div>

    <div v-if="!enabled" class="assistant-disabled">
      Assistant is temporarily disabled. Contact your MAAIF district officer for compliance guidance.
    </div>

    <template v-else>
      <div ref="chatEl" class="assistant-chat" role="log" aria-live="polite">
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="assistant-msg"
          :class="[msg.role, { meta: msg.meta }]"
        >
          <span v-if="msg.role === 'assistant' && !msg.meta" class="msg-avatar" aria-hidden="true">🛡️</span>
          <div class="msg-bubble">{{ msg.content }}</div>
        </div>
        <div v-if="loading" class="assistant-msg assistant">
          <span class="msg-avatar" aria-hidden="true">🛡️</span>
          <div class="msg-bubble typing">Thinking…</div>
        </div>
      </div>

      <div class="assistant-suggestions">
        <button
          v-for="s in suggestions"
          :key="s"
          type="button"
          class="suggestion-chip"
          :disabled="loading"
          @click="sendMessage(s)"
        >
          {{ s }}
        </button>
      </div>

      <form class="assistant-input-row" @submit.prevent="onSubmit">
        <label v-if="searchInternetEnabled" class="assistant-search-toggle">
          <input v-model="searchInternet" type="checkbox" :disabled="loading">
          Search internet sources (EU EUDR guidance + web)
        </label>
        <div class="assistant-input-fields">
        <input
          v-model="input"
          type="text"
          placeholder="Ask about EUDR compliance, registration, maps, exports…"
          :disabled="loading"
          maxlength="2000"
          aria-label="Your question"
        >
        <button type="submit" class="btn btn-primary" :disabled="loading || !input.trim()">
          Ask
        </button>
        </div>
      </form>

      <p v-if="error" class="form-msg error">{{ error }}</p>
      <p class="assistant-disclaimer">
        Guidance is informational only — not legal advice. Verify export requirements with MAAIF and EU buyers.
      </p>
    </template>
  </section>
</template>

<style scoped>
.assistant-section {
  margin: 2.5rem 0;
  padding: 1.75rem;
  border-radius: var(--radius-lg);
  background: var(--card);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
}

.assistant-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--gradient-tricolor);
}

.assistant-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}

.assistant-badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  background: linear-gradient(135deg, var(--ug-green), var(--ug-green-dark));
  color: var(--ug-yellow);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.assistant-section h2 {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.35rem;
}

.assistant-subtitle {
  color: var(--muted);
  font-size: 0.9rem;
  max-width: 520px;
}

.assistant-controls label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.assistant-controls select {
  min-width: 220px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: var(--font);
  font-size: 0.875rem;
  background: white;
}

.assistant-pro-note {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.pro-pill {
  background: var(--ug-yellow);
  color: var(--ug-green-dark);
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.assistant-chat {
  max-height: 360px;
  overflow-y: auto;
  padding: 1rem;
  background: var(--bg);
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
  margin-bottom: 1rem;
}

.assistant-msg {
  display: flex;
  gap: 0.65rem;
  margin-bottom: 0.85rem;
  align-items: flex-start;
}

.assistant-msg.user {
  flex-direction: row-reverse;
}

.msg-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--green-50);
  border-radius: 50%;
  font-size: 1rem;
}

.msg-bubble {
  max-width: 85%;
  padding: 0.65rem 0.9rem;
  border-radius: 12px;
  font-size: 0.9rem;
  line-height: 1.55;
  white-space: pre-wrap;
}

.assistant-msg.assistant .msg-bubble {
  background: white;
  border: 1px solid var(--border-light);
  color: var(--text);
}

.assistant-msg.user .msg-bubble {
  background: var(--ug-green);
  color: white;
}

.assistant-msg.meta .msg-bubble {
  background: var(--green-50);
  border: 1px dashed var(--border);
  font-size: 0.8rem;
  color: var(--muted);
}

.msg-bubble.typing {
  color: var(--muted);
  font-style: italic;
}

.assistant-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.suggestion-chip {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: white;
  font-size: 0.78rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition);
}

.suggestion-chip:hover:not(:disabled) {
  border-color: var(--ug-green);
  background: var(--green-50);
}

.suggestion-chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.assistant-input-row {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.assistant-search-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--muted);
  cursor: pointer;
}

.assistant-input-fields {
  display: flex;
  gap: 0.65rem;
}

.assistant-input-fields input {
  flex: 1;
  padding: 0.7rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-family: var(--font);
  font-size: 0.9rem;
}

.assistant-input-fields input:focus {
  outline: 2px solid rgba(15, 81, 50, 0.25);
  border-color: var(--ug-green);
}

.assistant-disclaimer {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: var(--muted);
}

.assistant-disabled {
  padding: 1.5rem;
  text-align: center;
  color: var(--muted);
  background: var(--bg);
  border-radius: var(--radius);
}

@media (max-width: 640px) {
  .assistant-input-fields {
    flex-direction: column;
  }
}
</style>

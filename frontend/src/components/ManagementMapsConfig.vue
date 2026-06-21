<script setup>
import { inject, onMounted, ref } from 'vue';
import { apiAuth } from '@/composables/api';
import { ensureManagementSession } from '@/composables/managementAuth';

const auth = inject('managementAuth', null);

const loading = ref(true);
const saving = ref(false);
const saveMsg = ref('');
const saveError = ref('');
const configured = ref(false);
const keySource = ref('none');
const availableLayers = ref([]);
const availableMetrics = ref([]);

const form = ref({
  google_maps_enabled: true,
  api_key: '',
  default_layer: 'districts',
  default_metric: 'compliance_rate',
  hidden_layer_ids: ['farm-clusters'],
  show_highcharts_district_panel: true,
});

function isAuthError(message) {
  return /expired|authentication|invalid or expired token|sign in/i.test(message || '');
}

function handleApiError(e) {
  if (isAuthError(e.message)) {
    auth?.handleAuthError?.(e.message);
  }
  return e.message;
}

function stripMaskedApiKey(payload) {
  const next = { ...payload };
  if (!next.api_key || next.api_key.includes('••••') || next.api_key.includes('****')) {
    delete next.api_key;
  }
  return next;
}

function toggleHiddenLayer(layerId) {
  const ids = form.value.hidden_layer_ids;
  if (ids.includes(layerId)) {
    form.value.hidden_layer_ids = ids.filter((id) => id !== layerId);
  } else {
    form.value.hidden_layer_ids = [...ids, layerId];
  }
}

async function loadConfig() {
  loading.value = true;
  saveError.value = '';
  try {
    await ensureManagementSession();
    const data = await apiAuth('/api/maps/admin/config');
    configured.value = !!data.api_key_configured;
    keySource.value = data.api_key_source || 'none';
    availableLayers.value = data.available_layers || [];
    availableMetrics.value = data.available_metrics || [];
    form.value = {
      google_maps_enabled: data.google_maps_enabled !== false,
      api_key: '',
      default_layer: data.default_layer || 'districts',
      default_metric: data.default_metric || 'compliance_rate',
      hidden_layer_ids: data.hidden_layer_ids || ['farm-clusters'],
      show_highcharts_district_panel: data.show_highcharts_district_panel !== false,
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
    const payload = stripMaskedApiKey(form.value);
    await apiAuth('/api/maps/admin/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    saveMsg.value = 'Map configuration saved.';
    await loadConfig();
  } catch (e) {
    saveError.value = handleApiError(e);
  } finally {
    saving.value = false;
  }
}

onMounted(loadConfig);
</script>

<template>
  <div class="card maps-config-card">
    <h3>Geospatial Maps</h3>
    <p class="maps-config-intro">
      Configure Google Maps for the public <a href="/maps" target="_blank" rel="noopener noreferrer">/maps</a> page.
      When no API key is set, the platform falls back to Highcharts choropleth maps.
    </p>

    <p v-if="loading" style="color:var(--muted)">Loading configuration…</p>

    <template v-else>
      <div class="maps-status">
        <span class="maps-badge" :class="configured && form.google_maps_enabled ? 'ok' : 'warn'">
          {{ configured && form.google_maps_enabled ? 'Google Maps active' : 'Highcharts fallback' }}
        </span>
        <span v-if="configured" class="maps-source">
          Key source: {{ keySource === 'environment' ? 'server .env' : 'database' }}
        </span>
      </div>

      <div class="maps-config-grid">
        <fieldset class="maps-fieldset">
          <legend>Google Maps</legend>
          <label class="maps-check">
            <input v-model="form.google_maps_enabled" type="checkbox">
            Enable Google Maps (requires API key)
          </label>
          <label>
            Maps JavaScript API key<br>
            <input
              v-model="form.api_key"
              type="password"
              :placeholder="configured ? 'Configured — enter new key to replace' : 'AIza…'"
              autocomplete="off"
            >
          </label>
          <p class="maps-hint">
            Enable <strong>Maps JavaScript API</strong> in Google Cloud Console. Restrict the key to your domain in production.
          </p>
        </fieldset>

        <fieldset class="maps-fieldset">
          <legend>Defaults</legend>
          <label>
            Default layer<br>
            <select v-model="form.default_layer">
              <option v-for="layer in availableLayers" :key="layer.id" :value="layer.id">
                {{ layer.name }}
              </option>
            </select>
          </label>
          <label>
            Default metric<br>
            <select v-model="form.default_metric">
              <option v-for="metric in availableMetrics" :key="metric.id" :value="metric.id">
                {{ metric.name }}
              </option>
            </select>
          </label>
          <label class="maps-check">
            <input v-model="form.show_highcharts_district_panel" type="checkbox">
            Show Highcharts district panel (when Google Maps is active)
          </label>
        </fieldset>

        <fieldset class="maps-fieldset maps-fieldset-wide">
          <legend>Visible map layers</legend>
          <p class="maps-hint">Unchecked layers are hidden from the public maps page tab bar.</p>
          <div class="maps-layer-list">
            <label
              v-for="layer in availableLayers"
              :key="layer.id"
              class="maps-check maps-layer-item"
            >
              <input
                type="checkbox"
                :checked="!form.hidden_layer_ids.includes(layer.id)"
                @change="toggleHiddenLayer(layer.id)"
              >
              {{ layer.name }} <code>{{ layer.id }}</code>
            </label>
          </div>
        </fieldset>
      </div>

      <div class="maps-actions">
        <button class="btn btn-primary" type="button" :disabled="saving" @click="saveConfig">
          {{ saving ? 'Saving…' : 'Save Map Configuration' }}
        </button>
        <a class="btn btn-secondary" href="/maps" target="_blank" rel="noopener noreferrer">Preview maps page</a>
      </div>
      <p v-if="saveMsg" class="form-msg success">{{ saveMsg }}</p>
      <p v-if="saveError" class="form-msg error">{{ saveError }}</p>
    </template>
  </div>
</template>

<style scoped>
.maps-config-card { margin-top: 0; }
.maps-config-intro { font-size: 0.9rem; color: var(--muted); margin-bottom: 1rem; max-width: 720px; }
.maps-status { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.maps-badge {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
}
.maps-badge.ok { background: var(--green-50); color: var(--green-dark); }
.maps-badge.warn { background: #fef3c7; color: #92400e; }
.maps-source { font-size: 0.85rem; color: var(--muted); }
.maps-config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.maps-fieldset { border: 1px solid var(--border-light); border-radius: var(--radius); padding: 1rem; background: var(--bg); }
.maps-fieldset-wide { grid-column: 1 / -1; }
.maps-fieldset legend { font-weight: 700; font-size: 0.85rem; padding: 0 0.35rem; color: var(--green-dark); }
.maps-fieldset label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 0.75rem; }
.maps-fieldset input[type="password"], .maps-fieldset select {
  width: 100%; margin-top: 0.25rem; padding: 0.45rem 0.6rem; border: 1px solid var(--border); border-radius: 8px; font-family: var(--font); font-size: 0.85rem;
}
.maps-check { display: flex !important; align-items: center; gap: 0.5rem; color: var(--text) !important; font-size: 0.875rem !important; }
.maps-check input { width: auto; margin: 0; }
.maps-hint { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; }
.maps-layer-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.5rem; margin-top: 0.5rem; }
.maps-layer-item code { font-size: 0.75rem; color: var(--muted); margin-left: 0.25rem; }
.maps-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem; }
.form-msg.success { color: var(--green-dark); font-size: 0.875rem; }
</style>

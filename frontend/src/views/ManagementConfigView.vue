<script setup>
import { inject, onMounted, ref } from 'vue';
import ManagementAiConfig from '@/components/ManagementAiConfig.vue';
import { api, apiAuth } from '@/composables/api';

const auth = inject('managementAuth', null);

const activeTab = ref('ai');
const warehouseStatus = ref('Loading...');
const warehouseSyncStatus = ref('');
const ingestStatus = ref('');
const ingestFile = ref(null);
const superset = ref({});
const platform = ref({});

const tabs = [
  { id: 'ai', label: 'AI Assistant' },
  { id: 'warehouse', label: 'Data Warehouse' },
  { id: 'ingestion', label: 'Data Ingestion' },
  { id: 'platform', label: 'Platform & Maps' },
];

async function loadMeta() {
  try {
    const [whStatus, cfg] = await Promise.all([
      api('/api/warehouse/status'),
      api('/api/auth/config'),
    ]);
    warehouseStatus.value = `Doris: ${whStatus.apache_doris} · Tables: ${(whStatus.tables || []).length} · ${whStatus.architecture}`;
    superset.value = cfg.superset || {};
    platform.value = {
      public_base_url: cfg.public_base_url,
      google_maps: cfg.google_maps || {},
      warehouse: cfg.warehouse || {},
    };
  } catch {
    warehouseStatus.value = 'Warehouse unavailable (start full stack with ENABLE_WAREHOUSE=true)';
  }
}

async function syncWarehouse() {
  warehouseSyncStatus.value = 'Syncing...';
  try {
    await auth?.ensureSession?.();
    const data = await apiAuth('/api/warehouse/sync', { method: 'POST' });
    warehouseSyncStatus.value = data.message;
  } catch (e) {
    warehouseSyncStatus.value = `Error: ${e.message}`;
    if (e.message?.includes('expired') || e.message?.includes('Authentication') || e.message?.includes('Invalid')) {
      auth?.handleAuthError?.(e.message);
    }
  }
}

async function ingestData() {
  if (!ingestFile.value) return;
  const ext = ingestFile.value.name.split('.').pop().toLowerCase();
  const endpoint = ext === 'csv' ? '/api/ingestion/csv' : '/api/ingestion/excel';
  const form = new FormData();
  form.append('file', ingestFile.value);
  try {
    await auth?.ensureSession?.();
    const data = await apiAuth(endpoint, { method: 'POST', body: form });
    ingestStatus.value = `Imported ${data.records_imported} records`;
  } catch (e) {
    ingestStatus.value = `Error: ${e.message}`;
    if (e.message?.includes('expired') || e.message?.includes('Authentication') || e.message?.includes('Invalid')) {
      auth?.handleAuthError?.(e.message);
    }
  }
}

function onFileChange(e) {
  ingestFile.value = e.target.files[0];
}

onMounted(loadMeta);
</script>

<template>
  <div class="container">
    <div class="mgmt-page-intro">
      <h2>Administration &amp; Configuration</h2>
      <p>Manage AI providers, warehouse sync, data ingestion, and platform integration settings.</p>
    </div>

    <div class="config-tabs" role="tablist" aria-label="Configuration sections">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="config-tab"
        :class="{ active: activeTab === tab.id }"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-show="activeTab === 'ai'" role="tabpanel">
      <ManagementAiConfig />
    </div>

    <div v-show="activeTab === 'warehouse'" class="card config-panel" role="tabpanel">
      <h3>Data Warehouse &amp; Superset</h3>
      <p class="config-lead">{{ warehouseStatus }}</p>
      <template v-if="superset.enabled && superset.url">
        <a :href="superset.url" class="btn btn-primary" target="_blank" rel="noopener noreferrer">Open Apache Superset</a>
        <p class="config-note">
          URL: <a :href="superset.url" target="_blank" rel="noopener noreferrer">{{ superset.url }}</a>
        </p>
      </template>
      <p v-else class="form-msg config-note">
        {{ superset.note || 'Enable warehouse: ENABLE_WAREHOUSE=true ./scripts/deploy.sh then sudo ./scripts/setup-nginx.sh' }}
      </p>
      <button class="btn btn-secondary" type="button" @click="syncWarehouse">Sync PostgreSQL to Doris</button>
      <p class="config-note">{{ warehouseSyncStatus }}</p>
      <p v-if="superset.admin_user && superset.enabled" class="config-note">
        Superset login: {{ superset.admin_user }} / {{ superset.admin_password }}
      </p>
    </div>

    <div v-show="activeTab === 'ingestion'" class="card config-panel" role="tabpanel">
      <h3>Data Ingestion</h3>
      <p class="config-lead">Upload CSV or Excel farmer and plot records into the operational database.</p>
      <input type="file" accept=".csv,.xlsx,.xls" @change="onFileChange">
      <button class="btn btn-primary" type="button" style="margin-top:0.75rem" @click="ingestData">Import Data</button>
      <p class="config-note">{{ ingestStatus }}</p>
    </div>

    <div v-show="activeTab === 'platform'" class="card config-panel" role="tabpanel">
      <h3>Platform &amp; Maps</h3>
      <dl class="config-dl">
        <dt>Public base URL</dt>
        <dd>{{ platform.public_base_url || 'Not set (PUBLIC_BASE_URL)' }}</dd>
        <dt>Google Maps</dt>
        <dd>{{ platform.google_maps?.enabled ? 'Configured via GOOGLE_MAPS_API_KEY' : 'Not configured — maps page uses Highcharts fallback' }}</dd>
        <dt>Warehouse engine</dt>
        <dd>{{ platform.warehouse?.engine || 'Apache Doris' }}</dd>
        <dt>BI tool</dt>
        <dd>{{ platform.warehouse?.bi_tool || 'Apache Superset' }}</dd>
        <dt>Warehouse sync interval</dt>
        <dd>{{ platform.warehouse?.sync_interval_ms ? `${Math.round(platform.warehouse.sync_interval_ms / 60000)} minutes` : '5 minutes' }}</dd>
      </dl>
      <p class="config-note">Environment variables for production are set in <code>.env</code> on the server. Use the AI Assistant tab to store provider API keys in the database.</p>
    </div>
  </div>
</template>

<style scoped>
.mgmt-page-intro { margin-bottom: 1.25rem; }
.mgmt-page-intro h2 { margin-bottom: 0.35rem; }
.mgmt-page-intro p { color: var(--muted); font-size: 0.95rem; }
.config-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-light);
}
.config-tab {
  padding: 0.55rem 1rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}
.config-tab.active {
  background: var(--green-dark);
  color: white;
  border-color: var(--green-dark);
}
.config-panel { margin-top: 0; }
.config-lead { font-size: 0.9rem; color: var(--muted); margin-bottom: 0.85rem; }
.config-note { margin-top: 0.75rem; font-size: 0.85rem; color: var(--muted); }
.config-dl {
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr;
  gap: 0.65rem 1rem;
  font-size: 0.9rem;
}
.config-dl dt { font-weight: 600; color: var(--text-secondary); }
.config-dl dd { margin: 0; color: var(--text); }
</style>

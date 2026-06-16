<script setup>
import { onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import { api, formatNumber, statusBadgeClass } from '@/composables/api';

const activePanel = ref('supply-chain');
const panels = [
  { id: 'supply-chain', label: 'Supply Chain' },
  { id: 'register-farmer', label: 'Register Farmer' },
  { id: 'register-exporter', label: 'Register Exporter' },
  { id: 'training', label: 'Training & Videos' },
  { id: 'channels', label: 'Mobile & USSD' },
  { id: 'alerts', label: 'SMS Alerts' },
];

const summary = ref({ total_links: 0, linked_farmers: 0, linked_exporters: 0, verified_batches: 0 });
const network = ref([]);
const links = ref([]);
const districts = ref([]);
const trainingModules = ref([]);
const channelRegs = ref([]);
const alerts = ref([]);
const ussdInfo = ref('');
const ussdInput = ref('');
const ussdResult = ref('');

const farmerMsg = ref({ text: '', type: '' });
const exporterMsg = ref({ text: '', type: '' });
const smsMsg = ref({ text: '', type: '' });

const farmerForm = ref({
  name: '', phone: '', gender: 'male', age_group: '36-45',
  district_name: '', sub_county: '', commodity: 'coffee', channel: 'web',
});
const exporterForm = ref({
  name: '', license_number: '', contact_person: '', email: '', phone: '',
  district_name: '', commodities: 'coffee', primary_destination: '', channel: 'web',
});
const smsForm = ref({
  recipient_phone: '', recipient_type: 'farmer', alert_type: 'compliance', message: '',
});

function verifiedBadge(v) {
  return v ? 'badge-green' : 'badge-yellow';
}

function verifiedLabel(v) {
  return v ? 'Verified' : 'Pending';
}

async function loadSummary() {
  summary.value = await api('/api/supply-chain/summary');
}

async function loadSupplyChain() {
  const [net, linkData] = await Promise.all([
    api('/api/supply-chain/network'),
    api('/api/supply-chain/links'),
  ]);
  network.value = net.exporters || [];
  links.value = linkData.data || [];
}

async function loadDistricts() {
  districts.value = await api('/api/registration/districts');
}

async function loadTraining() {
  const { data } = await api('/api/training/modules');
  trainingModules.value = data;
}

async function loadChannels() {
  const info = await api('/api/channels/info');
  ussdInfo.value = `Dial ${info.ussd_code}\n\n` + info.ussd_flow.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const { data } = await api('/api/channels/registrations');
  channelRegs.value = data;
}

async function loadAlerts() {
  const { data } = await api('/api/alerts?limit=20');
  alerts.value = data;
}

async function submitFarmer() {
  farmerMsg.value = { text: '', type: '' };
  try {
    const body = { ...farmerForm.value, registered_via: farmerForm.value.channel };
    const res = await fetch('/api/registration/farmer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    farmerMsg.value = { text: `Registered! Farmer code: ${data.farmer.farmer_code}. SMS confirmation sent.`, type: 'success' };
    farmerForm.value = { name: '', phone: '', gender: 'male', age_group: '36-45', district_name: '', sub_county: '', commodity: 'coffee', channel: 'web' };
    loadSummary();
    loadSupplyChain();
  } catch (e) {
    farmerMsg.value = { text: e.message, type: 'error' };
  }
}

async function submitExporter() {
  exporterMsg.value = { text: '', type: '' };
  try {
    const body = { ...exporterForm.value, registered_via: exporterForm.value.channel };
    const res = await fetch('/api/registration/exporter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    exporterMsg.value = { text: `Submitted! Exporter code: ${data.exporter.exporter_code} (pending verification).`, type: 'success' };
    exporterForm.value = { name: '', license_number: '', contact_person: '', email: '', phone: '', district_name: '', commodities: 'coffee', primary_destination: '', channel: 'web' };
  } catch (e) {
    exporterMsg.value = { text: e.message, type: 'error' };
  }
}

async function submitSms() {
  smsMsg.value = { text: '', type: '' };
  try {
    const res = await fetch('/api/alerts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(smsForm.value),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    smsMsg.value = { text: 'SMS sent successfully.', type: 'success' };
    smsForm.value = { recipient_phone: '', recipient_type: 'farmer', alert_type: 'compliance', message: '' };
    loadAlerts();
  } catch (e) {
    smsMsg.value = { text: e.message, type: 'error' };
  }
}

async function testUssd() {
  const res = await fetch('/api/channels/ussd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: 'demo', phone: '+256700000000', text: ussdInput.value }),
  });
  ussdResult.value = await res.text();
}

async function enrollModule(id) {
  await fetch('/api/training/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module_id: id, farmer_id: 1 }),
  });
  alert('Enrolled successfully!');
}

onMounted(() => {
  loadSummary();
  loadSupplyChain();
  loadDistricts();
  loadTraining();
  loadChannels();
  loadAlerts();
});
</script>

<template>
  <AppHeader
    title="MAAIF EUDR Registration Hub"
    subtitle="Farmers · Exporters · Supply Chain · Training · Mobile & USSD"
  />

  <div class="container">
    <div class="page-intro">
      <h2>Register &amp; Connect Your Supply Chain</h2>
      <p>Onboard farmers and exporters, link batches for EU due diligence, access training, and reach field users via USSD *284#.</p>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><div class="value">{{ summary.total_links }}</div><div class="label">Supply Chain Links</div></div>
      <div class="kpi"><div class="value">{{ summary.linked_farmers }}</div><div class="label">Linked Farmers</div></div>
      <div class="kpi"><div class="value">{{ summary.linked_exporters }}</div><div class="label">Linked Exporters</div></div>
      <div class="kpi"><div class="value">{{ summary.verified_batches }}</div><div class="label">Verified Batches</div></div>
    </div>

    <nav class="reg-nav">
      <button
        v-for="p in panels"
        :key="p.id"
        type="button"
        :class="{ active: activePanel === p.id }"
        @click="activePanel = p.id"
      >
        {{ p.label }}
      </button>
    </nav>

    <!-- Supply Chain -->
    <section v-show="activePanel === 'supply-chain'" class="reg-panel active">
      <div class="card" style="margin-bottom:1.5rem">
        <h3>Farmer ↔ Exporter Traceability</h3>
        <p>End-to-end linkage from registered farmers through compliance verification to export batches.</p>
      </div>
      <div class="chain-flow">
        <div v-for="exp in network" :key="exp.exporter_id" class="chain-node">
          <h4>🏭 {{ exp.exporter_name }}</h4>
          <div style="font-size:0.8rem;color:var(--muted);margin-bottom:0.5rem">
            {{ exp.exporter_code }} → {{ exp.destination || 'EU' }} · {{ formatNumber(exp.total_volume_kg) }} kg total
          </div>
          <div v-for="f in exp.farmers" :key="f.farmer_code" class="chain-farmer">
            <span>🌱 <strong>{{ f.farmer_name }}</strong> ({{ f.farmer_code }})</span>
            <span style="margin-left:auto">{{ f.volume_kg }}kg</span>
            <span :class="['badge', verifiedBadge(f.compliance_verified)]">{{ verifiedLabel(f.compliance_verified) }}</span>
          </div>
        </div>
        <p v-if="!network.length" style="color:var(--muted)">No supply chain links yet.</p>
      </div>
      <div class="card">
        <h3>All Supply Chain Links</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Farmer</th><th>District</th><th>Exporter</th><th>Destination</th>
                <th>Commodity</th><th>Volume (kg)</th><th>Batch</th><th>Compliance</th><th>Verified</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in links" :key="r.id">
                <td><strong>{{ r.farmer_name }}</strong><br><small>{{ r.farmer_code }}</small></td>
                <td>{{ r.district_name || '—' }}</td>
                <td><strong>{{ r.exporter_name }}</strong><br><small>{{ r.exporter_code }}</small></td>
                <td>{{ r.primary_destination || '—' }}</td>
                <td>{{ r.commodity }}</td>
                <td>{{ formatNumber(r.volume_kg) }}</td>
                <td><code>{{ r.batch_code }}</code></td>
                <td><span :class="['badge', statusBadgeClass(r.compliance_status)]">{{ (r.compliance_status || 'pending').replace('_', ' ') }}</span></td>
                <td><span :class="['badge', verifiedBadge(r.compliance_verified)]">{{ verifiedLabel(r.compliance_verified) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Register Farmer -->
    <section v-show="activePanel === 'register-farmer'" class="reg-panel">
      <div class="card">
        <h3>Farmer Registration</h3>
        <div v-if="farmerMsg.text" :class="['form-msg', farmerMsg.type]">{{ farmerMsg.text }}</div>
        <form @submit.prevent="submitFarmer">
          <div class="form-grid">
            <div class="form-group"><label>Full Name *</label><input v-model="farmerForm.name" required></div>
            <div class="form-group"><label>Phone *</label><input v-model="farmerForm.phone" type="tel" required></div>
            <div class="form-group"><label>Gender</label>
              <select v-model="farmerForm.gender"><option value="male">Male</option><option value="female">Female</option></select>
            </div>
            <div class="form-group"><label>Age Group</label>
              <select v-model="farmerForm.age_group"><option>18-25</option><option>26-35</option><option>36-45</option><option>46+</option></select>
            </div>
            <div class="form-group"><label>District *</label>
              <select v-model="farmerForm.district_name" required>
                <option value="">Select district</option>
                <option v-for="d in districts" :key="d.id" :value="d.name">{{ d.name }} ({{ d.region }})</option>
              </select>
            </div>
            <div class="form-group"><label>Sub County</label><input v-model="farmerForm.sub_county"></div>
            <div class="form-group"><label>Commodity</label>
              <select v-model="farmerForm.commodity"><option value="coffee">Coffee</option><option value="cocoa">Cocoa</option></select>
            </div>
            <div class="form-group"><label>Channel</label>
              <select v-model="farmerForm.channel"><option value="web">Web</option><option value="mobile">Mobile</option><option value="ussd">USSD *284#</option></select>
            </div>
          </div>
          <button type="submit" class="btn btn-primary">Register Farmer</button>
        </form>
      </div>
    </section>

    <!-- Register Exporter -->
    <section v-show="activePanel === 'register-exporter'" class="reg-panel">
      <div class="card">
        <h3>Exporter / Supplier Registration</h3>
        <div v-if="exporterMsg.text" :class="['form-msg', exporterMsg.type]">{{ exporterMsg.text }}</div>
        <form @submit.prevent="submitExporter">
          <div class="form-grid">
            <div class="form-group"><label>Company Name *</label><input v-model="exporterForm.name" required></div>
            <div class="form-group"><label>License Number *</label><input v-model="exporterForm.license_number" required></div>
            <div class="form-group"><label>Contact Person</label><input v-model="exporterForm.contact_person"></div>
            <div class="form-group"><label>Email</label><input v-model="exporterForm.email" type="email"></div>
            <div class="form-group"><label>Phone *</label><input v-model="exporterForm.phone" type="tel" required></div>
            <div class="form-group"><label>District</label>
              <select v-model="exporterForm.district_name">
                <option value="">Select district</option>
                <option v-for="d in districts" :key="d.id" :value="d.name">{{ d.name }}</option>
              </select>
            </div>
            <div class="form-group"><label>Commodities</label><input v-model="exporterForm.commodities"></div>
            <div class="form-group"><label>Primary Destination</label><input v-model="exporterForm.primary_destination"></div>
          </div>
          <button type="submit" class="btn btn-primary">Register Exporter</button>
        </form>
      </div>
    </section>

    <!-- Training -->
    <section v-show="activePanel === 'training'" class="reg-panel">
      <div class="training-grid">
        <div v-for="m in trainingModules" :key="m.id" class="training-card">
          <div class="video-wrap">
            <iframe :src="m.video_url" :title="m.title" allowfullscreen loading="lazy" />
          </div>
          <div class="training-body">
            <h4>{{ m.title }}</h4>
            <div class="meta">{{ m.category }} · {{ m.duration_minutes }} min · {{ m.skill_level }}</div>
            <p style="font-size:0.85rem;color:var(--muted)">{{ m.description }}</p>
            <button type="button" class="btn btn-secondary" style="margin-top:0.5rem;font-size:0.85rem" @click="enrollModule(m.id)">Enroll</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Channels -->
    <section v-show="activePanel === 'channels'" class="reg-panel">
      <div class="channel-box">
        <h4>📱 Mobile App Integration</h4>
        <p>Field officers use the <strong>MAAIF EUDR Field App</strong> to register farms and capture GPS coordinates.</p>
      </div>
      <div class="channel-box">
        <h4>📞 USSD — Dial <code>*284#</code></h4>
        <pre class="ussd-demo">{{ ussdInfo }}</pre>
        <div style="margin-top:1rem">
          <input v-model="ussdInput" placeholder="2*F-001" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:8px">
          <button type="button" class="btn btn-secondary" style="margin-top:0.5rem" @click="testUssd">Test USSD</button>
          <pre v-if="ussdResult" class="ussd-demo" style="margin-top:0.5rem">{{ ussdResult }}</pre>
        </div>
      </div>
      <div class="card">
        <h3>Channel Registrations</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Entity</th><th>Code</th><th>Channel</th><th>Phone</th><th>Verified</th></tr></thead>
            <tbody>
              <tr v-for="r in channelRegs" :key="r.id">
                <td>{{ r.entity_type }}</td>
                <td>{{ r.entity_code || r.entity_name }}</td>
                <td><span class="badge badge-green">{{ r.channel }}</span></td>
                <td>{{ r.phone }}</td>
                <td>{{ r.verified ? '✓' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- SMS Alerts -->
    <section v-show="activePanel === 'alerts'" class="reg-panel">
      <div class="card" style="margin-bottom:1rem">
        <h3>Send SMS Alert</h3>
        <div v-if="smsMsg.text" :class="['form-msg', smsMsg.type]">{{ smsMsg.text }}</div>
        <form @submit.prevent="submitSms">
          <div class="form-grid">
            <div class="form-group"><label>Phone *</label><input v-model="smsForm.recipient_phone" required></div>
            <div class="form-group"><label>Type</label>
              <select v-model="smsForm.recipient_type"><option value="farmer">Farmer</option><option value="exporter">Exporter</option></select>
            </div>
            <div class="form-group"><label>Alert Type</label>
              <select v-model="smsForm.alert_type"><option value="compliance">Compliance</option><option value="training">Training</option><option value="export">Export</option></select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:1rem"><label>Message *</label><textarea v-model="smsForm.message" required /></div>
          <button type="submit" class="btn btn-primary">Send SMS</button>
        </form>
      </div>
      <div class="card">
        <h3>Recent SMS Alerts</h3>
        <div v-for="a in alerts" :key="a.id" class="sms-item">
          <strong>{{ a.recipient_phone }}</strong>
          <span class="badge badge-green" style="margin-left:0.5rem">{{ a.alert_type }}</span>
          <div>{{ a.message }}</div>
          <div class="sms-meta">{{ a.recipient_type }} · {{ a.status }} · {{ new Date(a.created_at).toLocaleString() }}</div>
        </div>
        <p v-if="!alerts.length" style="color:var(--muted)">No alerts yet.</p>
      </div>
    </section>
  </div>

  <AppFooter text="MAAIF EUDR Platform — Registration & Supply Chain Traceability" />
</template>

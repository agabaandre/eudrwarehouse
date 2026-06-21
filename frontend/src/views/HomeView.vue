<script setup>
import { onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import GovBrandMark from '@/components/GovBrandMark.vue';
import ComplianceAssistant from '@/components/ComplianceAssistant.vue';
import { api, formatNumber } from '@/composables/api';

const showGuide = ref(false);
const showSuperset = ref(false);
const superset = ref({});
const stats = ref([
  { value: '—', label: 'Registered Farmers' },
  { value: '—', label: 'Farm Plots Mapped' },
  { value: '—', label: 'Districts Covered' },
  { value: '85%', label: 'EUDR Compliance Rate' },
]);

const features = [
  {
    icon: '📋',
    title: 'Farmer & Exporter Registration',
    description: 'Multi-channel onboarding via web, mobile app, or USSD *284#. SMS confirmations and digital compliance records.',
    link: '/registration',
    linkText: 'Open Registration Hub',
    featured: true,
  },
  {
    icon: '🔗',
    title: 'Supply Chain Traceability',
    description: 'End-to-end farmer-to-exporter linkage with batch codes, volume tracking, and EU due diligence documentation.',
    link: '/registration',
    linkText: 'View Supply Chain',
  },
  {
    icon: '🎓',
    title: 'Training & Capacity Building',
    description: 'Video modules for EUDR compliance, geospatial mapping, sustainable harvesting, and exporter certification.',
    link: '/registration',
    linkText: 'Training Center',
  },
  {
    icon: '📱',
    title: 'SMS Alerts & Notifications',
    description: 'Automated compliance reminders, export window alerts, and training notifications to farmers and suppliers.',
    link: '/registration',
    linkText: 'SMS Alerts',
  },
  {
    icon: '📊',
    title: 'Public Analytics Dashboard',
    description: 'Production trends, district compliance rankings, exporter performance, risk analysis — no login required.',
    link: '/analytics',
    linkText: 'Open Analytics',
  },
  {
    icon: '🗺️',
    title: 'Geospatial Intelligence',
    description: 'Five interactive map layers: districts, regions, coffee belt, deforestation risk zones, and farm clusters.',
    link: '/maps',
    linkText: 'Map Gallery',
  },
  {
    icon: '🛡️',
    title: 'Strategic Command Center',
    description: 'Leadership KPIs, warehouse sync, data ingestion, and priority alerts for MAAIF officers and policymakers.',
    link: '/management',
    linkText: 'Officer Login',
  },
  {
    icon: '🌍',
    title: 'Multilingual Access',
    description: 'Platform available in English, Luganda, Swahili, Runyankole, Ateso, Acholi, and Lusoga for nationwide reach.',
    link: '/registration',
    linkText: 'Get Started',
  },
];

onMounted(async () => {
  try {
    const [cfg, kpis] = await Promise.all([
      api('/api/auth/config'),
      api('/api/analytics/kpis'),
    ]);
    showGuide.value = cfg.public_user_guide_enabled;
    superset.value = cfg.superset || {};
    showSuperset.value = !!(superset.value.url && superset.value.public_enabled && superset.value.enabled !== false);
    stats.value = [
      { value: formatNumber(kpis.total_farmers), label: 'Registered Farmers' },
      { value: formatNumber(kpis.total_farm_plots), label: 'Farm Plots Mapped' },
      { value: '10+', label: 'Districts Covered' },
      { value: '85%', label: 'EUDR Compliance Rate' },
    ];
  } catch {
    /* config optional */
  }
});
</script>

<template>
  <AppHeader
    title="EUDR Compliance Platform"
    subtitle="EU Deforestation Regulation — National Traceability System"
  >
    <template #nav>
      <a v-if="showSuperset" :href="superset.url" target="_blank" rel="noopener noreferrer">Superset BI</a>
    </template>
  </AppHeader>

  <main class="container">
    <section class="hero-landing" aria-labelledby="hero-title">
      <div class="hero-layout">
        <div class="hero-content">
          <div class="hero-badge">
            <span aria-hidden="true">🇺🇬</span>
            Republic of Uganda · National EUDR Platform
          </div>
          <h2 id="hero-title">Trace every farm. Prove every export. Protect Uganda's forests.</h2>
          <p class="hero-lead">
            The MAAIF platform unifies farmer registration, supply chain traceability, geospatial risk analysis,
            and real-time compliance analytics — built for EU Deforestation Regulation readiness at national scale.
          </p>
          <div class="hero-actions">
            <router-link to="/registration" class="btn btn-primary">Start Registration</router-link>
            <router-link to="/analytics" class="btn btn-secondary">View Analytics</router-link>
            <router-link to="/maps" class="btn btn-secondary">Explore Maps</router-link>
          </div>
        </div>

        <div class="hero-crest-panel" aria-label="Government of Uganda">
          <GovBrandMark
            size="lg"
            layout="stacked"
            platform-title="EUDR Compliance Platform"
            show-motto
          />
        </div>
      </div>
    </section>

    <section class="stats-strip" aria-label="Platform statistics">
      <div v-for="s in stats" :key="s.label" class="stat-card">
        <div class="stat-value">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </section>

    <section aria-labelledby="features-title">
      <h2 id="features-title" class="section-title">Everything you need for EUDR compliance</h2>
      <p class="section-subtitle">
        From smallholder registration to export due diligence — one integrated platform for farmers, exporters, and government.
      </p>

      <div class="cards">
        <article
          v-for="f in features"
          :key="f.title"
          class="card"
          :class="{ featured: f.featured }"
        >
          <div class="card-icon" aria-hidden="true">{{ f.icon }}</div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.description }}</p>
          <router-link :to="f.link" class="card-link">
            {{ f.linkText }} →
          </router-link>
        </article>

        <article v-if="showSuperset" class="card">
          <div class="card-icon" aria-hidden="true">📈</div>
          <h3>Apache Superset BI</h3>
          <p>Self-service dashboards and SQL Lab for compliance reporting and export analytics.</p>
          <a :href="superset.url" class="card-link" target="_blank" rel="noopener noreferrer">
            Open Superset →
          </a>
        </article>
      </div>
    </section>

    <div class="trust-bar" role="list" aria-label="Platform capabilities">
      <div class="trust-item" role="listitem"><span class="trust-dot" /> EUDR-ready traceability</div>
      <div class="trust-item" role="listitem"><span class="trust-dot" /> AI compliance assistant</div>
      <div class="trust-item" role="listitem"><span class="trust-dot" /> USSD *284# field access</div>
      <div class="trust-item" role="listitem"><span class="trust-dot" /> 7 local languages</div>
    </div>

    <ComplianceAssistant />

    <section class="cta-band" aria-labelledby="cta-title">
      <h3 id="cta-title">Ready to demonstrate EUDR compliance?</h3>
      <p>Register farmers, map farm plots, and generate export-ready due diligence reports today.</p>
      <router-link to="/registration" class="btn btn-primary">Get Started Free</router-link>
    </section>

    <div v-if="showGuide" class="user-guide">
      <h4>Quick Start Guide</h4>
      <p><strong>Registration Hub:</strong> <router-link to="/registration">/registration</router-link> — farmers, exporters, supply chain, training, USSD, SMS</p>
      <p><strong>Public Analytics:</strong> <router-link to="/analytics">/analytics</router-link></p>
      <p><strong>Geospatial Maps:</strong> <router-link to="/maps">/maps</router-link></p>
      <p><strong>USSD:</strong> Dial <code>*284#</code> to register or check compliance</p>
      <p v-if="superset.url"><strong>Superset BI:</strong> <a :href="superset.url" target="_blank" rel="noopener noreferrer">{{ superset.url }}</a></p>
    </div>
  </main>

  <AppFooter />
</template>

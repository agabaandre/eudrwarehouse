<script setup>
import GovBrandMark from '@/components/GovBrandMark.vue';

defineProps({
  text: { type: String, default: '' },
});
</script>

<template>
  <footer class="footer">
    <div class="gov-tricolor" aria-hidden="true" />

    <div class="footer-inner">
      <div class="footer-brand">
        <GovBrandMark
          size="md"
          layout="stacked"
          :show-republic="false"
          platform-title="EUDR Compliance Platform"
          show-motto
        />
        <p class="footer-desc">
          National platform for EU Deforestation Regulation compliance, farm traceability,
          and export due diligence — serving farmers, exporters, and policymakers across Uganda.
        </p>
      </div>
      <div class="footer-col">
        <h4>Platform</h4>
        <router-link to="/registration">Registration Hub</router-link>
        <router-link to="/analytics">Public Analytics</router-link>
        <router-link to="/maps">Geospatial Maps</router-link>
      </div>
      <div class="footer-col">
        <h4>Channels</h4>
        <router-link to="/registration">Mobile App API</router-link>
        <router-link to="/registration">USSD *284#</router-link>
        <a href="/api/mobile" target="_blank" rel="noopener noreferrer">REST API Docs</a>
      </div>
      <div class="footer-col">
        <h4>Resources</h4>
        <a href="/api/health" target="_blank" rel="noopener noreferrer">System Health</a>
        <router-link to="/analytics">Compliance Reports</router-link>
      </div>
    </div>
    <div class="footer-bottom">
      <slot>
        {{ text || '© Ministry of Agriculture, Animal Industry and Fisheries (MAAIF) — Republic of Uganda' }}
      </slot>
      <span class="footer-attr">
        Coat of arms via
        <a href="https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Uganda.svg" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
      </span>
    </div>
  </footer>
</template>

<style scoped>
.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.footer-brand :deep(.gov-ministry) {
  color: #fff;
}

.footer-brand :deep(.gov-platform) {
  color: rgba(255, 255, 255, 0.9);
}

.footer-desc {
  font-size: 0.875rem;
  line-height: 1.7;
  max-width: 360px;
  color: rgba(255, 255, 255, 0.7);
}

.footer-attr {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
}

.footer-attr a {
  color: rgba(252, 220, 4, 0.7);
}
</style>

<script setup>
defineProps({
  text: { type: String, default: '' },
});
</script>

<template>
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <h3>MAAIF EUDR Platform</h3>
        <p>
          National demonstration platform for EU Deforestation Regulation compliance,
          farm traceability, and export due diligence — Ministry of Agriculture, Animal Industry and Fisheries, Uganda.
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
      <slot>{{ text || '© Ministry of Agriculture, Animal Industry and Fisheries (MAAIF) — EUDR Platform v2.0' }}</slot>
    </div>
  </footer>
</template>

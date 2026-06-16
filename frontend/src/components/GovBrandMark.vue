<script setup>
defineProps({
  size: { type: String, default: 'md' },
  layout: { type: String, default: 'stacked' },
  showRepublic: { type: Boolean, default: true },
  showMotto: { type: Boolean, default: false },
  platformTitle: { type: String, default: '' },
  subtitle: { type: String, default: '' },
});
</script>

<template>
  <div class="gov-brand" :class="[`gov-brand--${size}`, `gov-brand--${layout}`]">
    <div class="gov-crest-wrap">
      <img
        class="gov-crest"
        src="/coat-of-arms-uganda.svg"
        alt="Coat of Arms of the Republic of Uganda"
        width="120"
        height="129"
        loading="eager"
        decoding="async"
      />
      <div v-if="layout === 'stacked'" class="gov-crest-glow" aria-hidden="true" />
    </div>

    <div class="gov-brand-text">
      <span v-if="showRepublic" class="gov-republic">Republic of Uganda</span>
      <span class="gov-ministry">Ministry of Agriculture, Animal Industry and Fisheries</span>
      <span class="gov-acronym">(MAAIF)</span>
      <span v-if="platformTitle" class="gov-platform">{{ platformTitle }}</span>
      <span v-if="subtitle" class="gov-subtitle">{{ subtitle }}</span>
      <span v-if="showMotto" class="gov-motto">For God and My Country</span>
    </div>
  </div>
</template>

<style scoped>
.gov-brand {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.gov-brand--stacked {
  flex-direction: column;
  text-align: center;
  align-items: center;
}

.gov-brand--inline {
  flex-direction: row;
  text-align: left;
  align-items: center;
}

.gov-crest-wrap {
  position: relative;
  flex-shrink: 0;
}

.gov-crest {
  position: relative;
  z-index: 1;
  display: block;
  height: auto;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
}

.gov-brand--sm .gov-crest { width: 44px; }
.gov-brand--md .gov-crest { width: 56px; }
.gov-brand--lg .gov-crest { width: 120px; }
.gov-brand--xl .gov-crest { width: 160px; }

.gov-crest-glow {
  position: absolute;
  inset: 10% 5% -5%;
  background: radial-gradient(ellipse at center, rgba(252, 220, 4, 0.35), transparent 70%);
  z-index: 0;
  pointer-events: none;
}

.gov-brand-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.gov-republic {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ug-yellow, #fcdc04);
}

.gov-ministry {
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.25;
  color: inherit;
  letter-spacing: -0.01em;
}

.gov-brand--sm .gov-ministry { font-size: 0.68rem; }
.gov-brand--lg .gov-ministry,
.gov-brand--xl .gov-ministry {
  font-size: 1rem;
  line-height: 1.35;
  max-width: 22rem;
}

.gov-acronym {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.04em;
}

.gov-brand--stacked .gov-acronym {
  color: var(--ug-yellow, #fcdc04);
}

.gov-platform {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin-top: 0.15rem;
}

.gov-brand--stacked .gov-platform {
  font-size: 0.95rem;
  padding-top: 0.35rem;
  border-top: 1px solid rgba(252, 220, 4, 0.35);
  margin-top: 0.5rem;
}

.gov-subtitle {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 400;
}

.gov-motto {
  margin-top: 0.5rem;
  font-size: 0.7rem;
  font-style: italic;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.8);
}

.gov-brand--lg .gov-motto,
.gov-brand--xl .gov-motto {
  font-size: 0.85rem;
  padding: 0.35rem 0.85rem;
  border: 1px solid rgba(252, 220, 4, 0.4);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.15);
}
</style>

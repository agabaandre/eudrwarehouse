<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { SUPPORTED_LOCALES, setLocale } from '@/i18n';

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  compact: { type: Boolean, default: false },
});

const { t, locale } = useI18n();
const menuOpen = ref(false);

const links = [
  { to: '/', labelKey: 'common.home' },
  { to: '/registration', labelKey: 'common.registration' },
  { to: '/analytics', labelKey: 'common.analytics' },
  { to: '/maps', labelKey: 'common.maps' },
];

function onLocaleChange(e) {
  setLocale(e.target.value);
}

function closeMenu() {
  menuOpen.value = false;
}
</script>

<template>
  <header class="header">
    <div class="header-inner">
      <div class="header-brand">
        <div class="header-logo" aria-hidden="true">EU</div>
        <div>
          <h1>{{ compact ? 'MAAIF EUDR' : title }}</h1>
          <div v-if="subtitle && !compact" class="subtitle">{{ subtitle }}</div>
        </div>
      </div>

      <button
        class="nav-toggle"
        type="button"
        :aria-expanded="menuOpen"
        aria-label="Toggle navigation"
        @click="menuOpen = !menuOpen"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path v-if="!menuOpen" d="M4 6h16M4 12h16M4 18h16" />
          <path v-else d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <nav :class="{ open: menuOpen }">
        <router-link v-for="link in links" :key="link.to" :to="link.to" @click="closeMenu">
          {{ t(link.labelKey) }}
        </router-link>
        <select class="lang-select" :value="locale" :aria-label="t('common.language')" @change="onLocaleChange">
          <option v-for="loc in SUPPORTED_LOCALES" :key="loc.code" :value="loc.code">{{ loc.label }}</option>
        </select>
        <slot name="nav" />
      </nav>
    </div>
  </header>
</template>

<style scoped>
nav :deep(a) {
  color: rgba(255, 255, 255, 0.85);
}

nav :deep(a.router-link-active) {
  background: rgba(255, 255, 255, 0.12);
  color: white;
  font-weight: 600;
  text-decoration: none;
}
</style>

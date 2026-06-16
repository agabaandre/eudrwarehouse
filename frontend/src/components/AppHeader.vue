<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { SUPPORTED_LOCALES, setLocale } from '@/i18n';
import GovBrandMark from '@/components/GovBrandMark.vue';

defineProps({
  title: { type: String, default: 'EUDR Compliance Platform' },
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
    <div class="gov-tricolor" aria-hidden="true" />

    <div class="header-inner">
      <router-link to="/" class="header-brand" @click="closeMenu">
        <GovBrandMark
          :size="compact ? 'sm' : 'md'"
          layout="inline"
          :platform-title="compact ? 'EUDR' : title"
          :subtitle="subtitle && !compact ? subtitle : ''"
        />
      </router-link>

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
.header-brand {
  text-decoration: none;
  color: white;
  min-width: 0;
  flex: 1;
}

.header-brand:hover {
  color: white;
  text-decoration: none;
}

nav :deep(a) {
  color: rgba(255, 255, 255, 0.85);
}

nav :deep(a.router-link-active) {
  background: rgba(252, 220, 4, 0.15);
  color: var(--ug-yellow, #fcdc04);
  font-weight: 600;
  text-decoration: none;
}
</style>

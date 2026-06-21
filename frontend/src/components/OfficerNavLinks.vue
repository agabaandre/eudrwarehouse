<script setup>
import { onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '@/composables/api';
import { clearManagementSession, useManagementSession } from '@/composables/managementAuth';

const route = useRoute();
const router = useRouter();
const { isLoggedIn } = useManagementSession();
const superset = ref({});

async function loadSupersetLink() {
  if (!isLoggedIn.value) return;
  try {
    const cfg = await api('/api/auth/config');
    superset.value = cfg.superset || {};
  } catch {
    superset.value = {};
  }
}

function logout() {
  clearManagementSession();
  if (route.path.startsWith('/management')) {
    return;
  }
  router.push('/management');
}

onMounted(loadSupersetLink);

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) loadSupersetLink();
  else superset.value = {};
});
</script>

<template>
  <span v-if="isLoggedIn" class="officer-nav-group">
    <span class="officer-nav-divider" aria-hidden="true" />
    <RouterLink
      to="/management"
      class="officer-nav-link"
      :class="{ active: route.name === 'management' }"
    >
      Dashboard
    </RouterLink>
    <RouterLink
      to="/management/configuration"
      class="officer-nav-link"
      :class="{ active: route.name === 'management-configuration' }"
    >
      Configuration
    </RouterLink>
    <a
      v-if="superset.enabled && superset.url"
      :href="superset.url"
      class="officer-nav-link"
      target="_blank"
      rel="noopener noreferrer"
    >
      Superset BI
    </a>
    <button type="button" class="officer-nav-link officer-nav-btn" @click="logout">
      Logout
    </button>
  </span>
</template>

<style scoped>
.officer-nav-group {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.officer-nav-divider {
  display: inline-block;
  width: 1px;
  height: 1.25rem;
  background: rgba(255, 255, 255, 0.25);
  margin: 0 0.15rem;
}

.officer-nav-link {
  display: inline-flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.88);
  font-weight: 600;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  border: 1px solid transparent;
  text-decoration: none;
  font-size: 0.875rem;
  font-family: var(--font);
}

.officer-nav-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  text-decoration: none;
}

.officer-nav-link.active {
  color: #062e1c;
  background: var(--ug-yellow);
  border-color: rgba(252, 220, 4, 0.5);
}

.officer-nav-btn {
  background: transparent;
  cursor: pointer;
}
</style>

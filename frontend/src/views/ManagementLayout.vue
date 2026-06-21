<script setup>
import { onMounted, provide, ref } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import { api } from '@/composables/api';
import { clearManagementSession, ensureManagementSession, getManagementToken } from '@/composables/managementAuth';

const route = useRoute();
const isLoggedIn = ref(!!getManagementToken());
const loginEmail = ref('admin@admin.com');
const loginPassword = ref('admin');
const loginError = ref('');
const sessionNotice = ref('');
const superset = ref({});

async function login() {
  loginError.value = '';
  sessionNotice.value = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail.value, password: loginPassword.value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Sign in failed (${res.status})`);
    }
    if (!data.token) {
      throw new Error('Sign in failed — no session token returned.');
    }
    localStorage.setItem('eudr_token', data.token);
    isLoggedIn.value = true;
  } catch (e) {
    loginError.value = e.message || 'Login failed. Use admin@admin.com / admin';
  }
}

function logout() {
  clearManagementSession();
  isLoggedIn.value = false;
  sessionNotice.value = '';
}

function handleAuthError(message) {
  clearManagementSession();
  isLoggedIn.value = false;
  sessionNotice.value = message || 'Your session expired. Please sign in again to save settings.';
}

provide('managementAuth', { handleAuthError, ensureSession: ensureManagementSession });

onMounted(async () => {
  try {
    const cfg = await api('/api/auth/config');
    superset.value = cfg.superset || {};
  } catch {
    /* optional */
  }
  if (isLoggedIn.value) {
    try {
      await ensureManagementSession();
    } catch (e) {
      handleAuthError(e.message);
    }
  }
});
</script>

<template>
  <div v-if="!isLoggedIn" class="login-overlay">
    <div class="login-box">
      <h2>MAAIF Officer Access</h2>
      <p v-if="sessionNotice" class="login-notice">{{ sessionNotice }}</p>
      <p v-else class="login-sub">Strategic dashboard and configuration — demo: admin@admin.com / admin</p>
      <input v-model="loginEmail" type="email" placeholder="Email" autocomplete="username">
      <input v-model="loginPassword" type="password" placeholder="Password" autocomplete="current-password">
      <button class="btn btn-primary" style="width:100%" type="button" @click="login">Sign In</button>
      <p v-if="loginError" style="color:#d93025;margin-top:0.75rem">{{ loginError }}</p>
    </div>
  </div>

  <template v-else>
    <AppHeader title="Strategic Management" subtitle="MAAIF EUDR Compliance — Leadership &amp; Administration">
      <template #nav>
        <RouterLink to="/management" class="mgmt-nav-link" :class="{ active: route.name === 'management' }">
          Dashboard
        </RouterLink>
        <RouterLink to="/management/configuration" class="mgmt-nav-link" :class="{ active: route.name === 'management-configuration' }">
          Configuration
        </RouterLink>
        <a v-if="superset.enabled && superset.url" :href="superset.url" target="_blank" rel="noopener noreferrer">Superset BI</a>
        <a href="#" @click.prevent="logout">Logout</a>
      </template>
    </AppHeader>

    <RouterView />

    <AppFooter text="MAAIF EUDR Compliance Platform — Strategic Dashboard" />
  </template>
</template>

<style scoped>
.mgmt-nav-link {
  color: rgba(255, 255, 255, 0.88);
  font-weight: 600;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  border: 1px solid transparent;
}
.mgmt-nav-link:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
.mgmt-nav-link.active {
  color: #062e1c;
  background: var(--ug-yellow);
  border-color: rgba(252, 220, 4, 0.5);
}
.login-notice {
  color: #9a3412;
  background: #fff7ed;
  border: 1px solid #fdba74;
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}
</style>

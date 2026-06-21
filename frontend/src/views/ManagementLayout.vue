<script setup>
import { onMounted, provide, ref } from 'vue';
import { RouterView } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import { api } from '@/composables/api';
import {
  clearManagementSession,
  ensureManagementSession,
  setManagementToken,
  useManagementSession,
} from '@/composables/managementAuth';

const { isLoggedIn } = useManagementSession();
const loginEmail = ref('admin@admin.com');
const loginPassword = ref('admin');
const loginError = ref('');
const sessionNotice = ref('');

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
    setManagementToken(data.token);
  } catch (e) {
    loginError.value = e.message || 'Login failed. Use admin@admin.com / admin';
  }
}

function handleAuthError(message) {
  clearManagementSession();
  sessionNotice.value = message || 'Your session expired. Please sign in again to save settings.';
}

provide('managementAuth', { handleAuthError, ensureSession: ensureManagementSession });

onMounted(async () => {
  try {
    await api('/api/auth/config');
  } catch {
    /* optional warm-up */
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
    <AppHeader title="Strategic Management" subtitle="MAAIF EUDR Compliance — Leadership &amp; Administration" />

    <RouterView />

    <AppFooter text="MAAIF EUDR Compliance Platform — Strategic Dashboard" />
  </template>
</template>

<style scoped>
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

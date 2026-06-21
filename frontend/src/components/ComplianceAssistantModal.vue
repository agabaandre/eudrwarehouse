<script setup>
import { onUnmounted, watch } from 'vue';
import ComplianceAssistant from '@/components/ComplianceAssistant.vue';
import { useAssistantModal } from '@/composables/useAssistantModal';

const { isOpen, close } = useAssistantModal();

function onKeydown(event) {
  if (event.key === 'Escape') close();
}

watch(isOpen, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeydown);
  } else {
    document.body.style.overflow = '';
    window.removeEventListener('keydown', onKeydown);
  }
});

onUnmounted(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="assistant-modal-backdrop"
      aria-hidden="false"
      @click.self="close"
    >
      <div
        class="assistant-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assistant-modal-title"
      >
        <button type="button" class="assistant-modal-close" aria-label="Close assistant" @click="close">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <ComplianceAssistant modal />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.assistant-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(6, 46, 28, 0.55);
  backdrop-filter: blur(4px);
}

.assistant-modal {
  position: relative;
  width: min(720px, 100%);
  max-height: min(90vh, 860px);
  overflow: auto;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.assistant-modal-close {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: var(--text);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.assistant-modal-close:hover {
  background: white;
  color: var(--ug-green-dark);
}
</style>

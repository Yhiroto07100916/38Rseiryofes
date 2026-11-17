<template>
  <div
    class="api-loading-bar"
    :class="{ 'api-loading-bar--active': ui.isApiLoading }"
    aria-live="polite"
    :aria-busy="ui.isApiLoading"
  >
    <v-progress-linear
      :active="ui.isApiLoading"
      indeterminate
      color="primary"
      height="3"
    />
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '~/stores/ui'

const ui = useUiStore()
</script>

<style scoped>
.api-loading-bar {
  position: fixed;
  z-index: 2500;
  inset: 0 0 auto;
  height: 3px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease;
}

.api-loading-bar--active {
  opacity: 1;
}
</style>

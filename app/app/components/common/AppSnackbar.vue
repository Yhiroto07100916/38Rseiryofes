<template>
  <v-snackbar
    v-model="ui.snackbarVisible"
    :timeout="ui.snackbarTimeout"
    location="bottom right"
    :color="snackbarColor"
    variant="flat"
    rounded="lg"
    class="app-snackbar"
  >
    <div class="d-flex align-center">
      <v-icon
        :icon="snackbarIcon"
        size="22"
        class="mr-3"
      />

      <span>{{ ui.snackbarMessage }}</span>
    </div>

    <template #actions>
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        @click="ui.closeSnackbar()"
      />
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '~/stores/ui'

const ui = useUiStore()

const snackbarColor = computed(() => {
  switch (ui.snackbarType) {
    case 'success':
      return 'success'
    case 'error':
      return 'error'
    case 'warning':
      return 'warning'
    default:
      return 'info'
  }
})

const snackbarIcon = computed(() => {
  switch (ui.snackbarType) {
    case 'success':
      return 'mdi-check-circle-outline'
    case 'error':
      return 'mdi-alert-circle-outline'
    case 'warning':
      return 'mdi-alert-outline'
    default:
      return 'mdi-information-outline'
  }
})
</script>

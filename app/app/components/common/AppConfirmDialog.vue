<template>
  <v-dialog
    v-model="ui.confirmVisible"
    max-width="440"
    persistent
  >
    <v-card rounded="xl">
      <v-card-title class="text-h6 font-weight-bold pt-5 px-5">
        {{ ui.confirmTitle }}
      </v-card-title>

      <v-card-text class="px-5 pb-2">
        <div class="text-body-1" style="white-space: pre-line">
          {{ ui.confirmMessage }}
        </div>
      </v-card-text>

      <v-card-actions class="px-5 pb-5 pt-4">
        <v-spacer />

        <v-btn
          variant="text"
          @click="ui.resolveConfirm(false)"
        >
          {{ ui.confirmCancelText }}
        </v-btn>

        <v-btn
          :color="ui.confirmColor"
          variant="flat"
          @click="ui.resolveConfirm(true)"
        >
          {{ ui.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useUiStore } from '~/stores/ui'

const ui = useUiStore()
</script>

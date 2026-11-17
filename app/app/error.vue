<template>
  <v-container class="error-page py-12">
    <v-card class="mx-auto pa-6 pa-sm-8 text-center" max-width="520" rounded="xl" variant="outlined">
      <v-icon
        :icon="isNotFound ? 'mdi-file-search-outline' : 'mdi-alert-circle-outline'"
        :color="isNotFound ? 'warning' : 'error'"
        size="56"
        class="mb-4"
      />
      <div class="text-overline text-medium-emphasis mb-2">
        ERROR {{ error.statusCode || 500 }}
      </div>
      <h1 class="text-h5 font-weight-bold mb-3">
        {{ isNotFound ? 'ページが見つかりません' : 'ページを表示できませんでした' }}
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-6">
        {{ description }}
      </p>
      <div class="d-flex flex-wrap justify-center ga-3">
        <v-btn color="primary" prepend-icon="mdi-refresh" @click="retry">
          もう一度試す
        </v-btn>
        <v-btn variant="tonal" prepend-icon="mdi-home" @click="goHome">
          トップページへ
        </v-btn>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  error: {
    statusCode?: number
    statusMessage?: string
    message?: string
  }
}>()

const isNotFound = computed(() => props.error.statusCode === 404)
const description = computed(() => {
  if (isNotFound.value) {
    return 'URLが正しいか確認してください。ページが移動または削除された可能性もあります。'
  }

  if (props.error.statusCode === 403) {
    return 'このページを表示する権限がない可能性があります。'
  }

  return '一時的な問題の可能性があります。通信状況を確認して、もう一度お試しください。'
})

const retry = () => clearError()
const goHome = () => clearError({ redirect: '/' })
</script>

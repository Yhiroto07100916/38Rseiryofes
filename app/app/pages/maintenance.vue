<template>
  <v-container class="fill-height d-flex align-center justify-center py-12">
    <v-card
      max-width="560"
      width="100%"
      rounded="xl"
      variant="outlined"
      class="pa-6 pa-sm-8 text-center"
    >
      <v-avatar color="warning" variant="tonal" size="72" class="mb-5">
        <v-icon icon="mdi-wrench-clock" size="38" />
      </v-avatar>

      <p class="text-overline text-medium-emphasis mb-2">
        MAINTENANCE
      </p>
      <h1 class="text-h4 font-weight-bold mb-4">
        メンテナンス中です
      </h1>
      <p class="text-body-1 text-medium-emphasis mb-6">
        {{ message }}
      </p>

      <div class="d-flex flex-column ga-3 align-center">
        <v-btn
          color="primary"
          size="large"
          rounded="lg"
          prepend-icon="mdi-refresh"
          :loading="checking"
          @click="checkAgain"
        >
          再読み込み
        </v-btn>

        <v-btn
          variant="text"
          color="secondary"
          prepend-icon="mdi-shield-account"
          to="/login?maintenanceAdmin=1"
        >
          重要管理者ログイン
        </v-btn>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"

definePageMeta({
  layout: false,
})

const config = useRuntimeConfig()
const message = ref("サイトのメンテナンスを行っています。しばらくお待ちください。")
const checking = ref(false)

async function checkAgain() {
  checking.value = true

  try {
    const apiBaseUrl = String(config.public.apiBaseUrl).replace(/\/$/, "")
    const status = await $fetch<{
      maintenance_mode: boolean
      maintenance_message: string
      is_important_settings_admin: boolean
    }>(`${apiBaseUrl}/api/site-status`, {
      credentials: "include",
    })

    message.value = status.maintenance_message

    if (!status.maintenance_mode || status.is_important_settings_admin) {
      await navigateTo("/")
    }
  } catch {
    message.value = "状態を確認できませんでした。通信状況を確認して、もう一度お試しください。"
  } finally {
    checking.value = false
  }
}

onMounted(checkAgain)
</script>

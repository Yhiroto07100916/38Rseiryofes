<template>
  <v-container class="py-6" max-width="760">
    <div class="d-flex align-center ga-3 mb-6">
      <LayoutBackButton />
      <div>
        <h1 class="text-h5 font-weight-bold">工具貸出設定</h1>
        <div class="text-body-2 text-medium-emphasis">全体返却時刻を管理します。</div>
      </div>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>
    <v-alert v-if="successMessage" type="success" variant="tonal" class="mb-4">{{ successMessage }}</v-alert>

    <v-card rounded="xl" variant="outlined" class="mb-4">
      <v-card-title>全体返却時刻</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          通常の貸出について、全体返却時刻を1つ設定できます。貸出時に次の返却時刻が期限として反映されます。
        </p>
        <v-text-field
          v-model="classReturnTime"
          type="time"
          label="返却時刻"
          variant="outlined"
          :disabled="loading || saving || !auth.isAdmin.value"
        />
        <div class="d-flex ga-2">
          <v-btn color="primary" :loading="saving === 'class'" :disabled="!auth.isAdmin.value || loading" @click="saveReturnTime('class')">保存</v-btn>
          <v-btn variant="outlined" :disabled="!auth.isAdmin.value || loading || !classReturnTime" @click="classReturnTime = ''">解除</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card rounded="xl" variant="outlined">
      <v-card-title>チーフ用 全体返却時刻</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          チーフの貸出について、通常とは別の全体返却時刻を設定できます。
        </p>
        <v-text-field
          v-model="chiefReturnTime"
          type="time"
          label="チーフ用返却時刻"
          variant="outlined"
          :disabled="loading || saving || !auth.isAdmin.value"
        />
        <div class="d-flex ga-2">
          <v-btn color="primary" :loading="saving === 'chief'" :disabled="!auth.isAdmin.value || loading" @click="saveReturnTime('chief')">保存</v-btn>
          <v-btn variant="outlined" :disabled="!auth.isAdmin.value || loading || !chiefReturnTime" @click="chiefReturnTime = ''">解除</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-progress-linear v-if="loading" indeterminate class="mt-4" />
    <p v-if="!auth.isAdmin.value" class="text-caption text-medium-emphasis mt-4">
      返却時刻の変更には工具貸出管理権限が必要です。
    </p>
  </v-container>
</template>

<script setup lang="ts">

import { onMounted, ref } from 'vue'

definePageMeta({ middleware: 'auth' })

const { request } = useToolRentalApi()
const auth = useToolRentalAuth()
const classReturnTime = ref('')
const chiefReturnTime = ref('')
const loading = ref(false)
const saving = ref<'' | 'class' | 'chief'>('')
const errorMessage = ref('')
const successMessage = ref('')

async function loadReturnTimes() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [normal, chief] = await Promise.all([
      request<{ universal_return_times: Array<{ id: number; return_time: string }> }>('/settings/return-time'),
      request<{ universal_return_times: Array<{ id: number; return_time: string }> }>('/settings/return-time-chief'),
    ])
    classReturnTime.value = normal.universal_return_times[0]?.return_time ?? ''
    chiefReturnTime.value = chief.universal_return_times[0]?.return_time ?? ''
  } catch (error) {
    console.error(error)
    errorMessage.value = '返却時刻を読み込めませんでした。閲覧権限を確認してください。'
  } finally {
    loading.value = false
  }
}

async function saveReturnTime(kind: 'class' | 'chief') {
  saving.value = kind
  errorMessage.value = ''
  successMessage.value = ''
  const value = kind === 'class' ? classReturnTime.value : chiefReturnTime.value
  try {
    await request(kind === 'class' ? '/settings/return-time' : '/settings/return-time-chief', {
      method: 'PATCH',
      body: { universal_return_times: value ? [value] : [] },
    })
    successMessage.value = kind === 'class' ? '全体返却時刻を保存しました。' : 'チーフ用全体返却時刻を保存しました。'
    await loadReturnTimes()
  } catch (error) {
    console.error(error)
    errorMessage.value = '返却時刻の保存に失敗しました。入力内容と権限を確認してください。'
  } finally {
    saving.value = ''
  }
}

onMounted(loadReturnTimes)
</script>

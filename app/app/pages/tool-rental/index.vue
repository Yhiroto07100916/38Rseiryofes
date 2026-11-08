<template>
  <v-container class="py-6">
    <div class="d-flex align-center ga-3 mb-6">
      <v-avatar color="primary" variant="tonal" rounded="lg" size="48">
        <v-icon icon="mdi-toolbox-outline" size="28" />
      </v-avatar>
      <div>
        <h1 class="text-h4 font-weight-bold">工具貸出管理</h1>
        <div class="text-body-2 text-medium-emphasis">在庫・貸出・返却・予約・履歴を管理します。</div>
      </div>
      <v-spacer />
      <v-btn icon="mdi-refresh" variant="text" :loading="loading" aria-label="更新" @click="loadSummary" />
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-row v-if="canView">
      <v-col cols="12" sm="6" md="4">
        <v-card rounded="xl" variant="tonal">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">登録されている工具・機材</div>
            <div class="text-h3 font-weight-bold">{{ tools.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="4">
        <v-card rounded="xl" variant="tonal">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">貸出中の個体</div>
            <div class="text-h3 font-weight-bold">{{ activeLoanCount }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="4">
        <v-card rounded="xl" variant="tonal">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">貸出可能な個体</div>
            <div class="text-h3 font-weight-bold">{{ availableCount }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-2">
      <v-col v-for="item in visibleItems" :key="item.to" cols="12" sm="6" md="4">
        <v-card :to="item.to" rounded="xl" variant="outlined" height="100%" hover>
          <v-card-text class="d-flex align-center ga-4 pa-5">
            <v-avatar :color="item.color" variant="tonal" rounded="lg" size="48">
              <v-icon :icon="item.icon" size="26" />
            </v-avatar>
            <div class="flex-grow-1">
              <div class="text-h6 font-weight-bold">{{ item.title }}</div>
              <div class="text-body-2 text-medium-emphasis">{{ item.description }}</div>
            </div>
            <v-icon icon="mdi-chevron-right" color="medium-emphasis" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

import { computed, onMounted, ref } from 'vue'
import type { Loan, Tool } from '~/types/tool-rental'

const auth = useAuthStore()
const { request } = useToolRentalApi()
const tools = ref<Tool[]>([])
const activeLoans = ref<Loan[]>([])
const loading = ref(false)
const errorMessage = ref('')

const canView = computed(() =>
  auth.hasPermission('tool_rental.view') ||
  auth.hasPermission('tool_rental.manage'),
)
const activeLoanCount = computed(() =>
  activeLoans.value.reduce((sum, loan) => sum + loan.tool_items.filter(item => !item.returned_at).length, 0),
)
const availableCount = computed(() =>
  tools.value.reduce((sum, tool) => sum + tool.available_quantity, 0),
)

const items = [
  { title: '工具・機材一覧', description: '在庫数・個体番号・貸出状態を管理', icon: 'mdi-tools', color: 'primary', to: '/tool-rental/tools', permission: 'tool_rental.view' },
  { title: '貸出処理', description: 'クラス・氏名・個体を指定して貸出', icon: 'mdi-arrow-right-bold-circle-outline', color: 'primary', to: '/tool-rental/loans', permission: 'tool_rental.checkout' },
  { title: '返却処理', description: '貸出中の個体を選んで返却', icon: 'mdi-arrow-left-bold-circle-outline', color: 'success', to: '/tool-rental/loans/return', permission: 'tool_rental.return' },
  { title: '現在貸出中', description: '返却されていない工具・機材を確認', icon: 'mdi-clipboard-clock-outline', color: 'info', to: '/tool-rental/loans/current', permission: 'tool_rental.view' },
  { title: '予約管理', description: '予約待ち・順番・貸出への移行', icon: 'mdi-calendar-clock-outline', color: 'warning', to: '/tool-rental/reservations', permission: 'tool_rental.view' },
  { title: '貸出履歴', description: '貸出・返却・延長の記録を確認', icon: 'mdi-history', color: 'secondary', to: '/tool-rental/loans/history', permission: 'tool_rental.history' },
  { title: '返却時刻設定', description: '通常・チーフの全体返却時刻を設定', icon: 'mdi-clock-cog-outline', color: 'secondary', to: '/tool-rental/settings', permission: 'tool_rental.manage' },
]

const visibleItems = computed(() =>
  items.filter(item => auth.hasPermission(item.permission) || (item.permission === 'tool_rental.view' && ['tool_rental.manage', 'tool_rental.checkout', 'tool_rental.return'].some(permission => auth.hasPermission(permission)))),
)

async function loadSummary() {
  if (!canView.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [toolResult, loanResult] = await Promise.all([
      request<Tool[]>('/tools'),
      request<Loan[]>('/loans/current'),
    ])
    tools.value = toolResult
    activeLoans.value = loanResult
  } catch (error) {
    console.error(error)
    errorMessage.value = '工具貸出情報を取得できませんでした。権限と通信状態を確認してください。'
  } finally {
    loading.value = false
  }
}

onMounted(loadSummary)
</script>

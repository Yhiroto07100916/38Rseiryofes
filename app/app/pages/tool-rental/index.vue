<template>
  <div>
    <div class="d-flex align-center ga-3 mb-6">
      <v-avatar color="primary" variant="tonal" rounded="lg" size="48">
        <v-icon icon="mdi-toolbox-outline" size="28" />
      </v-avatar>
      <div>
        <h1 class="text-h5 font-weight-bold">工具・機材の貸出記録</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">38Rで管理する工具の個体と、貸出・返却の記録を確認できます。</p>
      </div>
      <v-spacer />
      <v-btn icon="mdi-refresh" variant="text" :loading="loading" aria-label="更新" @click="loadSummary" />
    </div>

    <v-row class="mb-2">
      <v-col cols="12" sm="4">
        <v-card rounded="lg" variant="tonal">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">工具の種類</div>
            <div class="text-h3 font-weight-bold">{{ tools.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card rounded="lg" variant="tonal">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">登録個体数</div>
            <div class="text-h3 font-weight-bold">{{ totalItems }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card rounded="lg" variant="tonal">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">現在貸出中</div>
            <div class="text-h3 font-weight-bold">{{ currentLoans.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col v-for="item in links" :key="item.to" cols="12" sm="6" md="4">
        <v-card :to="item.to" rounded="lg" variant="outlined" height="100%">
          <v-card-text class="d-flex align-center ga-3">
            <v-avatar :color="item.color" variant="tonal" rounded="lg">
              <v-icon :icon="item.icon" />
            </v-avatar>
            <div class="flex-grow-1">
              <div class="font-weight-bold">{{ item.title }}</div>
              <div class="text-body-2 text-medium-emphasis">{{ item.description }}</div>
            </div>
            <v-icon icon="mdi-chevron-right" color="medium-emphasis" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card rounded="lg" variant="outlined" class="mt-4">
      <v-card-title class="text-subtitle-1">現在貸出中の個体</v-card-title>
      <v-divider />
      <v-table>
        <thead>
          <tr><th>工具</th><th>個体ID</th><th>管理番号</th><th>借りた人</th><th>貸出日時</th></tr>
        </thead>
        <tbody>
          <tr v-for="loan in currentLoans.slice(0, 8)" :key="loan.loan_item_id">
            <td>{{ loan.tool_name }}</td>
            <td>{{ loan.tool_item_id }}</td><td><v-chip size="small" variant="tonal">{{ loan.management_number }}</v-chip></td>
            <td>{{ loan.class_name }} {{ loan.borrower_name }}</td>
            <td>{{ formatDate(loan.borrowed_at) }}</td>
          </tr>
          <tr v-if="!loading && currentLoans.length === 0">
            <td colspan="5" class="text-center text-medium-emphasis py-5">現在貸出中の工具はありません。</td>
          </tr>
        </tbody>
      </v-table>
      <v-card-actions v-if="currentLoans.length > 8">
        <v-spacer />
        <v-btn to="/tool-rental/loans/current" variant="text">すべて表示</v-btn>
      </v-card-actions>
    </v-card>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4">{{ errorMessage }}</v-alert>
  </div>
</template>

<script setup lang="ts">
import type { Tool, CurrentLoanItem } from '~/types/tool-rental'

definePageMeta({ middleware: 'auth' })

const auth = useAuthStore()
const { request } = useToolRentalApi()
const loading = ref(false)
const tools = ref<Tool[]>([])
const currentLoans = ref<CurrentLoanItem[]>([])
const errorMessage = ref('')

const totalItems = computed(() => tools.value.reduce((total, tool) => total + tool.quantity, 0))

const allLinks = [
  { title: '工具一覧', description: '工具の個体・管理番号を確認、登録', icon: 'mdi-toolbox-outline', color: 'primary', to: '/tool-rental/tools' },
  { title: '貸出を記録', description: '借りた人と個体を記録する', icon: 'mdi-arrow-up-right-circle-outline', color: 'primary', to: '/tool-rental/loans' },
  { title: '返却を記録', description: '返却された個体と返却者を記録する', icon: 'mdi-check-circle-outline', color: 'success', to: '/tool-rental/loans/return' },
  { title: '貸出中の個体', description: 'まだ返却されていない工具を確認', icon: 'mdi-clipboard-list-outline', color: 'warning', to: '/tool-rental/loans/current' },
  { title: '貸出・返却履歴', description: '過去の貸出と返却の記録を確認', icon: 'mdi-history', color: 'secondary', to: '/tool-rental/loans/history' },
]

const links = computed(() => allLinks.filter(item => {
  if (item.to.endsWith('/tools')) return auth.hasPermission('tool_rental.view') || auth.hasPermission('tool_rental.manage')
  if (item.to.endsWith('/loans')) return auth.hasPermission('tool_rental.checkout') || auth.hasPermission('tool_rental.manage')
  if (item.to.endsWith('/return')) return auth.hasPermission('tool_rental.return') || auth.hasPermission('tool_rental.manage')
  if (item.to.endsWith('/current')) return auth.hasPermission('tool_rental.view') || auth.hasPermission('tool_rental.manage') || auth.hasPermission('tool_rental.checkout') || auth.hasPermission('tool_rental.return')
  return auth.hasPermission('tool_rental.history') || auth.hasPermission('tool_rental.manage')
}))

const formatDate = (value: string) => new Date(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : '+09:00')).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

const loadSummary = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const canView = auth.hasPermission('tool_rental.view') || auth.hasPermission('tool_rental.manage') || auth.hasPermission('tool_rental.checkout') || auth.hasPermission('tool_rental.return')
    if (canView) {
      const [toolResult, loanResult] = await Promise.all([
        request<Tool[]>('/tools'),
        request<CurrentLoanItem[]>('/loans/current'),
      ])
      tools.value = toolResult
      currentLoans.value = loanResult
    } else {
      tools.value = []
      currentLoans.value = []
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = '工具の情報を読み込めませんでした。権限とAPIの状態を確認してください。'
  } finally {
    loading.value = false
  }
}

onMounted(loadSummary)
</script>

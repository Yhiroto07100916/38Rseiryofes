<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-3 mb-5">
      <LayoutBackButton />
      <div>
        <h1 class="text-h5 font-weight-bold">貸出・返却履歴</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">個体ごとの貸出者・返却者・記録日時を確認できます。</p>
      </div>
      <v-spacer />
      <v-btn variant="outlined" prepend-icon="mdi-refresh" :loading="loading" @click="loadHistory">更新</v-btn>
    </div>

    <v-card rounded="lg" variant="outlined">
      <v-card-text>
        <v-row>
          <v-col cols="12" sm="5">
            <v-text-field v-model="search" label="工具・管理番号・氏名で検索" prepend-inner-icon="mdi-magnify" clearable hide-details />
          </v-col>
          <v-col cols="12" sm="4">
            <v-select v-model="status" :items="statusOptions" label="記録の状態" hide-details />
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider />
      <v-table>
        <thead><tr><th>工具</th><th>個体ID</th><th>管理番号</th><th>借りた人</th><th>貸出日時</th><th>時間制限</th><th>タイマー終了予定</th><th>返却を記録した人</th><th>返却日時</th><th>状態</th></tr></thead>
        <tbody>
          <tr
            v-for="record in filteredRecords"
            :id="`loan-item-${record.loan_item_id}`"
            :key="record.loan_item_id"
            :class="{ 'loan-item-highlight': highlightedLoanItemId === String(record.loan_item_id) }"
          >
            <td>{{ record.tool_name }}</td>
            <td>{{ record.tool_item_id }}</td><td><v-chip size="small" variant="tonal">{{ record.management_number }}</v-chip></td>
            <td>{{ record.class_name }} {{ record.borrower_name }}</td>
            <td>{{ formatDate(record.borrowed_at) }}</td>
            <td>{{ record.time_limit_minutes ? `${record.time_limit_minutes}分` : '—' }}</td>
            <td>{{ record.due_at ? formatDate(record.due_at) : '—' }}</td>
            <td>{{ record.returned_by_name ? `${record.returned_by_class_name} ${record.returned_by_name}` : '—' }}</td>
            <td>{{ record.returned_at ? formatDate(record.returned_at) : '—' }}</td>
            <td><v-chip size="small" :color="record.status === 'returned' ? 'success' : 'warning'" variant="tonal">{{ record.status === 'returned' ? '返却済み' : '貸出中' }}</v-chip></td>
          </tr>
          <tr v-if="!loading && filteredRecords.length === 0"><td colspan="10" class="text-center text-medium-emphasis py-6">履歴はありません。</td></tr>
        </tbody>
      </v-table>
      <v-card-actions class="text-caption text-medium-emphasis">直近500件を表示します。</v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { getDefaultTimeZone, jstDateTimeLocalToIso } from '~/utils/jst'
import { nextTick } from 'vue'
import type { LoanHistoryItem } from '~/types/tool-rental'

definePageMeta({ middleware: 'auth' })

const { request } = useToolRentalApi()
const route = useRoute()
const highlightedLoanItemId = ref(typeof route.query.open === 'string' ? route.query.open : '')
const records = ref<LoanHistoryItem[]>([])
const search = ref('')
const status = ref('all')
const loading = ref(false)
const statusOptions = [
  { title: 'すべて', value: 'all' },
  { title: '貸出中', value: 'borrowed' },
  { title: '返却済み', value: 'returned' },
]

const filteredRecords = computed(() => {
  const query = search.value.trim().toLowerCase()
  return records.value.filter(record => {
    const statusMatches = status.value === 'all' || record.status === status.value
    const textMatches = !query || [record.tool_name, record.management_number, record.class_name, record.borrower_name, record.returned_by_class_name, record.returned_by_name].join(' ').toLowerCase().includes(query)
    return statusMatches && textMatches
  })
})

const formatDate = (value: string) => {
  const normalized = value.replace(' ', 'T')
  const date = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
    ? new Date(normalized)
    : new Date(jstDateTimeLocalToIso(normalized.replace(' ', 'T'), getDefaultTimeZone()))
  return date.toLocaleString('ja-JP', { timeZone: getDefaultTimeZone() })
}

const loadHistory = async () => {
  loading.value = true
  try {
    records.value = await request<LoanHistoryItem[]>('/loans/history')
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadHistory()
  if (!highlightedLoanItemId.value) return
  await nextTick()
  document.getElementById(`loan-item-${highlightedLoanItemId.value}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})
</script>

<style scoped>
.loan-item-highlight {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
</style>

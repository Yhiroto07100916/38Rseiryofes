<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-3 mb-5">
      <LayoutBackButton />
      <div>
        <h1 class="text-h5 font-weight-bold">貸出中の個体</h1>
      </div>
      <v-spacer />
      <v-btn variant="outlined" prepend-icon="mdi-refresh" :loading="loading" @click="loadLoans">更新</v-btn>
    </div>

    <v-card rounded="lg" variant="outlined">
      <v-card-text>
        <v-text-field v-model="search" label="工具・管理番号・クラス・氏名で検索" prepend-inner-icon="mdi-magnify" clearable hide-details />
      </v-card-text>
      <v-divider />
      <div class="tool-rental-table-scroll">
      <v-table>
        <thead><tr><th>工具</th><th>個体ID</th><th>管理番号</th><th>借りた人</th><th>貸出日時</th></tr></thead>
        <tbody>
          <tr
            v-for="loan in filteredLoans"
            :id="`loan-item-${loan.loan_item_id}`"
            :key="loan.loan_item_id"
            :class="{ 'loan-item-highlight': highlightedLoanId === String(loan.loan_id) || highlightedLoanId === String(loan.loan_item_id) }"
          >
            <td>{{ loan.tool_name }}</td>
            <td>{{ loan.tool_item_id }}</td><td><v-chip size="small" variant="tonal">{{ loan.management_number }}</v-chip></td>
            <td>{{ loan.class_name }} {{ loan.borrower_name }}</td>
            <td>{{ formatDate(loan.borrowed_at) }}</td>
          </tr>
          <tr v-if="!loading && filteredLoans.length === 0"><td colspan="5" class="text-center text-medium-emphasis py-6">貸出中の個体はありません。</td></tr>
        </tbody>
      </v-table>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { getDefaultTimeZone, jstDateTimeLocalToIso } from '~/utils/jst'
import { nextTick } from 'vue'
import type { CurrentLoanItem } from '~/types/tool-rental'

definePageMeta({ middleware: 'auth' })

const { request } = useToolRentalApi()
const route = useRoute()
const highlightedLoanId = ref(typeof route.query.open === 'string' ? route.query.open : '')
const loans = ref<CurrentLoanItem[]>([])
const search = ref('')
const loading = ref(false)

const filteredLoans = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return loans.value
  return loans.value.filter(loan => [loan.tool_name, loan.management_number, loan.class_name, loan.borrower_name].join(' ').toLowerCase().includes(query))
})

const formatDate = (value: string) => {
  const normalized = value.replace(' ', 'T')
  const date = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
    ? new Date(normalized)
    : new Date(jstDateTimeLocalToIso(normalized.replace(' ', 'T'), getDefaultTimeZone()))
  return date.toLocaleString('ja-JP', { timeZone: getDefaultTimeZone() })
}

const loadLoans = async () => {
  loading.value = true
  try {
    loans.value = await request<CurrentLoanItem[]>('/loans/current')
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadLoans()
  if (!highlightedLoanId.value) return
  const loan = loans.value.find(item => String(item.loan_id) === highlightedLoanId.value || String(item.loan_item_id) === highlightedLoanId.value)
  if (!loan) return
  await nextTick()
  document.getElementById(`loan-item-${loan.loan_item_id}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})
</script>

<style scoped>
.loan-item-highlight {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.tool-rental-table-scroll {
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.tool-rental-table-scroll :deep(table) {
  min-width: 680px;
}
</style>

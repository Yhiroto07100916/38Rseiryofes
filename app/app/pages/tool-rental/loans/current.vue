<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-3 mb-5">
      <div>
        <h1 class="text-h5 font-weight-bold">貸出中の個体</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">まだ返却が記録されていない工具の一覧です。</p>
      </div>
      <v-spacer />
      <v-btn variant="outlined" prepend-icon="mdi-refresh" :loading="loading" @click="loadLoans">更新</v-btn>
    </div>

    <v-card rounded="lg" variant="outlined">
      <v-card-text>
        <v-text-field v-model="search" label="工具・管理番号・クラス・氏名で検索" prepend-inner-icon="mdi-magnify" clearable hide-details />
      </v-card-text>
      <v-divider />
      <v-table>
        <thead><tr><th>工具</th><th>個体ID</th><th>管理番号</th><th>借りた人</th><th>貸出日時</th></tr></thead>
        <tbody>
          <tr v-for="loan in filteredLoans" :key="loan.loan_item_id">
            <td>{{ loan.tool_name }}</td>
            <td>{{ loan.tool_item_id }}</td><td><v-chip size="small" variant="tonal">{{ loan.management_number }}</v-chip></td>
            <td>{{ loan.class_name }} {{ loan.borrower_name }}</td>
            <td>{{ formatDate(loan.borrowed_at) }}</td>
          </tr>
          <tr v-if="!loading && filteredLoans.length === 0"><td colspan="5" class="text-center text-medium-emphasis py-6">貸出中の個体はありません。</td></tr>
        </tbody>
      </v-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import type { CurrentLoanItem } from '~/types/tool-rental'

definePageMeta({ middleware: 'auth' })

const { request } = useToolRentalApi()
const loans = ref<CurrentLoanItem[]>([])
const search = ref('')
const loading = ref(false)

const filteredLoans = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return loans.value
  return loans.value.filter(loan => [loan.tool_name, loan.management_number, loan.class_name, loan.borrower_name].join(' ').toLowerCase().includes(query))
})

const formatDate = (value: string) => new Date(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : '+09:00')).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

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

onMounted(loadLoans)
</script>

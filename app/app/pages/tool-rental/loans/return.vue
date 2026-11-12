<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-3 mb-6">
      <LayoutBackButton />
      <h1 class="text-h5 font-weight-bold">返却を記録</h1>
    </div>

    <v-card rounded="lg" variant="outlined">
      <v-card-text>
        <v-text-field v-model="search" label="管理番号・工具名・借りた人で検索" prepend-inner-icon="mdi-magnify" clearable hide-details />
      </v-card-text>
      <v-divider />
      <div class="tool-rental-table-scroll d-none d-md-block">
      <v-table>
        <thead><tr><th>工具</th><th>個体ID</th><th>管理番号</th><th>借りた人</th><th>貸出日時</th><th class="text-right">操作</th></tr></thead>
        <tbody>
          <tr v-for="loan in filteredLoans" :key="loan.loan_item_id">
            <td>{{ loan.tool_name }}</td>
            <td>{{ loan.tool_item_id }}</td><td><v-chip size="small" variant="tonal">{{ loan.management_number }}</v-chip></td>
            <td>{{ loan.class_name }} {{ loan.borrower_name }}</td>
            <td>{{ formatDate(loan.borrowed_at) }}</td>
            <td class="text-right"><v-btn color="success" size="small" variant="tonal" :disabled="savingId !== null" :loading="savingId === loan.loan_item_id" @click="openReturn(loan)">返却を記録</v-btn></td>
          </tr>
          <tr v-if="!loading && filteredLoans.length === 0"><td colspan="6" class="text-center text-medium-emphasis py-6">該当する貸出中の個体はありません。</td></tr>
        </tbody>
      </v-table>
      </div>
      <div class="d-md-none pa-3 d-flex flex-column ga-3">
        <v-card
          v-for="loan in filteredLoans"
          :key="loan.loan_item_id"
          rounded="lg"
          variant="outlined"
        >
          <v-card-text>
            <div class="d-flex align-start justify-space-between ga-2 mb-3">
              <div class="text-subtitle-1 font-weight-bold">{{ loan.tool_name }}</div>
              <v-chip size="small" variant="tonal">{{ loan.management_number }}</v-chip>
            </div>
            <div class="loan-mobile-details mb-4">
              <div class="loan-mobile-field">
                <span>個体ID</span>
                <strong>{{ loan.tool_item_id }}</strong>
              </div>
              <div class="loan-mobile-field">
                <span>借りた人</span>
                <strong>{{ loan.class_name }} {{ loan.borrower_name }}</strong>
              </div>
              <div class="loan-mobile-field loan-mobile-field-full">
                <span>貸出日時</span>
                <strong>{{ formatDate(loan.borrowed_at) }}</strong>
              </div>
            </div>
            <v-btn
              block
              color="success"
              variant="tonal"
              :disabled="savingId !== null"
              :loading="savingId === loan.loan_item_id"
              @click="openReturn(loan)"
            >
              返却を記録
            </v-btn>
          </v-card-text>
        </v-card>
        <div v-if="!loading && filteredLoans.length === 0" class="text-center text-medium-emphasis py-6">
          該当する貸出中の個体はありません。
        </div>
      </div>
      <v-card-actions><v-spacer /><v-btn variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="loadLoans">更新</v-btn></v-card-actions>
    </v-card>

    <v-dialog v-model="dialog" max-width="520">
      <v-card>
        <v-card-title>返却内容の確認</v-card-title>
        <v-card-text>
          <v-alert v-if="selectedLoan" type="info" variant="tonal" class="mb-4">
            {{ selectedLoan.tool_name }} / 個体ID: {{ selectedLoan.tool_item_id }} / {{ selectedLoan.management_number }}<br>
            借りた人：{{ selectedLoan.class_name }} {{ selectedLoan.borrower_name }}
          </v-alert>
          <div class="text-subtitle-2 mb-2">返却を記録した人</div>
          <v-text-field v-model="returner.class_name" label="クラス" />
          <v-text-field v-model="returner.name" label="氏名" />
          <p class="text-caption text-medium-emphasis">ログイン中のユーザーが初期入力されています。必要なら変更できます。</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingId !== null" @click="dialog = false">キャンセル</v-btn>
          <v-btn color="success" :loading="savingId !== null" :disabled="!returner.class_name.trim() || !returner.name.trim()" @click="confirmReturn">返却を確定</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3500">{{ snackbarText }}</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { getDefaultTimeZone, jstDateTimeLocalToIso } from '~/utils/jst'
import type { CurrentLoanItem } from '~/types/tool-rental'

definePageMeta({ middleware: 'auth' })

const auth = useAuthStore()
const { request } = useToolRentalApi()
const loans = ref<CurrentLoanItem[]>([])
const search = ref('')
const loading = ref(false)
const savingId = ref<number | null>(null)
const dialog = ref(false)
const selectedLoan = ref<CurrentLoanItem | null>(null)
const currentUserName = computed(() => auth.user?.nickname?.trim() || auth.user?.name?.trim() || '')
const returner = reactive({ class_name: '38R', name: currentUserName.value })
watch(currentUserName, value => {
  if (!returner.name.trim() && value) returner.name = value
})
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

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
const showMessage = (message: string, color = 'success') => {
  snackbarText.value = message
  snackbarColor.value = color
  snackbar.value = true
}

const loadLoans = async () => {
  loading.value = true
  try {
    loans.value = await request<CurrentLoanItem[]>('/loans/current')
  } catch (error) {
    console.error(error)
    showMessage('貸出中の個体を取得できませんでした。', 'error')
  } finally {
    loading.value = false
  }
}

const openReturn = (loan: CurrentLoanItem) => {
  selectedLoan.value = loan
  returner.class_name = '38R'
  returner.name = currentUserName.value
  dialog.value = true
}

const confirmReturn = async () => {
  if (!selectedLoan.value || !returner.class_name.trim() || !returner.name.trim()) return
  const loan = selectedLoan.value
  savingId.value = loan.loan_item_id
  try {
    await request('/loans/return', {
      method: 'POST',
      body: {
        loan_item_id: loan.loan_item_id,
        returner_class_name: returner.class_name.trim(),
        returner_name: returner.name.trim(),
      },
    })
    dialog.value = false
    selectedLoan.value = null
    showMessage('返却を記録しました。')
    window.dispatchEvent(new Event('tool-rental:changed'))
    await loadLoans()
  } catch (error: any) {
    showMessage(error?.data?.detail || '返却の記録に失敗しました。', 'error')
  } finally {
    savingId.value = null
  }
}

onMounted(loadLoans)
</script>

<style scoped>
.tool-rental-table-scroll {
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.tool-rental-table-scroll :deep(table) {
  min-width: 760px;
}
.loan-mobile-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
}
.loan-mobile-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}
.loan-mobile-field span {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.75rem;
}
.loan-mobile-field strong {
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  font-weight: 600;
}
.loan-mobile-field-full {
  grid-column: 1 / -1;
}
</style>

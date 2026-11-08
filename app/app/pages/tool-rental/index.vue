<template>
  <v-container class="py-8 tool-rental-page">
    <v-row justify="center">
      <v-col cols="12" lg="11">
        <div class="d-flex align-center ga-3 mb-6">
          <LayoutBackButton />
          <v-avatar color="primary" variant="tonal" rounded="lg">
            <v-icon icon="mdi-toolbox-outline" />
          </v-avatar>
          <div class="flex-grow-1">
            <h1 class="text-h4 font-weight-bold">工具貸出管理</h1>
          </div>
          <v-btn
            v-if="canManage"
            color="primary"
            prepend-icon="mdi-plus"
            rounded="xl"
            @click="openToolDialog()"
          >
            工具を登録
          </v-btn>
          <v-btn
            icon="mdi-refresh"
            variant="text"
            :loading="loading"
            aria-label="更新"
            @click="loadAll"
          />
        </div>

        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          rounded="lg"
          class="mb-4"
          closable
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>
        <v-alert
          v-if="successMessage"
          type="success"
          variant="tonal"
          rounded="lg"
          class="mb-4"
          closable
          @click:close="successMessage = ''"
        >
          {{ successMessage }}
        </v-alert>

        <v-row class="mb-2">
          <v-col cols="12" :sm="canReturn ? 4 : 12">
            <v-card rounded="xl" variant="tonal">
              <v-card-text>
                <div class="text-caption text-medium-emphasis">登録工具</div>
                <div class="text-h4 font-weight-bold">{{ activeTools.length }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col v-if="canReturn" cols="12" sm="4">
            <v-card rounded="xl" variant="tonal">
              <v-card-text>
                <div class="text-caption text-medium-emphasis">貸出中の記録</div>
                <div class="text-h4 font-weight-bold">{{ activeLoans.length }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col v-if="canReturn" cols="12" sm="4">
            <v-card rounded="xl" variant="tonal">
              <v-card-text>
                <div class="text-caption text-medium-emphasis">貸出中の数量</div>
                <div class="text-h4 font-weight-bold">{{ checkedOutCount }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-card rounded="xl" variant="outlined" class="mb-6">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>工具一覧</span>
            <v-text-field
              v-model="search"
              density="compact"
              variant="outlined"
              prepend-inner-icon="mdi-magnify"
              placeholder="工具名・カテゴリで検索"
              hide-details
              clearable
              max-width="300"
            />
          </v-card-title>
          <v-divider />
          <v-progress-linear v-if="loading" indeterminate />
          <v-card-text v-if="!loading && filteredTools.length === 0" class="text-center text-medium-emphasis py-8">
            登録されている工具はありません。
          </v-card-text>
          <v-list v-else lines="two">
            <template v-for="(tool, index) in filteredTools" :key="tool.id">
              <v-list-item>
                <template #prepend>
                  <v-avatar color="primary" variant="tonal" rounded="lg">
                    <v-icon icon="mdi-wrench" />
                  </v-avatar>
                </template>
                <v-list-item-title class="font-weight-bold">
                  {{ tool.name }}
                  <v-chip v-if="!tool.is_active" size="x-small" color="warning" class="ml-2">貸出停止</v-chip>
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ tool.category }}<span v-if="tool.description"> · {{ tool.description }}</span>
                </v-list-item-subtitle>
                <template #append>
                  <div class="text-right mr-3">
                    <div class="font-weight-bold">{{ tool.available_quantity }} / {{ tool.total_quantity }}</div>
                    <div class="text-caption text-medium-emphasis">貸出可能 / 総数</div>
                  </div>
                  <v-btn
                    v-if="canCheckout && tool.is_active && tool.available_quantity > 0"
                    color="primary"
                    variant="tonal"
                    size="small"
                    @click="openCheckoutDialog(tool)"
                  >
                    貸出
                  </v-btn>
                  <v-btn
                    v-if="canManage"
                    icon="mdi-pencil"
                    variant="text"
                    size="small"
                    aria-label="工具を編集"
                    @click="openToolDialog(tool)"
                  />
                </template>
              </v-list-item>
              <v-divider v-if="index < filteredTools.length - 1" />
            </template>
          </v-list>
        </v-card>

        <v-card v-if="canReturn" rounded="xl" variant="outlined" class="mb-6">
          <v-card-title>貸出中・返却処理</v-card-title>
          <v-divider />
          <v-card-text v-if="activeLoans.length === 0" class="text-center text-medium-emphasis py-6">
            現在貸出中の工具はありません。
          </v-card-text>
          <v-list v-else lines="two">
            <template v-for="(loan, index) in activeLoans" :key="loan.id">
              <v-list-item>
                <v-list-item-title class="font-weight-bold">{{ loan.tool_name }} · {{ loan.quantity }}個</v-list-item-title>
                <v-list-item-subtitle>
                  借用者：{{ loan.borrower_name }} · {{ formatDate(loan.checked_out_at) }}
                  <span v-if="loan.checked_out_by_name"> · 受付：{{ loan.checked_out_by_name }}</span>
                </v-list-item-subtitle>
                <template #append>
                  <v-btn
                    color="success"
                    variant="tonal"
                    size="small"
                    :loading="returningLoanId === loan.id"
                    :disabled="Boolean(returningLoanId) && returningLoanId !== loan.id"
                    @click="returnLoan(loan)"
                  >
                    返却処理
                  </v-btn>
                </template>
              </v-list-item>
              <v-divider v-if="index < activeLoans.length - 1" />
            </template>
          </v-list>
        </v-card>

        <v-card v-if="canHistory" rounded="xl" variant="outlined">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>貸出履歴</span>
            <v-btn variant="text" size="small" :loading="historyLoading" @click="loadHistory"><v-icon icon="mdi-refresh" /></v-btn>
          </v-card-title>
          <v-divider />
          <v-card-text v-if="history.length === 0" class="text-center text-medium-emphasis py-6">
            履歴はまだありません。
          </v-card-text>
          <v-table v-else density="comfortable">
            <thead>
              <tr>
                <th>工具</th>
                <th>借用者</th>
                <th>数量</th>
                <th>貸出日時</th>
                <th>返却日時</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="loan in history" :key="loan.id">
                <td>{{ loan.tool_name }}</td>
                <td>{{ loan.borrower_name }}</td>
                <td>{{ loan.quantity }}</td>
                <td>{{ formatDate(loan.checked_out_at) }}</td>
                <td>{{ loan.returned_at ? formatDate(loan.returned_at) : '—' }}</td>
                <td>
                  <v-chip size="x-small" :color="loan.status === 'returned' ? 'success' : 'warning'" variant="tonal">
                    {{ loan.status === 'returned' ? '返却済み' : '貸出中' }}
                  </v-chip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="toolDialog" max-width="520">
      <v-card rounded="xl">
        <v-card-title>{{ editingTool ? '工具情報を編集' : '工具を登録' }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" variant="tonal" class="mb-4">{{ formError }}</v-alert>
          <v-text-field v-model="toolForm.name" label="工具名" variant="outlined" />
          <v-select :items="tool_category" v-model="toolForm.category" label="カテゴリ" variant="outlined" />
          <v-textarea v-model="toolForm.description" label="説明・備考" variant="outlined" rows="2" />
          <v-text-field v-model.number="toolForm.total_quantity" label="総数" type="number" min="1" variant="outlined" />
          <v-switch v-if="editingTool" v-model="toolForm.is_active" label="貸出を有効にする" color="primary" hide-details />
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="toolDialog = false">キャンセル</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveTool">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="checkoutDialog" max-width="520">
      <v-card rounded="xl">
        <v-card-title>工具を貸し出す</v-card-title>
        <v-card-text>
          <div class="mb-3 font-weight-bold">{{ selectedTool?.name }}（貸出可能 {{ selectedTool?.available_quantity }}個）</div>
          <v-alert v-if="formError" type="error" variant="tonal" class="mb-4">{{ formError }}</v-alert>
          <v-text-field v-model="checkoutForm.borrower_name" label="借用者名" variant="outlined" />
          <v-text-field v-model="checkoutForm.borrower_note" label="所属・連絡メモ（任意）" variant="outlined" />
          <v-text-field v-model.number="checkoutForm.quantity" label="数量" type="number" min="1" :max="selectedTool?.available_quantity" variant="outlined" />
          <v-textarea v-model="checkoutForm.checkout_note" label="備考（任意）" variant="outlined" rows="2" />
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="checkoutDialog = false">キャンセル</v-btn>
          <v-btn color="primary" :loading="saving" @click="submitCheckout">貸出を記録</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

definePageMeta({
  permissions: ['tool_rental.view'],
  middleware: 'auth',
})

interface ToolItem {
  id: string
  name: string
  category: string
  description: string | null
  total_quantity: number
  is_active: number
  external_tool_id: string | null
  checked_out_quantity: number
  available_quantity: number
}

interface LoanItem {
  id: string
  tool_id: string
  tool_name: string
  borrower_name: string
  borrower_note: string | null
  quantity: number
  status: 'checked_out' | 'returned'
  checked_out_by: string
  checked_out_by_name: string | null
  checked_out_at: string
  returned_by: string | null
  returned_by_name: string | null
  returned_at: string | null
  checkout_note: string | null
  return_note: string | null
}

const api = useApi()
const auth = useAuthStore()
const tools = ref<ToolItem[]>([])
const activeLoans = ref<LoanItem[]>([])
const history = ref<LoanItem[]>([])
const loading = ref(false)
const historyLoading = ref(false)
const saving = ref(false)
const returningLoanId = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const formError = ref('')
const search = ref('')
const toolDialog = ref(false)
const checkoutDialog = ref(false)
const editingTool = ref<ToolItem | null>(null)
const selectedTool = ref<ToolItem | null>(null)

const toolForm = reactive({
  name: '',
  category: '',
  description: '',
  total_quantity: 1,
  is_active: true,
})
const checkoutForm = reactive({
  borrower_name: '',
  borrower_note: '',
  quantity: 1,
  checkout_note: '',
})

const tool_category = [
  '工具',
  '電動工具',
  '音響',
  '照明',
  'その他',
]

const canManage = computed(() => auth.hasPermission('tool_rental.manage'))
const canCheckout = computed(() => auth.hasPermission('tool_rental.checkout'))
const canReturn = computed(() => auth.hasPermission('tool_rental.return'))
const canHistory = computed(() => auth.hasPermission('tool_rental.history'))
const activeTools = computed(() => tools.value.filter((tool) => tool.is_active))
const checkedOutCount = computed(() => activeLoans.value.reduce((sum, loan) => sum + loan.quantity, 0))
const filteredTools = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  if (!keyword) return tools.value
  return tools.value.filter((tool) =>
    [tool.name, tool.category, tool.description]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(keyword)),
  )
})

function formatDate(value: string) {
  return new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'))
    .toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

async function loadTools() {
  const response = await api.apiFetch<{ tools: ToolItem[] }>('/api/tool-rental')
  tools.value = response.tools
}

async function loadActiveLoans() {
  if (!canReturn.value) return
  const response = await api.apiFetch<{ loans: LoanItem[] }>('/api/tool-rental/active')
  activeLoans.value = response.loans
}

async function loadHistory() {
  if (!canHistory.value) return
  historyLoading.value = true
  try {
    const response = await api.apiFetch<{ loans: LoanItem[] }>('/api/tool-rental/history?limit=100')
    history.value = response.loans
  } catch (error) {
    console.error(error)
    errorMessage.value = '貸出履歴の読み込みに失敗しました。'
  } finally {
    historyLoading.value = false
  }
}

async function loadAll() {
  loading.value = true
  errorMessage.value = ''
  try {
    await Promise.all([loadTools(), loadActiveLoans(), loadHistory()])
  } catch (error) {
    console.error(error)
    errorMessage.value = '工具貸出情報の読み込みに失敗しました。権限と通信状態を確認してください。'
  } finally {
    loading.value = false
  }
}

function openToolDialog(tool?: ToolItem) {
  editingTool.value = tool ?? null
  toolForm.name = tool?.name ?? ''
  toolForm.category = tool?.category ?? ''
  toolForm.description = tool?.description ?? ''
  toolForm.total_quantity = tool?.total_quantity ?? 1
  toolForm.is_active = Boolean(tool?.is_active ?? true)
  formError.value = ''
  toolDialog.value = true
}

async function saveTool() {
  formError.value = ''
  if (!toolForm.name.trim() || !toolForm.category.trim() || !Number.isInteger(toolForm.total_quantity) || toolForm.total_quantity < 1) {
    formError.value = '工具名・カテゴリ・1以上の総数を入力してください。'
    return
  }
  saving.value = true
  try {
    const body = {
      name: toolForm.name,
      category: toolForm.category,
      description: toolForm.description,
      total_quantity: toolForm.total_quantity,
      is_active: toolForm.is_active,
    }
    if (editingTool.value) {
      await api.apiFetch(`/api/tool-rental/tools/${editingTool.value.id}`, { method: 'PATCH', body })
      successMessage.value = '工具情報を更新しました。'
    } else {
      await api.apiFetch('/api/tool-rental/tools', { method: 'POST', body })
      successMessage.value = '工具を登録しました。'
    }
    toolDialog.value = false
    await loadTools()
  } catch (error) {
    console.error(error)
    formError.value = '保存に失敗しました。貸出中の数量や入力内容を確認してください。'
  } finally {
    saving.value = false
  }
}

function openCheckoutDialog(tool: ToolItem) {
  selectedTool.value = tool
  checkoutForm.borrower_name = ''
  checkoutForm.borrower_note = ''
  checkoutForm.quantity = 1
  checkoutForm.checkout_note = ''
  formError.value = ''
  checkoutDialog.value = true
}

async function submitCheckout() {
  formError.value = ''
  if (!selectedTool.value || !checkoutForm.borrower_name.trim() ||
      !Number.isInteger(checkoutForm.quantity) || checkoutForm.quantity < 1) {
    formError.value = '借用者名と1以上の数量を入力してください。'
    return
  }
  saving.value = true
  try {
    await api.apiFetch('/api/tool-rental/checkout', {
      method: 'POST',
      body: { ...checkoutForm, tool_id: selectedTool.value.id },
    })
    checkoutDialog.value = false
    successMessage.value = '貸出を記録しました。'
    await loadAll()
  } catch (error) {
    console.error(error)
    formError.value = '貸出に失敗しました。貸出可能数を再確認してください。'
  } finally {
    saving.value = false
  }
}

async function returnLoan(loan: LoanItem) {
  if (returningLoanId.value) return
  if (!window.confirm(`「${loan.tool_name}」${loan.quantity}個を返却済みにしますか？`)) return
  returningLoanId.value = loan.id
  try {
    await api.apiFetch(`/api/tool-rental/loans/${loan.id}/return`, {
      method: 'POST',
      body: {},
    })
    successMessage.value = '返却を記録しました。'
    await loadAll()
  } catch (error) {
    console.error(error)
    errorMessage.value = '返却処理に失敗しました。最新の貸出状況を確認してください。'
  } finally {
    returningLoanId.value = ''
  }
}

onMounted(loadAll)
</script>

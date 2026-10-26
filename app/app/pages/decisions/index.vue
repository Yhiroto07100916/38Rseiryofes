<template>
  <v-container fluid class="pa-4 pa-sm-6">
    <div class="d-flex align-center mb-6">
      <LayoutBackButton />
      <div>
        <h1 class="text-h5 font-weight-bold">意思決定記録</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          38Rで決定した内容や、その理由・経緯を記録します
        </p>
      </div>
      <v-spacer />
      <v-btn
        icon="mdi-refresh"
        variant="text"
        aria-label="更新"
        :loading="loading"
        @click="loadDecisions"
      />
    </div>


    <template v-if="auth.hasPermission('decisions.view')">
      <div class="d-flex align-center mb-3 ga-2">
        <div class="text-subtitle-1 font-weight-bold">記録一覧</div>
        <v-chip size="small" variant="tonal">{{ decisions.length }}件</v-chip>
        <v-spacer />
        <v-btn
          v-if="auth.hasPermission('decisions.create')"
          color="primary"
          prepend-icon="mdi-plus"
          @click="openCreate"
        >
          新規登録
        </v-btn>
      </div>

      <div v-if="loading">
        <v-skeleton-loader
          v-for="n in 3"
          :key="n"
          type="article"
          class="mb-3"
        />
      </div>

      <v-card
        v-else-if="decisions.length === 0"
        variant="outlined"
        rounded="xl"
      >
        <v-card-text class="text-center py-10">
          <v-icon icon="mdi-notebook-check-outline" size="48" class="mb-3" />
          <div class="text-h6 font-weight-bold">記録はまだありません</div>
          <p class="text-body-2 text-medium-emphasis mt-2">
            クラスで決まったことを記録して、あとから確認できるようにしましょう。
          </p>
        </v-card-text>
      </v-card>

      <v-card
        v-for="item in decisions"
        :key="item.id"
        variant="outlined"
        rounded="xl"
        class="mb-3"
      >
        <v-card-text class="pa-4">
          <div class="d-flex align-start ga-3">
            <div class="flex-grow-1 min-width-0">
              <div class="d-flex flex-wrap align-center ga-2 mb-2">
                <v-chip size="small" color="primary" variant="tonal">
                  {{ formatDate(item.decided_at) }}
                </v-chip>
                <span
                  v-if="item.meeting_name"
                  class="text-body-2 text-medium-emphasis"
                >
                  {{ item.meeting_name }}
                </span>
              </div>
              <div class="text-subtitle-1 font-weight-bold">
                {{ item.title }}
              </div>
              <p class="text-body-2 mt-2 preview-text">
                {{ item.content }}
              </p>
              <div
                v-if="item.decision_maker"
                class="text-caption text-medium-emphasis mt-3"
              >
                決定者：{{ item.decision_maker }}
              </div>
            </div>
            <v-icon icon="mdi-notebook-check-outline" color="primary" size="28" />
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-4">
          <v-btn
            variant="text"
            color="primary"
            prepend-icon="mdi-eye-outline"
            @click="openDetail(item.id)"
          >
            詳細・履歴
          </v-btn>
          <v-spacer />
          <v-btn
            v-if="auth.hasPermission('decisions.edit')"
            icon="mdi-pencil-outline"
            variant="text"
            aria-label="編集"
            @click="openEdit(item)"
          />
          <v-btn
            v-if="auth.hasPermission('decisions.delete')"
            icon="mdi-delete-outline"
            variant="text"
            color="error"
            aria-label="削除"
            @click="deleteDecision(item)"
          />
        </v-card-actions>
      </v-card>
    </template>

    <v-card v-else variant="outlined" rounded="xl">
      <v-card-text class="text-center py-10">
        <v-icon icon="mdi-lock-outline" size="48" class="mb-3" />
        <div class="text-h6 font-weight-bold">閲覧権限がありません</div>
        <p class="text-body-2 text-medium-emphasis mt-2">
          意思決定記録を閲覧する権限がありません。
        </p>
      </v-card-text>
    </v-card>

    <v-dialog v-model="formDialog" max-width="720" persistent scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-5">
          {{ editingId ? '意思決定記録を編集' : '意思決定記録を新規登録' }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-5">
          <v-form @submit.prevent="saveDecision">
            <v-text-field
              v-model="form.title"
              label="タイトル"
              maxlength="200"
              counter="200"
              required
              variant="outlined"
              class="mb-2"
            />
            <v-textarea
              v-model="form.content"
              label="決定内容"
              required
              maxlength="20000"
              counter
              rows="5"
              variant="outlined"
              class="mb-2"
            />
            <v-textarea
              v-model="form.rationale"
              label="決定理由・背景（任意）"
              rows="3"
              variant="outlined"
              class="mb-2"
            />
            <CommonJstDateTimePicker v-model="form.decided_at" label="決定日時" class="mb-2" :required="true" />
            <v-text-field
              v-model="form.decision_maker"
              label="決定者（任意）"
              variant="outlined"
              class="mb-2"
            />
            <v-text-field
              v-model="form.meeting_name"
              label="会議名（任意）"
              variant="outlined"
              class="mb-2"
            />
            <v-select
              v-model="form.survey_id"
              label="関連アンケート（任意）"
              :items="surveys"
              item-title="title"
              item-value="id"
              clearable
              hint="関連付けるアンケートを選択します"
              persistent-hint
              variant="outlined"
            />
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="formDialog = false">
            キャンセル
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!form.title.trim() || !form.content.trim() || !form.decided_at"
            @click="saveDecision"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="detailDialog" max-width="800" scrollable>
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center pa-5">
          <span>意思決定記録の詳細</span>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            aria-label="閉じる"
            @click="detailDialog = false"
          />
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-5">
          <div v-if="detailLoading" class="py-6">
            <v-progress-linear indeterminate />
          </div>
          <template v-else-if="detail">
            <div class="text-h6 font-weight-bold">{{ detail.decision.title }}</div>
            <div class="text-body-2 text-medium-emphasis mt-2">
              決定日時：{{ formatDateTime(detail.decision.decided_at) }}
            </div>
            <div v-if="detail.decision.meeting_name" class="mt-2">
              会議名：{{ detail.decision.meeting_name }}
            </div>
            <div v-if="detail.decision.decision_maker" class="mt-1">
              決定者：{{ detail.decision.decision_maker }}
            </div>

            <template v-if="detail.decision.survey_id">
              <v-divider class="my-5" />
              <div class="text-subtitle-1 font-weight-bold mb-2">
                関連投票・アンケート
              </div>
              <div class="text-body-1 mb-3">
                {{
                  surveys.find(survey => survey.id === detail?.decision.survey_id)?.title
                    || "関連付けられた投票"
                }}
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-btn
                  v-if="auth.hasPermission('surveys.view')"
                  variant="tonal"
                  prepend-icon="mdi-eye-outline"
                  @click="navigateTo({
                    path: '/surveys',
                    query: { open: detail.decision.survey_id },
                  })"
                >
                  投票の詳細を開く
                </v-btn>
                <v-btn
                  v-if="auth.hasPermission('surveys.results.view')"
                  variant="tonal"
                  prepend-icon="mdi-chart-bar"
                  @click="navigateTo({
                    path: '/surveys',
                    query: { results: detail.decision.survey_id },
                  })"
                >
                  集計結果を開く
                </v-btn>
              </div>
            </template>

            <v-divider class="my-5" />
            <div class="text-subtitle-1 font-weight-bold mb-2">決定内容</div>
            <p class="detail-text">{{ detail.decision.content }}</p>

            <template v-if="detail.decision.rationale">
              <div class="text-subtitle-1 font-weight-bold mt-5 mb-2">
                決定理由・背景
              </div>
              <p class="detail-text">{{ detail.decision.rationale }}</p>
            </template>

            <template v-if="detail.tasks.length">
              <v-divider class="my-5" />
              <div class="text-subtitle-1 font-weight-bold mb-2">関連タスク</div>
              <v-list density="compact">
                <v-list-item
                  v-for="task in detail.tasks"
                  :key="task.id"
                  :title="task.title"
                  :subtitle="task.due_at ? `期限：${formatDate(task.due_at)}` : undefined"
                >
                  <template #append>
                    <v-chip size="small" variant="tonal">
                      {{ task.status }}
                    </v-chip>
                  </template>
                </v-list-item>
              </v-list>
            </template>

            <template v-if="detail.files.length">
              <v-divider class="my-5" />
              <div class="text-subtitle-1 font-weight-bold mb-2">関連資料</div>
              <v-list density="compact">
                <v-list-item
                  v-for="file in detail.files"
                  :key="file.id"
                  :title="file.original_name"
                  :subtitle="file.category || file.content_type"
                >
                  <template #prepend>
                    <v-icon icon="mdi-file-document-outline" />
                  </template>
                </v-list-item>
              </v-list>
            </template>

            <v-divider class="my-5" />
            <div class="text-subtitle-1 font-weight-bold mb-3">変更履歴</div>
            <v-alert
              v-if="detail.history.length === 0"
              type="info"
              variant="tonal"
              density="compact"
            >
              変更履歴はありません。
            </v-alert>
            <v-timeline v-else density="compact" side="end">
              <v-timeline-item
                v-for="entry in detail.history"
                :key="entry.id"
                :dot-color="historyColor(entry.action)"
                size="small"
              >
                <div class="text-subtitle-2 font-weight-bold">
                  {{ historyLabel(entry.action) }}
                </div>
                <div class="text-body-2">
                  {{ entry.actor_name || '不明なユーザー' }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatDateTime(entry.created_at) }}
                </div>
              </v-timeline-item>
            </v-timeline>
          </template>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="detailDialog = false">閉じる</v-btn>
          <v-btn
            v-if="detail && auth.hasPermission('decisions.edit')"
            color="primary"
            prepend-icon="mdi-pencil-outline"
            @click="editFromDetail"
          >
            編集
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { formatJstDateTimeLocal, jstDateTimeLocalToIso } from '~/utils/jst'
import { onMounted, ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { useSnackbar } from '~/composables/useSnackbar'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  middleware: 'auth',
})

interface SurveyChoice {
  id: string
  title: string
  status: string
}

interface Decision {
  id: string
  title: string
  content: string
  rationale: string | null
  decided_at: string
  decision_maker: string | null
  meeting_name: string | null
  survey_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface DecisionTask {
  id: string
  title: string
  status: string
  due_at: string | null
}

interface DecisionFile {
  id: string
  original_name: string
  content_type: string
  size: number
  category: string | null
}

interface DecisionHistory {
  id: string
  action: string
  before_data: string | null
  after_data: string | null
  created_at: string
  actor_id: string
  actor_name: string | null
}

interface DecisionDetail {
  decision: Decision
  tasks: DecisionTask[]
  files: DecisionFile[]
  history: DecisionHistory[]
}

interface DecisionForm {
  title: string
  content: string
  rationale: string
  decided_at: string
  decision_maker: string
  meeting_name: string
  survey_id: string
}

const auth = useAuthStore()
const { apiFetch } = useApi()
const snackbar = useSnackbar()

const decisions = ref<Decision[]>([])
const surveys = ref<SurveyChoice[]>([])
const loading = ref(false)
const saving = ref(false)
const detailLoading = ref(false)
const formDialog = ref(false)
const detailDialog = ref(false)
const editingId = ref<string | null>(null)
const detail = ref<DecisionDetail | null>(null)

const emptyForm = (): DecisionForm => ({
  title: '',
  content: '',
  rationale: '',
  decided_at: toLocalDateTime(new Date().toISOString()),
  decision_maker: '',
  meeting_name: '',
  survey_id: '',
})

const form = ref<DecisionForm>(emptyForm())

function toLocalDateTime(value: string): string {
  try {
    return formatJstDateTimeLocal(value)
  } catch {
    return ''
  }
}

function formatDate(value: string | null): string {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

function formatDateTime(value: string | null): string {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function showMessage(text: string, type: 'success' | 'error' | 'info' = 'info') {
  if (type === 'success') snackbar.success(text)
  else if (type === 'error') snackbar.error(text)
  else snackbar.info(text)
}

async function loadDecisions() {
  if (!auth.hasPermission('decisions.view')) return
  loading.value = true
  try {
    const response = await apiFetch<{ decisions: Decision[] }>('/api/decisions')
    decisions.value = response.decisions
  } catch (error) {
    console.error('Failed to load decisions:', error)
    showMessage('意思決定記録の読み込みに失敗しました。', 'error')
  } finally {
    loading.value = false
  }
}

async function loadSurveys() {
  if (!auth.hasPermission('surveys.view')) return
  try {
    const response = await apiFetch<{ surveys: SurveyChoice[] }>('/api/surveys')
    surveys.value = response.surveys
  } catch (error) {
    console.error('Failed to load surveys:', error)
    showMessage('関連アンケート一覧の読み込みに失敗しました。', 'error')
  }
}

function openCreate() {
  editingId.value = null
  form.value = emptyForm()
  formDialog.value = true
}

function openEdit(item: Decision) {
  editingId.value = item.id
  form.value = {
    title: item.title,
    content: item.content,
    rationale: item.rationale ?? '',
    decided_at: toLocalDateTime(item.decided_at),
    decision_maker: item.decision_maker ?? '',
    meeting_name: item.meeting_name ?? '',
    survey_id: item.survey_id ?? '',
  }
  if (item.survey_id && !surveys.value.some(survey => survey.id === item.survey_id)) {
    surveys.value.push({
      id: item.survey_id,
      title: '既存の関連アンケート（一覧取得不可）',
      status: 'unknown',
    })
  }
  formDialog.value = true
}

async function saveDecision() {
  if (saving.value) return
  if (!form.value.title.trim() || !form.value.content.trim() || !form.value.decided_at) {
    showMessage('タイトル・決定内容・決定日時を入力してください。', 'error')
    return
  }

  let decidedAt: string
  try {
    decidedAt = jstDateTimeLocalToIso(form.value.decided_at)
  } catch {
    showMessage('決定日時が正しくありません。', 'error')
    return
  }

  saving.value = true
  const payload = {
    title: form.value.title.trim(),
    content: form.value.content.trim(),
    rationale: form.value.rationale.trim() || null,
    decided_at: decidedAt,
    decision_maker: form.value.decision_maker.trim() || null,
    meeting_name: form.value.meeting_name.trim() || null,
    survey_id: form.value.survey_id.trim() || null,
  }

  try {
    if (editingId.value) {
      await apiFetch(`/api/decisions/${editingId.value}`, {
        method: 'PATCH',
        body: payload,
      })
      showMessage('意思決定記録を更新しました。', 'success')
    } else {
      await apiFetch('/api/decisions', {
        method: 'POST',
        body: payload,
      })
      showMessage('意思決定記録を登録しました。', 'success')
    }
    formDialog.value = false
    await loadDecisions()
    if (detailDialog.value && editingId.value) {
      await openDetail(editingId.value)
    }
  } catch (error) {
    console.error('Failed to save decision:', error)
    showMessage('保存に失敗しました。入力内容と操作権限を確認してください。', 'error')
  } finally {
    saving.value = false
  }
}

async function openDetail(id: string) {
  detailDialog.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await apiFetch<DecisionDetail>(`/api/decisions/${id}`)
  } catch (error) {
    console.error('Failed to load decision detail:', error)
    showMessage('詳細の読み込みに失敗しました。', 'error')
    detailDialog.value = false
  } finally {
    detailLoading.value = false
  }
}

async function editFromDetail() {
  if (!detail.value) return
  const item = detail.value.decision
  detailDialog.value = false
  openEdit(item)
}

async function deleteDecision(item: Decision) {
  if (!window.confirm(`「${item.title}」を削除しますか？\nこの操作は取り消せません。`)) return

  try {
    await apiFetch(`/api/decisions/${item.id}`, { method: 'DELETE' })
    showMessage('意思決定記録を削除しました。', 'success')
    if (detail.value?.decision.id === item.id) {
      detailDialog.value = false
    }
    await loadDecisions()
  } catch (error) {
    console.error('Failed to delete decision:', error)
    showMessage('削除に失敗しました。操作権限を確認してください。', 'error')
  }
}

function historyLabel(action: string): string {
  switch (action) {
    case 'created': return '記録を作成'
    case 'updated': return '記録を更新'
    case 'deleted': return '記録を削除'
    default: return action
  }
}

function historyColor(action: string): string {
  switch (action) {
    case 'created': return 'success'
    case 'updated': return 'primary'
    case 'deleted': return 'error'
    default: return 'grey'
  }
}

onMounted(() => {
  void loadDecisions()
  void loadSurveys()
})
</script>

<style scoped>
.preview-text {
  white-space: pre-line;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.8;
}

.min-width-0 {
  min-width: 0;
}
</style>

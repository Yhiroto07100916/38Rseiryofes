
<template>
  <v-container fluid class="pa-4 pa-sm-6 survey-page">
    <div class="d-flex align-center mb-6">
      <LayoutBackButton />
      <div class="ml-2">
        <h1 class="text-h5 font-weight-bold">アンケート・投票</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          38Rのアンケートや投票を管理できます
        </p>
      </div>
      <v-spacer />
      <v-btn
        icon="mdi-refresh"
        variant="text"
        aria-label="再読み込み"
        :loading="loading"
        @click="loadSurveys"
      />
    </div>



    <div class="d-flex align-center mb-4">
      <div class="text-subtitle-1 font-weight-bold">
        投票一覧
      </div>
      <v-chip class="ml-2" size="small" variant="tonal">
        {{ surveys.length }}件
      </v-chip>
      <v-spacer />
      <v-btn
        v-if="auth.hasPermission('surveys.create')"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        新規作成
      </v-btn>
    </div>

    <v-progress-linear
      v-if="loading"
      indeterminate
      color="primary"
      class="mb-4"
    />

    <v-card
      v-if="!loading && surveys.length === 0"
      variant="outlined"
      rounded="xl"
    >
      <v-card-text class="text-center py-10">
        <v-icon icon="mdi-vote-outline" size="48" class="mb-3" />
        <div class="text-h6 font-weight-bold">投票はありません</div>
        <p class="text-body-2 text-medium-emphasis mt-2">
          公開された投票や、作成した投票がここに表示されます。
        </p>
      </v-card-text>
    </v-card>

    <v-row v-else>
      <v-col
        v-for="survey in surveys"
        :key="survey.id"
        cols="12"
        md="6"
        xl="4"
      >
        <v-card rounded="xl" variant="outlined" class="survey-card">
          <v-card-item>
            <template #prepend>
              <v-avatar color="primary" variant="tonal" rounded="lg">
                <v-icon icon="mdi-vote-outline" />
              </v-avatar>
            </template>
            <template #append>
              <v-chip
                size="small"
                :color="statusColor(survey.status)"
                variant="tonal"
              >
                {{ statusLabel(survey.status) }}
              </v-chip>
            </template>
            <v-card-title class="text-wrap">
              {{ survey.title }}
            </v-card-title>
            <v-card-subtitle>
              {{ responseTypeLabel(survey.response_type) }}
              <span v-if="survey.is_anonymous">・匿名</span>
              <span v-else>・記名</span>
            </v-card-subtitle>
          </v-card-item>

          <v-card-text>
            <p class="survey-description">
              {{ survey.description || '説明はありません。' }}
            </p>
            <div class="text-body-2 text-medium-emphasis mt-4">
              <div>
                <v-icon icon="mdi-account-multiple-outline" size="small" />
                回答数：{{ survey.response_count ?? 0 }}件
              </div>
              <div v-if="survey.starts_at" class="mt-2">
                <v-icon icon="mdi-calendar-start" size="small" />
                開始：{{ formatDate(survey.starts_at) }}
              </div>
              <div v-if="survey.deadline_at" class="mt-2">
                <v-icon icon="mdi-calendar-clock" size="small" />
                締切：{{ formatDate(survey.deadline_at) }}
              </div>
            </div>
          </v-card-text>

          <v-divider />

          <v-card-actions class="flex-wrap pa-3">
            <v-btn
              v-if="auth.hasPermission('surveys.view')"
              variant="tonal"
              prepend-icon="mdi-eye-outline"
              @click="openSurvey(survey.id)"
            >
              詳細・回答
            </v-btn>
            <v-spacer />
            <v-btn
              v-if="auth.hasPermission('surveys.results.view')"
              icon="mdi-chart-bar"
              variant="text"
              aria-label="集計結果"
              @click="openResults(survey.id)"
            />
            <v-btn
              v-if="auth.hasPermission('surveys.edit')"
              icon="mdi-pencil-outline"
              variant="text"
              aria-label="編集"
              @click="openEdit(survey.id)"
            />
            <v-btn
              v-if="auth.hasPermission('surveys.delete')"
              icon="mdi-delete-outline"
              variant="text"
              color="error"
              aria-label="削除"
              @click="confirmDelete(survey)"
            />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="formDialog" max-width="680" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-5">
          {{ editingId ? '投票を編集' : '投票を作成' }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-5">
          <v-form ref="formRef" @submit.prevent="saveSurvey">
            <v-text-field
              v-model="form.title"
              label="タイトル"
              placeholder="例：クラスTシャツのデザイン"
              :rules="[rules.required, rules.title]"
              maxlength="200"
              counter
              required
            />

            <v-textarea
              v-model="form.description"
              label="説明"
              placeholder="投票の目的や補足事項"
              rows="3"
              auto-grow
            />

            <v-select
              v-model="form.response_type"
              label="回答形式"
              :items="responseTypeItems"
              item-title="title"
              item-value="value"
              :disabled="Boolean(editingId && existingResponseCount > 0)"
            />

            <template v-if="form.response_type !== 'free_text'">
              <div class="text-subtitle-2 font-weight-bold mb-2">
                選択肢
              </div>
              <div
                v-for="(option, index) in form.options"
                :key="index"
                class="d-flex align-center ga-2"
              >
                <v-text-field
                  v-model="form.options[index]"
                  :label="`選択肢 ${index + 1}`"
                  :disabled="Boolean(editingId && existingResponseCount > 0 && index < originalOptionCount)"
                  maxlength="200"
                  :rules="[rules.required]"
                />
                <v-btn
                  icon="mdi-close"
                  variant="text"
                  aria-label="選択肢を削除"
                  :disabled="form.options.length <= 2 || Boolean(editingId && existingResponseCount > 0 && index < originalOptionCount)"
                  @click="removeOption(index)"
                />
              </div>
              <v-btn
                variant="text"
                prepend-icon="mdi-plus"
                @click="form.options.push('')"
              >
                選択肢を追加
              </v-btn>
            </template>

            <v-switch
              v-model="form.is_anonymous"
              label="匿名投票にする"
              color="primary"
              hide-details
              class="mt-3"
            />

            <v-select
              v-model="form.status"
              label="公開状態"
              :items="statusItems"
              item-title="title"
              item-value="value"
              class="mt-4"
            />

            <v-text-field
              v-model="form.starts_at"
              label="開始日時（任意）"
              type="datetime-local"
              clearable
              class="mt-2"
            />

            <v-text-field
              v-model="form.deadline_at"
              label="回答締切（任意）"
              type="datetime-local"
              clearable
            />

            <v-alert
              v-if="editingId && existingResponseCount > 0"
              type="info"
              variant="tonal"
              density="compact"
              class="mt-2"
            >
              回答済みの人がいるため、回答形式と既存の選択肢は変更・削除できません。新しい選択肢は末尾に追加できます。
            </v-alert>
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="formDialog = false">
            キャンセル
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            @click="saveSurvey"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="detailDialog" max-width="680" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-5">
          {{ selectedSurvey?.title || '投票詳細' }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-5">
          <template v-if="selectedSurvey">
            <p class="text-body-1 mb-4">
              {{ selectedSurvey.description || '説明はありません。' }}
            </p>
            <v-chip
              size="small"
              :color="statusColor(selectedSurvey.status)"
              variant="tonal"
              class="mb-4"
            >
              {{ statusLabel(selectedSurvey.status) }}
            </v-chip>

            <template v-if="selectedSurvey.has_responded && !selectedSurvey.response_editable">
              <v-alert type="info" variant="tonal">
                回答済みです。この過去の回答は編集用データと紐付いていないため、変更できません。
              </v-alert>
            </template>
            <template v-else-if="!canRespond(selectedSurvey)">
              <v-alert type="info" variant="tonal">
                現在、この投票には回答できません。
              </v-alert>
            </template>
            <template v-else-if="auth.hasPermission('surveys.respond')">
              <v-radio-group
                v-if="selectedSurvey.response_type === 'single_choice'"
                v-model="singleAnswer"
                label="回答を選択"
              >
                <v-radio
                  v-for="option in selectedSurvey.options"
                  :key="option.id"
                  :label="option.label"
                  :value="option.id"
                />
              </v-radio-group>

              <div v-else-if="selectedSurvey.response_type === 'multiple_choice'">
                <div class="text-subtitle-2 mb-2">回答を選択（複数可）</div>
                <v-checkbox
                  v-for="option in selectedSurvey.options"
                  :key="option.id"
                  v-model="multipleAnswers"
                  :label="option.label"
                  :value="option.id"
                  hide-details
                  density="comfortable"
                />
              </div>

              <v-textarea
                v-else
                v-model="textAnswer"
                label="回答"
                rows="4"
                maxlength="10000"
                counter
                auto-grow
              />
            </template>
          </template>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="detailDialog = false">
            閉じる
          </v-btn>
          <v-btn
            v-if="selectedSurvey && auth.hasPermission('surveys.respond') && (!selectedSurvey.has_responded || selectedSurvey.response_editable) && canRespond(selectedSurvey)"
            color="primary"
            :loading="saving"
            @click="submitResponse"
          >
            {{ selectedSurvey?.has_responded ? '回答を更新' : '回答を送信' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="resultsDialog" max-width="680" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-5">集計結果</v-card-title>
        <v-divider />
        <v-card-text class="pa-5">
          <template v-if="results">
            <div class="text-h6 font-weight-bold mb-2">
              {{ results.survey.title }}
            </div>
            <div class="text-body-2 text-medium-emphasis mb-5">
              回答数：{{ results.response_count }}件
            </div>

            <template v-if="results.survey.response_type === 'free_text'">
              <div
                v-if="results.text_answers.length === 0"
                class="text-body-2 text-medium-emphasis"
              >
                自由記述の回答はありません。
              </div>
              <v-card
                v-for="(answer, index) in results.text_answers"
                :key="index"
                variant="outlined"
                rounded="lg"
                class="mb-2"
              >
                <v-card-text class="text-body-2">
                  {{ answer }}
                </v-card-text>
              </v-card>
            </template>

            <template v-else>
              <div v-for="option in results.options" :key="option.id" class="mb-5">
                <div class="d-flex justify-space-between mb-1">
                  <span>{{ option.label }}</span>
                  <span class="text-medium-emphasis">
                    {{ option.count }}票
                  </span>
                </div>
                <v-progress-linear
                  :model-value="results.response_count ? option.count / results.response_count * 100 : 0"
                  height="10"
                  rounded
                  color="primary"
                />
                <div
                  v-if="!results.survey.is_anonymous && option.voters?.length"
                  class="d-flex flex-wrap ga-2 mt-2"
                >
                  <v-chip
                    v-for="voter in option.voters"
                    :key="voter + option.id"
                    size="small"
                    variant="tonal"
                    prepend-icon="mdi-account-outline"
                  >
                    {{ voter }}
                  </v-chip>
                </div>
                <div
                  v-else-if="!results.survey.is_anonymous"
                  class="text-caption text-medium-emphasis mt-2"
                >
                  投票者情報はありません。
                </div>
              </div>
              <p class="text-caption text-medium-emphasis">
                複数選択の場合、各選択肢の票数の合計は回答者数と一致しないことがあります。
              </p>
            </template>
          </template>
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="resultsDialog = false">
            閉じる
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="420">
      <v-card rounded="xl">
        <v-card-title>投票を削除</v-card-title>
        <v-card-text>
          「{{ deletingSurvey?.title }}」を削除しますか？
          この操作は取り消せません。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">
            キャンセル
          </v-btn>
          <v-btn color="error" :loading="saving" @click="deleteSurvey">
            削除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { formatJstDateTimeLocal, jstDateTimeLocalToIso } from '~/utils/jst'
import { computed, onMounted, reactive, ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'
import { useSnackbar } from '~/composables/useSnackbar'

definePageMeta({
  middleware: ['auth'],
})

type ResponseType = 'single_choice' | 'multiple_choice' | 'free_text'
type SurveyStatus = 'draft' | 'published' | 'closed'

interface Survey {
  id: string
  title: string
  description: string | null
  response_type: ResponseType
  is_anonymous: number
  status: SurveyStatus
  starts_at: string | null
  deadline_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  response_count?: number
}

interface SurveyOption {
  id: string
  survey_id: string
  label: string
  sort_order: number
}

interface SurveyDetail extends Survey {
  options: SurveyOption[]
  has_responded: boolean
  response_editable: boolean
  my_response: {
    text_answer: string | null
    option_ids: string[]
  } | null
}

interface SurveyResults {
  survey: {
    id: string
    title: string
    response_type: ResponseType
    is_anonymous: number
  }
  response_count: number
  options: Array<{
    id: string
    label: string
    sort_order: number
    count: number
    voters?: string[]
  }>
  text_answers: string[]
}

const auth = useAuthStore()
const { apiFetch } = useApi()
const snackbar = useSnackbar()
const route = useRoute()

const surveys = ref<Survey[]>([])
const loading = ref(false)
const saving = ref(false)

const formDialog = ref(false)
const detailDialog = ref(false)
const resultsDialog = ref(false)
const deleteDialog = ref(false)

const editingId = ref<string | null>(null)
const existingResponseCount = ref(0)
const originalOptionCount = ref(0)
const selectedSurvey = ref<SurveyDetail | null>(null)
const deletingSurvey = ref<Survey | null>(null)
const results = ref<SurveyResults | null>(null)

const singleAnswer = ref('')
const multipleAnswers = ref<string[]>([])
const textAnswer = ref('')

const formRef = ref()

const blankForm = () => ({
  title: '',
  description: '',
  response_type: 'single_choice' as ResponseType,
  options: ['', ''],
  is_anonymous: false,
  status: 'draft' as SurveyStatus,
  starts_at: '',
  deadline_at: '',
})

const form = reactive(blankForm())

const responseTypeItems = [
  { title: '単一選択', value: 'single_choice' },
  { title: '複数選択', value: 'multiple_choice' },
  { title: '自由記述', value: 'free_text' },
]

const statusItems = [
  { title: '下書き', value: 'draft' },
  { title: '公開', value: 'published' },
  { title: '終了', value: 'closed' },
]

const rules = {
  required: (value: string) => Boolean(value?.trim()) || '入力してください。',
  title: (value: string) => value.trim().length <= 200 || '200文字以内で入力してください。',
}

const canManage = computed(() =>
  auth.hasPermission('surveys.create') ||
  auth.hasPermission('surveys.edit') ||
  auth.hasPermission('surveys.delete'),
)

function statusLabel(status: SurveyStatus) {
  return {
    draft: '下書き',
    published: '公開中',
    closed: '終了',
  }[status]
}

function statusColor(status: SurveyStatus) {
  return {
    draft: 'grey',
    published: 'success',
    closed: 'info',
  }[status]
}

function responseTypeLabel(type: ResponseType) {
  return {
    single_choice: '単一選択',
    multiple_choice: '複数選択',
    free_text: '自由記述',
  }[type]
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function toLocalInput(value: string | null) {
  if (!value) return ''
  try {
    return formatJstDateTimeLocal(value)
  } catch {
    return ''
  }
}

function toIso(value: string) {
  return value ? jstDateTimeLocalToIso(value) : null
}

function canRespond(survey: Survey) {
  const now = Date.now()
  if (survey.status !== 'published') return false
  if (survey.starts_at && Date.parse(survey.starts_at) > now) return false
  if (survey.deadline_at && Date.parse(survey.deadline_at) < now) return false
  return true
}

function showError(error: unknown) {
  const value = error as { data?: { error?: string }; message?: string }
  snackbar.error(
    value?.data?.error ||
    value?.message ||
    '処理に失敗しました。時間をおいて再度お試しください。',
  )
}

async function loadSurveys() {
  loading.value = true
  try {
    const response = await apiFetch<{ surveys: Survey[] }>('/api/surveys')
    surveys.value = response.surveys
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
}

function resetForm() {
  Object.assign(form, blankForm())
  editingId.value = null
  existingResponseCount.value = 0
  originalOptionCount.value = 0
}

function openCreate() {
  resetForm()
  formDialog.value = true
}

function removeOption(index: number) {
  if (form.options.length > 2) form.options.splice(index, 1)
}

async function openEdit(id: string) {
  try {
    const response = await apiFetch<{
      survey: Survey
      options: SurveyOption[]
    }>(`/api/surveys/${id}`)

    resetForm()
    editingId.value = id
    existingResponseCount.value = surveys.value.find(item => item.id === id)?.response_count ?? 0

    form.title = response.survey.title
    form.description = response.survey.description || ''
    form.response_type = response.survey.response_type
    form.options = response.options.map(option => option.label)
    originalOptionCount.value = response.options.length
    if (form.response_type !== 'free_text' && form.options.length < 2) {
      form.options = ['', '']
    }
    form.is_anonymous = Boolean(response.survey.is_anonymous)
    form.status = response.survey.status
    form.starts_at = toLocalInput(response.survey.starts_at)
    form.deadline_at = toLocalInput(response.survey.deadline_at)
    formDialog.value = true
  } catch (error) {
    showError(error)
  }
}

async function saveSurvey() {

  const validation = await formRef.value?.validate()
  if (validation && !validation.valid) return

  if (
    form.response_type !== 'free_text' &&
    (form.options.length < 2 || form.options.some(option => !option.trim()))
  ) {
    snackbar.error('選択肢を2つ以上入力してください。')
    return
  }

  if (
    form.response_type !== 'free_text' &&
    new Set(form.options.map(option => option.trim())).size !== form.options.length
  ) {
    snackbar.error('選択肢が重複しています。')
    return
  }

  const startsAt = toIso(form.starts_at)
  const deadlineAt = toIso(form.deadline_at)

  if (startsAt && deadlineAt && Date.parse(startsAt) > Date.parse(deadlineAt)) {
    snackbar.error('開始日時は締切日時より前に設定してください。')
    return
  }

  const payload = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    response_type: form.response_type,
    is_anonymous: form.is_anonymous,
    status: form.status,
    starts_at: startsAt,
    deadline_at: deadlineAt,
    options: form.response_type === 'free_text'
      ? []
      : form.options.map(option => option.trim()),
  }

  saving.value = true
  try {
    if (editingId.value) {
      await apiFetch(`/api/surveys/${editingId.value}`, {
        method: 'PATCH',
        body: payload,
      })
      snackbar.success('投票を更新しました。')
    } else {
      await apiFetch('/api/surveys', {
        method: 'POST',
        body: payload,
      })
      snackbar.success('投票を作成しました。')
    }
    formDialog.value = false
    await loadSurveys()
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

async function openSurvey(id: string) {
  singleAnswer.value = ''
  multipleAnswers.value = []
  textAnswer.value = ''

  try {
    const response = await apiFetch<{
      survey: Survey
      options: SurveyOption[]
      has_responded: boolean
      response_editable: boolean
      my_response: { text_answer: string | null; option_ids: string[] } | null
    }>(`/api/surveys/${id}`)

    selectedSurvey.value = {
      ...response.survey,
      options: response.options,
      has_responded: response.has_responded,
      response_editable: response.response_editable,
      my_response: response.my_response,
    }

    singleAnswer.value = response.my_response?.option_ids[0] ?? ''
    multipleAnswers.value = response.my_response?.option_ids ?? []
    textAnswer.value = response.my_response?.text_answer ?? ''
    detailDialog.value = true
  } catch (error) {
    showError(error)
  }
}

async function submitResponse() {
  if (!selectedSurvey.value) return

  const survey = selectedSurvey.value
  const payload: { text_answer?: string; option_ids?: string[] } = {}

  if (survey.response_type === 'free_text') {
    if (!textAnswer.value.trim()) {
      snackbar.error('回答を入力してください。')
      return
    }
    payload.text_answer = textAnswer.value.trim()
  } else if (survey.response_type === 'single_choice') {
    if (!singleAnswer.value) {
      snackbar.error('選択肢を選んでください。')
      return
    }
    payload.option_ids = [singleAnswer.value]
  } else {
    if (multipleAnswers.value.length === 0) {
      snackbar.error('選択肢を1つ以上選んでください。')
      return
    }
    payload.option_ids = multipleAnswers.value
  }

  saving.value = true
  try {
    const editingResponse = survey.has_responded && survey.response_editable
    await apiFetch(`/api/surveys/${survey.id}/responses`, {
      method: editingResponse ? 'PATCH' : 'POST',
      body: payload,
    })
    survey.has_responded = true
    survey.response_editable = true
    snackbar.success(editingResponse ? '回答を更新しました。' : '回答を送信しました。')
    detailDialog.value = false
    await loadSurveys()
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

async function openResults(id: string) {
  try {
    results.value = await apiFetch<SurveyResults>(`/api/surveys/${id}/results`)
    resultsDialog.value = true
  } catch (error) {
    showError(error)
  }
}

function confirmDelete(survey: Survey) {
  deletingSurvey.value = survey
  deleteDialog.value = true
}

async function deleteSurvey() {
  if (!deletingSurvey.value) return

  saving.value = true
  try {
    await apiFetch(`/api/surveys/${deletingSurvey.value.id}`, {
      method: 'DELETE',
    })
    deleteDialog.value = false
    snackbar.success('投票を削除しました。')
    await loadSurveys()
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadSurveys()

  const openId = typeof route.query.open === "string"
    ? route.query.open
    : ""
  const resultsId = typeof route.query.results === "string"
    ? route.query.results
    : ""

  if (openId) {
    await openSurvey(openId)
  } else if (resultsId) {
    await openResults(resultsId)
  }
})
</script>

<style scoped>
.survey-page {
  max-width: 1440px;
}

.survey-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.survey-card > :deep(.v-card-text) {
  flex: 1;
}

.survey-description {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: rgb(var(--v-theme-primary));
}

@media (max-width: 600px) {
  .survey-page {
    padding-inline: 12px !important;
  }
}
</style>

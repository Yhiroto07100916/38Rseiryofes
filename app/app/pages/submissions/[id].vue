<template>
  <v-container fluid class="pa-4 pa-sm-6">
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-5">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        to="/submissions"
      >
        提出物一覧
      </v-btn>
      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        aria-label="再読み込み"
        @click="load"
      />
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" />

    <v-alert
      v-else-if="loadError"
      type="error"
      variant="tonal"
      rounded="lg"
    >
      {{ loadError }}
    </v-alert>

    <template v-else-if="detail">
      <v-card rounded="xl" variant="outlined" class="mb-5">
        <v-card-text class="pa-5 pa-md-7">
          <div class="d-flex align-start justify-space-between flex-wrap ga-3">
            <div class="d-flex align-start ga-3 min-width-0">
              <v-avatar color="primary" variant="tonal" rounded="lg" size="48">
                <v-icon icon="mdi-file-document-outline" size="26" />
              </v-avatar>
              <div class="min-width-0">
                <div class="text-h5 font-weight-bold text-wrap">
                  {{ detail.submission.title }}
                </div>
                <div class="text-body-2 text-medium-emphasis mt-2">
                  提出先：{{ detail.submission.destination }}
                </div>
              </div>
            </div>
            <v-chip
              :color="statusColor(detail.submission.status)"
              variant="tonal"
            >
              {{ statusLabel(detail.submission.status) }}
            </v-chip>
          </div>

          <p
            v-if="detail.submission.description"
            class="text-body-1 mt-5 description"
          >
            {{ detail.submission.description }}
          </p>

          <v-divider class="my-5" />

          <v-row>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">提出期限</div>
              <div class="font-weight-medium">
                {{ formatDate(detail.submission.due_at) }}
              </div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">担当係</div>
              <div class="font-weight-medium">
                {{ detail.submission.assigned_role_name || '未設定' }}
              </div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">作成者</div>
              <div class="font-weight-medium">
                {{ detail.submission.creator_name || '不明' }}
              </div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">作成日時</div>
              <div class="font-weight-medium">
                {{ formatDate(detail.submission.created_at) }}
              </div>
            </v-col>
          </v-row>

          <div
            v-if="canEdit"
            class="d-flex justify-end mt-5"
          >
            <v-btn
              variant="outlined"
              prepend-icon="mdi-pencil"
              @click="openEdit"
            >
              内容を編集
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <v-card rounded="xl" variant="outlined" class="mb-5">
        <v-card-title class="pa-5 d-flex align-center ga-3">
          <v-avatar color="primary" variant="tonal" size="36" rounded="lg">
            <v-icon icon="mdi-cog-outline" />
          </v-avatar>
          <span>操作</span>
        </v-card-title>
        <v-card-text class="px-5 pb-5">
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              v-if="detail.submission.status === 'preparing' && canEdit"
              color="primary"
              @click="runStatusAction('ready_to_submit')"
            >
              提出可能にする
            </v-btn>

            <v-btn
              v-if="canSubmit && ['ready_to_submit', 'changes_requested'].includes(detail.submission.status)"
              color="primary"
              prepend-icon="mdi-upload"
              @click="submitDialog = true"
            >
              {{ detail.submission.status === 'changes_requested' ? '再提出する' : '提出する' }}
            </v-btn>

            <v-btn
              v-if="canReview && ['submitted', 'resubmitted'].includes(detail.submission.status)"
              color="warning"
              variant="tonal"
              @click="runStatusAction('start_review')"
            >
              確認を開始
            </v-btn>

            <v-btn
              v-if="canReview && detail.submission.status === 'under_review'"
              color="error"
              variant="tonal"
              @click="requestChangesDialog = true"
            >
              修正を依頼
            </v-btn>

            <v-btn
              v-if="canReview && ['submitted', 'resubmitted', 'under_review'].includes(detail.submission.status)"
              color="success"
              @click="runStatusAction('complete')"
            >
              完了にする
            </v-btn>

            <v-btn
              v-if="canEdit && !['completed', 'cancelled'].includes(detail.submission.status)"
              color="error"
              variant="text"
              @click="cancelDialog = true"
            >
              取消
            </v-btn>
          </div>

          <div
            v-if="!availableActions"
            class="text-body-2 text-medium-emphasis"
          >
            現在の状態で実行できる操作はありません。
          </div>
        </v-card-text>
      </v-card>

      <v-card
        v-if="['ready_to_submit', 'changes_requested'].includes(detail.submission.status) && canSubmit"
        rounded="xl"
        variant="outlined"
        class="mb-5"
      >
        <v-card-title class="pa-5 d-flex align-center ga-3">
          <v-avatar color="primary" variant="tonal" size="36" rounded="lg">
            <v-icon icon="mdi-upload-outline" />
          </v-avatar>
          <span>提出・再提出</span>
        </v-card-title>
        <v-card-text class="px-5 pb-5">
          <div class="text-body-2 text-medium-emphasis mb-3">
            提出操作からファイルを添付できます。
          </div>
          <v-btn
            color="primary"
            prepend-icon="mdi-upload"
            @click="submitDialog = true"
          >
            提出画面を開く
          </v-btn>
        </v-card-text>
      </v-card>

      <v-card rounded="xl" variant="outlined" class="mb-5">
        <v-card-title class="pa-5 d-flex align-center flex-wrap ga-3">
          <v-avatar color="primary" variant="tonal" size="36" rounded="lg">
            <v-icon icon="mdi-history" />
          </v-avatar>
          <span>提出履歴</span>
          <v-chip size="small" variant="tonal">
            {{ detail.records.length }} 回
          </v-chip>
        </v-card-title>
        <v-card-text class="px-5 pb-5">
          <v-alert
            v-if="!detail.records.length"
            type="info"
            variant="tonal"
          >
            まだ提出記録はありません。
          </v-alert>

          <v-timeline v-else density="compact" side="end">
            <v-timeline-item
              v-for="record in detail.records"
              :key="record.id"
              dot-color="primary"
              size="small"
            >
              <div class="font-weight-bold">
                {{ record.attempt_number }} 回目の提出
              </div>
              <div class="text-caption text-medium-emphasis mt-1">
                {{ record.submitted_by_name || '提出者不明' }}
                ・{{ formatDate(record.submitted_at) }}
              </div>
              <div
                v-if="record.note"
                class="text-body-2 mt-2 description"
              >
                {{ record.note }}
              </div>

              <div v-if="recordFiles(record).length" class="mt-3">
                <div class="text-caption text-medium-emphasis mb-1">
                  添付ファイル
                </div>
                <v-list density="compact" class="pa-0">
                  <v-list-item
                    v-for="file in recordFiles(record)"
                    :key="file.id"
                    :title="file.original_name"
                    prepend-icon="mdi-paperclip"
                    rounded="lg"
                    @click="downloadFile(file)"
                  >
                    <template #append>
                      <v-icon icon="mdi-download" />
                    </template>
                  </v-list-item>
                </v-list>
              </div>
            </v-timeline-item>
          </v-timeline>
        </v-card-text>
      </v-card>

      <v-card rounded="xl" variant="outlined">
        <v-card-title class="pa-5 d-flex align-center ga-3">
          <v-avatar color="primary" variant="tonal" size="36" rounded="lg">
            <v-icon icon="mdi-clipboard-text-clock-outline" />
          </v-avatar>
          <span>更新履歴</span>
        </v-card-title>
        <v-card-text class="px-5 pb-5">
          <v-timeline v-if="detail.history.length" density="compact" side="end">
            <v-timeline-item
              v-for="history in detail.history"
              :key="history.id"
              dot-color="grey"
              size="x-small"
            >
              <div class="font-weight-medium">
                {{ historyLabel(history.action) }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ history.actor_name || 'ユーザー不明' }}
                ・{{ formatDate(history.created_at) }}
              </div>
              <div
                v-if="historyNote(history.details)"
                class="text-body-2 mt-1 description"
              >
                {{ historyNote(history.details) }}
              </div>
            </v-timeline-item>
          </v-timeline>
          <div v-else class="text-body-2 text-medium-emphasis">
            更新履歴はありません。
          </div>
        </v-card-text>
      </v-card>
    </template>

    <v-dialog v-model="editDialog" max-width="600">
      <v-card rounded="xl">
        <v-card-title class="pa-5">提出物を編集</v-card-title>
        <v-card-text class="px-5">
          <v-text-field v-model="editForm.title" label="提出物名" variant="outlined" />
          <v-text-field v-model="editForm.destination" label="提出先" variant="outlined" />
          <v-text-field v-model="editForm.dueAt" label="提出期限" type="datetime-local" variant="outlined" clearable />
          <v-textarea v-model="editForm.description" label="説明・注意事項" variant="outlined" rows="4" />
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="editDialog = false">キャンセル</v-btn>
          <v-btn color="primary" :loading="processing" @click="saveEdit">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="submitDialog" max-width="600">
      <v-card rounded="xl">
        <v-card-title class="pa-5">
          {{ detail?.submission.status === 'changes_requested' ? '再提出' : '提出' }}
        </v-card-title>
        <v-card-text class="px-5">
          <v-textarea
            v-model="submitNote"
            label="備考"
            variant="outlined"
            rows="3"
            maxlength="3000"
            counter
          />
          <div class="text-body-2 font-weight-medium mb-2">添付ファイル</div>
          <input
            type="file"
            multiple
            @change="handleFileChange"
          >
          <div class="text-caption text-medium-emphasis mt-2">
            1回の提出につき最大20ファイル。アップロード後に提出記録へ紐付けます。
          </div>
          <v-list v-if="selectedFiles.length" density="compact" class="mt-3">
            <v-list-item
              v-for="(file, index) in selectedFiles"
              :key="`${file.name}-${index}`"
              :title="file.name"
              :subtitle="formatSize(file.size)"
              prepend-icon="mdi-file-outline"
            />
          </v-list>
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="submitDialog = false">キャンセル</v-btn>
          <v-btn
            color="primary"
            :loading="processing"
            :disabled="selectedFiles.length > 20"
            @click="submit"
          >
            提出する
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="requestChangesDialog" max-width="550">
      <v-card rounded="xl">
        <v-card-title class="pa-5">修正を依頼</v-card-title>
        <v-card-text class="px-5">
          <v-textarea
            v-model="reviewNote"
            label="修正依頼の理由"
            variant="outlined"
            rows="4"
            maxlength="3000"
            counter
          />
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="requestChangesDialog = false">
            キャンセル
          </v-btn>
          <v-btn
            color="error"
            :disabled="!reviewNote.trim()"
            :loading="processing"
            @click="runStatusAction('request_changes', reviewNote)"
          >
            修正を依頼
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="cancelDialog" max-width="450">
      <v-card rounded="xl">
        <v-card-title class="pa-5">提出物を取り消しますか？</v-card-title>
        <v-card-text>
          取消後は提出物の編集や提出ができなくなります。
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="cancelDialog = false">戻る</v-btn>
          <v-btn color="error" :loading="processing" @click="runStatusAction('cancel')">
            取り消す
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import {
  useSubmissionApi,
  type SubmissionDetailResponse,
  type SubmissionFile,
  type SubmissionRecord,
  type SubmissionStatus,
} from '~/composables/useSubmissionApi'
import { useSnackbar } from '~/composables/useSnackbar'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const id = String(route.params.id)
const auth = useAuthStore()
const snackbar = useSnackbar()
const api = useSubmissionApi()

const detail = ref<SubmissionDetailResponse | null>(null)
const loading = ref(false)
const processing = ref(false)
const loadError = ref('')
const editDialog = ref(false)
const submitDialog = ref(false)
const requestChangesDialog = ref(false)
const cancelDialog = ref(false)

const submitNote = ref('')
const reviewNote = ref('')
const selectedFiles = ref<File[]>([])

const editForm = reactive({
  title: '',
  destination: '',
  description: '',
  dueAt: '',
})

const canEdit = computed(() =>
  auth.hasPermission('submissions.edit') &&
  !!detail.value &&
  !['completed', 'cancelled'].includes(detail.value.submission.status),
)

const canSubmit = computed(() => auth.hasPermission('submissions.submit'))
const canReview = computed(() => auth.hasPermission('submissions.review'))

const availableActions = computed(() => {
  if (!detail.value) return false
  const status = detail.value.submission.status
  return (
    (status === 'preparing' && canEdit.value) ||
    (['ready_to_submit', 'changes_requested'].includes(status) && canSubmit.value) ||
    (['submitted', 'resubmitted', 'under_review'].includes(status) && canReview.value) ||
    (status !== 'completed' && status !== 'cancelled' && canEdit.value)
  )
})

const statusOptions: Record<SubmissionStatus, string> = {
  preparing: '準備中',
  ready_to_submit: '提出可能',
  submitted: '提出済み',
  under_review: '確認中',
  changes_requested: '修正依頼',
  resubmitted: '再提出済み',
  completed: '完了',
  cancelled: '取消',
}

const statusLabel = (status: SubmissionStatus) => statusOptions[status] ?? status

const statusColor = (status: SubmissionStatus) => {
  const colors: Record<SubmissionStatus, string> = {
    preparing: 'grey',
    ready_to_submit: 'info',
    submitted: 'primary',
    under_review: 'warning',
    changes_requested: 'error',
    resubmitted: 'primary',
    completed: 'success',
    cancelled: 'grey',
  }
  return colors[status]
}

const formatDate = (value: string | null) => {
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

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const getErrorMessage = (error: unknown) => {
  const value = error as {
    data?: { error?: string; message?: string }
    message?: string
  }
  return value.data?.error || value.data?.message || value.message || '処理に失敗しました'
}

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    detail.value = await api.getSubmission(id)
  } catch (error) {
    loadError.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const toLocalDateTime = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const toIsoDate = (value: string) =>
  value ? new Date(value).toISOString() : null

const openEdit = () => {
  if (!detail.value) return
  const submission = detail.value.submission
  editForm.title = submission.title
  editForm.destination = submission.destination
  editForm.description = submission.description || ''
  editForm.dueAt = toLocalDateTime(submission.due_at)
  editDialog.value = true
}

const saveEdit = async () => {
  if (!detail.value) return
  processing.value = true
  try {
    await api.updateSubmission(id, {
      title: editForm.title.trim(),
      destination: editForm.destination.trim(),
      description: editForm.description.trim() || null,
      due_at: toIsoDate(editForm.dueAt),
    })
    editDialog.value = false
    snackbar.success('提出物を更新しました')
    await load()
  } catch (error) {
    snackbar.error(getErrorMessage(error))
    if (String(getErrorMessage(error)).includes('再読み込み')) await load()
  } finally {
    processing.value = false
  }
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  selectedFiles.value = Array.from(target.files || [])
}

const submit = async () => {
  if (!detail.value) return
  if (selectedFiles.value.length > 20) {
    snackbar.error('添付ファイルは20件以内にしてください')
    return
  }

  processing.value = true
  try {
    const uploadedIds: string[] = []

    for (const file of selectedFiles.value) {
      const uploaded = await api.uploadSubmissionFile(file)
      uploadedIds.push(uploaded.id)
    }

    await api.submitSubmission(id, {
      note: submitNote.value.trim() || undefined,
      file_ids: uploadedIds,
    })

    submitDialog.value = false
    submitNote.value = ''
    selectedFiles.value = []
    snackbar.success('提出を記録しました')
    await load()
  } catch (error) {
    snackbar.error(getErrorMessage(error))
  } finally {
    processing.value = false
  }
}

const runStatusAction = async (
  action:
    | 'ready_to_submit'
    | 'start_review'
    | 'request_changes'
    | 'complete'
    | 'cancel',
  note?: string,
) => {
  processing.value = true
  try {
    await api.updateSubmissionStatus(id, action, note)
    requestChangesDialog.value = false
    cancelDialog.value = false
    reviewNote.value = ''
    snackbar.success('ステータスを更新しました')
    await load()
  } catch (error) {
    snackbar.error(getErrorMessage(error))
    if (String(getErrorMessage(error)).includes('再読み込み')) await load()
  } finally {
    processing.value = false
  }
}

const recordFiles = (record: SubmissionRecord): SubmissionFile[] => {
  if (!record.files) return []
  if (Array.isArray(record.files)) return record.files
  try {
    const parsed = JSON.parse(record.files)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const downloadFile = async (file: SubmissionFile) => {
  try {
    await api.downloadSubmissionFile(id, file.id, file.original_name)
  } catch (error) {
    snackbar.error(getErrorMessage(error))
  }
}

const historyLabel = (action: string) => {
  const labels: Record<string, string> = {
    created: '提出物を作成',
    edited: '内容を編集',
    ready_to_submit: '提出可能に変更',
    start_review: '確認を開始',
    request_changes: '修正を依頼',
    submitted: '提出',
    resubmitted: '再提出',
    complete: '完了',
    cancel: '取消',
  }
  return labels[action] || action
}

const historyNote = (details: string | null) => {
  if (!details) return ''
  try {
    const parsed = JSON.parse(details)
    return typeof parsed.note === 'string' ? parsed.note : ''
  } catch {
    return details
  }
}

onMounted(async () => {
  if (!auth.initialized) await auth.fetchMe()
  await load()
})
</script>

<style scoped>
.description {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.min-width-0 {
  min-width: 0;
}
</style>

<template>
  <v-container fluid class="pa-4 pa-sm-6">
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div class="d-flex align-center ga-3">
        <LayoutBackButton />
        <v-avatar color="primary" variant="tonal" rounded="lg" size="48">
          <v-icon icon="mdi-clipboard-check" size="26" />
        </v-avatar>
        <div>
          <h1 class="text-h5 font-weight-bold">提出物</h1>
          
        </div>
      </div>

      <v-btn
        v-if="auth.hasPermission('submissions.create')"
        color="primary"
        prepend-icon="mdi-plus"
        rounded="lg"
        @click="createDialog = true"
      >
        提出物を作成
      </v-btn>
    </div>

    <v-row v-if="auth.hasPermission('submissions.view')" class="mb-2">
      <v-col
        v-for="stat in summaryStats"
        :key="stat.label"
        cols="6"
        sm="3"
      >
        <v-card variant="outlined" rounded="xl" height="100%">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between ga-2">
              <div class="text-body-2 text-medium-emphasis">
                {{ stat.label }}
              </div>
              <v-icon :icon="stat.icon" color="medium-emphasis" />
            </div>
            <div class="text-h4 font-weight-bold mt-2">
              {{ stat.value }}
              <span class="text-body-2 text-medium-emphasis">件</span>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card variant="outlined" rounded="xl" class="mb-5">
      <v-card-text class="pa-4">
        <v-row align="center">
          <v-col cols="12" md="7">
            <v-text-field
              v-model="keyword"
              label="提出物名・提出先で検索"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="comfortable"
              hide-details
              clearable
            />
          </v-col>
          <v-col cols="12" md="5">
            <v-select
              v-model="statusFilter"
              :items="statusOptions"
              label="ステータス"
              variant="outlined"
              density="comfortable"
              hide-details
              clearable
            />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <div class="d-flex align-center justify-space-between mb-3">
      <div class="text-body-2 text-medium-emphasis">
        表示中 {{ filteredSubmissions.length }} 件
        <span v-if="filteredSubmissions.length !== submissions.length">
          / 全 {{ submissions.length }} 件
        </span>
      </div>
      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        aria-label="再読み込み"
        @click="loadSubmissions"
      />
    </div>

    <v-alert
      v-if="!auth.hasPermission('submissions.view')"
      type="warning"
      variant="tonal"
      rounded="lg"
    >
      提出物を閲覧する権限がありません。
    </v-alert>

    <v-progress-linear
      v-else-if="loading"
      indeterminate
      color="primary"
      class="mb-4"
    />

    <template v-else>
      <v-row v-if="filteredSubmissions.length">
        <v-col
          v-for="submission in filteredSubmissions"
          :key="submission.id"
          cols="12"
          md="6"
        >
          <v-card
            variant="outlined"
            rounded="xl"
            height="100%"
            class="submission-card"
            :to="`/submissions/${submission.id}`"
          >
            <v-card-text class="pa-4 pa-sm-5">
              <div class="d-flex align-start justify-space-between ga-3">
                <div class="min-width-0">
                  <div class="text-h6 font-weight-bold text-wrap">
                    {{ submission.title }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis mt-1">
                    提出先：{{ submission.destination }}
                  </div>
                </div>
                <v-chip
                  :color="statusColor(submission.status)"
                  size="small"
                  variant="tonal"
                  class="flex-shrink-0"
                >
                  {{ statusLabel(submission.status) }}
                </v-chip>
              </div>

              <p
                v-if="submission.description"
                class="text-body-2 text-medium-emphasis mt-4 description-preview"
              >
                {{ submission.description }}
              </p>

              <v-divider class="my-4" />

              <div class="d-flex flex-wrap ga-4 text-body-2">
                <div>
                  <v-icon icon="mdi-calendar-clock" size="small" class="mr-1" />
                  <span class="text-medium-emphasis">期限：</span>
                  {{ formatDate(submission.due_at) }}
                </div>
                <div>
                  <v-icon icon="mdi-file-multiple-outline" size="small" class="mr-1" />
                  <span class="text-medium-emphasis">提出回数：</span>
                  {{ submission.record_count ?? 0 }} 回
                </div>
              </div>

              <div class="text-caption text-medium-emphasis mt-3">
                作成者：{{ submission.creator_name || '不明' }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-card
        v-else
        variant="outlined"
        rounded="xl"
        class="text-center py-10"
      >
        <v-icon icon="mdi-folder-open-outline" size="44" color="medium-emphasis" />
        <div class="text-h6 mt-3">提出物はありません</div>
        <div class="text-body-2 text-medium-emphasis mt-1">
          検索条件を変更するか、新しい提出物を作成してください。
        </div>
      </v-card>
    </template>

    <v-dialog v-model="createDialog" max-width="600">
      <v-card rounded="xl">
        <v-card-title class="pa-5">提出物を作成</v-card-title>
        <v-card-text class="px-5">
          <v-text-field
            v-model="form.title"
            label="提出物名"
            variant="outlined"
            maxlength="200"
            counter
          />
          <v-text-field
            v-model="form.destination"
            label="提出先"
            variant="outlined"
            maxlength="200"
          />
          <v-text-field
            v-model="form.dueAt"
            label="提出期限"
            type="datetime-local"
            variant="outlined"
            clearable
          />
          <v-textarea
            v-model="form.description"
            label="説明・注意事項"
            variant="outlined"
            rows="4"
            maxlength="5000"
            counter
          />
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="createDialog = false">
            キャンセル
          </v-btn>
          <v-btn
            color="primary"
            :loading="creating"
            :disabled="!form.title.trim() || !form.destination.trim()"
            @click="create"
          >
            作成する
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import {
  useSubmissionApi,
  type Submission,
  type SubmissionStatus,
} from '~/composables/useSubmissionApi'
import { useSnackbar } from '~/composables/useSnackbar'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  middleware: 'auth',
})

const auth = useAuthStore()
const snackbar = useSnackbar()
const api = useSubmissionApi()

const submissions = ref<Submission[]>([])
const loading = ref(false)
const creating = ref(false)
const createDialog = ref(false)
const keyword = ref('')
const statusFilter = ref<SubmissionStatus | null>(null)

const form = reactive({
  title: '',
  destination: '',
  description: '',
  dueAt: '',
})

const statusOptions = [
  { title: '準備中', value: 'preparing' },
  { title: '提出可能', value: 'ready_to_submit' },
  { title: '提出済み', value: 'submitted' },
  { title: '確認中', value: 'under_review' },
  { title: '修正依頼', value: 'changes_requested' },
  { title: '再提出済み', value: 'resubmitted' },
  { title: '完了', value: 'completed' },
  { title: '取消', value: 'cancelled' },
]

const filteredSubmissions = computed(() => {
  const query = keyword.value.trim().toLowerCase()

  return submissions.value.filter((submission) => {
    const matchesKeyword =
      !query ||
      submission.title.toLowerCase().includes(query) ||
      submission.destination.toLowerCase().includes(query)

    const matchesStatus =
      !statusFilter.value || submission.status === statusFilter.value

    return matchesKeyword && matchesStatus
  })
})

const summaryStats = computed(() => {
  const items = submissions.value

  return [
    {
      label: '提出物総数',
      value: items.length,
      icon: 'mdi-file-multiple-outline',
    },
    {
      label: '提出待ち',
      value: items.filter((item) =>
        ['preparing', 'ready_to_submit'].includes(item.status),
      ).length,
      icon: 'mdi-clock-outline',
    },
    {
      label: '確認中',
      value: items.filter((item) =>
        ['submitted', 'under_review', 'resubmitted'].includes(item.status),
      ).length,
      icon: 'mdi-eye-outline',
    },
    {
      label: '完了',
      value: items.filter((item) => item.status === 'completed').length,
      icon: 'mdi-check-circle-outline',
    },
  ]
})

const statusLabel = (status: SubmissionStatus) =>
  statusOptions.find((item) => item.value === status)?.title ?? status

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

const toIsoDate = (value: string) =>
  value ? new Date(value).toISOString() : null

const getErrorMessage = (error: unknown) => {
  const value = error as {
    data?: { error?: string; message?: string }
    message?: string
  }
  return value.data?.error || value.data?.message || value.message || '処理に失敗しました'
}

const loadSubmissions = async () => {
  if (!auth.hasPermission('submissions.view')) return

  loading.value = true
  try {
    const response = await api.getSubmissions()
    submissions.value = response.submissions
  } catch (error) {
    snackbar.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

const create = async () => {
  creating.value = true
  try {
    const result = await api.createSubmission({
      title: form.title.trim(),
      destination: form.destination.trim(),
      description: form.description.trim() || null,
      due_at: toIsoDate(form.dueAt),
    })

    snackbar.success('提出物を作成しました')
    createDialog.value = false
    await navigateTo(`/submissions/${result.id}`)
  } catch (error) {
    snackbar.error(getErrorMessage(error))
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  if (!auth.initialized) await auth.fetchMe()
  await loadSubmissions()
})
</script>

<style scoped>
.submission-card {
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.submission-card:hover {
  transform: translateY(-2px);
}

.min-width-0 {
  min-width: 0;
}

.description-preview {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

<template>
  <v-container
    fluid
    class="pa-4 pa-sm-6"
  >
    <div class="d-flex align-center mb-6">
      <BackButton />

      <div class="min-width-0">
        <h1 class="text-h5 font-weight-bold">
          お知らせ
        </h1>

        <p class="text-body-2 text-medium-emphasis mt-1">
          お知らせの詳細
        </p>
      </div>

      <v-spacer />

      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        aria-label="更新"
        @click="loadNews"
      />
    </div>

    <v-card
      v-if="loading"
      variant="outlined"
      class="rounded-xl"
    >
      <v-card-text>
        <v-skeleton-loader type="article" />
      </v-card-text>
    </v-card>

    <v-card
      v-else-if="notFound"
      variant="outlined"
      class="rounded-xl"
    >
      <v-card-text class="text-center py-10">
        <v-icon
          icon="mdi-file-alert-outline"
          size="48"
          class="mb-3"
        />

        <div class="text-h6 font-weight-bold">
          お知らせが見つかりません
        </div>

        <div class="text-body-2 text-medium-emphasis mt-2">
          お知らせが削除されたか、存在しない可能性があります。
        </div>

        <v-btn
          class="mt-5"
          variant="outlined"
          @click="navigateTo('/news')"
        >
          お知らせ一覧へ
        </v-btn>
      </v-card-text>
    </v-card>

    <template v-else-if="news">
      <v-card
        variant="outlined"
        class="rounded-xl"
      >
        <v-card-text class="pa-4 pa-sm-6">
          <div class="d-flex flex-wrap align-center ga-2 mb-4">
            <v-chip
              v-if="news.is_important === 1"
              color="error"
              size="small"
              variant="flat"
            >
              <v-icon
                start
                icon="mdi-alert"
              />
              重要
            </v-chip>

            <span class="text-body-2 text-medium-emphasis">
              {{ formatDateTime(news.created_at) }}
            </span>
          </div>

          <h2 class="text-h5 text-sm-h4 font-weight-bold news-title">
            {{ news.title }}
          </h2>

          <div class="text-body-2 text-medium-emphasis mt-3">
            {{ news.author }}
          </div>

          <v-divider class="my-6" />

          <div class="news-detail">
            {{ news.detail }}
          </div>

          <template v-if="news.calendar_events.length > 0">
            <v-divider class="my-6" />

            <div class="text-subtitle-1 font-weight-bold mb-3">
              <v-icon
                icon="mdi-calendar"
                size="20"
                class="mr-1"
              />
              関連する予定
            </div>

            <div class="d-flex flex-column ga-2">
              <v-card
                v-for="event in news.calendar_events"
                :key="event.id"
                variant="tonal"
                class="rounded-lg"
                hover
                @click="openCalendarEvent(event.id)"
              >
                <v-card-text class="pa-3">
                  <div class="d-flex align-start">
                    <div
                      class="event-color"
                      :style="{
                        backgroundColor:
                          event.color ||
                          event.category_color ||
                          'rgb(var(--v-theme-primary))',
                      }"
                    />

                    <div class="ml-3 min-width-0 flex-grow-1">
                      <div class="font-weight-medium event-title">
                        {{ event.title }}
                      </div>

                      <div class="text-body-2 text-medium-emphasis mt-1">
                        {{ formatEventDate(event) }}
                      </div>

                      <div
                        v-if="event.location"
                        class="text-body-2 text-medium-emphasis mt-1"
                      >
                        <v-icon
                          icon="mdi-map-marker-outline"
                          size="16"
                          class="mr-1"
                        />
                        {{ event.location }}
                      </div>
                    </div>

                    <v-icon
                      icon="mdi-chevron-right"
                      class="ml-2"
                    />
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </template>

          <template v-if="news.tasks.length > 0">
            <v-divider class="my-6" />

            <div class="text-subtitle-1 font-weight-bold mb-3">
              <v-icon
                icon="mdi-format-list-checks"
                size="20"
                class="mr-1"
              />
              関連するタスク
            </div>

            <div class="d-flex flex-column ga-2">
              <v-card
                v-for="task in news.tasks"
                :key="task.id"
                variant="tonal"
                class="rounded-lg"
                hover
                @click="openTask(task.id, task.scope)"
              >
                <v-card-text class="pa-3">
                  <div class="d-flex align-start">
                    <div
                      class="task-priority"
                      :class="{
                        'is-urgent': task.priority === 'urgent',
                      }"
                    />

                    <div class="ml-3 min-width-0 flex-grow-1">
                      <div class="font-weight-medium task-title">
                        {{ task.title }}
                      </div>

                      <div class="d-flex flex-wrap ga-1 mt-2">
                        <v-chip
                          size="x-small"
                          variant="outlined"
                        >
                          {{ getTaskScopeLabel(task.scope) }}
                        </v-chip>

                        <v-chip
                          size="x-small"
                          variant="outlined"
                        >
                          {{ getTaskStatusLabel(task.status) }}
                        </v-chip>

                        <v-chip
                          size="x-small"
                          variant="outlined"
                        >
                          {{ getTaskPriorityLabel(task.priority) }}
                        </v-chip>
                      </div>

                      <div
                        v-if="task.due_at"
                        class="text-body-2 text-medium-emphasis mt-2"
                      >
                        期限 {{ formatTaskDueDate(task.due_at) }}
                      </div>
                    </div>

                    <v-icon
                      icon="mdi-chevron-right"
                      class="ml-2"
                    />
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </template>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4">
          <v-btn
            variant="text"
            prepend-icon="mdi-arrow-left"
            @click="navigateTo('/news')"
          >
            一覧へ戻る
          </v-btn>

          <v-spacer />

          <v-btn
            v-if="auth.hasPermission('news.edit')"
            variant="outlined"
            prepend-icon="mdi-pencil"
            @click="navigateTo(`/news/${news.id}/edit`)"
          >
            編集
          </v-btn>

          <v-btn
            v-if="auth.hasPermission('news.delete')"
            color="error"
            variant="text"
            prepend-icon="mdi-delete-outline"
            :loading="deleting"
            @click="deleteNewsItem"
          >
            削除
          </v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BackButton from '~/components/layout/BackButton.vue'
import {
  type NewsWithCalendarEvents,
  useApi,
} from '~/composables/useApi'
import { useConfirmDialog } from '~/composables/useConfirmDialog'
import { useSnackbar } from '~/composables/useSnackbar'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const auth = useAuthStore()
const { getNewsById, deleteNews } = useApi()
const { confirm } = useConfirmDialog()
const snackbar = useSnackbar()

const news = ref<NewsWithCalendarEvents | null>(null)
const loading = ref(false)
const deleting = ref(false)
const notFound = ref(false)

const newsId = computed(() => String(route.params.id))

const formatDateTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatEventDate = (
  event: NewsWithCalendarEvents['calendar_events'][number],
) => {
  const start = new Date(event.starts_at)

  if (Number.isNaN(start.getTime())) {
    return event.starts_at
  }

  const date = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(start)

  if (event.is_all_day === 1) {
    return date
  }

  const time = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(start)

  if (!event.ends_at) {
    return `${date} ${time}`
  }

  const end = new Date(event.ends_at)

  if (Number.isNaN(end.getTime())) {
    return `${date} ${time}`
  }

  const endTime = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(end)

  return `${date} ${time}〜${endTime}`
}

const loadNews = async () => {
  if (!auth.hasPermission('news.view')) {
    return
  }

  loading.value = true
  notFound.value = false

  try {
    news.value = await getNewsById(newsId.value)
  } catch (error: unknown) {
    console.error('Failed to load news:', error)

    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error
        ? Number(error.statusCode)
        : null

    if (statusCode === 404) {
      notFound.value = true
      news.value = null
    } else {
      snackbar.error('お知らせの取得に失敗しました')
    }
  } finally {
    loading.value = false
  }
}

const openCalendarEvent = (eventId: string) => {
  navigateTo(`/calendar/${eventId}`)
}

const getTaskScopeLabel = (
  scope: NewsWithCalendarEvents['tasks'][number]['scope'],
) => {
  return scope === 'class_representative'
    ? '代表タスク'
    : 'クラス全体'
}

const getTaskStatusLabel = (
  status: NewsWithCalendarEvents['tasks'][number]['status'],
) => {
  const labels: Record<
    NewsWithCalendarEvents['tasks'][number]['status'],
    string
  > = {
    todo: '未着手',
    in_progress: '進行中',
    review: '確認待ち',
    done: '完了',
  }

  return labels[status]
}

const getTaskPriorityLabel = (
  priority: NewsWithCalendarEvents['tasks'][number]['priority'],
) => {
  const labels: Record<
    NewsWithCalendarEvents['tasks'][number]['priority'],
    string
  > = {
    low: '優先度：低',
    medium: '優先度：中',
    high: '優先度：高',
    urgent: '優先度：緊急',
  }

  return labels[priority]
}

const formatTaskDueDate = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

const openTask = (
  taskId: string,
  scope: NewsWithCalendarEvents['tasks'][number]['scope'],
) => {
  navigateTo(
    scope === 'class_representative'
      ? `/tasks/class-representative/${taskId}`
      : `/tasks/class/${taskId}`,
  )
}

const deleteNewsItem = async () => {
  if (!news.value || !auth.hasPermission('news.delete')) {
    return
  }

  const accepted = await confirm({
    title: 'お知らせを削除',
    message: `「${news.value.title}」を削除しますか？`,
    confirmText: '削除',
    cancelText: 'キャンセル',
  })

  if (!accepted) {
    return
  }

  deleting.value = true

  try {
    await deleteNews(news.value.id)

    snackbar.success('お知らせを削除しました')
    await navigateTo('/news')
  } catch (error) {
    console.error('Failed to delete news:', error)
    snackbar.error('お知らせの削除に失敗しました')
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadNews()
})
</script>

<style scoped>
.attachment-name {
  overflow-wrap: anywhere;
}


.min-width-0 {
  min-width: 0;
}

.news-title {
  overflow-wrap: anywhere;
}

.news-detail {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.9;
}

.event-color {
  width: 5px;
  min-width: 5px;
  align-self: stretch;
  border-radius: 4px;
}

.event-title {
  overflow-wrap: anywhere;
}

.task-priority {
  width: 5px;
  min-width: 5px;
  align-self: stretch;
  border-radius: 4px;
  background: rgb(var(--v-theme-warning));
}

.task-priority.is-urgent {
  background: rgb(var(--v-theme-error));
}

.task-title {
  overflow-wrap: anywhere;
}
</style>

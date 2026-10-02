<template>
  <v-container
    fluid
    class="pa-4 pa-sm-6"
  >
    <div class="d-flex align-center mb-6">
      <BackButton />

      <div class="ml-2">
        <h1 class="text-h5 font-weight-bold">
          お知らせを編集
        </h1>

        <p class="text-body-2 text-medium-emphasis mt-1">
          お知らせの内容を編集します
        </p>
      </div>
    </div>

    <v-card
      variant="outlined"
      class="rounded-xl"
    >
      <v-card-text class="pa-4 pa-sm-6">
        <v-text-field
          v-model="form.title"
          label="タイトル"
          variant="outlined"
          required
          maxlength="50"
          counter="50"
          :error-messages="titleError"
          :loading="loadingNews"
          :disabled="loadingNews"
        />

        <v-textarea
          v-model="form.detail"
          label="本文"
          variant="outlined"
          rows="8"
          auto-grow
          maxlength="500"
          counter="500"
          required
          class="mt-2"
          :error-messages="detailError"
          :disabled="loadingNews"
        />

        <v-text-field
          v-model="form.author"
          label="作成者"
          variant="outlined"
          maxlength="50"
          counter="50"
          required
          class="mt-2"
          :error-messages="authorError"
          :disabled="loadingNews"
        />

        <v-checkbox
          v-model="form.isImportant"
          label="重要なお知らせとして表示する"
          hide-details
          class="mt-2"
          :disabled="loadingNews"
        />

        <v-divider class="my-6" />

        <div class="text-subtitle-1 font-weight-bold mb-2">
          関連する予定
        </div>

        <div class="text-body-2 text-medium-emphasis mb-4">
          このお知らせに関連するカレンダーの予定を選択できます。
        </div>

        <v-autocomplete
          v-model="form.calendarEventIds"
          :items="calendarEvents"
          item-title="displayTitle"
          item-value="id"
          label="関連する予定を選択"
          variant="outlined"
          multiple
          chips
          closable-chips
          :loading="calendarEventsLoading"
          no-data-text="関連する予定がありません"
          clearable
          :disabled="loadingNews"
        >
          <template #item="{ props, item }">
            <v-list-item
              v-bind="props"
              :title="item.displayTitle"
              :subtitle="item.displayDate"
            />
          </template>
        </v-autocomplete>

        <div
          v-if="form.calendarEventIds.length > 0"
          class="mt-3"
        >
          <div class="text-body-2 text-medium-emphasis mb-2">
            選択中の予定
          </div>

          <div class="d-flex flex-column ga-2">
            <v-card
              v-for="event in selectedCalendarEvents"
              :key="event.id"
              variant="tonal"
              class="rounded-lg"
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

                  <div class="ml-3 min-width-0">
                    <div class="font-weight-medium">
                      {{ event.title }}
                    </div>

                    <div class="text-body-2 text-medium-emphasis mt-1">
                      {{ event.displayDate }}
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </div>

        <v-divider class="my-6" />

        <div class="text-subtitle-1 font-weight-bold mb-2">
          関連するタスク
        </div>

        <div class="text-body-2 text-medium-emphasis mb-4">
          このお知らせに関連するタスクを選択できます。
        </div>

        <v-autocomplete
          v-model="form.taskIds"
          :items="tasks"
          item-title="displayTitle"
          item-value="id"
          label="関連するタスクを選択"
          variant="outlined"
          multiple
          chips
          closable-chips
          :loading="tasksLoading"
          no-data-text="関連するタスクがありません"
          clearable
          :disabled="loadingNews"
        >
          <template #item="{ props, item }">
            <v-list-item
              v-bind="props"
              :title="item.displayTitle"
              :subtitle="item.displaySubtitle"
            />
          </template>
        </v-autocomplete>

        <div
          v-if="form.taskIds.length > 0"
          class="mt-3"
        >
          <div class="text-body-2 text-medium-emphasis mb-2">
            選択中のタスク
          </div>

          <div class="d-flex flex-column ga-2">
            <v-card
              v-for="task in selectedTasks"
              :key="task.id"
              variant="tonal"
              class="rounded-lg"
            >
              <v-card-text class="pa-3">
                <div class="d-flex align-start">
                  <div
                    class="task-priority"
                    :class="{
                      'is-urgent': task.priority === 'urgent',
                    }"
                  />

                  <div class="ml-3 min-width-0">
                    <div class="font-weight-medium">
                      {{ task.title }}
                    </div>

                    <div class="text-body-2 text-medium-emphasis mt-1">
                      {{ task.displaySubtitle }}
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </div>

        <div
          v-if="loadingNews"
          class="d-flex justify-center py-6"
        >
          <v-progress-circular
            indeterminate
            color="primary"
          />
        </div>

        <div class="d-flex justify-end ga-2 mt-6">
          <v-btn
            variant="text"
            :disabled="submitting"
            @click="goBack"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="primary"
            variant="flat"
            :loading="submitting"
            :disabled="loadingNews"
            @click="updateNewsItem"
          >
            お知らせを更新
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from 'vue'
import BackButton from '~/components/layout/BackButton.vue'
import {
  type CalendarEvent,
  useApi,
} from '~/composables/useApi'
import { useSnackbar } from '~/composables/useSnackbar'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  middleware: 'auth',
})

interface CalendarEventItem extends CalendarEvent {
  displayTitle: string
  displayDate: string
}

interface TaskItem extends Task {
  displayTitle: string
  displaySubtitle: string
}

const route = useRoute()

const auth = useAuthStore()
const snackbar = useSnackbar()

const {
  getNewsById,
  getCalendarEvents,
  getTasks,
  updateNews,
} = useApi()

const newsId = computed(() => String(route.params.id))

const form = ref({
  title: '',
  detail: '',
  author: '',
  isImportant: false,
  calendarEventIds: [] as string[],
  taskIds: [] as string[],
})

const loadingNews = ref(true)

const calendarEvents = ref<CalendarEventItem[]>([])
const calendarEventsLoading = ref(false)

const tasks = ref<TaskItem[]>([])
const tasksLoading = ref(false)

const submitting = ref(false)

const titleError = ref('')
const detailError = ref('')
const authorError = ref('')

const formatEventDate = (event: CalendarEvent) => {
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
    return `${date}（終日）`
  }

  const startTime = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(start)

  if (!event.ends_at) {
    return `${date} ${startTime}`
  }

  const end = new Date(event.ends_at)

  if (Number.isNaN(end.getTime())) {
    return `${date} ${startTime}`
  }

  const endDate = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(end)

  const endTime = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(end)

  if (date === endDate) {
    return `${date} ${startTime}〜${endTime}`
  }

  return `${date} ${startTime}〜${endDate} ${endTime}`
}

const loadNewsItem = async () => {
  loadingNews.value = true

  try {
    const news = await getNewsById(newsId.value)

    form.value.title = news.title
    form.value.detail = news.detail
    form.value.author = news.author
    form.value.isImportant = Boolean(news.is_important)

    form.value.calendarEventIds =
      news.calendar_events.map((event) => event.id)

    form.value.taskIds =
      news.tasks.map((task) => task.id)
  } catch (error) {
    console.error(error)
    snackbar.error('お知らせの取得に失敗しました。')
    await navigateTo('/news')
  } finally {
    loadingNews.value = false
  }
}

const loadCalendarEvents = async () => {
  calendarEventsLoading.value = true

  try {
    const now = new Date()

    const fromDate = new Date(
      now.getFullYear(),
      now.getMonth() - 3,
      1,
    )

    const toDate = new Date(
      now.getFullYear(),
      now.getMonth() + 4,
      0,
      23,
      59,
      59,
      999,
    )

    const response = await getCalendarEvents(
      fromDate.toISOString(),
      toDate.toISOString(),
    )

    calendarEvents.value = response.events
      .map((event) => ({
        ...event,
        displayTitle: event.title,
        displayDate: formatEventDate(event),
      }))
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() -
          new Date(b.starts_at).getTime(),
      )
  } catch (error) {
    console.error(error)
    snackbar.error('予定一覧の取得に失敗しました。')
  } finally {
    calendarEventsLoading.value = false
  }
}

const selectedCalendarEvents = computed(() => {
  const selectedIds = new Set(form.value.calendarEventIds)

  return calendarEvents.value.filter((event) =>
    selectedIds.has(event.id),
  )
})

const getTaskStatusLabel = (status: Task['status']) => {
  const labels: Record<Task['status'], string> = {
    todo: '未着手',
    in_progress: '進行中',
    review: '確認待ち',
    done: '完了',
  }

  return labels[status]
}

const getTaskPriorityLabel = (priority: Task['priority']) => {
  const labels: Record<Task['priority'], string> = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '緊急',
  }

  return labels[priority]
}

const loadTasks = async () => {
  tasksLoading.value = true

  try {
    const [classResponse, representativeResponse] =
      await Promise.all([
        getTasks('class'),
        getTasks('class_representative'),
      ])

    tasks.value = [
      ...classResponse.tasks,
      ...representativeResponse.tasks,
    ]
      .map((task) => ({
        ...task,
        displayTitle: task.title,
        displaySubtitle: [
          task.scope === 'class_representative'
            ? '代表タスク'
            : 'クラス全体',
          getTaskStatusLabel(task.status),
          getTaskPriorityLabel(task.priority),
          task.due_at
            ? `期限 ${new Intl.DateTimeFormat('ja-JP').format(
                new Date(task.due_at),
              )}`
            : null,
        ]
          .filter(Boolean)
          .join(' ・ '),
      }))
      .sort((a, b) => {
        if (!a.due_at && !b.due_at) {
          return a.title.localeCompare(b.title, 'ja')
        }

        if (!a.due_at) {
          return 1
        }

        if (!b.due_at) {
          return -1
        }

        return (
          new Date(a.due_at).getTime() -
          new Date(b.due_at).getTime()
        )
      })
  } catch (error) {
    console.error(error)
    snackbar.error('タスク一覧の取得に失敗しました。')
  } finally {
    tasksLoading.value = false
  }
}

const selectedTasks = computed(() => {
  const selectedIds = new Set(form.value.taskIds)

  return tasks.value.filter((task) =>
    selectedIds.has(task.id),
  )
})

const validate = () => {
  titleError.value = ''
  detailError.value = ''
  authorError.value = ''

  let valid = true

  if (!form.value.title.trim()) {
    titleError.value = 'タイトルを入力してください。'
    valid = false
  }

  if (form.value.title.trim().length > 50) {
    titleError.value = 'タイトルは50文字以内で入力してください。'
    valid = false
  }

  if (!form.value.detail.trim()) {
    detailError.value = '本文を入力してください。'
    valid = false
  }

  if (form.value.detail.trim().length > 500) {
    detailError.value = '本文は500文字以内で入力してください。'
    valid = false
  }

  if (!form.value.author.trim()) {
    authorError.value = '作成者を入力してください。'
    valid = false
  }

  if (form.value.author.trim().length > 50) {
    authorError.value = '作成者は50文字以内で入力してください。'
    valid = false
  }

  return valid
}

const updateNewsItem = async () => {
  if (!validate()) {
    return
  }

  submitting.value = true

  try {
    await updateNews(newsId.value, {
      title: form.value.title.trim(),
      detail: form.value.detail.trim(),
      author: form.value.author.trim(),
      is_important: form.value.isImportant,
      calendar_event_ids: form.value.calendarEventIds,
      task_ids: form.value.taskIds,
    })

    snackbar.success('お知らせを更新しました')

    await navigateTo(`/news/${newsId.value}`)
  } catch (error) {
    console.error(error)
    snackbar.error('お知らせの更新に失敗しました。')
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  navigateTo(`/news/${newsId.value}`)
}

onMounted(async () => {
  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (!auth.hasPermission('news.edit')) {
    await navigateTo(`/news/${newsId.value}`)
    return
  }

  await Promise.all([
    loadNewsItem(),
    loadCalendarEvents(),
    loadTasks(),
  ])
})
</script>

<style scoped>
.min-width-0 {
  min-width: 0;
}

.event-color {
  width: 5px;
  min-width: 5px;
  align-self: stretch;
  border-radius: 4px;
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
</style>

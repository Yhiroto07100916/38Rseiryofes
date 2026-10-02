<template>
  <v-container class="calendar-page py-4">
    <div class="calendar-header">
      <div>
        <h1 class="text-h5 font-weight-bold">カレンダー</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          38Rの予定をみんなで共有
        </p>
      </div>

      <v-btn
        icon="mdi-plus"
        color="primary"
        size="large"
        elevation="2"
        @click="openCreateDialog(selectedDate)"
      />
    </div>

    <v-card
      class="calendar-card mt-4"
      rounded="xl"
      elevation="1"
    >
      <div class="calendar-toolbar">
        <v-btn
          icon="mdi-chevron-left"
          variant="text"
          @click="changeMonth(-1)"
        />

        <div class="calendar-title">
          <span>{{ currentYear }}年</span>
          <strong>{{ currentMonth + 1 }}月</strong>
        </div>

        <v-btn
          icon="mdi-chevron-right"
          variant="text"
          @click="changeMonth(1)"
        />

        <v-btn
          variant="outlined"
          size="small"
          class="ml-2"
          @click="goToday"
        >
          今日へ
        </v-btn>
      </div>

      <v-progress-linear
        v-if="loading"
        indeterminate
        color="primary"
        height="2"
      />

      <div class="calendar-weekdays">
        <div
          v-for="day in weekDays"
          :key="day.label"
          class="weekday"
          :class="day.class"
        >
          {{ day.label }}
        </div>
      </div>

      <div class="calendar-grid">
        <button
          v-for="day in calendarDays"
          :key="day.key"
          type="button"
          class="calendar-day"
          :class="{
            'is-other-month': !day.isCurrentMonth,
            'is-today': day.isToday,
            'is-selected': day.key === selectedDate,
          }"
          @click="selectDate(day.key)"
        >
          <div class="day-number">
            <span>{{ day.date.getDate() }}</span>
          </div>

          <div class="day-events">
            <div
              v-for="event in day.events.slice(0, 3)"
              :key="event.id"
              class="event-chip"
              :class="{ 'is-all-day': event.is_all_day }"
              :style="
                event.is_all_day
                  ? { backgroundColor: event.color || 'rgb(var(--v-theme-primary))' }
                  : event.color
                    ? { borderLeftColor: event.color }
                    : undefined
              "
            >
              <span class="event-title">{{ event.title }}</span>
            </div>

            <div
              v-for="task in day.taskDeadlines"
              :key="`task-${task.id}`"
              class="task-deadline-chip"
              :class="{
                'is-urgent': task.priority === 'urgent',
              }"
            >
              <span class="task-deadline-label">
                {{ task.priority === 'urgent' ? '緊急' : '高' }}
              </span>
              <span class="task-deadline-title">
                {{ task.title }}
              </span>
            </div>

            <div
              v-if="day.events.length > 3"
              class="more-events"
            >
              +{{ day.events.length - 3 }}件
            </div>
          </div>
        </button>
      </div>
    </v-card>

    <v-card
      class="selected-day-card mt-4"
      rounded="xl"
      elevation="1"
    >
      <div class="selected-day-header">
        <div>
          <div class="text-body-2 text-medium-emphasis">
            選択中の日付
          </div>
          <div class="text-h6 font-weight-bold">
            {{ formatSelectedDate }}
          </div>
        </div>

        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-plus"
          @click="openCreateDialog(selectedDate)"
        >
          予定を追加
        </v-btn>
      </div>

      <v-divider />

      <div
        v-if="
          selectedEvents.length === 0 &&
          selectedTaskDeadlines.length === 0
        "
        class="empty-events"
      >
        <v-icon size="36" color="grey">
          mdi-calendar-blank-outline
        </v-icon>
        <div class="mt-2 text-body-2 text-medium-emphasis">
          この日の予定はありません
        </div>
      </div>

      <div v-if="selectedEvents.length > 0" class="event-list">
        <button
          v-for="event in selectedEvents"
          :key="event.id"
          type="button"
          class="event-list-item"
          @click="openEvent(event)"
        >
          <div
            class="event-color"
            :style="{
              backgroundColor: event.color || '#1976D2',
            }"
          />

          <div class="event-list-content">
            <div class="font-weight-medium">
              {{ event.title }}
            </div>

            <div class="text-body-2 text-medium-emphasis mt-1">
              {{ formatEventRange(event) }}
            </div>

            <div
              v-if="event.location"
              class="text-body-2 text-medium-emphasis mt-1"
            >
              <v-icon size="16">mdi-map-marker-outline</v-icon>
              {{ event.location }}
            </div>
          </div>

          <v-icon color="grey">
            mdi-chevron-right
          </v-icon>
        </button>
      </div>

      <div
        v-if="selectedTaskDeadlines.length > 0"
        class="task-deadline-list"
      >
        <div class="task-deadline-list-title">
          <v-icon size="18">mdi-format-list-checks</v-icon>
          重要タスクの期限
        </div>

        <button
          v-for="task in selectedTaskDeadlines"
          :key="task.id"
          type="button"
          class="task-deadline-list-item"
          :class="{
            'is-urgent': task.priority === 'urgent',
          }"
          @click="openTask(task)"
        >
          <div class="task-deadline-list-priority">
            {{ task.priority === 'urgent' ? '緊急' : '高' }}
          </div>

          <div class="task-deadline-list-content">
            <div class="font-weight-medium">
              {{ task.title }}
            </div>

            <div
              v-if="task.due_at"
              class="text-body-2 text-medium-emphasis mt-1"
            >
              期限 {{ formatTaskDeadline(task.due_at) }}
            </div>
          </div>

          <v-icon color="grey" size="20">
            mdi-chevron-right
          </v-icon>
        </button>
      </div>
    </v-card>

    <v-dialog
      v-model="eventDialog"
      :fullscreen="mobile"
      max-width="520"
    >
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center">
          <span>{{ editingEvent ? '予定を編集' : '予定を追加' }}</span>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="eventDialog = false"
          />
        </v-card-title>

        <v-card-text>
          <v-text-field
            v-model="eventForm.title"
            label="予定名"
            variant="outlined"
            autofocus
            required
          />

          <v-textarea
            v-model="eventForm.description"
            label="詳細"
            variant="outlined"
            rows="3"
            class="mt-2"
          />

          <v-checkbox
            v-model="eventForm.is_all_day"
            label="終日の予定"
            hide-details
            class="mt-1"
          />

          <v-text-field
            v-model="eventForm.starts_at"
            label="開始"
            type="datetime-local"
            variant="outlined"
            class="mt-2"
          />

          <v-text-field
            v-model="eventForm.ends_at"
            label="終了"
            type="datetime-local"
            variant="outlined"
            class="mt-2"
          />

          <v-text-field
            v-model="eventForm.location"
            label="場所"
            variant="outlined"
            prepend-inner-icon="mdi-map-marker-outline"
            class="mt-2"
          />

          <v-select
            v-model="eventForm.category_id"
            :items="categories"
            item-title="name"
            item-value="id"
            label="カテゴリ"
            variant="outlined"
            class="mt-4"
            :disabled="categories.length === 0"
          >
            <template #item="{ props, item }">
              <v-list-item
                v-bind="props"
                :title="item.name"
              >
                <template #prepend>
                  <span
                    class="category-color"
                    :style="{ backgroundColor: item.color }"
                  />
                </template>
              </v-list-item>
            </template>

            <template #selection="{ item }">
              <div class="d-flex align-center">
                <span
                  class="category-color mr-2"
                  :style="{ backgroundColor: item.color }"
                />
                {{ item.name }}
              </div>
            </template>
          </v-select>
        </v-card-text>

        <v-card-actions class="px-4 pb-4">
          <v-btn
            v-if="editingEvent"
            color="error"
            variant="text"
            :loading="saving"
            @click="deleteEvent"
          >
            削除
          </v-btn>

          <v-spacer />

          <v-btn
            variant="text"
            @click="eventDialog = false"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="primary"
            variant="flat"
            :loading="saving"
            :disabled="!eventForm.title.trim() || !eventForm.starts_at"
            @click="saveEvent"
          >
            {{ editingEvent ? '保存' : '追加' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

import { useDisplay } from 'vuetify'
import type {
  CalendarCategory,
  CalendarEvent,
  Task,
} from '~/composables/useApi'

const {
  getCalendarEvents,
  getCalendarCategories,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getTasks,
} = useApi()

const { mobile } = useDisplay()
const router = useRouter()

const now = new Date()

const currentDate = ref(
  new Date(now.getFullYear(), now.getMonth(), 1),
)

const selectedDate = ref(formatDateKey(now))

const events = ref<CalendarEvent[]>([])
const tasks = ref<Task[]>([])
const categories = ref<CalendarCategory[]>([])
const loading = ref(false)
const saving = ref(false)

const eventDialog = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)

const eventForm = reactive({
  title: '',
  description: '',
  starts_at: '',
  ends_at: '',
  is_all_day: false,
  location: '',
  category_id: '',
})

const weekDays = [
  { label: '日', class: 'sunday' },
  { label: '月', class: '' },
  { label: '火', class: '' },
  { label: '水', class: '' },
  { label: '木', class: '' },
  { label: '金', class: '' },
  { label: '土', class: 'saturday' },
]

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())

const calendarDays = computed(() => {
  const firstDay = new Date(
    currentYear.value,
    currentMonth.value,
    1,
  )

  const start = new Date(firstDay)
  start.setDate(start.getDate() - start.getDay())

  const days = []

  for (let i = 0; i < 42; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)

    const key = formatDateKey(date)

    days.push({
      date,
      key,
      isCurrentMonth: date.getMonth() === currentMonth.value,
      isToday: key === formatDateKey(now),
      events: getEventsForDate(key),
      taskDeadlines: getTaskDeadlinesForDate(key),
    })
  }

  return days
})

const selectedEvents = computed(() => {
  return getEventsForDate(selectedDate.value)
})

const selectedTaskDeadlines = computed(() => {
  return getTaskDeadlinesForDate(selectedDate.value)
})

const formatSelectedDate = computed(() => {
  const date = parseDateKey(selectedDate.value)

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
})

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateKey(value: string): Date {
  const parts = value.split('-')

  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])

  return new Date(year, month - 1, day)
}

function getMonthRange() {
  const from = new Date(
    currentYear.value,
    currentMonth.value,
    1,
  )

  from.setDate(from.getDate() - 7)

  const to = new Date(
    currentYear.value,
    currentMonth.value + 1,
    0,
  )

  to.setDate(to.getDate() + 7)

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

function getEventsForDate(dateKey: string): CalendarEvent[] {
  const dayStart = new Date(`${dateKey}T00:00:00`)
  const dayEnd = new Date(`${dateKey}T23:59:59.999`)

  return events.value
    .filter((event) => {
      const start = new Date(event.starts_at)
      const end = event.ends_at
        ? new Date(event.ends_at)
        : start

      return start <= dayEnd && end >= dayStart
    })
    .sort((a, b) => {
      return new Date(a.starts_at).getTime() -
        new Date(b.starts_at).getTime()
    })
}

function getTaskDeadlinesForDate(dateKey: string): Task[] {
  const dayStart = new Date(`${dateKey}T00:00:00`)
  const dayEnd = new Date(`${dateKey}T23:59:59.999`)

  return tasks.value
    .filter((task) => {
      if (
        (task.priority !== 'high' &&
          task.priority !== 'urgent') ||
        !task.due_at
      ) {
        return false
      }

      const dueAt = new Date(task.due_at)

      return dueAt >= dayStart && dueAt <= dayEnd
    })
    .sort((a, b) => {
      return new Date(a.due_at!).getTime() -
        new Date(b.due_at!).getTime()
    })
}

function formatTaskDeadline(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function openTask(task: Task) {
  const path =
    task.scope === 'class_representative'
      ? `/tasks/class-representative/${task.id}`
      : `/tasks/class/${task.id}`

  router.push(path)
}

async function loadCategories() {
  try {
    const response = await getCalendarCategories()
    categories.value = response.categories
  } catch (error) {
    console.error('Failed to load calendar categories:', error)
    categories.value = []
  }
}

async function loadEvents() {
  loading.value = true

  try {
    const { from, to } = getMonthRange()
    const response = await getCalendarEvents(from, to)

    events.value = response.events
  } catch (error) {
    console.error('Failed to load calendar events:', error)
    events.value = []
  } finally {
    loading.value = false
  }
}

async function loadTasks() {
  try {
    const response = await getTasks()

    tasks.value = response.tasks.filter(
      (task) =>
        (task.priority === 'high' ||
          task.priority === 'urgent') &&
        !!task.due_at,
    )
  } catch (error) {
    console.error('Failed to load calendar tasks:', error)
    tasks.value = []
  }
}

function changeMonth(offset: number) {
  currentDate.value = new Date(
    currentYear.value,
    currentMonth.value + offset,
    1,
  )

  const newMonthDate = new Date(
    currentYear.value,
    currentMonth.value + offset,
    1,
  )

  selectedDate.value = formatDateKey(newMonthDate)

  loadEvents()
}

function goToday() {
  const today = new Date()

  currentDate.value = new Date(
    today.getFullYear(),
    today.getMonth(),
    1,
  )

  selectedDate.value = formatDateKey(today)

  loadEvents()
}

function selectDate(dateKey: string) {
  selectedDate.value = dateKey

  const date = parseDateKey(dateKey)

  if (date.getMonth() !== currentMonth.value) {
    currentDate.value = new Date(
      date.getFullYear(),
      date.getMonth(),
      1,
    )

    loadEvents()
  }
}

function toDateTimeLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function openCreateDialog(dateKey: string) {
  editingEvent.value = null

  const date = parseDateKey(dateKey)
  date.setHours(18, 0, 0, 0)

  const end = new Date(date)
  end.setHours(19, 0, 0, 0)

  eventForm.title = ''
  eventForm.description = ''
  eventForm.starts_at = toDateTimeLocal(date)
  eventForm.ends_at = toDateTimeLocal(end)
  eventForm.is_all_day = false
  eventForm.location = ''
  eventForm.category_id = categories.value[0]?.id ?? ''

  eventDialog.value = true
}

function openEvent(event: CalendarEvent) {
  router.push(`/calendar/${event.id}`)
}

function toISOStringFromLocal(value: string): string {
  return new Date(value).toISOString()
}

async function saveEvent() {
  if (!eventForm.title.trim() || !eventForm.starts_at) {
    return
  }

  saving.value = true

  try {
    const body = {
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || null,
      starts_at: toISOStringFromLocal(eventForm.starts_at),
      ends_at: eventForm.ends_at
        ? toISOStringFromLocal(eventForm.ends_at)
        : null,
      is_all_day: eventForm.is_all_day,
      location: eventForm.location.trim() || null,
      category_id: eventForm.category_id || null,
    }

    if (editingEvent.value) {
      await updateCalendarEvent(
        editingEvent.value.id,
        body,
      )
    } else {
      await createCalendarEvent(body)
    }

    eventDialog.value = false
    await loadEvents()
  } catch (error) {
    console.error('Failed to save calendar event:', error)
  } finally {
    saving.value = false
  }
}

async function deleteEvent() {
  if (!editingEvent.value) {
    return
  }

  saving.value = true

  try {
    await deleteCalendarEvent(editingEvent.value.id)

    eventDialog.value = false
    await loadEvents()
  } catch (error) {
    console.error('Failed to delete calendar event:', error)
  } finally {
    saving.value = false
  }
}

function formatEventTime(event: CalendarEvent): string {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(event.starts_at))
}

function formatEventRange(event: CalendarEvent): string {
  if (event.is_all_day) {
    return '終日'
  }

  const start = new Date(event.starts_at)

  const startText = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(start)

  if (!event.ends_at) {
    return startText
  }

  const endText = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(event.ends_at))

  return `${startText}〜${endText}`
}

onMounted(async () => {
  await Promise.all([
    loadCategories(),
    loadTasks(),
  ])

  if (!eventForm.category_id) {
    const firstCategory = categories.value[0]

    if (firstCategory) {
      eventForm.category_id = firstCategory.id
    }
  }

  await loadEvents()
})
</script>

<style scoped>
.calendar-page {
  max-width: 1200px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.calendar-card {
  overflow: hidden;
}

.calendar-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.calendar-title {
  min-width: 130px;
  text-align: center;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
}

.calendar-title span {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.6);
}

.calendar-title strong {
  font-size: 22px;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 0;
}

.weekday.sunday {
  color: #d32f2f;
}

.weekday.saturday {
  color: #1976d2;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.calendar-day {
  min-width: 0;
  min-height: 112px;
  padding: 6px;
  border-right: 1px solid rgba(0, 0, 0, 0.07);
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  background: white;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.calendar-day:hover {
  background: rgba(18, 58, 92, 0.04);
}

.calendar-day:nth-child(7n) {
  border-right: none;
}

.calendar-day.is-other-month {
  background: rgba(0, 0, 0, 0.025);
}

.calendar-day.is-other-month .day-number {
  color: rgba(0, 0, 0, 0.3);
}

.calendar-day.is-selected {
  box-shadow: inset 0 0 0 2px rgba(18, 58, 92, 0.25);
}

.day-number {
  height: 26px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-shrink: 0;
}

.day-number span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 13px;
}

.calendar-day.is-today .day-number span {
  background: rgb(var(--v-theme-primary));
  color: white;
  font-weight: 700;
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.event-chip {
  min-width: 0;
  overflow: hidden;
  border-left: 3px solid rgb(var(--v-theme-primary));
  background: rgba(18, 58, 92, 0.07);
  border-radius: 3px;
  padding: 2px 4px;
  line-height: 1.25;
}

.event-chip.is-all-day {
  border-left: none;
  color: white;
}

.event-chip.is-all-day .event-title {
  color: white;
}

.event-time {
  font-size: 9px;
  color: rgba(0, 0, 0, 0.55);
  margin-right: 3px;
}

.event-title {
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-deadline-chip {
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 3px;
  border-left: 3px solid rgb(var(--v-theme-warning));
  background: rgba(251, 140, 0, 0.08);
  border-radius: 3px;
  padding: 2px 4px;
  line-height: 1.25;
}

.task-deadline-chip.is-urgent {
  border-left-color: rgb(var(--v-theme-error));
  background: rgba(229, 57, 53, 0.08);
}

.task-deadline-label {
  flex-shrink: 0;
  font-size: 8px;
  font-weight: 700;
}

.task-deadline-title {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.task-deadline-list {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.task-deadline-list-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
}

.task-deadline-list-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 10px 16px;
  border: none;
  border-left: 5px solid rgb(var(--v-theme-warning));
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  background: white;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}

.task-deadline-list-item.is-urgent {
  border-left-color: rgb(var(--v-theme-error));
}

.task-deadline-list-item:hover {
  background: rgba(18, 58, 92, 0.04);
}

.task-deadline-list-item:last-child {
  border-bottom: none;
}

.task-deadline-list-priority {
  flex: 0 0 34px;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.task-deadline-list-content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 600px) {
  .task-deadline-list {
    margin-top: 12px;
    padding-top: 12px;
  }

  .task-deadline-list-title {
    padding: 0 16px;
  }

  .task-deadline-list-item {
    padding: 10px 16px;
  }

  .task-deadline-list-priority {
    flex-basis: 32px;
  }
}

@media (max-width: 600px) {
  .task-deadline-chip {
    padding: 2px;
    border-left-width: 2px;
  }

  .task-deadline-label {
    font-size: 7px;
  }

  .task-deadline-title {
    font-size: 9px;
  }
}

.more-events {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.55);
  padding: 1px 3px;
}

.selected-day-card {
  overflow: hidden;
}

.selected-day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
}

.empty-events {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
}

.event-list {
  display: flex;
  flex-direction: column;
}

.event-list-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: white;
  text-align: left;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  cursor: pointer;
}

.event-list-item:last-child {
  border-bottom: none;
}

.event-list-item:hover {
  background: rgba(18, 58, 92, 0.04);
}

.category-color {
  width: 14px;
  height: 14px;
  min-width: 14px;
  border-radius: 50%;
  display: inline-block;
}

.event-color {
  width: 5px;
  min-width: 5px;
  align-self: stretch;
  border-radius: 4px;
}

.event-list-content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 600px) {
  .calendar-page {
    padding-left: 8px;
    padding-right: 8px;
  }

  .calendar-header {
    padding: 0 4px;
  }

  .calendar-day {
    min-height: 78px;
    padding: 1px 2px 3px;
  }

  .day-number {
    height: 20px;
  }

  .day-number span {
    width: 22px;
    height: 22px;
    font-size: 11px;
  }

  .event-chip {
    padding: 2px;
    border-left-width: 2px;
  }

  .event-time {
    display: none;
  }

  .event-title {
    font-size: 9px;
  }

  .more-events {
    font-size: 9px;
  }

  .selected-day-header {
    align-items: flex-start;
  }

  .selected-day-header .v-btn {
    flex-shrink: 0;
  }
}
</style>

<template>
  <v-container class="calendar-event-detail-page py-4">
    <div class="d-flex align-center mb-6">
      <LayoutBackButton />
    

      <div class="ml-2">
        <h1 class="text-h5 font-weight-bold">
          予定詳細
        </h1>
      </div>
    </div>

    <v-progress-linear
      v-if="loading"
      indeterminate
      color="primary"
      class="mb-4"
    />

    <v-card
      v-if="event"
      rounded="xl"
      elevation="1"
    >
      <div
        class="event-detail-color"
        :style="{
          backgroundColor: event.color || '#1976D2',
        }"
      />

      <v-card-text class="pa-5">
        <div class="text-h5 font-weight-bold">
          {{ event.title }}
        </div>

        <div class="detail-list mt-5">
          <div class="detail-item">
            <v-icon size="22" color="primary">
              mdi-clock-outline
            </v-icon>

            <div>
              <div class="text-body-2 text-medium-emphasis">
                日時
              </div>
              <div class="text-body-1">
                {{ formatEventRange(event) }}
              </div>
            </div>
          </div>

          <div
            v-if="event.location"
            class="detail-item"
          >
            <v-icon size="22" color="primary">
              mdi-map-marker-outline
            </v-icon>

            <div>
              <div class="text-body-2 text-medium-emphasis">
                場所
              </div>
              <div class="text-body-1">
                {{ event.location }}
              </div>
            </div>
          </div>

          <div class="detail-item">
            <v-icon size="22" color="primary">
              mdi-tag-outline
            </v-icon>

            <div>
              <div class="text-body-2 text-medium-emphasis">
                カテゴリ
              </div>

              <div class="d-flex align-center text-body-1">
                <span
                  v-if="event.category_color || event.color"
                  class="category-color mr-2"
                  :style="{
                    backgroundColor:
                      event.category_color ||
                      event.color ||
                      '#1976D2',
                  }"
                />

                {{ event.category_name || 'その他' }}
              </div>
            </div>
          </div>

          <div class="detail-item">
            <v-icon size="22" color="primary">
              mdi-text-box-outline
            </v-icon>

            <div class="detail-description">
              <div class="text-body-2 text-medium-emphasis">
                詳細
              </div>

              <div
                v-if="event.description"
                class="text-body-1 event-description"
              >
                {{ event.description }}
              </div>

              <div
                v-else
                class="text-body-1 text-medium-emphasis"
              >
                なし
              </div>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-text class="pa-5 attendance-section">
        <div class="text-subtitle-1 font-weight-bold mb-3">
          参加状況
        </div>

        <v-btn-toggle
          v-if="canEditOwnAttendance"
          v-model="attendanceStatus"
          mandatory
          divided
          color="primary"
          class="attendance-toggle"
          :disabled="attendanceLoading || attendanceSaving"
        >
          <v-btn value="attending">
            <v-icon start>mdi-check-circle-outline</v-icon>
            参加
          </v-btn>
          <v-btn value="undecided">
            <v-icon start>mdi-help-circle-outline</v-icon>
            未定
          </v-btn>
          <v-btn value="not_attending">
            <v-icon start>mdi-close-circle-outline</v-icon>
            不参加
          </v-btn>
        </v-btn-toggle>

        <div
          v-else
          class="text-body-2 text-medium-emphasis"
        >
          自分の出欠を変更する権限がありません。
        </div>

        <v-progress-linear
          v-if="attendanceLoading"
          indeterminate
          color="primary"
          class="mt-4"
        />

        <div
          v-else-if="canViewAttendance"
          class="attendance-counts mt-4"
        >
          <div class="attendance-count">
            <v-icon size="18" color="success">mdi-check-circle</v-icon>
            <span>参加</span>
            <strong>{{ attendance.counts.attending }}</strong>
          </div>
          <div class="attendance-count">
            <v-icon size="18" color="warning">mdi-help-circle</v-icon>
            <span>未定</span>
            <strong>{{ attendance.counts.undecided }}</strong>
          </div>
          <div class="attendance-count">
            <v-icon size="18" color="error">mdi-close-circle</v-icon>
            <span>不参加</span>
            <strong>{{ attendance.counts.not_attending }}</strong>
          </div>
        </div>

        <div
          v-if="attendanceSaving"
          class="text-body-2 text-medium-emphasis mt-3"
        >
          参加状況を更新しています…
        </div>

        <v-divider
          v-if="canViewNonrespondents"
          class="my-5"
        />

        <div v-if="canViewNonrespondents">
          <div class="d-flex align-center justify-space-between mb-3">
            <div class="text-subtitle-2 font-weight-bold">
              参加状況一覧
            </div>
            <v-btn
              icon="mdi-refresh"
              variant="text"
              size="small"
              aria-label="参加状況一覧を更新"
              :loading="nonrespondentsLoading"
              @click="loadNonrespondents"
            />
          </div>

          <v-progress-linear
            v-if="nonrespondentsLoading"
            indeterminate
            color="primary"
          />

          <v-alert
            v-else-if="nonrespondentsError"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            参加状況一覧を読み込めませんでした。
            <v-btn
              variant="text"
              size="small"
              @click="loadNonrespondents"
            >
              再試行
            </v-btn>
          </v-alert>

          <template v-else>
            <v-tabs
              v-model="attendanceListTab"
              color="primary"
              grow
              density="comfortable"
              class="attendance-list-tabs mb-3"
            >
              <v-tab value="attending">
                参加 {{ attendanceListCounts.attending }}
              </v-tab>
              <v-tab value="not_attending">
                不参加 {{ attendanceListCounts.not_attending }}
              </v-tab>
              <v-tab value="undecided">
                未定 {{ attendanceListCounts.undecided }}
              </v-tab>
              <v-tab value="unanswered">
                未回答 {{ attendanceListCounts.unanswered }}
              </v-tab>
            </v-tabs>

            <v-list
              v-if="filteredAttendanceUsers.length > 0"
              density="compact"
              class="pa-0"
            >
              <v-list-item
                v-for="person in filteredAttendanceUsers"
                :key="person.id"
                :title="person.nickname || person.name"
                :subtitle="`${person.student_number} · ${
                  person.status === 'attending'
                    ? '参加'
                    : person.status === 'not_attending'
                      ? '不参加'
                      : person.status === 'undecided'
                        ? '未定'
                        : '未回答'
                }`"
              >
                <template #append>
                  <v-menu v-if="canEditOtherAttendance">
                    <template #activator="{ props }">
                      <v-btn
                        v-bind="props"
                        icon="mdi-pencil-outline"
                        variant="text"
                        size="small"
                        :disabled="updatingUserId === person.id"
                        :loading="updatingUserId === person.id"
                        :aria-label="`${person.name}の出欠を変更`"
                      />
                    </template>
                    <v-list density="compact">
                      <v-list-item
                        title="参加に変更"
                        @click="updateOtherAttendance(person, 'attending')"
                      />
                      <v-list-item
                        title="未定に変更"
                        @click="updateOtherAttendance(person, 'undecided')"
                      />
                      <v-list-item
                        title="不参加に変更"
                        @click="updateOtherAttendance(person, 'not_attending')"
                      />
                    </v-list>
                  </v-menu>
                </template>
              </v-list-item>
            </v-list>

            <div
              v-else
              class="text-body-2 text-medium-emphasis py-4 text-center"
            >
              この区分のユーザーはいません。
            </div>
          </template>
        </div>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer />

        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-pencil-outline"
          @click="openEditDialog"
        >
          編集
        </v-btn>
      </v-card-actions>
    </v-card>

    <v-alert
      v-else-if="!loading"
      type="error"
      variant="tonal"
      rounded="xl"
    >
      予定が見つかりませんでした。
    </v-alert>

    <v-dialog
      v-model="editDialog"
      :fullscreen="mobile"
      max-width="520"
    >
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center">
          <span>予定を編集</span>

          <v-spacer />

          <v-btn
            icon="mdi-close"
            variant="text"
            @click="editDialog = false"
          />
        </v-card-title>

        <v-card-text>
          <v-text-field
            v-model="eventForm.title"
            label="予定名"
            variant="outlined"
            autofocus
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
            class="mt-2"
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
            v-if="canDelete"
            color="error"
            variant="text"
            prepend-icon="mdi-delete-outline"
            :loading="deleting"
            @click="deleteEvent"
          >
            削除
          </v-btn>

          <v-spacer />

          <v-btn
            variant="text"
            @click="editDialog = false"
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
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import {
  formatJstDate,
  formatJstDateTime,
  formatJstDateTimeLocal,
  jstDateTimeLocalToIso,
} from '~/utils/jst'

definePageMeta({
  middleware: 'auth',
})

import { useDisplay } from 'vuetify'
import { useConfirmDialog } from '~/composables/useConfirmDialog'
import { useSnackbar } from '~/composables/useSnackbar'
import type {
  CalendarAttendanceStatus,
  CalendarCategory,
  CalendarEvent,
  CalendarEventAttendance,
  CalendarNonrespondent,
} from '~/composables/useApi'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { mobile } = useDisplay()
const { confirm } = useConfirmDialog()
const snackbar = useSnackbar()

const {
  getCalendarEvent,
  getCalendarCategories,
  updateCalendarEvent,
  deleteCalendarEvent: deleteCalendarEventApi,
  getCalendarEventAttendance,
  updateCalendarEventAttendance,
  getCalendarNonrespondents,
  updateUserCalendarAttendance,
} = useApi()

const event = ref<CalendarEvent | null>(null)
const categories = ref<CalendarCategory[]>([])
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const attendanceLoading = ref(false)
const attendanceSaving = ref(false)

const attendance = ref<CalendarEventAttendance>({
  event_id: '',
  my_status: null,
  counts: {
    attending: 0,
    not_attending: 0,
    undecided: 0,
  },
})

const attendanceStatus = ref<CalendarAttendanceStatus | null>(null)

const canDelete = computed(() =>
  auth.hasPermission('schedule.delete'),
)
const canViewAttendance = computed(() =>
  auth.hasPermission('attendance.view'),
)
const canEditOwnAttendance = computed(() =>
  auth.hasPermission('schedule.attendance'),
)
const canViewNonrespondents = computed(() =>
  auth.hasPermission('attendance.nonrespondents.view'),
)
const canEditOtherAttendance = computed(() =>
  auth.hasPermission('attendance.edit'),
)

const nonrespondents = ref<CalendarNonrespondent[]>([])
const attendanceListTab = ref<'attending' | 'not_attending' | 'undecided' | 'unanswered'>('attending')

const attendanceListCounts = computed(() => ({
  attending: nonrespondents.value.filter(person => person.status === 'attending').length,
  not_attending: nonrespondents.value.filter(person => person.status === 'not_attending').length,
  undecided: nonrespondents.value.filter(person => person.status === 'undecided').length,
  unanswered: nonrespondents.value.filter(person => person.status === null).length,
}))

const filteredAttendanceUsers = computed(() =>
  nonrespondents.value.filter(person =>
    attendanceListTab.value === 'unanswered'
      ? person.status === null
      : person.status === attendanceListTab.value,
  ),
)

const nonrespondentsLoading = ref(false)
const nonrespondentsError = ref(false)
const updatingUserId = ref<string | null>(null)

const editDialog = ref(false)

const eventForm = reactive({
  title: '',
  description: '',
  starts_at: '',
  ends_at: '',
  is_all_day: false,
  location: '',
  category_id: '',
})

function toDateTimeLocal(value: string) {
  return formatJstDateTimeLocal(value)
}

function formatDateTime(value: string) {
  return formatJstDateTime(value)
}

function formatDateOnly(value: string) {
  return formatJstDate(value)
}

function formatEventRange(value: CalendarEvent) {
  if (value.is_all_day) {
    const start = formatDateOnly(value.starts_at)

    if (!value.ends_at) {
      return `${start}（終日）`
    }

    const end = formatDateOnly(value.ends_at)

    if (start === end) {
      return `${start}（終日）`
    }

    return `${start}〜${end}（終日）`
  }

  const start = formatDateTime(value.starts_at)

  if (!value.ends_at) {
    return start
  }

  return `${start}〜${formatDateTime(value.ends_at)}`
}

function openEditDialog() {
  if (!event.value) {
    return
  }

  eventForm.title = event.value.title
  eventForm.description = event.value.description ?? ''
  eventForm.starts_at = toDateTimeLocal(event.value.starts_at)
  eventForm.ends_at = event.value.ends_at
    ? toDateTimeLocal(event.value.ends_at)
    : ''
  eventForm.is_all_day = Boolean(event.value.is_all_day)
  eventForm.location = event.value.location ?? ''
  eventForm.category_id =
    event.value.category_id ||
    categories.value[0]?.id ||
    ''

  editDialog.value = true
}

async function saveEvent() {
  if (!event.value || !eventForm.title.trim() || !eventForm.starts_at) {
    return
  }

  saving.value = true

  try {
    event.value = await updateCalendarEvent(
      event.value.id,
      {
        title: eventForm.title.trim(),
        description: eventForm.description.trim() || null,
        starts_at: jstDateTimeLocalToIso(eventForm.starts_at),
        ends_at: eventForm.ends_at
          ? jstDateTimeLocalToIso(eventForm.ends_at)
          : null,
        is_all_day: eventForm.is_all_day,
        location: eventForm.location.trim() || null,
        category_id: eventForm.category_id || null,
      },
    )

    editDialog.value = false
  } finally {
    saving.value = false
  }
}

async function deleteEvent() {
  if (!event.value || !canDelete.value) {
    return
  }

  const confirmed = await confirm({
    title: '予定を削除',
    message: `「${event.value.title}」を削除しますか？\n\nこの操作は元に戻せません。`,
    confirmText: '削除',
    confirmColor: 'error',
  })

  if (!confirmed || !event.value) {
    return
  }

  deleting.value = true

  try {
    await deleteCalendarEventApi(event.value.id)

    snackbar.success('予定を削除しました。')

    await navigateTo('/calendar')
  } catch (error) {
    console.error(error)
    snackbar.error('予定の削除に失敗しました。')
  } finally {
    deleting.value = false
  }
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

async function loadNonrespondents() {
  if (!canViewNonrespondents.value || !event.value) {
    return
  }

  nonrespondentsLoading.value = true
  nonrespondentsError.value = false

  try {
    const response = await getCalendarNonrespondents(event.value.id)
    nonrespondents.value = response.users
  } catch (error) {
    console.error('Failed to load calendar nonrespondents:', error)
    nonrespondentsError.value = true
  } finally {
    nonrespondentsLoading.value = false
  }
}

async function updateOtherAttendance(
  person: CalendarNonrespondent,
  status: CalendarAttendanceStatus,
) {
  if (
    !canEditOtherAttendance.value ||
    !event.value ||
    updatingUserId.value
  ) {
    return
  }

  updatingUserId.value = person.id

  try {
    await updateUserCalendarAttendance(
      event.value.id,
      person.id,
      status,
    )

    snackbar.show('出欠を更新しました。')
    await Promise.all([
      loadNonrespondents(),
      loadAttendance(),
    ])
  } catch (error) {
    console.error('Failed to update another user attendance:', error)
    snackbar.show('出欠の更新に失敗しました。')
  } finally {
    updatingUserId.value = null
  }
}

async function loadAttendance() {
  attendanceLoading.value = true

  try {
    const response = await getCalendarEventAttendance(
      String(route.params.id),
    )

    attendance.value = response
    attendanceStatus.value = response.my_status
  } catch (error) {
    console.error('Failed to load calendar attendance:', error)
  } finally {
    attendanceLoading.value = false
  }
}

async function changeAttendance(
  status: CalendarAttendanceStatus,
) {
  if (attendanceSaving.value) {
    return
  }

  attendanceSaving.value = true

  try {
    const response = await updateCalendarEventAttendance(
      String(route.params.id),
      status,
    )

    attendance.value = response
    attendanceStatus.value = response.my_status
    snackbar.success('参加状況を更新しました。')
  } catch (error) {
    console.error('Failed to update calendar attendance:', error)
    attendanceStatus.value = attendance.value.my_status
    snackbar.error('参加状況の更新に失敗しました。')
  } finally {
    attendanceSaving.value = false
  }
}

watch(
  attendanceStatus,
  (status, previousStatus) => {
    if (
      status === null ||
      status === previousStatus ||
      attendanceLoading.value ||
      attendanceSaving.value
    ) {
      return
    }

    void changeAttendance(status)
  },
)

async function loadEvent() {
  loading.value = true

  try {
    event.value = await getCalendarEvent(String(route.params.id))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadCategories(),
    loadEvent(),
    loadAttendance(),
  ])

  if (canViewNonrespondents.value) {
    await loadNonrespondents()
  }
})
</script>

<style scoped>
.calendar-event-detail-page {
  max-width: 720px;
}

.attendance-section {
  background: rgba(var(--v-theme-primary), 0.025);
}

.attendance-toggle {
  width: 100%;
}

.attendance-toggle :deep(.v-btn) {
  flex: 1;
}

.attendance-counts {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.attendance-count {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
}

.attendance-count strong {
  font-size: 16px;
  margin-left: 2px;
}

@media (max-width: 600px) {
  .attendance-toggle {
    width: 100%;
  }

  .attendance-toggle :deep(.v-btn) {
    min-width: 0;
    padding-inline: 8px;
  }

  .attendance-toggle :deep(.v-btn .v-icon) {
    margin-inline-end: 3px;
  }

  .attendance-counts {
    gap: 10px;
  }
}

.event-detail-color {
  height: 6px;
  width: 100%;
}

.category-color {
  width: 14px;
  height: 14px;
  min-width: 14px;
  border-radius: 50%;
  display: inline-block;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.detail-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.detail-description {
  min-width: 0;
  flex: 1;
}

.event-description {
  white-space: pre-wrap;
  line-height: 1.7;
}
</style>

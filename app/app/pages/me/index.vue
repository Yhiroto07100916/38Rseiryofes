<template>
  <v-container class="py-6 px-4">
    <div class="mb-6">
      <h1 class="text-h5 font-weight-bold">
        マイページ
      </h1>
      <p class="text-body-2 text-medium-emphasis mt-1">
        あなたの星陵祭準備をまとめて確認できます
      </p>
    </div>

    <v-row>
      <v-col cols="12" md="5">
        <v-card
          rounded="xl"
          elevation="1"
          class="mb-4"
        >
          <v-card-text class="pa-5">
            <div class="d-flex align-center mb-5">
              <v-avatar
                size="56"
                color="primary"
                class="mr-4"
              >
                <span class="text-h6 font-weight-bold">
                  {{ userInitial }}
                </span>
              </v-avatar>

              <div class="min-width-0">
                <div class="text-h6 font-weight-bold text-truncate">
                  {{ auth.user?.nickname || auth.user?.name || '---' }}
                </div>

                <div
                  v-if="auth.user?.nickname"
                  class="text-body-2 text-medium-emphasis text-truncate"
                >
                  {{ auth.user.name }}
                </div>
              </div>
            </div>

            <div class="profile-row">
              <span class="profile-label">名前</span>
              <span>{{ auth.user?.name || '---' }}</span>
            </div>

            <div class="profile-row">
              <span class="profile-label">学籍番号</span>
              <span>{{ auth.user?.student_number || '---' }}</span>
            </div>

            <div class="profile-row">
              <span class="profile-label">クラス</span>
              <span>38R</span>
            </div>

            <div class="profile-row">
              <span class="profile-label">アカウント権限</span>
              <div class="d-flex flex-wrap justify-end ga-1">
                <v-chip
                  v-for="role in auth.accountRoles"
                  :key="role.id"
                  size="small"
                  variant="tonal"
                >
                  {{ role.name }}
                </v-chip>

                <span
                  v-if="auth.accountRoles.length === 0"
                  class="text-medium-emphasis"
                >
                  ---
                </span>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <v-card
          rounded="xl"
          elevation="1"
        >
          <v-card-title class="px-5 pt-5">
            <v-icon
              icon="mdi-account-group"
              class="mr-2"
            />
            あなたの役割
          </v-card-title>

          <v-card-text class="px-5 pb-5">
            <div
              v-if="auth.roles.length > 0"
              class="d-flex flex-column ga-3"
            >
              <v-card
                v-for="role in auth.roles"
                :key="role.id"
                variant="tonal"
                rounded="lg"
              >
                <v-card-text class="py-3">
                  <div class="font-weight-medium">
                    {{ role.name }}
                  </div>

                  <div
                    v-if="role.description"
                    class="text-body-2 text-medium-emphasis mt-1"
                  >
                    {{ role.description }}
                  </div>
                </v-card-text>
              </v-card>
            </div>

            <div
              v-else
              class="text-body-2 text-medium-emphasis"
            >
              現在登録されている役割はありません。
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="7">
        <v-card
          rounded="xl"
          elevation="1"
          class="mb-4"
        >
          <v-card-title class="px-5 pt-5 d-flex align-center">
            <v-icon
              icon="mdi-calendar-clock"
              class="mr-2"
            />
            今日・直近の予定

            <v-spacer />

            
          </v-card-title>

          <v-card-text class="px-5 pb-5">
            <v-progress-linear
              v-if="loadingEvents"
              indeterminate
              class="mb-4"
            />

            <div
              v-if="!loadingEvents && upcomingEvents.length > 0"
              class="d-flex flex-column ga-2"
            >
              <v-card
                v-for="event in upcomingEvents"
                :key="event.id"
                variant="tonal"
                rounded="lg"
                class="event-card"
                @click="navigateTo(`/calendar/${event.id}`)"
              >
                <v-card-text class="py-3">
                  <div class="d-flex align-start">
                    <div class="event-date mr-3">
                      <div class="text-caption text-medium-emphasis">
                        {{ formatMonthDay(event.starts_at) }}
                      </div>

                      <div class="text-body-2 font-weight-bold">
                        {{ formatTime(event.starts_at) }}
                      </div>
                    </div>

                    <div class="min-width-0">
                      <div class="font-weight-medium">
                        {{ event.title }}
                      </div>

                      <div
                        v-if="event.ends_at"
                        class="text-body-2 text-medium-emphasis mt-1"
                      >
                        {{ formatEventTime(event) }}
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </div>

            <div
              v-else-if="!loadingEvents"
              class="empty-state"
            >
              <v-icon
                icon="mdi-calendar-blank-outline"
                size="32"
                class="mb-2"
              />
              <div>直近の予定はありません。</div>
            </div>
          </v-card-text>
        </v-card>

        <v-card
          rounded="xl"
          elevation="1"
          class="mb-4"
        >
          <v-card-title class="px-5 pt-5 d-flex align-center">
            <v-icon
              icon="mdi-checkbox-marked-circle-outline"
              class="mr-2"
            />
            自分のタスク

            <v-spacer />

            
          </v-card-title>

          <v-card-text class="px-5 pb-5">
            <v-progress-linear
              v-if="loadingTasks"
              indeterminate
              class="mb-4"
            />

            <div
              v-if="!loadingTasks && myTasks.length > 0"
              class="d-flex flex-column ga-2"
            >
              <v-card
                v-for="task in myTasks"
                :key="task.id"
                variant="tonal"
                rounded="lg"
              >
                <v-card-text class="py-3">
                  <div class="d-flex align-start">
                    <v-icon
                      :icon="getPriorityIcon(task.priority)"
                      :color="getPriorityColor(task.priority)"
                      class="mr-3 mt-1"
                    />

                    <div class="min-width-0 flex-grow-1">
                      <div class="font-weight-medium">
                        {{ task.title }}
                      </div>

                      <div class="d-flex flex-wrap ga-2 mt-1">
                        <span class="text-body-2 text-medium-emphasis">
                          {{ getStatusLabel(task.status) }}
                        </span>

                        <span
                          v-if="task.due_at"
                          class="text-body-2 text-medium-emphasis"
                        >
                          期限：{{ formatDate(task.due_at) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </div>

            <div
              v-else-if="!loadingTasks"
              class="empty-state"
            >
              <v-icon
                icon="mdi-check-all"
                size="32"
                class="mb-2"
              />
              <div>現在、自分の未完了タスクはありません。</div>
            </div>
          </v-card-text>
        </v-card>

        <v-card
          rounded="xl"
          elevation="1"
          class="mb-4"
        >
          <v-card-title class="px-5 pt-5 d-flex align-center">
            <v-icon
              icon="mdi-calendar-check-outline"
              class="mr-2"
            />
            出欠・参加状況

            <v-spacer />

            
          </v-card-title>

          <v-card-text class="px-5 pb-5">
            <v-progress-linear
              v-if="loadingAttendance"
              indeterminate
              class="mb-4"
            />

            <div
              v-if="!loadingAttendance && attendanceEvents.length > 0"
              class="d-flex flex-column ga-2"
            >
              <v-card
                v-for="event in attendanceEvents"
                :key="event.id"
                variant="tonal"
                rounded="lg"
                @click="navigateTo(`/calendar/${event.id}`)"
              >
                <v-card-text class="py-3">
                  <div class="d-flex align-center">
                    <div class="min-width-0 flex-grow-1">
                      <div class="font-weight-medium">
                        {{ event.title }}
                      </div>

                      <div class="text-body-2 text-medium-emphasis mt-1">
                        {{ formatMonthDay(event.starts_at) }}
                        {{ formatTime(event.starts_at) }}
                      </div>
                    </div>

                    <v-chip
                      :color="getAttendanceColor(event.my_status)"
                      size="small"
                      variant="tonal"
                    >
                      {{ getAttendanceLabel(event.my_status) }}
                    </v-chip>
                  </div>
                </v-card-text>
              </v-card>
            </div>

            <div
              v-else-if="!loadingAttendance"
              class="empty-state"
            >
              <v-icon
                icon="mdi-calendar-check-outline"
                size="32"
                class="mb-2"
              />
              <div>今後の予定はありません。</div>
            </div>
          </v-card-text>
        </v-card>

        <v-card
          rounded="xl"
          elevation="1"
          class="mb-4"
        >
          <v-card-title class="px-5 pt-5 d-flex align-center">
            <v-icon
              icon="mdi-bell-outline"
              class="mr-2"
            />
            自分に関係するお知らせ

            <v-spacer />

            
          </v-card-title>

          <v-card-text class="px-5 pb-5">
            <v-progress-linear
              v-if="loadingNews"
              indeterminate
              class="mb-4"
            />

            <div
              v-if="!loadingNews && relevantNews.length > 0"
              class="d-flex flex-column ga-2"
            >
              <v-card
                v-for="newsItem in relevantNews"
                :key="newsItem.id"
                variant="tonal"
                rounded="lg"
                class="news-card"
                @click="navigateTo(`/news/${newsItem.id}`)"
              >
                <v-card-text class="py-3">
                  <div class="d-flex align-start">
                    <v-icon
                      :icon="newsItem.is_important ? 'mdi-alert-circle' : 'mdi-bell-outline'"
                      :color="newsItem.is_important ? 'error' : undefined"
                      class="mr-3 mt-1"
                    />

                    <div class="min-width-0 flex-grow-1">
                      <div class="font-weight-medium">
                        {{ newsItem.title }}
                      </div>

                      <div class="d-flex flex-wrap ga-2 mt-1">
                        <span class="text-body-2 text-medium-emphasis">
                          {{ formatDate(newsItem.created_at) }}
                        </span>

                        <span
                          v-if="newsItem.relatedTask"
                          class="text-body-2 text-medium-emphasis"
                        >
                          タスク関連
                        </span>

                        <span
                          v-if="newsItem.relatedEvent"
                          class="text-body-2 text-medium-emphasis"
                        >
                          予定関連
                        </span>
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </div>

            <div
              v-else-if="!loadingNews"
              class="empty-state"
            >
              <v-icon
                icon="mdi-bell-off-outline"
                size="32"
                class="mb-2"
              />
              <div>現在、自分に関係するお知らせはありません。</div>
            </div>
          </v-card-text>
        </v-card>

        <v-card
          rounded="xl"
          elevation="1"
        >
          <v-card-title class="px-5 pt-5">
            <v-icon
              icon="mdi-cog-outline"
              class="mr-2"
            />
            アカウント設定
          </v-card-title>

          <v-card-text class="px-5 pb-5">
            <v-list class="pa-0">
              <v-list-item
                prepend-icon="mdi-account-edit-outline"
                title="ニックネーム変更"
                subtitle="表示名を変更します"
                @click="nicknameDialog = true"
              >
                <template #append>
                  <v-icon icon="mdi-chevron-right" />
                </template>
              </v-list-item>

              <v-divider />

              <v-list-item
                prepend-icon="mdi-lock-outline"
                title="パスワード変更"
                subtitle="ログインパスワードを変更します"
                @click="passwordDialog = true"
              >
                <template #append>
                  <v-icon icon="mdi-chevron-right" />
                </template>
              </v-list-item>

              <v-divider />

              <v-list-item
                prepend-icon="mdi-logout"
                title="ログアウト"
                subtitle="この端末からログアウトします"
                @click="logout"
              >
                <template #append>
                  <v-icon icon="mdi-chevron-right" />
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog
      v-model="nicknameDialog"
      max-width="480"
    >
      <v-card rounded="xl">
        <v-card-title class="px-5 pt-5">
          ニックネーム変更
        </v-card-title>

        <v-card-text class="px-5">
          <v-alert
            v-if="nicknameError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ nicknameError }}
          </v-alert>

          <v-alert
            v-if="nicknameSuccess"
            type="success"
            variant="tonal"
            class="mb-4"
          >
            ニックネームを変更しました。
          </v-alert>

          <v-text-field
            v-model="nickname"
            label="ニックネーム"
            maxlength="30"
            counter
            variant="outlined"
            autocomplete="nickname"
          />
        </v-card-text>

        <v-card-actions class="px-5 pb-5">
          <v-spacer />

          <v-btn
            variant="text"
            :disabled="changingNickname"
            @click="closeNicknameDialog"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="primary"
            variant="flat"
            :loading="changingNickname"
            @click="changeNickname"
          >
            変更する
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="passwordDialog"
      max-width="480"
    >
      <v-card rounded="xl">
        <v-card-title class="px-5 pt-5">
          パスワード変更
        </v-card-title>

        <v-card-text class="px-5">
          <v-alert
            v-if="passwordError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ passwordError }}
          </v-alert>

          <v-alert
            v-if="passwordSuccess"
            type="success"
            variant="tonal"
            class="mb-4"
          >
            パスワードを変更しました。
          </v-alert>

          <v-text-field
            v-model="passwordForm.current_password"
            label="現在のパスワード"
            type="password"
            autocomplete="current-password"
            variant="outlined"
            class="mb-2"
          />

          <v-text-field
            v-model="passwordForm.new_password"
            label="新しいパスワード"
            type="password"
            autocomplete="new-password"
            variant="outlined"
            class="mb-2"
          />

          <v-text-field
            v-model="passwordForm.new_password_confirmation"
            label="新しいパスワード（確認）"
            type="password"
            autocomplete="new-password"
            variant="outlined"
          />
        </v-card-text>

        <v-card-actions class="px-5 pb-5">
          <v-spacer />

          <v-btn
            variant="text"
            :disabled="changingPassword"
            @click="closePasswordDialog"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="primary"
            variant="flat"
            :loading="changingPassword"
            @click="changePassword"
          >
            変更する
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from 'vue'
import {
  type News,
  type NewsWithCalendarEvents,
  type Task,
  useApi,
} from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  middleware: 'auth',
})

interface CalendarEvent {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
}

type AttendanceStatus =
  | 'attending'
  | 'not_attending'
  | 'undecided'
  | null

interface AttendanceEvent extends CalendarEvent {
  my_status: AttendanceStatus
}

interface RelevantNews extends News {
  relatedTask: boolean
  relatedEvent: boolean
}

const auth = useAuthStore()

const {
  apiFetch,
  getCalendarEvents,
  getCalendarEventAttendance,
  getTasks,
  getNews,
  getNewsById,
} = useApi()

const loadingEvents = ref(true)
const loadingTasks = ref(true)
const loadingNews = ref(true)
const loadingAttendance = ref(true)

const upcomingEvents = ref<CalendarEvent[]>([])
const attendanceEvents = ref<AttendanceEvent[]>([])
const myTasks = ref<Task[]>([])
const relevantNews = ref<RelevantNews[]>([])

const nicknameDialog = ref(false)
const changingNickname = ref(false)
const nicknameError = ref('')
const nicknameSuccess = ref(false)
const nickname = ref('')

const passwordDialog = ref(false)
const changingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref(false)

const passwordForm = ref({
  current_password: '',
  new_password: '',
  new_password_confirmation: '',
})

const userInitial = computed(() => {
  const name = auth.user?.nickname || auth.user?.name || ''

  return name.charAt(0) || '?'
})

const formatDate = (value: string) => {
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

const formatMonthDay = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

const formatTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatEventTime = (event: CalendarEvent) => {
  const start = formatTime(event.starts_at)

  if (!event.ends_at) {
    return start
  }

  return `${start}〜${formatTime(event.ends_at)}`
}

const getStatusLabel = (status: Task['status']) => {
  const labels: Record<Task['status'], string> = {
    todo: '未着手',
    in_progress: '進行中',
    review: '確認待ち',
    done: '完了',
  }

  return labels[status]
}

const getPriorityIcon = (priority: Task['priority']) => {
  const icons: Record<Task['priority'], string> = {
    low: 'mdi-flag-outline',
    medium: 'mdi-flag',
    high: 'mdi-flag',
    urgent: 'mdi-alert',
  }

  return icons[priority]
}

const getPriorityColor = (priority: Task['priority']) => {
  const colors: Record<Task['priority'], string> = {
    low: 'grey',
    medium: 'blue',
    high: 'orange',
    urgent: 'error',
  }

  return colors[priority]
}

const loadEvents = async () => {
  loadingEvents.value = true

  try {
    const now = new Date()

    const from = now.toISOString()

    const to = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 14,
      23,
      59,
      59,
      999,
    ).toISOString()

    const response = await getCalendarEvents(from, to)

    upcomingEvents.value = response.events
      .filter((event) => {
        const start = new Date(event.starts_at).getTime()

        return !Number.isNaN(start) && start >= now.getTime()
      })
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() -
          new Date(b.starts_at).getTime(),
      )
      .slice(0, 5)
      .map((event) => ({
        id: event.id,
        title: event.title,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
      }))
  } catch (error) {
    console.error(error)
    upcomingEvents.value = []
  } finally {
    loadingEvents.value = false
  }
}

const getAttendanceLabel = (status: AttendanceStatus) => {
  const labels: Record<Exclude<AttendanceStatus, null>, string> = {
    attending: '参加',
    not_attending: '不参加',
    undecided: '未定',
  }

  return status ? labels[status] : '未回答'
}

const getAttendanceColor = (status: AttendanceStatus) => {
  if (status === 'attending') {
    return 'success'
  }

  if (status === 'not_attending') {
    return 'error'
  }

  if (status === 'undecided') {
    return 'warning'
  }

  return undefined
}

const loadAttendance = async () => {
  loadingAttendance.value = true

  try {
    const now = new Date()

    const from = now.toISOString()

    const to = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 14,
      23,
      59,
      59,
      999,
    ).toISOString()

    const response = await getCalendarEvents(from, to)

    const events = response.events
      .filter((event) => {
        const start = new Date(event.starts_at).getTime()

        return !Number.isNaN(start) && start >= now.getTime()
      })
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() -
          new Date(b.starts_at).getTime(),
      )
      .slice(0, 5)

    const results = await Promise.all(
      events.map(async (event) => {
        try {
          const attendance =
            await getCalendarEventAttendance(event.id)

          return {
            id: event.id,
            title: event.title,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            my_status: attendance.my_status as AttendanceStatus,
          }
        } catch (error) {
          console.error(
            `Failed to load attendance: ${event.id}`,
            error,
          )

          return {
            id: event.id,
            title: event.title,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            my_status: null,
          }
        }
      }),
    )

    attendanceEvents.value = results
  } catch (error) {
    console.error(error)
    attendanceEvents.value = []
  } finally {
    loadingAttendance.value = false
  }
}

const closeNicknameDialog = () => {
  if (changingNickname.value) {
    return
  }

  nicknameDialog.value = false
  nicknameError.value = ''
  nicknameSuccess.value = false
  nickname.value = auth.user?.nickname || ''
}

const changeNickname = async () => {
  nicknameError.value = ''
  nicknameSuccess.value = false

  const value = nickname.value.trim()

  if (value.length > 30) {
    nicknameError.value = 'ニックネームは30文字以内にしてください。'
    return
  }

  changingNickname.value = true

  try {
    const response = await apiFetch<{
      user: {
        id: string
        student_number: string
        name: string
        nickname: string | null
      }
    }>('/api/auth/profile', {
      method: 'PATCH',
      body: {
        nickname: value,
      },
    })

    auth.user = response.user

    nicknameSuccess.value = true

    setTimeout(() => {
      if (nicknameDialog.value) {
        closeNicknameDialog()
      }
    }, 1200)
  } catch (error: any) {
    nicknameError.value =
      error?.data?.error ||
      error?.data?.detail ||
      error?.message ||
      'ニックネームの変更に失敗しました。'
  } finally {
    changingNickname.value = false
  }
}

const closePasswordDialog = () => {
  if (changingPassword.value) {
    return
  }

  passwordDialog.value = false
  passwordError.value = ''
  passwordSuccess.value = false

  passwordForm.value = {
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  }
}

const changePassword = async () => {
  passwordError.value = ''
  passwordSuccess.value = false

  if (
    !passwordForm.value.current_password ||
    !passwordForm.value.new_password ||
    !passwordForm.value.new_password_confirmation
  ) {
    passwordError.value = 'すべての項目を入力してください。'
    return
  }

  if (passwordForm.value.new_password.length < 8) {
    passwordError.value = '新しいパスワードは8文字以上にしてください。'
    return
  }

  if (
    passwordForm.value.new_password !==
    passwordForm.value.new_password_confirmation
  ) {
    passwordError.value = '新しいパスワードが一致していません。'
    return
  }

  changingPassword.value = true

  try {
    await apiFetch('/api/auth/password', {
      method: 'PATCH',
      body: passwordForm.value,
    })

    passwordSuccess.value = true

    passwordForm.value = {
      current_password: '',
      new_password: '',
      new_password_confirmation: '',
    }

    setTimeout(() => {
      if (passwordDialog.value) {
        closePasswordDialog()
      }
    }, 1200)
  } catch (error: any) {
    passwordError.value =
      error?.data?.detail ||
      error?.message ||
      'パスワードの変更に失敗しました。'
  } finally {
    changingPassword.value = false
  }
}

const logout = async () => {
  await auth.logout()
  await navigateTo('/login')
}

const loadTasks = async () => {
  loadingTasks.value = true

  try {
    const [classResponse, representativeResponse] =
      await Promise.all([
        getTasks('class'),
        getTasks('class_representative'),
      ])

    const allTasks = [
      ...classResponse.tasks,
      ...representativeResponse.tasks,
    ]

    const userId = auth.user?.id

    if (!userId) {
      myTasks.value = []
      return
    }

    myTasks.value = allTasks
      .filter((task) => {
        if (task.status === 'done') {
          return false
        }

        return task.assignments.users.some(
          (user) => user.id === userId,
        )
      })
      .sort((a, b) => {
        if (!a.due_at && !b.due_at) {
          return 0
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
      .slice(0, 5)
  } catch (error) {
    console.error(error)
    myTasks.value = []
  } finally {
    loadingTasks.value = false
  }
}

const loadNews = async () => {
  loadingNews.value = true

  try {
    const userId = auth.user?.id

    if (!userId) {
      relevantNews.value = []
      return
    }

    const [
      newsResponse,
      classResponse,
      representativeResponse,
    ] = await Promise.all([
      getNews(),
      getTasks('class'),
      getTasks('class_representative'),
    ])

    const allTasks = [
      ...classResponse.tasks,
      ...representativeResponse.tasks,
    ]

    const assignedTaskIds = new Set(
      allTasks
        .filter((task) =>
          task.assignments.users.some(
            (user) => user.id === userId,
          ),
        )
        .map((task) => task.id),
    )

    const newsDetails = await Promise.all(
      newsResponse.news.map(async (news) => {
        try {
          return await getNewsById(news.id)
        } catch (error) {
          console.error(
            `Failed to load news detail: ${news.id}`,
            error,
          )
          return null
        }
      }),
    )

    const attendanceResults = await Promise.all(
      newsDetails.flatMap((news) =>
        news
          ? news.calendar_events.map(async (event) => {
              try {
                const attendance =
                  await getCalendarEventAttendance(event.id)

                return {
                  eventId: event.id,
                  attending:
                    attendance.my_status === 'attending',
                }
              } catch (error) {
                console.error(
                  `Failed to load attendance: ${event.id}`,
                  error,
                )

                return {
                  eventId: event.id,
                  attending: false,
                }
              }
            })
          : [],
      ),
    )

    const attendingEventIds = new Set(
      attendanceResults
        .filter((result) => result.attending)
        .map((result) => result.eventId),
    )

    relevantNews.value = newsDetails
      .filter((news): news is NewsWithCalendarEvents => news !== null)
      .map((news) => {
        const relatedTask =
          news.tasks.some((task) =>
            assignedTaskIds.has(task.id),
          )

        const relatedEvent =
          news.calendar_events.some((event) =>
            attendingEventIds.has(event.id),
          )

        return {
          ...news,
          relatedTask,
          relatedEvent,
        }
      })
      .filter(
        (news) =>
          news.relatedTask ||
          news.relatedEvent,
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime(),
      )
      .slice(0, 5)
  } catch (error) {
    console.error(error)
    relevantNews.value = []
  } finally {
    loadingNews.value = false
  }
}

onMounted(async () => {
  nickname.value = auth.user?.nickname || ''

  await Promise.all([
    loadEvents(),
    loadAttendance(),
    loadTasks(),
    loadNews(),
  ])
})
</script>

<style scoped>
.min-width-0 {
  min-width: 0;
}

.profile-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 42px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.profile-label {
  color: rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}

.event-card,
.news-card {
  cursor: pointer;
  transition: transform 0.15s ease;
}

.event-card:hover,
.news-card:hover {
  transform: translateY(-1px);
}

.event-date {
  width: 58px;
  flex-shrink: 0;
  text-align: center;
}

.empty-state {
  padding: 24px 8px;
  text-align: center;
  color: rgba(0, 0, 0, 0.6);
}
</style>
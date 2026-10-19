<template>
  <v-container
    fluid
    class="pa-4 pa-sm-6"
  >
    <div class="d-flex align-center mb-6">
      <BackButton />

      <div class="ml-2">
        <h1 class="text-h5 font-weight-bold">
          タスクを作成
        </h1>

        <p class="text-body-2 text-medium-emphasis mt-1">
          新しいタスクを作成します
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
          label="タスク名"
          variant="outlined"
          required
          :error-messages="titleError"
        />

        <v-textarea
          v-model="form.description"
          label="詳細"
          variant="outlined"
          rows="4"
          auto-grow
          class="mt-2"
        />

        <v-select
          v-model="form.scope"
          :items="scopeItems"
          label="対象"
          variant="outlined"
          class="mt-2"
        />

        <v-row class="mt-0">
          <v-col
            cols="12"
            sm="6"
          >
            <v-select
              v-model="form.status"
              :items="statusItems"
              label="ステータス"
              variant="outlined"
            />
          </v-col>

          <v-col
            cols="12"
            sm="6"
          >
            <v-select
              v-model="form.priority"
              :items="priorityItems"
              label="優先度"
              variant="outlined"
            />
          </v-col>
        </v-row>

        <v-text-field
          v-model="form.dueAt"
          label="期限"
          type="datetime-local"
          variant="outlined"
          class="mt-2"
        />

        <v-divider class="my-6" />

        <div class="text-subtitle-1 font-weight-bold mb-3">
          関連情報
        </div>

        <v-select
          v-if="auth.hasPermission('schedule.view')"
          v-model="form.calendarEventId"
          :items="calendarEventItems"
          item-title="title"
          item-value="id"
          label="関連する予定（任意）"
          variant="outlined"
          clearable
          :loading="calendarEventsLoading"
          no-data-text="予定が見つかりません"
        />

        <v-autocomplete
          v-model="form.fileIds"
          :items="availableFiles"
          item-title="original_name"
          item-value="id"
          label="関連するファイル（任意）"
          variant="outlined"
          multiple
          chips
          closable-chips
          :loading="filesLoading"
          no-data-text="ファイルが見つかりません"
          class="mt-3"
        />

        <template v-if="auth.hasPermission('tasks.assign')">
          <div class="text-subtitle-1 font-weight-bold mb-3">
            担当者
          </div>

          <v-autocomplete
          v-model="form.assigneeUserIds"
          :items="users"
          item-title="displayName"
          item-value="id"
          label="担当者を選択"
          variant="outlined"
          multiple
          chips
          closable-chips
          :loading="usersLoading"
            no-data-text="担当者が見つかりません"
          />

          <div class="text-subtitle-1 font-weight-bold mb-3 mt-6">
            担当係
          </div>

          <v-autocomplete
          v-model="form.assigneeRoleIds"
          :items="roles"
          item-title="name"
          item-value="id"
          label="担当係を選択"
          variant="outlined"
          multiple
          chips
          closable-chips
          :loading="rolesLoading"
            no-data-text="係が見つかりません"
          />
        </template>

        <div class="d-flex justify-end ga-2 mt-6">
          <v-btn
            variant="text"
            @click="goBack"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="primary"
            variant="flat"
            :loading="submitting"
            @click="createTask"
          >
            タスクを作成
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BackButton from '~/components/layout/BackButton.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import { useAuthStore } from '~/stores/auth'
import {
  type CalendarEvent,
  type Task,
  type TaskAssignmentRole,
  type TaskAssignmentUser,
  type TaskLinkedFile,
  useApi,
} from '~/composables/useApi'

definePageMeta({
  middleware: 'auth',
})

interface UserItem extends TaskAssignmentUser {
  displayName: string
}

const {
  apiFetch,
} = useApi()

const auth = useAuthStore()
const snackbar = useSnackbar()

const form = ref({
  title: '',
  description: '',
  scope: 'class_representative' as Task['scope'],
  status: 'todo' as Task['status'],
  priority: 'medium' as Task['priority'],
  dueAt: '',
  assigneeUserIds: [] as string[],
  assigneeRoleIds: [] as string[],
  calendarEventId: null as string | null,
  fileIds: [] as string[],
})

const users = ref<UserItem[]>([])
const roles = ref<TaskAssignmentRole[]>([])
const calendarEventItems = ref<CalendarEvent[]>([])
const availableFiles = ref<TaskLinkedFile[]>([])

const usersLoading = ref(false)
const rolesLoading = ref(false)
const calendarEventsLoading = ref(false)
const filesLoading = ref(false)
const submitting = ref(false)

const titleError = ref('')

const scopeItems = [
  {
    title: 'クラ代向け',
    value: 'class_representative',
  },
  {
    title: 'クラス向け',
    value: 'class',
  },
]

const statusItems = [
  {
    title: '未着手',
    value: 'todo',
  },
  {
    title: '進行中',
    value: 'in_progress',
  },
  {
    title: '確認待ち',
    value: 'review',
  },
  {
    title: '完了',
    value: 'done',
  },
]

const priorityItems = [
  {
    title: '低',
    value: 'low',
  },
  {
    title: '通常',
    value: 'medium',
  },
  {
    title: '高',
    value: 'high',
  },
  {
    title: '緊急',
    value: 'urgent',
  },
]

const loadUsers = async () => {
  usersLoading.value = true

  try {
    const response = await apiFetch<{
      users: TaskAssignmentUser[]
    }>('/api/tasks/assignment-users')

    users.value = response.users.map((user) => ({
      ...user,
      displayName: user.nickname
        ? `${user.nickname} (${user.name})`
        : user.name,
    }))
  } catch (error) {
    console.error(error)
    snackbar.error('メンバー一覧の取得に失敗しました。')
  } finally {
    usersLoading.value = false
  }
}

const loadRoles = async () => {
  rolesLoading.value = true

  try {
    const response = await apiFetch<{
      roles: TaskAssignmentRole[]
    }>('/api/tasks/assignment-roles')

    roles.value = response.roles
  } catch (error) {
    console.error(error)
    snackbar.error('係一覧の取得に失敗しました。')
  } finally {
    rolesLoading.value = false
  }
}

const loadLinkOptions = async () => {
  const jobs: Promise<void>[] = []

  if (auth.hasPermission('schedule.view')) {
    jobs.push((async () => {
      calendarEventsLoading.value = true
      try {
        const now = new Date()
        const from = new Date(now)
        from.setFullYear(from.getFullYear() - 1)
        const to = new Date(now)
        to.setFullYear(to.getFullYear() + 2)

        const response = await useApi().getCalendarEvents(
          from.toISOString(),
          to.toISOString(),
        )
        calendarEventItems.value = response.events
      } catch (error) {
        console.error(error)
        snackbar.error('予定一覧の取得に失敗しました。')
      } finally {
        calendarEventsLoading.value = false
      }
    })())
  }

  jobs.push((async () => {
    filesLoading.value = true
    try {
      const response = await apiFetch<{ files: TaskLinkedFile[] }>(
        '/api/files',
      )
      availableFiles.value = response.files
    } catch (error) {
      console.error(error)
      snackbar.error('ファイル一覧の取得に失敗しました。')
    } finally {
      filesLoading.value = false
    }
  })())

  await Promise.all(jobs)
}

const createTask = async () => {
  titleError.value = ''

  const title = form.value.title.trim()

  if (!title) {
    titleError.value = 'タスク名を入力してください。'
    return
  }

  submitting.value = true

  try {
    const response = await apiFetch<Task>(
      '/api/tasks',
      {
        method: 'POST',
        body: {
          title,
          description:
            form.value.description.trim() || null,
          scope: form.value.scope,
          status: form.value.status,
          priority: form.value.priority,
          due_at:
            form.value.dueAt || null,
          assignee_user_ids:
            form.value.assigneeUserIds,
          assignee_role_ids:
            form.value.assigneeRoleIds,
          ...(auth.hasPermission('schedule.view')
            ? { calendar_event_id: form.value.calendarEventId }
            : {}),
          file_ids: form.value.fileIds,
        },
      },
    )

    const taskPath =
      response.scope === 'class_representative'
        ? 'class-representative'
        : 'class'

    await navigateTo(
      `/tasks/${taskPath}/${response.id}`,
    )
  } catch (error) {
    console.error(error)
    snackbar.error('タスクの作成に失敗しました。')
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  navigateTo('/admin')
}

onMounted(async () => {
  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (!auth.hasPermission('tasks.create')) {
    await navigateTo('/tasks')
    return
  }

  const jobs: Promise<unknown>[] = [loadLinkOptions()]

  if (auth.hasPermission('tasks.assign')) {
    jobs.push(loadUsers(), loadRoles())
  }

  await Promise.all(jobs)
})
</script>

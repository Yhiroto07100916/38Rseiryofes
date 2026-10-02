<template>
  <v-container
    fluid
    class="pa-4 pa-sm-6"
  >
    <div class="d-flex align-center mb-6">
      <BackButton />
      <div class="mb-6">
        <h1 class="text-h5 font-weight-bold">
          タスク管理
        </h1>

        <p class="text-body-2 text-medium-emphasis mt-1">
          星陵祭準備に関するタスクを管理します
        </p>
      </div>
    </div>

    <v-row class="mb-2">
      <v-col
        v-for="item in summaryItems"
        :key="item.label"
        cols="6"
        sm="3"
      >
        <v-card
          variant="outlined"
          class="rounded-xl h-100"
        >
          <v-card-text class="pa-4">
            <div class="text-body-2 text-medium-emphasis">
              {{ item.label }}
            </div>

            <div class="text-h4 font-weight-bold mt-1">
              {{ item.value }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card
      v-if="auth.hasPermission('tasks.view')"
      variant="outlined"
      class="rounded-xl mb-6"
    >
      <v-card-text class="pa-4">
        <div class="d-flex align-center mb-4">
          <v-icon
            icon="mdi-filter-variant"
            class="mr-2"
          />

          <div class="text-subtitle-1 font-weight-bold">
            タスクを絞り込む
          </div>

          <v-spacer />

          <v-btn
            v-if="hasActiveFilters"
            variant="text"
            size="small"
            @click="resetFilters"
          >
            リセット
          </v-btn>
        </div>

        <v-row>
          <v-col
            cols="12"
            md="6"
          >
            <v-text-field
              v-model="keyword"
              label="キーワード"
              placeholder="タスク名・詳細から検索"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="comfortable"
              clearable
              hide-details
            />
          </v-col>

          <v-col
            cols="12"
            sm="6"
            md="3"
          >
            <v-select
              v-model="scopeFilter"
              :items="scopeItems"
              label="対象"
              variant="outlined"
              density="comfortable"
              clearable
              hide-details
            />
          </v-col>

          <v-col
            cols="12"
            sm="6"
            md="3"
          >
            <v-select
              v-model="statusFilter"
              :items="statusItems"
              label="ステータス"
              variant="outlined"
              density="comfortable"
              clearable
              hide-details
            />
          </v-col>

          <v-col
            cols="12"
            sm="6"
            md="4"
          >
            <v-select
              v-model="priorityFilter"
              :items="priorityItems"
              label="優先度"
              variant="outlined"
              density="comfortable"
              clearable
              hide-details
            />
          </v-col>

          <v-col
            cols="12"
            sm="6"
            md="4"
          >
            <v-select
              v-model="assigneeFilter"
              :items="assigneeItems"
              label="担当者"
              variant="outlined"
              density="comfortable"
              clearable
              hide-details
            />
          </v-col>

          <v-col
            cols="12"
            sm="6"
            md="4"
          >
            <v-select
              v-model="roleFilter"
              :items="roleItems"
              label="係"
              variant="outlined"
              density="comfortable"
              clearable
              hide-details
            />
          </v-col>
        </v-row>

        <div class="d-flex flex-wrap ga-2 mt-4">
          <v-chip
            :color="incompleteOnly ? 'primary' : undefined"
            :variant="incompleteOnly ? 'flat' : 'outlined'"
            @click="incompleteOnly = !incompleteOnly"
          >
            <v-icon
              start
              icon="mdi-checkbox-marked-outline"
            />
            未完了のみ
          </v-chip>

          <v-chip
            :color="myTasksOnly ? 'primary' : undefined"
            :variant="myTasksOnly ? 'flat' : 'outlined'"
            @click="myTasksOnly = !myTasksOnly"
          >
            <v-icon
              start
              icon="mdi-account-check"
            />
            自分のタスク
          </v-chip>

          <v-chip
            :color="overdueOnly ? 'error' : undefined"
            :variant="overdueOnly ? 'flat' : 'outlined'"
            @click="overdueOnly = !overdueOnly"
          >
            <v-icon
              start
              icon="mdi-calendar-alert"
            />
            期限切れ
          </v-chip>
        </div>
      </v-card-text>
    </v-card>

    <div class="d-flex align-center mb-3">
      <div class="text-subtitle-1 font-weight-bold">
        タスク一覧
      </div>

      <span class="text-body-2 text-medium-emphasis ml-2">
        {{ filteredTasks.length }}件
      </span>

      <v-spacer />

      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        aria-label="更新"
        @click="loadTasks"
      />
    </div>

    <div v-if="loading">
      <v-skeleton-loader
        v-for="index in 4"
        :key="index"
        type="card"
        class="mb-3"
      />
    </div>

    <template v-else>
      <v-card
        v-if="filteredTasks.length === 0"
        variant="outlined"
        class="rounded-xl"
      >
        <v-card-text class="text-center py-10">
          <v-icon
            icon="mdi-filter-remove-outline"
            size="48"
            class="mb-3"
          />

          <div class="text-h6 font-weight-bold">
            該当するタスクはありません
          </div>

          <div class="text-body-2 text-medium-emphasis mt-2">
            条件を変更してもう一度お試しください。
          </div>
        </v-card-text>
      </v-card>

      <v-card
        v-for="task in filteredTasks"
        :key="task.id"
        variant="outlined"
        class="rounded-xl mb-3 task-card"
        @click="openTask(task)"
      >
        <v-card-text class="pa-4">
          <div class="d-flex align-start">
            <div class="flex-grow-1 min-width-0">
              <div class="d-flex flex-wrap ga-2 mb-2">
                <v-chip
                  size="small"
                  :color="statusColor(task.status)"
                  variant="tonal"
                >
                  {{ statusLabel(task.status) }}
                </v-chip>

                <v-chip
                  size="small"
                  :color="priorityColor(task.priority)"
                  variant="tonal"
                >
                  {{ priorityLabel(task.priority) }}
                </v-chip>

                <v-chip
                  size="small"
                  variant="outlined"
                >
                  {{ scopeLabel(task.scope) }}
                </v-chip>

                <v-chip
                  v-if="isOverdue(task)"
                  size="small"
                  color="error"
                  variant="tonal"
                >
                  期限切れ
                </v-chip>
              </div>

              <div class="text-subtitle-1 font-weight-bold">
                {{ task.title }}
              </div>

              <div
                v-if="task.description"
                class="text-body-2 text-medium-emphasis mt-1 task-description"
              >
                {{ task.description }}
              </div>
            </div>

            <v-icon
              icon="mdi-chevron-right"
              class="ml-2 mt-1"
            />
          </div>

          <div class="d-flex flex-wrap ga-4 mt-4 text-body-2">
            <div
              v-if="task.due_at"
              class="d-flex align-center"
              :class="isOverdue(task)
                ? 'text-error'
                : 'text-medium-emphasis'"
            >
              <v-icon
                icon="mdi-calendar-clock"
                size="18"
                class="mr-1"
              />

              {{ formatDueDate(task.due_at) }}
            </div>

            <div
              v-if="task.assignments.users.length > 0"
              class="d-flex align-center text-medium-emphasis"
            >
              <v-icon
                icon="mdi-account"
                size="18"
                class="mr-1"
              />

              {{ assigneeLabel(task) }}
            </div>

            <div
              v-if="task.assignments.roles.length > 0"
              class="d-flex align-center text-medium-emphasis"
            >
              <v-icon
                icon="mdi-account-group"
                size="18"
                class="mr-1"
              />

              {{ roleLabel(task) }}
            </div>
          </div>
        </v-card-text>
      </v-card>
    </template>

    <v-row class="mt-2">
      <v-col
        cols="12"
        sm="6"
      >
        <v-card
          variant="outlined"
          class="rounded-xl h-100"
          hover
          @click="navigateTo('/tasks/class-representative')"
        >
          <v-card-text class="pa-5">
            <div class="d-flex align-center mb-4">
              <v-avatar
                size="44"
                color="primary"
                variant="tonal"
              >
                <v-icon icon="mdi-account-group" />
              </v-avatar>

              <div class="ml-3">
                <div class="text-h6 font-weight-bold">
                  クラ代向けタスク
                </div>

                <div class="text-body-2 text-medium-emphasis">
                  クラス代表が担当するタスク
                </div>
              </div>
            </div>

            <v-btn
              color="primary"
              variant="tonal"
              block
            >
              タスク一覧を見る
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col
        cols="12"
        sm="6"
      >
        <v-card
          variant="outlined"
          class="rounded-xl h-100"
          hover
          @click="navigateTo('/tasks/class')"
        >
          <v-card-text class="pa-5">
            <div class="d-flex align-center mb-4">
              <v-avatar
                size="44"
                color="primary"
                variant="tonal"
              >
                <v-icon icon="mdi-account-multiple" />
              </v-avatar>

              <div class="ml-3">
                <div class="text-h6 font-weight-bold">
                  クラス向けタスク
                </div>

                <div class="text-body-2 text-medium-emphasis">
                  クラス全体に関するタスク
                </div>
              </div>
            </div>

            <v-btn
              color="primary"
              variant="tonal"
              block
            >
              タスク一覧を見る
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col
        v-if="auth.hasPermission('tasks.create')"
        cols="12"
      >
        <v-card
          variant="outlined"
          class="rounded-xl"
          hover
          @click="navigateTo('/tasks/create')"
        >
          <v-card-text class="pa-5">
            <div class="d-flex align-center">
              <v-avatar
                size="44"
                color="primary"
                variant="tonal"
              >
                <v-icon icon="mdi-plus" />
              </v-avatar>

              <div class="ml-3 flex-grow-1">
                <div class="text-h6 font-weight-bold">
                  タスクを作成
                </div>

                <div class="text-body-2 text-medium-emphasis">
                  新しいタスクを登録する
                </div>
              </div>

              <v-icon icon="mdi-chevron-right" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from 'vue'
import BackButton from '~/components/layout/BackButton.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import {
  type Task,
  useApi,
} from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  middleware: 'auth',
})

const auth = useAuthStore()
const { getTasks } = useApi()
const snackbar = useSnackbar()

const tasks = ref<Task[]>([])
const loading = ref(false)

const keyword = ref('')
const scopeFilter = ref<Task['scope'] | null>(null)
const statusFilter = ref<Task['status'] | null>(null)
const priorityFilter = ref<Task['priority'] | null>(null)
const assigneeFilter = ref<string | null>(null)
const roleFilter = ref<string | null>(null)
const incompleteOnly = ref(false)
const myTasksOnly = ref(false)
const overdueOnly = ref(false)

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

const assigneeItems = computed(() => {
  const map = new Map<string, string>()

  for (const task of tasks.value) {
    for (const user of task.assignments.users) {
      map.set(
        user.id,
        user.nickname
          ? `${user.name}（${user.nickname}）`
          : user.name,
      )
    }
  }

  return Array.from(map, ([value, title]) => ({
    title,
    value,
  })).sort((a, b) =>
    a.title.localeCompare(b.title, 'ja'),
  )
})

const roleItems = computed(() => {
  const map = new Map<string, string>()

  for (const task of tasks.value) {
    for (const role of task.assignments.roles) {
      map.set(role.id, role.name)
    }
  }

  return Array.from(map, ([value, title]) => ({
    title,
    value,
  })).sort((a, b) =>
    a.title.localeCompare(b.title, 'ja'),
  )
})

const filteredTasks = computed(() => {
  const normalizedKeyword =
    keyword.value.trim().toLowerCase()

  return tasks.value.filter((task) => {
    if (
      scopeFilter.value !== null &&
      task.scope !== scopeFilter.value
    ) {
      return false
    }

    if (
      statusFilter.value !== null &&
      task.status !== statusFilter.value
    ) {
      return false
    }

    if (
      priorityFilter.value !== null &&
      task.priority !== priorityFilter.value
    ) {
      return false
    }

    if (
      assigneeFilter.value !== null &&
      !task.assignments.users.some(
        (user) => user.id === assigneeFilter.value,
      )
    ) {
      return false
    }

    if (
      roleFilter.value !== null &&
      !task.assignments.roles.some(
        (role) => role.id === roleFilter.value,
      )
    ) {
      return false
    }

    if (
      normalizedKeyword &&
      !`${task.title} ${task.description ?? ''}`
        .toLowerCase()
        .includes(normalizedKeyword)
    ) {
      return false
    }

    if (
      incompleteOnly.value &&
      task.status === 'done'
    ) {
      return false
    }

    if (
      myTasksOnly.value &&
      !isMyTask(task)
    ) {
      return false
    }

    if (
      overdueOnly.value &&
      !isOverdue(task)
    ) {
      return false
    }

    return true
  })
})

const summaryItems = computed(() => [
  {
    label: '全タスク',
    value: tasks.value.length,
  },
  {
    label: '未完了',
    value: tasks.value.filter(
      (task) => task.status !== 'done',
    ).length,
  },
  {
    label: '進行中',
    value: tasks.value.filter(
      (task) => task.status === 'in_progress',
    ).length,
  },
  {
    label: '期限切れ',
    value: tasks.value.filter(
      (task) => isOverdue(task),
    ).length,
  },
])

const hasActiveFilters = computed(() =>
  keyword.value.trim() !== '' ||
  scopeFilter.value !== null ||
  statusFilter.value !== null ||
  priorityFilter.value !== null ||
  assigneeFilter.value !== null ||
  roleFilter.value !== null ||
  incompleteOnly.value ||
  myTasksOnly.value ||
  overdueOnly.value,
)

const resetFilters = () => {
  keyword.value = ''
  scopeFilter.value = null
  statusFilter.value = null
  priorityFilter.value = null
  assigneeFilter.value = null
  roleFilter.value = null
  incompleteOnly.value = false
  myTasksOnly.value = false
  overdueOnly.value = false
}

const loadTasks = async () => {
  loading.value = true

  try {
    const response = await getTasks()
    tasks.value = response.tasks
  } catch (error) {
    console.error(error)
    snackbar.error('タスクの取得に失敗しました。')
  } finally {
    loading.value = false
  }
}

const isMyTask = (task: Task) => {
  const userId = auth.user?.id

  if (!userId) {
    return false
  }

  return (
    task.created_by === userId ||
    task.assignments.users.some(
      (user) => user.id === userId,
    )
  )
}

const isOverdue = (task: Task) => {
  if (
    !task.due_at ||
    task.status === 'done'
  ) {
    return false
  }

  const dueAt = new Date(task.due_at)

  if (Number.isNaN(dueAt.getTime())) {
    return false
  }

  return dueAt.getTime() < Date.now()
}

const openTask = async (task: Task) => {
  const basePath =
    task.scope === 'class_representative'
      ? '/tasks/class-representative'
      : '/tasks/class'

  await navigateTo(
    `${basePath}/${task.id}`,
  )
}

const statusLabel = (
  status: Task['status'],
) => {
  switch (status) {
    case 'todo':
      return '未着手'
    case 'in_progress':
      return '進行中'
    case 'review':
      return '確認待ち'
    case 'done':
      return '完了'
  }
}

const statusColor = (
  status: Task['status'],
) => {
  switch (status) {
    case 'todo':
      return 'grey'
    case 'in_progress':
      return 'blue'
    case 'review':
      return 'orange'
    case 'done':
      return 'green'
  }
}

const priorityLabel = (
  priority: Task['priority'],
) => {
  switch (priority) {
    case 'low':
      return '低'
    case 'medium':
      return '通常'
    case 'high':
      return '高'
    case 'urgent':
      return '緊急'
  }
}

const priorityColor = (
  priority: Task['priority'],
) => {
  switch (priority) {
    case 'low':
      return 'grey'
    case 'medium':
      return 'blue-grey'
    case 'high':
      return 'orange'
    case 'urgent':
      return 'red'
  }
}

const scopeLabel = (
  scope: Task['scope'],
) => {
  return scope === 'class_representative'
    ? 'クラ代向け'
    : 'クラス向け'
}

const assigneeLabel = (task: Task) => {
  const users = task.assignments.users

  if (users.length === 1) {
    const user = users[0]

    if (!user) {
      return ''
    }

    return user.nickname
      ? `${user.name}（${user.nickname}）`
      : user.name
  }

  return `${users.length}人`
}

const roleLabel = (task: Task) => {
  const roles = task.assignments.roles

  if (roles.length === 1) {
    const role = roles[0]

    if (!role) {
      return ''
    }

    return role.name
  }

  return `${roles.length}係`
}

const formatDueDate = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(
    'ja-JP',
    {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date)
}

onMounted(async () => {
  if (!auth.initialized) {
    await auth.fetchMe()
  }

  await loadTasks()
})
</script>

<style scoped>
.min-width-0 {
  min-width: 0;
}

.task-card {
  cursor: pointer;
}

.task-description {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>

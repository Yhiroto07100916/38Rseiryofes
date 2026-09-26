<template>
  <v-container
    fluid
    class="pa-4 pa-sm-6"
  >
    <div class="d-flex align-center mb-6">
      <BackButton />

      <div class="ml-2">
        <h1 class="text-h5 font-weight-bold">
          クラス向けタスク
        </h1>

        <p class="text-body-2 text-medium-emphasis mt-1">
          クラス代表に関係するタスク
        </p>
      </div>

      <v-spacer />

      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        aria-label="更新"
        @click="loadTasks"
      />
    </div>

    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ errorMessage }}
    </v-alert>

    <div v-if="loading">
      <v-skeleton-loader
        v-for="index in 3"
        :key="index"
        type="card"
        class="mb-3"
      />
    </div>

    <template v-else>
      <v-card
        v-if="tasks.length === 0"
        variant="outlined"
        class="rounded-xl"
      >
        <v-card-text class="text-center py-10">
          <v-icon
            icon="mdi-checkbox-marked-outline"
            size="48"
            class="mb-3"
          />

          <div class="text-h6 font-weight-bold">
            タスクはありません
          </div>

          <div class="text-body-2 text-medium-emphasis mt-2">
            現在あなたが担当しているタスクはありません。
          </div>
        </v-card-text>
      </v-card>

      <div v-else>
        <v-card
          v-for="task in tasks"
          :key="task.id"
          variant="outlined"
          class="rounded-xl mb-3"
          @click="openTask(task.id)"
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
                class="d-flex align-center text-medium-emphasis"
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

                {{ task.assignments.users.length }}人
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

                {{ task.assignments.roles.length }}係
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BackButton from '~/components/layout/BackButton.vue'
import {
  type Task,
  useApi,
} from '~/composables/useApi'

definePageMeta({
  middleware: 'auth',
})

const { getTasks } = useApi()

const tasks = ref<Task[]>([])
const loading = ref(false)
const errorMessage = ref('')

const loadTasks = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await getTasks(
      'class_representative',
    )

    tasks.value = response.tasks
  } catch (error) {
    console.error(error)
    errorMessage.value =
      'タスクの取得に失敗しました。'
  } finally {
    loading.value = false
  }
}

const openTask = async (taskId: string) => {
  await navigateTo(
    `/tasks/class/${taskId}`,
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

onMounted(loadTasks)
</script>

<style scoped>
.min-width-0 {
  min-width: 0;
}

.task-description {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>

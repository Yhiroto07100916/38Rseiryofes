<template>
  <v-container
    fluid
    class="pa-4 pa-sm-6"
  >
    <div class="d-flex align-center mb-6">
      <BackButton />

      <div class="ml-2">
        <h1 class="text-h5 font-weight-bold">
          タスク詳細
        </h1>
      </div>

      <v-spacer />

      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        aria-label="更新"
        @click="loadTask"
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
      <v-skeleton-loader type="article" />
      <v-skeleton-loader
        type="article"
        class="mt-4"
      />
    </div>

    <template v-else-if="task">
      <v-card
        variant="outlined"
        class="rounded-xl"
      >
        <v-card-text class="pa-4 pa-sm-6">
          <div class="d-flex flex-wrap ga-2 mb-4">
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

          <h2 class="text-h5 font-weight-bold">
            {{ task.title }}
          </h2>

          <div
            v-if="task.description"
            class="text-body-1 mt-4 task-description"
          >
            {{ task.description }}
          </div>

          <v-divider class="my-5" />

          <div class="detail-list">
            <div
              v-if="task.due_at"
              class="detail-item"
            >
              <v-icon
                icon="mdi-calendar-clock"
                size="20"
              />

              <span class="text-medium-emphasis">
                期限
              </span>

              <span>
                {{ formatDueDate(task.due_at) }}
              </span>
            </div>

            <div class="detail-item">
              <v-icon
                icon="mdi-account"
                size="20"
              />

              <span class="text-medium-emphasis">
                担当者
              </span>

              <span>
                {{
                  task.assignments.users.length > 0
                    ? task.assignments.users
                        .map((user) =>
                          user.nickname
                            ? `${user.nickname} (${user.name})`
                            : user.name,
                        )
                        .join('、')
                    : 'なし'
                }}
              </span>
            </div>

            <div class="detail-item">
              <v-icon
                icon="mdi-account-group"
                size="20"
              />

              <span class="text-medium-emphasis">
                担当係
              </span>

              <span>
                {{
                  task.assignments.roles.length > 0
                    ? task.assignments.roles
                        .map((role) => role.name)
                        .join('、')
                    : 'なし'
                }}
              </span>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-card
        variant="outlined"
        class="rounded-xl mt-4"
      >
        <v-card-title class="text-h6 font-weight-bold">
          コメント
        </v-card-title>

        <v-card-text>
          <v-alert
            v-if="commentsError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ commentsError }}
          </v-alert>

          <div
            v-if="comments.length === 0"
            class="text-body-2 text-medium-emphasis py-4"
          >
            まだコメントはありません。
          </div>

          <div
            v-for="comment in comments"
            :key="comment.id"
            class="comment-item"
          >
            <div class="d-flex align-center">
              <span class="font-weight-bold">
                {{
                  comment.user_nickname ||
                  comment.user_name
                }}
              </span>

              <span class="text-caption text-medium-emphasis ml-2">
                {{ formatCommentDate(comment.created_at) }}
              </span>
            </div>

            <div class="text-body-2 mt-1 comment-content">
              {{ comment.content }}
            </div>
          </div>

          <v-divider class="my-5" />

          <v-textarea
            v-model="commentContent"
            label="コメントを追加"
            variant="outlined"
            rows="3"
            auto-grow
            :disabled="commentSubmitting"
          />

          <div class="d-flex justify-end mt-2">
            <v-btn
              color="primary"
              variant="flat"
              :loading="commentSubmitting"
              :disabled="!commentContent.trim()"
              @click="submitComment"
            >
              コメントする
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BackButton from '~/components/layout/BackButton.vue'
import {
  type Task,
  type TaskComment,
  useApi,
} from '~/composables/useApi'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()

const {
  getTask,
  getTaskComments,
  apiFetch,
} = useApi()

const task = ref<Task | null>(null)
const comments = ref<TaskComment[]>([])

const loading = ref(false)
const errorMessage = ref('')
const commentsError = ref('')

const commentContent = ref('')
const commentSubmitting = ref(false)

const loadTask = async () => {
  loading.value = true
  errorMessage.value = ''
  commentsError.value = ''

  try {
    const taskId = String(route.params.id)

    const [taskResponse, commentsResponse] =
      await Promise.all([
        getTask(taskId),
        getTaskComments(taskId),
      ])

    task.value = taskResponse
    comments.value = commentsResponse.comments
  } catch (error) {
    console.error(error)
    errorMessage.value =
      'タスクの取得に失敗しました。'
  } finally {
    loading.value = false
  }
}

const submitComment = async () => {
  const content = commentContent.value.trim()

  if (!content) {
    return
  }

  commentSubmitting.value = true
  commentsError.value = ''

  try {
    const response = await apiFetch<TaskComment>(
      `/api/tasks/${route.params.id}/comments`,
      {
        method: 'POST',
        body: {
          content,
        },
      },
    )

    comments.value.push(response)
    commentContent.value = ''
  } catch (error) {
    console.error(error)
    commentsError.value =
      'コメントの投稿に失敗しました。'
  } finally {
    commentSubmitting.value = false
  }
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
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date)
}

const formatCommentDate = (value: string) => {
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

onMounted(loadTask)
</script>

<style scoped>
.task-description {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.comment-item + .comment-item {
  margin-top: 20px;
}

.comment-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>

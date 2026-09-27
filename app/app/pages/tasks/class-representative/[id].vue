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
          <div class="d-flex justify-end ga-2 mb-3">
            <v-btn
              v-if="canEdit || canAssign"
              variant="tonal"
              prepend-icon="mdi-pencil"
              :disabled="editLoading"
              @click="startEdit"
            >
              編集
            </v-btn>

            <v-btn
              v-if="canDelete"
              color="error"
              variant="tonal"
              prepend-icon="mdi-delete-outline"
              :loading="deleteLoading"
              @click="deleteTask"
            >
              削除
            </v-btn>
          </div>

          <template v-if="editing">
            <v-alert
              v-if="editError"
              type="error"
              variant="tonal"
              class="mb-4"
            >
              {{ editError }}
            </v-alert>

            <template v-if="canEdit">
              <v-text-field
                v-model="editForm.title"
                label="タスク名"
                variant="outlined"
                class="mb-3"
              />

              <v-textarea
                v-model="editForm.description"
                label="詳細"
                variant="outlined"
                rows="4"
                auto-grow
                class="mb-3"
              />

              <v-row>
                <v-col
                  cols="12"
                  sm="4"
                >
                  <v-select
                    v-model="editForm.status"
                    :items="statusItems"
                    label="ステータス"
                    variant="outlined"
                  />
                </v-col>

                <v-col
                  cols="12"
                  sm="4"
                >
                  <v-select
                    v-model="editForm.priority"
                    :items="priorityItems"
                    label="優先度"
                    variant="outlined"
                  />
                </v-col>

                <v-col
                  cols="12"
                  sm="4"
                >
                  <v-text-field
                    v-model="editForm.dueAt"
                    label="期限"
                    type="datetime-local"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
            </template>

            <template v-if="canAssign">
              <v-autocomplete
                v-model="editForm.assigneeUserIds"
                :items="users"
                item-title="displayName"
                item-value="id"
                label="担当者"
                variant="outlined"
                multiple
                chips
                closable-chips
                class="mt-2"
                :loading="usersLoading"
              />

              <v-autocomplete
                v-model="editForm.assigneeRoleIds"
                :items="roles"
                item-title="name"
                item-value="id"
                label="担当係"
                variant="outlined"
                multiple
                chips
                closable-chips
                class="mt-3"
                :loading="rolesLoading"
              />
            </template>

            <div class="d-flex justify-end ga-2 mt-4">
              <v-btn
                variant="text"
                :disabled="editLoading"
                @click="cancelEdit"
              >
                キャンセル
              </v-btn>

              <v-btn
                color="primary"
                :loading="editLoading"
                @click="saveEdit"
              >
                保存
              </v-btn>
            </div>

            <v-divider class="my-5" />
          </template>

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

            <div class="detail-item">
              <v-icon
                icon="mdi-calendar-plus"
                size="20"
              />

              <span class="text-medium-emphasis">
                作成日時
              </span>

              <span>
                {{ formatDueDate(task.created_at) }}
              </span>
            </div>

            <div class="detail-item">
              <v-icon
                icon="mdi-update"
                size="20"
              />

              <span class="text-medium-emphasis">
                更新日時
              </span>

              <span>
                {{ formatDueDate(task.updated_at) }}
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

              <v-spacer />

              <v-menu
                v-if="isOwnComment(comment)"
              >
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-dots-vertical"
                    variant="text"
                    density="compact"
                    size="small"
                    aria-label="コメント操作"
                  />
                </template>

                <v-list density="compact">
                  <v-list-item
                    prepend-icon="mdi-pencil-outline"
                    title="編集"
                    @click="startCommentEdit(comment)"
                  />

                  <v-list-item
                    prepend-icon="mdi-delete-outline"
                    title="削除"
                    @click="deleteComment(comment)"
                  />
                </v-list>
              </v-menu>
            </div>

            <template v-if="editingCommentId === comment.id">
              <v-textarea
                v-model="editingCommentContent"
                variant="outlined"
                rows="3"
                auto-grow
                class="mt-2"
                :disabled="commentEditLoading"
              />

              <div class="d-flex justify-end ga-2 mt-2">
                <v-btn
                  variant="text"
                  :disabled="commentEditLoading"
                  @click="cancelCommentEdit"
                >
                  キャンセル
                </v-btn>

                <v-btn
                  color="primary"
                  :loading="commentEditLoading"
                  :disabled="!editingCommentContent.trim()"
                  @click="saveCommentEdit(comment)"
                >
                  保存
                </v-btn>
              </div>
            </template>

            <div
              v-else
              class="text-body-2 mt-1 comment-content"
            >
              {{ comment.content }}
            </div>
          </div>

          <template v-if="canComment">
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
          </template>
        </v-card-text>
      </v-card>
    </template>
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
  type Task,
  type TaskComment,
  useApi,
} from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const auth = useAuthStore()

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

const editing = ref(false)
const editLoading = ref(false)
const editError = ref('')

const deleteLoading = ref(false)

const editingCommentId = ref<string | null>(null)
const editingCommentContent = ref('')
const commentEditLoading = ref(false)

const users = ref<
  {
    id: string
    student_number: string
    name: string
    nickname: string | null
    displayName: string
  }[]
>([])

const roles = ref<
  {
    id: string
    name: string
    description: string | null
  }[]
>([])

const usersLoading = ref(false)
const rolesLoading = ref(false)

const editForm = ref({
  title: '',
  description: '',
  status: 'todo' as Task['status'],
  priority: 'medium' as Task['priority'],
  dueAt: '',
  assigneeUserIds: [] as string[],
  assigneeRoleIds: [] as string[],
})

const canEdit = computed(() =>
  auth.hasPermission('tasks.edit'),
)

const canAssign = computed(() =>
  auth.hasPermission('tasks.assign'),
)

const canComment = computed(() =>
  auth.hasPermission('tasks.comment'),
)

const canDelete = computed(() =>
  auth.hasPermission('tasks.delete'),
)

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

const loadTask = async () => {
  loading.value = true
  errorMessage.value = ''
  commentsError.value = ''

  try {
    const taskId = String(route.params.id)

    const [taskResponse, commentsResponse] =
      await Promise.all([
        getTask(taskId),
        canComment.value
          ? getTaskComments(taskId)
          : Promise.resolve({ comments: [] }),
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

const loadAssignmentOptions = async () => {
  if (!canAssign.value) {
    return
  }

  usersLoading.value = true
  rolesLoading.value = true

  try {
    const [usersResponse, rolesResponse] =
      await Promise.all([
        apiFetch<{
          users: {
            id: string
            student_number: string
            name: string
            nickname: string | null
          }[]
        }>('/api/tasks/assignment-users'),
        apiFetch<{
          roles: {
            id: string
            name: string
            description: string | null
          }[]
        }>('/api/tasks/assignment-roles'),
      ])

    users.value = usersResponse.users.map((user) => ({
      ...user,
      displayName: user.nickname
        ? `${user.name}（${user.nickname}）`
        : user.name,
    }))

    roles.value = rolesResponse.roles
  } catch (error) {
    console.error(error)
    editError.value =
      '担当者・係の一覧を取得できませんでした。'
  } finally {
    usersLoading.value = false
    rolesLoading.value = false
  }
}

const startEdit = async () => {
  if (!task.value) {
    return
  }

  editError.value = ''

  editForm.value = {
    title: task.value.title,
    description: task.value.description ?? '',
    status: task.value.status,
    priority: task.value.priority,
    dueAt: toDatetimeLocal(task.value.due_at),
    assigneeUserIds: task.value.assignments.users.map(
      (user) => user.id,
    ),
    assigneeRoleIds: task.value.assignments.roles.map(
      (role) => role.id,
    ),
  }

  editing.value = true

  if (canAssign.value) {
    await loadAssignmentOptions()
  }
}

const cancelEdit = () => {
  editing.value = false
  editError.value = ''
}

const saveEdit = async () => {
  if (!task.value) {
    return
  }

  const body: Record<string, unknown> = {}

  if (canEdit.value) {
    body.title = editForm.value.title
    body.description =
      editForm.value.description.trim() || null
    body.status = editForm.value.status
    body.priority = editForm.value.priority
    body.due_at = editForm.value.dueAt
      ? new Date(editForm.value.dueAt).toISOString()
      : null
  }

  if (canAssign.value) {
    body.assignee_user_ids =
      editForm.value.assigneeUserIds
    body.assignee_role_ids =
      editForm.value.assigneeRoleIds
  }

  if (Object.keys(body).length === 0) {
    return
  }

  editLoading.value = true
  editError.value = ''

  try {
    const response = await apiFetch<Task>(
      `/api/tasks/${task.value.id}`,
      {
        method: 'PATCH',
        body,
      },
    )

    task.value = response
    editing.value = false
  } catch (error) {
    console.error(error)
    editError.value =
      'タスクの更新に失敗しました。'
  } finally {
    editLoading.value = false
  }
}

const deleteTask = async () => {
  if (!task.value || !canDelete.value) {
    return
  }

  if (
    !window.confirm(
      'このタスクを削除しますか？この操作は取り消せません。',
    )
  ) {
    return
  }

  deleteLoading.value = true
  errorMessage.value = ''

  try {
    await apiFetch(
      `/api/tasks/${task.value.id}`,
      {
        method: 'DELETE',
      },
    )

    await navigateTo('/tasks/class-representative')
  } catch (error) {
    console.error(error)
    errorMessage.value =
      'タスクの削除に失敗しました。'
  } finally {
    deleteLoading.value = false
  }
}

const submitComment = async () => {
  const content = commentContent.value.trim()

  if (!content || !canComment.value) {
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

const isOwnComment = (comment: TaskComment) => {
  return (
    canComment.value &&
    comment.user_id === auth.user?.id
  )
}

const startCommentEdit = (comment: TaskComment) => {
  if (!isOwnComment(comment)) {
    return
  }

  editingCommentId.value = comment.id
  editingCommentContent.value = comment.content
  commentsError.value = ''
}

const cancelCommentEdit = () => {
  editingCommentId.value = null
  editingCommentContent.value = ''
}

const saveCommentEdit = async (
  comment: TaskComment,
) => {
  const content =
    editingCommentContent.value.trim()

  if (!content || !isOwnComment(comment)) {
    return
  }

  commentEditLoading.value = true
  commentsError.value = ''

  try {
    const response =
      await apiFetch<TaskComment>(
        `/api/tasks/${route.params.id}/comments/${comment.id}`,
        {
          method: 'PATCH',
          body: {
            content,
          },
        },
      )

    const index = comments.value.findIndex(
      (item) => item.id === comment.id,
    )

    if (index !== -1) {
      comments.value[index] = response
    }

    cancelCommentEdit()
  } catch (error) {
    console.error(error)
    commentsError.value =
      'コメントの更新に失敗しました。'
  } finally {
    commentEditLoading.value = false
  }
}

const deleteComment = async (
  comment: TaskComment,
) => {
  if (!isOwnComment(comment)) {
    return
  }

  if (
    !window.confirm(
      'このコメントを削除しますか？',
    )
  ) {
    return
  }

  commentsError.value = ''

  try {
    await apiFetch(
      `/api/tasks/${route.params.id}/comments/${comment.id}`,
      {
        method: 'DELETE',
      },
    )

    comments.value =
      comments.value.filter(
        (item) => item.id !== comment.id,
      )
  } catch (error) {
    console.error(error)
    commentsError.value =
      'コメントの削除に失敗しました。'
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

const toDatetimeLocal = (
  value: string | null,
) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const offset =
    date.getTimezoneOffset()

  const localDate =
    new Date(
      date.getTime() - offset * 60 * 1000,
    )

  return localDate
    .toISOString()
    .slice(0, 16)
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

onMounted(async () => {
  if (!auth.initialized) {
    await auth.fetchMe()
  }

  await loadTask()
})
</script>

<style scoped>
.min-width-0 {
  min-width: 0;
}

.task-description,
.comment-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-item {
  display: grid;
  grid-template-columns: 24px 80px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
}

.comment-item + .comment-item {
  margin-top: 18px;
}
</style>

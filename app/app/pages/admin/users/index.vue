<template>
  <v-container class="admin-users-page py-8">
    <div class="page-header">
      <div>
        <div class="page-eyebrow">
          ADMINISTRATION
        </div>

        <h1 class="page-title">
          メンバー管理
        </h1>

        <p class="page-description">
          38Rメンバーの登録・編集・削除を行います。
        </p>
      </div>

      <v-btn
        color="primary"
        rounded="xl"
        prepend-icon="mdi-account-plus"
        size="large"
        @click="openCreateDialog"
      >
        メンバーを追加
      </v-btn>
    </div>

    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      rounded="xl"
      class="mt-6"
      closable
      @click:close="errorMessage = ''"
    >
      {{ errorMessage }}
    </v-alert>

    <v-card
      rounded="xl"
      variant="outlined"
      class="mt-6"
    >
      <v-card-title class="d-flex align-center justify-space-between">
        <span class="font-weight-bold">
          メンバー一覧
        </span>

        <v-chip
          color="primary"
          variant="tonal"
          rounded="pill"
        >
          {{ users.length }}人
        </v-chip>
      </v-card-title>

      <v-divider />

      <v-progress-linear
        v-if="loading"
        indeterminate
        color="primary"
      />

      <v-list v-if="users.length > 0" lines="two">
        <v-list-item
          v-for="(user, index) in users"
          :key="user.id"
          :class="{ 'border-t': index !== 0 }"
        >
          <template #prepend>
            <v-avatar
              color="primary"
              variant="tonal"
              size="44"
              class="mr-3"
            >
              <span class="font-weight-bold">
                {{ getInitial(user.name) }}
              </span>
            </v-avatar>
          </template>

          <v-list-item-title class="font-weight-bold">
            {{ user.name }}
            <span
              v-if="user.nickname"
              class="text-medium-emphasis ml-1"
            >
              （{{ user.nickname }}）
            </span>
          </v-list-item-title>

          <v-list-item-subtitle>
            学籍番号：{{ user.student_number }}
          </v-list-item-subtitle>

          <template #append>
            <div class="d-flex ga-2">
              <v-btn
                icon="mdi-pencil"
                variant="text"
                color="primary"
                :aria-label="`${user.name}を編集`"
                @click="openEditDialog(user)"
              />

              <v-btn
                icon="mdi-key-variant"
                variant="text"
                color="primary"
                :aria-label="`${user.name}のパスワードを設定`"
                @click="openPasswordDialog(user)"
              />

              <v-btn
                icon="mdi-delete-outline"
                variant="text"
                color="error"
                :aria-label="`${user.name}を削除`"
                @click="deleteUser(user)"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>

      <div
        v-else-if="!loading"
        class="empty-state"
      >
        <v-icon
          icon="mdi-account-group-outline"
          size="56"
          color="primary"
        />

        <div class="text-h6 font-weight-bold mt-3">
          メンバーが登録されていません
        </div>

        <div class="text-body-2 text-medium-emphasis mt-1">
          「メンバーを追加」から38Rメンバーを登録してください。
        </div>
      </div>
    </v-card>

    <v-dialog
      v-model="dialogOpen"
      max-width="520"
      persistent
    >
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-3">
          <span class="text-h6 font-weight-bold">
            {{ editingUser ? 'メンバーを編集' : 'メンバーを追加' }}
          </span>
        </v-card-title>

        <v-card-text class="px-6">
          <v-form @submit.prevent="saveUser">
            <v-text-field
              v-model="form.student_number"
              label="学籍番号"
              placeholder="例：3801"
              variant="outlined"
              rounded="lg"
              density="comfortable"
              :disabled="saving"
              class="mb-3"
              required
            />

            <v-text-field
              v-model="form.name"
              label="氏名"
              placeholder="例：相原一仁"
              variant="outlined"
              rounded="lg"
              density="comfortable"
              :disabled="saving"
              class="mb-3"
              required
            />

            <v-text-field
              v-model="form.nickname"
              label="ニックネーム"
              placeholder="任意"
              variant="outlined"
              rounded="lg"
              density="comfortable"
              :disabled="saving"
            />

            <v-select
              v-if="!editingUser"
              v-model="form.account_role_id"
              :items="accountRoleOptions"
              item-title="label"
              item-value="id"
              label="アカウント権限"
              variant="outlined"
              rounded="lg"
              density="comfortable"
              :disabled="saving || accountRolesLoading"
              :loading="accountRolesLoading"
              class="mb-2"
              required
            />

            <v-alert
              v-if="!editingUser"
              type="info"
              variant="tonal"
              rounded="lg"
              density="comfortable"
              class="mb-2"
            >
              初期パスワードは学籍番号です。ログイン後に変更してください。
            </v-alert>

            <v-row class="mt-4" dense>
              <v-col cols="6">
                <v-btn
                  block
                  variant="outlined"
                  rounded="xl"
                  size="large"
                  :disabled="saving"
                  @click="closeDialog"
                >
                  キャンセル
                </v-btn>
              </v-col>

              <v-col cols="6">
                <v-btn
                  block
                  color="primary"
                  rounded="xl"
                  size="large"
                  :loading="saving"
                  type="submit"
                >
                  {{ editingUser ? '保存' : '登録' }}
                </v-btn>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="passwordDialogOpen"
      max-width="520"
      persistent
    >
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-3">
          <span class="text-h6 font-weight-bold">
            パスワード設定
          </span>
        </v-card-title>

        <v-card-text class="px-6">
          <p class="text-body-2 text-medium-emphasis mb-4">
            {{ passwordUser?.name }} さんのログインパスワードを設定します。
          </p>

          <v-form @submit.prevent="setPassword">
            <v-text-field
              v-model="passwordForm.password"
              label="新しいパスワード"
              type="password"
              variant="outlined"
              rounded="lg"
              density="comfortable"
              :disabled="passwordSaving"
              hint="8文字以上"
              persistent-hint
              autocomplete="new-password"
            />

            <v-text-field
              v-model="passwordForm.confirmation"
              label="新しいパスワード（確認）"
              type="password"
              variant="outlined"
              rounded="lg"
              density="comfortable"
              :disabled="passwordSaving"
              class="mt-3"
              autocomplete="new-password"
            />

            <v-row class="mt-4" dense>
              <v-col cols="6">
                <v-btn
                  block
                  variant="outlined"
                  rounded="xl"
                  size="large"
                  :disabled="passwordSaving"
                  @click="closePasswordDialog"
                >
                  キャンセル
                </v-btn>
              </v-col>

              <v-col cols="6">
                <v-btn
                  block
                  color="primary"
                  rounded="xl"
                  size="large"
                  :loading="passwordSaving"
                  type="submit"
                >
                  設定する
                </v-btn>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
interface User {
  id: string
  student_number: string
  name: string
  nickname: string | null
  created_at: string
  updated_at: string
}

interface UserForm {
  student_number: string
  name: string
  nickname: string
  account_role_id: string
}

interface AccountRole {
  id: string
  name: string
  description: string | null
}

definePageMeta({
  middleware: ['auth', 'admin'],
})

const { apiFetch } = useApi()

const users = ref<User[]>([])
const accountRoles = ref<AccountRole[]>([])
const loading = ref(false)
const accountRolesLoading = ref(false)
const saving = ref(false)
const dialogOpen = ref(false)
const errorMessage = ref('')

const editingUser = ref<User | null>(null)

const passwordDialogOpen = ref(false)
const passwordSaving = ref(false)
const passwordUser = ref<User | null>(null)

const passwordForm = reactive({
  password: '',
  confirmation: '',
})

const form = reactive<UserForm>({
  student_number: '',
  name: '',
  nickname: '',
  account_role_id: '',
})

const accountRoleOptions = computed(() =>
  accountRoles.value.map((role) => ({
    id: role.id,
    label:
      role.name === 'admin'
        ? '管理者'
        : role.name === 'classmate'
          ? '一般メンバー'
          : role.name,
  })),
)

const resetForm = () => {
  form.student_number = ''
  form.name = ''
  form.nickname = ''

  const classmateRole = accountRoles.value.find(
    (role) => role.name === 'classmate',
  )

  form.account_role_id =
    classmateRole?.id ||
    accountRoles.value[0]?.id ||
    ''
}

const fetchUsers = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await apiFetch<{ users: User[] }>('/api/users')
    users.value = response.users
  } catch {
    errorMessage.value = 'メンバー一覧の取得に失敗しました。'
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  editingUser.value = null
  resetForm()
  dialogOpen.value = true
}

const openEditDialog = (user: User) => {
  editingUser.value = user

  form.student_number = user.student_number
  form.name = user.name
  form.nickname = user.nickname ?? ''

  dialogOpen.value = true
}

const closeDialog = () => {
  if (saving.value) {
    return
  }

  dialogOpen.value = false
  editingUser.value = null
  resetForm()
}

const openPasswordDialog = (user: User) => {
  passwordUser.value = user
  passwordForm.password = ''
  passwordForm.confirmation = ''
  passwordDialogOpen.value = true
}

const closePasswordDialog = () => {
  if (passwordSaving.value) {
    return
  }

  passwordDialogOpen.value = false
  passwordUser.value = null
  passwordForm.password = ''
  passwordForm.confirmation = ''
}

const setPassword = async () => {
  if (!passwordUser.value) {
    return
  }

  if (passwordForm.password.length < 8) {
    errorMessage.value = 'パスワードは8文字以上で入力してください。'
    return
  }

  if (passwordForm.password !== passwordForm.confirmation) {
    errorMessage.value = 'パスワードが一致していません。'
    return
  }

  passwordSaving.value = true
  errorMessage.value = ''

  try {
    await apiFetch(
      `/api/users/${passwordUser.value.id}/password`,
      {
        method: 'PATCH',
        body: {
          password: passwordForm.password,
        },
      },
    )

    closePasswordDialog()
  } catch (error: unknown) {
    const apiError = error as {
      data?: {
        error?: string
      }
    }

    errorMessage.value =
      apiError.data?.error ||
      'パスワードの設定に失敗しました。'
  } finally {
    passwordSaving.value = false
  }
}

const saveUser = async () => {
  if (!form.student_number.trim()) {
    errorMessage.value = '学籍番号を入力してください。'
    return
  }

  if (!form.name.trim()) {
    errorMessage.value = '氏名を入力してください。'
    return
  }

  if (!editingUser.value && !form.account_role_id) {
    errorMessage.value = 'アカウント権限を選択してください。'
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    if (editingUser.value) {
      const updatedUser = await apiFetch<User>(
        `/api/users/${editingUser.value.id}`,
        {
          method: 'PATCH',
          body: {
            student_number: form.student_number.trim(),
            name: form.name.trim(),
            nickname: form.nickname.trim() || null,
          },
        },
      )

      const index = users.value.findIndex(
        (user) => user.id === updatedUser.id,
      )

      if (index !== -1) {
        users.value[index] = updatedUser
      }
    } else {
      const newUser = await apiFetch<User>('/api/users', {
        method: 'POST',
        body: {
          id: crypto.randomUUID(),
          student_number: form.student_number.trim(),
          name: form.name.trim(),
          nickname: form.nickname.trim() || null,
          account_role_id: form.account_role_id,
        },
      })

      users.value.push(newUser)
    }

    closeDialog()
  } catch (error: unknown) {
    const apiError = error as {
      data?: {
        error?: string
      }
    }

    if (apiError.data?.error) {
      errorMessage.value = apiError.data.error
    } else {
      errorMessage.value = editingUser.value
        ? 'メンバーの更新に失敗しました。'
        : 'メンバーの登録に失敗しました。'
    }
  } finally {
    saving.value = false
  }
}

const fetchAccountRoles = async () => {
  accountRolesLoading.value = true

  try {
    const response = await apiFetch<{
      account_roles: AccountRole[]
    }>('/api/account-roles')

    accountRoles.value = response.account_roles
  } catch {
    errorMessage.value = 'アカウント権限の取得に失敗しました。'
  } finally {
    accountRolesLoading.value = false
  }
}

const deleteUser = async (user: User) => {
  const confirmed = window.confirm(
    `「${user.name}」を削除しますか？\n\nこの操作は元に戻せません。`,
  )

  if (!confirmed) {
    return
  }

  errorMessage.value = ''

  try {
    await apiFetch(`/api/users/${user.id}`, {
      method: 'DELETE',
    })

    users.value = users.value.filter(
      (item) => item.id !== user.id,
    )
  } catch {
    errorMessage.value = 'メンバーの削除に失敗しました。'
  }
}

const getInitial = (name: string) => {
  return name.trim().charAt(0) || '?'
}

onMounted(async () => {
  await Promise.all([
    fetchUsers(),
    fetchAccountRoles(),
  ])
})
</script>

<style scoped>
.admin-users-page {
  max-width: 1200px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.page-eyebrow {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.page-title {
  margin: 4px 0 0;
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  font-weight: 800;
  line-height: 1.2;
}

.page-description {
  margin: 8px 0 0;
  color: rgb(var(--v-theme-on-surface-variant));
}

.border-t {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.empty-state {
  padding: 72px 24px;
  text-align: center;
}

@media (max-width: 600px) {
  .page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .page-header .v-btn {
    width: 100%;
  }
}
</style>

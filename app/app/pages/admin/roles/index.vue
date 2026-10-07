<template>
  <v-container class="admin-roles-page py-8">
    <v-col cols="12" lg="10" class="pt-4 pb-0">
      <LayoutBackButton />
    </v-col>

    <div class="page-header">
      <div>
        <div class="page-eyebrow">
          ACTIVITY ROLES
        </div>

        <h1 class="page-title">
          活動ロール管理
        </h1>

        <p class="page-description">
          アカウント権限と38Rメンバーの活動上の役割を管理できます。
        </p>
      </div>

      <div class="d-flex ga-2 flex-wrap">
        <v-btn
          color="primary"
          prepend-icon="mdi-shield-plus-outline"
          rounded="lg"
          variant="outlined"
          @click="openCreateAccountRoleDialog"
        >
          権限を追加
        </v-btn>

        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          rounded="lg"
          @click="openCreateDialog"
        >
          ロールを追加
        </v-btn>
      </div>
    </div>

    <v-card
      rounded="xl"
      variant="outlined"
      class="permission-card mt-6"
    >
      <v-card-item>
        <template #prepend>
          <v-icon
            icon="mdi-shield-account-outline"
            size="32"
            color="primary"
          />
        </template>

        <v-card-title>
          アカウント権限
        </v-card-title>

        <v-card-subtitle>
          システム上の権限を管理します。
        </v-card-subtitle>
      </v-card-item>

      <v-divider />

      <v-card-text>
        <div
          v-if="accountRolesLoading"
          class="d-flex justify-center py-8"
        >
          <v-progress-circular
            indeterminate
            color="primary"
          />
        </div>

        <v-row v-else-if="accountRoles.length">
          <v-col
            v-for="accountRole in accountRoles"
            :key="accountRole.id"
            cols="12"
            sm="6"
            md="4"
          >
            <v-card
              rounded="lg"
              variant="tonal"
              color="primary"
            >
              <v-card-item>
                <v-card-title>
                  {{ accountRole.name }}
                </v-card-title>

                <v-card-subtitle>
                  {{ accountRole.description || '説明なし' }}
                </v-card-subtitle>
              </v-card-item>

              <v-card-actions>
                <v-chip
                  size="small"
                  variant="tonal"
                >
                  {{ accountRole.memberCount }}人
                </v-chip>

                <v-spacer />

                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-account-multiple-outline"
                  @click="openAccountRoleMembersDialog(accountRole)"
                >
                  メンバー管理
                </v-btn>

                <v-menu>
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      icon="mdi-dots-vertical"
                      variant="text"
                      density="comfortable"
                    />
                  </template>

                  <v-list density="compact">
                    <v-list-item
                      prepend-icon="mdi-pencil-outline"
                      title="編集"
                      @click="openEditAccountRoleDialog(accountRole)"
                    />

                    <v-list-item
                      prepend-icon="mdi-delete-outline"
                      title="削除"
                      class="text-error"
                      @click="openDeleteAccountRoleDialog(accountRole)"
                    />
                  </v-list>
                </v-menu>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <div
          v-else
          class="text-center text-medium-emphasis py-6"
        >
          アカウント権限がありません。
        </div>
      </v-card-text>
    </v-card>

    <v-divider class="my-8" />

    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mt-4"
      closable
      @click:close="errorMessage = ''"
    >
      {{ errorMessage }}
    </v-alert>

    <div
      v-if="loading"
      class="d-flex justify-center py-12"
    >
      <v-progress-circular
        indeterminate
        color="primary"
      />
    </div>

    <v-row
      v-else-if="roles.length"
      class="mt-4"
    >
      <v-col
        v-for="role in roles"
        :key="role.id"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card
          rounded="xl"
          variant="outlined"
          class="role-card"
        >
          <v-card-item>
            <template #prepend>
              <v-icon
                icon="mdi-account-multiple-outline"
                size="32"
                color="primary"
              />
            </template>

            <v-card-title>
              {{ role.name }}
            </v-card-title>

            <v-card-subtitle>
              {{ role.description || '説明なし' }}
            </v-card-subtitle>
          </v-card-item>

          <v-card-actions>
            <v-chip
              size="small"
              variant="tonal"
              color="primary"
            >
              {{ role.memberCount }}人
            </v-chip>

            <v-spacer />

            <v-btn
              variant="tonal"
              size="small"
              prepend-icon="mdi-account-multiple-outline"
              @click="openMembersDialog(role)"
            >
              メンバー管理
            </v-btn>

            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-dots-vertical"
                  variant="text"
                  density="comfortable"
                />
              </template>

              <v-list density="compact">
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="編集"
                  @click="openEditDialog(role)"
                />

                <v-list-item
                  prepend-icon="mdi-delete-outline"
                  title="削除"
                  class="text-error"
                  @click="openDeleteDialog(role)"
                />
              </v-list>
            </v-menu>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-card
      v-else
      rounded="xl"
      variant="outlined"
      class="empty-card mt-4"
    >
      <v-card-text class="text-center py-12">
        <v-icon
          icon="mdi-account-multiple-outline"
          size="48"
          color="medium-emphasis"
        />

        <div class="text-h6 mt-4">
          活動ロールがありません
        </div>

        <div class="text-body-2 text-medium-emphasis mt-2">
          「ロールを追加」から最初の活動ロールを作成できます。
        </div>
      </v-card-text>
    </v-card>

    <v-dialog
      v-model="accountRoleDialog"
      max-width="520"
    >
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-2">
          {{ editingAccountRole ? 'アカウント権限を編集' : 'アカウント権限を追加' }}
        </v-card-title>

        <v-card-text class="px-6">
          <v-text-field
            v-model="accountRoleForm.name"
            label="権限名"
            placeholder="例：admin"
            variant="outlined"
            :error-messages="accountRoleFormError"
            class="mt-2"
          />

          <v-textarea
            v-model="accountRoleForm.description"
            label="説明"
            placeholder="この権限の説明を入力"
            variant="outlined"
            rows="3"
            auto-grow
          />
        </v-card-text>

        <v-card-actions class="px-6 pb-6">
          <v-spacer />

          <v-btn
            variant="text"
            @click="accountRoleDialog = false"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="primary"
            :loading="accountRoleSaving"
            @click="saveAccountRole"
          >
            {{ editingAccountRole ? '保存' : '作成' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="accountRoleDeleteDialog"
      max-width="440"
    >
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-2">
          アカウント権限を削除
        </v-card-title>

        <v-card-text class="px-6">
          <strong>{{ deletingAccountRole?.name }}</strong>
          を削除しますか？

          <div class="text-body-2 text-medium-emphasis mt-3">
            使用中の権限は削除できません。
          </div>
        </v-card-text>

        <v-card-actions class="px-6 pb-6">
          <v-spacer />

          <v-btn
            variant="text"
            @click="accountRoleDeleteDialog = false"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="error"
            :loading="accountRoleDeleting"
            @click="deleteAccountRole"
          >
            削除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="accountRoleMembersDialog"
      max-width="680"
      scrollable
    >
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-2">
          <div class="d-flex align-center">
            <v-icon
              icon="mdi-shield-account-outline"
              color="primary"
              class="mr-3"
            />

            <div>
              <div class="text-h6">
                {{ accountRoleMembersTarget?.name }}
              </div>

              <div class="text-body-2 text-medium-emphasis mt-1">
                {{ selectedAccountRoleMemberCount }}人が付与中
              </div>
            </div>
          </div>
        </v-card-title>

        <v-card-text class="px-6">
          <v-text-field
            v-model="accountRoleMemberSearch"
            prepend-inner-icon="mdi-magnify"
            label="メンバーを検索"
            placeholder="名前・ニックネーム・学籍番号"
            variant="outlined"
            density="comfortable"
            clearable
            hide-details
            class="mb-4"
          />

          <div
            v-if="accountRoleMembersLoading"
            class="d-flex justify-center py-10"
          >
            <v-progress-circular
              indeterminate
              color="primary"
            />
          </div>

          <v-alert
            v-else-if="accountRoleMembersError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ accountRoleMembersError }}
          </v-alert>

          <v-list
            v-else
            class="member-list"
            lines="two"
          >
            <v-list-item
              v-for="member in filteredAccountRoleMembers"
              :key="member.id"
              class="member-item"
              @click="toggleAccountRoleMember(member)"
            >
              <template #prepend>
                <v-checkbox-btn
                  :model-value="member.assigned"
                  :disabled="member.saving"
                  color="primary"
                  @click.stop
                  @update:model-value="toggleAccountRoleMember(member)"
                />
              </template>

              <v-list-item-title>
                {{ member.nickname || member.name }}
              </v-list-item-title>

              <v-list-item-subtitle>
                {{ member.student_number }}
                <span v-if="member.nickname">
                  ・{{ member.name }}
                </span>
              </v-list-item-subtitle>

              <template #append>
                <v-progress-circular
                  v-if="member.saving"
                  indeterminate
                  size="20"
                  width="2"
                  color="primary"
                />

                <v-chip
                  v-else-if="member.assigned"
                  size="small"
                  variant="tonal"
                  color="primary"
                >
                  付与中
                </v-chip>
              </template>
            </v-list-item>

            <v-list-item
              v-if="!filteredAccountRoleMembers.length"
            >
              <v-list-item-title class="text-center text-medium-emphasis py-6">
                該当するメンバーがいません
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions class="px-6 pb-6">
          <v-spacer />

          <v-btn
            variant="text"
            @click="accountRoleMembersDialog = false"
          >
            閉じる
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="dialog"
      max-width="520"
    >
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-2">
          {{ editingRole ? 'ロールを編集' : 'ロールを追加' }}
        </v-card-title>

        <v-card-text class="px-6">
          <v-text-field
            v-model="form.name"
            label="ロール名"
            placeholder="例：劇班"
            variant="outlined"
            :error-messages="formErrors.name"
            class="mt-2"
          />

          <v-textarea
            v-model="form.description"
            label="説明"
            placeholder="このロールの役割を入力"
            variant="outlined"
            rows="3"
            auto-grow
            :error-messages="formErrors.description"
          />
        </v-card-text>

        <v-card-actions class="px-6 pb-6">
          <v-spacer />

          <v-btn
            variant="text"
            @click="dialog = false"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="primary"
            :loading="saving"
            @click="saveRole"
          >
            {{ editingRole ? '保存' : '作成' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="deleteDialog"
      max-width="440"
    >
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-2">
          ロールを削除
        </v-card-title>

        <v-card-text class="px-6">
          <strong>{{ deletingRole?.name }}</strong>
          を削除しますか？

          <div class="text-body-2 text-medium-emphasis mt-3">
            このロールの所属情報も削除されます。
          </div>
        </v-card-text>

        <v-card-actions class="px-6 pb-6">
          <v-spacer />

          <v-btn
            variant="text"
            @click="deleteDialog = false"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="error"
            :loading="deleting"
            @click="deleteRole"
          >
            削除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="membersDialog"
      max-width="680"
      scrollable
    >
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-2">
          <div class="d-flex align-center">
            <v-icon
              icon="mdi-account-multiple-outline"
              color="primary"
              class="mr-3"
            />

            <div>
              <div class="text-h6">
                {{ membersRole?.name }}
              </div>

              <div class="text-body-2 text-medium-emphasis mt-1">
                {{ selectedMemberCount }}人が所属中
              </div>
            </div>
          </div>
        </v-card-title>

        <v-card-text class="px-6">
          <v-text-field
            v-model="memberSearch"
            prepend-inner-icon="mdi-magnify"
            label="メンバーを検索"
            placeholder="名前・ニックネーム・学籍番号"
            variant="outlined"
            density="comfortable"
            clearable
            hide-details
            class="mb-4"
          />

          <div
            v-if="membersLoading"
            class="d-flex justify-center py-10"
          >
            <v-progress-circular
              indeterminate
              color="primary"
            />
          </div>

          <v-alert
            v-else-if="membersError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ membersError }}
          </v-alert>

          <v-list
            v-else
            class="member-list"
            lines="two"
          >
            <v-list-item
              v-for="member in filteredMembers"
              :key="member.id"
              class="member-item"
              @click="toggleMember(member)"
            >
              <template #prepend>
                <v-checkbox-btn
                  :model-value="member.assigned"
                  :disabled="member.saving"
                  color="primary"
                  @click.stop
                  @update:model-value="toggleMember(member)"
                />
              </template>

              <v-list-item-title>
                {{ member.nickname || member.name }}
              </v-list-item-title>

              <v-list-item-subtitle>
                {{ member.student_number }}
                <span v-if="member.nickname">
                  ・{{ member.name }}
                </span>
              </v-list-item-subtitle>

              <template #append>
                <v-progress-circular
                  v-if="member.saving"
                  indeterminate
                  size="20"
                  width="2"
                  color="primary"
                />

                <v-chip
                  v-else-if="member.assigned"
                  size="small"
                  variant="tonal"
                  color="primary"
                >
                  所属中
                </v-chip>
              </template>
            </v-list-item>

            <v-list-item
              v-if="!filteredMembers.length"
            >
              <v-list-item-title class="text-center text-medium-emphasis py-6">
                該当するメンバーがいません
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions class="px-6 pb-6">
          <v-spacer />

          <v-btn
            variant="text"
            @click="membersDialog = false"
          >
            閉じる
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'admin'],
})

interface Role {
  id: string
  name: string
  description: string | null
  created_at: string
  memberCount: number
}

interface RoleResponse {
  roles: Array<{
    id: string
    name: string
    description: string | null
    created_at: string
  }>
}

interface User {
  id: string
  student_number: string
  name: string
  nickname: string | null
  created_at: string
  updated_at: string
}

interface UserRolesResponse {
  roles: Array<{
    id: string
    name: string
    description: string | null
    created_at: string
  }>
}

interface RoleMember extends User {
  assigned: boolean
  saving: boolean
}

const { apiFetch } = useApi()

interface AccountRole {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  memberCount: number
}

interface AccountRoleResponse {
  account_roles: Array<{
    id: string
    name: string
    description: string | null
    created_at: string
    updated_at: string
  }>
}

interface UserAccountRolesResponse {
  account_roles: Array<{
    id: string
    name: string
    description: string | null
    created_at: string
    updated_at: string
  }>
}

interface AccountRoleMember extends User {
  assigned: boolean
  saving: boolean
}

const accountRoles = ref<AccountRole[]>([])
const accountRolesLoading = ref(false)
const accountRoleSaving = ref(false)
const accountRoleDeleting = ref(false)

const accountRoleDialog = ref(false)
const accountRoleDeleteDialog = ref(false)

const editingAccountRole = ref<AccountRole | null>(null)
const deletingAccountRole = ref<AccountRole | null>(null)

const accountRoleForm = reactive({
  name: '',
  description: '',
})

const accountRoleFormError = ref('')

const accountRoleMembersDialog = ref(false)
const accountRoleMembersLoading = ref(false)
const accountRoleMembersError = ref('')
const accountRoleMembersTarget = ref<AccountRole | null>(null)
const accountRoleMembers = ref<AccountRoleMember[]>([])
const accountRoleMemberSearch = ref('')

const roles = ref<Role[]>([])
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const errorMessage = ref('')

const dialog = ref(false)
const deleteDialog = ref(false)

const editingRole = ref<Role | null>(null)
const deletingRole = ref<Role | null>(null)

const form = reactive({
  name: '',
  description: '',
})

const formErrors = reactive({
  name: '',
  description: '',
})

const membersDialog = ref(false)
const membersLoading = ref(false)
const membersError = ref('')
const membersRole = ref<Role | null>(null)
const members = ref<RoleMember[]>([])
const memberSearch = ref('')

const selectedAccountRoleMemberCount = computed(() => {
  return accountRoleMembers.value.filter(member => member.assigned).length
})

const filteredAccountRoleMembers = computed(() => {
  const keyword = accountRoleMemberSearch.value.trim().toLowerCase()

  if (!keyword) {
    return accountRoleMembers.value
  }

  return accountRoleMembers.value.filter(member => {
    return [
      member.name,
      member.nickname || '',
      member.student_number,
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const selectedMemberCount = computed(() => {
  return members.value.filter(member => member.assigned).length
})

const filteredMembers = computed(() => {
  const keyword = memberSearch.value.trim().toLowerCase()

  if (!keyword) {
    return members.value
  }

  return members.value.filter(member => {
    return [
      member.name,
      member.nickname || '',
      member.student_number,
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const resetAccountRoleForm = () => {
  accountRoleForm.name = ''
  accountRoleForm.description = ''
  accountRoleFormError.value = ''
}

const loadAccountRoles = async () => {
  accountRolesLoading.value = true

  try {
    const response = await apiFetch<AccountRoleResponse>('/api/account-roles')
    const usersResponse = await apiFetch<{ users: User[] }>('/api/users')

    const loadedRoles: AccountRole[] = []

    for (const accountRole of response.account_roles) {
      let memberCount = 0

      for (const user of usersResponse.users) {
        const userRoles = await apiFetch<UserAccountRolesResponse>(
          `/api/users/${user.id}/account-roles`,
        )

        if (
          userRoles.account_roles.some(
            userRole => userRole.id === accountRole.id,
          )
        ) {
          memberCount++
        }
      }

      loadedRoles.push({
        ...accountRole,
        memberCount,
      })
    }

    accountRoles.value = loadedRoles
  } catch (error) {
    console.error(error)
    errorMessage.value = 'アカウント権限の取得に失敗しました。'
  } finally {
    accountRolesLoading.value = false
  }
}

const openCreateAccountRoleDialog = () => {
  editingAccountRole.value = null
  resetAccountRoleForm()
  accountRoleDialog.value = true
}

const openEditAccountRoleDialog = (role: AccountRole) => {
  editingAccountRole.value = role
  accountRoleForm.name = role.name
  accountRoleForm.description = role.description || ''
  accountRoleFormError.value = ''
  accountRoleDialog.value = true
}

const openDeleteAccountRoleDialog = (role: AccountRole) => {
  deletingAccountRole.value = role
  accountRoleDeleteDialog.value = true
}

const saveAccountRole = async () => {
  accountRoleFormError.value = ''

  if (!accountRoleForm.name.trim()) {
    accountRoleFormError.value = '権限名を入力してください。'
    return
  }

  accountRoleSaving.value = true

  try {
    const body = {
      name: accountRoleForm.name.trim(),
      description: accountRoleForm.description.trim() || null,
    }

    if (editingAccountRole.value) {
      await apiFetch(
        `/api/account-roles/${editingAccountRole.value.id}`,
        {
          method: 'PATCH',
          body,
        },
      )
    } else {
      await apiFetch('/api/account-roles', {
        method: 'POST',
        body,
      })
    }

    accountRoleDialog.value = false
    await loadAccountRoles()
  } catch (error) {
    console.error(error)
    accountRoleFormError.value =
      'アカウント権限の保存に失敗しました。'
  } finally {
    accountRoleSaving.value = false
  }
}

const deleteAccountRole = async () => {
  if (!deletingAccountRole.value) return

  accountRoleDeleting.value = true

  try {
    await apiFetch(
      `/api/account-roles/${deletingAccountRole.value.id}`,
      {
        method: 'DELETE',
      },
    )

    accountRoleDeleteDialog.value = false
    deletingAccountRole.value = null
    await loadAccountRoles()
  } catch (error) {
    console.error(error)
    errorMessage.value =
      'アカウント権限の削除に失敗しました。使用中の権限は削除できません。'
  } finally {
    accountRoleDeleting.value = false
  }
}

const openAccountRoleMembersDialog = async (role: AccountRole) => {
  accountRoleMembersTarget.value = role
  accountRoleMembersDialog.value = true
  accountRoleMemberSearch.value = ''
  accountRoleMembersError.value = ''
  accountRoleMembers.value = []
  await loadAccountRoleMembers(role)
}

const loadAccountRoleMembers = async (role: AccountRole) => {
  accountRoleMembersLoading.value = true
  accountRoleMembersError.value = ''

  try {
    const usersResponse = await apiFetch<{ users: User[] }>('/api/users')

    const loadedMembers: AccountRoleMember[] = []

    for (const user of usersResponse.users) {
      const userRoles = await apiFetch<UserAccountRolesResponse>(
        `/api/users/${user.id}/account-roles`,
      )

      loadedMembers.push({
        ...user,
        assigned: userRoles.account_roles.some(
          accountRole => accountRole.id === role.id,
        ),
        saving: false,
      })
    }

    accountRoleMembers.value = loadedMembers
    updateAccountRoleMemberCount(role.id)
  } catch (error) {
    console.error(error)
    accountRoleMembersError.value =
      'メンバー情報の取得に失敗しました。'
  } finally {
    accountRoleMembersLoading.value = false
  }
}

const updateAccountRoleMemberCount = (roleId: string) => {
  const role = accountRoles.value.find(item => item.id === roleId)

  if (!role) return

  role.memberCount = accountRoleMembers.value.filter(
    member => member.assigned,
  ).length
}

const toggleAccountRoleMember = async (
  member: AccountRoleMember,
) => {
  if (!accountRoleMembersTarget.value || member.saving) return

  const roleId = accountRoleMembersTarget.value.id
  const nextAssigned = !member.assigned

  member.saving = true

  try {
    if (nextAssigned) {
      await apiFetch(`/api/users/${member.id}/account-roles`, {
        method: 'POST',
        body: {
          account_role_id: roleId,
        },
      })
    } else {
      await apiFetch(
        `/api/users/${member.id}/account-roles/${roleId}`,
        {
          method: 'DELETE',
        },
      )
    }

    member.assigned = nextAssigned
    updateAccountRoleMemberCount(roleId)
  } catch (error) {
    console.error(error)
    accountRoleMembersError.value = nextAssigned
      ? 'アカウント権限の付与に失敗しました。'
      : 'アカウント権限の解除に失敗しました。'
  } finally {
    member.saving = false
  }
}

const resetForm = () => {
  form.name = ''
  form.description = ''
  formErrors.name = ''
  formErrors.description = ''
}

const loadRoles = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await apiFetch<RoleResponse>('/api/roles')

    const loadedRoles: Role[] = []

    for (const role of response.roles) {
      const usersResponse = await apiFetch<{ users: User[] }>('/api/users')

      let memberCount = 0

      for (const user of usersResponse.users) {
        const userRoles = await apiFetch<UserRolesResponse>(
          `/api/users/${user.id}/roles`,
        )

        if (userRoles.roles.some(userRole => userRole.id === role.id)) {
          memberCount++
        }
      }

      loadedRoles.push({
        ...role,
        memberCount,
      })
    }

    roles.value = loadedRoles
  } catch (error) {
    console.error(error)
    errorMessage.value = 'ロールの取得に失敗しました。'
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  editingRole.value = null
  resetForm()
  dialog.value = true
}

const openEditDialog = (role: Role) => {
  editingRole.value = role
  form.name = role.name
  form.description = role.description || ''
  formErrors.name = ''
  formErrors.description = ''
  dialog.value = true
}

const validateForm = () => {
  formErrors.name = ''
  formErrors.description = ''

  if (!form.name.trim()) {
    formErrors.name = 'ロール名を入力してください。'
    return false
  }

  return true
}

const saveRole = async () => {
  if (!validateForm()) return

  saving.value = true
  errorMessage.value = ''

  try {
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
    }

    if (editingRole.value) {
      await apiFetch(`/api/roles/${editingRole.value.id}`, {
        method: 'PATCH',
        body,
      })
    } else {
      await apiFetch('/api/roles', {
        method: 'POST',
        body,
      })
    }

    dialog.value = false
    await Promise.all([
  loadAccountRoles(),
  loadRoles(),
])
  } catch (error) {
    console.error(error)
    errorMessage.value = 'ロールの保存に失敗しました。'
  } finally {
    saving.value = false
  }
}

const openDeleteDialog = (role: Role) => {
  deletingRole.value = role
  deleteDialog.value = true
}

const deleteRole = async () => {
  if (!deletingRole.value) return

  deleting.value = true
  errorMessage.value = ''

  try {
    await apiFetch(`/api/roles/${deletingRole.value.id}`, {
      method: 'DELETE',
    })

    deleteDialog.value = false
    deletingRole.value = null
    await loadRoles()
  } catch (error) {
    console.error(error)
    errorMessage.value = 'ロールの削除に失敗しました。'
  } finally {
    deleting.value = false
  }
}

const openMembersDialog = async (role: Role) => {
  membersRole.value = role
  membersDialog.value = true
  memberSearch.value = ''
  membersError.value = ''
  members.value = []
  await loadMembers(role)
}

const loadMembers = async (role: Role) => {
  membersLoading.value = true
  membersError.value = ''

  try {
    const usersResponse = await apiFetch<{ users: User[] }>('/api/users')

    const loadedMembers: RoleMember[] = []

    for (const user of usersResponse.users) {
      const userRoles = await apiFetch<UserRolesResponse>(
        `/api/users/${user.id}/roles`,
      )

      loadedMembers.push({
        ...user,
        assigned: userRoles.roles.some(
          userRole => userRole.id === role.id,
        ),
        saving: false,
      })
    }

    members.value = loadedMembers
    updateRoleMemberCount(role.id)
  } catch (error) {
    console.error(error)
    membersError.value = 'メンバー情報の取得に失敗しました。'
  } finally {
    membersLoading.value = false
  }
}

const updateRoleMemberCount = (roleId: string) => {
  const role = roles.value.find(item => item.id === roleId)

  if (!role) return

  role.memberCount = members.value.filter(
    member => member.assigned,
  ).length
}

const toggleMember = async (member: RoleMember) => {
  if (!membersRole.value || member.saving) return

  const roleId = membersRole.value.id
  const nextAssigned = !member.assigned

  member.saving = true

  try {
    if (nextAssigned) {
      await apiFetch(`/api/users/${member.id}/roles`, {
        method: 'POST',
        body: {
          role_id: roleId,
        },
      })
    } else {
      await apiFetch(
        `/api/users/${member.id}/roles/${roleId}`,
        {
          method: 'DELETE',
        },
      )
    }

    member.assigned = nextAssigned
    updateRoleMemberCount(roleId)
  } catch (error) {
    console.error(error)
    membersError.value = nextAssigned
      ? 'ロールの追加に失敗しました。'
      : 'ロールの解除に失敗しました。'
  } finally {
    member.saving = false
  }
}

await loadRoles()
</script>

<style scoped>
.admin-roles-page {
  max-width: 1200px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 8px 4px;
}

.page-eyebrow {
  color: #78909c;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.page-title {
  margin-top: 4px;
  color: var(--color-primary);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
}

.page-description {
  margin-top: 8px;
  color: #78909c;
  font-size: 0.95rem;
}

.permission-card {
  color: var(--color-primary);
}

.role-card {
  height: 100%;
  color: var(--color-primary);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.role-card:hover {
  transform: translateY(-2px);
}

.empty-card {
  color: var(--color-primary);
}

.member-list {
  max-height: 480px;
  overflow-y: auto;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
}

.member-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.member-item:last-child {
  border-bottom: none;
}

@media (max-width: 600px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

<script setup lang="ts">
definePageMeta({
  middleware: ['admin'],
})

interface Permission {
  id: string
  key: string
  name: string
  description: string | null
  category: string
}

interface Target {
  id: string
  name: string
  description?: string | null
}

interface UserTarget {
  id: string
  name: string | null
  nickname: string | null
  user_id: string
}

interface Assignment {
  permission_id: string
  effect: 'allow' | 'deny'
}

const api = useApi()

type TargetType = 'account-roles' | 'roles' | 'users'
type Effect = 'allow' | 'deny'

const targetType = ref<TargetType>('account-roles')
const permissions = ref<Permission[]>([])
const accountRoles = ref<Target[]>([])
const roles = ref<Target[]>([])
const users = ref<UserTarget[]>([])

const selectedTargetId = ref('')
const assignments = ref<Record<string, Effect>>({})
const loading = ref(true)
const targetLoading = ref(false)
const savingPermissionId = ref('')
const errorMessage = ref('')

const categoryLabels: Record<string, string> = {
  tasks: 'タスク',
  schedule: '予定・カレンダー',
  script: '台本',
  equipment: '備品',
  accounting: '会計',
  members: 'メンバー',
  attendance: '出欠',
}

const targetLabel = computed(() => {
  if (targetType.value === 'account-roles') return 'アカウントロール'
  if (targetType.value === 'roles') return '係・活動ロール'
  return '個人'
})

const currentTargets = computed(() => {
  if (targetType.value === 'account-roles') return accountRoles.value
  if (targetType.value === 'roles') return roles.value

  return users.value.map((user) => ({
    id: user.id,
    name:
      user.nickname ||
      user.name ||
      user.user_id,
    description: user.name && user.nickname
      ? user.user_id
      : null,
  }))
})

const groupedPermissions = computed(() => {
  const groups = new Map<string, Permission[]>()

  for (const permission of permissions.value) {
    const list = groups.get(permission.category) || []
    list.push(permission)
    groups.set(permission.category, list)
  }

  return [...groups.entries()]
})

const selectedTarget = computed(() =>
  currentTargets.value.find(
    (target) => target.id === selectedTargetId.value,
  ),
)

function getEffect(permissionId: string): Effect | null {
  return assignments.value[permissionId] || null
}

function getEffectColor(effect: Effect | null) {
  if (effect === 'allow') return 'success'
  if (effect === 'deny') return 'error'
  return undefined
}

function getEffectLabel(effect: Effect | null) {
  if (effect === 'allow') return '許可'
  if (effect === 'deny') return '拒否'
  return '未設定'
}

async function loadBaseData() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [permissionResponse, accountRoleResponse, roleResponse, userResponse] =
      await Promise.all([
        api.apiFetch<{ permissions: Permission[] }>('/api/permissions'),
        api.apiFetch<{ account_roles: Target[] }>('/api/account-roles'),
        api.apiFetch<{ roles: Target[] }>('/api/roles'),
        api.apiFetch<{ users: UserTarget[] }>('/api/permissions/users'),
      ])

    permissions.value = permissionResponse.permissions
    accountRoles.value = accountRoleResponse.account_roles
    roles.value = roleResponse.roles
    users.value = userResponse.users

    if (!selectedTargetId.value && currentTargets.value.length) {
      const firstTarget = currentTargets.value[0]
      if (firstTarget) {
        selectedTargetId.value = firstTarget.id
      }
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = '権限管理情報の取得に失敗しました。'
  } finally {
    loading.value = false
  }
}

async function loadAssignments() {
  if (!selectedTargetId.value) {
    assignments.value = {}
    return
  }

  targetLoading.value = true
  errorMessage.value = ''

  try {
    const response = await api.apiFetch<{
      assignments: Assignment[]
    }>(
      `/api/permissions/${targetType.value}/${selectedTargetId.value}`,
    )

    assignments.value = Object.fromEntries(
      response.assignments.map((assignment) => [
        assignment.permission_id,
        assignment.effect,
      ]),
    )
  } catch (error) {
    console.error(error)
    errorMessage.value = '現在の権限設定の取得に失敗しました。'
  } finally {
    targetLoading.value = false
  }
}

async function changeEffect(
  permission: Permission,
  effect: Effect | null,
) {
  if (!selectedTargetId.value) return

  savingPermissionId.value = permission.id
  errorMessage.value = ''

  try {
    if (effect === null) {
      await api.apiFetch(
        `/api/permissions/${targetType.value}/${selectedTargetId.value}/${permission.id}`,
        {
          method: 'DELETE',
        },
      )

      delete assignments.value[permission.id]
    } else {
      await api.apiFetch(
        `/api/permissions/${targetType.value}/${selectedTargetId.value}/${permission.id}`,
        {
          method: 'PUT',
          body: {
            effect,
          },
        },
      )

      assignments.value[permission.id] = effect
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = '権限の更新に失敗しました。'
  } finally {
    savingPermissionId.value = ''
  }
}

async function setTargetType(type: TargetType) {
  targetType.value = type
  selectedTargetId.value = currentTargets.value[0]?.id || ''
  await loadAssignments()
}

async function selectTarget(id: string) {
  selectedTargetId.value = id
  await loadAssignments()
}

watch(
  () => currentTargets.value.length,
  () => {
    if (
      selectedTargetId.value &&
      currentTargets.value.some(
        (target) => target.id === selectedTargetId.value,
      )
    ) {
      return
    }

    selectedTargetId.value = currentTargets.value[0]?.id || ''
  },
)

onMounted(async () => {
  await loadBaseData()
  await loadAssignments()
})
</script>

<template>
  <v-container
    class="admin-permissions-page py-8"
    max-width="1200"
  >
    <v-col
      cols="12"
      class="pt-4 pb-0"
    >
      <LayoutBackButton />
    </v-col>

    <div class="page-header mt-4">
      <div>
        <div class="page-eyebrow">
          PERMISSION MANAGEMENT
        </div>

        <h1 class="page-title">
          権限管理
        </h1>

        <p class="page-description">
          アカウントロール・係・個人に対して、細かな権限を設定できます。
        </p>
      </div>
    </div>

    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mt-6"
      closable
      @click:close="errorMessage = ''"
    >
      {{ errorMessage }}
    </v-alert>

    <div
      v-if="loading"
      class="d-flex justify-center py-16"
    >
      <v-progress-circular
        indeterminate
        color="primary"
      />
    </div>

    <template v-else>
      <v-card
        rounded="xl"
        variant="outlined"
        class="mt-6"
      >
        <v-tabs
          v-model="targetType"
          color="primary"
          grow
          @update:model-value="setTargetType"
        >
          <v-tab value="account-roles">
            <v-icon
              icon="mdi-shield-account-outline"
              class="mr-2"
            />
            アカウントロール
          </v-tab>

          <v-tab value="roles">
            <v-icon
              icon="mdi-account-multiple-outline"
              class="mr-2"
            />
            係・活動ロール
          </v-tab>

          <v-tab value="users">
            <v-icon
              icon="mdi-account-outline"
              class="mr-2"
            />
            個人
          </v-tab>
        </v-tabs>
      </v-card>

      <v-row class="mt-4">
        <v-col
          cols="12"
          md="4"
        >
          <v-card
            rounded="xl"
            variant="outlined"
          >
            <v-card-item>
              <v-card-title>
                {{ targetLabel }}
              </v-card-title>

              <v-card-subtitle>
                権限を設定する対象を選択
              </v-card-subtitle>
            </v-card-item>

            <v-divider />

            <v-list
              v-if="currentTargets.length"
              density="comfortable"
              class="py-2"
            >
              <v-list-item
                v-for="target in currentTargets"
                :key="target.id"
                :active="target.id === selectedTargetId"
                color="primary"
                rounded="lg"
                class="mx-2 my-1"
                @click="selectTarget(target.id)"
              >
                <v-list-item-title>
                  {{ target.name }}
                </v-list-item-title>

                <v-list-item-subtitle
                  v-if="target.description"
                >
                  {{ target.description }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <v-card-text
              v-else
              class="text-center text-medium-emphasis py-8"
            >
              対象がありません。
            </v-card-text>
          </v-card>
        </v-col>

        <v-col
          cols="12"
          md="8"
        >
          <v-card
            rounded="xl"
            variant="outlined"
          >
            <v-card-item>
              <template #prepend>
                <v-icon
                  icon="mdi-shield-key-outline"
                  size="32"
                  color="primary"
                />
              </template>

              <v-card-title>
                {{ selectedTarget?.name || '対象未選択' }}
              </v-card-title>

              <v-card-subtitle>
                権限設定
              </v-card-subtitle>
            </v-card-item>

            <v-divider />

            <div
              v-if="targetLoading"
              class="d-flex justify-center py-12"
            >
              <v-progress-circular
                indeterminate
                color="primary"
              />
            </div>

            <v-card-text v-else>
              <div
                v-for="[category, categoryPermissions] in groupedPermissions"
                :key="category"
                class="permission-category"
              >
                <div class="d-flex align-center mb-2">
                  <div class="text-subtitle-1 font-weight-bold">
                    {{ categoryLabels[category] || category }}
                  </div>

                  <v-chip
                    size="small"
                    variant="tonal"
                    class="ml-2"
                  >
                    {{ categoryPermissions.length }}
                  </v-chip>
                </div>

                <v-card
                  variant="outlined"
                  rounded="lg"
                  class="mb-5"
                >
                  <v-list density="compact">
                    <v-list-item
                      v-for="permission in categoryPermissions"
                      :key="permission.id"
                    >
                      <v-list-item-title>
                        {{ permission.name }}
                      </v-list-item-title>

                      <v-list-item-subtitle>
                        <code>{{ permission.key }}</code>
                        <span
                          v-if="permission.description"
                          class="ml-2"
                        >
                          {{ permission.description }}
                        </span>
                      </v-list-item-subtitle>

                      <template #append>
                        <v-btn-toggle
                          :model-value="getEffect(permission.id)"
                          mandatory
                          divided
                          density="compact"
                          color="primary"
                          :disabled="
                            savingPermissionId === permission.id
                          "
                        >
                          <v-btn
                            value="allow"
                            size="small"
                            @click="changeEffect(permission, 'allow')"
                          >
                            許可
                          </v-btn>

                          <v-btn
                            value="deny"
                            size="small"
                            color="error"
                            @click="changeEffect(permission, 'deny')"
                          >
                            拒否
                          </v-btn>

                          <v-btn
                            value="unset"
                            size="small"
                            @click="changeEffect(permission, null)"
                          >
                            未設定
                          </v-btn>
                        </v-btn-toggle>

                        <v-chip
                          v-if="getEffect(permission.id)"
                          :color="getEffectColor(getEffect(permission.id))"
                          size="small"
                          variant="tonal"
                          class="ml-2 d-none d-sm-flex"
                        >
                          {{ getEffectLabel(getEffect(permission.id)) }}
                        </v-chip>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-card>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<style scoped>
.admin-permissions-page {
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.page-eyebrow {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: rgb(var(--v-theme-primary));
}

.page-title {
  margin-top: 4px;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.1;
  font-weight: 800;
}

.page-description {
  margin-top: 12px;
  color: rgba(var(--v-theme-on-surface), 0.68);
}

.permission-category + .permission-category {
  margin-top: 20px;
}

code {
  font-size: 0.8em;
}
</style>

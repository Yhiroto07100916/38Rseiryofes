<script setup lang="ts">
definePageMeta({
  middleware: ['admin'],
})

interface SiteSettings {
  site_name: string
  site_description: string
  event_name: string
  event_year: number
  site_visibility?: 'public' | 'private'
  maintenance_mode?: boolean
  maintenance_message?: string
  login_enabled?: boolean
  require_login?: boolean
}

interface UserOption {
  id: string
  student_number: string
  name: string
  nickname: string | null
}

interface SettingLog {
  id: string
  setting_key: string
  old_value: string | null
  new_value: string
  changed_at: string
  changed_by_name: string | null
  changed_by_nickname: string | null
}

const api = useApi()
const settings = reactive<SiteSettings>({
  site_name: '',
  site_description: '',
  event_name: '',
  event_year: new Date().getFullYear(),
})
const importantAdmins = ref<UserOption[]>([])
const users = ref<UserOption[]>([])
const settingLogs = ref<SettingLog[]>([])
const selectedUserId = ref('')
const loading = ref(true)
const saving = ref(false)
const assigning = ref(false)
const isImportantSettingsAdmin = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const availableUsers = computed(() => {
  const assigned = new Set(importantAdmins.value.map((user) => user.id))
  return users.value.filter((user) => !assigned.has(user.id))
})

function displayUser(user: UserOption) {
  const displayName = user.nickname || user.name
  return `${displayName}（${user.student_number}）`
}

async function loadSettings() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.apiFetch<{ settings: Partial<SiteSettings> }>(
      '/api/account-roles/settings',
    )
    Object.assign(settings, response.settings)
    const logResponse = await api.apiFetch<{ logs: SettingLog[] }>(
      '/api/account-roles/settings/logs',
    )
    settingLogs.value = logResponse.logs

    try {
      const adminResponse = await api.apiFetch<{ users: UserOption[] }>(
        '/api/account-roles/settings/important-admins',
      )
      isImportantSettingsAdmin.value = true
      importantAdmins.value = adminResponse.users

      const userResponse = await api.apiFetch<{ users: UserOption[] }>('/api/users')
      users.value = userResponse.users
    } catch {
      isImportantSettingsAdmin.value = false
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = 'サイト設定を取得できませんでした。'
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  const payload: Partial<SiteSettings> = {
    site_name: settings.site_name.trim(),
    site_description: settings.site_description.trim(),
    event_name: settings.event_name.trim(),
    event_year: Number(settings.event_year),
  }

  if (isImportantSettingsAdmin.value) {
    payload.site_visibility = settings.site_visibility
    payload.maintenance_mode = settings.maintenance_mode
    payload.maintenance_message = settings.maintenance_message
    payload.login_enabled = settings.login_enabled
    payload.require_login = settings.require_login
  }

  try {
    await api.apiFetch('/api/account-roles/settings', {
      method: 'PATCH',
      body: { settings: payload },
    })
    successMessage.value = 'サイト設定を保存しました。'
  } catch (error) {
    console.error(error)
    errorMessage.value = '設定の保存に失敗しました。入力内容を確認してください。'
  } finally {
    saving.value = false
  }
}

async function addImportantAdmin() {
  if (!selectedUserId.value) return
  assigning.value = true
  errorMessage.value = ''

  try {
    await api.apiFetch('/api/account-roles/settings/important-admins', {
      method: 'POST',
      body: { user_id: selectedUserId.value },
    })
    selectedUserId.value = ''
    await loadImportantAdmins()
  } catch (error) {
    console.error(error)
    errorMessage.value = '重要設定管理者を追加できませんでした。'
  } finally {
    assigning.value = false
  }
}

async function removeImportantAdmin(user: UserOption) {
  if (importantAdmins.value.length <= 1) {
    errorMessage.value = '重要設定管理者を0人にすることはできません。'
    return
  }

  const confirmed = window.confirm(`${displayUser(user)} の重要設定管理者権限を解除しますか？`)
  if (!confirmed) return

  assigning.value = true
  errorMessage.value = ''

  try {
    await api.apiFetch(
      `/api/account-roles/settings/important-admins/${user.id}`,
      { method: 'DELETE' },
    )
    await loadImportantAdmins()
  } catch (error) {
    console.error(error)
    errorMessage.value = '重要設定管理者を解除できませんでした。'
  } finally {
    assigning.value = false
  }
}

async function loadImportantAdmins() {
  const response = await api.apiFetch<{ users: UserOption[] }>(
    '/api/account-roles/settings/important-admins',
  )
  importantAdmins.value = response.users
}

onMounted(loadSettings)
</script>

<template>
  <v-container class="admin-settings-page py-8" max-width="1000">
    <div class="d-flex align-center mb-6">
      <LayoutBackButton />
    </div>

    <div class="page-header">
      <div class="page-eyebrow">SYSTEM CONFIGURATION</div>
      <h1 class="page-title">サイト設定</h1>
      <p class="page-description">
        38Rサイト全体の基本情報と運用設定を管理します。
      </p>
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
    <v-alert
      v-if="successMessage"
      type="success"
      variant="tonal"
      rounded="xl"
      class="mt-6"
      closable
      @click:close="successMessage = ''"
    >
      {{ successMessage }}
    </v-alert>

    <div v-if="loading" class="d-flex justify-center py-16">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <v-card rounded="xl" variant="outlined" class="mt-6">
        <v-card-item>
          <template #prepend>
            <v-icon icon="mdi-web" size="30" color="primary" />
          </template>
          <v-card-title>基本設定</v-card-title>
          <v-card-subtitle>サイトの表示名や対象年度を設定します。</v-card-subtitle>
        </v-card-item>
        <v-divider />
        <v-card-text class="pa-5">
          <v-text-field
            v-model="settings.site_name"
            label="サイト名"
            maxlength="80"
            counter
          />
          <v-textarea
            v-model="settings.site_description"
            label="サイト説明"
            maxlength="300"
            rows="2"
            auto-grow
            counter
          />
          <v-row>
            <v-col cols="12" sm="8">
              <v-text-field
                v-model="settings.event_name"
                label="行事名"
                maxlength="80"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field
                v-model.number="settings.event_year"
                label="対象年度"
                type="number"
                min="2020"
                max="2100"
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card rounded="xl" variant="outlined" class="mt-5">
        <v-card-item>
          <template #prepend>
            <v-icon icon="mdi-shield-lock-outline" size="30" color="primary" />
          </template>
          <v-card-title>公開・アクセス設定</v-card-title>
          <v-card-subtitle>公開状態やログイン制御を管理します。</v-card-subtitle>
          <template #append>
            <v-chip
              :color="isImportantSettingsAdmin ? 'success' : 'default'"
              variant="tonal"
              size="small"
            >
              {{ isImportantSettingsAdmin ? '重要設定管理者' : '閲覧・変更制限' }}
            </v-chip>
          </template>
        </v-card-item>
        <v-divider />
        <v-card-text v-if="isImportantSettingsAdmin" class="pa-5">
          <v-select
            v-model="settings.site_visibility"
            label="サイト公開状態"
            :items="[
              { title: '公開', value: 'public' },
              { title: '非公開', value: 'private' },
            ]"
          />
          <v-switch
            v-model="settings.maintenance_mode"
            color="warning"
            label="メンテナンスモード"
            hide-details
          />
          <v-textarea
            v-model="settings.maintenance_message"
            label="メンテナンス時の表示文"
            rows="2"
            auto-grow
            class="mt-4"
          />
          <v-switch
            v-model="settings.login_enabled"
            color="primary"
            label="ログイン機能を有効にする"
            hide-details
          />
          <v-switch
            v-model="settings.require_login"
            color="primary"
            label="サイト利用時にログインを必須にする"
            hide-details
            class="mt-2"
          />
          <v-alert type="info" variant="tonal" class="mt-4">
            これらの設定値は保存できます。実際のアクセス制御への反映は、別途各API・画面への適用が必要です。
          </v-alert>
        </v-card-text>
        <v-card-text v-else class="text-medium-emphasis">
          重要設定管理者のみ変更できます。一般管理者は基本設定を変更できます。
        </v-card-text>
      </v-card>

      <v-card
        v-if="isImportantSettingsAdmin"
        rounded="xl"
        variant="outlined"
        class="mt-5"
      >
        <v-card-item>
          <template #prepend>
            <v-icon icon="mdi-account-key-outline" size="30" color="primary" />
          </template>
          <v-card-title>重要設定管理者</v-card-title>
          <v-card-subtitle>
            重要なサイト設定を変更できるユーザーを管理します。
          </v-card-subtitle>
        </v-card-item>
        <v-divider />
        <v-card-text class="pa-5">
          <v-alert type="warning" variant="tonal" class="mb-4">
            重要設定管理者は、他の重要設定管理者を任命・解除できます。最低1人は必ず残す必要があります。
          </v-alert>
          <div class="d-flex flex-column flex-sm-row ga-2 mb-4">
            <v-select
              v-model="selectedUserId"
              :items="availableUsers.map((user) => ({ title: displayUser(user), value: user.id }))"
              label="追加するユーザー"
              hide-details
              :disabled="availableUsers.length === 0"
            />
            <v-btn
              color="primary"
              prepend-icon="mdi-account-plus"
              :loading="assigning"
              :disabled="!selectedUserId"
              @click="addImportantAdmin"
            >
              任命
            </v-btn>
          </div>
          <v-list lines="two">
            <v-list-item
              v-for="user in importantAdmins"
              :key="user.id"
            >
              <v-list-item-title>{{ user.nickname || user.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ user.student_number }}</v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-account-remove-outline"
                  color="error"
                  variant="text"
                  :disabled="assigning || importantAdmins.length <= 1"
                  :aria-label="`${displayUser(user)} の権限を解除`"
                  @click="removeImportantAdmin(user)"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>

      <v-card rounded="xl" variant="outlined" class="mt-5">
        <v-card-item>
          <template #prepend>
            <v-icon icon="mdi-history" size="30" color="primary" />
          </template>
          <v-card-title>設定変更履歴</v-card-title>
          <v-card-subtitle>直近100件の設定変更を表示します。</v-card-subtitle>
        </v-card-item>
        <v-divider />
        <v-table density="comfortable">
          <thead>
            <tr>
              <th>変更日時</th>
              <th>設定項目</th>
              <th>変更者</th>
              <th>変更後の値</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in settingLogs" :key="log.id">
              <td class="text-no-wrap">{{ new Date(log.changed_at + 'Z').toLocaleString('ja-JP') }}</td>
              <td><code>{{ log.setting_key }}</code></td>
              <td>{{ log.changed_by_nickname || log.changed_by_name || '不明' }}</td>
              <td class="setting-log-value">{{ log.new_value }}</td>
            </tr>
            <tr v-if="settingLogs.length === 0">
              <td colspan="4" class="text-center text-medium-emphasis py-6">
                変更履歴はありません。
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-card rounded="xl" variant="outlined" class="mt-5">
        <v-card-item>
          <template #prepend>
            <v-icon icon="mdi-tune-variant" size="30" color="primary" />
          </template>
          <v-card-title>機能別権限</v-card-title>
          <v-card-subtitle>
            閲覧・作成・編集・削除の権限は既存の権限管理で設定します。
          </v-card-subtitle>
          <template #append>
            <v-btn
              to="/admin/permissions"
              variant="tonal"
              color="primary"
              append-icon="mdi-open-in-new"
            >
              権限管理を開く
            </v-btn>
          </template>
        </v-card-item>
      </v-card>

      <div class="d-flex justify-end mt-6">
        <v-btn
          color="primary"
          size="large"
          rounded="xl"
          prepend-icon="mdi-content-save"
          :loading="saving"
          @click="saveSettings"
        >
          設定を保存
        </v-btn>
      </div>
    </template>
  </v-container>
</template>

<style scoped>
.admin-settings-page {
  min-height: 100%;
}
.page-eyebrow {
  color: rgb(var(--v-theme-primary));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
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
.setting-log-value {
  max-width: 280px;
  overflow-wrap: anywhere;
}
</style>

<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'

definePageMeta({
  middleware: ['admin'],
})

interface FeatureConfig {
  enabled: boolean
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
  [action: string]: boolean
}

interface SiteSettings {
  site_name: string
  site_description: string
  event_name: string
  event_year: number
  timezone: string
  logo_url: string
  favicon_url: string
  site_visibility?: 'public' | 'private'
  maintenance_mode?: boolean
  maintenance_message?: string
  login_enabled?: boolean
  require_login?: boolean
  feature_settings: Record<string, FeatureConfig>
  notification_settings: {
    enabled: boolean
    categories: Record<string, boolean>
    return_due_all_users: true
  }
  operation_settings: {
    calendar_default_view: 'month' | 'week' | 'day' | 'list'
    task_default_status: 'todo' | 'in_progress' | 'done'
    upload_max_file_size_mb: number
  }
  security_settings: {
    session_duration_hours: number
    login_attempt_limit: number
    login_lock_minutes: number
    force_password_change: boolean
  }
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
const featureOptions = [
  { key: 'tasks', title: 'タスク' },
  { key: 'calendar', title: 'カレンダー' },
  { key: 'news', title: 'お知らせ' },
  { key: 'scripts', title: '台本' },
  { key: 'accounting', title: '会計' },
  { key: 'equipment', title: '備品・小道具' },
  { key: 'attendance', title: '出欠' },
  { key: 'surveys', title: 'アンケート' },
  { key: 'files', title: 'ファイル' },
  { key: 'submissions', title: '提出物' },
  { key: 'decisions', title: '意思決定' },
  { key: 'minutes', title: '議事録' },
  { key: 'tool_rental', title: '工具貸出' },
  { key: 'wishlist', title: 'ほしい物リスト' },
  { key: 'milk_collection', title: '牛乳パック回収' },
  { key: 'members', title: 'メンバー管理' },
]
const notificationOptions = [
  { key: 'news', title: 'お知らせ' },
  { key: 'tasks', title: 'タスク' },
  { key: 'calendar', title: 'カレンダー' },
  { key: 'attendance', title: '出欠関連' },
  { key: 'submissions', title: '提出期限' },
  { key: 'tool_rental', title: '返却期限' },
  { key: 'surveys', title: 'アンケート' },
  { key: 'decisions', title: '意思決定' },
  { key: 'equipment', title: '備品' },
  { key: 'accounting', title: '会計' },
  { key: 'files', title: 'ファイル' },
]
function defaultFeatureSettings(): Record<string, FeatureConfig> {
  return Object.fromEntries(featureOptions.map(({ key }) => [key, {
    enabled: true, view: true, create: true, edit: true, delete: true,
  }]))
}

function featureConfig(key: string): FeatureConfig {
  return settings.feature_settings[key] ?? (settings.feature_settings[key] = {
    enabled: true, view: true, create: true, edit: true, delete: true,
  })
}

const defaultSettings = (): SiteSettings => ({
  site_name: '',
  site_description: '',
  event_name: '',
  event_year: new Date().getFullYear(),
  timezone: 'Asia/Tokyo',
  logo_url: '',
  favicon_url: '',
  site_visibility: 'public',
  maintenance_mode: false,
  maintenance_message: '現在メンテナンス中です。しばらくお待ちください。',
  login_enabled: true,
  require_login: true,
  feature_settings: defaultFeatureSettings(),
  notification_settings: {
    enabled: true,
    categories: Object.fromEntries(notificationOptions.map(({ key }) => [key, true])),
    return_due_all_users: true,
  },
  operation_settings: {
    calendar_default_view: 'month',
    task_default_status: 'todo',
    upload_max_file_size_mb: 25,
  },
  security_settings: {
    session_duration_hours: 168,
    login_attempt_limit: 5,
    login_lock_minutes: 15,
    force_password_change: false,
  },
})
const settings = reactive<SiteSettings>(defaultSettings())
const initialSnapshot = ref('')
const importantAdmins = ref<UserOption[]>([])
const users = ref<UserOption[]>([])
const settingLogs = ref<SettingLog[]>([])
const systemInfo = ref<{ api_status: string; database_status: string; version: string; checked_at: string } | null>(null)
const selectedUserId = ref('')
const loading = ref(true)
const saving = ref(false)
const assigning = ref(false)
const isImportantSettingsAdmin = ref(false)
const snackbar = useSnackbar()

const hasUnsavedChanges = computed(() => initialSnapshot.value !== JSON.stringify(settings))
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

  try {
    const response = await api.apiFetch<{ settings: Partial<SiteSettings> }>(
      '/api/admin/settings',
    )
    Object.assign(settings, response.settings)
    settings.feature_settings = {
      ...defaultFeatureSettings(),
      ...(response.settings.feature_settings ?? {}),
    }
    settings.notification_settings = {
      ...defaultSettings().notification_settings,
      ...(response.settings.notification_settings ?? {}),
      categories: {
        ...defaultSettings().notification_settings.categories,
        ...(response.settings.notification_settings?.categories ?? {}),
      },
      return_due_all_users: true,
    }
    settings.operation_settings = {
      ...defaultSettings().operation_settings,
      ...(response.settings.operation_settings ?? {}),
    }
    settings.security_settings = {
      ...defaultSettings().security_settings,
      ...(response.settings.security_settings ?? {}),
    }
    initialSnapshot.value = JSON.stringify(settings)
    const logResponse = await api.apiFetch<{ logs: SettingLog[] }>(
      '/api/admin/settings/logs',
    )
    settingLogs.value = logResponse.logs
    try {
      systemInfo.value = await api.apiFetch<{
        api_status: string
        database_status: string
        version: string
        checked_at: string
      }>('/api/admin/settings/system-info')
    } catch (systemError) {
      console.warn('システム情報を取得できませんでした。', systemError)
      systemInfo.value = null
    }

    try {
      const adminResponse = await api.apiFetch<{ users: UserOption[] }>(
        '/api/admin/settings/roles',
      )
      isImportantSettingsAdmin.value = true
      importantAdmins.value = adminResponse.users
    } catch {
      isImportantSettingsAdmin.value = false
    }

    if (isImportantSettingsAdmin.value) {
      try {
        const [userResponse, roleResponse] = await Promise.all([
          api.apiFetch<{ users: UserOption[] }>('/api/users'),
          api.apiFetch<{ account_roles: Array<{ id: string; name: string }> }>('/api/account-roles'),
        ])
        const adminRole = roleResponse.account_roles.find((role) => role.name === 'admin')
        if (adminRole) {
          const memberResponse = await api.apiFetch<{
            users: Array<UserOption & { assigned: number }>
          }>(`/api/account-roles/${adminRole.id}/members`)
          const adminIds = new Set(
            memberResponse.users
              .filter((user) => user.assigned === 1)
              .map((user) => user.id),
          )
          users.value = userResponse.users.filter((user) => adminIds.has(user.id))
        }
      } catch (error) {
        console.error(error)
        snackbar.error('管理者一覧を取得できませんでした。')
      }
    }
  } catch (error) {
    console.error(error)
    snackbar.error('サイト設定を取得できませんでした。')
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true

  const payload: Partial<SiteSettings> = {
    site_name: settings.site_name.trim(),
    site_description: settings.site_description.trim(),
    event_name: settings.event_name.trim(),
    event_year: Number(settings.event_year),
    timezone: settings.timezone,
    logo_url: settings.logo_url.trim(),
    favicon_url: settings.favicon_url.trim(),
    feature_settings: settings.feature_settings,
    notification_settings: {
      ...settings.notification_settings,
      return_due_all_users: true,
    },
    operation_settings: settings.operation_settings,
  }

  if (isImportantSettingsAdmin.value) {
    payload.site_visibility = settings.site_visibility
    payload.maintenance_mode = settings.maintenance_mode
    payload.maintenance_message = settings.maintenance_message
    payload.login_enabled = settings.login_enabled
    payload.require_login = settings.require_login
    payload.security_settings = settings.security_settings
  }

  try {
    await api.apiFetch('/api/admin/settings', {
      method: 'PATCH',
      body: { settings: payload },
    })
    try {
      await refreshSiteStatus()
    } catch (statusError) {
      console.warn('サイト表示設定の再取得に失敗しました。', statusError)
    }
    initialSnapshot.value = JSON.stringify(settings)
    snackbar.success('サイト設定を保存しました。')
  } catch (error) {
    console.error(error)
    snackbar.error('設定の保存に失敗しました。入力内容を確認してください。')
  } finally {
    saving.value = false
  }
}

async function addImportantAdmin() {
  if (!selectedUserId.value) return
  assigning.value = true

  try {
    await api.apiFetch('/api/admin/settings/roles', {
      method: 'POST',
      body: { user_id: selectedUserId.value },
    })
    selectedUserId.value = ''
    await loadImportantAdmins()
    snackbar.success('重要設定管理者を追加しました。')
  } catch (error) {
    console.error(error)
    snackbar.error('重要設定管理者を追加できませんでした。')
  } finally {
    assigning.value = false
  }
}

async function removeImportantAdmin(user: UserOption) {
  if (importantAdmins.value.length <= 1) {
    snackbar.warning('重要設定管理者を0人にすることはできません。')
    return
  }

  const confirmed = window.confirm(`${displayUser(user)} の重要設定管理者権限を解除しますか？`)
  if (!confirmed) return

  assigning.value = true

  try {
    await api.apiFetch(
      `/api/admin/settings/roles/${user.id}`,
      { method: 'DELETE' },
    )
    await loadImportantAdmins()
    snackbar.success('重要設定管理者を解除しました。')
  } catch (error) {
    console.error(error)
    snackbar.error('重要設定管理者を解除できませんでした。')
  } finally {
    assigning.value = false
  }
}

function resetSettings() {
  if (!initialSnapshot.value) return
  Object.assign(settings, JSON.parse(initialSnapshot.value) as SiteSettings)
}

async function forceLogoutAllSessions() {
  const confirmed = window.confirm('全ユーザーのログインセッションを無効化します。続行しますか？')
  if (!confirmed) return
  try {
    const result = await api.apiFetch<{ invalidated_sessions: number }>(
      '/api/admin/settings/force-logout',
      { method: 'POST' },
    )
    snackbar.success(`${result.invalidated_sessions}件のセッションを無効化しました。`)
  } catch (error) {
    console.error(error)
    snackbar.error('セッションの無効化に失敗しました。')
  }
}

async function loadImportantAdmins() {
  const response = await api.apiFetch<{ users: UserOption[] }>(
    '/api/admin/settings/roles',
  )
  importantAdmins.value = response.users
}

onBeforeRouteLeave(() => {
  if (hasUnsavedChanges.value && !window.confirm('未保存の変更があります。ページを移動しますか？')) {
    return false
  }
})

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!hasUnsavedChanges.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  loadSettings()
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
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
          <v-text-field v-model="settings.timezone" label="タイムゾーン" hint="例: Asia/Tokyo" persistent-hint />
          <v-text-field v-model="settings.logo_url" label="ロゴ画像URL" placeholder="https://..." />
          <v-text-field v-model="settings.favicon_url" label="favicon URL" placeholder="https://..." />
        </v-card-text>
      </v-card>

      <v-card rounded="xl" variant="outlined" class="mt-5">
        <v-card-item>
          <template #prepend><v-icon icon="mdi-puzzle-outline" size="30" color="primary" /></template>
          <v-card-title>機能管理</v-card-title>
          <v-card-subtitle>機能自体と操作単位の制御を設定します。既存のユーザー権限を付与するものではありません。</v-card-subtitle>
        </v-card-item>
        <v-divider />
        <v-card-text class="pa-5">
          <v-row>
            <v-col v-for="feature in featureOptions" :key="feature.key" cols="12" md="6">
              <v-card variant="tonal" rounded="lg" class="pa-3 h-100">
                <div class="d-flex align-center justify-space-between mb-2">
                  <span class="font-weight-bold">{{ feature.title }}</span>
                  <v-switch v-model="featureConfig(feature.key).enabled" color="primary" label="有効" hide-details inset />
                </div>
                <v-divider class="mb-2" />
                <div class="d-flex flex-wrap ga-3">
                  <v-checkbox v-for="action in ['view', 'create', 'edit', 'delete']" :key="action"
                    v-model="featureConfig(feature.key)[action]" :label="{ view: '閲覧', create: '作成', edit: '編集', delete: '削除' }[action]"
                    density="compact" hide-details :disabled="!featureConfig(feature.key).enabled" />
                </div>
              </v-card>
            </v-col>
          </v-row>
          <v-alert type="info" variant="tonal" density="compact" class="mt-3">
            機能設定は既存のアカウント権限・活動ロールによる認可に追加されます。機能が有効でも、個別のAPI権限がなければ操作できません。
          </v-alert>
        </v-card-text>
      </v-card>

      <v-card rounded="xl" variant="outlined" class="mt-5">
        <v-card-item>
          <template #prepend><v-icon icon="mdi-bell-cog-outline" size="30" color="primary" /></template>
          <v-card-title>通知設定</v-card-title>
          <v-card-subtitle>サイト全体のプッシュ通知と通知カテゴリを管理します。</v-card-subtitle>
        </v-card-item>
        <v-divider />
        <v-card-text class="pa-5">
          <v-switch v-model="settings.notification_settings.enabled" color="primary" label="プッシュ通知全体を有効にする" hide-details />
          <v-row class="mt-2">
            <v-col v-for="item in notificationOptions" :key="item.key" cols="12" sm="6" md="4">
              <v-switch v-model="settings.notification_settings.categories[item.key]" :label="item.title"
                color="primary" hide-details :disabled="!settings.notification_settings.enabled" />
            </v-col>
          </v-row>
          <v-alert type="info" variant="tonal" density="compact" class="mt-3">
            返却期限通知の送信対象は全員です。この設定から個人単位の対象へ変更することはできません。
          </v-alert>
        </v-card-text>
      </v-card>

      <v-card rounded="xl" variant="outlined" class="mt-5">
        <v-card-item>
          <template #prepend><v-icon icon="mdi-tune" size="30" color="primary" /></template>
          <v-card-title>運用設定</v-card-title>
          <v-card-subtitle>カレンダー・タスクの初期状態とアップロード制限を管理します。</v-card-subtitle>
        </v-card-item>
        <v-divider />
        <v-card-text class="pa-5">
          <v-select v-model="settings.operation_settings.calendar_default_view" label="カレンダー初期表示"
            :items="[{ title: '月表示', value: 'month' }, { title: '予定一覧', value: 'list' }]" />
          <v-select v-model="settings.operation_settings.task_default_status" label="新規タスクの初期状態"
            :items="[{ title: '未着手', value: 'todo' }, { title: '進行中', value: 'in_progress' }, { title: '完了', value: 'done' }]" />
          <v-text-field v-model.number="settings.operation_settings.upload_max_file_size_mb" type="number" min="1" max="100" label="アップロード上限（MB）" />
          <v-alert type="info" variant="tonal" density="compact">
            アップロード上限は1〜100MBです。Cloudflare側のリクエスト上限を超えるファイルは別途制限されます。
          </v-alert>
        </v-card-text>
      </v-card>

      <v-card v-if="isImportantSettingsAdmin" rounded="xl" variant="outlined" class="mt-5">
        <v-card-item>
          <template #prepend><v-icon icon="mdi-shield-key-outline" size="30" color="primary" /></template>
          <v-card-title>セキュリティ設定</v-card-title>
          <v-card-subtitle>認証とセッションに関する重要設定です。</v-card-subtitle>
        </v-card-item>
        <v-divider />
        <v-card-text class="pa-5">
          <v-select v-model.number="settings.security_settings.session_duration_hours" label="セッション有効期間"
            :items="[{ title: '1時間', value: 1 }, { title: '12時間', value: 12 }, { title: '1日', value: 24 }, { title: '3日', value: 72 }, { title: '7日', value: 168 }, { title: '14日', value: 336 }, { title: '30日', value: 720 }]" />
          <v-text-field v-model.number="settings.security_settings.login_attempt_limit" type="number" min="3" max="20" label="ログイン試行上限（回）" />
          <v-text-field v-model.number="settings.security_settings.login_lock_minutes" type="number" min="1" max="1440" label="一時ロック時間（分）" />
          <v-switch v-model="settings.security_settings.force_password_change" color="warning" label="全ユーザーに次回ログイン時のパスワード変更を要求" hide-details />
          <v-divider class="my-4" />
          <div class="d-flex flex-column flex-sm-row align-sm-center justify-space-between ga-3">
            <div>
              <div class="font-weight-bold">全ユーザーのセッション無効化</div>
              <div class="text-body-2 text-medium-emphasis">全員が次回アクセス時に再ログインする必要があります。</div>
            </div>
            <v-btn color="error" variant="tonal" prepend-icon="mdi-logout" @click="forceLogoutAllSessions">全セッションを無効化</v-btn>
          </div>
          <v-alert type="warning" variant="tonal" density="compact" class="mt-4">
            セッション期間は次回ログイン時から適用されます。パスワード変更強制は既存ユーザーの変更状態を確認して適用します。
          </v-alert>
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
          <v-alert type="info" variant="tonal" density="compact" class="mt-3">
            無効にすると一般ユーザーの新規ログインを停止します。管理者は設定を復旧できるよう、引き続きログインできます。
          </v-alert>
          <v-switch
            v-model="settings.require_login"
            color="primary"
            label="サイト利用時にログインを必須にする"
            hide-details
            class="mt-2"
          />
          <v-alert type="info" variant="tonal" class="mt-4">
            公開状態は未ログイン利用者のAPIアクセスを制限し、メンテナンス中は管理者以外のAPIアクセスを停止します。ログイン必須設定はサイト全体の画面遷移に反映されます。
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
          <template #prepend><v-icon icon="mdi-server-network" size="30" color="primary" /></template>
          <v-card-title>システム情報</v-card-title>
          <v-card-subtitle>API・データベースの稼働状況とバージョンを表示します。</v-card-subtitle>
        </v-card-item>
        <v-divider />
        <v-card-text class="pa-5">
          <div v-if="systemInfo" class="d-flex flex-wrap ga-4">
            <v-chip :color="systemInfo.api_status === 'ok' ? 'success' : 'error'" variant="tonal">
              API: {{ systemInfo.api_status === 'ok' ? '正常' : '異常' }}
            </v-chip>
            <v-chip :color="systemInfo.database_status === 'ok' ? 'success' : 'error'" variant="tonal">
              DB: {{ systemInfo.database_status === 'ok' ? '正常' : '異常' }}
            </v-chip>
            <span class="text-body-2 align-self-center">バージョン: {{ systemInfo.version }}</span>
          </div>
          <div v-else class="text-body-2 text-medium-emphasis">システム情報を取得できませんでした。</div>
          <div v-if="systemInfo" class="text-caption text-medium-emphasis mt-3">
            確認日時: {{ new Date(systemInfo.checked_at).toLocaleString('ja-JP') }}
          </div>
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

      <div class="d-flex justify-end mt-6 ga-2">
        <v-btn variant="text" :disabled="saving || !hasUnsavedChanges" @click="resetSettings">変更を破棄</v-btn>
        <v-btn
          color="primary"
          size="large"
          rounded="xl"
          prepend-icon="mdi-content-save"
          :loading="saving"
          :disabled="!hasUnsavedChanges"
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

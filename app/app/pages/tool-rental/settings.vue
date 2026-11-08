<template>
  <v-container class="py-6" max-width="760">
    <div class="d-flex align-center ga-3 mb-6">
      <LayoutBackButton />
      <div>
        <h1 class="text-h5 font-weight-bold">工具貸出設定</h1>
        <div class="text-body-2 text-medium-emphasis">通知先と全体返却時刻を管理します。</div>
      </div>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>
    <v-alert v-if="successMessage" type="success" variant="tonal" class="mb-4">{{ successMessage }}</v-alert>

    <v-card rounded="xl" variant="outlined" class="mb-4">
      <v-card-title>通知設定</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-3">
          貸出期限と全体返却時刻の通知先を設定します。認証情報は暗号化して保存され、画面には再表示されません。
        </p>

        <v-radio-group v-model="notificationChannel" inline :disabled="notificationLoading || notificationTesting || !auth.isAdmin.value">
          <v-radio label="通知しない" value="none" />
          <v-radio label="Discord" value="discord" />
          <v-radio label="LINE" value="line" />
        </v-radio-group>

        <template v-if="notificationChannel === 'discord'">
          <v-text-field
            v-model="discordWebhookUrl"
            label="Discord Webhook URL"
            type="password"
            autocomplete="off"
            :disabled="notificationLoading || notificationTesting || !auth.isAdmin.value"
            hint="変更する場合だけ入力してください。保存済みURLは再表示されません。"
            persistent-hint
          />
          <v-alert v-if="discordConfigured" type="info" variant="tonal" class="mt-3">
            Discord Webhook URLは設定済みです。
          </v-alert>
        </template>

        <template v-if="notificationChannel === 'line'">
          <v-text-field
            v-model="lineChannelAccessToken"
            label="LINE Channel Access Token"
            type="password"
            autocomplete="off"
            :disabled="notificationLoading || notificationTesting || !auth.isAdmin.value"
            hint="変更する場合だけ入力してください。"
            persistent-hint
          />
          <v-text-field
            v-model="lineChannelSecret"
            label="LINE Channel Secret"
            type="password"
            autocomplete="off"
            :disabled="notificationLoading || notificationTesting || !auth.isAdmin.value"
            hint="LINE Developers Consoleのチャネル基本設定から取得します。"
            persistent-hint
            class="mt-2"
          />
          <v-alert v-if="lineConfigured" type="info" variant="tonal" class="my-3">
            LINEの認証情報は設定済みです。
          </v-alert>
          <v-alert type="info" variant="tonal" class="my-3">
            LINE公式アカウントが参加しているトークからBotへメッセージを送ると、送信先候補に追加されます。
          </v-alert>
          <div class="d-flex align-center justify-space-between">
            <span class="text-subtitle-2 font-weight-bold">通知を送るLINEトーク</span>
            <v-btn size="small" variant="text" :loading="lineDestinationsLoading" :disabled="notificationLoading || !auth.isAdmin.value" @click="loadLineDestinations">
              送信先を更新
            </v-btn>
          </div>
          <v-select
            v-model="lineSelectedDestinationId"
            label="送信先"
            :items="lineDestinationOptions"
            item-title="title"
            item-value="value"
            clearable
            :disabled="notificationLoading || notificationTesting || lineDestinationsLoading || !auth.isAdmin.value"
            class="mt-2"
          />
          <v-alert v-if="lineDestinations.length === 0" type="warning" variant="tonal" class="mt-2">
            送信先がまだありません。LINE公式アカウントが参加しているトークからBotへメッセージを送ってください。
          </v-alert>
          <div v-else class="text-caption text-medium-emphasis">{{ lineDestinations.length }}件の送信先を検出しています。</div>
        </template>

        <div class="d-flex flex-wrap ga-3 mt-4">
          <v-btn color="primary" :loading="notificationLoading" :disabled="notificationLoading || notificationTesting || !auth.isAdmin.value" @click="saveNotificationSettings">
            通知設定を保存
          </v-btn>
          <v-btn
            variant="outlined"
            :loading="notificationTesting"
            :disabled="notificationLoading || notificationTesting || notificationChannel === 'none' || !auth.isAdmin.value || (notificationChannel === 'line' && (!lineConfigured || !lineSelectedDestinationId))"
            @click="sendNotificationTest"
          >
            テスト通知
          </v-btn>
        </div>
        <p v-if="!auth.isAdmin.value" class="text-caption text-medium-emphasis mt-3">
          通知設定の変更には工具貸出管理権限が必要です。
        </p>
      </v-card-text>
    </v-card>

    <v-card rounded="xl" variant="outlined" class="mb-4">
      <v-card-title>全体返却時刻</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          通常の貸出について、全体返却時刻を設定できます。時刻の5分前と時刻経過後に、未返却の備品を通知します。
        </p>
        <v-text-field v-model="classReturnTime" type="time" label="返却時刻" variant="outlined" :disabled="loading || Boolean(saving) || !auth.isAdmin.value" />
        <div class="d-flex ga-2">
          <v-btn color="primary" :loading="saving === 'class'" :disabled="!auth.isAdmin.value || loading" @click="saveReturnTime('class')">保存</v-btn>
          <v-btn variant="outlined" :disabled="!auth.isAdmin.value || loading || !classReturnTime" @click="classReturnTime = ''">解除</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card rounded="xl" variant="outlined">
      <v-card-title>チーフ用 全体返却時刻</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          チーフの貸出について、通常とは別の全体返却時刻を設定できます。
        </p>
        <v-text-field v-model="chiefReturnTime" type="time" label="チーフ用返却時刻" variant="outlined" :disabled="loading || Boolean(saving) || !auth.isAdmin.value" />
        <div class="d-flex ga-2">
          <v-btn color="primary" :loading="saving === 'chief'" :disabled="!auth.isAdmin.value || loading" @click="saveReturnTime('chief')">保存</v-btn>
          <v-btn variant="outlined" :disabled="!auth.isAdmin.value || loading || !chiefReturnTime" @click="chiefReturnTime = ''">解除</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-progress-linear v-if="loading" indeterminate class="mt-4" />
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

definePageMeta({ middleware: 'auth' })

type NotificationChannel = 'none' | 'discord' | 'line'
type LineDestination = {
  destination_type: 'user' | 'group' | 'room'
  destination_id: string
  display_name: string | null
  last_seen_at: string
}

const { request } = useToolRentalApi()
const auth = useToolRentalAuth()

const classReturnTime = ref('')
const chiefReturnTime = ref('')
const loading = ref(false)
const saving = ref<'' | 'class' | 'chief'>('')
const errorMessage = ref('')
const successMessage = ref('')

const notificationChannel = ref<NotificationChannel>('none')
const discordWebhookUrl = ref('')
const lineChannelAccessToken = ref('')
const lineChannelSecret = ref('')
const discordConfigured = ref(false)
const lineConfigured = ref(false)
const lineSelectedDestinationId = ref('')
const lineDestinations = ref<LineDestination[]>([])
const notificationLoading = ref(false)
const notificationTesting = ref(false)
const lineDestinationsLoading = ref(false)

const lineDestinationOptions = computed(() =>
  lineDestinations.value.map(destination => ({
    title: `${destination.display_name || destination.destination_type}（${destination.destination_id.slice(0, 8)}…）`,
    value: destination.destination_id,
  })),
)

async function loadNotificationSettings() {
  const result = await request<{
    channel: NotificationChannel
    discord_configured: boolean
    line_configured: boolean
    line_destination_id: string | null
  }>('/settings/notifications')
  notificationChannel.value = result.channel
  discordConfigured.value = result.discord_configured
  lineConfigured.value = result.line_configured
  lineSelectedDestinationId.value = result.line_destination_id ?? ''
}

async function loadLineDestinations() {
  lineDestinationsLoading.value = true
  try {
    const result = await request<{ destinations: LineDestination[] }>('/settings/notifications/line-destinations')
    lineDestinations.value = result.destinations
    if (!result.destinations.some(item => item.destination_id === lineSelectedDestinationId.value)) {
      lineSelectedDestinationId.value = ''
    }
  } finally {
    lineDestinationsLoading.value = false
  }
}

async function saveNotificationSettings() {
  notificationLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const selected = lineDestinations.value.find(item => item.destination_id === lineSelectedDestinationId.value)
    const result = await request<{
      detail: string
      channel: NotificationChannel
      discord_configured: boolean
      line_configured: boolean
      line_destination_id: string | null
    }>('/settings/notifications', {
      method: 'PATCH',
      body: {
        channel: notificationChannel.value,
        ...(discordWebhookUrl.value.trim() ? { discord_webhook_url: discordWebhookUrl.value.trim() } : {}),
        ...(lineChannelAccessToken.value.trim() ? { line_channel_access_token: lineChannelAccessToken.value.trim() } : {}),
        ...(lineChannelSecret.value.trim() ? { line_channel_secret: lineChannelSecret.value.trim() } : {}),
        ...(selected ? {
          line_destination_type: selected.destination_type,
          line_destination_id: selected.destination_id,
        } : {}),
      },
    })
    discordWebhookUrl.value = ''
    lineChannelAccessToken.value = ''
    lineChannelSecret.value = ''
    discordConfigured.value = result.discord_configured
    lineConfigured.value = result.line_configured
    lineSelectedDestinationId.value = result.line_destination_id ?? ''
    successMessage.value = result.detail
  } catch (error: any) {
    errorMessage.value = error?.data?.detail ?? '通知設定の保存に失敗しました。'
  } finally {
    notificationLoading.value = false
  }
}

async function sendNotificationTest() {
  notificationTesting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await request<{ detail: string }>('/settings/notifications/test', { method: 'POST' })
    successMessage.value = result.detail
  } catch (error: any) {
    errorMessage.value = error?.data?.detail ?? 'テスト通知に失敗しました。'
  } finally {
    notificationTesting.value = false
  }
}

async function loadReturnTimes() {
  loading.value = true
  try {
    const [normal, chief] = await Promise.all([
      request<{ universal_return_times: Array<{ id: number; return_time: string }> }>('/settings/return-time'),
      request<{ universal_return_times: Array<{ id: number; return_time: string }> }>('/settings/return-time-chief'),
    ])
    classReturnTime.value = normal.universal_return_times[0]?.return_time ?? ''
    chiefReturnTime.value = chief.universal_return_times[0]?.return_time ?? ''
  } catch (error: any) {
    errorMessage.value = error?.data?.detail ?? '返却時刻を読み込めませんでした。'
  } finally {
    loading.value = false
  }
}

async function saveReturnTime(kind: 'class' | 'chief') {
  saving.value = kind
  errorMessage.value = ''
  successMessage.value = ''
  const value = kind === 'class' ? classReturnTime.value : chiefReturnTime.value
  try {
    const result = await request<{ universal_return_times: Array<{ id: number; return_time: string }> }>(
      kind === 'class' ? '/settings/return-time' : '/settings/return-time-chief',
      { method: 'PATCH', body: { universal_return_times: value ? [value] : [] } },
    )
    if (kind === 'class') classReturnTime.value = result.universal_return_times[0]?.return_time ?? ''
    else chiefReturnTime.value = result.universal_return_times[0]?.return_time ?? ''
    successMessage.value = kind === 'class' ? '全体返却時刻を保存しました。' : 'チーフ用全体返却時刻を保存しました。'
  } catch (error: any) {
    errorMessage.value = error?.data?.detail ?? '返却時刻の保存に失敗しました。'
  } finally {
    saving.value = ''
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadNotificationSettings(), loadLineDestinations(), loadReturnTimes()])
  } catch (error: any) {
    errorMessage.value = error?.data?.detail ?? '設定を読み込めませんでした。'
  }
})
</script>

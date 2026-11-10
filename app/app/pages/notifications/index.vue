<template>
  <v-container class="py-5 px-4 notification-page">
    <div class="d-flex align-center mb-5">
      <div class="flex-grow-1">
        <h1 class="text-h5 font-weight-bold">通知</h1>
        <div class="text-body-2 text-medium-emphasis mt-1">
          未読 {{ unreadCount }} 件
        </div>
      </div>
      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        aria-label="通知を更新"
        @click="refresh"
      />
    </div>

    <v-card rounded="xl" variant="outlined" class="mb-4">
      <v-card-text class="pa-3">
        <v-text-field
          v-model="search"
          label="通知を検索"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="comfortable"
          hide-details
          clearable
          @update:model-value="setFilters"
        />
        <v-chip-group
          v-model="readFilter"
          mandatory
          selected-class="text-primary"
          class="mt-2"
          @update:model-value="setFilters"
        >
          <v-chip value="all" filter>すべて</v-chip>
          <v-chip value="unread" filter>未読</v-chip>
          <v-chip value="read" filter>既読</v-chip>
        </v-chip-group>
        <v-select
          v-model="selectedCategories"
          :items="categoryOptions"
          item-title="title"
          item-value="value"
          label="カテゴリ"
          multiple
          chips
          closable-chips
          clearable
          variant="outlined"
          density="comfortable"
          hide-details
          class="mt-2"
          @update:model-value="setFilters"
        />
      </v-card-text>
    </v-card>

    <div class="d-flex justify-end mb-3">
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-check-all"
        :disabled="unreadCount === 0"
        @click="handleMarkAllRead"
      >
        すべて既読にする
      </v-btn>
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      @click:close="clearError"
    >
      {{ error }}
      <template #append>
        <v-btn size="small" variant="text" @click="refresh">再試行</v-btn>
      </template>
    </v-alert>

    <div v-if="loading && notifications.length === 0" class="py-8">
      <v-progress-linear indeterminate color="primary" />
    </div>

    <div v-else-if="notifications.length === 0" class="empty-state py-12">
      <v-icon icon="mdi-bell-outline" size="44" class="mb-3" />
      <div class="font-weight-medium">通知はありません</div>
      <div class="text-body-2 text-medium-emphasis mt-1">
        新しい通知が届くと、ここに表示されます。
      </div>
    </div>

    <div v-else class="d-flex flex-column ga-2">
      <v-card
        v-for="item in notifications"
        :key="item.id"
        rounded="lg"
        variant="outlined"
        :class="{ 'notification-unread': !item.is_read }"
        @click="openNotification(item)"
      >
        <v-card-text class="pa-4">
          <div class="d-flex align-start ga-3">
            <v-avatar
              size="38"
              color="primary"
              variant="tonal"
            >
              <v-icon :icon="categoryIcon(item.category)" />
            </v-avatar>
            <div class="flex-grow-1 min-width-0">
              <div class="d-flex align-start ga-2">
                <div class="font-weight-bold flex-grow-1">
                  {{ item.title }}
                </div>
                <v-icon
                  v-if="!item.is_read"
                  icon="mdi-circle"
                  color="primary"
                  size="10"
                />
              </div>
              <div v-if="item.body" class="text-body-2 mt-1 notification-body">
                {{ item.body }}
              </div>
              <div class="d-flex align-center justify-space-between mt-3 ga-2">
                <span class="text-caption text-medium-emphasis">
                  {{ categoryLabel(item.category) }} · {{ formatDate(item.created_at) }}
                </span>
                <v-btn
                  size="x-small"
                  variant="text"
                  @click.stop="setRead(item.id, !Boolean(item.is_read))"
                >
                  {{ item.is_read ? '未読にする' : '既読にする' }}
                </v-btn>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <div v-if="hasMore" class="text-center py-5">
      <v-btn
        variant="outlined"
        rounded="pill"
        :loading="loadingMore"
        @click="loadMore"
      >
        さらに読み込む
      </v-btn>
    </div>

    <v-snackbar v-model="snackbar" timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useNotifications, type AppNotification, type NotificationCategory } from "~/composables/useNotifications"

definePageMeta({ middleware: "auth" })

const {
  notifications,
  unreadCount,
  loading,
  loadingMore,
  error,
  hasMore,
  readFilter,
  selectedCategories,
  search,
  refresh,
  loadMore,
  setRead,
  markAllRead,
  setFilters,
} = useNotifications()

const snackbar = ref(false)
const snackbarText = ref("")

const categoryOptions = [
  { title: "タスク", value: "tasks" },
  { title: "カレンダー", value: "calendar" },
  { title: "提出物", value: "submissions" },
  { title: "お知らせ", value: "news" },
  { title: "アンケート", value: "surveys" },
  { title: "意思決定", value: "decisions" },
  { title: "備品", value: "equipment" },
  { title: "工具貸出", value: "tool_rental" },
  { title: "会計", value: "accounting" },
  { title: "ファイル", value: "files" },
  { title: "牛乳パック", value: "milk_collection" },
  { title: "ほしい物リスト", value: "wishlist" },
  { title: "アカウント", value: "account_admin" },
]

function clearError() {
  error.value = ""
}

function categoryLabel(category: NotificationCategory): string {
  return categoryOptions.find(item => item.value === category)?.title || "その他"
}

function categoryIcon(category: NotificationCategory): string {
  const icons: Record<NotificationCategory, string> = {
    tasks: "mdi-checkbox-marked-circle-outline",
    calendar: "mdi-calendar",
    submissions: "mdi-file-document-check-outline",
    news: "mdi-bullhorn-outline",
    surveys: "mdi-vote-outline",
    decisions: "mdi-notebook-check-outline",
    equipment: "mdi-toolbox-outline",
    tool_rental: "mdi-hand-truck",
    accounting: "mdi-cash-multiple",
    files: "mdi-file-outline",
    milk_collection: "mdi-recycle",
    wishlist: "mdi-cart-outline",
    account_admin: "mdi-account-cog-outline",
  }
  return icons[category]
}

function formatDate(value: string): string {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z")
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

async function openNotification(item: AppNotification) {
  if (!item.is_read) await setRead(item.id, true)
  const target = item.target_url
  if (target && target.startsWith("/") && !target.startsWith("//")) {
    await navigateTo(target)
  }
}

async function handleMarkAllRead() {
  const count = await markAllRead()
  if (count === null) return
  snackbarText.value = count > 0
    ? count + "件を既読にしました"
    : "未読の通知はありません"
  snackbar.value = true
}
</script>

<style scoped>
.notification-page {
  max-width: 900px;
}

.notification-unread {
  border-color: rgba(var(--v-theme-primary), 0.45);
  background: rgba(var(--v-theme-primary), 0.035);
}

.notification-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: rgba(var(--v-theme-on-surface), 0.55);
  text-align: center;
}
</style>

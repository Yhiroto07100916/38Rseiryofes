<template>
  <v-card
    v-if="visibleTimers.length"
    class="tool-rental-timers"
    rounded="lg"
    elevation="8"
    border
  >
    <v-card-title class="d-flex align-center ga-2 py-2 px-3">
      <v-icon icon="mdi-timer-sand" color="primary" />
      <span class="text-subtitle-2 font-weight-bold">工具タイマー</span>
      <v-spacer />
      <v-chip size="x-small" color="primary" variant="tonal">{{ visibleTimers.length }}件</v-chip>
      <v-btn
        :icon="timerCollapsed ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        size="x-small"
        variant="text"
        :aria-label="timerCollapsed ? 'タイマーを開く' : 'タイマーを畳む'"
        :title="timerCollapsed ? 'タイマーを開く' : 'タイマーを畳む'"
        @click="toggleCollapsed"
      />
      <v-btn icon="mdi-refresh" size="x-small" variant="text" aria-label="タイマーを更新" :loading="loading" @click="loadTimers" />
    </v-card-title>
    <template v-if="!timerCollapsed">
      <v-divider />
      <v-card-text class="pa-0 timer-list">
      <div
        v-for="loan in visibleTimers"
        :key="loan.loan_item_id"
        class="timer-row px-3 py-2"
      >
        <div class="d-flex align-center ga-2">
          <div class="flex-grow-1 min-width-0">
            <div class="text-body-2 font-weight-bold text-truncate">
              {{ loan.tool_name }} · {{ loan.management_number }}
            </div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ loan.class_name }} {{ loan.borrower_name }}
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div
              class="text-subtitle-1 font-weight-bold timer-value"
              :class="timerColor(loan)"
            >
              {{ remainingText(loan) }}
            </div>
            <div class="text-caption" :class="timerColor(loan)">
              {{ remainingSeconds(loan) <= 0 ? '時間終了' : '残り時間' }}
            </div>
          </div>
        </div>
      </div>
      </v-card-text>
    </template>
  </v-card>
</template>

<script setup lang="ts">
import type { CurrentLoanItem } from '~/types/tool-rental'

const auth = useAuthStore()
const { request } = useToolRentalApi()
const loans = ref<CurrentLoanItem[]>([])
const now = ref(Date.now())
const loading = ref(false)
const timerCollapsed = ref(false)
let clockInterval: ReturnType<typeof setInterval> | undefined
let refreshInterval: ReturnType<typeof setInterval> | undefined

const collapseStorageKey = computed(() =>
  `tool-rental-timers-collapsed:${auth.user?.id ?? 'default'}`,
)

function restoreCollapsedPreference() {
  try {
    timerCollapsed.value = localStorage.getItem(collapseStorageKey.value) === 'true'
  } catch {
    timerCollapsed.value = false
  }
}

function toggleCollapsed() {
  timerCollapsed.value = !timerCollapsed.value
  try {
    localStorage.setItem(collapseStorageKey.value, String(timerCollapsed.value))
  } catch {
    // Storageが利用できない環境では、現在の画面内だけで切り替える。
  }
}

const canViewTimers = computed(() =>
  auth.hasPermission('tool_rental.view')
  || auth.hasPermission('tool_rental.checkout')
  || auth.hasPermission('tool_rental.return')
  || auth.hasPermission('tool_rental.manage'),
)

const visibleTimers = computed(() =>
  loans.value
    .filter(loan => !!loan.due_at)
    .sort((a, b) => deadlineMs(a) - deadlineMs(b)),
)

watch(
  () => [auth.initialized, auth.isLoggedIn, canViewTimers.value] as const,
  ([initialized, loggedIn, canView]) => {
    if (initialized && loggedIn && canView) {
      void loadTimers()
    } else {
      loans.value = []
    }
  },
  { flush: 'post' },
)

function deadlineMs(loan: CurrentLoanItem): number {
  const value = loan.due_at ?? ''
  const normalized = value.replace(' ', 'T')
  const date = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
    ? new Date(normalized)
    : new Date(`${normalized}+09:00`)
  return date.getTime()
}

function remainingSeconds(loan: CurrentLoanItem): number {
  return Math.max(0, Math.ceil((deadlineMs(loan) - now.value) / 1000))
}

function remainingText(loan: CurrentLoanItem): string {
  const seconds = remainingSeconds(loan)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function timerColor(loan: CurrentLoanItem): string {
  const seconds = remainingSeconds(loan)
  if (seconds <= 0) return 'text-error'
  if (seconds <= 5 * 60) return 'text-warning'
  return 'text-primary'
}

async function loadTimers() {
  if (!auth.initialized || !auth.isLoggedIn || !canViewTimers.value || loading.value) {
    if (!auth.isLoggedIn || !canViewTimers.value) loans.value = []
    return
  }
  loading.value = true
  try {
    loans.value = await request<CurrentLoanItem[]>('/loans/current')
  } catch (error) {
    console.error('Failed to load tool rental timers:', error)
  } finally {
    loading.value = false
  }
}

const handleToolRentalChanged = () => {
  void loadTimers()
}

watch(
  () => auth.user?.id,
  () => restoreCollapsedPreference(),
)

onMounted(async () => {
  if (!auth.initialized) await auth.fetchMe()
  restoreCollapsedPreference()
  await loadTimers()
  window.addEventListener('tool-rental:changed', handleToolRentalChanged)
  now.value = Date.now()
  clockInterval = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  refreshInterval = setInterval(() => {
    void loadTimers()
  }, 15000)
})

onUnmounted(() => {
  window.removeEventListener('tool-rental:changed', handleToolRentalChanged)
  if (clockInterval) clearInterval(clockInterval)
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
.tool-rental-timers {
  position: fixed;
  z-index: 1005;
  right: 16px;
  bottom: 76px;
  width: min(360px, calc(100vw - 32px));
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}

.timer-list {
  max-height: 260px;
  overflow-y: auto;
}

.timer-row + .timer-row {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.timer-value {
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}

.min-width-0 {
  min-width: 0;
}

@media (max-width: 600px) {
  .tool-rental-timers {
    right: 8px;
    bottom: 68px;
    width: min(340px, calc(100vw - 16px));
  }
}
</style>

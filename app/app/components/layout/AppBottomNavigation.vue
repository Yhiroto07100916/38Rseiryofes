<template>
  <v-bottom-navigation
    v-model="currentRoute"
    grow
    color="primary"
    class="app-bottom-navigation whitespace-nowrap-btn"
  >

    <v-btn
      value="/"
      to="/scripts"
    >
      <v-icon icon="mdi-script-text-outline" />
      <span>台本</span>
    </v-btn>

    <v-btn
      value="/"
      to="/calendar"
    >
      <v-icon icon="mdi-calendar-month" />
      <span>カレンダー</span>
    </v-btn>

    <v-btn
      value="/"
      to="/"
    >
      <v-icon icon="mdi-home" />
      <span>ホーム</span>
    </v-btn>

    <v-btn
      value="/"
      to="/tasks"
    >
      <v-icon icon="mdi-format-list-checks" />
      <span>タスク</span>
    </v-btn>

    <v-btn
      v-if="auth.user?.avatar_key"
      value="/"
      to="/me"
    >
      <v-badge
        dot
        color="error"
        :model-value="unreadCount > 0"
        floating
      >
        <UserAvatar :user="auth.user" size="24" />
      </v-badge>
      <span>マイページ</span>
    </v-btn>

    <v-btn
      v-else
      value="/"
      to="/me"
    >
      <v-badge
        dot
        color="error"
        :model-value="unreadCount > 0"
        floating
      >
        <v-icon icon="mdi-account-circle" />
      </v-badge>
      <span>マイページ</span>
    </v-btn>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import UserAvatar from '../UserAvatar.vue'

const route = useRoute()
const auth = useAuthStore()
const { apiFetch } = useApi()

const currentRoute = computed(() => route.path)
const unreadCount = ref(0)
let unreadCountTimer: ReturnType<typeof setInterval> | undefined

const loadUnreadCount = async () => {
  const accountId = auth.user?.id
  if (!accountId) {
    unreadCount.value = 0
    return
  }

  try {
    const response = await apiFetch<{ unread_count: number }>('/api/notifications/unread-count')
    if (auth.user?.id === accountId) {
      unreadCount.value = response.unread_count
    }
  } catch (error) {
    console.warn('[bottom-navigation] failed to load unread notification count', error)
  }
}

onMounted(() => {
  void loadUnreadCount()
  unreadCountTimer = setInterval(() => {
    void loadUnreadCount()
  }, 10_000)
})

watch(
  [() => auth.user?.id, () => route.path],
  () => {
    void loadUnreadCount()
  },
)

onUnmounted(() => {
  if (unreadCountTimer) clearInterval(unreadCountTimer)
})
</script>

<style scoped>
.app-bottom-navigation {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
}
.whitespace-nowrap-btn :deep(.v-btn__content span) {
  white-space: nowrap;
}
</style>

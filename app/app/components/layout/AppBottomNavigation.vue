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
      value="/"
      to="/me"
    >
      <v-icon icon="mdi-account" />
      <span>マイページ</span>
    </v-btn>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const route = useRoute()

const currentRoute = computed(() => route.path)
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

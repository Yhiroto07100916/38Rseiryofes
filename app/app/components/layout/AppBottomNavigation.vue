<template>
  <v-bottom-navigation
    v-model="currentRoute"
    grow
    color="primary"
    class="app-bottom-navigation"
  >
    <v-btn
      value="/"
      to="/"
    >
      <v-icon icon="mdi-home" />
      <span>ホーム</span>
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
</style>

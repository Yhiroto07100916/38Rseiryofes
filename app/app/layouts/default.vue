<template>
  <v-app>
    <AppMenuButton
      :open="drawerOpen"
      @menu="drawerOpen = !drawerOpen"
    />

    <AppNavigationDrawer v-model="drawerOpen" />

    <v-main class="app-main">
      <div class="app-page">
        <slot />
      </div>
    </v-main>

    <AppBottomNavigation />
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppMenuButton from '~/components/layout/AppMenuButton.vue'
import AppNavigationDrawer from '~/components/layout/AppNavigationDrawer.vue'
import AppBottomNavigation from '~/components/layout/AppBottomNavigation.vue';


const drawerOpen = ref(false)
</script>

<style scoped>
.back-button-wrapper {
  position: fixed;
  top: 8px;
  left: 56px;
  z-index: 1000;
}

.app-main {
  padding-top: 56px;
  padding-bottom: 56px;
}

.app-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
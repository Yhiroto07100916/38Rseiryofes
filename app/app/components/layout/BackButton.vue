<template>
  <v-btn icon="mdi-chevron-left" color="blue-grey-darken-1" variant="text" density="compact" size="x-large"
    @click="goBack"></v-btn>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
const goBack = () => {
  router.go(-1)
}
</script>
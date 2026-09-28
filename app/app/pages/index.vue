<template>
  <div class="home-page">
    <h1>38Rseiryofes</h1>

    <p>
      38Rの活動をまとめるサイトです。
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})
</script>

<style scoped>
.home-page {
  padding: 24px;
}
</style>

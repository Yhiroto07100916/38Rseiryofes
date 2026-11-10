<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <CommonAppConfirmDialog />
  <CommonAppSnackbar />
</template>

<script setup lang="ts">
const siteStatus = useSiteStatus()

useHead(() => {
  const siteName = siteStatus.value?.site_name || "38R 星陵祭準備サイト"
  const siteDescription =
    siteStatus.value?.site_description || "38Rの星陵祭準備を管理するサイトです。"

  return {
    title: siteName,
    meta: [
      { name: "description", content: siteDescription },
      { name: "apple-mobile-web-app-title", content: siteName },
    ],
  }
})
</script>

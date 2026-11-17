<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <CommonApiLoadingBar />
  <CommonAppConfirmDialog />
  <CommonAppSnackbar />
</template>

<script setup lang="ts">
import { setDefaultTimeZone } from "~/utils/jst"

const siteStatus = useSiteStatus()

if (import.meta.client) {
  const nuxtApp = useNuxtApp()
  const snackbar = useSnackbar()

  nuxtApp.hook('vue:error', (error) => {
    console.error('[App] Unhandled Vue error:', error)
    snackbar.error('画面の表示中に問題が発生しました。ページを再読み込みしてください。')
  })
}

watch(
  () => siteStatus.value?.timezone,
  (timeZone) => setDefaultTimeZone(timeZone),
  { immediate: true },
)

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
    link: siteStatus.value?.favicon_url
      ? [{ rel: "icon", href: siteStatus.value.favicon_url }]
      : [],
  }
})
</script>

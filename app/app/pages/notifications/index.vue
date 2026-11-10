<template>
  <v-container class="py-4" max-width="900">
    <div class="d-flex align-center ga-3 mb-5">
      <LayoutBackButton />
      <h1 class="text-h5 font-weight-bold">通知履歴</h1>
      <v-spacer />
      <v-btn icon="mdi-refresh" variant="text" :loading="loading" aria-label="更新" @click="load" />
    </div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
    <v-card rounded="lg" variant="outlined">
      <v-list v-if="items.length" lines="three">
        <v-list-item v-for="item in items" :key="item.id" :title="item.title" :subtitle="item.body" @click="open(item)">
          <template #prepend>
            <v-icon :icon="item.read_at ? 'mdi-bell-outline' : 'mdi-bell-ring'" :color="item.read_at ? 'medium-emphasis' : 'primary'" />
          </template>
          <template #append>
            <v-icon icon="mdi-chevron-right" />
          </template>
          <template #title>
            <span :class="{ 'font-weight-bold': !item.read_at }">{{ item.title }}</span>
          </template>
          <template #subtitle>
            <div>{{ item.body }}</div>
            <div class="text-caption mt-1">{{ formatDate(item.created_at) }}</div>
          </template>
        </v-list-item>
      </v-list>
      <div v-else-if="!loading" class="pa-8 text-center text-medium-emphasis">通知はありません。</div>
      <v-progress-linear v-if="loading" indeterminate />
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });
const { apiFetch } = useApi();
const loading = ref(false);
const error = ref("");
const items = ref<Array<{ id: string; title: string; body: string; target_url: string; read_at: string | null; created_at: string }>>([]);
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const result = await apiFetch<{ notifications: typeof items.value }>("/api/notifications");
    items.value = result.notifications;
  } catch (cause: any) {
    error.value = cause?.data?.error || "通知履歴を取得できませんでした。";
  } finally { loading.value = false; }
}
async function open(item: typeof items.value[number]) {
  if (!item.read_at) {
    try { await apiFetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: "PATCH" }); }
    catch (cause) { console.error(cause); }
  }
  await navigateTo(item.target_url || "/");
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}
onMounted(load);
</script>

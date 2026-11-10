<script setup lang="ts">
import { watch } from "vue";
import { useAuthStore } from "~/stores/auth";
import { usePresence } from "~/composables/usePresence";

const auth = useAuthStore();
const { enabled, refresh, checkLocation } = usePresence();

let pageShowHandler: (() => void) | undefined;
let visibilityHandler: (() => void) | undefined;

watch(
  () => [auth.initialized, auth.isLoggedIn, auth.user?.id] as const,
  async ([initialized, loggedIn]) => {
    if (!initialized) return;
    if (!loggedIn) {
      await refresh();
      return;
    }
    await refresh();
    if (enabled.value) await checkLocation();
  },
  { immediate: true, flush: "post" },
);

onMounted(() => {
  pageShowHandler = () => { if (auth.isLoggedIn) void checkLocation(); };
  visibilityHandler = () => {
    if (document.visibilityState === "visible" && auth.isLoggedIn) void checkLocation();
  };
  window.addEventListener("pageshow", pageShowHandler);
  document.addEventListener("visibilitychange", visibilityHandler);
});

onUnmounted(() => {
  if (pageShowHandler) window.removeEventListener("pageshow", pageShowHandler);
  if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
});
</script>

<template><span class="d-none" aria-hidden="true" /></template>

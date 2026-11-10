<script setup lang="ts">
import { usePresence } from "~/composables/usePresence";

const { enabled, refresh, checkLocation } = usePresence();

let pageShowHandler: (() => void) | undefined;
let visibilityHandler: (() => void) | undefined;

onMounted(async () => {
  await refresh();
  if (!enabled.value) return;
  await checkLocation();
  pageShowHandler = () => { void checkLocation(); };
  visibilityHandler = () => {
    if (document.visibilityState === "visible") void checkLocation();
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

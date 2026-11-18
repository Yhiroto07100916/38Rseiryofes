<script setup lang="ts">
import { watch } from "vue";
import { useAuthStore } from "~/stores/auth";
import { usePresence } from "~/composables/usePresence";

const auth = useAuthStore();
const {
  enabled,
  refresh,
  checkLocation,
  manualPromptOpen,
  busy,
  error,
  manualRegister,
  dismissManualPrompt,
} = usePresence();

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

<template>
  <span class="d-none" aria-hidden="true" />
  <v-dialog v-model="manualPromptOpen" max-width="420" persistent>
    <v-card rounded="xl">
      <v-card-title class="text-h6">在校判定の確認</v-card-title>
      <v-card-text>
        位置情報が許可されていないため、自動で在校判定できません。
        手動で在校として登録しますか？
        <v-alert
          v-if="error && error !== '位置情報が許可されていません。'"
          type="error"
          variant="tonal"
          density="comfortable"
          class="mt-3"
        >
          {{ error }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="flex-wrap px-4 pb-4">
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="busy"
          @click="dismissManualPrompt"
        >
          今回は登録しない
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="busy"
          :disabled="busy"
          @click="manualRegister"
        >
          在校判定にする
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

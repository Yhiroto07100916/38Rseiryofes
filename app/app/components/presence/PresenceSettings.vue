<template>
  <v-card rounded="xl" elevation="1" class="mb-4">
    <v-card-title class="px-5 pt-5">
      <v-icon icon="mdi-map-marker-check-outline" class="mr-2" />
      在校判定・位置情報
    </v-card-title>
    <v-card-text class="px-5 pb-5">
      <div class="d-flex align-center flex-wrap ga-2 mb-3">
        <span class="text-body-2 text-medium-emphasis">現在の状態</span>
        <v-chip size="small" :color="statusColor" variant="tonal">{{ statusLabel }}</v-chip>
        <v-chip v-if="method" size="x-small" variant="outlined">{{ method === 'gps' ? 'GPS' : '手動登録' }}</v-chip>
      </div>
      <p class="text-body-2 text-medium-emphasis mb-3">
        工具貸出関連の通知対象を決めるために使用します。位置情報はこの端末で取得し、サーバーには学校内・校外の判定結果だけを送信します。GPSの座標は保存しません。アプリを閉じている間の常時追跡は行いません。
      </p>
      <v-alert v-if="error" type="warning" variant="tonal" density="comfortable" class="mb-3">{{ error }}</v-alert>
      <div v-if="!enabled" class="d-flex flex-column ga-2">
        <v-btn color="primary" block :loading="busy" :disabled="busy" @click="enable">位置情報を許可して自動判定を有効にする</v-btn>
        <v-btn variant="outlined" block :loading="busy" :disabled="busy" @click="manualRegister">手動で在校登録</v-btn>
        <v-btn variant="outlined" block :loading="busy" :disabled="busy" @click="manualRegister">GPSを使わず手動で在校登録</v-btn>
        <div class="text-caption text-medium-emphasis">自動判定を有効にすると、サイトを開いたとき・前面に戻ったときに位置情報を確認します。手動登録は当日中のみ有効で、GPSで校外と判定された場合は校外が優先されます。</div>
      </div>
      <div v-else class="d-flex flex-wrap ga-2">
        <v-btn color="primary" variant="tonal" :loading="busy" :disabled="busy" @click="checkLocation">今すぐ再判定</v-btn>
        <v-btn variant="outlined" :loading="busy" :disabled="busy" @click="manualRegister">手動で在校登録</v-btn>
        <v-btn color="error" variant="text" :loading="busy" :disabled="busy" @click="disable">位置情報の利用を停止</v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { usePresence } from "~/composables/usePresence";

const { status, method, busy, error, enabled, refresh, checkLocation, enable, manualRegister, disable } = usePresence();
const statusLabel = computed(() => ({
  inside: "学校内",
  outside: "校外",
  unknown: "未判定",
}[status.value]));
const statusColor = computed(() => status.value === "inside" ? "success" : status.value === "outside" ? "warning" : "default");
onMounted(() => { void refresh(); });
</script>

<template>
  <div v-if="tasks.length" class="upload-queue-anchor">
    <v-btn
      color="primary"
      elevation="6"
      rounded="pill"
      prepend-icon="mdi-cloud-upload-outline"
      @click="dialog = true"
    >
      <span v-if="queue.hasActiveTasks">アップロード中 {{ queue.activeCount }}/3</span>
      <span v-else-if="queue.failedCount">失敗 {{ queue.failedCount }}件</span>
      <span v-else>アップロード履歴</span>
      <v-progress-circular
        v-if="queue.hasActiveTasks"
        class="ml-2"
        indeterminate
        size="16"
        width="2"
      />
    </v-btn>

    <v-dialog v-model="dialog" max-width="620" scrollable>
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center justify-space-between pa-4">
          <span>アップロード状況</span>
          <v-btn icon="mdi-close" variant="text" size="small" @click="dialog = false" />
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-3">
          <div v-if="queue.hasActiveTasks" class="d-flex align-center justify-space-between mb-3">
            <span class="text-caption text-medium-emphasis">
              同時アップロード {{ queue.activeCount }}/3 · 待機中 {{ queue.pendingCount }}件
            </span>
            <v-btn size="small" variant="text" color="error" @click="queue.cancelAll()">
              すべてキャンセル
            </v-btn>
          </div>

          <v-list v-if="tasks.length" lines="two" class="pa-0">
            <v-list-item v-for="task in tasks" :key="task.id" class="px-1">
              <template #prepend>
                <v-icon :icon="statusIcon(task.status)" :color="statusColor(task.status)" />
              </template>
              <v-list-item-title class="text-wrap">{{ task.fileName }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ formatSize(task.fileSize) }} · {{ statusLabel(task.status) }}
                <span v-if="task.status === 'uploading'"> · {{ task.progress }}%</span>
                <span v-if="task.error" class="text-error d-block">{{ task.error }}</span>
              </v-list-item-subtitle>
              <v-progress-linear
                v-if="task.status === 'uploading'"
                :model-value="task.progress"
                color="primary"
                rounded
                height="4"
                class="mt-2"
              />
              <template #append>
                <div class="d-flex align-center">
                  <v-btn
                    v-if="task.status === 'failed' || task.status === 'cancelled'"
                    icon="mdi-refresh"
                    variant="text"
                    size="small"
                    color="primary"
                    aria-label="再試行"
                    @click="retry(task.id)"
                  />
                  <v-btn
                    v-if="task.status === 'queued' || task.status === 'uploading'"
                    icon="mdi-close"
                    variant="text"
                    size="small"
                    color="error"
                    aria-label="キャンセル"
                    @click="queue.cancel(task.id)"
                  />
                </div>
              </template>
            </v-list-item>
          </v-list>
          <v-alert v-else type="info" variant="tonal">アップロード履歴はありません。</v-alert>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-3">
          <v-btn
            v-if="tasks.some(task => task.status === 'completed')"
            variant="text"
            color="error"
            @click="queue.clearCompleted()"
          >
            完了履歴を消去
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">閉じる</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useUploadQueueStore, type UploadTaskStatus } from '~/stores/uploadQueue'

const queue = useUploadQueueStore()
const dialog = ref(false)
const tasks = computed(() => queue.tasks)

let historyCleanupTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  queue.initialize()
  historyCleanupTimer = setInterval(queue.pruneHistory, 60 * 60 * 1000)
})

onUnmounted(() => {
  if (historyCleanupTimer) clearInterval(historyCleanupTimer)
})

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const statusLabel = (status: UploadTaskStatus) => ({
  queued: '待機中',
  uploading: 'アップロード中',
  completed: '完了',
  failed: '失敗',
  cancelled: 'キャンセル',
})[status]

const statusIcon = (status: UploadTaskStatus) => ({
  queued: 'mdi-clock-outline',
  uploading: 'mdi-cloud-upload-outline',
  completed: 'mdi-check-circle',
  failed: 'mdi-alert-circle',
  cancelled: 'mdi-cancel',
})[status]

const statusColor = (status: UploadTaskStatus) => ({
  queued: 'medium-emphasis',
  uploading: 'primary',
  completed: 'success',
  failed: 'error',
  cancelled: 'medium-emphasis',
})[status]

const retry = (id: string) => {
  void queue.retry(id).catch(() => undefined)
}
</script>

<style scoped>
.upload-queue-anchor {
  position: fixed;
  z-index: 1200;
  right: 16px;
  bottom: calc(76px + env(safe-area-inset-bottom));
}

@media (min-width: 960px) {
  .upload-queue-anchor {
    bottom: 24px;
  }
}
</style>

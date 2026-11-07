<template>
  <section class="avatar-settings">
    <div class="d-flex align-center flex-wrap ga-4">
      <UserAvatar :user="auth.user" :src="previewUrl || undefined" :size="76" />
      <div class="flex-grow-1">
        <div class="font-weight-bold mb-1">プロフィール画像</div>
        <div class="text-body-2 text-medium-emphasis mb-3">JPEG・PNG・WebP形式、2MB以下</div>
        <div class="d-flex flex-wrap ga-2">
          <v-btn size="small" variant="outlined" prepend-icon="mdi-image-edit-outline" :disabled="uploading" @click="fileInput?.click()">画像を選択</v-btn>
          <v-btn v-if="selectedFile" size="small" color="primary" :loading="uploading" @click="uploadAvatar">保存する</v-btn>
          <v-btn v-if="auth.user?.avatar_key" size="small" variant="text" color="error" :disabled="uploading" @click="removeAvatar">画像を削除</v-btn>
        </div>
        <input ref="fileInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="selectAvatar">
      </div>
    </div>
    <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mt-4">{{ errorMessage }}</v-alert>
    <v-alert v-if="successMessage" type="success" variant="tonal" density="compact" class="mt-4">{{ successMessage }}</v-alert>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const { apiFetch } = useApi()
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const previewUrl = ref('')
const uploading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const clearPreview = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  selectedFile.value = null
}

const selectAvatar = (event: Event) => {
  errorMessage.value = ''
  successMessage.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    errorMessage.value = 'JPEG・PNG・WebP形式の画像を選択してください。'
    input.value = ''
    return
  }
  if (file.size === 0 || file.size > 2 * 1024 * 1024) {
    errorMessage.value = '画像は2MB以下にしてください。'
    input.value = ''
    return
  }
  clearPreview()
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

const uploadAvatar = async () => {
  if (!selectedFile.value || !auth.user) return
  uploading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const form = new FormData()
    form.append('avatar', selectedFile.value)
    const response = await apiFetch<{ avatar_key: string }>('/api/auth/avatar', { method: 'POST', body: form })
    auth.user = { ...auth.user, avatar_key: response.avatar_key }
    clearPreview()
    if (fileInput.value) fileInput.value.value = ''
    successMessage.value = 'プロフィール画像を変更しました。'
  } catch (error: any) {
    errorMessage.value = error?.data?.error || error?.message || '画像のアップロードに失敗しました。'
  } finally {
    uploading.value = false
  }
}

const removeAvatar = async () => {
  if (!auth.user?.avatar_key || uploading.value) return
  uploading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await apiFetch('/api/auth/avatar', { method: 'DELETE' })
    auth.user = { ...auth.user, avatar_key: null }
    clearPreview()
    if (fileInput.value) fileInput.value.value = ''
    successMessage.value = 'プロフィール画像を削除しました。'
  } catch (error: any) {
    errorMessage.value = error?.data?.error || error?.message || '画像の削除に失敗しました。'
  } finally {
    uploading.value = false
  }
}

onBeforeUnmount(clearPreview)
</script>

<style scoped>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>

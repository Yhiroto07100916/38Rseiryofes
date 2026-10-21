<template>
  <v-container class="py-6" style="max-width: 1200px">
    <div class="d-flex align-center mb-6">
      <BackButton />
    </div>
    <div class="d-flex flex-wrap align-center mb-6 ga-3">
      <div class="flex-grow-1" style="min-width: 0">
        <h1
          class="text-h5 font-weight-bold text-no-wrap"
        >
          ファイル管理
        </h1>
        <p class="text-body-2 text-medium-emphasis mt-1 mb-0">
          星陵祭準備に必要な資料を共有・管理できます。
        </p>
      </div>

      <div class="d-flex align-center flex-wrap ga-2">
        <v-btn
          v-if="canManageFiles"
          to="/files/categories"
          prepend-icon="mdi-folder-cog-outline"
          variant="outlined"
        >
          カテゴリ管理
        </v-btn>

        <v-btn
          prepend-icon="mdi-refresh"
          variant="text"
          :loading="loading"
          @click="loadFiles"
        >
          更新
        </v-btn>
      </div>
    </div>

    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      @click:close="errorMessage = ''"
    >
      {{ errorMessage }}
    </v-alert>

    <v-card rounded="xl" variant="outlined" class="mb-5">
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="5">
            <v-text-field
              v-model="search"
              label="ファイルを検索"
              placeholder="ファイル名・AI要約"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="comfortable"
              hide-details
              clearable
              @keydown.enter="loadFiles"
              @click:clear="loadFiles"
            />
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="categoryFilter"
              :items="categoryOptions"
              label="カテゴリ"
              variant="outlined"
              density="comfortable"
              hide-details
              clearable
            />
          </v-col>

          <v-col cols="12" sm="6" md="4">
            <div class="d-flex align-center justify-space-between flex-wrap ga-2">
              <v-btn-toggle
                v-model="showArchived"
                mandatory
                color="primary"
                density="comfortable"
                divided
              >
                <v-btn :value="false" size="small">通常</v-btn>
                <v-btn :value="true" size="small">アーカイブ</v-btn>
              </v-btn-toggle>

              <v-btn
                color="primary"
                prepend-icon="mdi-magnify"
                :loading="loading"
                @click="loadFiles"
              >
                検索
              </v-btn>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card rounded="xl" variant="outlined" class="mb-5">
      <v-card-text>
        <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-4">
          <div>
            <div class="text-subtitle-1 font-weight-bold">ファイルをアップロード</div>
            <div class="text-caption text-medium-emphasis">
              1ファイル最大25 MiB
            </div>
          </div>
          <v-btn
            color="primary"
            prepend-icon="mdi-upload"
            :loading="uploading"
            :disabled="uploading || !selectedFile"
            @click="uploadFile"
          >
            アップロード
          </v-btn>
        </div>

        <v-row align="center">
          <v-col cols="12" sm="5">
            <v-select
              v-model="uploadCategory"
              :items="activeCategoryOptions"
              label="保存先カテゴリ"
              variant="outlined"
              density="comfortable"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="7">
            <v-file-input
              v-model="selectedFile"
              label="ファイルを選択"
              prepend-icon="mdi-paperclip"
              variant="outlined"
              density="comfortable"
              :show-size="true"
              :multiple="false"
              :disabled="uploading"
              hide-details
              clearable
            />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <div class="d-flex align-center justify-space-between mb-3">
      <h2 class="text-subtitle-1 font-weight-bold">
        {{ showArchived ? 'アーカイブ済みファイル' : 'ファイル一覧' }}
      </h2>
      <v-chip size="small" variant="tonal">{{ files.length }}件</v-chip>
    </div>

    <v-card rounded="xl" variant="outlined">
      <v-progress-linear v-if="loading" indeterminate />

      <v-list v-if="files.length" class="file-list pa-0">
        <template v-for="(file, index) in files" :key="file.id">
          <v-list-item class="file-list-item">
            <div class="file-entry">
              <div class="file-info">
                <v-avatar
                  color="primary"
                  variant="tonal"
                  rounded="lg"
                  class="file-avatar"
                >
                  <v-icon :icon="fileIcon(file.content_type)" />
                </v-avatar>

                <div class="file-details">
                  <div class="font-weight-medium file-name">
                    {{ file.original_name }}
                  </div>

                  <div class="text-medium-emphasis text-body-2 file-metadata">
                    {{ categoryName(file.category) }}
                    · {{ formatSize(file.size) }}
                    · {{ formatDate(file.created_at) }}
                  </div>

                  <div
                    v-if="file.ai_summary"
                    class="text-medium-emphasis text-body-2 file-summary"
                  >
                    {{ file.ai_summary }}
                  </div>
                </div>
              </div>

              <div class="file-actions">
                <v-btn
                  icon="mdi-eye-outline"
                  variant="text"
                  size="small"
                  aria-label="閲覧"
                  @click="previewFile(file)"
                />
                <v-btn
                  icon="mdi-open-in-new"
                  variant="text"
                  size="small"
                  aria-label="新しいタブで開く"
                  @click="openFile(file)"
                />
                <v-btn
                  icon="mdi-download"
                  variant="text"
                  size="small"
                  aria-label="ダウンロード"
                  :loading="downloadingId === file.id"
                  @click="downloadFile(file)"
                />
                <v-btn
                  v-if="canManageFiles && !showArchived"
                  icon="mdi-export-variant"
                  variant="text"
                  size="small"
                  aria-label="共有リンク管理"
                  @click="openShareDialog(file)"
                />
                <v-btn
                  v-if="canManageFiles && !showArchived"
                  icon="mdi-archive-arrow-down-outline"
                  variant="text"
                  size="small"
                  aria-label="アーカイブ"
                  :loading="actionFileId === file.id"
                  @click="changeArchive(file, 'archive')"
                />
                <v-btn
                  v-if="canManageFiles && showArchived"
                  icon="mdi-archive-arrow-up-outline"
                  variant="text"
                  size="small"
                  aria-label="復元"
                  :loading="actionFileId === file.id"
                  @click="changeArchive(file, 'restore')"
                />
                <v-btn
                  v-if="isAdmin && showArchived"
                  icon="mdi-delete-forever-outline"
                  color="error"
                  variant="text"
                  size="small"
                  aria-label="完全削除"
                  @click="confirmPermanentDelete(file)"
                />
              </div>
            </div>
          </v-list-item>
          <v-divider v-if="index < files.length - 1" />
        </template>
      </v-list>

      <v-card-text v-else-if="!loading" class="text-center py-12">
        <v-icon icon="mdi-folder-open-outline" size="48" color="medium-emphasis" />
        <div class="text-body-1 mt-3">ファイルがありません</div>
        <div class="text-body-2 text-medium-emphasis mt-1">
          検索条件を変えるか、ファイルをアップロードしてください。
        </div>
      </v-card-text>
    </v-card>

    <v-dialog v-model="shareDialog" max-width="600">
      <v-card rounded="xl">
        <v-card-title class="text-h6">共有リンク</v-card-title>
        <v-card-text>
          <div class="text-body-2 text-medium-emphasis mb-3">
            {{ shareTarget?.original_name }}
          </div>
          <v-alert type="info" variant="tonal" class="mb-4">
            リンクを知っている人はログインなしでファイルを閲覧できます。
            不特定多数に共有しないよう注意してください。
          </v-alert>
          <v-btn
            v-if="canCreateShareLink"
            color="primary"
            prepend-icon="mdi-link-plus"
            block
            :loading="shareCreating"
            :disabled="!shareTarget"
            @click="createShareLink"
          >
            新しい共有リンクを発行
          </v-btn>
          <v-progress-linear v-if="sharesLoading" indeterminate class="mt-4" />
          <v-alert v-if="shareError" type="error" variant="tonal" class="mt-3">
            {{ shareError }}
          </v-alert>
          <div v-if="newShareUrl" class="mt-4">
            <div class="text-subtitle-2 mb-2">発行したリンク</div>
            <v-text-field
              :model-value="newShareUrl"
              readonly
              variant="outlined"
              density="comfortable"
              hide-details
            />
            <v-btn class="mt-2" block variant="outlined" prepend-icon="mdi-content-copy" @click="copyShareUrl(newShareUrl)">
              リンクをコピー
            </v-btn>
          </div>
          <div class="text-subtitle-2 mt-5 mb-2">共有リンク一覧</div>
          <v-list v-if="shareItems.length" density="compact" class="pa-0">
            <v-list-item v-for="item in shareItems" :key="item.id">
              <v-list-item-title class="text-body-2">
                {{ formatDate(item.created_at) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ item.revoked_at ? '停止済み' : '有効' }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  v-if="canRevokeShareLink && !item.revoked_at"
                  icon="mdi-link-off"
                  variant="text"
                  color="error"
                  size="small"
                  aria-label="共有リンクを停止"
                  :loading="shareRevokingId === item.id"
                  @click="revokeShareLink(item)"
                />
              </template>
            </v-list-item>
          </v-list>
          <div v-else-if="!sharesLoading" class="text-body-2 text-medium-emphasis">
            共有リンクはまだありません。
          </div>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn variant="text" @click="shareDialog = false">閉じる</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="previewDialog" max-width="1000" scrollable>
      <v-card rounded="xl">
        <v-toolbar density="comfortable">
          <v-toolbar-title class="text-body-1 font-weight-bold">
            {{ previewFileData?.original_name ?? 'ファイル閲覧' }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            icon="mdi-download"
            variant="text"
            aria-label="ダウンロード"
            :disabled="!previewFileData"
            @click="previewFileData && downloadFile(previewFileData)"
          />
          <v-btn
            icon="mdi-close"
            variant="text"
            aria-label="閉じる"
            @click="closePreview"
          />
        </v-toolbar>

        <v-card-text class="pa-2" style="min-height: 240px">
          <v-progress-linear v-if="previewLoading" indeterminate />
          <v-alert
            v-if="previewError"
            type="error"
            variant="tonal"
          >
            {{ previewError }}
          </v-alert>

          <v-img
            v-if="previewUrl && previewContentType.startsWith('image/')"
            :src="previewUrl"
            :alt="previewFileData?.original_name ?? '画像'"
            max-height="75vh"
            contain
          />
          <iframe
            v-else-if="previewUrl && (
              previewContentType === 'application/pdf' ||
              previewContentType.startsWith('text/')
            )"
            :src="previewUrl"
            :title="previewFileData?.original_name ?? 'ファイルプレビュー'"
            style="display: block; width: 100%; height: 75vh; border: 0"
          />
          <div
            v-else-if="previewUrl && !previewLoading && !previewError"
            class="text-center pa-8"
          >
            <v-icon icon="mdi-file-download-outline" size="48" />
            <p class="mt-3">このファイル形式はプレビューに対応していません。</p>
            <v-btn
              class="mt-3"
              color="primary"
              prepend-icon="mdi-download"
              @click="previewFileData && downloadFile(previewFileData)"
            >
              ダウンロード
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="480" persistent>
      <v-card rounded="xl">
        <v-card-title class="text-h6">ファイルを完全に削除</v-card-title>
        <v-card-text>
          <p class="mb-3">
            次のファイルを完全に削除します。この操作は取り消せません。
          </p>
          <v-sheet
            v-if="deleteTarget"
            rounded="lg"
            border
            class="pa-3 text-body-2 text-break"
          >
            {{ deleteTarget.original_name }}
          </v-sheet>
          <v-alert
            v-if="deleteError"
            type="error"
            variant="tonal"
            class="mt-3"
          >
            {{ deleteError }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="deleting"
            @click="deleteDialog = false"
          >
            キャンセル
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="deleting"
            @click="permanentlyDeleteFile"
          >
            完全に削除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" timeout="3000">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
})

import { useConfirmDialog } from '~/composables/useConfirmDialog'

interface FileCategory {
  slug: string
  name: string
  description: string | null
  sort_order: number
  is_active: number
}

interface ManagedFile {
  id: string
  object_key: string
  original_name: string
  content_type: string
  size: number
  category: string
  uploaded_by: string
  created_at: string
  archived_at: string | null
  ai_status?: string
  ai_summary?: string | null
}

const { apiFetch } = useApi()
const { confirm } = useConfirmDialog()
const config = useRuntimeConfig()
const auth = useAuthStore()

const loading = ref(false)
const uploading = ref(false)
const search = ref('')
const categoryFilter = ref<string | null>(null)
const uploadCategory = ref('uploads')
const showArchived = ref(false)
const selectedFile = ref<File | File[] | null>(null)
const files = ref<ManagedFile[]>([])
const categories = ref<FileCategory[]>([])
const errorMessage = ref('')
const snackbar = ref(false)
const snackbarMessage = ref('')
const downloadingId = ref('')
const actionFileId = ref('')

const previewDialog = ref(false)
const previewLoading = ref(false)
const previewError = ref('')
const previewUrl = ref('')
const previewContentType = ref('')
const previewFileData = ref<ManagedFile | null>(null)

interface FileShare {
  id: string
  created_at: string
  revoked_at: string | null
}

const shareDialog = ref(false)
const shareTarget = ref<ManagedFile | null>(null)
const shareItems = ref<FileShare[]>([])
const sharesLoading = ref(false)
const shareCreating = ref(false)
const shareRevokingId = ref('')
const shareError = ref('')
const newShareUrl = ref('')

const deleteDialog = ref(false)
const deleteTarget = ref<ManagedFile | null>(null)
const deleteError = ref('')
const deleting = ref(false)

const isAdmin = computed(() =>
  auth.accountRoles.some(role => role.name === 'admin'),
)

const canManageFiles = computed(() =>
  auth.accountRoles.some(role =>
    ['admin', 'class_representative'].includes(role.name),
  ),
)

const canCreateShareLink = computed(() =>
  auth.hasPermission('files.share.create'),
)

const canRevokeShareLink = computed(() =>
  auth.hasPermission('files.share.revoke'),
)

const canViewShareLinks = computed(() =>
  canCreateShareLink.value || canRevokeShareLink.value,
)

const activeCategories = computed(() =>
  categories.value.filter(category => category.is_active === 1),
)

const activeCategoryOptions = computed(() =>
  activeCategories.value.map(category => ({
    title: category.name,
    value: category.slug,
  })),
)

const categoryOptions = computed(() =>
  activeCategories.value.map(category => ({
    title: category.name,
    value: category.slug,
  })),
)

const categoryName = (slug: string) =>
  categories.value.find(category => category.slug === slug)?.name ?? slug

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`
  return `${(size / (1024 * 1024)).toFixed(1)} MiB`
}

const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('ja-JP')
}

const fileIcon = (contentType: string) => {
  if (contentType.startsWith('image/')) return 'mdi-file-image-outline'
  if (contentType.includes('pdf')) return 'mdi-file-pdf-box'
  if (contentType.includes('word')) return 'mdi-file-word-outline'
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) {
    return 'mdi-file-excel-outline'
  }
  return 'mdi-file-outline'
}

const loadCategories = async () => {
  const response = await apiFetch<{ categories: FileCategory[] }>(
    '/api/files/categories',
  )
  categories.value = response.categories

  if (!activeCategories.value.some(category => category.slug === uploadCategory.value)) {
    uploadCategory.value = activeCategories.value[0]?.slug ?? ''
  }
}

const loadFiles = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const params = new URLSearchParams()
    params.set('limit', '200')
    if (search.value.trim()) params.set('search', search.value.trim())
    if (categoryFilter.value) params.set('category', categoryFilter.value)
    if (showArchived.value) params.set('archived', 'true')

    const response = await apiFetch<{ files: ManagedFile[]; count: number }>(
      `/api/files?${params.toString()}`,
    )
    files.value = response.files
  } catch (error) {
    console.error(error)
    errorMessage.value = 'ファイル一覧を取得できませんでした。'
  } finally {
    loading.value = false
  }
}

const uploadFile = async () => {
  const file = Array.isArray(selectedFile.value)
    ? selectedFile.value[0]
    : selectedFile.value

  if (!file) return

  if (file.size > 25 * 1024 * 1024) {
    errorMessage.value = 'ファイルサイズは25 MiB以下にしてください。'
    return
  }

  if (!uploadCategory.value) {
    errorMessage.value = '保存先カテゴリを選択してください。'
    return
  }

  uploading.value = true
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', uploadCategory.value)

    await apiFetch('/api/files', {
      method: 'POST',
      body: formData,
    })

    selectedFile.value = null
    snackbarMessage.value = 'アップロードしました。'
    snackbar.value = true
    await loadFiles()
  } catch (error) {
    console.error(error)
    errorMessage.value = 'アップロードに失敗しました。カテゴリやファイルサイズを確認してください。'
  } finally {
    uploading.value = false
  }
}

const fileObjectUrl = (file: ManagedFile) => {
  const baseURL = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
  const objectKey = file.object_key
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/')
  return `${baseURL}/api/files/${objectKey}`
}

const openFile = async (file: ManagedFile) => {
  errorMessage.value = ''

  // 非同期処理の前にタブを開き、ポップアップブロックを避ける
  const openedWindow = window.open('about:blank', '_blank')

  if (!openedWindow) {
    errorMessage.value = '新しいタブが開けません。ポップアップを許可してください。'
    return
  }

  openedWindow.opener = null
  openedWindow.document.title = 'ファイルを読み込み中…'

  try {
    const response = await fetch(fileObjectUrl(file), {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    openedWindow.location.href = objectUrl

    // 新しいタブでの読み込み時間を確保してから解放する
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    console.error(error)
    openedWindow.close()
    errorMessage.value = 'ファイルを開けませんでした。ダウンロードをお試しください。'
  }
}

const previewFile = async (file: ManagedFile) => {
  closePreview()
  previewFileData.value = file
  previewDialog.value = true
  previewLoading.value = true
  previewError.value = ''

  try {
    const response = await fetch(fileObjectUrl(file), {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const blob = await response.blob()
    previewContentType.value =
      response.headers.get('Content-Type')?.split(';')[0]?.trim()
      || file.content_type
      || blob.type
      || 'application/octet-stream'
    previewUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    console.error(error)
    previewError.value = 'ファイルを表示できませんでした。ダウンロードをお試しください。'
  } finally {
    previewLoading.value = false
  }
}

const closePreview = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = ''
  previewContentType.value = ''
  previewError.value = ''
  previewLoading.value = false
  previewDialog.value = false
  previewFileData.value = null
}

const confirmPermanentDelete = (file: ManagedFile) => {
  deleteTarget.value = file
  deleteError.value = ''
  deleteDialog.value = true
}

const permanentlyDeleteFile = async () => {
  const file = deleteTarget.value

  if (!file || !isAdmin.value || !showArchived.value || deleting.value) {
    return
  }

  deleting.value = true
  deleteError.value = ''

  try {
    const response = await fetch(fileObjectUrl(file), {
      method: 'DELETE',
      credentials: 'include',
    })

    const result = await response.json().catch(() => ({})) as {
      error?: string
      code?: string
    }

    if (!response.ok) {
      if (result.code === 'FILE_HAS_RECEIPT_LINK') {
        throw new Error('会計の領収書に紐づいているため削除できません。')
      }
      if (result.code === 'FILE_MUST_BE_ARCHIVED') {
        throw new Error('先にファイルをアーカイブしてください。')
      }
      if (response.status === 403) {
        throw new Error('物理削除は管理者のみ実行できます。')
      }
      throw new Error(result.error || `削除に失敗しました (HTTP ${response.status})`)
    }

    deleteDialog.value = false
    deleteTarget.value = null
    snackbarMessage.value = 'ファイルを完全に削除しました。'
    snackbar.value = true
    await loadFiles()
  } catch (error) {
    console.error(error)
    deleteError.value = error instanceof Error
      ? error.message
      : '削除に失敗しました。'
  } finally {
    deleting.value = false
  }
}

const downloadFile = async (file: ManagedFile) => {
  downloadingId.value = file.id
  errorMessage.value = ''

  try {
    const baseURL = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
    const objectKey = file.object_key
      .split('/')
      .map(part => encodeURIComponent(part))
      .join('/')
    const response = await fetch(`${baseURL}/api/files/${objectKey}`, {
      credentials: 'include',
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = file.original_name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    console.error(error)
    errorMessage.value = 'ダウンロードに失敗しました。'
  } finally {
    downloadingId.value = ''
  }
}

const openShareDialog = async (file: ManagedFile) => {
  shareTarget.value = file
  shareDialog.value = true
  shareItems.value = []
  newShareUrl.value = ''
  shareError.value = ''

  if (!canViewShareLinks.value) {
    sharesLoading.value = false
    return
  }

  sharesLoading.value = true

  try {
    const response = await apiFetch<{ shares: FileShare[] }>(
      `/api/files/${encodeURIComponent(file.id)}/shares`,
    )
    shareItems.value = response.shares
  } catch (error) {
    console.error(error)
    shareError.value = '共有リンク一覧を取得できませんでした。'
  } finally {
    sharesLoading.value = false
  }
}

const createShareLink = async () => {
  const file = shareTarget.value
  if (!canCreateShareLink.value || !file || shareCreating.value) return

  shareCreating.value = true
  shareError.value = ''
  try {
    const response = await apiFetch<{
      id: string
      token: string
      created_at: string
    }>(`/api/files/${encodeURIComponent(file.id)}/shares`, {
      method: 'POST',
    })

    const baseURL = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
    newShareUrl.value = `${baseURL}/api/public/files/${response.token}`
    shareItems.value.unshift({
      id: response.id,
      created_at: response.created_at,
      revoked_at: null,
    })
    await copyShareUrl(newShareUrl.value)
  } catch (error) {
    console.error(error)
    shareError.value = '共有リンクを発行できませんでした。'
  } finally {
    shareCreating.value = false
  }
}

const copyShareUrl = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url)
    snackbarMessage.value = '共有リンクをコピーしました。'
    snackbar.value = true
  } catch {
    shareError.value = '自動コピーできません。リンク欄からコピーしてください。'
  }
}

const revokeShareLink = async (item: FileShare) => {
  const file = shareTarget.value
  if (!canRevokeShareLink.value || !file || item.revoked_at || shareRevokingId.value) return
  const confirmed = await confirm({
    title: '共有リンクを停止',
    message: 'この共有リンクを停止しますか？リンクを知っていても閲覧できなくなります。',
    confirmText: '停止',
    confirmColor: 'error',
  })

  if (!confirmed) return

  shareRevokingId.value = item.id
  shareError.value = ''
  try {
    await apiFetch(
      `/api/files/${encodeURIComponent(file.id)}/shares/${encodeURIComponent(item.id)}`,
      { method: 'DELETE' },
    )
    item.revoked_at = new Date().toISOString()
    if (newShareUrl.value) newShareUrl.value = ''
    snackbarMessage.value = '共有リンクを停止しました。'
    snackbar.value = true
  } catch (error) {
    console.error(error)
    shareError.value = '共有リンクを停止できませんでした。'
  } finally {
    shareRevokingId.value = ''
  }
}

const changeArchive = async (
  file: ManagedFile,
  action: 'archive' | 'restore',
) => {
  actionFileId.value = file.id
  errorMessage.value = ''

  try {
    await apiFetch(`/api/files/${encodeURIComponent(file.id)}/${action}`, {
      method: 'POST',
    })
    snackbarMessage.value = action === 'archive'
      ? 'アーカイブしました。'
      : 'ファイルを復元しました。'
    snackbar.value = true
    await loadFiles()
  } catch (error) {
    console.error(error)
    errorMessage.value = '操作に失敗しました。'
  } finally {
    actionFileId.value = ''
  }
}

watch([categoryFilter, showArchived], () => {
  void loadFiles()
})

onMounted(async () => {
  try {
    await loadCategories()
  } catch (error) {
    console.error(error)
    errorMessage.value = 'カテゴリを取得できませんでした。'
  }

  await loadFiles()
})
</script>\n
<style scoped>
.file-list-item {
  padding: 12px 16px;
}

.file-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.file-avatar {
  flex: 0 0 auto;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.5;
}

.file-metadata,
.file-summary {
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.5;
  margin-top: 4px;
}

.file-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
  gap: 2px;
}

@media (max-width: 600px) {
  .file-list-item {
    padding: 14px 12px;
  }

  .file-entry {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .file-info {
    align-items: flex-start;
  }

  .file-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
    width: 100%;
    padding-top: 8px;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    gap: 4px;
  }

  .file-actions :deep(.v-btn) {
    flex: 1 1 44px;
    max-width: 64px;
  }
}
</style>

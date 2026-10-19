<template>
  <v-container class="py-6" style="max-width: 1000px">
    <div class="d-flex align-center flex-wrap ga-3 mb-6">
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        aria-label="ファイル管理へ戻る"
        to="/files"
      />
      <div class="flex-grow-1">
        <h1 class="text-h5 font-weight-bold">カテゴリ管理</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          ファイル管理で使用するカテゴリを管理します。
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        カテゴリ追加
      </v-btn>
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

    <v-alert
      type="info"
      variant="tonal"
      class="mb-5"
    >
      カテゴリを無効化しても、登録済みファイルは削除されません。
      必要に応じて再有効化できます。
    </v-alert>

    <v-card rounded="xl" variant="outlined">
      <v-progress-linear v-if="loading" indeterminate />

      <v-list v-if="categories.length" lines="two">
        <template v-for="(category, index) in categories" :key="category.slug">
          <v-list-item>
            <template #prepend>
              <v-avatar color="primary" variant="tonal" rounded="lg">
                <v-icon icon="mdi-folder-outline" />
              </v-avatar>
            </template>

            <v-list-item-title class="font-weight-medium">
              {{ category.name }}
              <v-chip
                size="x-small"
                class="ml-2"
                :color="category.is_active ? 'success' : 'default'"
                variant="tonal"
              >
                {{ category.is_active ? '有効' : '無効' }}
              </v-chip>
            </v-list-item-title>

            <v-list-item-subtitle>
              ID: {{ category.slug }}
              · 並び順: {{ category.sort_order }}
              <span v-if="category.description">
                <br>{{ category.description }}
              </span>
            </v-list-item-subtitle>

            <template #append>
              <div class="d-flex align-center">
                <v-btn
                  icon="mdi-pencil-outline"
                  variant="text"
                  aria-label="カテゴリを編集"
                  @click="openEdit(category)"
                />
                <v-btn
                  v-if="category.is_active"
                  icon="mdi-folder-remove-outline"
                  variant="text"
                  aria-label="カテゴリを無効化"
                  :loading="busySlug === category.slug"
                  @click="setActive(category, false)"
                />
                <v-btn
                  v-else
                  icon="mdi-folder-check-outline"
                  variant="text"
                  aria-label="カテゴリを再有効化"
                  :loading="busySlug === category.slug"
                  @click="setActive(category, true)"
                />
              </div>
            </template>
          </v-list-item>
          <v-divider v-if="index < categories.length - 1" />
        </template>
      </v-list>

      <v-card-text v-else-if="!loading" class="text-center py-10">
        カテゴリがありません。
      </v-card-text>
    </v-card>

    <v-dialog v-model="dialog" max-width="520" persistent>
      <v-card rounded="xl">
        <v-card-title class="pt-5">
          {{ editing ? 'カテゴリを編集' : 'カテゴリを追加' }}
        </v-card-title>

        <v-card-text>
          <v-alert
            v-if="dialogError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ dialogError }}
          </v-alert>

          <v-text-field
            v-model="form.slug"
            label="カテゴリID"
            hint="英小文字・数字・ハイフン・アンダースコア"
            persistent-hint
            variant="outlined"
            :disabled="!!editing"
            class="mb-3"
          />

          <v-text-field
            v-model="form.name"
            label="表示名"
            variant="outlined"
            class="mb-3"
          />

          <v-textarea
            v-model="form.description"
            label="説明（任意）"
            variant="outlined"
            rows="2"
            auto-grow
            class="mb-3"
          />

          <v-text-field
            v-model.number="form.sort_order"
            label="並び順"
            type="number"
            min="0"
            max="10000"
            variant="outlined"
          />
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="saving"
            @click="dialog = false"
          >
            キャンセル
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            @click="saveCategory"
          >
            保存
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
  middleware: ['auth', 'class-representative'],
})

interface FileCategory {
  slug: string
  name: string
  description: string | null
  sort_order: number
  is_active: number
}

const { apiFetch } = useApi()

const categories = ref<FileCategory[]>([])
const loading = ref(false)
const saving = ref(false)
const busySlug = ref('')
const errorMessage = ref('')
const dialogError = ref('')
const dialog = ref(false)
const snackbar = ref(false)
const snackbarMessage = ref('')
const editing = ref<FileCategory | null>(null)

const form = reactive({
  slug: '',
  name: '',
  description: '',
  sort_order: 100,
})

const resetForm = () => {
  form.slug = ''
  form.name = ''
  form.description = ''
  form.sort_order = 100
  dialogError.value = ''
}

const loadCategories = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await apiFetch<{ categories: FileCategory[] }>(
      '/api/files/categories?include_inactive=true',
    )
    categories.value = response.categories
  } catch (error) {
    console.error(error)
    errorMessage.value = 'カテゴリを取得できませんでした。権限とAPIの状態を確認してください。'
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  editing.value = null
  resetForm()
  dialog.value = true
}

const openEdit = (category: FileCategory) => {
  editing.value = category
  form.slug = category.slug
  form.name = category.name
  form.description = category.description ?? ''
  form.sort_order = category.sort_order
  dialogError.value = ''
  dialog.value = true
}

const saveCategory = async () => {
  const name = form.name.trim()
  const slug = form.slug.trim()

  if (!name || (!editing.value && !slug)) {
    dialogError.value = 'カテゴリIDと表示名を入力してください。'
    return
  }

  if (!Number.isInteger(Number(form.sort_order)) ||
      Number(form.sort_order) < 0 ||
      Number(form.sort_order) > 10000) {
    dialogError.value = '並び順は0〜10000の整数にしてください。'
    return
  }

  saving.value = true
  dialogError.value = ''

  try {
    if (editing.value) {
      await apiFetch(
        `/api/files/categories/${encodeURIComponent(editing.value.slug)}`,
        {
          method: 'PATCH',
          body: {
            name,
            description: form.description.trim() || null,
            sort_order: Number(form.sort_order),
          },
        },
      )
    } else {
      await apiFetch('/api/files/categories', {
        method: 'POST',
        body: {
          slug,
          name,
          description: form.description.trim() || null,
          sort_order: Number(form.sort_order),
        },
      })
    }

    dialog.value = false
    snackbarMessage.value = editing.value
      ? 'カテゴリを更新しました。'
      : 'カテゴリを追加しました。'
    snackbar.value = true
    await loadCategories()
  } catch (error) {
    console.error(error)
    dialogError.value = '保存できませんでした。入力内容、カテゴリIDの重複、APIの権限設定を確認してください。'
  } finally {
    saving.value = false
  }
}

const setActive = async (category: FileCategory, active: boolean) => {
  const action = active ? '再有効化' : '無効化'
  if (!window.confirm(`「${category.name}」を${action}しますか？`)) return

  busySlug.value = category.slug
  errorMessage.value = ''

  try {
    if (active) {
      await apiFetch(
        `/api/files/categories/${encodeURIComponent(category.slug)}`,
        {
          method: 'PATCH',
          body: { is_active: true },
        },
      )
    } else {
      await apiFetch(
        `/api/files/categories/${encodeURIComponent(category.slug)}`,
        { method: 'DELETE' },
      )
    }

    snackbarMessage.value = `カテゴリを${action}しました。`
    snackbar.value = true
    await loadCategories()
  } catch (error) {
    console.error(error)
    errorMessage.value = `カテゴリを${action}できませんでした。`
  } finally {
    busySlug.value = ''
  }
}

onMounted(() => {
  void loadCategories()
})
</script>

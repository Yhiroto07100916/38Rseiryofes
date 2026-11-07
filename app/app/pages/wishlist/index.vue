<script setup lang="ts">
import type { WishlistItem } from '../../composables/useApi'

definePageMeta({
  middleware: ['auth'],
})

const api = useApi()
const items = ref<WishlistItem[]>([])
const loading = ref(true)
const saving = ref(false)
const dialog = ref(false)
const errorMessage = ref('')
const editingId = ref<string | null>(null)
const canCreate = ref(false)
const canReview = ref(false)

const emptyForm = () => ({
  title: '',
  description: '',
  product_url: '',
  quantity: 1,
  estimated_cost: null as number | null,
  priority: 'normal' as WishlistItem['priority'],
  status: 'requested' as WishlistItem['status'],
  memo: '',
})

const form = reactive(emptyForm())

const priorityItems = [
  { title: '低', value: 'low' },
  { title: '通常', value: 'normal' },
  { title: '高', value: 'high' },
  { title: '緊急', value: 'urgent' },
]

const statusItems = [
  { title: '購入希望', value: 'requested' },
  { title: '購入予定', value: 'planned' },
  { title: '購入済み', value: 'purchased' },
]

const totalEstimatedCost = computed(() =>
  items.value.reduce(
    (total, item) => total + (item.estimated_cost ?? 0) * item.quantity,
    0,
  ),
)

function formatCost(value: number | null) {
  if (value === null) return '未設定'
  return `¥${value.toLocaleString('ja-JP')}`
}

function statusLabel(status: WishlistItem['status']) {
  return statusItems.find((item) => item.value === status)?.title ?? status
}

function priorityLabel(priority: WishlistItem['priority']) {
  return priorityItems.find((item) => item.value === priority)?.title ?? priority
}

async function loadItems() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await api.getWishlistItems()
    items.value = response.items
    canCreate.value = response.capabilities.can_create
    canReview.value = response.capabilities.can_review
  } catch (error) {
    console.error(error)
    errorMessage.value = 'ほしい物リストを取得できませんでした。閲覧権限を確認してください。'
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  editingId.value = null
  Object.assign(form, emptyForm())
  dialog.value = true
}

function openEditDialog(item: WishlistItem) {
  editingId.value = item.id
  Object.assign(form, {
    title: item.title,
    description: item.description ?? '',
    product_url: item.product_url ?? '',
    quantity: item.quantity,
    estimated_cost: item.estimated_cost,
    priority: item.priority,
    status: item.status,
    memo: item.memo ?? '',
  })
  dialog.value = true
}

async function saveItem() {
  if (!form.title.trim()) {
    errorMessage.value = '品名を入力してください。'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      product_url: form.product_url || null,
      quantity: form.quantity,
      estimated_cost: form.estimated_cost,
      priority: form.priority,
      ...(canReview.value ? { status: form.status } : {}),
      memo: form.memo || null,
    }

    if (editingId.value) {
      await api.updateWishlistItem(editingId.value, payload)
    } else {
      await api.createWishlistItem(payload)
    }

    dialog.value = false
    await loadItems()
  } catch (error) {
    console.error(error)
    errorMessage.value = '保存できませんでした。登録・編集権限を確認してください。'
  } finally {
    saving.value = false
  }
}

async function setStatus(
  item: WishlistItem,
  status: WishlistItem['status'],
) {
  saving.value = true
  errorMessage.value = ''
  try {
    await api.updateWishlistItem(item.id, { status })
    await loadItems()
  } catch (error) {
    console.error(error)
    errorMessage.value = '状態を変更できませんでした。購入判断の権限を確認してください。'
  } finally {
    saving.value = false
  }
}

async function removeItem(item: WishlistItem) {
  if (!window.confirm(`「${item.title}」を削除しますか？`)) return

  errorMessage.value = ''
  try {
    await api.deleteWishlistItem(item.id)
    await loadItems()
  } catch (error) {
    console.error(error)
    errorMessage.value = '削除できませんでした。削除権限を確認してください。'
  }
}

onMounted(loadItems)
</script>

<template>
  <v-container
    max-width="1100"
    class="py-8"
  >
    <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
      <div>
        <div class="text-overline text-primary font-weight-bold">
          SHARED RESOURCES
        </div>
        <h1 class="text-h4 font-weight-bold">
          ほしい物リスト
        </h1>
        <p class="text-body-2 text-medium-emphasis mt-2">
          企画・クラス運営で必要な物品を共有して管理します。
        </p>
      </div>

      <v-btn
        v-if="canCreate"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreateDialog"
      >
        購入希望を提出
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

    <v-row class="mb-4">
      <v-col cols="12" sm="6">
        <v-card variant="tonal" rounded="lg">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">登録件数</div>
            <div class="text-h5 font-weight-bold">{{ items.length }} 件</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6">
        <v-card variant="tonal" rounded="lg">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">概算合計</div>
            <div class="text-h5 font-weight-bold">¥{{ totalEstimatedCost.toLocaleString('ja-JP') }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-row v-else-if="items.length">
      <v-col
        v-for="item in items"
        :key="item.id"
        cols="12"
        md="6"
      >
        <v-card height="100%" rounded="xl" variant="outlined">
          <v-card-item>
            <template #prepend>
              <v-avatar color="primary" variant="tonal">
                <v-icon icon="mdi-cart-outline" />
              </v-avatar>
            </template>
            <v-card-title>{{ item.title }}</v-card-title>
            <v-card-subtitle>
              登録者：{{ item.created_by_nickname || item.created_by_name || '不明' }}
            </v-card-subtitle>
            <template #append>
              <v-menu v-if="item.can_edit || item.can_delete || canReview">
                <template #activator="{ props: menuProps }">
                  <v-btn
                    v-bind="menuProps"
                    icon="mdi-dots-vertical"
                    variant="text"
                    size="small"
                    aria-label="操作"
                  />
                </template>
                <v-list density="compact">
                  <v-list-item
                    v-if="item.can_edit"
                    prepend-icon="mdi-pencil"
                    title="編集"
                    @click="openEditDialog(item)"
                  />
                  <v-list-item
                    v-if="canReview && item.status !== 'purchased'"
                    prepend-icon="mdi-check-circle-outline"
                    :title="item.status === 'requested' ? '購入予定に変更' : '購入済みに変更'"
                    :disabled="saving"
                    @click="setStatus(item, item.status === 'requested' ? 'planned' : 'purchased')"
                  />
                  <v-list-item
                    v-if="item.can_delete"
                    prepend-icon="mdi-delete-outline"
                    title="削除"
                    base-color="error"
                    @click="removeItem(item)"
                  />
                </v-list>
              </v-menu>
            </template>
          </v-card-item>

          <v-card-text>
            <div class="d-flex flex-wrap ga-2 mb-3">
              <v-chip size="small" variant="tonal">{{ statusLabel(item.status) }}</v-chip>
              <v-chip size="small" variant="tonal" color="primary">
                優先度：{{ priorityLabel(item.priority) }}
              </v-chip>
              <v-chip size="small" variant="outlined">数量：{{ item.quantity }}</v-chip>
            </div>

            <p v-if="item.description" class="text-body-2 mb-3">
              {{ item.description }}
            </p>

            <div class="text-body-2">
              単価目安：{{ formatCost(item.estimated_cost) }}
            </div>

            <a
              v-if="item.product_url"
              :href="item.product_url"
              target="_blank"
              rel="noopener noreferrer"
              class="d-inline-block mt-2"
            >
              商品ページを開く
            </a>

            <p v-if="item.memo" class="text-caption text-medium-emphasis mt-3">
              {{ item.memo }}
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card
      v-else
      variant="outlined"
      rounded="xl"
      class="text-center py-10"
    >
      <v-icon icon="mdi-cart-plus" size="48" color="disabled" />
      <div class="text-h6 mt-3">まだ物品が登録されていません</div>
      <div class="text-body-2 text-medium-emphasis mt-1">
        必要な物品を追加して、みんなで共有しましょう。
      </div>
    </v-card>

    <v-dialog v-model="dialog" max-width="640" persistent>
      <v-card rounded="xl">
        <v-card-title class="pa-5">
          {{ editingId ? '購入希望を編集' : '購入希望を提出' }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-5">
          <v-text-field
            v-model="form.title"
            label="品名"
            variant="outlined"
            required
          />
          <v-textarea
            v-model="form.description"
            label="説明"
            variant="outlined"
            rows="2"
          />
          <v-text-field
            v-model="form.product_url"
            label="商品URL"
            variant="outlined"
            type="url"
          />
          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model.number="form.quantity"
                label="数量"
                type="number"
                min="1"
                variant="outlined"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="form.estimated_cost"
                label="単価目安（円）"
                type="number"
                min="0"
                variant="outlined"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="form.priority"
                :items="priorityItems"
                label="優先度"
                variant="outlined"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-if="canReview"
                v-model="form.status"
                :items="statusItems"
                label="状態"
                variant="outlined"
              />
            </v-col>
          </v-row>
          <v-textarea
            v-model="form.memo"
            label="メモ"
            variant="outlined"
            rows="2"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">キャンセル</v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!form.title.trim()"
            @click="saveItem"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

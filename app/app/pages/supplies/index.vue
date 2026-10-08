<template>
  <v-container class="supplies-page py-8">
    <v-row justify="center">
      <v-col cols="12" lg="10">
        <LayoutBackButton />

        <div class="page-header mt-4">
          <div>
            <div class="page-eyebrow">
              SUPPLIES
            </div>

            <h1 class="page-title">
              備品・小道具
            </h1>

            <p class="page-description">
              星陵祭準備に必要なものの準備状況を管理します。
            </p>
          </div>

          <v-btn
            v-if="canCreate"
            color="primary"
            rounded="xl"
            prepend-icon="mdi-plus"
            @click="openCreateDialog"
          >
            追加
          </v-btn>
        </div>

        <v-card
          rounded="xl"
          variant="outlined"
          class="mt-6"
        >
          <v-card-text>
            <v-row>
              <v-col
                cols="12"
                md="5"
              >
                <v-text-field
                  v-model="search"
                  label="検索"
                  placeholder="備品名・説明・保管場所"
                  prepend-inner-icon="mdi-magnify"
                  variant="outlined"
                  density="comfortable"
                  clearable
                  hide-details
                />
              </v-col>

              <v-col
                cols="6"
                md="3"
              >
                <v-select
                  v-model="categoryFilter"
                  :items="categoryFilterItems"
                  label="カテゴリ"
                  variant="outlined"
                  density="comfortable"
                  clearable
                  hide-details
                />
              </v-col>

              <v-col
                cols="6"
                md="3"
              >
                <v-select
                  v-model="statusFilter"
                  :items="statusFilterItems"
                  label="状態"
                  variant="outlined"
                  density="comfortable"
                  clearable
                  hide-details
                />
              </v-col>

              <v-col
                cols="12"
                md="1"
                class="d-flex align-center justify-end"
              >
                <v-btn
                  icon="mdi-refresh"
                  variant="text"
                  :loading="loading"
                  aria-label="更新"
                  @click="loadEquipment"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <div
          v-if="errorMessage"
          class="mt-4"
        >
          <v-alert
            type="error"
            variant="tonal"
            rounded="xl"
            closable
            @click:close="errorMessage = ''"
          >
            {{ errorMessage }}
          </v-alert>
        </div>

        <div class="d-flex align-center justify-space-between mt-6 mb-3">
          <div class="list-count">
            {{ filteredEquipment.length }}件
          </div>

          <v-chip
            v-if="loading"
            size="small"
            variant="tonal"
          >
            読み込み中
          </v-chip>
        </div>

        <v-row v-if="!loading && filteredEquipment.length > 0">
          <v-col
            v-for="item in filteredEquipment"
            :key="item.id"
            cols="12"
            md="6"
          >
            <v-card
              rounded="xl"
              variant="outlined"
              class="equipment-card"
            >
              <v-card-item>
                <template #prepend>
                  <v-icon
                    :icon="categoryIcon(item.category)"
                    size="32"
                    color="primary"
                  />
                </template>

                <v-card-title>
                  {{ item.name }}
                </v-card-title>

                <v-card-subtitle>
                  {{ categoryLabel(item.category) }}
                </v-card-subtitle>
              </v-card-item>

              <v-card-text>
                <div class="d-flex flex-wrap ga-2 mb-3">
                  <v-chip
                    size="small"
                    :color="statusColor(item.status)"
                    variant="tonal"
                  >
                    {{ statusLabel(item.status) }}
                  </v-chip>

                  <v-chip
                    size="small"
                    variant="outlined"
                  >
                    {{ item.prepared_quantity }} / {{ item.required_quantity }}
                  </v-chip>
                </div>

                <p
                  v-if="item.description"
                  class="description"
                >
                  {{ item.description }}
                </p>

                <div
                  v-if="item.storage_location"
                  class="meta-row"
                >
                  <v-icon
                    icon="mdi-map-marker-outline"
                    size="18"
                  />
                  <span>{{ item.storage_location }}</span>
                </div>

                <div
                  v-if="item.owner_name || item.role_name"
                  class="meta-row"
                >
                  <v-icon
                    icon="mdi-account-outline"
                    size="18"
                  />
                  <span>
                    {{ item.owner_nickname || item.owner_name || '' }}
                    <template v-if="item.role_name">
                      <span v-if="item.owner_name || item.owner_nickname">・</span>
                      {{ item.role_name }}
                    </template>
                  </span>
                </div>
              </v-card-text>

              <v-card-actions>
                <v-spacer />

                <v-btn
                  v-if="canEdit"
                  variant="text"
                  prepend-icon="mdi-pencil-outline"
                  @click="openEditDialog(item)"
                >
                  編集
                </v-btn>

                <v-btn
                  v-if="canDelete"
                  variant="text"
                  color="error"
                  prepend-icon="mdi-delete-outline"
                  @click="openDeleteDialog(item)"
                >
                  削除
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <v-card
          v-else-if="!loading"
          rounded="xl"
          variant="outlined"
          class="empty-card"
        >
          <v-card-text class="text-center py-12">
            <v-icon
              icon="mdi-package-variant-closed"
              size="56"
              color="medium-emphasis"
            />

            <h2 class="empty-title">
              {{ search || categoryFilter || statusFilter
                ? '条件に一致する備品がありません'
                : 'まだ備品が登録されていません' }}
            </h2>

            <p class="empty-description">
              {{ search || categoryFilter || statusFilter
                ? '検索条件や絞り込み条件を変更してみてください。'
                : '必要な備品や小道具を追加してください。' }}
            </p>

            <v-btn
              v-if="canCreate && !search && !categoryFilter && !statusFilter"
              color="primary"
              rounded="xl"
              prepend-icon="mdi-plus"
              class="mt-4"
              @click="openCreateDialog"
            >
              最初の備品を追加
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog
      v-model="formDialog"
      max-width="620"
    >
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-2">
          {{ editingItem ? '備品を編集' : '備品を追加' }}
        </v-card-title>

        <v-card-text class="px-6">
          <v-text-field
            v-model="form.name"
            label="備品名"
            variant="outlined"
            required
            class="mb-2"
          />

          <v-row>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.category"
                :items="categoryItems"
                label="カテゴリ"
                variant="outlined"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-select
                v-model="form.status"
                :items="statusItems"
                label="状態"
                variant="outlined"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model.number="form.required_quantity"
                label="必要数"
                type="number"
                min="0"
                variant="outlined"
              />
            </v-col>

            <v-col cols="6">
              <v-text-field
                v-model.number="form.prepared_quantity"
                label="準備済み数"
                type="number"
                min="0"
                variant="outlined"
              />
            </v-col>
          </v-row>

          <v-text-field
            v-model="form.storage_location"
            label="保管場所"
            placeholder="例：38R教室、倉庫A"
            variant="outlined"
            class="mb-2"
          />

          <v-textarea
            v-model="form.description"
            label="説明"
            placeholder="必要なものや注意事項など"
            variant="outlined"
            rows="3"
          />

          <v-alert
            v-if="formError"
            type="error"
            variant="tonal"
            rounded="lg"
            class="mt-4"
          >
            {{ formError }}
          </v-alert>
        </v-card-text>

        <v-card-actions class="px-6 pb-6">
          <v-spacer />

          <v-btn
            variant="text"
            @click="formDialog = false"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="primary"
            rounded="xl"
            :loading="saving"
            @click="saveEquipment"
          >
            {{ editingItem ? '保存' : '追加' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="deleteDialog"
      max-width="460"
    >
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-2">
          備品を削除しますか？
        </v-card-title>

        <v-card-text class="px-6">
          「{{ deletingItem?.name }}」を削除します。
          この操作は元に戻せません。
        </v-card-text>

        <v-card-actions class="px-6 pb-6">
          <v-spacer />

          <v-btn
            variant="text"
            @click="deleteDialog = false"
          >
            キャンセル
          </v-btn>

          <v-btn
            color="error"
            rounded="xl"
            :loading="deleting"
            @click="deleteEquipment"
          >
            削除する
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

definePageMeta({
  middleware: 'auth',
})

interface EquipmentItem {
  id: string
  name: string
  category: string
  description: string | null
  required_quantity: number
  prepared_quantity: number
  status: string
  owner_user_id: string | null
  owner_name: string | null
  owner_nickname: string | null
  role_id: string | null
  role_name: string | null
  storage_location: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

interface EquipmentForm {
  name: string
  category: string
  description: string
  required_quantity: number
  prepared_quantity: number
  status: string
  storage_location: string
}

const api = useApi()
const auth = useAuthStore()

const equipment = ref<EquipmentItem[]>([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const errorMessage = ref('')
const formError = ref('')

const search = ref('')
const categoryFilter = ref<string | null>(null)
const statusFilter = ref<string | null>(null)

const formDialog = ref(false)
const deleteDialog = ref(false)
const editingItem = ref<EquipmentItem | null>(null)
const deletingItem = ref<EquipmentItem | null>(null)

const form = reactive<EquipmentForm>({
  name: '',
  category: 'equipment',
  description: '',
  required_quantity: 1,
  prepared_quantity: 0,
  status: 'not_started',
  storage_location: '',
})

const canCreate = computed(() => auth.hasPermission('equipment.create'))
const canEdit = computed(() => auth.hasPermission('equipment.edit'))
const canDelete = computed(() => auth.hasPermission('equipment.delete'))

const categoryItems = [
  { title: '備品', value: 'equipment' },
  { title: '小道具', value: 'prop' },
  { title: '材料', value: 'material' },
  { title: '衣装', value: 'costume' },
  { title: 'その他', value: 'other' },
]

const statusItems = [
  { title: '未準備', value: 'not_started' },
  { title: '準備中', value: 'preparing' },
  { title: '準備済み', value: 'ready' },
  { title: '使用中', value: 'in_use' },
  { title: '破損', value: 'broken' },
  { title: '不要', value: 'unneeded' },
]

const categoryFilterItems = [
  { title: '備品', value: 'equipment' },
  { title: '小道具', value: 'prop' },
  { title: '材料', value: 'material' },
  { title: '衣装', value: 'costume' },
  { title: 'その他', value: 'other' },
]

const statusFilterItems = [
  { title: '未準備', value: 'not_started' },
  { title: '準備中', value: 'preparing' },
  { title: '準備済み', value: 'ready' },
  { title: '使用中', value: 'in_use' },
  { title: '破損', value: 'broken' },
  { title: '不要', value: 'unneeded' },
]

const filteredEquipment = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return equipment.value.filter((item) => {
    if (categoryFilter.value && item.category !== categoryFilter.value) {
      return false
    }

    if (statusFilter.value && item.status !== statusFilter.value) {
      return false
    }

    if (!keyword) {
      return true
    }

    return [
      item.name,
      item.description,
      item.storage_location,
      item.owner_name,
      item.owner_nickname,
      item.role_name,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  })
})

const resetForm = () => {
  form.name = ''
  form.category = 'equipment'
  form.description = ''
  form.required_quantity = 1
  form.prepared_quantity = 0
  form.status = 'not_started'
  form.storage_location = ''
  formError.value = ''
}

const loadEquipment = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.apiFetch<{ equipment: EquipmentItem[] }>(
      '/api/equipment',
    )

    equipment.value = response.equipment
  } catch (error) {
    console.error(error)
    errorMessage.value = '備品の読み込みに失敗しました。'
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  editingItem.value = null
  resetForm()
  formDialog.value = true
}

const openEditDialog = (item: EquipmentItem) => {
  editingItem.value = item
  form.name = item.name
  form.category = item.category
  form.description = item.description ?? ''
  form.required_quantity = item.required_quantity
  form.prepared_quantity = item.prepared_quantity
  form.status = item.status
  form.storage_location = item.storage_location ?? ''
  formError.value = ''
  formDialog.value = true
}

const saveEquipment = async () => {
  formError.value = ''

  if (!form.name.trim()) {
    formError.value = '備品名を入力してください。'
    return
  }

  if (
    form.required_quantity < 0 ||
    form.prepared_quantity < 0 ||
    !Number.isInteger(form.required_quantity) ||
    !Number.isInteger(form.prepared_quantity)
  ) {
    formError.value = '数量は0以上の整数で入力してください。'
    return
  }

  if (
    form.required_quantity > 0 &&
    form.prepared_quantity > form.required_quantity
  ) {
    formError.value = '準備済み数は必要数を超えられません。'
    return
  }

  saving.value = true

  try {
    const body = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      required_quantity: form.required_quantity,
      prepared_quantity: form.prepared_quantity,
      status: form.status,
      storage_location: form.storage_location.trim() || null,
    }

    if (editingItem.value) {
      await api.apiFetch(`/api/equipment/${editingItem.value.id}`, {
        method: 'PATCH',
        body,
      })
    } else {
      await api.apiFetch('/api/equipment', {
        method: 'POST',
        body,
      })
    }

    formDialog.value = false
    await loadEquipment()
  } catch (error) {
    console.error(error)
    formError.value = '保存に失敗しました。'
  } finally {
    saving.value = false
  }
}

const openDeleteDialog = (item: EquipmentItem) => {
  deletingItem.value = item
  deleteDialog.value = true
}

const deleteEquipment = async () => {
  if (!deletingItem.value) {
    return
  }

  deleting.value = true

  try {
    await api.apiFetch(`/api/equipment/${deletingItem.value.id}`, {
      method: 'DELETE',
    })

    deleteDialog.value = false
    deletingItem.value = null
    await loadEquipment()
  } catch (error) {
    console.error(error)
    errorMessage.value = '削除に失敗しました。'
  } finally {
    deleting.value = false
  }
}

const categoryLabel = (category: string) => {
  return categoryItems.find((item) => item.value === category)?.title ?? category
}

const categoryIcon = (category: string) => {
  const icons: Record<string, string> = {
    equipment: 'mdi-package-variant-closed',
    prop: 'mdi-drama-masks',
    material: 'mdi-hammer-wrench',
    costume: 'mdi-tshirt-crew-outline',
    other: 'mdi-package-variant',
  }

  return icons[category] ?? icons.other
}

const statusLabel = (status: string) => {
  return statusItems.find((item) => item.value === status)?.title ?? status
}

const statusColor = (status: string) => {
  const colors: Record<string, string> = {
    not_started: 'grey',
    preparing: 'orange',
    ready: 'success',
    in_use: 'primary',
    broken: 'error',
    unneeded: 'grey',
  }

  return colors[status] ?? 'grey'
}

watch(
  [categoryFilter, statusFilter],
  () => {
    search.value = search.value.trim()
  },
)

onMounted(() => {
  loadEquipment()
})
</script>

<style scoped>
.supplies-page {
  max-width: 1200px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 4px;
}

.page-eyebrow {
  color: #78909c;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.page-title {
  margin-top: 4px;
  color: var(--color-primary);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
}

.page-description {
  margin-top: 8px;
  color: #78909c;
  font-size: 0.95rem;
}

.list-count {
  color: #78909c;
  font-size: 0.9rem;
  font-weight: 600;
}

.equipment-card {
  height: 100%;
  color: var(--color-primary);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.equipment-card:hover {
  transform: translateY(-2px);
}

.description {
  margin-bottom: 12px;
  color: #607d8b;
  white-space: pre-wrap;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  color: #78909c;
  font-size: 0.88rem;
}

.empty-card {
  color: #607d8b;
}

.empty-title {
  margin-top: 16px;
  color: var(--color-primary);
  font-size: 1.2rem;
}

.empty-description {
  margin-top: 8px;
  color: #78909c;
}

@media (max-width: 600px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-title {
    font-size: 1.7rem;
  }
}
</style>

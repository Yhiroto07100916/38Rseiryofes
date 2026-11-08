<template>
  <div>
    <div class="mb-6">
      <h1 class="text-h5 font-weight-bold">貸出を記録</h1>
      <p class="text-body-2 text-medium-emphasis mb-0">借りる人と工具の管理番号を選び、貸出の事実を記録します。</p>
    </div>

    <v-card rounded="lg" variant="outlined" max-width="760">
      <v-card-text>
        <div class="text-subtitle-1 font-weight-bold mb-3">借りた人</div>
        <v-row>
          <v-col cols="12" sm="4">
            <v-text-field v-model="form.class_name" label="クラス" />
          </v-col>
          <v-col cols="12" sm="8">
            <v-text-field v-model="form.name" label="氏名" />
          </v-col>
        </v-row>

        <v-divider class="my-3" />
        <div class="text-subtitle-1 font-weight-bold mb-3">借りた工具</div>
        <v-select v-model="selectedToolId" :items="availableTools" item-title="name" item-value="id" label="工具・機材" placeholder="工具を選択" no-data-text="貸出可能な工具がありません" @update:model-value="loadItems" />
        <v-select v-model="selectedItemId" :items="availableItems" item-title="management_number" item-value="id" label="管理番号" placeholder="個体を選択" no-data-text="貸出可能な個体がありません" :disabled="!selectedToolId || itemLoading" :loading="itemLoading" />
        <v-alert v-if="selectedItem" type="info" variant="tonal" class="mt-2">
          {{ selectedTool?.name }} の {{ selectedItem.management_number }} を貸出中として記録します。
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="resetForm">入力をリセット</v-btn>
        <v-btn color="primary" prepend-icon="mdi-check" :loading="saving" :disabled="!canSubmit" @click="checkout">貸出を記録</v-btn>
      </v-card-actions>
    </v-card>

    <v-alert v-if="!availableTools.length && !loading" type="info" variant="tonal" class="mt-4">現在、貸出可能な個体がありません。</v-alert>
    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3500">{{ snackbarText }}</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import type { Tool, ToolItem } from '~/types/tool-rental'

definePageMeta({ middleware: 'auth' })

const auth = useAuthStore()
const { request } = useToolRentalApi()
const tools = ref<Tool[]>([])
const items = ref<ToolItem[]>([])
const selectedToolId = ref<number | null>(null)
const selectedItemId = ref<number | null>(null)
const loading = ref(false)
const itemLoading = ref(false)
const saving = ref(false)
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const currentUserName = computed(() => auth.user?.nickname?.trim() || auth.user?.name?.trim() || '')
const form = reactive({ class_name: '38R', name: currentUserName.value })
const availableTools = computed(() => tools.value.filter(tool => tool.available_quantity > 0))
const availableItems = computed(() => items.value.filter(item => item.status === 'available'))
const selectedTool = computed(() => tools.value.find(tool => tool.id === selectedToolId.value) ?? null)
const selectedItem = computed(() => availableItems.value.find(item => item.id === selectedItemId.value) ?? null)
const canSubmit = computed(() => !!form.class_name.trim() && !!form.name.trim() && selectedItemId.value !== null && !saving.value)

const showMessage = (message: string, color = 'success') => {
  snackbarText.value = message
  snackbarColor.value = color
  snackbar.value = true
}

const loadTools = async () => {
  loading.value = true
  try {
    tools.value = await request<Tool[]>('/tools')
  } catch (error) {
    console.error(error)
    showMessage('工具一覧を取得できませんでした。', 'error')
  } finally {
    loading.value = false
  }
}

const loadItems = async () => {
  selectedItemId.value = null
  items.value = []
  if (!selectedToolId.value) return
  itemLoading.value = true
  try {
    items.value = await request<ToolItem[]>(`/tools/${selectedToolId.value}/items`)
  } catch (error) {
    console.error(error)
    showMessage('個体一覧を取得できませんでした。', 'error')
  } finally {
    itemLoading.value = false
  }
}

const resetForm = () => {
  form.class_name = '38R'
  form.name = currentUserName.value
  selectedToolId.value = null
  selectedItemId.value = null
  items.value = []
}

const checkout = async () => {
  if (!canSubmit.value || selectedItemId.value === null) return
  saving.value = true
  try {
    await request('/loans', {
      method: 'POST',
      body: {
        tool_item_id: selectedItemId.value,
        class_name: form.class_name.trim(),
        name: form.name.trim(),
      },
    })
    showMessage('貸出を記録しました。')
    resetForm()
    await loadTools()
  } catch (error: any) {
    showMessage(error?.data?.detail || '貸出の記録に失敗しました。', 'error')
    await loadTools()
    if (selectedToolId.value) await loadItems()
  } finally {
    saving.value = false
  }
}

onMounted(loadTools)
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-3 mb-5">
      <LayoutBackButton />
      <div>
        <h1 class="text-h5 font-weight-bold">工具・機材一覧</h1>
      </div>
      <v-spacer />
      <v-btn v-if="canManage" color="primary" prepend-icon="mdi-plus" @click="openCreate">工具を登録</v-btn>
      <v-btn icon="mdi-refresh" variant="text" :loading="loading" aria-label="更新" @click="loadTools" />
    </div>

    <v-text-field v-model="search" label="工具名・カテゴリ・保管場所を検索" prepend-inner-icon="mdi-magnify" clearable hide-details class="mb-4" />

    <v-row>
      <v-col v-for="tool in filteredTools" :key="tool.id" cols="12" md="6" lg="4">
        <v-card rounded="lg" variant="outlined" height="100%">
          <v-card-item>
            <template #title>{{ tool.name }}</template>
            <template #subtitle>{{ [tool.category, tool.location].filter(Boolean).join(' ・ ') || '分類・保管場所未設定' }}</template>
            <template #append>
              <v-chip size="small" :color="tool.available_quantity ? 'success' : 'warning'" variant="tonal">
                {{ tool.available_quantity }} / {{ tool.quantity }} 個
              </v-chip>
            </template>
          </v-card-item>
          <v-card-text class="pt-0">
            <p v-if="tool.description" class="text-body-2 text-medium-emphasis">{{ tool.description }}</p>
            <div class="d-flex ga-2 mb-3">
              <v-chip size="small" color="success" variant="tonal">返却済み {{ tool.available_quantity }}</v-chip>
              <v-chip size="small" color="warning" variant="tonal">貸出中 {{ tool.quantity - tool.available_quantity }}</v-chip>
            </div>
            <v-expansion-panels variant="accordion">
              <v-expansion-panel>
                <v-expansion-panel-title @click="loadItems(tool)">
                  個体・管理番号を確認
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div v-if="itemLoadingId === tool.id" class="text-center py-3"><v-progress-circular indeterminate size="24" /></div>
                  <div v-else-if="itemsByTool[tool.id]?.length" class="d-flex flex-wrap ga-2">
                    <v-chip v-for="item in itemsByTool[tool.id]" :key="item.id" size="small" :color="item.status === 'available' ? 'success' : item.status === 'borrowed' ? 'warning' : 'grey'" variant="tonal">
                      ID:{{ item.id }} · {{ item.management_number }} · {{ statusLabel(item.status) }}
                    </v-chip>
                  </div>
                  <div v-else class="text-body-2 text-medium-emphasis">個体情報がありません。</div>
                  <v-divider class="my-3" />
                  <div v-if="canManage" class="d-flex ga-2 align-start">
                    <v-text-field v-model="newNumbers[tool.id]" label="管理番号を追加" placeholder="例：38R-001" density="compact" hide-details />
                    <v-btn color="primary" :loading="addingToolId === tool.id" :disabled="!newNumbers[tool.id]?.trim()" @click="addItem(tool)">追加</v-btn>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
          <v-card-actions v-if="canManage">
            <v-btn variant="text" prepend-icon="mdi-pencil" @click="openEdit(tool)">基本情報を編集</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-alert v-if="!loading && filteredTools.length === 0" type="info" variant="tonal">該当する工具・機材はありません。</v-alert>

    <v-dialog v-model="dialog" max-width="560">
      <v-card>
        <v-card-title>{{ editingTool ? '工具情報を編集' : '工具を登録' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="工具・機材名" autofocus />
          <v-text-field v-model="form.category" label="カテゴリ" />
          <v-text-field v-model="form.location" label="保管場所" />
          <v-textarea v-model="form.description" label="説明" rows="2" />
          <v-divider class="my-3" />
          <div class="text-subtitle-2 mb-2">個体の管理番号</div>
          <v-textarea v-if="!editingTool" v-model="form.managementNumbers" label="管理番号（1行に1つ）" placeholder="38R-001&#10;38R-002" rows="4" hint="工具1個につき管理番号を1つ登録します。" persistent-hint />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="dialog = false">キャンセル</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!form.name.trim() || (!editingTool && !form.managementNumbers.trim())" @click="saveTool">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3500">{{ snackbarText }}</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import type { Tool, ToolItem } from '~/types/tool-rental'

definePageMeta({ middleware: 'auth' })

const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission('tool_rental.manage'))
const { request } = useToolRentalApi()
const tools = ref<Tool[]>([])
const itemsByTool = ref<Record<number, ToolItem[]>>({})
const newNumbers = ref<Record<number, string>>({})
const search = ref('')
const loading = ref(false)
const itemLoadingId = ref<number | null>(null)
const addingToolId = ref<number | null>(null)
const dialog = ref(false)
const saving = ref(false)
const editingTool = ref<Tool | null>(null)
const form = reactive({ name: '', category: '', location: '', description: '', managementNumbers: '' })
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const filteredTools = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return tools.value
  return tools.value.filter(tool => {
    const base = [tool.name, tool.category, tool.location, tool.description].join(' ').toLowerCase()
    const itemMatch = (itemsByTool.value[tool.id] ?? []).some(item => item.management_number.toLowerCase().includes(query))
    return base.includes(query) || itemMatch
  })
})

const statusLabel = (status: string) => status === 'available' ? '返却済み' : status === 'borrowed' ? '貸出中' : '使用停止'

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
    showMessage('工具・機材一覧を取得できませんでした。', 'error')
  } finally {
    loading.value = false
  }
}

const loadItems = async (tool: Tool) => {
  if (itemsByTool.value[tool.id]) return
  itemLoadingId.value = tool.id
  try {
    itemsByTool.value[tool.id] = await request<ToolItem[]>(`/tools/${tool.id}/items`)
  } catch (error) {
    console.error(error)
    showMessage('個体情報を取得できませんでした。', 'error')
  } finally {
    itemLoadingId.value = null
  }
}

const resetForm = () => {
  form.name = ''
  form.category = ''
  form.location = ''
  form.description = ''
  form.managementNumbers = ''
}

const openCreate = () => {
  editingTool.value = null
  resetForm()
  dialog.value = true
}

const openEdit = (tool: Tool) => {
  editingTool.value = tool
  form.name = tool.name
  form.category = tool.category ?? ''
  form.location = tool.location ?? ''
  form.description = tool.description ?? ''
  form.managementNumbers = ''
  dialog.value = true
}

const saveTool = async () => {
  if (!canManage.value || !form.name.trim()) return
  saving.value = true
  try {
    if (editingTool.value) {
      await request(`/tools/${editingTool.value.id}`, {
        method: 'PATCH',
        body: { name: form.name, category: form.category, location: form.location, description: form.description },
      })
      showMessage('工具情報を更新しました。')
    } else {
      const managementNumbers = form.managementNumbers.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
      if (!managementNumbers.length) return
      await request('/tools', {
        method: 'POST',
        body: {
          name: form.name,
          category: form.category,
          location: form.location,
          description: form.description,
          tool_items: managementNumbers.map(management_number => ({ management_number })),
        },
      })
      showMessage('工具と個体を登録しました。')
    }
    dialog.value = false
    await loadTools()
  } catch (error: any) {
    showMessage(error?.data?.detail || '保存に失敗しました。', 'error')
  } finally {
    saving.value = false
  }
}

const addItem = async (tool: Tool) => {
  const managementNumber = newNumbers.value[tool.id]?.trim()
  if (!canManage.value || !managementNumber) return
  addingToolId.value = tool.id
  try {
    await request(`/tools/${tool.id}/items`, {
      method: 'POST',
      body: { management_numbers: [managementNumber] },
    })
    newNumbers.value[tool.id] = ''
    delete itemsByTool.value[tool.id]
    await loadItems(tool)
    await loadTools()
    showMessage('個体を追加しました。')
  } catch (error: any) {
    showMessage(error?.data?.detail || '個体の追加に失敗しました。', 'error')
  } finally {
    addingToolId.value = null
  }
}

onMounted(loadTools)
</script>

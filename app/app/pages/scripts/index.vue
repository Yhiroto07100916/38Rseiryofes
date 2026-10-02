<template>
  <v-container class="py-6" max-width="1100">
    <div class="d-flex align-center mb-6">
      <BackButton />
      <div class="ml-2">
        <div class="text-h5 font-weight-bold">台本管理</div>
        <div class="text-body-2 text-medium-emphasis">クラス劇の台本を管理します</div>
      </div>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        rounded="lg"
        @click="createDialog = true"
      >
        新しい台本
      </v-btn>
    </div>

    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ errorMessage }}
    </v-alert>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-row v-else-if="scripts.length">
      <v-col
        v-for="script in scripts"
        :key="script.id"
        cols="12"
        sm="6"
        lg="4"
      >
        <v-card
          class="script-card h-100"
          rounded="xl"
          border
          @click="openScript(script.id)"
        >
          <v-card-item>
            <template #prepend>
              <v-avatar color="primary" variant="tonal" rounded="lg">
                <v-icon icon="mdi-script-text-outline" />
              </v-avatar>
            </template>

            <v-card-title>{{ script.title }}</v-card-title>
            <v-card-subtitle>
              {{ formatDate(script.updated_at) }}
            </v-card-subtitle>
          </v-card-item>

          <v-card-text class="text-body-2 text-medium-emphasis">
            {{ script.description || '説明はありません' }}
          </v-card-text>

          <v-card-actions>
            <v-btn
              variant="text"
              color="primary"
              append-icon="mdi-chevron-right"
              @click.stop="openScript(script.id)"
            >
              開く
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-card
      v-else
      rounded="xl"
      border
      class="pa-8 text-center"
    >
      <v-icon
        icon="mdi-script-text-outline"
        size="56"
        color="primary"
        class="mb-4"
      />
      <div class="text-h6 font-weight-bold mb-2">台本はまだありません</div>
      <div class="text-body-2 text-medium-emphasis mb-5">
        最初の台本を作成しましょう。
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        rounded="lg"
        @click="createDialog = true"
      >
        台本を作成
      </v-btn>
    </v-card>

    <v-dialog v-model="createDialog" max-width="520">
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-2">新しい台本</v-card-title>

        <v-card-text class="pa-6">
          <v-text-field
            v-model="newScript.title"
            label="台本タイトル"
            placeholder="例：38Rクラス劇"
            variant="outlined"
            autofocus
            class="mb-3"
          />

          <v-textarea
            v-model="newScript.description"
            label="説明"
            placeholder="台本についての説明"
            variant="outlined"
            rows="3"
            hide-details
          />
        </v-card-text>

        <v-card-actions class="px-6 pb-6">
          <v-spacer />
          <v-btn variant="text" @click="createDialog = false">キャンセル</v-btn>
          <v-btn
            color="primary"
            :loading="creating"
            :disabled="!newScript.title.trim()"
            @click="createScript"
          >
            作成する
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

definePageMeta({
  middleware: ['auth'],
})

interface Script {
  id: string
  title: string
  description: string | null
  created_at: string
  updated_at: string
}

const scripts = ref<Script[]>([])
const loading = ref(true)
const creating = ref(false)
const createDialog = ref(false)
const errorMessage = ref('')

const newScript = reactive({
  title: '',
  description: '',
})

const loadScripts = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await apiFetch<{ scripts: Script[] }>('/api/scripts')
    scripts.value = response.scripts
  } catch (error) {
    console.error(error)
    errorMessage.value = '台本一覧を取得できませんでした。'
  } finally {
    loading.value = false
  }
}

const createScript = async () => {
  if (!newScript.title.trim()) return

  creating.value = true
  errorMessage.value = ''

  try {
    const response = await apiFetch<{ script: Script }>('/api/scripts', {
      method: 'POST',
      body: {
        title: newScript.title.trim(),
        description: newScript.description.trim() || null,
      },
    })

    createDialog.value = false
    newScript.title = ''
    newScript.description = ''

    await navigateTo(`/scripts/${response.script.id}`)
  } catch (error) {
    console.error(error)
    errorMessage.value = '台本を作成できませんでした。'
  } finally {
    creating.value = false
  }
}

const openScript = (id: string) => {
  navigateTo(`/scripts/${id}`)
}

const formatDate = (value: string) => {
  if (!value) return ''
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  })
}

onMounted(loadScripts)
</script>

<style scoped>
.script-card {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.script-card:hover {
  transform: translateY(-2px);
}
</style>

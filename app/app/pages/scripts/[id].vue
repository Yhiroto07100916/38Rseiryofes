<template>
    <div class="script-editor">
      <header class="editor-header">
        <div class="header-left">
          <v-btn
            icon="mdi-arrow-left"
            variant="text"
            aria-label="戻る"
            @click="navigateTo('/scripts')"
          />
  
          <div class="header-title">
            <div class="title-row">
              <input
                v-model="script.title"
                class="title-input"
                aria-label="台本タイトル"
                @input="markScriptMetaDirty"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              />
  
              <v-btn
                size="small"
                color="primary"
                variant="flat"
                prepend-icon="mdi-content-save-outline"
                :loading="saving"
                :disabled="!hasUnsavedChanges"
                @click="saveAllChanges"
              >
                保存
              </v-btn>

              <v-chip
                size="small"
                :color="hasUnsavedChanges ? 'warning' : 'success'"
                variant="tonal"
              >
                <v-icon
                  start
                  :icon="
                    hasUnsavedChanges
                      ? 'mdi-circle-edit-outline'
                      : 'mdi-check-circle-outline'
                  "
                />
                {{ hasUnsavedChanges ? '未保存' : '保存済み' }}
              </v-chip>
            </div>
            <div class="scene-label">
              {{ currentAct?.title || '幕未選択' }}
              <span v-if="currentScene">・{{ currentScene.title }}</span>
            </div>
          </div>
        </div>
  
        <div class="header-actions">
          <v-btn
            icon="mdi-account-group-outline"
            variant="text"
            aria-label="登場人物"
            @click="charactersDrawer = !charactersDrawer"
          />
          <v-btn
            icon="mdi-menu"
            variant="text"
            aria-label="構成"
            @click="outlineDrawer = !outlineDrawer"
          />
        </div>
      </header>
  
      <div class="editor-body">
        <aside v-if="outlineDrawer" class="outline-panel">
          <div class="panel-header">
            <span>構成</span>
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              @click="outlineDrawer = false"
            />
          </div>
  
          <div class="outline-content">
            <div
              v-for="act in acts"
              :key="act.id"
              class="act-group"
            >
              <div class="act-title">
                <span
                  class="act-title-text"
                  @dblclick="openEditActDialog(act)"
                >
                  {{ act.title }}
                </span>

                <div class="outline-actions">
                  <v-btn
                    icon="mdi-plus"
                    variant="text"
                    size="x-small"
                    aria-label="場を追加"
                    @click="openCreateSceneDialog(act)"
                  />
                  <v-btn
                    icon="mdi-pencil-outline"
                    variant="text"
                    size="x-small"
                    aria-label="幕を編集"
                    @click="openEditActDialog(act)"
                  />
                  <v-btn
                    icon="mdi-delete-outline"
                    variant="text"
                    size="x-small"
                    color="error"
                    aria-label="幕を削除"
                    @click="deleteAct(act)"
                  />
                </div>
              </div>

              <div
                v-for="scene in act.scenes || []"
                :key="scene.id"
                class="scene-item-row"
              >
                <button
                  class="scene-item"
                  :class="{ active: scene.id === currentScene?.id }"
                  @click="selectScene(act, scene)"
                >
                  {{ scene.title }}
                </button>

                <div class="scene-actions">
                  <v-btn
                    icon="mdi-pencil-outline"
                    variant="text"
                    size="x-small"
                    aria-label="場を編集"
                    @click="openEditSceneDialog(act, scene)"
                  />
                  <v-btn
                    icon="mdi-delete-outline"
                    variant="text"
                    size="x-small"
                    color="error"
                    aria-label="場を削除"
                    @click="deleteScene(act, scene)"
                  />
                </div>
              </div>
            </div>

            <v-btn
              block
              variant="tonal"
              prepend-icon="mdi-plus"
              class="mt-3"
              @click="openCreateActDialog"
            >
              幕を追加
            </v-btn>
          </div>
        </aside>
  
        <main class="script-main">
          <div v-if="loading" class="loading-area">
            <v-progress-circular indeterminate color="primary" />
          </div>
  
          <template v-else-if="currentScene">
            <div class="script-toolbar">
              <div>
                <div class="toolbar-title">{{ currentScene.title }}</div>
                <div class="toolbar-subtitle">
                  ブロック {{ currentScene.blocks?.length || 0 }} 個
                </div>
              </div>
  
              <div class="toolbar-actions">
                <v-btn
                  variant="outlined"
                  prepend-icon="mdi-account-group-outline"
                  @click="openSceneCharacterDialog"
                >
                  登場人物
                </v-btn>

                <v-btn
                  variant="outlined"
                  prepend-icon="mdi-file-pdf-box"
                  @click="openPrintDialog"
                >
                  PDF出力
                </v-btn>
              </div>
          <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    color="primary"
                    prepend-icon="mdi-plus"
                    rounded="lg"
                  >
                    追加
                  </v-btn>
                </template>
  
                <v-list rounded="lg">
                  <v-list-item
                    prepend-icon="mdi-account-voice"
                    title="台詞"
                    @click="addBlock('dialogue')"
                  />
                  <v-list-item
                    prepend-icon="mdi-script-text-outline"
                    title="ト書き"
                    @click="addBlock('direction')"
                  />
                  <v-list-item
                    prepend-icon="mdi-volume-high"
                    title="音響"
                    @click="addBlock('sound')"
                  />
                  <v-list-item
                    prepend-icon="mdi-lightbulb-outline"
                    title="照明"
                    @click="addBlock('lighting')"
                  />
                </v-list>
              </v-menu>
            </div>
  
            <div
              ref="canvasRef"
              class="script-canvas"
              @click.self="focusLastBlock"
            >
              <div class="script-paper">
                <div
                  v-for="block in currentScene.blocks || []"
                  :key="block.id"
                  class="script-block"
                  :class="`block-${block.type}`"
                  @dragover.prevent="handleBlockDragOver(block)"
                  @drop.prevent="handleBlockDrop(block)"
                >
                  <button
                    class="block-drag-handle"
                    type="button"
                    aria-label="ブロックを並び替え"
                    draggable="true"
                    @dragstart="handleBlockDragStart(block, $event)"
                    @mousedown.stop
                  >
                    <v-icon icon="mdi-drag-vertical" size="18" />
                  </button>

                  <div class="block-label">
                    <v-icon :icon="blockIcon(block.type)" size="15" />
                    <span>{{ blockLabel(block.type) }}</span>
                  </div>
  
                  <template v-if="block.type === 'dialogue'">
                    <button
                      class="character-button"
                      @click="openCharacterMenu(block.id)"
                    >
                      {{ block.character_name || 'キャラクターを選択' }}
                      <v-icon icon="mdi-chevron-down" size="14" />
                    </button>
                  </template>
  
                  <textarea
                    :ref="(element) => setBlockRef(block.id, element)"
                    :value="block.content"
                    class="block-textarea"
                    :placeholder="blockPlaceholder(block.type)"
                    @input="onBlockInput(block, $event)"
                    @keydown.enter="handleBlockEnter(block, $event)"
                  />
  
                  <button
                    class="block-duplicate"
                    aria-label="ブロックを複製"
                    @click="duplicateBlock(block)"
                  >
                    <v-icon icon="mdi-content-copy" size="15" />
                  </button>

                  <button
                    class="block-delete"
                    aria-label="ブロックを削除"
                    @click="deleteBlock(block)"
                  >
                    <v-icon icon="mdi-close" size="16" />
                  </button>
                </div>
  
                <button
                  v-if="!(currentScene.blocks || []).length"
                  class="empty-script"
                  @click="addBlock('dialogue')"
                >
                  <v-icon icon="mdi-plus-circle-outline" size="32" />
                  <span>ここから台本を書き始める</span>
                </button>
  
                <button
                  v-else
                  class="add-block-inline"
                  @click="addBlock('dialogue')"
                >
                  <v-icon icon="mdi-plus" />
                </button>
              </div>
            </div>
          </template>
  
          <div v-else class="empty-editor">
            <v-icon icon="mdi-script-text-outline" size="64" color="primary" />
            <div class="text-h6 mt-4">場を選択してください</div>
          </div>
        </main>
  
        <aside v-if="charactersDrawer" class="characters-panel">
          <div class="panel-header">
            <span>登場人物</span>
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              @click="charactersDrawer = false"
            />
          </div>

          <div class="characters-content">
            <div
              v-for="character in characters"
              :key="character.id"
              class="character-card"
            >
              <div class="character-card-header">
                <div class="character-name">{{ character.name }}</div>

                <v-btn
                  icon="mdi-pencil-outline"
                  variant="text"
                  size="x-small"
                  aria-label="キャラクターを編集"
                  @click="openCharacterEditDialog(character)"
                />
              </div>

              <div
                v-if="character.description"
                class="character-description"
              >
                {{ character.description }}
              </div>

              <div class="cast-section-title">
                配役
              </div>

              <div
                v-if="character.casts?.length"
                class="cast-list"
              >
                <div
                  v-for="cast in character.casts"
                  :key="cast.id"
                  class="cast-row"
                >
                  <span class="cast-name">
                    {{ cast.user_name || cast.name || cast.user_nickname || cast.nickname || '配役あり' }}
                  </span>

                  <span
                    v-if="cast.student_number"
                    class="cast-student-number"
                  >
                    {{ cast.student_number }}
                  </span>

                  <v-btn
                    icon="mdi-close"
                    variant="text"
                    size="x-small"
                    aria-label="配役を削除"
                    @click="removeCast(character, cast)"
                  />
                </div>
              </div>

              <div
                v-else
                class="text-caption text-medium-emphasis"
              >
                配役未設定
              </div>

              <v-btn
                size="small"
                variant="text"
                color="primary"
                prepend-icon="mdi-account-plus-outline"
                class="cast-add-button"
                @click="openCastDialog(character)"
              >
                配役を追加
              </v-btn>
            </div>

            <v-btn
              block
              variant="tonal"
              prepend-icon="mdi-account-plus-outline"
              class="mt-3"
              @click="characterCreateName = ''; characterCreateDialog = true"
            >
              登場人物を追加
            </v-btn>
          </div>
        </aside>
      </div>
  
      <v-dialog v-model="characterCreateDialog" max-width="420">
        <v-card rounded="xl">
          <v-card-title class="pa-6 pb-2">
            登場人物を追加
          </v-card-title>

          <v-card-text class="pa-4">
            <v-text-field
              v-model="characterCreateName"
              label="キャラクター名"
              variant="outlined"
              density="comfortable"
              autofocus
              @keyup.enter="addCharacter"
            />
          </v-card-text>

          <v-card-actions class="px-4 pb-4">
            <v-spacer />

            <v-btn
              variant="text"
              @click="characterCreateDialog = false"
            >
              キャンセル
            </v-btn>

            <v-btn
              color="primary"
              variant="flat"
              :loading="characterCreating"
              :disabled="!characterCreateName.trim()"
              @click="addCharacter"
            >
              追加
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="sceneCharacterDialog" max-width="520">
        <v-card rounded="xl">
          <v-card-title class="pa-6 pb-2">
            場の登場人物
          </v-card-title>

          <v-card-text class="pa-4">
            <div class="text-body-2 mb-3">
              {{ currentScene?.title }}
            </div>

            <v-list>
              <v-list-item
                v-for="character in characters"
                :key="character.id"
                :title="character.name"
                :subtitle="character.description || undefined"
                rounded="lg"
                @click="toggleSceneCharacter(character)"
              >
                <template #prepend>
                  <v-checkbox-btn
                    :model-value="sceneCharacterIds.has(character.id)"
                    :disabled="sceneCharacterSaving"
                  />
                </template>
              </v-list-item>
            </v-list>

            <div
              v-if="!characters.length"
              class="text-body-2 text-medium-emphasis py-4 text-center"
            >
              先に登場人物を追加してください。
            </div>
          </v-card-text>

          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn
              variant="text"
              @click="sceneCharacterDialog = false"
            >
              閉じる
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="characterDialog" max-width="420">
        <v-card rounded="xl">
          <v-card-title class="pa-6 pb-2">キャラクターを選択</v-card-title>

          <v-card-text class="pa-4">
            <v-list>
              <v-list-item
                v-for="character in sceneCharacters"
                :key="character.id"
                :title="character.name"
                prepend-icon="mdi-account-outline"
                rounded="lg"
                @click="selectCharacter(character.id)"
              />
            </v-list>
          </v-card-text>
        </v-card>
      </v-dialog>

      <v-dialog v-model="characterEditDialog" max-width="520">
        <v-card rounded="xl">
          <v-card-title class="pa-6 pb-2">
            キャラクターを編集
          </v-card-title>

          <v-card-text class="pa-4">
            <v-text-field
              v-model="characterEditForm.name"
              label="キャラクター名"
              variant="outlined"
              density="comfortable"
              class="mb-3"
            />

            <v-textarea
              v-model="characterEditForm.description"
              label="説明"
              variant="outlined"
              density="comfortable"
              rows="3"
              auto-grow
            />
          </v-card-text>

          <v-card-actions class="px-4 pb-4">
            <v-btn
              color="error"
              variant="text"
              @click="deleteCharacter"
            >
              削除
            </v-btn>

            <v-spacer />

            <v-btn
              variant="text"
              @click="characterEditDialog = false"
            >
              キャンセル
            </v-btn>

            <v-btn
              color="primary"
              variant="flat"
              :loading="characterSaving"
              @click="saveCharacter"
            >
              保存
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="castDialog" max-width="520">
        <v-card rounded="xl">
          <v-card-title class="pa-6 pb-2">
            配役を追加
          </v-card-title>

          <v-card-text class="pa-4">
            <div class="text-body-2 mb-3">
              {{ castTargetCharacter?.name }}
            </div>

            <v-text-field
              v-model="castSearch"
              label="名前・出席番号で検索"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="comfortable"
              clearable
              class="mb-2"
            />

            <v-list
              v-if="filteredCastMembers.length"
              class="cast-member-list"
            >
              <v-list-item
                v-for="member in filteredCastMembers"
                :key="member.id"
                rounded="lg"
                :disabled="isCastAssigned(member.id)"
                @click="addCast(member)"
              >
                <template #prepend>
                  <v-avatar size="34">
                    <span class="text-caption">
                      {{ member.student_number }}
                    </span>
                  </v-avatar>
                </template>

                <v-list-item-title>
                  {{ member.name }}
                </v-list-item-title>

                <v-list-item-subtitle v-if="member.nickname">
                  {{ member.nickname }}
                </v-list-item-subtitle>

                <template #append>
                  <v-icon
                    v-if="isCastAssigned(member.id)"
                    icon="mdi-check"
                    size="18"
                  />
                </template>
              </v-list-item>
            </v-list>

            <div
              v-else
              class="text-body-2 text-medium-emphasis py-6 text-center"
            >
              該当するメンバーがいません
            </div>
          </v-card-text>

          <v-card-actions class="px-4 pb-4">
            <v-spacer />

            <v-btn
              variant="text"
              @click="castDialog = false"
            >
              閉じる
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
      <v-dialog v-model="outlineDialog" max-width="520">
        <v-card rounded="xl">
          <v-card-title class="pa-6 pb-2">
            {{
              outlineDialogMode === 'create-act'
                ? '幕を追加'
                : outlineDialogMode === 'edit-act'
                  ? '幕を編集'
                  : outlineDialogMode === 'create-scene'
                    ? '場を追加'
                    : '場を編集'
            }}
          </v-card-title>

          <v-card-text class="pa-4">
            <div
              v-if="
                outlineDialogMode === 'create-scene' ||
                outlineDialogMode === 'edit-scene'
              "
              class="text-body-2 mb-3"
            >
              {{ outlineDialogAct?.title }}
            </div>

            <v-text-field
              v-model="outlineDialogForm.title"
              label="名前"
              variant="outlined"
              density="comfortable"
              autofocus
              class="mb-3"
              @keyup.enter="saveOutlineDialog"
            />

            <v-textarea
              v-model="outlineDialogForm.description"
              label="説明"
              variant="outlined"
              density="comfortable"
              rows="3"
              auto-grow
            />
          </v-card-text>

          <v-card-actions class="px-4 pb-4">
            <v-spacer />

            <v-btn
              variant="text"
              @click="outlineDialog = false"
            >
              キャンセル
            </v-btn>

            <v-btn
              color="primary"
              variant="flat"
              :loading="outlineDialogSaving"
              :disabled="!outlineDialogForm.title.trim()"
              @click="saveOutlineDialog"
            >
              保存
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="printDialog" max-width="520">
      <v-card rounded="xl">
        <v-card-title class="text-h6">
          台本を印刷・PDF出力
        </v-card-title>

        <v-card-text>
          <div class="text-subtitle-2 mb-3">
            用紙の向きを選択してください
          </div>

          <v-radio-group v-model="printOrientation">
            <v-radio
              label="A4 縦"
              value="portrait"
            />
            <v-radio
              label="A4 横"
              value="landscape"
            />
          </v-radio-group>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="printDialog = false"
          >
            キャンセル
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-printer"
            @click="printScript"
          >
            印刷 / PDF保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
</template>
  
  <script setup lang="ts">
  const { apiFetch } = useApi()
  const { confirm } = useConfirmDialog()
  const snackbar = useSnackbar()

definePageMeta({
    middleware: ['auth'],
    layout: false,
  })
  
  type BlockType = 'dialogue' | 'direction' | 'sound' | 'lighting'
  
  interface Script {
    id: string
    title: string
    description: string | null
  }
  
  interface Cast {
    id: string
    user_id: string
    student_number?: string | null
    name?: string | null
    nickname?: string | null
    user_name?: string | null
    user_nickname?: string | null
    cast_order: number
  }

  interface CastMember {
    id: string
    student_number: string
    name: string
    nickname: string | null
  }
  
  interface Character {
    id: string
    name: string
    description: string | null
    casts?: Cast[]
  }
  
  interface Block {
    id: string
    scene_id: string
    type: BlockType
    character_id: string | null
    character_name: string | null
    content: string
    sort_order: number
  }
  
  interface Scene {
    id: string
    act_id: string
    title: string
    description: string | null
    sort_order: number
    characters?: Array<{
      character_id: string
      character_name: string
    }>
    blocks?: Block[]
  }
  
  interface Act {
    id: string
    script_id: string
    title: string
    description: string | null
    sort_order: number
    scenes?: Scene[]
  }
  
  const route = useRoute()
  const scriptId = computed(() => String(route.params.id))
  
  const script = reactive<Script>({
    id: '',
    title: '',
    description: null,
  })
  
  const acts = ref<Act[]>([])
  const characters = ref<Character[]>([])
  const currentScene = ref<Scene | null>(null)
  const currentAct = ref<Act | null>(null)
  
  const loading = ref(true)
  const saving = ref(false)
  const savingCount = ref(0)

  const startSaving = () => {
    savingCount.value += 1
    saving.value = true
  }

  const endSaving = () => {
    savingCount.value = Math.max(0, savingCount.value - 1)
    saving.value = savingCount.value > 0
  }
  const outlineDrawer = ref(true)
  const charactersDrawer = ref(false)
  const characterDialog = ref(false)
  const sceneCharacterDialog = ref(false)
  const sceneCharacterSaving = ref(false)
  const characterCreateDialog = ref(false)
  const characterCreating = ref(false)
  const characterCreateName = ref('')
  const characterEditDialog = ref(false)
  const characterSaving = ref(false)
  const castDialog = ref(false)
  const castMembers = ref<CastMember[]>([])
  const castSearch = ref('')
  const castTargetCharacter = ref<Character | null>(null)
  const characterEditTarget = ref<Character | null>(null)
  const characterEditForm = reactive({
    name: '',
    description: '',
  })
  const printDialog = ref(false)
const printOrientation = ref<'portrait' | 'landscape'>('portrait')
  const selectedBlockId = ref<string | null>(null)
  const pendingBlockType = ref<BlockType | null>(null)
  const pendingAfterBlock = ref<Block | null>(null)
  
  const canvasRef = ref<HTMLElement | null>(null)
  const blockRefs = new Map<string, HTMLTextAreaElement>()
  const draggingBlockId = ref<string | null>(null)
  
  const setBlockRef = (
    id: string,
    element: Element | ComponentPublicInstance | null,
  ) => {
    if (element instanceof HTMLTextAreaElement) {
      blockRefs.set(id, element)
    }
  }
  
  const loadScript = async () => {
    loading.value = true
  
    try {
      const response = await apiFetch<{
        script: Script
        acts: Act[]
        characters: Character[]
      }>(`/api/scripts/${scriptId.value}`)
  
      Object.assign(script, response.script)
      acts.value = response.acts
      characters.value = response.characters
  
      for (const act of acts.value) {
        const scenes: Scene[] = []
  
        for (const scene of act.scenes || []) {
          const detail = await apiFetch<{
            scene: Scene
            characters: Scene["characters"]
            blocks: Block[]
          }>(
            `/api/scripts/${scriptId.value}/acts/${act.id}/scenes/${scene.id}`,
          )
          scenes.push({
            ...detail.scene,
            characters: detail.characters,
            blocks: detail.blocks,
          })
        }
  
        act.scenes = scenes
      }
  
      const firstAct = acts.value[0]
      const firstScene = firstAct?.scenes?.[0]
  
      if (firstAct && firstScene) {
        currentAct.value = firstAct
        currentScene.value = firstScene
      }
    } catch (error) {
      console.error(error)
    } finally {
      loading.value = false
    }
  }
  
  const selectScene = (act: Act, scene: Scene) => {
    currentAct.value = act
    currentScene.value = scene
  }

  const sceneCharacterIds = computed(() => {
    return new Set(
      (currentScene.value?.characters || []).map(
        (character) => character.character_id,
      ),
    )
  })

  const sceneCharacters = computed(() => {
    return characters.value.filter((character) =>
      sceneCharacterIds.value.has(character.id),
    )
  })

  const loadSceneCharacters = async () => {
    if (!currentAct.value || !currentScene.value) return

    const response = await apiFetch<{
      characters: Scene["characters"]
    }>(
      `/api/scripts/${scriptId.value}/acts/${currentAct.value.id}/scenes/${currentScene.value.id}/characters`,
    )

    currentScene.value.characters = response.characters || []
  }

  const openSceneCharacterDialog = async () => {
    if (!currentAct.value || !currentScene.value) return

    try {
      await loadSceneCharacters()
      sceneCharacterDialog.value = true
    } catch (error) {
      console.error('場面登場人物の取得エラー:', error)
      snackbar.error('場面登場人物の取得に失敗しました。')
    }
  }

  const toggleSceneCharacter = async (character: Character) => {
    if (!currentAct.value || !currentScene.value || sceneCharacterSaving.value) {
      return
    }

    const scene = currentScene.value
    const exists = (scene.characters || []).some(
      (item) => item.character_id === character.id,
    )

    sceneCharacterSaving.value = true

    try {
      if (exists) {
        await apiFetch(
          `/api/scripts/${scriptId.value}/acts/${currentAct.value.id}/scenes/${scene.id}/characters/${character.id}`,
          {
            method: 'DELETE',
          },
        )

        scene.characters = (scene.characters || []).filter(
          (item) => item.character_id !== character.id,
        )
      } else {
        const response = await apiFetch<{
          character: {
            scene_id: string
            character_id: string
            character_name: string
          }
        }>(
          `/api/scripts/${scriptId.value}/acts/${currentAct.value.id}/scenes/${scene.id}/characters`,
          {
            method: 'POST',
            body: {
              character_id: character.id,
            },
          },
        )

        if (!scene.characters) {
          scene.characters = []
        }

        scene.characters.push({
          character_id: response.character.character_id,
          character_name: response.character.character_name,
        })
      }
    } catch (error) {
      console.error('場面登場人物の更新エラー:', error)
      snackbar.error('場面登場人物の更新に失敗しました。')
    } finally {
      sceneCharacterSaving.value = false
    }
  }
  
  const openPrintDialog = () => {
    printDialog.value = true
  }

  const escapeHtml = (value: string | null | undefined) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  /*
   * PDF用の縦書き文字分割
   *
   * A4縦:
   *   1列あたり約46文字
   *
   * A4横:
   *   縦方向が短くなるため約31文字
   */
  const splitVerticalText = (
    value: string,
    maxCharacters: number,
  ) => {
    const normalized = String(value ?? '')
      .replaceAll(String.fromCharCode(13, 10), String.fromCharCode(10))
      .replaceAll(String.fromCharCode(13), String.fromCharCode(10))

    if (!normalized) return []

    const result: string[] = []

    for (const line of normalized.split(String.fromCharCode(10))) {
      if (!line) {
        result.push('')
        continue
      }

      for (let i = 0; i < line.length; i += maxCharacters) {
        result.push(line.slice(i, i + maxCharacters))
      }
    }

    return result
  }

  const getPrintMaxCharacters = () => {
    return printOrientation.value === 'portrait' ? 46 : 31
  }

  const getPrintColumnsPerPage = () => {
    /*
     * 右端に「第一幕・第一場」の場面欄を1列確保。
     *
     * A4縦:
     *   場面欄 + 本文10列程度
     *
     * A4横:
     *   場面欄 + 本文15列程度
     */
    return printOrientation.value === 'portrait' ? 10 : 15
  }

  const renderPrintScene = (
    act: Act,
    scene: Scene,
    pageNumber: number,
    blocks: Block[],
  ) => {
    const maxCharacters = getPrintMaxCharacters()

    const printColumns = blocks.flatMap((block) => {
      const chunks = splitVerticalText(
        block.content,
        maxCharacters,
      )

      return chunks.map((chunk, index) => ({
        block,
        chunk,
        isFirst: index === 0,
        isLast: index === chunks.length - 1,
      }))
    })

    /*
     * ヘッダーと本文で完全に同じ列構成を使う。
     *
     * これにより、
     * 「話者名の列」と「その話者の台詞の列」が
     * 横方向に正確に揃う。
     *
     * 台詞が複数列に分割された場合は、
     * 最初の列だけ話者名を表示する。
     */
    const headerColumns = printColumns
      .map(
        ({ block, isFirst }) => `
          <div class="print-header-character">
            <span class="print-header-character-text">
              ${
                block.type === 'dialogue' && isFirst
                  ? escapeHtml(
                      block.character_name?.trim() || '',
                    )
                  : ''
              }
            </span>
          </div>
        `,
      )
      .join('')

    /*
     * 本文。
     *
     * DOM上の列順とヘッダーの列順を完全に一致させる。
     */
    const bodyColumns = printColumns
      .map(({ block, chunk, isFirst, isLast }) => {
        const escapedChunk = escapeHtml(chunk)

        if (block.type === 'dialogue') {
          return `
            <div class="print-script-column print-dialogue-column">
              <span class="print-column-text">
                ${isFirst ? '「' : ''}${escapedChunk}${isLast ? '」' : ''}
              </span>
            </div>
          `
        }

        const className =
          block.type === 'direction'
            ? 'print-direction-column'
            : block.type === 'sound'
              ? 'print-sound-column'
              : 'print-lighting-column'

        return `
          <div class="print-script-column ${className}">
            <span class="print-column-text">
              ${escapedChunk}
            </span>
          </div>
        `
      })
      .join('')

    return `
      <section class="print-page">
        <div class="print-top-rule"></div>

        <div class="print-character-area">
          <div class="print-character-spacer"></div>
          ${headerColumns}
        </div>

        <div class="print-scene-rule"></div>

        <div class="print-body">
          <div class="print-scene-label">
            <span class="print-act-label">
              ${escapeHtml(act.title)}
            </span>

            <span class="print-scene-title">
              ${escapeHtml(scene.title)}
            </span>

            ${
              scene.description
                ? `
                  <span class="print-scene-description">
                    ${escapeHtml(scene.description)}
                  </span>
                `
                : ''
            }
          </div>

          ${bodyColumns}
        </div>

        <div class="print-bottom-rule"></div>

        <div class="print-footer">
          <span>${escapeHtml(script.title)}</span>
          <span class="print-page-number">${pageNumber}</span>
        </div>
      </section>
    `
  }

  const printScript = () => {
    const scenes = acts.value
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((act) =>
        (act.scenes || [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((scene) => ({ act, scene })),
      )

    if (!scenes.length) {
      printDialog.value = false
      return
    }

    const orientation = printOrientation.value
    const maxCharacters = getPrintMaxCharacters()
    const columnsPerPage = getPrintColumnsPerPage()

    const pages: string[] = []
    let pageNumber = 1

    for (const { act, scene } of scenes) {
      const blocks = (scene.blocks || [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)

      /*
       * 1ブロックが何本の縦列になるかを計算。
       */
      const getBlockColumnCount = (block: Block) => {
        const chunks = splitVerticalText(
          block.content,
          maxCharacters,
        )

        return Math.max(chunks.length, 1)
      }

      /*
       * 空の場でも1ページ作る。
       */
      if (!blocks.length) {
        pages.push(
          renderPrintScene(
            act,
            scene,
            pageNumber++,
            [],
          ),
        )

        continue
      }

      let currentBlocks: Block[] = []
      let currentColumnCount = 0

      for (const block of blocks) {
        const blockColumnCount =
          getBlockColumnCount(block)

        /*
         * 1ページに収まらなくなったらページを確定。
         */
        if (
          currentBlocks.length > 0 &&
          currentColumnCount + blockColumnCount >
            columnsPerPage
        ) {
          pages.push(
            renderPrintScene(
              act,
              scene,
              pageNumber++,
              currentBlocks,
            ),
          )

          currentBlocks = []
          currentColumnCount = 0
        }

        currentBlocks.push(block)
        currentColumnCount += blockColumnCount
      }

      if (currentBlocks.length) {
        pages.push(
          renderPrintScene(
            act,
            scene,
            pageNumber++,
            currentBlocks,
          ),
        )
      }
    }

    const printWindow = window.open(
      '',
      '_blank',
      'width=1200,height=900',
    )

    if (!printWindow) {
      window.alert(
        '印刷画面を開けませんでした。ブラウザのポップアップを許可してください。',
      )

      printDialog.value = false
      return
    }

    const pageWidth =
      orientation === 'portrait'
        ? '210mm'
        : '297mm'

    const pageHeight =
      orientation === 'portrait'
        ? '297mm'
        : '210mm'

    const horizontalPadding =
      orientation === 'portrait'
        ? '15mm'
        : '13mm'

    const verticalTopPadding = '9mm'
    const verticalBottomPadding = '11mm'

    printWindow.document.open()

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ja">
        <head>
          <meta charset="UTF-8">

          <title>
            ${escapeHtml(script.title)} - 台本
          </title>

          <style>
            @page {
              size: A4 ${orientation};
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #111;

              font-family:
                "Yu Mincho",
                "Hiragino Mincho ProN",
                "Hiragino Mincho Pro",
                "Noto Serif JP",
                serif;

              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              width: ${pageWidth};
            }

            /*
             * A4そのものを1枚の紙として扱う。
             */
            .print-page {
              position: relative;

              width: ${pageWidth};
              height: ${pageHeight};

              padding:
                ${verticalTopPadding}
                ${horizontalPadding}
                ${verticalBottomPadding}
                ${horizontalPadding};

              overflow: hidden;

              background: #fff;

              page-break-after: always;
              break-after: page;
            }

            .print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            /*
             * ページ上端の線
             */
            .print-top-rule {
              width: 100%;
              height: 0;

              border-top: 1px solid #222;

              margin-bottom: 4mm;
            }

            /*
             * 登場人物欄
             *
             * 配役名は表示しない。
             *
             * 右 → 左に人物名を並べる。
             */
            .print-character-area {
              width: 100%;
              height: 25mm;

              display: flex;
              flex-direction: row;

              align-items: flex-start;
              justify-content: flex-start;

              gap: 4mm;

              overflow: hidden;

              direction: rtl;
            }

            /*
             * 本文の場面欄と同じ幅。
             *
             * これを先頭に置くことで、
             * ヘッダーの話者名と本文の台詞列を
             * 同じ横位置に揃える。
             */
            .print-character-spacer {
              flex: 0 0 18mm;

              width: 18mm;
              height: 23mm;

              padding: 0;
              margin: 0;
            }

            .print-header-character {
              flex: 0 0 13mm;

              width: 13mm;
              height: 23mm;

              position: relative;

              padding: 0;
              margin: 0;

              writing-mode: vertical-rl;
              text-orientation: mixed;

              font-size: 10pt;
              font-weight: 600;
              line-height: 1.25;

              white-space: nowrap;

              overflow: hidden;
            }

            .print-header-character-text {
              position: absolute;

              top: 0;
              right: 0;

              display: block;

              margin: 0;
              padding: 0;

              writing-mode: vertical-rl;
              text-orientation: mixed;

              white-space: nowrap;
            }


            .print-scene-rule {
              width: 100%;
              height: 0;

              border-top: 1px solid #222;

              margin-bottom: 5mm;
            }

            /*
             * 本文全体
             *
             * 場面欄を右端に固定し、
             * 台詞・ト書き・音響・照明を
             * 右 → 左へ並べる。
             */
            .print-body {
              width: 100%;

              height: calc(
                ${pageHeight} - 76mm
              );

              display: flex;
              flex-direction: row;

              align-items: flex-start;
              justify-content: flex-start;

              gap: 4mm;

              overflow: hidden;

              direction: rtl;
            }

            /*
             * 第一幕・第一場
             *
             * 常に本文の一番右側。
             */
            .print-scene-label {
              flex: 0 0 18mm;

              width: 18mm;
              height: 100%;

              position: relative;

              padding: 0;
              margin: 0;

              border-left: 1px solid #999;

              writing-mode: vertical-rl;
              text-orientation: mixed;

              font-weight: 700;

              white-space: normal;

              overflow: hidden;
            }

            .print-act-label {
              position: absolute;

              top: 0;
              right: 1mm;

              font-size: 9pt;
              line-height: 1.4;

              white-space: nowrap;
            }

            .print-scene-title {
              position: absolute;

              top: 0;
              right: 7mm;

              font-size: 13pt;
              line-height: 1.5;

              white-space: nowrap;
            }

            .print-scene-description {
              position: absolute;

              top: 0;
              right: 13mm;

              font-size: 8pt;
              line-height: 1.5;

              color: #555;
              font-weight: 400;

              white-space: nowrap;
            }


            /*
             * 1本の縦書き列。
             *
             * 高さを固定することで、
             * 長い文章はブラウザ側で
             * 縦方向に折り返される。
             */
            .print-script-column {
              flex: 0 0 13mm;

              width: 13mm;
              height: 100%;

              position: relative;

              padding: 0;
              margin: 0;

              writing-mode: vertical-rl;
              text-orientation: mixed;

              white-space: pre-wrap;

              overflow: hidden;

              word-break: break-all;

              font-size: 10.5pt;
              line-height: 1.25;

              align-self: flex-start;

              vertical-align: top;
            }

            /*
             * 台詞
             *
             * 台詞だけは必ず本文領域の上端から開始する。
             * absolute positioning により、
             * flex / writing-mode の影響で下へ移動するのを防ぐ。
             */
            .print-dialogue-column {
              color: #111;

              font-size: 10.5pt;
              font-weight: 500;

              line-height: 1.25;

              letter-spacing: 0.02em;

              text-align: start;

              align-self: flex-start;

              vertical-align: top;

              overflow: hidden;
            }

            .print-dialogue-column .print-column-text {
              position: absolute;

              top: 0;
              right: 0;

              display: block;

              width: 100%;
              height: auto;
              max-height: 100%;

              margin: 0;
              padding: 0;

              writing-mode: vertical-rl;
              text-orientation: mixed;

              white-space: pre-wrap;

              overflow: hidden;

              word-break: break-all;

              line-height: 1.25;

              vertical-align: top;
            }


            /*
             * ト書き
             */
            .print-direction-column {
              color: #555;

              font-size: 9pt;
              font-weight: 400;

              display: flex;
              align-items: center;
              justify-content: center;

              height: 100%;
            }

            /*
             * 音響
             */
            .print-sound-column {
              color: #009fe3;

              font-size: 9pt;
              font-weight: 700;

              display: flex;
              align-items: center;
              justify-content: center;

              height: 100%;
            }

            /*
             * 照明
             */
            .print-lighting-column {
              color: #f0a000;

              font-size: 9pt;
              font-weight: 700;

              display: flex;
              align-items: center;
              justify-content: center;

              height: 100%;
            }

            /*
             * ページ下部の線
             */
            .print-bottom-rule {
              position: absolute;

              left: ${horizontalPadding};
              right: ${horizontalPadding};
              bottom: 9mm;

              border-top: 1px solid #222;
            }

            /*
             * フッター
             */
            .print-footer {
              position: absolute;

              left: ${horizontalPadding};
              right: ${horizontalPadding};
              bottom: 3mm;

              display: flex;

              justify-content: center;
              align-items: center;

              font-size: 7.5pt;

              color: #333;
            }

            .print-page-number {
              margin-left: 5mm;
            }

            /*
             * 印刷時もA4サイズを維持。
             */
            @media print {
              html,
              body {
                width: auto;
                height: auto;
                margin: 0;
                padding: 0;
              }

              .print-page {
                width: ${pageWidth};
                height: ${pageHeight};
              }
            }
          </style>
        </head>

        <body>
          ${pages.join('')}
        </body>
      </html>
    `)

    printWindow.document.close()

    printDialog.value = false

    /*
     * フォント・レイアウトが確定してから印刷。
     */
    setTimeout(() => {
      try {
        printWindow.focus()
        printWindow.print()
      } catch (error) {
        console.error(
          '印刷ダイアログの起動に失敗しました',
          error,
        )
      }
    }, 700)
  }

  const scriptMetaDirty = ref(false)
  const dirtyBlockIds = ref(new Set<string>())

  const hasUnsavedChanges = computed(() => {
    return (
      scriptMetaDirty.value ||
      dirtyBlockIds.value.size > 0
    )
  })

  const unsavedChangesMessage =
    '保存していない変更があります。このページを離れますか？'

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges.value) {
      return
    }

    event.preventDefault()
    event.returnValue = ''
  }

  onMounted(() => {
    window.addEventListener(
      'beforeunload',
      handleBeforeUnload,
    )
  })

  onUnmounted(() => {
    window.removeEventListener(
      'beforeunload',
      handleBeforeUnload,
    )
  })

  onBeforeRouteLeave(async () => {
    if (!hasUnsavedChanges.value) {
      return true
    }

    return await confirm({
      title: '未保存の変更があります',
      message:
        '保存していない変更があります。このページを離れますか？',
      confirmText: '離れる',
      cancelText: 'キャンセル',
      confirmColor: 'error',
    })
  })

  const markScriptMetaDirty = () => {
    scriptMetaDirty.value = true
  }

  const saveScriptMeta = async () => {
    if (!script.id || !script.title.trim()) return

    await apiFetch(`/api/scripts/${script.id}`, {
      method: 'PATCH',
      body: {
        title: script.title.trim(),
        description: script.description,
      },
    })

    scriptMetaDirty.value = false
  }

  const saveBlockContent = async (block: Block) => {
    if (!currentAct.value || !currentScene.value) return

    await apiFetch(
      `/api/scripts/${scriptId.value}/acts/${currentAct.value.id}/scenes/${currentScene.value.id}/blocks/${block.id}`,
      {
        method: 'PATCH',
        body: {
          content: block.content,
          type: block.type,
          character_id: block.character_id,
          sort_order: block.sort_order,
        },
      },
    )

    dirtyBlockIds.value.delete(block.id)
  }

  const saveAllChanges = async () => {
    if (!hasUnsavedChanges.value || saving.value) return

    startSaving()

    try {
      if (scriptMetaDirty.value) {
        await saveScriptMeta()
      }

      const blocks = acts.value.flatMap((act) =>
        (act.scenes || []).flatMap(
          (scene) => scene.blocks || [],
        ),
      )

      const dirtyBlocks = blocks.filter((block) =>
        dirtyBlockIds.value.has(block.id),
      )

      for (const block of dirtyBlocks) {
        await saveBlockContent(block)
      }

      dirtyBlockIds.value = new Set(dirtyBlockIds.value)
      snackbar.success('台本を保存しました。')
    } catch (error) {
      console.error('台本保存エラー:', error)
      snackbar.error('台本の保存に失敗しました。')
    } finally {
      endSaving()
    }
  }
  
  type OutlineDialogMode =
    | 'create-act'
    | 'edit-act'
    | 'create-scene'
    | 'edit-scene'

  const outlineDialog = ref(false)
  const outlineDialogMode = ref<OutlineDialogMode>('create-act')
  const outlineDialogSaving = ref(false)
  const outlineDialogAct = ref<Act | null>(null)
  const outlineDialogActTarget = ref<Act | null>(null)
  const outlineDialogSceneTarget = ref<Scene | null>(null)

  const outlineDialogForm = reactive({
    title: '',
    description: '',
  })

  const openCreateActDialog = () => {
    outlineDialogMode.value = 'create-act'
    outlineDialogAct.value = null
    outlineDialogActTarget.value = null
    outlineDialogSceneTarget.value = null
    outlineDialogForm.title = `第${acts.value.length + 1}幕`
    outlineDialogForm.description = ''
    outlineDialog.value = true
  }

  const openCreateSceneDialog = (act: Act) => {
    outlineDialogMode.value = 'create-scene'
    outlineDialogAct.value = act
    outlineDialogActTarget.value = null
    outlineDialogSceneTarget.value = null
    outlineDialogForm.title = `第${(act.scenes?.length || 0) + 1}場`
    outlineDialogForm.description = ''
    outlineDialog.value = true
  }

  const openEditActDialog = (act: Act) => {
    outlineDialogMode.value = 'edit-act'
    outlineDialogAct.value = act
    outlineDialogActTarget.value = act
    outlineDialogSceneTarget.value = null
    outlineDialogForm.title = act.title
    outlineDialogForm.description = act.description || ''
    outlineDialog.value = true
  }

  const openEditSceneDialog = (act: Act, scene: Scene) => {
    outlineDialogMode.value = 'edit-scene'
    outlineDialogAct.value = act
    outlineDialogActTarget.value = null
    outlineDialogSceneTarget.value = scene
    outlineDialogForm.title = scene.title
    outlineDialogForm.description = scene.description || ''
    outlineDialog.value = true
  }

  const saveOutlineDialog = async () => {
    const title = outlineDialogForm.title.trim()

    if (!title || outlineDialogSaving.value) {
      return
    }

    outlineDialogSaving.value = true

    try {
      if (outlineDialogMode.value === 'create-act') {
        const response = await apiFetch<{ act: Act }>(
          `/api/scripts/${scriptId.value}/acts`,
          {
            method: 'POST',
            body: {
              title,
              description:
                outlineDialogForm.description.trim() || null,
              sort_order: acts.value.length,
            },
          },
        )

        response.act.scenes = []
        acts.value.push(response.act)
        currentAct.value = response.act
        currentScene.value = null

        snackbar.success('幕を追加しました。')
      } else if (outlineDialogMode.value === 'create-scene') {
        const act = outlineDialogAct.value

        if (!act) return

        const response = await apiFetch<{ scene: Scene }>(
          `/api/scripts/${scriptId.value}/acts/${act.id}/scenes`,
          {
            method: 'POST',
            body: {
              title,
              description:
                outlineDialogForm.description.trim() || null,
              sort_order: act.scenes?.length || 0,
            },
          },
        )

        if (!act.scenes) {
          act.scenes = []
        }

        response.scene.characters = []
        response.scene.blocks = []

        act.scenes.push(response.scene)

        currentAct.value = act
        currentScene.value = response.scene

        snackbar.success('場を追加しました。')
      } else if (outlineDialogMode.value === 'edit-act') {
        const act = outlineDialogActTarget.value

        if (!act) return

        const response = await apiFetch<{ act: Act }>(
          `/api/scripts/${scriptId.value}/acts/${act.id}`,
          {
            method: 'PATCH',
            body: {
              title,
              description:
                outlineDialogForm.description.trim() || null,
            },
          },
        )

        Object.assign(act, response.act)

        currentAct.value = act

        snackbar.success('幕を更新しました。')
      } else {
        const act = outlineDialogAct.value
        const scene = outlineDialogSceneTarget.value

        if (!act || !scene) return

        const response = await apiFetch<{ scene: Scene }>(
          `/api/scripts/${scriptId.value}/acts/${act.id}/scenes/${scene.id}`,
          {
            method: 'PATCH',
            body: {
              title,
              description:
                outlineDialogForm.description.trim() || null,
            },
          },
        )

        Object.assign(scene, response.scene)

        currentAct.value = act
        currentScene.value = scene

        snackbar.success('場を更新しました。')
      }

      outlineDialog.value = false
    } catch (error) {
      console.error('幕・場の保存エラー:', error)
      snackbar.error('幕・場の保存に失敗しました。')
    } finally {
      outlineDialogSaving.value = false
    }
  }

  const deleteAct = async (act: Act) => {
    const confirmed = await confirm({
      title: '幕を削除',
      message: `「${act.title}」を削除しますか？`,
    })

    if (!confirmed) return

    try {
      await apiFetch(
        `/api/scripts/${scriptId.value}/acts/${act.id}`,
        {
          method: 'DELETE',
        },
      )

      const index = acts.value.findIndex(
        (item) => item.id === act.id,
      )

      acts.value = acts.value.filter(
        (item) => item.id !== act.id,
      )

      const nextAct =
        acts.value[index] ||
        acts.value[index - 1] ||
        acts.value[0] ||
        null

      currentAct.value = nextAct
      currentScene.value = nextAct?.scenes?.[0] || null

      snackbar.success('幕を削除しました。')
    } catch (error) {
      console.error('幕の削除エラー:', error)
      snackbar.error('幕の削除に失敗しました。')
    }
  }

  const deleteScene = async (act: Act, scene: Scene) => {
    const confirmed = await confirm({
      title: '場を削除',
      message: `「${scene.title}」を削除しますか？`,
    })

    if (!confirmed) return

    try {
      await apiFetch(
        `/api/scripts/${scriptId.value}/acts/${act.id}/scenes/${scene.id}`,
        {
          method: 'DELETE',
        },
      )

      const index = (act.scenes || []).findIndex(
        (item) => item.id === scene.id,
      )

      act.scenes = (act.scenes || []).filter(
        (item) => item.id !== scene.id,
      )

      if (currentScene.value?.id === scene.id) {
        currentAct.value = act
        currentScene.value =
          act.scenes[index] ||
          act.scenes[index - 1] ||
          act.scenes[0] ||
          null
      }

      snackbar.success('場を削除しました。')
    } catch (error) {
      console.error('場の削除エラー:', error)
      snackbar.error('場の削除に失敗しました。')
    }
  }

  const addCharacter = async () => {
    const name = characterCreateName.value.trim()

    if (!name || characterCreating.value) {
      return
    }

    characterCreating.value = true

    try {
      const response = await apiFetch<{ character: Character }>(
        `/api/scripts/${scriptId.value}/characters`,
        {
          method: 'POST',
          body: {
            name,
            sort_order: characters.value.length,
          },
        },
      )

      response.character.casts = []
      characters.value.push(response.character)

      characterCreateName.value = ''
      characterCreateDialog.value = false

      snackbar.success('登場人物を追加しました。')
    } catch (error) {
      console.error(error)
      snackbar.error('登場人物の追加に失敗しました。')
    } finally {
      characterCreating.value = false
    }
  }

  const openCharacterEditDialog = (character: Character) => {
    characterEditTarget.value = character
    characterEditForm.name = character.name
    characterEditForm.description = character.description || ''
    characterEditDialog.value = true
  }

  const saveCharacter = async () => {
    const character = characterEditTarget.value

    if (!character || !characterEditForm.name.trim() || characterSaving.value) {
      return
    }

    characterSaving.value = true

    try {
      const response = await apiFetch<{ character: Character }>(
        `/api/scripts/${scriptId.value}/characters/${character.id}`,
        {
          method: 'PATCH',
          body: {
            name: characterEditForm.name.trim(),
            description: characterEditForm.description.trim() || null,
          },
        },
      )

      const index = characters.value.findIndex(
        (item) => item.id === character.id,
      )

      if (index >= 0) {
        characters.value[index] = {
          ...response.character,
          casts: character.casts || [],
        }
      }

      characterEditDialog.value = false
      snackbar.success('キャラクターを更新しました。')
    } catch (error) {
      console.error(error)
      snackbar.error('キャラクターの更新に失敗しました。')
    } finally {
      characterSaving.value = false
    }
  }

  const deleteCharacter = async () => {
    const character = characterEditTarget.value

    if (!character) {
      return
    }

    const confirmed = await confirm({
      title: 'キャラクターを削除',
      message: `「${character.name}」を削除しますか？\n\nこのキャラクターに紐づく配役や台詞の参照も削除される可能性があります。`,
      confirmText: '削除',
      confirmColor: 'error',
    })

    if (!confirmed) {
      return
    }

    try {
      await apiFetch(
        `/api/scripts/${scriptId.value}/characters/${character.id}`,
        {
          method: 'DELETE',
        },
      )

      characters.value = characters.value.filter(
        (item) => item.id !== character.id,
      )

      characterEditDialog.value = false
      snackbar.success('キャラクターを削除しました。')
    } catch (error) {
      console.error(error)
      snackbar.error('キャラクターの削除に失敗しました。')
    }
  }

  const loadCastMembers = async () => {
    try {
      const response = await apiFetch<{ members: CastMember[] }>(
        `/api/scripts/${scriptId.value}/cast-members`,
      )

      castMembers.value = response.members
    } catch (error) {
      console.error(error)
    }
  }

  const openCastDialog = async (character: Character) => {
    castTargetCharacter.value = character
    castSearch.value = ''

    if (!castMembers.value.length) {
      await loadCastMembers()
    }

    castDialog.value = true
  }

  const filteredCastMembers = computed(() => {
    const keyword = castSearch.value.trim().toLowerCase()

    if (!keyword) {
      return castMembers.value
    }

    return castMembers.value.filter((member) => {
      return (
        member.student_number.toLowerCase().includes(keyword) ||
        member.name.toLowerCase().includes(keyword) ||
        (member.nickname || '').toLowerCase().includes(keyword)
      )
    })
  })

  const isCastAssigned = (userId: string) => {
    return Boolean(
      castTargetCharacter.value?.casts?.some(
        (cast) => cast.user_id === userId,
      ),
    )
  }

  const addCast = async (member: CastMember) => {
    const character = castTargetCharacter.value

    if (!character || isCastAssigned(member.id)) {
      return
    }

    try {
      const response = await apiFetch<{ cast: Cast }>(
        `/api/scripts/${scriptId.value}/characters/${character.id}/casts`,
        {
          method: 'POST',
          body: {
            user_id: member.id,
            cast_order: character.casts?.length || 0,
          },
        },
      )

      if (!character.casts) {
        character.casts = []
      }

      character.casts.push({
        ...response.cast,
        student_number:
          response.cast.student_number ?? member.student_number,
        name: response.cast.name ?? member.name,
        nickname:
          response.cast.nickname ?? member.nickname,
      })

      castDialog.value = false
      snackbar.success(`「${member.name}」を配役に追加しました。`)
    } catch (error) {
      console.error(error)
      snackbar.error('配役の追加に失敗しました。')
    }
  }

  const removeCast = async (
    character: Character,
    cast: Cast,
  ) => {
    const castName =
      cast.name ||
      cast.user_name ||
      cast.nickname ||
      cast.user_nickname ||
      'この配役'

    const confirmed = await confirm({
      title: '配役を削除',
      message: `「${castName}」を「${character.name}」の配役から外しますか？`,
      confirmText: '外す',
      confirmColor: 'error',
    })

    if (!confirmed) {
      return
    }

    try {
      await apiFetch(
        `/api/scripts/${scriptId.value}/characters/${character.id}/casts/${cast.id}`,
        {
          method: 'DELETE',
        },
      )

      character.casts = (character.casts || []).filter(
        (item) => item.id !== cast.id,
      )

      snackbar.success(`「${castName}」を配役から外しました。`)
    } catch (error) {
      console.error(error)
      snackbar.error('配役の削除に失敗しました。')
    }
  }

  const saveBlockOrder = async (blocks: Block[]) => {
    if (!currentAct.value || !currentScene.value) return

    blocks.forEach((block, index) => {
      block.sort_order = index
    })

    await Promise.all(
      blocks.map((block) =>
        apiFetch(
          `/api/scripts/${scriptId.value}/acts/${currentAct.value!.id}/scenes/${currentScene.value!.id}/blocks/${block.id}`,
          {
            method: 'PATCH',
            body: {
              sort_order: block.sort_order,
            },
          },
        ),
      ),
    )
  }

  const createBlock = async (
    type: BlockType,
    characterId: string | null = null,
    afterBlock?: Block,
    content = '',
  ) => {
    if (!currentScene.value || !currentAct.value) return

    const blocks = currentScene.value.blocks || []
    const foundIndex = afterBlock
      ? blocks.findIndex((block) => block.id === afterBlock.id)
      : -1
    const insertIndex = foundIndex >= 0 ? foundIndex + 1 : blocks.length

    try {
      const response = await apiFetch<{ block: Block }>(
        `/api/scripts/${scriptId.value}/acts/${currentAct.value.id}/scenes/${currentScene.value.id}/blocks`,
        {
          method: 'POST',
          body: {
            type,
            character_id: characterId,
            content,
            sort_order: insertIndex,
          },
        },
      )

      blocks.splice(insertIndex, 0, response.block)

      blocks.forEach((block, index) => {
        block.sort_order = index
      })

      currentScene.value.blocks = blocks

      await saveBlockOrder(blocks)

      await nextTick()

      const element = blockRefs.get(response.block.id)
      element?.focus()

      return true
    } catch (error) {
      console.error('ブロック作成エラー:', error)
      snackbar.error(
        `ブロックの作成に失敗しました。${
          error instanceof Error ? ` ${error.message}` : ''
        }`,
      )

      return false
    }
  }

  const addBlock = async (
    type: BlockType,
    afterBlock?: Block,
  ) => {
    if (!currentScene.value || !currentAct.value) return

    if (type === 'dialogue') {
      if (!characters.value.length) {
        snackbar.warning('先に登場人物を追加してください。')
        charactersDrawer.value = true
        return
      }

      if (!sceneCharacters.value.length) {
        snackbar.warning('先にこの場の登場人物を追加してください。')
        sceneCharacterDialog.value = true
        return
      }

      pendingBlockType.value = type
      pendingAfterBlock.value = afterBlock || null
      selectedBlockId.value = null
      characterDialog.value = true
      return
    }

    await createBlock(type, null, afterBlock)
  }

  const addBlockAfter = async (block: Block) => {
    if (block.type === 'dialogue' && block.character_id) {
      await createBlock('dialogue', block.character_id, block)
      return
    }

    await addBlock(block.type, block)
  }

  const duplicateBlock = async (block: Block) => {
    if (!currentScene.value || !currentAct.value) return

    const duplicated = await createBlock(
      block.type,
      block.character_id,
      block,
      block.content,
    )

    if (duplicated) {
      snackbar.success('ブロックを複製しました。')
    }
  }
  
  const handleBlockDragStart = (block: Block, event: DragEvent) => {
    draggingBlockId.value = block.id

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', block.id)
    }
  }

  const handleBlockDragOver = (block: Block) => {
    if (!draggingBlockId.value || draggingBlockId.value === block.id) return

    const blocks = currentScene.value?.blocks
    if (!blocks) return

    const fromIndex = blocks.findIndex(
      (item) => item.id === draggingBlockId.value,
    )
    const toIndex = blocks.findIndex((item) => item.id === block.id)

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

    const [movedBlock] = blocks.splice(fromIndex, 1)
    if (!movedBlock) return

    blocks.splice(toIndex, 0, movedBlock)

    blocks.forEach((item, index) => {
      item.sort_order = index
    })
  }

  const handleBlockDrop = async (block: Block) => {
    if (!draggingBlockId.value || draggingBlockId.value === block.id) {
      draggingBlockId.value = null
      return
    }

    const blocks = currentScene.value?.blocks
    if (!blocks) {
      draggingBlockId.value = null
      return
    }

    startSaving()

    try {
      await saveBlockOrder(blocks)
    } catch (error) {
      console.error('ブロック並び順保存エラー:', error)
      snackbar.error('ブロックの並び順の保存に失敗しました。')
    } finally {
      endSaving()
      draggingBlockId.value = null
    }
  }

  const onBlockInput = (block: Block, event: Event) => {
    const target = event.target as HTMLTextAreaElement
    block.content = target.value

    const nextDirtyBlockIds = new Set(dirtyBlockIds.value)
    nextDirtyBlockIds.add(block.id)
    dirtyBlockIds.value = nextDirtyBlockIds
  }
  
  const deleteBlock = async (block: Block) => {
    if (!currentAct.value || !currentScene.value) return

    const confirmed = await confirm({
      title: 'ブロックを削除',
      message: 'このブロックを削除しますか？',
      confirmText: '削除',
      confirmColor: 'error',
    })

    if (!confirmed) return

    try {
      await apiFetch(
        `/api/scripts/${scriptId.value}/acts/${currentAct.value.id}/scenes/${currentScene.value.id}/blocks/${block.id}`,
        {
          method: 'DELETE',
        },
      )

      currentScene.value.blocks = (currentScene.value.blocks || []).filter(
        (item) => item.id !== block.id,
      )

      await saveBlockOrder(currentScene.value.blocks || [])

      snackbar.success('ブロックを削除しました。')
    } catch (error) {
      console.error('ブロック削除エラー:', error)
      snackbar.error('ブロックの削除に失敗しました。')
    }
  }
  
  const openCharacterMenu = (blockId: string) => {
    selectedBlockId.value = blockId
    characterDialog.value = true
  }
  
  const selectCharacter = async (characterId: string) => {
    const character = characters.value.find((item) => item.id === characterId)
    if (!character) return

    if (
      currentScene.value &&
      !sceneCharacterIds.value.has(character.id)
    ) {
      snackbar.warning('この場に登録されている登場人物から選択してください。')
      return
    }

    if (
      pendingBlockType.value &&
      currentAct.value &&
      currentScene.value
    ) {
      const type = pendingBlockType.value
      const afterBlock = pendingAfterBlock.value || undefined

      pendingBlockType.value = null
      pendingAfterBlock.value = null
      characterDialog.value = false

      await createBlock(type, character.id, afterBlock)
      return
    }

    if (!currentAct.value || !currentScene.value || !selectedBlockId.value) return

    const block = currentScene.value.blocks?.find(
      (item) => item.id === selectedBlockId.value,
    )

    if (!block) return

    const previousCharacterId = block.character_id
    const previousCharacterName = block.character_name

    block.character_id = character.id
    block.character_name = character.name
    characterDialog.value = false

    try {
      await apiFetch(
        `/api/scripts/${scriptId.value}/acts/${currentAct.value.id}/scenes/${currentScene.value.id}/blocks/${block.id}`,
        {
          method: 'PATCH',
          body: {
            content: block.content,
            type: 'dialogue',
            character_id: character.id,
            sort_order: block.sort_order,
          },
        },
      )

      snackbar.success('キャラクターを変更しました。')
    } catch (error) {
      block.character_id = previousCharacterId
      block.character_name = previousCharacterName
      console.error('キャラクター変更エラー:', error)
      snackbar.error('キャラクターの変更に失敗しました。')
    }
  }

  const blockLabel = (type: BlockType) => {
    const labels: Record<BlockType, string> = {
      dialogue: '台詞',
      direction: 'ト書き',
      sound: '音響',
      lighting: '照明',
    }
  
    return labels[type]
  }
  
  const blockIcon = (type: BlockType) => {
    const icons: Record<BlockType, string> = {
      dialogue: 'mdi-account-voice',
      direction: 'mdi-script-text-outline',
      sound: 'mdi-volume-high',
      lighting: 'mdi-lightbulb-outline',
    }
  
    return icons[type]
  }
  
  const blockPlaceholder = (type: BlockType) => {
    const placeholders: Record<BlockType, string> = {
      dialogue: '台詞を入力',
      direction: '演技・動作・舞台上の指示を入力',
      sound: 'SE・BGM・音量・開始タイミングなど',
      lighting: '照明・スポット・色・明るさ・タイミングなど',
    }
  
    return placeholders[type]
  }
  
  const focusLastBlock = () => {
    const blocks = currentScene.value?.blocks || []
    const last = blocks[blocks.length - 1]
    if (last) blockRefs.get(last.id)?.focus()
  }

  const handleBlockEnter = (block: Block, event: KeyboardEvent) => {
  if (!event.shiftKey) {
    return
  }

  event.preventDefault()
  addBlockAfter(block)
}
  
  onMounted(loadScript)
  </script>
  
  <style scoped>
.script-editor {
  height: 100vh;
  overflow: hidden;
  background: #f5f6f8;
}

.editor-header {
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: white;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 20;
}

.header-left,
.header-actions,
.title-row {
  display: flex;
  align-items: center;
}

.header-title {
  min-width: 0;
}

.title-row {
  gap: 10px;
}

.title-input {
  border: 0;
  outline: 0;
  font-size: 18px;
  font-weight: 700;
  width: min(420px, 50vw);
  background: transparent;
}

.scene-label {
  font-size: 12px;
  color: #687078;
  margin-top: 2px;
}

.editor-body {
  height: calc(100vh - 68px);
  display: flex;
  position: relative;
}

.outline-panel,
.characters-panel {
  width: 260px;
  flex: 0 0 260px;
  background: white;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  overflow-y: auto;
  z-index: 10;
}

.characters-panel {
  border-right: 0;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
}

.panel-header {
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 18px;
  font-weight: 700;
  position: sticky;
  top: 0;
  background: white;
  z-index: 2;
}

.outline-content,
.characters-content {
  padding: 12px;
}

.act-group {
  margin-bottom: 12px;
}

.act-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 14px;
  font-weight: 700;
}

.scene-item {
  display: block;
  width: 100%;
  text-align: left;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13px;
  color: #555;
}

.scene-item:hover {
  background: #f2f4f7;
}

.scene-item.active {
  background: rgba(18, 58, 92, 0.1);
  color: #123a5c;
  font-weight: 700;
}

.script-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.script-toolbar {
  height: 70px;
  flex: 0 0 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.toolbar-title {
  font-weight: 700;
}

.toolbar-subtitle {
  font-size: 12px;
  color: #777;
  margin-top: 2px;
}

.script-canvas {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  padding: 40px 56px 90px;
  background: #e9eaec;
  direction: rtl;
}

.script-paper {
  min-height: 100%;
  min-width: max-content;
  background: white;
  border-radius: 10px;
  padding: 54px 64px;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.08);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  direction: rtl;
}

.script-block {
  position: relative;
  display: inline-flex;
  vertical-align: top;
  width: 118px;
  min-height: 560px;
  margin-left: 38px;
  padding: 48px 12px 24px;
  border-radius: 10px;
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.script-block:hover,
.script-block:focus-within {
  background: rgba(18, 58, 92, 0.035);
  box-shadow: inset 0 0 0 1px rgba(18, 58, 92, 0.08);
}

.block-label {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #7a8289;
  writing-mode: horizontal-tb;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.script-block:hover .block-label,
.script-block:focus-within .block-label {
  opacity: 1;
}

.block-dialogue {
  width: 118px;
}

.block-dialogue .block-label {
  display: none;
}

.block-direction {
  width: 108px;
  min-height: 500px;
  color: #5f6368;
  background: rgba(0, 0, 0, 0.018);
}

.block-sound {
  width: 108px;
  min-height: 420px;
  background: rgba(18, 58, 92, 0.045);
}

.block-lighting {
  width: 108px;
  min-height: 420px;
  background: rgba(18, 58, 92, 0.065);
}

.character-button {
  position: absolute;
  top: 12px;
  right: 10px;
  border: 0;
  background: transparent;
  color: #123a5c;
  font-weight: 700;
  font-size: 14px;
  padding: 4px 6px;
  writing-mode: horizontal-tb;
  cursor: pointer;
  white-space: nowrap;
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.character-button:hover {
  background: rgba(18, 58, 92, 0.08);
}

.block-textarea {
  width: 100%;
  min-height: 430px;
  height: 100%;
  resize: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: #222;
  font-family: inherit;
  font-size: 19px;
  font-weight: 500;
  line-height: 1.9;
  letter-spacing: 0.04em;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 0;
}

.block-dialogue .block-textarea {
  min-height: 480px;
  font-size: 20px;
  line-height: 2;
  font-weight: 500;
}

.block-direction .block-textarea {
  color: #666;
  font-size: 16px;
  line-height: 1.85;
  font-weight: 400;
}

.block-sound .block-textarea,
.block-lighting .block-textarea {
  font-size: 15px;
  line-height: 1.8;
  font-weight: 600;
}

.block-duplicate,
.block-delete {
  position: absolute;
  bottom: 8px;
  width: 26px;
  height: 26px;
  padding: 0;
  opacity: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  color: #666;
  cursor: pointer;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.block-duplicate {
  right: 38px;
}

.block-delete {
  right: 8px;
}

.script-block:hover .block-duplicate,
.block-duplicate:focus,
.script-block:hover .block-delete,
.block-delete:focus {
  opacity: 0.7;
}

.block-duplicate:hover {
  opacity: 1;
  background: rgba(18, 58, 92, 0.12);
}

.block-delete:hover {
  opacity: 1;
  background: rgba(200, 50, 50, 0.12);
}

.block-drag-handle {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.script-block:hover .block-drag-handle,
.script-block:focus-within .block-drag-handle {
  opacity: 0.65;
}

.add-block-inline,
.empty-script {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(18, 58, 92, 0.35);
  background: rgba(18, 58, 92, 0.03);
  color: #123a5c;
  border-radius: 10px;
  cursor: pointer;
}

.add-block-inline {
  width: 56px;
  height: 110px;
  margin-left: 18px;
}

.empty-script {
  width: 200px;
  height: 300px;
  flex-direction: column;
  gap: 12px;
  writing-mode: horizontal-tb;
}

.loading-area,
.empty-editor {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.character-card {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 8px;
}

.character-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.character-name {
  font-weight: 700;
}

.character-description {
  margin-top: 4px;
  font-size: 12px;
  color: #777;
  line-height: 1.5;
}

.cast-section-title {
  margin-top: 10px;
  font-size: 11px;
  font-weight: 700;
  color: #777;
}

.cast-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}

.cast-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.cast-name {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  padding: 3px 6px;
  background: #f1f3f5;
  border-radius: 999px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cast-student-number {
  flex: 0 0 auto;
  font-size: 10px;
  color: #888;
}

.cast-add-button {
  margin-top: 4px;
}

.cast-member-list {
  max-height: 360px;
  overflow-y: auto;
}

@media (max-width: 900px) {
  .outline-panel {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.12);
  }

  .characters-panel {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.12);
  }

  .script-canvas {
    padding: 24px 24px 80px;
  }

  .script-paper {
    padding: 36px 32px;
  }

  .script-block {
    margin-left: 28px;
  }

  .title-input {
    width: 180px;
    font-size: 16px;
  }
}

@media (max-width: 600px) {
  .editor-header {
    height: 60px;
  }

  .editor-body {
    height: calc(100vh - 60px);
  }

  .title-row .v-chip {
    display: none;
  }

  .title-input {
    width: 145px;
  }

  .scene-label {
    font-size: 11px;
  }

  .script-toolbar {
    height: 58px;
    flex-basis: 58px;
    padding: 0 12px;
  }

  .script-paper {
    padding: 28px 22px;
  }

  .script-block {
    width: 102px;
    min-height: 480px;
    margin-left: 22px;
    padding: 44px 10px 20px;
  }

  .block-dialogue {
    width: 104px;
  }

  .block-direction {
    width: 96px;
    min-height: 430px;
  }

  .block-sound,
  .block-lighting {
    width: 96px;
    min-height: 380px;
  }

  .block-textarea {
    font-size: 17px;
  }

  .block-dialogue .block-textarea {
    font-size: 18px;
    min-height: 410px;
  }

  .character-button {
    font-size: 13px;
    max-width: 84px;
  }
}
</style>
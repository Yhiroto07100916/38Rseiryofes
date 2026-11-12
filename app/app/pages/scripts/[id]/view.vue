<template>
  <main class="script-viewer">
    <header class="viewer-toolbar">
      <LayoutBackButton />
      <div class="flex-grow-1 min-width-0">
        <h1 class="text-h6 font-weight-bold text-truncate">{{ script.title || '台本' }}</h1>
        <div class="text-caption text-medium-emphasis">閲覧専用</div>
      </div>
      <v-btn variant="outlined" prepend-icon="mdi-printer" @click="printScript">印刷・PDF</v-btn>
    </header>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="viewer-alert">{{ errorMessage }}</v-alert>
    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else-if="!acts.some(act => act.scenes?.length)" class="text-center py-12 text-medium-emphasis">
      台本の内容はまだありません。
    </div>
    <div v-else class="viewer-pages">
      <article v-for="page in viewerPages" :key="page.id" class="script-page">
        <header class="page-header">
          <div class="page-script-title">{{ script.title }}</div>
          <div class="page-act-title">{{ page.actTitle }}</div>
          <div class="page-scene-title">{{ page.sceneTitle }}</div>
          <div v-if="page.characters.length" class="page-characters">
            登場人物：{{ page.characters.join('、') }}
          </div>
        </header>
        <div class="page-rule" />
        <div class="page-columns">
          <div v-for="column in page.columns" :key="column.id" class="script-column" :class="'block-' + column.type">
            <div v-if="column.type === 'dialogue' && column.character_name" class="column-character">{{ column.character_name }}</div>
            <div class="column-content">{{ column.content }}</div>
          </div>
        </div>
        <footer class="page-footer">{{ page.actTitle }} ・ {{ page.sceneTitle }}</footer>
      </article>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

definePageMeta({
  permissions: ['script.view'],
  middleware: ['auth'],
  layout: false,
})

type BlockType = 'dialogue' | 'direction' | 'sound' | 'lighting'
interface Script { id: string; title: string; description: string | null }
interface Block { id: string; type: BlockType; character_name: string | null; content: string; sort_order: number }
interface Scene {
  id: string
  title: string
  description: string | null
  characters?: Array<{ character_id: string; character_name: string }>
  blocks?: Block[]
}
interface Act { id: string; title: string; scenes?: Scene[] }

const route = useRoute()
const { apiFetch } = useApi()
const scriptId = computed(() => String(route.params.id))
const script = ref<Script>({ id: '', title: '', description: null })
const acts = ref<Act[]>([])
const loading = ref(true)
const errorMessage = ref('')

interface ViewerColumn extends Block { id: string }
interface ViewerPage {
  id: string
  actTitle: string
  sceneTitle: string
  characters: string[]
  columns: ViewerColumn[]
}

const splitColumnText = (value: string, maxCharacters = 40): string[] => {
  const characters = Array.from(value.replace(/\r\n?/g, '\n'))
  if (!characters.length) return ['']
  const chunks: string[] = []
  for (let index = 0; index < characters.length; index += maxCharacters) {
    chunks.push(characters.slice(index, index + maxCharacters).join(''))
  }
  return chunks
}

const viewerPages = computed<ViewerPage[]>(() => {
  const pages: ViewerPage[] = []
  for (const act of acts.value) {
    for (const scene of act.scenes || []) {
      const columns = (scene.blocks || []).flatMap(block =>
        splitColumnText(block.content).map((content, fragmentIndex) => ({
          ...block,
          id: `${block.id}-${fragmentIndex}`,
          character_name: fragmentIndex === 0 ? block.character_name : null,
          content,
        })),
      )
      const pageChunks = columns.length
        ? Array.from({ length: Math.ceil(columns.length / 12) }, (_, index) => columns.slice(index * 12, (index + 1) * 12))
        : [[]]
      pageChunks.forEach((pageColumns, pageIndex) => {
        pages.push({
          id: `${scene.id}-${pageIndex}`,
          actTitle: act.title,
          sceneTitle: scene.title,
          characters: (scene.characters || []).map(character => character.character_name),
          columns: pageColumns,
        })
      })
    }
  }
  return pages
})

const loadScript = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await apiFetch<{ script: Script; acts: Act[]; characters: unknown[] }>(`/api/scripts/${scriptId.value}`)
    script.value = response.script
    acts.value = await Promise.all(response.acts.map(async act => {
      const scenes = await Promise.all((act.scenes || []).map(async scene => {
        const detail = await apiFetch<{ scene: Scene; characters: Scene['characters']; blocks: Block[] }>(
          `/api/scripts/${scriptId.value}/acts/${act.id}/scenes/${scene.id}`,
        )
        return { ...detail.scene, characters: detail.characters, blocks: detail.blocks }
      }))
      return { ...act, scenes }
    }))
  } catch (error) {
    console.error(error)
    errorMessage.value = '台本を読み込めませんでした。閲覧権限を確認してください。'
  } finally {
    loading.value = false
  }
}

const printScript = () => window.print()
onMounted(loadScript)
</script>

<style scoped>
.script-viewer { min-height: 100vh; padding: 16px; background: #eef2f6; }
.viewer-toolbar {
  position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 12px;
  max-width: 1100px; margin: 0 auto 18px; padding: 12px 16px; border-radius: 14px;
  background: white; box-shadow: 0 2px 10px rgb(0 0 0 / 8%);
}
.viewer-alert, .viewer-pages { max-width: 1100px; margin: 0 auto; }
.script-page {
  width: min(100%, 210mm); min-height: 297mm; margin: 0 auto 18px; padding: 14mm 15mm 12mm;
  overflow: visible; background: white; box-shadow: 0 2px 14px rgb(0 0 0 / 10%);
  break-after: page; page-break-after: always;
}
.script-page:last-child { break-after: auto; page-break-after: auto; }
.page-header { min-height: 28mm; display: flex; flex-direction: column; gap: 3px; }
.page-script-title { font-size: 10pt; font-weight: 700; }
.page-act-title { font-size: 9pt; color: #555; }
.page-scene-title { font-size: 15pt; font-weight: 700; }
.page-characters { margin-top: 3px; font-size: 8pt; color: #555; }
.page-rule { margin: 4mm 0; border-top: 1px solid #555; }
.page-columns {
  display: flex; flex-direction: row; align-items: flex-start; gap: 3mm; direction: rtl;
  min-height: 225mm; overflow-x: auto; overflow-y: hidden;
}
.script-column {
  flex: 0 0 12mm; width: 12mm; height: 220mm; writing-mode: vertical-rl;
  text-orientation: mixed; white-space: pre-wrap; overflow-wrap: anywhere;
  font-size: 10.5pt; line-height: 1.35;
}
.column-character { margin-bottom: 3mm; font-weight: 700; font-size: 9pt; }
.column-content { white-space: pre-wrap; }
.block-direction { color: #666; font-size: 9pt; }
.block-sound { color: #008fc9; font-size: 9pt; font-weight: 700; }
.block-lighting { color: #b87900; font-size: 9pt; font-weight: 700; }
.page-footer { margin-top: 6mm; padding-top: 2mm; border-top: 1px solid #aaa; text-align: center; font-size: 8pt; color: #555; }
@media (max-width: 600px) {
  .script-viewer { padding: 8px; }
  .viewer-toolbar { padding: 8px; gap: 6px; }
  .script-page { padding: 8mm; }
}
@media print {
  @page { size: A4 portrait; margin: 0; }
  .script-viewer { padding: 0; background: white; }
  .viewer-toolbar, .viewer-alert { display: none !important; }
  .script-page { width: 210mm; min-height: 297mm; margin: 0; padding: 14mm 15mm 12mm; box-shadow: none; overflow: visible; }
  .page-columns { overflow: visible; }
}
</style>

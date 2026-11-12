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

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="viewer-alert">
      {{ errorMessage }}
    </v-alert>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <div v-else-if="!viewerPages.length" class="text-center py-12 text-medium-emphasis">
      台本の内容はまだありません。
    </div>

    <div v-else class="viewer-pages">
      <article v-for="page in viewerPages" :key="page.id" class="print-page">
        <div class="print-top-rule" />

        <div class="print-character-area">
          <div class="print-character-spacer" />
          <div
            v-for="column in page.columns"
            :key="column.id"
            class="print-header-character"
          >
            <span class="print-header-character-text">
              {{ column.type === 'dialogue' && column.showCharacter ? column.character_name : '' }}
            </span>
          </div>
        </div>

        <div class="print-scene-rule" />

        <div class="print-body">
          <div class="print-scene-label">
            <span class="print-act-label">{{ page.actTitle }}</span>
            <span class="print-scene-title">{{ page.sceneTitle }}</span>
            <span v-if="page.sceneDescription" class="print-scene-description">
              {{ page.sceneDescription }}
            </span>
          </div>

          <div
            v-for="column in page.columns"
            :key="column.id"
            class="print-script-column"
            :class="columnClass(column.type)"
          >
            <span class="print-column-text">
              <template v-if="column.type === 'dialogue'">
                {{ column.isFirst ? '「' : '' }}{{ column.content }}{{ column.isLast ? '」' : '' }}
              </template>
              <template v-else>{{ column.content }}</template>
            </span>
          </div>
        </div>

        <div class="print-bottom-rule" />
        <div class="print-footer">
          <span>{{ script.title }}</span>
          <span class="print-page-number">{{ page.pageNumber }} / {{ viewerPages.length }}</span>
        </div>
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

interface Script {
  id: string
  title: string
  description: string | null
}

interface Block {
  id: string
  type: BlockType
  character_name: string | null
  content: string
  sort_order: number
}

interface Scene {
  id: string
  title: string
  description: string | null
  sort_order: number
  blocks?: Block[]
}

interface Act {
  id: string
  title: string
  sort_order: number
  scenes?: Scene[]
}

interface ViewerColumn {
  id: string
  type: BlockType
  character_name: string | null
  content: string
  isFirst: boolean
  isLast: boolean
  showCharacter: boolean
}

interface ViewerPage {
  id: string
  pageNumber: number
  actTitle: string
  sceneTitle: string
  sceneDescription: string | null
  columns: ViewerColumn[]
}

const route = useRoute()
const { apiFetch } = useApi()
const scriptId = computed(() => String(route.params.id))
const script = ref<Script>({ id: '', title: '', description: null })
const acts = ref<Act[]>([])
const loading = ref(true)
const errorMessage = ref('')

useHead({
  meta: [
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, minimum-scale=0.25, maximum-scale=5, user-scalable=yes, viewport-fit=cover',
    },
  ],
})

const splitVerticalText = (value: string, maxCharacters: number): string[] => {
  const normalized = String(value ?? '')
    .replaceAll(String.fromCharCode(13, 10), String.fromCharCode(10))
    .replaceAll(String.fromCharCode(13), String.fromCharCode(10))

  if (!normalized) return []

  const result: string[] = []
  for (const line of normalized.split(String.fromCharCode(10))) {
    const characters = Array.from(line)
    if (!characters.length) {
      result.push('')
      continue
    }
    for (let index = 0; index < characters.length; index += maxCharacters) {
      result.push(characters.slice(index, index + maxCharacters).join(''))
    }
  }
  return result
}

const getPrintLayout = () => {
  const pageHeightMm = 297
  const pageWidthMm = 210
  const horizontalPaddingMm = 15
  const bodyHeightMm = pageHeightMm - 61
  const contentWidthMm = pageWidthMm - horizontalPaddingMm * 2
  const columnWidthMm = 12
  const columnGapMm = 3
  const sceneLabelWidthMm = 18
  const characterAdvanceMm = 10.5 * 0.352778 * 1.25

  return {
    maxCharacters: Math.max(1, Math.floor(bodyHeightMm / characterAdvanceMm) - 2),
    columnsPerPage: Math.max(
      1,
      Math.floor((contentWidthMm - sceneLabelWidthMm) / (columnWidthMm + columnGapMm)),
    ),
  }
}

const viewerPages = computed<ViewerPage[]>(() => {
  const { maxCharacters, columnsPerPage } = getPrintLayout()
  const pages: ViewerPage[] = []

  const scenes = acts.value
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap(act =>
      (act.scenes || [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(scene => ({ act, scene })),
    )

  for (const { act, scene } of scenes) {
    const blocks = (scene.blocks || []).slice().sort((a, b) => a.sort_order - b.sort_order)
    const columns: ViewerColumn[] = blocks.flatMap(block => {
      const chunks = splitVerticalText(block.content, maxCharacters)
      return chunks.map((content, index) => ({
        id: block.id + '-' + index,
        type: block.type,
        character_name: block.character_name,
        content,
        isFirst: index === 0,
        isLast: index === chunks.length - 1,
        showCharacter: index === 0,
      }))
    })

    if (!columns.length) {
      pages.push({
        id: scene.id + '-empty',
        pageNumber: pages.length + 1,
        actTitle: act.title,
        sceneTitle: scene.title,
        sceneDescription: scene.description,
        columns: [],
      })
      continue
    }

    for (let offset = 0; offset < columns.length; offset += columnsPerPage) {
      const pageColumns = columns.slice(offset, offset + columnsPerPage).map((column, index) => ({
        ...column,
        showCharacter: column.showCharacter || (index === 0 && column.type === 'dialogue'),
      }))
      pages.push({
        id: scene.id + '-' + offset,
        pageNumber: pages.length + 1,
        actTitle: act.title,
        sceneTitle: scene.title,
        sceneDescription: scene.description,
        columns: pageColumns,
      })
    }
  }

  return pages
})

const columnClass = (type: BlockType) => {
  if (type === 'direction') return 'print-direction-column'
  if (type === 'sound') return 'print-sound-column'
  if (type === 'lighting') return 'print-lighting-column'
  return 'print-dialogue-column'
}

const loadScript = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await apiFetch<{ script: Script; acts: Act[] }>(
      '/api/scripts/' + scriptId.value,
    )
    script.value = response.script
    acts.value = await Promise.all(response.acts.map(async act => {
      const scenes = await Promise.all((act.scenes || []).map(async scene => {
        const detail = await apiFetch<{ scene: Scene; blocks: Block[] }>(
          '/api/scripts/' + scriptId.value + '/acts/' + act.id + '/scenes/' + scene.id,
        )
        return { ...detail.scene, blocks: detail.blocks }
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
* {
  box-sizing: border-box;
}

.script-viewer {
  min-height: 100vh;
  padding: 16px;
  background: #eef2f6;
  color: #111;
  font-family: "Yu Mincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", serif;
}

.viewer-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 1100px;
  margin: 0 auto 18px;
  padding: 12px 16px;
  border-radius: 14px;
  background: white;
  box-shadow: 0 2px 10px rgb(0 0 0 / 8%);
}

.viewer-alert {
  max-width: 1100px;
  margin: 0 auto 16px;
}

.viewer-pages {
  width: max-content;
  min-width: 100%;
}

.print-page {
  position: relative;
  width: 210mm;
  height: 296mm;
  margin: 0 auto 18px;
  padding: 9mm 15mm 11mm;
  overflow: hidden;
  background: white;
  box-shadow: 0 2px 14px rgb(0 0 0 / 10%);
  break-inside: avoid;
  page-break-after: always;
  break-after: page;
}

.print-top-rule {
  width: 100%;
  height: 0;
  margin-bottom: 4mm;
  border-top: 1px solid #222;
}

.print-character-area {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 3mm;
  width: 100%;
  height: 25mm;
  overflow: hidden;
  direction: rtl;
}

.print-character-spacer {
  flex: 0 0 18mm;
  width: 18mm;
  height: 23mm;
}

.print-header-character {
  position: relative;
  flex: 0 0 12mm;
  width: 12mm;
  height: 23mm;
  padding: 0;
  margin: 0;
  overflow: hidden;
  font-size: 10pt;
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.print-header-character-text {
  position: absolute;
  top: 0;
  right: 0;
  display: block;
  margin: 0;
  padding: 0;
  white-space: nowrap;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.print-scene-rule {
  width: 100%;
  height: 0;
  margin-bottom: 5mm;
  border-top: 1px solid #222;
}

.print-body {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 3mm;
  width: 100%;
  height: 236mm;
  overflow: hidden;
  direction: rtl;
}

.print-scene-label {
  position: relative;
  flex: 0 0 18mm;
  width: 18mm;
  height: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden;
  border-left: 1px solid #999;
  font-weight: 700;
  white-space: normal;
  writing-mode: vertical-rl;
  text-orientation: mixed;
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
  color: #555;
  font-size: 8pt;
  font-weight: 400;
  line-height: 1.5;
  white-space: nowrap;
}

.print-script-column {
  position: relative;
  flex: 0 0 12mm;
  width: 12mm;
  height: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden;
  font-size: 10.5pt;
  line-height: 1.25;
  white-space: pre-wrap;
  word-break: break-all;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.print-dialogue-column {
  align-self: flex-start;
  overflow: hidden;
  color: #111;
  font-size: 10.5pt;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: 0.02em;
  text-align: start;
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
  overflow: hidden;
  line-height: 1.25;
  white-space: pre-wrap;
  word-break: break-all;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.print-direction-column {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #555;
  font-size: 9pt;
  font-weight: 400;
}

.print-sound-column {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #009fe3;
  font-size: 9pt;
  font-weight: 700;
}

.print-lighting-column {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #f0a000;
  font-size: 9pt;
  font-weight: 700;
}

.print-bottom-rule {
  position: absolute;
  right: 15mm;
  bottom: 9mm;
  left: 15mm;
  border-top: 1px solid #222;
}

.print-footer {
  position: absolute;
  right: 15mm;
  bottom: 3mm;
  left: 15mm;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 7.5pt;
}

.print-page-number {
  margin-left: 5mm;
}

@media (max-width: 900px) {
  .script-viewer {
    overflow-x: visible;
    padding: 8px;
  }

  .viewer-toolbar {
    position: sticky;
    width: max-content;
    min-width: 100%;
    padding: 8px;
    gap: 6px;
  }
}

@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }

  .script-viewer {
    min-height: 0;
    padding: 0;
    background: white;
  }

  .viewer-toolbar,
  .viewer-alert {
    display: none !important;
  }

  .print-page {
    width: 210mm;
    height: 296mm;
    margin: 0;
    box-shadow: none;
  }

  .print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
}
</style>

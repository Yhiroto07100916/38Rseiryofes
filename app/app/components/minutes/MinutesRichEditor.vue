<template>
  <div
    class="minutes-editor"
    :class="{ 'minutes-editor--readonly': readonly }"
  >
    <div v-if="!readonly" class="minutes-editor__toolbar">
      <v-btn
        icon="mdi-format-header-1"
        size="small"
        variant="text"
        title="見出し1"
        aria-label="見出し1"
        :disabled="!editor"
        :color="editor?.isActive('heading', { level: 1 }) ? 'primary' : undefined"
        @click="editor?.chain().focus().toggleHeading({ level: 1 }).run()"
      />
      <v-btn
        icon="mdi-format-header-2"
        size="small"
        variant="text"
        title="見出し2"
        aria-label="見出し2"
        :disabled="!editor"
        :color="editor?.isActive('heading', { level: 2 }) ? 'primary' : undefined"
        @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
      />
      <v-divider vertical class="mx-1" />
      <v-btn
        icon="mdi-format-bold"
        size="small"
        variant="text"
        title="太字"
        aria-label="太字"
        :disabled="!editor"
        :color="editor?.isActive('bold') ? 'primary' : undefined"
        @click="editor?.chain().focus().toggleBold().run()"
      />
      <v-btn
        icon="mdi-format-italic"
        size="small"
        variant="text"
        title="斜体"
        aria-label="斜体"
        :disabled="!editor"
        :color="editor?.isActive('italic') ? 'primary' : undefined"
        @click="editor?.chain().focus().toggleItalic().run()"
      />
      <v-divider vertical class="mx-1" />
      <v-btn
        icon="mdi-format-list-bulleted"
        size="small"
        variant="text"
        title="箇条書き"
        aria-label="箇条書き"
        :disabled="!editor"
        :color="editor?.isActive('bulletList') ? 'primary' : undefined"
        @click="editor?.chain().focus().toggleBulletList().run()"
      />
      <v-btn
        icon="mdi-format-list-checks"
        size="small"
        variant="text"
        title="チェックリスト"
        aria-label="チェックリスト"
        :disabled="!editor"
        :color="editor?.isActive('taskList') ? 'primary' : undefined"
        @click="editor?.chain().focus().toggleTaskList().run()"
      />
    </div>

    <EditorContent
      v-if="editor"
      :editor="editor"
      class="minutes-editor__content"
    />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'

const props = withDefaults(defineProps<{
  modelValue: string
  readonly?: boolean
  placeholder?: string
}>(), {
  readonly: false,
  placeholder: '内容を書き留める…',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function parseContent(value: string) {
  if (!value) {
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }

  // 新形式：Tiptap JSON。既存のプレーンテキストとも区別する。
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'type' in parsed &&
      parsed.type === 'doc'
    ) {
      return parsed as {
        type: 'doc'
        content?: unknown[]
      }
    }
  } catch {
    // 既存データはプレーンテキストとして扱う。
  }

  return {
    type: 'doc',
    content: value.split(/\r?\n/).map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : undefined,
    })),
  }
}

const editor = useEditor({
  content: parseContent(props.modelValue),
  editable: !props.readonly,
  extensions: [
    StarterKit,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: props.placeholder }),
  ],
  onUpdate: ({ editor: instance }) => {
    emit('update:modelValue', JSON.stringify(instance.getJSON()))
  },
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return

    const currentValue = JSON.stringify(editor.value.getJSON())
    if (currentValue === value) return

    // 外部から読み込んだときだけ内容を更新する。
    // 編集中のカーソル位置を毎回リセットしない。
    editor.value.commands.setContent(parseContent(value), {
      emitUpdate: false,
    })
  },
)

watch(
  () => props.readonly,
  (readonly) => editor.value?.setEditable(!readonly),
)

watch(
  () => props.placeholder,
  (placeholder) => {
    editor.value?.setOptions({
      editorProps: {
        attributes: {
          'aria-label': placeholder,
        },
      },
    })
  },
)
</script>

<style scoped>
.minutes-editor {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
}

.minutes-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 6px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgb(var(--v-theme-surface));
}

.minutes-editor__content {
  min-height: 280px;
  padding: 16px;
}

.minutes-editor--readonly .minutes-editor__content {
  min-height: 160px;
}

.minutes-editor__content :deep(.tiptap) {
  min-height: 250px;
  outline: none;
  overflow-wrap: anywhere;
  line-height: 1.8;
}

.minutes-editor__content :deep(.tiptap p) {
  margin: 0 0 0.65em;
}

.minutes-editor__content :deep(.tiptap h1) {
  font-size: 1.55rem;
  line-height: 1.4;
  margin: 1em 0 0.5em;
}

.minutes-editor__content :deep(.tiptap h2) {
  font-size: 1.25rem;
  line-height: 1.5;
  margin: 1em 0 0.5em;
}

.minutes-editor__content :deep(.tiptap ul),
.minutes-editor__content :deep(.tiptap ol) {
  padding-left: 1.5rem;
  margin: 0.5em 0;
}

.minutes-editor__content :deep(.tiptap ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0.25rem;
}

.minutes-editor__content :deep(.tiptap li[data-type="taskItem"]) {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.minutes-editor__content :deep(.tiptap li[data-type="taskItem"] > label) {
  flex: 0 0 auto;
  margin-top: 0.4rem;
}

.minutes-editor__content :deep(.tiptap li[data-type="taskItem"] > div) {
  flex: 1;
  min-width: 0;
}

.minutes-editor__content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: rgba(var(--v-theme-on-surface), 0.45);
  float: left;
  height: 0;
  pointer-events: none;
}

@media (max-width: 600px) {
  .minutes-editor__content {
    padding: 12px;
  }

  .minutes-editor__content :deep(.tiptap) {
    min-height: 45vh;
  }
}
</style>

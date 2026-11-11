<template>
  <div
    class="script-rich-editor"
    :class="{ 'is-focused': focused }"
    :aria-label="ariaLabel"
    @keydown="handleKeydown"
  >
    <EditorContent v-if="editor" :editor="editor" />
    <div v-else class="editor-loading">{{ placeholder }}</div>
  </div>
</template>

<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  ariaLabel?: string
}>(), {
  placeholder: '',
  ariaLabel: '台本本文',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'add-after': []
}>()

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const toEditorHtml = (value: string) => {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  return lines.map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`).join('')
}

const editor = useEditor({
  content: toEditorHtml(props.modelValue),
  extensions: [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
      emptyEditorClass: 'is-editor-empty',
    }),
  ],
  editorProps: {
    attributes: {
      class: 'script-rich-editor-content',
      spellcheck: 'true',
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    emit('update:modelValue', currentEditor.getText({ blockSeparator: '\n' }))
  },
})

watch(() => props.modelValue, (value) => {
  if (!editor.value) return
  const currentText = editor.value.getText({ blockSeparator: '\n' })
  if (currentText !== value) {
    editor.value.commands.setContent(toEditorHtml(value), { emitUpdate: false })
  }
})

watch(() => props.placeholder, (value) => {
  editor.value?.setOptions({
    editorProps: {
      attributes: {
        class: 'script-rich-editor-content',
        spellcheck: 'true',
        'data-placeholder': value,
      },
    },
  })
})

const focused = computed(() => editor.value?.isFocused ?? false)

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && event.shiftKey && !event.isComposing) {
    event.preventDefault()
    emit('add-after')
  }
}

const focus = () => {
  editor.value?.commands.focus('end')
}

defineExpose({ focus })
</script>

<style scoped>
.script-rich-editor {
  width: 100%;
  min-height: 430px;
  height: 100%;
  outline: none;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  cursor: text;
}

.script-rich-editor :deep(.tiptap) {
  min-height: inherit;
  width: 100%;
  outline: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  caret-color: #123a5c;
}

.script-rich-editor :deep(.tiptap p) {
  margin: 0;
  min-height: 1em;
}

.script-rich-editor :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: #a0a6ad;
  float: right;
  height: 0;
  pointer-events: none;
}

.script-rich-editor :deep(.tiptap ::selection) {
  background: rgba(45, 92, 134, 0.22);
}

.script-rich-editor :deep(.tiptap:focus) {
  outline: none;
}

.editor-loading {
  color: #a0a6ad;
}
</style>

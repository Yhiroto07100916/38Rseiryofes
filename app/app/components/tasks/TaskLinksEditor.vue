<template>
  <div class="mb-4">
    <div class="d-flex align-center justify-space-between mb-2">
      <div class="text-subtitle-2 font-weight-medium">関連リンク</div>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-plus"
        :disabled="modelValue.length >= 20"
        @click="addLink"
      >
        {{ addLabel }}
      </v-btn>
    </div>

    <div
      v-for="(taskLink, index) in modelValue"
      :key="index"
      class="d-flex align-start ga-2 mb-2"
    >
      <div class="flex-grow-1">
        <v-text-field
          :model-value="taskLink.title"
          label="表示タイトル"
          placeholder="例：資料・参考ページ"
          variant="outlined"
          density="comfortable"
          hide-details
          class="mb-2"
          @update:model-value="value => updateLink(index, 'title', value)"
        />
        <v-text-field
          :model-value="taskLink.url"
          label="URL"
          placeholder="https://example.com"
          variant="outlined"
          density="comfortable"
          hide-details
          @update:model-value="value => updateLink(index, 'url', value)"
        />
      </div>
      <v-btn
        icon="mdi-close"
        variant="text"
        color="error"
        aria-label="リンクを削除"
        @click="removeLink(index)"
      />
    </div>

    <div v-if="helpText" class="text-caption text-medium-emphasis">
      {{ helpText }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface TaskLink {
  title: string
  url: string
}

const props = withDefaults(defineProps<{
  modelValue: TaskLink[]
  addLabel?: string
  helpText?: string
}>(), {
  addLabel: "追加",
  helpText: "最大20件。タイトルとURLを両方入力してください。",
})

const emit = defineEmits<{
  "update:modelValue": [value: TaskLink[]]
}>()

const addLink = () => {
  if (props.modelValue.length >= 20) return
  emit("update:modelValue", [...props.modelValue, { title: "", url: "" }])
}

const updateLink = (index: number, field: keyof TaskLink, value: string | null) => {
  const links = props.modelValue.map((link, currentIndex) => (
    currentIndex === index
      ? { ...link, [field]: value ?? "" }
      : link
  ))
  emit("update:modelValue", links)
}

const removeLink = (index: number) => {
  emit("update:modelValue", props.modelValue.filter((_, currentIndex) => currentIndex !== index))
}
</script>

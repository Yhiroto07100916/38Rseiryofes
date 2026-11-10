<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  clearable?: boolean
  disabled?: boolean
  required?: boolean
  density?: 'default' | 'comfortable' | 'compact'
  hideDetails?: boolean | 'auto'
}>(), {
  label: '',
  clearable: false,
  disabled: false,
  required: false,
  density: 'default',
  hideDetails: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const menuOpen = ref(false)
const selectedDate = ref('')

const displayValue = computed(() => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.modelValue)
  return match ? `${match[1]}/${match[2]}/${match[3]}` : ''
})

function syncFromValue(value: string) {
  selectedDate.value = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

watch(() => props.modelValue, syncFromValue, { immediate: true })

function normalizeDate(value: unknown): string | null {
  const date = Array.isArray(value) ? value[0] : value

  if (typeof date === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(date)
    return match?.[1] ?? null
  }

  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
  }

  if (date && typeof date === 'object' && 'isoDate' in date) {
    const isoDate = (date as { isoDate?: unknown }).isoDate
    return typeof isoDate === 'string' ? normalizeDate(isoDate) : null
  }

  return null
}

function onDateUpdate(value: unknown) {
  const date = normalizeDate(value)
  if (!date) return

  selectedDate.value = date
  emit('update:modelValue', date)
}

function clearValue() {
  emit('update:modelValue', '')
  menuOpen.value = false
}
</script>

<template>
  <v-menu
    v-model="menuOpen"
    :close-on-content-click="false"
    :disabled="disabled"
    location="bottom start"
  >
    <template #activator="{ props: activatorProps }">
      <v-text-field
        v-bind="activatorProps"
        :model-value="displayValue"
        :label="label"
        :disabled="disabled"
        :clearable="clearable"
        :required="required"
        :density="density"
        :hide-details="hideDetails"
        readonly
        variant="outlined"
        @click="menuOpen = true"
        @click:clear="clearValue"
      />
    </template>

    <v-date-picker
      :model-value="selectedDate"
      color="primary"
      show-adjacent-months
      @update:model-value="onDateUpdate"
    />
  </v-menu>
</template>

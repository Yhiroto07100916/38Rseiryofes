<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  clearable?: boolean
  disabled?: boolean
  required?: boolean
  class?: string
}>(), {
  label: '',
  clearable: false,
  disabled: false,
  required: false,
  class: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const menuOpen = ref(false)
const selectedDate = ref('')
const selectedHour = ref('18')
const selectedMinute = ref('00')

const hourItems = Array.from({ length: 24 }, (_, hour) => {
  const value = String(hour).padStart(2, '0')
  return { title: value, value }
})

const minuteItems = Array.from({ length: 60 }, (_, minute) => {
  const value = String(minute).padStart(2, '0')
  return { title: value, value }
})

const displayValue = computed(() => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(props.modelValue)
  return match
    ? `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`
    : ''
})

function syncFromValue(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value)

  if (match) {
    selectedDate.value = match[1]
    selectedHour.value = match[2]
    selectedMinute.value = match[3]
    return
  }

  const now = new Date()
  selectedDate.value = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  selectedHour.value = '18'
  selectedMinute.value = '00'
}

watch(() => props.modelValue, syncFromValue, { immediate: true })

function updateValue() {
  if (!selectedDate.value) return

  emit(
    'update:modelValue',
    `${selectedDate.value}T${selectedHour.value}:${selectedMinute.value}`,
  )
}

function onDateUpdate(value: unknown) {
  const date = Array.isArray(value) ? value[0] : value
  if (typeof date !== 'string') return

  selectedDate.value = date
  updateValue()
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
        :class="props.class"
        readonly
        variant="outlined"
        @click:clear="clearValue"
      />
    </template>

    <v-card min-width="320">
      <v-date-picker
        :model-value="selectedDate"
        color="primary"
        show-adjacent-months
        @update:model-value="onDateUpdate"
      />
      <v-divider />
      <v-card-text>
        <div class="text-subtitle-2 mb-2">時刻（日本時間）</div>
        <v-row dense>
          <v-col cols="6">
            <v-select
              v-model="selectedHour"
              :items="hourItems"
              label="時"
              variant="outlined"
              density="comfortable"
              hide-details
              @update:model-value="updateValue"
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="selectedMinute"
              :items="minuteItems"
              label="分"
              variant="outlined"
              density="comfortable"
              hide-details
              @update:model-value="updateValue"
            />
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="menuOpen = false">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

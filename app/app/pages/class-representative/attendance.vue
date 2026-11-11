<template>
  <v-container class="attendance-page py-6">
    <div class="d-flex align-center ga-3 mb-4">
      <LayoutBackButton />
      <div>
        <div class="text-overline text-medium-emphasis">CLASS REPRESENTATIVE</div>
        <h1 class="text-h5 font-weight-bold">出欠管理</h1>
      </div>
    </div>

    <v-card rounded="xl" variant="outlined" class="mb-4">
      <v-card-text>
        <div class="d-flex flex-wrap align-center justify-space-between ga-3">
          <CommonJstDatePicker
            :model-value="selectedDate"
            label="対象日"
            density="comfortable"
            hide-details
            @update:model-value="handleDateChange"
          />
          <v-btn :loading="loading" prepend-icon="mdi-refresh" variant="tonal" @click="loadAttendance">
            更新
          </v-btn>
        </div>
        <v-alert v-if="error" type="error" variant="tonal" density="comfortable" class="mt-4">
          {{ error }}
        </v-alert>
      </v-card-text>
    </v-card>

    <v-row class="mb-2" dense>
      <v-col v-for="item in summaryItems" :key="item.key" cols="6" sm="4" md="2">
        <v-card rounded="lg" variant="tonal" :color="item.color">
          <v-card-text class="py-3">
            <div class="text-h5 font-weight-bold">{{ counts[item.key] }}</div>
            <div class="text-caption">{{ item.label }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card rounded="xl" variant="outlined">
      <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
        <span>クラス名簿</span>
        <v-chip size="small" variant="tonal">{{ counts.total }}人</v-chip>
      </v-card-title>
      <v-divider />
      <v-progress-linear v-if="loading" indeterminate />
      <v-table v-else density="comfortable">
        <thead>
          <tr>
            <th>メンバー</th>
            <th>GPS確認</th>
            <th class="status-column">出欠</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in records" :key="record.user_id">
            <td>
              <div class="font-weight-medium">{{ record.nickname || record.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ record.student_number }}</div>
            </td>
            <td>
              <v-chip
                v-if="record.gps_checked_in_at"
                color="success"
                size="small"
                variant="tonal"
              >
                {{ formatTime(record.gps_checked_in_at) }}
              </v-chip>
              <span v-else class="text-caption text-medium-emphasis">未確認</span>
            </td>
            <td class="status-column">
              <v-select
                :model-value="record.status"
                :items="statusOptions"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                min-width="130"
                :disabled="savingUserId === record.user_id"
                @update:model-value="updateStatus(record, $event)"
              />
            </td>
          </tr>
          <tr v-if="records.length === 0">
            <td colspan="3" class="text-center text-medium-emphasis py-8">
              メンバーが登録されていません。
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
    <p class="text-caption text-medium-emphasis mt-3">
      GPSで校内と判定されると自動で出席になります。クラ代による手動変更はGPSの再判定では上書きされません。
    </p>
  </v-container>
</template>

<script setup lang="ts">
import { getDefaultTimeZone } from '~/utils/jst'
import { onMounted, ref } from 'vue'
import { useApi } from '~/composables/useApi'

definePageMeta({
  middleware: ['auth', 'class-representative'],
})

type AttendanceStatus = 'present' | 'absent' | 'late' | 'early_leave' | 'excused' | 'unconfirmed'
type AttendanceRecord = {
  user_id: string
  student_number: string
  name: string
  nickname: string | null
  status: AttendanceStatus
  source: 'gps' | 'manual' | null
  gps_checked_in_at: string | null
  note: string | null
}
type AttendanceCounts = {
  present: number
  absent: number
  late: number
  early_leave: number
  excused: number
  unconfirmed: number
  total: number
}

const { apiFetch } = useApi()
const selectedDate = ref(new Date().toLocaleDateString('sv-SE', { timeZone: getDefaultTimeZone() }))
const records = ref<AttendanceRecord[]>([])
const counts = ref<AttendanceCounts>({
  present: 0, absent: 0, late: 0, early_leave: 0, excused: 0, unconfirmed: 0, total: 0,
})
const loading = ref(false)
const error = ref('')
const savingUserId = ref<string | null>(null)

const statusOptions = [
  { title: '出席', value: 'present' },
  { title: '欠席', value: 'absent' },
  { title: '未確認', value: 'unconfirmed' },
]
const summaryItems: { key: keyof Omit<AttendanceCounts, 'total'>; label: string; color: string }[] = [
  { key: 'present', label: '出席', color: 'success' },
  { key: 'absent', label: '欠席', color: 'error' },
  { key: 'unconfirmed', label: '未確認', color: 'surface-variant' },
]

function handleDateChange(value: string) {
  selectedDate.value = value
  void loadAttendance()
}

async function loadAttendance() {
  loading.value = true
  error.value = ''
  try {
    const result = await apiFetch<{
      records: AttendanceRecord[]
      counts: AttendanceCounts
    }>(`/api/presence/attendance?date=${encodeURIComponent(selectedDate.value)}`)
    records.value = result.records
    counts.value = result.counts
  } catch (cause: any) {
    error.value = cause?.data?.error || '出欠情報を取得できませんでした。'
  } finally {
    loading.value = false
  }
}

async function updateStatus(record: AttendanceRecord, status: AttendanceStatus) {
  if (status === record.status) return
  const previous = record.status
  record.status = status
  savingUserId.value = record.user_id
  error.value = ''
  try {
    await apiFetch(`/api/presence/attendance/${record.user_id}`, {
      method: 'PATCH',
      body: { date: selectedDate.value, status },
    })
    await loadAttendance()
  } catch (cause: any) {
    record.status = previous
    error.value = cause?.data?.error || '出欠状況を保存できませんでした。'
  } finally {
    savingUserId.value = null
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ja-JP', {
    timeZone: getDefaultTimeZone(),
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(loadAttendance)
</script>

<style scoped>
.attendance-page {
  max-width: 1100px;
}
.status-column {
  min-width: 150px;
}
</style>

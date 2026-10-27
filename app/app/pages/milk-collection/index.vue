<template>
  <v-container fluid class="pa-4 pa-sm-6">
    <div class="d-flex align-center ga-3 mb-6">
      <v-avatar color="primary" variant="tonal" rounded="lg"><v-icon icon="mdi-recycle" /></v-avatar>
      <div class="flex-grow-1">
        <h1 class="text-h5 font-weight-bold">牛乳パック外部受け取り</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">候補の提案からクラ代レビュー、チーフ会の審議、店舗への連絡、回収までを記録します。</p>
      </div>
      <v-btn v-if="auth.hasPermission('milk_collection.create')" color="primary" prepend-icon="mdi-plus" @click="createDialog = true">候補を提案</v-btn>
    </div>

    <v-alert v-if="!auth.hasPermission('milk_collection.view')" type="warning" variant="tonal">閲覧権限がありません。</v-alert>
    <template v-else>
      <v-alert v-if="errorMessage" type="error" variant="tonal" closable class="mb-4">{{ errorMessage }}</v-alert>
      <v-row class="mb-2">
        <v-col v-for="item in summary" :key="item.label" cols="6" sm="3">
          <v-card variant="outlined" rounded="xl"><v-card-text><div class="text-body-2 text-medium-emphasis">{{ item.label }}</div><div class="text-h4 font-weight-bold">{{ item.value }}</div></v-card-text></v-card>
        </v-col>
      </v-row>
      <div class="d-flex align-center mb-3 ga-2">
        <v-text-field v-model="search" label="候補を検索" prepend-inner-icon="mdi-magnify" clearable hide-details density="comfortable" variant="outlined" />
        <v-select v-model="statusFilter" :items="statusOptions" label="状態" clearable hide-details density="comfortable" variant="outlined" style="max-width: 220px" />
        <v-btn icon="mdi-refresh" variant="text" aria-label="再読み込み" :loading="loading" @click="loadRequests" />
      </div>
      <v-progress-linear v-if="loading" indeterminate class="mb-3" />
      <v-row v-if="filteredRequests.length">
        <v-col v-for="item in filteredRequests" :key="item.id" cols="12" md="6">
          <v-card variant="outlined" rounded="xl" class="h-100">
            <v-card-item>
              <template #prepend><v-avatar color="primary" variant="tonal" rounded="lg"><v-icon icon="mdi-store-outline" /></v-avatar></template>
              <template #append><v-chip :color="statusColor(item.status)" variant="tonal" size="small">{{ statusLabel(item.status) }}</v-chip></template>
              <v-card-title class="text-wrap">{{ item.title }}</v-card-title>
              <v-card-subtitle>{{ item.store_name }}</v-card-subtitle>
            </v-card-item>
            <v-card-text>
              <div class="text-body-2">{{ item.proposal_reason }}</div>
              <div class="text-caption text-medium-emphasis mt-3">提案者：{{ item.proposer_name || '不明' }} ・ {{ formatDate(item.created_at) }}</div>
              <div v-if="item.scheduled_at" class="text-body-2 mt-2"><v-icon icon="mdi-calendar" size="small" /> 回収予定：{{ formatDate(item.scheduled_at) }}</div>
            </v-card-text>
            <v-card-actions><v-btn variant="tonal" prepend-icon="mdi-source-pull" @click="openDetail(item.id)">詳細・レビュー</v-btn><v-spacer /><span class="text-caption text-medium-emphasis">更新 {{ formatDate(item.updated_at) }}</span></v-card-actions>
          </v-card>
        </v-col>
      </v-row>
      <v-card v-else-if="!loading" variant="outlined" rounded="xl"><v-card-text class="text-center py-10"><v-icon icon="mdi-inbox-outline" size="42" class="mb-2" /><div class="text-subtitle-1 font-weight-bold">候補はまだありません</div><div class="text-body-2 text-medium-emphasis mt-1">外部の受け取り先候補を提案すると、ここに表示されます。</div></v-card-text></v-card>
    </template>

    <v-dialog v-model="createDialog" max-width="680" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-5">受け取り先候補を提案</v-card-title><v-divider />
        <v-card-text class="pa-5"><v-form @submit.prevent="createRequest">
          <v-text-field v-model="form.title" label="候補名" placeholder="例：〇〇スーパーでの牛乳パック回収" required maxlength="200" />
          <v-text-field v-model="form.store_name" label="店舗・施設名" required />
          <v-text-field v-model="form.address" label="住所（任意）" />
          <v-text-field v-model="form.contact_info" label="連絡先メモ（任意）" />
          <v-text-field v-model.number="form.expected_quantity" label="想定回収量（枚・任意）" type="number" min="0" />
          <v-textarea v-model="form.proposal_reason" label="提案理由・補足" required rows="4" />
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">店舗への連絡はチーフ会の承認後に行います。このフォームでは候補の提案のみを登録します。</v-alert>
          <div class="d-flex justify-end ga-2"><v-btn variant="text" @click="createDialog = false">キャンセル</v-btn><v-btn color="primary" type="submit" :loading="saving">提案する</v-btn></div>
        </v-form></v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="detailDialog" max-width="900" scrollable>
      <v-card v-if="detail" rounded="xl">
        <v-card-title class="pa-5 d-flex align-center ga-2"><div class="flex-grow-1">{{ detail.request.title }}</div><v-chip :color="statusColor(detail.request.status)" variant="tonal">{{ statusLabel(detail.request.status) }}</v-chip></v-card-title>
        <v-divider />
        <v-card-text class="pa-5">
          <div class="text-h6 mb-1">{{ detail.request.store_name }}</div>
          <div class="text-body-2">{{ detail.request.proposal_reason }}</div>
          <div class="text-body-2 text-medium-emphasis mt-2">提案者：{{ detail.request.proposer_name || '不明' }} ・ {{ formatDate(detail.request.created_at) }}</div>
          <v-row class="mt-2">
            <v-col v-if="detail.request.address" cols="12" sm="6"><div class="text-caption text-medium-emphasis">住所</div>{{ detail.request.address }}</v-col>
            <v-col v-if="detail.request.contact_info" cols="12" sm="6"><div class="text-caption text-medium-emphasis">連絡先メモ</div>{{ detail.request.contact_info }}</v-col>
            <v-col v-if="detail.request.expected_quantity != null" cols="12" sm="6"><div class="text-caption text-medium-emphasis">想定回収量</div>{{ detail.request.expected_quantity }}枚</v-col>
            <v-col v-if="detail.request.scheduled_at" cols="12" sm="6"><div class="text-caption text-medium-emphasis">回収予定</div>{{ formatDate(detail.request.scheduled_at) }}</v-col>
          </v-row>
          <v-divider class="my-5" />
          <div class="text-subtitle-1 font-weight-bold mb-3">レビュー・進捗</div>
          <v-alert v-if="detail.request.representative_note" type="info" variant="tonal" class="mb-3">クラ代コメント：{{ detail.request.representative_note }}</v-alert>
          <v-alert v-if="detail.request.chief_review_note" type="info" variant="tonal" class="mb-3">チーフ会記録：{{ detail.request.chief_review_note }}</v-alert>
          <v-alert v-if="detail.request.store_contact_note" type="info" variant="tonal" class="mb-3">店舗連絡記録：{{ detail.request.store_contact_note }}</v-alert>
          <v-textarea v-model="actionNote" label="レビュー・結果のメモ" rows="2" auto-grow />
          <v-text-field v-model="scheduledAt" label="回収予定日時（任意）" type="datetime-local" />
          <v-text-field v-model.number="collectedQuantity" label="回収実績（枚・任意）" type="number" min="0" />
          <div class="d-flex flex-wrap ga-2 mb-5">
            <v-btn v-if="auth.hasPermission('milk_collection.review') && ['submitted','changes_requested'].includes(detail.request.status)" color="primary" variant="tonal" prepend-icon="mdi-check" :loading="saving" @click="runAction('representative_reviewed')">確認済み</v-btn>
            <v-btn v-if="auth.hasPermission('milk_collection.review') && ['submitted','changes_requested'].includes(detail.request.status)" color="warning" variant="tonal" prepend-icon="mdi-comment-alert-outline" :loading="saving" @click="runAction('request_changes')">修正依頼</v-btn>
            <v-btn v-if="auth.hasPermission('milk_collection.submit_to_chief') && detail.request.status === 'representative_reviewed'" color="primary" variant="tonal" @click="runAction('submit_to_chief')">チーフ会へ審議依頼</v-btn>
            <v-btn v-if="auth.hasPermission('milk_collection.record_review') && detail.request.status === 'chief_review_pending'" color="success" variant="tonal" @click="runAction('chief_approved')">チーフ会：承認</v-btn>
            <v-btn v-if="auth.hasPermission('milk_collection.record_review') && detail.request.status === 'chief_review_pending'" color="error" variant="tonal" @click="runAction('chief_rejected')">チーフ会：否決</v-btn>
            <v-btn v-if="auth.hasPermission('milk_collection.record_contact') && ['chief_approved','contact_pending','contacted'].includes(detail.request.status)" variant="tonal" @click="runAction('contacted')">電話結果を記録</v-btn>
            <v-btn v-if="auth.hasPermission('milk_collection.record_contact') && ['chief_approved','contact_pending','contacted'].includes(detail.request.status)" color="success" variant="tonal" @click="runAction('store_approved')">店舗：許可</v-btn>
            <v-btn v-if="auth.hasPermission('milk_collection.record_contact') && ['chief_approved','contact_pending','contacted'].includes(detail.request.status)" color="error" variant="tonal" @click="runAction('store_rejected')">店舗：不可</v-btn>
            <v-btn v-if="auth.hasPermission('milk_collection.manage_schedule') && detail.request.status === 'store_approved'" variant="tonal" @click="runAction('scheduling')">日程調整へ</v-btn>
            <v-btn v-if="auth.hasPermission('milk_collection.manage_schedule') && ['store_approved','scheduling'].includes(detail.request.status)" variant="tonal" @click="runAction('collecting')">回収開始</v-btn>
            <v-btn v-if="auth.hasPermission('milk_collection.manage_schedule') && detail.request.status === 'collecting'" color="success" variant="tonal" @click="runAction('completed')">回収完了</v-btn>
          </div>
          <v-divider class="my-5" />
          <div class="text-subtitle-1 font-weight-bold mb-3">コメント</div>
          <div v-if="detail.comments.length" class="d-flex flex-column ga-3 mb-4">
            <v-card v-for="comment in detail.comments" :key="comment.id" variant="tonal" rounded="lg"><v-card-text><div class="text-body-2">{{ comment.body }}</div><div class="text-caption text-medium-emphasis mt-2">{{ comment.author_name || '不明' }} ・ {{ formatDate(comment.created_at) }}</div></v-card-text></v-card>
          </div>
          <div v-else class="text-body-2 text-medium-emphasis mb-3">コメントはありません。</div>
          <div v-if="auth.hasPermission('milk_collection.comment')" class="d-flex align-start ga-2"><v-textarea v-model="commentText" label="コメントを追加" rows="2" auto-grow hide-details /><v-btn color="primary" :disabled="!commentText.trim()" :loading="saving" @click="addComment">投稿</v-btn></div>
          <v-divider class="my-5" />
          <div class="text-subtitle-1 font-weight-bold mb-3">変更履歴</div>
          <v-timeline side="end" density="compact" truncate-line="both">
            <v-timeline-item v-for="event in detail.history" :key="event.id" dot-color="primary" size="small">
              <div class="text-body-2 font-weight-medium">{{ historyLabel(event.action) }}</div>
              <div class="text-caption text-medium-emphasis">{{ event.actor_name || '不明' }} ・ {{ formatDate(event.created_at) }}</div>
              <div v-if="event.details" class="text-body-2 mt-1">{{ historyDetails(event.details) }}</div>
            </v-timeline-item>
          </v-timeline>
        </v-card-text>
        <v-divider /><v-card-actions class="pa-4"><v-spacer /><v-btn variant="text" @click="detailDialog = false">閉じる</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useApi, type MilkCollectionDetailResponse, type MilkCollectionRequest, type MilkCollectionStatus } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

const api = useApi()
const auth = useAuthStore()
const requests = ref<MilkCollectionRequest[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const search = ref('')
const statusFilter = ref<MilkCollectionStatus | null>(null)
const createDialog = ref(false)
const detailDialog = ref(false)
const detail = ref<MilkCollectionDetailResponse | null>(null)
const actionNote = ref('')
const commentText = ref('')
const scheduledAt = ref('')
const collectedQuantity = ref<number | null>(null)
const form = reactive({ title: '', store_name: '', address: '', contact_info: '', expected_quantity: null as number | null, proposal_reason: '' })

const statusOptions = [
 { title: '提案受付', value: 'submitted' }, { title: '修正依頼', value: 'changes_requested' },
 { title: 'クラ代確認済み', value: 'representative_reviewed' }, { title: 'チーフ会審議中', value: 'chief_review_pending' },
 { title: 'チーフ会承認', value: 'chief_approved' }, { title: 'チーフ会否決', value: 'chief_rejected' },
 { title: '店舗連絡中', value: 'contacted' }, { title: '店舗許可', value: 'store_approved' },
 { title: '店舗不可', value: 'store_rejected' }, { title: '日程調整', value: 'scheduling' },
 { title: '回収中', value: 'collecting' }, { title: '完了', value: 'completed' }, { title: '中止', value: 'cancelled' },
]
const summary = computed(() => [
 { label: '候補総数', value: requests.value.length },
 { label: 'クラ代確認待ち', value: requests.value.filter(x => ['submitted','changes_requested'].includes(x.status)).length },
 { label: 'チーフ会審議中', value: requests.value.filter(x => x.status === 'chief_review_pending').length },
 { label: '回収進行中', value: requests.value.filter(x => ['store_approved','scheduling','collecting'].includes(x.status)).length },
])
const filteredRequests = computed(() => requests.value.filter(x => {
 const q = search.value.trim().toLowerCase()
 return (!q || [x.title,x.store_name,x.proposal_reason,x.proposer_name || ''].some(v => v.toLowerCase().includes(q)))
   && (!statusFilter.value || x.status === statusFilter.value)
}))
function statusLabel(s: MilkCollectionStatus) { return statusOptions.find(x => x.value === s)?.title || ({ contact_pending: '店舗連絡待ち' } as Record<string,string>)[s] || s }
function statusColor(s: MilkCollectionStatus) { if (['completed','store_approved','chief_approved'].includes(s)) return 'success'; if (['changes_requested','chief_rejected','store_rejected','cancelled'].includes(s)) return 'error'; if (['collecting','scheduling','contacted','chief_review_pending'].includes(s)) return 'info'; return 'primary' }
function formatDate(value: string | null) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('ja-JP',{ timeZone:'Asia/Tokyo', dateStyle:'medium', timeStyle:'short' }).format(d) }
function historyLabel(action: string) { const labels: Record<string,string> = { submitted:'候補を提案', changes_requested:'修正依頼', representative_reviewed:'クラ代確認済み', submitted_to_chief:'チーフ会へ審議依頼', chief_approved:'チーフ会で承認', chief_rejected:'チーフ会で否決', contacted:'店舗への連絡を記録', store_approved:'店舗から許可', store_rejected:'店舗から不可の回答', scheduling:'日程調整', collecting:'回収開始', completed:'回収完了', commented:'コメント投稿', cancelled:'中止' }; return labels[action] || action }
function historyDetails(raw: string) { try { const d = JSON.parse(raw) as Record<string, unknown>; return String(d.note || d.representative_note || d.chief_review_note || d.store_contact_note || '') } catch { return '' } }
async function loadRequests() { loading.value = true; errorMessage.value = ''; try { const r = await api.getMilkCollectionRequests(); requests.value = r.requests } catch { errorMessage.value = '候補一覧を読み込めませんでした。閲覧権限とAPIの状態を確認してください。' } finally { loading.value = false } }
async function createRequest() { saving.value = true; errorMessage.value = ''; try { await api.createMilkCollectionRequest({ ...form }); createDialog.value = false; Object.assign(form,{ title:'',store_name:'',address:'',contact_info:'',expected_quantity:null,proposal_reason:'' }); await loadRequests() } catch { errorMessage.value = '候補を登録できませんでした。入力内容と権限を確認してください。' } finally { saving.value = false } }
async function openDetail(id: string) { errorMessage.value = ''; try { detail.value = await api.getMilkCollectionRequest(id); actionNote.value=''; commentText.value=''; scheduledAt.value=detail.value.request.scheduled_at ? detail.value.request.scheduled_at.slice(0,16) : ''; collectedQuantity.value=detail.value.request.collected_quantity; detailDialog.value=true } catch { errorMessage.value='詳細を読み込めませんでした。'; } }
async function runAction(action: string) { if (!detail.value) return; saving.value=true; errorMessage.value=''; try { const payload: Record<string,unknown>={ action, note: actionNote.value }; if (['scheduling','collecting','completed'].includes(action)) { if (scheduledAt.value) payload.scheduled_at = new Date(scheduledAt.value).toISOString(); if (collectedQuantity.value !== null) payload.collected_quantity=collectedQuantity.value; } await api.updateMilkCollectionRequest(detail.value.request.id,payload); await openDetail(detail.value.request.id); await loadRequests() } catch { errorMessage.value='操作に失敗しました。権限、現在の状態、入力内容を確認してください。' } finally { saving.value=false } }
async function addComment() { if (!detail.value || !commentText.value.trim()) return; saving.value=true; try { await api.addMilkCollectionComment(detail.value.request.id,commentText.value.trim()); commentText.value=''; await openDetail(detail.value.request.id); await loadRequests() } catch { errorMessage.value='コメントを投稿できませんでした。権限を確認してください。' } finally { saving.value=false } }
onMounted(() => { if (auth.hasPermission('milk_collection.view')) void loadRequests() })
</script>

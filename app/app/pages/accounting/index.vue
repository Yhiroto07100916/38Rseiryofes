<template>
  <v-container class="py-6" style="max-width: 1200px">
    <BackButton />

    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-5">
      <div>
        <h1 class="text-h4 font-weight-bold">会計</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          38Rの予算・購入・立替を管理します
        </p>
      </div>

      <v-btn
        v-if="canCreate"
        color="primary"
        prepend-icon="mdi-receipt-text-plus"
        size="large"
        rounded="lg"
        @click="openReceiptCreate"
      >
        レシートを登録
      </v-btn>
    </div>

    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      closable
      class="mb-5"
      @click:close="errorMessage = ''"
    >
      {{ errorMessage }}
    </v-alert>

    <v-progress-linear
      v-if="loading"
      indeterminate
      color="primary"
      class="mb-5"
    />

    <template v-if="canView">
      <v-row class="mb-2">
        <v-col cols="12" sm="6" md="3">
          <v-card rounded="xl" variant="outlined" class="h-100">
            <v-card-text>
              <div class="text-body-2 text-medium-emphasis">総予算</div>
              <div class="text-h5 font-weight-bold mt-2">
                {{ yen(summary.totalBudget) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-card rounded="xl" variant="outlined" class="h-100">
            <v-card-text>
              <div class="text-body-2 text-medium-emphasis">購入額</div>
              <div class="text-h5 font-weight-bold mt-2">
                {{ yen(summary.totalPurchased) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-card rounded="xl" variant="outlined" class="h-100">
            <v-card-text>
              <div class="text-body-2 text-medium-emphasis">残予算</div>
              <div
                class="text-h5 font-weight-bold mt-2"
                :class="remainingBudget < 0 ? 'text-error' : 'text-success'"
              >
                {{ yen(remainingBudget) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-card rounded="xl" variant="outlined" class="h-100">
            <v-card-text>
              <div class="text-body-2 text-medium-emphasis">未精算の立替</div>
              <div class="text-h5 font-weight-bold mt-2 text-warning">
                {{ yen(summary.pendingReimbursements) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-tabs v-model="tab" color="primary" class="mb-4">
        <v-tab value="receipts">購入記録</v-tab>
        <v-tab value="budgets">予算</v-tab>
        <v-tab value="reimbursements">立替精算</v-tab>
      </v-tabs>

      <v-window v-model="tab">
        <v-window-item value="receipts">
          <v-card rounded="xl" variant="outlined">
            <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-3 py-4">
              <span>購入記録</span>

              <div class="d-flex align-center flex-wrap ga-2">
                <v-text-field
                  v-model="receiptSearch"
                  prepend-inner-icon="mdi-magnify"
                  label="検索"
                  placeholder="店名・商品名"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  style="min-width: 220px; max-width: 280px"
                />

                <v-select
                  v-model="receiptPaymentFilter"
                  :items="receiptPaymentFilterItems"
                  label="支払方法"
                  density="compact"
                  variant="outlined"
                  hide-details
                  style="min-width: 150px; max-width: 180px"
                />

                <v-select
                  v-model="receiptReimbursementFilter"
                  :items="receiptReimbursementFilterItems"
                  label="立替状態"
                  density="compact"
                  variant="outlined"
                  hide-details
                  style="min-width: 150px; max-width: 180px"
                />

                <v-btn
                  variant="outlined"
                  prepend-icon="mdi-file-delimited-outline"
                  @click="exportReceiptsCsv"
                >
                  CSV出力
                </v-btn>
              </div>
            </v-card-title>

            <v-divider />

            <v-card-text class="pa-4">
              <v-card variant="outlined" rounded="lg">
                <v-card-title class="text-subtitle-1 font-weight-bold py-3">
                  会計集計
                </v-card-title>

                <v-card-text class="pt-1">
                  <v-row>
                    <v-col cols="12" sm="6" md="3">
                      <v-text-field
                        v-model="aggregationMonth"
                        label="月別集計"
                        type="month"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                      />
                    </v-col>

                    <v-col cols="12" sm="6" md="3">
                      <v-text-field
                        v-model="aggregationStartDate"
                        label="期間開始"
                        type="date"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                        clearable
                      />
                    </v-col>

                    <v-col cols="12" sm="6" md="3">
                      <v-text-field
                        v-model="aggregationEndDate"
                        label="期間終了"
                        type="date"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                        clearable
                      />
                    </v-col>

                    <v-col cols="12" sm="6" md="3" class="d-flex align-center">
                      <v-btn
                        variant="text"
                        @click="resetAggregationPeriod"
                      >
                        今月に戻す
                      </v-btn>
                    </v-col>
                  </v-row>

                  <v-row class="mt-1">
                    <v-col cols="12" sm="6" md="4">
                      <div class="text-body-2 text-medium-emphasis">
                        今月の支出
                      </div>
                      <div class="text-h5 font-weight-bold mt-1">
                        {{ yen(currentMonthPurchased) }}
                      </div>
                    </v-col>

                    <v-col cols="12" sm="6" md="4">
                      <div class="text-body-2 text-medium-emphasis">
                        指定期間の支出
                      </div>
                      <div class="text-h5 font-weight-bold mt-1">
                        {{ yen(aggregationPurchased) }}
                      </div>
                    </v-col>

                    <v-col cols="12" sm="6" md="4">
                      <div class="text-body-2 text-medium-emphasis">
                        指定期間の購入件数
                      </div>
                      <div class="text-h5 font-weight-bold mt-1">
                        {{ aggregationReceiptCount }}件
                      </div>
                    </v-col>
                  </v-row>

                  <div class="d-flex justify-end mt-2">
                    <v-btn
                      variant="outlined"
                      prepend-icon="mdi-file-pdf-box"
                      @click="printAccountingReport"
                    >
                      PDF出力
                    </v-btn>
                  </div>

                  <v-divider class="my-4" />

                  <div class="text-subtitle-2 font-weight-bold mb-2">
                    指定期間の月別支出
                  </div>

                  <v-list
                    v-if="monthlyAggregation.length > 0"
                    density="compact"
                    class="pa-0"
                  >
                    <v-list-item
                      v-for="item in monthlyAggregation"
                      :key="item.month"
                      class="px-0"
                    >
                      <v-list-item-title>
                        {{ item.label }}
                      </v-list-item-title>

                      <template #append>
                        <span class="font-weight-bold">
                          {{ yen(item.amount) }}
                        </span>
                      </template>
                    </v-list-item>
                  </v-list>

                  <div
                    v-else
                    class="text-body-2 text-medium-emphasis"
                  >
                    指定期間の購入記録はありません
                  </div>

                  <v-divider class="my-4" />

                  <div class="text-subtitle-2 font-weight-bold mb-2">
                    立替中の金額
                  </div>

                  <v-list
                    v-if="pendingAdvanceByUser.length > 0"
                    density="compact"
                    class="pa-0"
                  >
                    <v-list-item
                      v-for="item in pendingAdvanceByUser"
                      :key="item.userId"
                      class="px-0"
                    >
                      <v-list-item-title>
                        {{ item.name }}
                      </v-list-item-title>

                      <template #append>
                        <span class="font-weight-bold text-warning">
                          {{ yen(item.amount) }}
                        </span>
                      </template>
                    </v-list-item>
                  </v-list>

                  <div
                    v-else
                    class="text-body-2 text-medium-emphasis"
                  >
                    現在、未精算の立替はありません
                  </div>
                </v-card-text>
              </v-card>
            </v-card-text>

            <v-card-text v-if="filteredReceipts.length === 0" class="py-12 text-center">
              <v-icon size="52" color="grey">mdi-receipt-text-outline</v-icon>
              <div class="text-body-1 mt-3">購入記録がありません</div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                レシートを登録するとここに表示されます
              </div>
            </v-card-text>

            <div v-else>
              <v-list lines="two">
                <template
                  v-for="(receipt, index) in filteredReceipts"
                  :key="receipt.id"
                >
                  <v-list-item @click="openReceiptEdit(receipt)">
                    <template #prepend>
                      <v-avatar color="primary" variant="tonal" class="mr-3">
                        <v-icon>mdi-receipt</v-icon>
                      </v-avatar>
                      <v-btn
                        v-if="receipt.files?.length"
                        icon="mdi-image-multiple-outline"
                        variant="tonal"
                        color="primary"
                        size="small"
                        class="mr-2"
                        aria-label="レシート画像を表示"
                        :title="`レシート画像 ${receipt.files.length} 件を表示`"
                        @click.stop="openReceiptImagePreview(receipt)"
                      />
                    </template>

                    <v-list-item-title class="font-weight-medium">
                      {{ receipt.store_name || '購入先未設定' }}
                    </v-list-item-title>

                    <v-list-item-subtitle>
                      {{ formatDate(receipt.purchased_at) }}
                      <span class="mx-1">·</span>
                      {{ receiptItemSummary(receipt) }}
                    </v-list-item-subtitle>

                    <template #append>
                      <div class="text-right mr-3">
                        <div class="font-weight-bold">
                          {{ yen(receipt.total_amount) }}
                        </div>
                        <v-chip
                          size="x-small"
                          class="mt-1"
                          :color="receipt.payment_method === 'advance' ? 'warning' : 'primary'"
                          variant="tonal"
                        >
                          {{ receipt.payment_method === 'advance' ? '立替' : '予算' }}
                        </v-chip>
                      </div>

                      <v-btn
                        v-if="canEdit"
                        icon="mdi-pencil"
                        variant="text"
                        @click.stop="openReceiptEdit(receipt)"
                      />
                    </template>
                  </v-list-item>

                  <v-divider v-if="index < filteredReceipts.length - 1" />
                </template>
              </v-list>
            </div>
          </v-card>
        </v-window-item>

        <v-window-item value="budgets">
          <v-card rounded="xl" variant="outlined" class="mb-4">
            <v-card-title class="py-4">
              予算原資
            </v-card-title>

            <v-divider />

            <v-card-text class="pa-5">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="budgetSourceForm.class_collection"
                    label="クラス徴収金"
                    type="number"
                    min="0"
                    variant="outlined"
                    suffix="円"
                    :disabled="!canCreate && !canEdit"
                  />
                </v-col>

                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="budgetSourceForm.organization_subsidy"
                    label="団体補助費"
                    type="number"
                    min="0"
                    variant="outlined"
                    suffix="円"
                    :disabled="!canCreate && !canEdit"
                  />
                </v-col>
              </v-row>

              <v-divider class="my-2" />

              <div class="d-flex align-center justify-space-between">
                <span class="text-body-1 font-weight-medium">
                  総予算
                </span>

                <span class="text-h6 font-weight-bold">
                  {{ yen(budgetSourceTotal) }}
                </span>
              </div>

              <div class="d-flex justify-end mt-4">
                <v-btn
                  v-if="canCreate || canEdit"
                  color="primary"
                  variant="tonal"
                  :loading="budgetSourceSaving"
                  @click="saveBudgetSources"
                >
                  原資を保存
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <v-card rounded="xl" variant="outlined">
            <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-3 py-4">
              <span>予算内訳</span>

              <v-btn
                v-if="canCreate"
                variant="tonal"
                prepend-icon="mdi-plus"
                @click="openBudgetDialog()"
              >
                予算を登録
              </v-btn>
            </v-card-title>

            <v-divider />

            <v-card-text v-if="budgetItems.length === 0" class="py-12 text-center">
              <v-icon size="52" color="grey">mdi-wallet-outline</v-icon>
              <div class="text-body-1 mt-3">予算項目がありません</div>
            </v-card-text>

            <v-list v-else>
              <template
                v-for="(item, index) in budgetItems"
                :key="item.id"
              >
                <v-list-item>
                  <v-list-item-title class="font-weight-medium">
                    {{ item.name }}
                  </v-list-item-title>

                  <v-list-item-subtitle class="mt-1">
                    予算 {{ yen(item.budget_amount) }}
                    <span class="mx-1">·</span>
                    使用 {{ yen(item.used_amount) }}
                  </v-list-item-subtitle>

                  <template #append>
                    <div class="text-right mr-2">
                      <div
                        class="font-weight-bold"
                        :class="budgetRemaining(item) < 0 ? 'text-error' : ''"
                      >
                        <template v-if="budgetRemaining(item) < 0">
                          予算超過 {{ yen(Math.abs(budgetRemaining(item))) }}
                        </template>
                        <template v-else>
                          残 {{ yen(budgetRemaining(item)) }}
                        </template>
                      </div>
                    </div>

                    <v-btn
                      v-if="canEdit"
                      icon="mdi-pencil"
                      variant="text"
                      @click="openBudgetDialog(item)"
                    />
                  </template>
                </v-list-item>

                <v-divider v-if="index < budgetItems.length - 1" />
              </template>
            </v-list>
          </v-card>
        </v-window-item>

        <v-window-item value="reimbursements">
          <v-card rounded="xl" variant="outlined">
            <v-card-title class="py-4">
              立替精算
            </v-card-title>

            <v-divider />

            <v-card-text v-if="reimbursements.length === 0" class="py-12 text-center">
              <v-icon size="52" color="grey">mdi-cash-check</v-icon>
              <div class="text-body-1 mt-3">立替精算はありません</div>
            </v-card-text>

            <v-list v-else>
              <template
                v-for="(item, index) in reimbursements"
                :key="item.id"
              >
                <v-list-item>
                  <v-list-item-title class="font-weight-medium">
                    {{ item.user_name || item.user_nickname || '支払者未設定' }}
                  </v-list-item-title>

                  <v-list-item-subtitle class="mt-1">
                    {{ item.store_name || '購入先未設定' }}
                    <span class="mx-1">·</span>
                    {{ formatDate(item.purchased_at) }}
                  </v-list-item-subtitle>

                  <template #append>
                    <div class="text-right mr-3">
                      <div class="font-weight-bold">
                        {{ yen(item.amount) }}
                      </div>
                      <v-chip
                        size="x-small"
                        class="mt-1"
                        :color="reimbursementColor(item.status)"
                        variant="tonal"
                      >
                        {{ reimbursementLabel(item.status) }}
                      </v-chip>
                    </div>

                    <v-btn
                      v-if="canApprove && item.status === 'pending'"
                      color="success"
                      variant="tonal"
                      size="small"
                      @click="markReimbursementPaid(item)"
                    >
                      精算済みとして記録
                    </v-btn>
                  </template>
                </v-list-item>

                <v-divider v-if="index < reimbursements.length - 1" />
              </template>
            </v-list>
          </v-card>
        </v-window-item>
      </v-window>
    </template>

    <v-alert
      v-else
      type="warning"
      variant="tonal"
      class="mt-4"
    >
      会計を閲覧する権限がありません。
    </v-alert>

    <v-dialog v-model="receiptImagePreviewDialog" max-width="900">
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center justify-space-between ga-2">
          <span class="text-truncate">
            {{ previewReceiptFiles[previewReceiptImageIndex]?.original_name || 'レシート画像' }}
          </span>
          <v-btn
            icon="mdi-close"
            variant="text"
            aria-label="画像プレビューを閉じる"
            @click="receiptImagePreviewDialog = false"
          />
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-3">
          <template v-if="previewReceiptFiles[previewReceiptImageIndex]">
            <v-img
              :key="previewReceiptFiles[previewReceiptImageIndex]!.id"
              :src="receiptImageUrl(previewReceiptFiles[previewReceiptImageIndex]!)"
              :alt="previewReceiptFiles[previewReceiptImageIndex]!.original_name"
              max-height="75vh"
              min-height="180"
              contain
              class="bg-grey-lighten-4 rounded-lg"
            />
          </template>

          <div
            v-if="previewReceiptFiles.length > 1"
            class="d-flex align-center justify-space-between mt-3"
          >
            <v-btn
              prepend-icon="mdi-chevron-left"
              variant="tonal"
              :disabled="previewReceiptImageIndex <= 0"
              @click="previewReceiptImageIndex--"
            >
              前の画像
            </v-btn>
            <span class="text-body-2 text-medium-emphasis">
              {{ previewReceiptImageIndex + 1 }} / {{ previewReceiptFiles.length }}
            </span>
            <v-btn
              append-icon="mdi-chevron-right"
              variant="tonal"
              :disabled="previewReceiptImageIndex >= previewReceiptFiles.length - 1"
              @click="previewReceiptImageIndex++"
            >
              次の画像
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="receiptDialog" max-width="760" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-5">
          {{ editingReceipt ? '購入記録を編集' : 'レシートを登録' }}
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-5">
          <v-card variant="tonal" rounded="lg" class="mb-5">
            <v-card-text>
              <div class="text-subtitle-1 font-weight-bold mb-1">
                レシート画像・自動読み取り
              </div>
              <div class="text-body-2 text-medium-emphasis mb-3">
                JPEG・PNG・WebP画像を選択できます。OCR結果は確認してから保存してください。
              </div>

              <v-file-input
                v-model="receiptImageFiles"
                label="レシート画像"
                accept="image/jpeg,image/png,image/webp"
                multiple
                chips
                show-size
                clearable
                prepend-icon="mdi-camera"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
              />

              <div class="d-flex flex-wrap align-center ga-2 mt-3">
                <v-btn
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-text-recognition"
                  :loading="receiptOcrLoading"
                  :disabled="receiptImageFiles.length === 0 || saving"
                  @click="recognizeReceipt"
                >
                  画像から読み取る
                </v-btn>
                <span class="text-caption text-medium-emphasis">
                  選択した先頭の画像を読み取ります
                </span>
              </div>

              <v-alert
                v-if="receiptImageFiles.length > 0"
                type="info"
                variant="tonal"
                density="compact"
                class="mt-3"
              >
                選択中 {{ receiptImageFiles.length }} 件。購入記録の保存時に添付します。
              </v-alert>

              <template v-if="editingReceipt?.files?.length">
                <v-divider class="my-3" />
                <div class="text-body-2 font-weight-medium mb-2">
                  保存済みの画像
                </div>
                <div
                  v-for="file in editingReceipt.files"
                  :key="file.id"
                  class="d-flex align-center flex-wrap ga-1 mb-1"
                >
                  <v-chip
                    prepend-icon="mdi-paperclip"
                    variant="outlined"
                  >
                    {{ file.original_name }}
                  </v-chip>
                  <v-btn
                    v-if="canEdit"
                    icon="mdi-delete-outline"
                    variant="text"
                    color="error"
                    size="small"
                    aria-label="添付画像を削除"
                    :disabled="deletingReceiptFileId === file.id"
                    :loading="deletingReceiptFileId === file.id"
                    @click="deleteReceiptFile(file)"
                  />
                </div>
              </template>
            </v-card-text>
          </v-card>

          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="receiptForm.purchased_at"
                label="購入日"
                type="date"
                variant="outlined"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-text-field
                v-model="receiptForm.store_name"
                label="購入先"
                variant="outlined"
                placeholder="例：Amazon、東急ハンズ"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-select
                v-model="receiptForm.payment_method"
                label="支払い方法"
                :items="paymentMethodItems"
                variant="outlined"
              />
            </v-col>

            <v-col
              v-if="receiptForm.payment_method === 'advance'"
              cols="12"
              sm="6"
            >
              <v-select
                v-model="receiptForm.paid_by_user_id"
                label="立替者"
                :items="receiptUserItems"
                item-title="title"
                item-value="value"
                variant="outlined"
                clearable
              />
            </v-col>

            <v-col cols="12">
              <v-textarea
                v-model="receiptForm.description"
                label="メモ"
                variant="outlined"
                rows="2"
                auto-grow
              />
            </v-col>
          </v-row>

          <div class="d-flex align-center justify-space-between mb-3">
            <div class="text-subtitle-1 font-weight-bold">商品</div>

            <v-btn
              variant="tonal"
              prepend-icon="mdi-plus"
              @click="addReceiptItem"
            >
              商品を追加
            </v-btn>
          </div>

          <v-card
            v-for="(item, index) in receiptForm.items"
            :key="item.localId"
            variant="outlined"
            rounded="lg"
            class="mb-3"
          >
            <v-card-text>
              <div class="d-flex justify-space-between align-center mb-2">
                <div class="text-body-2 font-weight-medium">
                  商品 {{ index + 1 }}
                </div>

                <v-btn
                  v-if="receiptForm.items.length > 1"
                  icon="mdi-delete-outline"
                  variant="text"
                  color="error"
                  @click="removeReceiptItem(index)"
                />
              </div>

              <v-row>
                <v-col cols="12">
                  <v-text-field
                    v-model="item.name"
                    label="商品名"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>

                <v-col cols="12">
                  <v-select
                    v-model="item.budget_item_id"
                    label="支出元予算"
                    :items="budgetItemSelectItems"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    density="comfortable"
                    clearable
                  />
                </v-col>

                <v-col cols="6" sm="3">
                  <v-text-field
                    v-model.number="item.unit_price"
                    label="単価"
                    type="number"
                    min="0"
                    variant="outlined"
                    density="comfortable"
                    suffix="円"
                  />
                </v-col>

                <v-col cols="6" sm="3">
                  <v-text-field
                    v-model.number="item.quantity"
                    label="数量"
                    type="number"
                    min="1"
                    step="1"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>

                <v-col cols="6" sm="3">
                  <v-text-field
                    v-model.number="item.discount_rate"
                    label="割引"
                    type="number"
                    min="0"
                    max="100"
                    variant="outlined"
                    density="comfortable"
                    suffix="%"
                  />
                </v-col>

                <v-col cols="12" sm="4">
                  <v-select
                    v-model="item.price_type"
                    label="価格区分"
                    :items="[
                      { title: '税込', value: 'tax_included' },
                      { title: '税抜', value: 'tax_excluded' },
                      { title: '不明', value: 'unknown' },
                    ]"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>

                <v-col cols="6" sm="4">
                  <v-text-field
                    v-model.number="item.tax_rate"
                    label="税率"
                    type="number"
                    min="0"
                    max="100"
                    variant="outlined"
                    density="comfortable"
                    suffix="%"
                  />
                </v-col>
              </v-row>

              <div class="text-right font-weight-bold">
                {{ yen(calculateItemAmount(item)) }}
              </div>
            </v-card-text>
          </v-card>

          <div class="d-flex justify-end mt-4">
            <div class="text-right">
              <div class="text-body-2 text-medium-emphasis">レシート合計</div>
              <div class="text-h5 font-weight-bold">
                {{ yen(receiptTotal) }}
              </div>
            </div>
          </div>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4">
          <v-spacer />

          <v-btn variant="text" @click="receiptDialog = false">
            キャンセル
          </v-btn>

          <v-btn
            v-if="editingReceipt && canEdit"
            color="error"
            variant="text"
            @click="deleteReceipt"
          >
            削除
          </v-btn>

          <v-btn
            v-if="!editingReceipt && !canCreate"
            disabled
          >
            保存
          </v-btn>

          <v-btn
            v-else-if="editingReceipt && !canEdit"
            disabled
          >
            保存
          </v-btn>

          <v-btn
            v-else
            color="primary"
            :loading="saving"
            @click="saveReceipt"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="budgetDialog" max-width="520">
      <v-card rounded="xl">
        <v-card-title class="pa-5">
          {{ editingBudget ? '予算項目を編集' : '予算項目を登録' }}
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-5">
          <v-text-field
            v-model="budgetForm.name"
            label="項目名"
            variant="outlined"
            class="mb-2"
          />

          <v-text-field
            v-model.number="budgetForm.budget_amount"
            label="予算額"
            type="number"
            min="0"
            variant="outlined"
            suffix="円"
          />
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer />

          <v-btn variant="text" @click="budgetDialog = false">
            キャンセル
          </v-btn>

          <v-btn
            color="primary"
            :loading="saving"
            @click="saveBudget"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { useConfirmDialog } from '~/composables/useConfirmDialog'

definePageMeta({
  middleware: ['auth'],
})

type PaymentMethod = 'budget' | 'advance'
type PriceType = 'tax_included' | 'tax_excluded' | 'unknown'
type ReimbursementStatus = 'pending' | 'paid' | 'cancelled'

interface ReceiptItem {
  id?: string
  localId: string
  receipt_id?: string
  budget_item_id?: string | null
  name: string
  unit_price: number
  quantity: number
  discount_rate: number
  tax_rate: number
  price_type: PriceType
  amount?: number
}

interface ReceiptFile {
  id: string
  object_key: string
  original_name: string
  content_type: string
  size: number
  created_at?: string
}

interface Receipt {
  id: string
  files?: ReceiptFile[]
  purchased_at: string
  store_name: string
  total_amount: number
  payment_method: PaymentMethod
  paid_by_user_id?: string | null
  paid_by_name?: string | null
  paid_by_nickname?: string | null
  description?: string | null
  reimbursement_status?: ReimbursementStatus | null
  items: ReceiptItem[]
}

interface ReceiptUser {
  id: string
  student_number: string
  name: string
  nickname: string | null
}

interface BudgetItem {
  id: string
  budget_id: string
  name: string
  budget_amount: number
  used_amount: number
}

interface Reimbursement {
  id: string
  receipt_id: string
  user_id?: string | null
  user_name?: string | null
  user_nickname?: string | null
  amount: number
  status: ReimbursementStatus
  store_name?: string | null
  purchased_at?: string | null
}

const auth = useAuthStore()
const { apiFetch } = useApi()
const { confirm } = useConfirmDialog()

const tab = ref('receipts')
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const receipts = ref<Receipt[]>([])
const budgetItems = ref<BudgetItem[]>([])
const reimbursements = ref<Reimbursement[]>([])

const summary = reactive({
  totalBudget: 0,
  totalPurchased: 0,
  pendingReimbursements: 0,
})

const receiptSearch = ref('')
const receiptPaymentFilter = ref<'all' | PaymentMethod>('all')
const receiptReimbursementFilter = ref<'all' | ReimbursementStatus>('all')
const aggregationMonth = ref(new Date().toISOString().slice(0, 7))
const aggregationStartDate = ref('')
const aggregationEndDate = ref('')
const receiptDialog = ref(false)
const editingReceipt = ref<Receipt | null>(null)
const receiptImagePreviewDialog = ref(false)
const previewReceiptFiles = ref<ReceiptFile[]>([])
const previewReceiptImageIndex = ref(0)
const deletingReceiptFileId = ref<string | null>(null)
const receiptImageFiles = ref<File[]>([])
const receiptOcrLoading = ref(false)

const budgetDialog = ref(false)
const editingBudget = ref<BudgetItem | null>(null)

const currentBudgetId = ref<string | null>(null)
const budgetSourceSaving = ref(false)

const budgetSourceForm = reactive({
  class_collection: 0,
  organization_subsidy: 0,
})

const receiptForm = reactive({
  purchased_at: new Date().toISOString().slice(0, 10),
  store_name: '',
  payment_method: 'budget' as PaymentMethod,
  paid_by_user_id: null as string | null,
  description: '',
  items: [] as ReceiptItem[],
})

const receiptUsers = ref<ReceiptUser[]>([])

const budgetForm = reactive({
  name: '',
  budget_amount: 0,
})

const canView = computed(() => auth.hasPermission('accounting.view'))
const canCreate = computed(() => auth.hasPermission('accounting.create'))
const canEdit = computed(() => auth.hasPermission('accounting.edit'))
const canApprove = computed(() => auth.hasPermission('accounting.approve'))

const paymentMethodItems = [
  { title: '予算から支払い', value: 'budget' },
  { title: '立替', value: 'advance' },
]

const receiptPaymentFilterItems = [
  { title: 'すべて', value: 'all' },
  { title: '予算', value: 'budget' },
  { title: '立替', value: 'advance' },
]

const receiptReimbursementFilterItems = [
  { title: 'すべて', value: 'all' },
  { title: '未精算', value: 'pending' },
  { title: '精算済み', value: 'paid' },
  { title: '取消', value: 'cancelled' },
]

const receiptUserItems = computed(() =>
  receiptUsers.value.map((user) => ({
    title: user.nickname
      ? `${user.nickname}（${user.name}）`
      : user.name,
    value: user.id,
  })),
)

const budgetItemSelectItems = computed(() =>
  budgetItems.value.map((item) => {
    const remaining = Number(item.budget_amount || 0) - Number(item.used_amount || 0)

    return {
      title:
        remaining < 0
          ? `${item.name}（予算超過 ${yen(Math.abs(remaining))}）`
          : `${item.name}（残り ${yen(remaining)}）`,
      value: item.id,
    }
  }),
)

const remainingBudget = computed(
  () => summary.totalBudget - summary.totalPurchased,
)

const budgetSourceTotal = computed(
  () =>
    Number(budgetSourceForm.class_collection || 0) +
    Number(budgetSourceForm.organization_subsidy || 0),
)

const filteredReceipts = computed(() => {
  const query = receiptSearch.value.trim().toLowerCase()

  return receipts.value.filter((receipt) => {
    const store = receipt.store_name?.toLowerCase() ?? ''
    const items = receipt.items
      .map((item) => item.name?.toLowerCase() ?? '')
      .join(' ')

    const matchesSearch =
      !query ||
      store.includes(query) ||
      items.includes(query)

    const matchesPayment =
      receiptPaymentFilter.value === 'all' ||
      receipt.payment_method === receiptPaymentFilter.value

    const matchesReimbursement =
      receiptReimbursementFilter.value === 'all' ||
      receipt.reimbursement_status === receiptReimbursementFilter.value

    return matchesSearch && matchesPayment && matchesReimbursement
  })
})

const receiptDate = (receipt: Receipt) =>
  receipt.purchased_at?.slice(0, 10) ?? ''

const isReceiptInPeriod = (
  receipt: Receipt,
  startDate: string,
  endDate: string,
) => {
  const date = receiptDate(receipt)

  if (!date) return false
  if (startDate && date < startDate) return false
  if (endDate && date > endDate) return false

  return true
}

const currentMonthPurchased = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const monthPrefix = `${year}-${month}`

  return receipts.value
    .filter((receipt) => receiptDate(receipt).startsWith(monthPrefix))
    .reduce((total, receipt) => total + Number(receipt.total_amount || 0), 0)
})

const aggregationRange = computed(() => {
  if (aggregationStartDate.value || aggregationEndDate.value) {
    return {
      start: aggregationStartDate.value,
      end: aggregationEndDate.value,
    }
  }

  if (!aggregationMonth.value) {
    return {
      start: '',
      end: '',
    }
  }

  const [year = 0, month = 0] = aggregationMonth.value.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
})

const aggregationReceipts = computed(() => {
  const range = aggregationRange.value

  return receipts.value.filter((receipt) =>
    isReceiptInPeriod(receipt, range.start, range.end),
  )
})

const aggregationPurchased = computed(() =>
  aggregationReceipts.value.reduce(
    (total, receipt) => total + Number(receipt.total_amount || 0),
    0,
  ),
)

const aggregationReceiptCount = computed(
  () => aggregationReceipts.value.length,
)

const monthlyAggregation = computed(() => {
  const totals = new Map<string, number>()

  for (const receipt of aggregationReceipts.value) {
    const date = receiptDate(receipt)

    if (!date) continue

    const month = date.slice(0, 7)
    totals.set(
      month,
      (totals.get(month) ?? 0) + Number(receipt.total_amount || 0),
    )
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({
      month,
      label: month.replace('-', '年') + '月',
      amount,
    }))
})

const pendingAdvanceByUser = computed(() => {
  const totals = new Map<
    string,
    { userId: string; name: string; amount: number }
  >()

  for (const reimbursement of reimbursements.value) {
    if (reimbursement.status !== 'pending') continue

    const userId = reimbursement.user_id ?? `unknown-${reimbursement.id}`
    const name =
      reimbursement.user_nickname ||
      reimbursement.user_name ||
      '支払者未設定'

    const current = totals.get(userId)

    if (current) {
      current.amount += Number(reimbursement.amount || 0)
    } else {
      totals.set(userId, {
        userId,
        name,
        amount: Number(reimbursement.amount || 0),
      })
    }
  }

  return [...totals.values()].sort((a, b) => b.amount - a.amount)
})

const printAccountingReport = () => {
  const range = aggregationRange.value

  const periodLabel =
    range.start || range.end
      ? `${range.start || '指定なし'} ～ ${range.end || '指定なし'}`
      : '全期間'

  const monthlyRows = monthlyAggregation.value.length
    ? monthlyAggregation.value
        .map(
          (item) => `
            <tr>
              <td>${item.label}</td>
              <td class="amount">${yen(item.amount)}</td>
            </tr>
          `,
        )
        .join('')
    : `
        <tr>
          <td colspan="2" class="empty">指定期間の購入記録はありません</td>
        </tr>
      `

  const advanceRows = pendingAdvanceByUser.value.length
    ? pendingAdvanceByUser.value
        .map(
          (item) => `
            <tr>
              <td>${item.name}</td>
              <td class="amount">${yen(item.amount)}</td>
            </tr>
          `,
        )
        .join('')
    : `
        <tr>
          <td colspan="2" class="empty">立替中の金額はありません</td>
        </tr>
      `

  const purchaseRows = aggregationReceipts.value
    .flatMap((receipt) =>
      receipt.items.map(
        (item) => `
          <tr>
            <td>${receiptDate(receipt)}</td>
            <td>${item.name || '-'}</td>
            <td class="amount">${yen(item.unit_price)}</td>
            <td class="quantity">${item.quantity ?? 0}</td>
            <td class="rate">
              割引 ${Number(item.discount_rate ?? 0)}%<br />
              ${item.price_type === 'tax_included' ? '税込' : item.price_type === 'tax_excluded' ? '税抜' : '価格区分不明'}<br />
              税 ${Number(item.tax_rate ?? 0)}%
            </td>
            <td class="amount">${yen(calculateItemAmount(item))}</td>
          </tr>
        `,
      ),
    )
    .join('')

  const printedAt = new Date().toLocaleString('ja-JP')

  const printWindow = window.open('', '_blank', 'width=900,height=1200')

  if (!printWindow) {
    errorMessage.value =
      'PDF出力画面を開けませんでした。ブラウザのポップアップブロックを確認してください。'
    return
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <title>38R 会計報告書</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 16mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            color: #222;
            background: #fff;
            font-family:
              -apple-system,
              BlinkMacSystemFont,
              "Hiragino Kaku Gothic ProN",
              "Hiragino Sans",
              "Yu Gothic",
              "Meiryo",
              sans-serif;
            font-size: 10pt;
            line-height: 1.5;
          }

          .report {
            width: 100%;
          }

          h1 {
            margin: 0;
            font-size: 22pt;
            line-height: 1.3;
          }

          .subtitle {
            margin-top: 4px;
            color: #666;
            font-size: 9pt;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 10px;
            border-bottom: 2px solid #222;
          }

          .header-right {
            text-align: right;
            color: #666;
            font-size: 8pt;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin: 14px 0;
          }

          .summary-card {
            padding: 9px 12px;
            border: 1px solid #ccc;
            border-radius: 6px;
          }

          .summary-label {
            color: #666;
            font-size: 8pt;
          }

          .summary-value {
            margin-top: 2px;
            font-size: 15pt;
            font-weight: 700;
          }

          section {
            margin-top: 18px;
            break-inside: avoid;
          }

          h2 {
            margin: 0 0 7px;
            padding-bottom: 4px;
            border-bottom: 1px solid #999;
            font-size: 12pt;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th,
          td {
            padding: 5px 7px;
            border-bottom: 1px solid #ddd;
            text-align: left;
          }

          th {
            background: #f5f5f5;
            font-weight: 700;
          }

          .amount {
            text-align: right;
            white-space: nowrap;
            font-weight: 600;
          }

          .quantity {
            text-align: right;
            white-space: nowrap;
          }

          .rate {
            text-align: right;
            white-space: nowrap;
            font-size: 8.5pt;
          }

          .empty {
            color: #777;
            text-align: center;
          }

          .purchase-detail {
            break-inside: auto;
          }

          .purchase-detail thead {
            display: table-header-group;
          }

          .purchase-detail tr {
            break-inside: avoid;
          }

          .footer {
            margin-top: 24px;
            padding-top: 7px;
            border-top: 1px solid #ccc;
            color: #777;
            font-size: 8pt;
            text-align: right;
          }
        </style>
      </head>

      <body>
        <main class="report">
          <header class="header">
            <div>
              <h1>38R 会計報告書</h1>
              <div class="subtitle">
                集計期間：${periodLabel}
              </div>
            </div>

            <div class="header-right">
              出力日時<br />
              ${printedAt}
            </div>
          </header>

          <div class="summary">
            <div class="summary-card">
              <div class="summary-label">指定期間の支出</div>
              <div class="summary-value">
                ${yen(aggregationPurchased.value)}
              </div>
            </div>

            <div class="summary-card">
              <div class="summary-label">指定期間の購入件数</div>
              <div class="summary-value">
                ${aggregationReceiptCount.value}件
              </div>
            </div>

            <div class="summary-card">
              <div class="summary-label">今月の支出</div>
              <div class="summary-value">
                ${yen(currentMonthPurchased.value)}
              </div>
            </div>

            <div class="summary-card">
              <div class="summary-label">立替中の金額</div>
              <div class="summary-value">
                ${yen(
                  pendingAdvanceByUser.value.reduce(
                    (total, item) => total + Number(item.amount || 0),
                    0,
                  ),
                )}
              </div>
            </div>
          </div>

          <section class="purchase-detail">
            <h2>購入明細</h2>

            <table>
              <thead>
                <tr>
                  <th>購入日</th>
                  <th>商品名</th>
                  <th class="amount">単価</th>
                  <th class="quantity">個数</th>
                  <th class="rate">割引・税率</th>
                  <th class="amount">合計額</th>
                </tr>
              </thead>

              <tbody>
                ${
                  purchaseRows ||
                  `
                    <tr>
                      <td colspan="5" class="empty">
                        指定期間の購入記録はありません
                      </td>
                    </tr>
                  `
                }
              </tbody>
            </table>
          </section>

          <section>
            <h2>月別支出</h2>

            <table>
              <thead>
                <tr>
                  <th>月</th>
                  <th class="amount">支出額</th>
                </tr>
              </thead>

              <tbody>
                ${monthlyRows}
              </tbody>
            </table>
          </section>

          <section>
            <h2>立替中の金額</h2>

            <table>
              <thead>
                <tr>
                  <th>支払者</th>
                  <th class="amount">立替額</th>
                </tr>
              </thead>

              <tbody>
                ${advanceRows}
              </tbody>
            </table>
          </section>

          <div class="footer">
            38R 星陵祭準備サイト　会計報告書
          </div>
        </main>
      </body>
    </html>
  `)

  printWindow.document.close()

  printWindow.addEventListener('afterprint', () => {
    printWindow.close()
  })

  printWindow.focus()

  setTimeout(() => {
    printWindow.print()
  }, 300)
}

const resetAggregationPeriod = () => {
  aggregationMonth.value = new Date().toISOString().slice(0, 7)
  aggregationStartDate.value = ''
  aggregationEndDate.value = ''
}

const receiptTotal = computed(() =>
  receiptForm.items.reduce(
    (total, item) => total + calculateItemAmount(item),
    0,
  ),
)

const yen = (value: number | null | undefined) =>
  `¥${Number(value ?? 0).toLocaleString('ja-JP')}`

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('ja-JP')
}

const calculateItemAmount = (item: ReceiptItem) => {
  const base = Number(item.unit_price || 0) * Number(item.quantity || 0)
  const discounted = base * (1 - Number(item.discount_rate || 0) / 100)
  const total = item.price_type === 'tax_excluded'
    ? discounted * (1 + Number(item.tax_rate || 0) / 100)
    : discounted

  return Math.round(total)
}

const receiptItemSummary = (receipt: Receipt) => {
  if (!receipt.items?.length) return '商品なし'

  const first = receipt.items[0]?.name || '商品'
  const extra = receipt.items.length - 1

  return extra > 0 ? `${first} ほか${extra}件` : first
}

const budgetRemaining = (item: BudgetItem) =>
  Number(item.budget_amount || 0) - Number(item.used_amount || 0)

const reimbursementLabel = (status: ReimbursementStatus) => {
  if (status === 'paid') return '精算済み'
  if (status === 'cancelled') return '取消'
  return '未精算'
}

const reimbursementColor = (status: ReimbursementStatus) => {
  if (status === 'paid') return 'success'
  if (status === 'cancelled') return 'grey'
  return 'warning'
}

const normalizeReceipt = (receipt: Receipt): Receipt => ({
  ...receipt,
  items: Array.isArray(receipt.items)
    ? receipt.items.map((item) => ({
        ...item,
        localId: item.id ?? crypto.randomUUID(),
      }))
    : [],
})

const loadAll = async () => {
  if (!canView.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    const [
      summaryResponse,
      receiptsResponse,
      budgetsResponse,
      reimbursementsResponse,
      usersResponse,
    ] = await Promise.all([
        apiFetch<any>('/api/accounting/summary'),
        apiFetch<any>('/api/accounting/receipts'),
        apiFetch<any>('/api/accounting/budgets'),
        apiFetch<any>('/api/accounting/reimbursements'),
    apiFetch<{ users: ReceiptUser[] }>('/api/accounting/users'),
      ])

    const summaryData = summaryResponse?.summary ?? summaryResponse ?? {}

    summary.totalBudget = Number(
      summaryData.total_budget ??
        summaryData.totalBudget ??
        summaryData.budget_amount ??
        0,
    )

    summary.totalPurchased = Number(
      summaryData.purchase_amount ??
        summaryData.total_purchased ??
        summaryData.totalPurchased ??
        summaryData.total_expenses ??
        0,
    )

    summary.pendingReimbursements = Number(
      summaryData.pending_reimbursement ??
        summaryData.pending_reimbursements ??
        summaryData.pendingReimbursements ??
        0,
    )

    const receiptData =
      receiptsResponse?.receipts ??
      (Array.isArray(receiptsResponse) ? receiptsResponse : [])

    receipts.value = receiptData.map(normalizeReceipt)
    receiptUsers.value = usersResponse?.users ?? []

    const budgets = Array.isArray(budgetsResponse?.budgets)
      ? budgetsResponse.budgets
      : []

    if (budgets.length > 0 && budgets[0]?.id) {
      currentBudgetId.value = budgets[0].id

      budgetSourceForm.class_collection = Number(
        budgets[0].class_collection_amount ?? 0,
      )

      budgetSourceForm.organization_subsidy = Number(
        budgets[0].organization_subsidy_amount ?? 0,
      )

      const budgetItemsResponse = await apiFetch<any>(
        `/api/accounting/budgets/${budgets[0].id}/items`,
      )

      const budgetData = Array.isArray(budgetItemsResponse?.items)
        ? budgetItemsResponse.items
        : []

      budgetItems.value = budgetData.map((item: any) => ({
        id: item.id,
        budget_id: item.budget_id,
        name: item.name,
        budget_amount: Number(item.budgeted_amount ?? 0),
        used_amount: Number(item.used_amount ?? 0),
      }))
    } else {
      currentBudgetId.value = null
      budgetSourceForm.class_collection = 0
      budgetSourceForm.organization_subsidy = 0
      budgetItems.value = []
    }

    const reimbursementData =
      reimbursementsResponse?.reimbursements ??
      (Array.isArray(reimbursementsResponse)
        ? reimbursementsResponse
        : [])

    reimbursements.value = reimbursementData
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message ??
      error?.data?.error ??
      error?.message ??
      '会計情報の取得に失敗しました。'
  } finally {
    loading.value = false
  }
}

const csvEscape = (value: unknown) => {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

const downloadCsv = (filename: string, rows: string[][]) => {
  const csv = '\uFEFF' + rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

const exportReceiptsCsv = () => {
  const rows: string[][] = [
    [
      '購入日',
      '購入先',
      '支払方法',
      '支払者',
      '商品名',
      '単価',
      '数量',
      '割引率',
      '価格区分',
      '税率',
      '金額',
      '精算状況',
    ],
  ]

  for (const receipt of filteredReceipts.value) {
    const paymentMethod =
      receipt.payment_method === 'advance' ? '立替' : '予算'

    const payer =
      receipt.paid_by_nickname ||
      receipt.paid_by_name ||
      ''

    const reimbursement =
      receipt.reimbursement_status
        ? reimbursementLabel(receipt.reimbursement_status)
        : ''

    for (const item of receipt.items) {
      rows.push([
        receiptDate(receipt),
        receipt.store_name,
        paymentMethod,
        payer,
        item.name,
        String(item.unit_price ?? 0),
        String(item.quantity ?? 0),
        String(item.discount_rate ?? 0),
        item.price_type === 'tax_included'
          ? '税込'
          : item.price_type === 'tax_excluded'
            ? '税抜'
            : '不明',
        String(item.tax_rate ?? 0),
        String(calculateItemAmount(item)),
        reimbursement,
      ])
    }
  }

  const date = new Date()
    .toISOString()
    .slice(0, 10)

  downloadCsv(
    `38R会計_購入記録_${date}.csv`,
    rows,
  )
}

const resetReceiptForm = () => {
  receiptImageFiles.value = []
  receiptForm.purchased_at = new Date().toISOString().slice(0, 10)
  receiptForm.store_name = ''
  receiptForm.payment_method = 'budget'
  receiptForm.paid_by_user_id = null
  receiptForm.description = ''
  receiptForm.items = [
    {
      localId: crypto.randomUUID(),
      name: '',
      unit_price: 0,
      quantity: 1,
      discount_rate: 0,
      tax_rate: 10,
      price_type: 'unknown',
    },
  ]
}

const openReceiptCreate = () => {
  editingReceipt.value = null
  resetReceiptForm()
  receiptDialog.value = true
}

const openReceiptEdit = (receipt: Receipt) => {
  editingReceipt.value = receipt
  receiptImageFiles.value = []

  receiptForm.purchased_at = receipt.purchased_at?.slice(0, 10) ?? ''
  receiptForm.store_name = receipt.store_name ?? ''
  receiptForm.payment_method = receipt.payment_method ?? 'budget'
  receiptForm.paid_by_user_id = receipt.paid_by_user_id ?? null
  receiptForm.description = receipt.description ?? ''
  receiptForm.items = receipt.items.map((item) => ({
    ...item,
    localId: item.id ?? crypto.randomUUID(),
  }))

  if (receiptForm.items.length === 0) {
    addReceiptItem()
  }

  receiptDialog.value = true
}

const addReceiptItem = () => {
  receiptForm.items.push({
    localId: crypto.randomUUID(),
    name: '',
    unit_price: 0,
    quantity: 1,
    budget_item_id: null,
    discount_rate: 0,
    tax_rate: 10,
    price_type: 'unknown',
  })
}

const removeReceiptItem = (index: number) => {
  receiptForm.items.splice(index, 1)
}

const recognizeReceipt = async () => {
  const file = receiptImageFiles.value[0]

  if (!file) {
    errorMessage.value = '先にレシート画像を選択してください。'
    return
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    errorMessage.value = 'JPEG・PNG・WebP形式の画像を選択してください。'
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    errorMessage.value = '画像は10MB以下にしてください。'
    return
  }

  const formData = new FormData()
  formData.append('file', file)
  receiptOcrLoading.value = true
  errorMessage.value = ''

  try {
    const result: any = await apiFetch('/api/accounting/receipts/ocr', {
      method: 'POST',
      body: formData,
    })
    const ocr = result?.ocr

    if (!ocr || typeof ocr !== 'object') {
      throw new Error('OCR結果を取得できませんでした。')
    }

    if (typeof ocr.purchased_at === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(ocr.purchased_at)) {
      receiptForm.purchased_at = ocr.purchased_at
    }

    if (typeof ocr.store_name === 'string' && ocr.store_name.trim()) {
      receiptForm.store_name = ocr.store_name.trim()
    }

    if (Array.isArray(ocr.items) && ocr.items.length > 0) {
      console.info('Receipt OCR items received:', ocr.items.length)

      receiptForm.items = ocr.items.map((item: any) => {
        const quantity =
          Number.isFinite(item?.quantity) && item.quantity > 0
            ? item.quantity
            : 1

        const unitPrice = Number.isFinite(item?.unit_price)
          ? Math.max(0, Math.round(item.unit_price))
          : Number.isFinite(item?.amount)
            ? Math.max(0, Math.round(item.amount / quantity))
            : 0

        return {
          localId: crypto.randomUUID(),
          name: typeof item?.name === 'string' ? item.name : '',
          unit_price: unitPrice,
          quantity,
          budget_item_id: null,
          discount_rate: Number.isFinite(item?.discount_rate)
            ? Math.min(100, Math.max(0, Math.round(item.discount_rate)))
            : 0,
          tax_rate: Number.isFinite(item?.tax_rate)
            ? Math.min(100, Math.max(0, Math.round(item.tax_rate)))
            : 10,
          price_type: item?.price_type === 'tax_included' || item?.price_type === 'tax_excluded'
            ? item.price_type
            : 'unknown',
        }
      })
    }

    errorMessage.value = ''
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message ??
      error?.data?.error ??
      error?.message ??
      'レシートの読み取りに失敗しました。画像を確認して手入力してください。'
  } finally {
    receiptOcrLoading.value = false
  }
}

const uploadReceiptImages = async (receiptId: string) => {
  if (receiptImageFiles.value.length === 0) return

  const uploadedIds: string[] = []

  for (const file of receiptImageFiles.value) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('JPEG・PNG・WebP形式以外の画像は添付できません。')
    }

    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      throw new Error('画像は10MB以下のファイルを選択してください。')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', 'receipts')

    const uploaded: any = await apiFetch('/api/files', {
      method: 'POST',
      body: formData,
    })

    if (typeof uploaded?.id !== 'string') {
      throw new Error('画像のアップロード結果を確認できませんでした。')
    }

    uploadedIds.push(uploaded.id)
  }

  await apiFetch(`/api/accounting/receipts/${receiptId}/files`, {
    method: 'POST',
    body: { file_ids: uploadedIds },
  })

  receiptImageFiles.value = []
}

const saveReceipt = async () => {
  if (!receiptForm.purchased_at || !receiptForm.store_name.trim()) {
    errorMessage.value = '購入日と購入先を入力してください。'
    return
  }

  if (
    receiptForm.items.length === 0 ||
    receiptForm.items.some((item) => !item.name.trim())
  ) {
    errorMessage.value = '商品を1件以上入力してください。'
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    const body = {
      purchased_at: receiptForm.purchased_at,
      store_name: receiptForm.store_name.trim(),
      payment_method: receiptForm.payment_method,
      description: receiptForm.description.trim() || null,
      total_amount: receiptTotal.value,
      paid_by_user_id:
        receiptForm.payment_method === 'advance'
          ? receiptForm.paid_by_user_id
          : null,
      items: receiptForm.items.map((item) => ({
        budget_item_id: item.budget_item_id ?? null,
        name: item.name.trim(),
        unit_price: Number(item.unit_price || 0),
        quantity: Number(item.quantity || 0),
        discount_rate: Number(item.discount_rate || 0),
        tax_rate: Number(item.tax_rate || 0),
        price_type: item.price_type,
        amount: calculateItemAmount(item),
      })),
    }

    let savedReceiptId = editingReceipt.value?.id

    if (editingReceipt.value) {
      await apiFetch(
        `/api/accounting/receipts/${editingReceipt.value.id}`,
        {
          method: 'PATCH',
          body,
        },
      )
    } else {
      const result: any = await apiFetch('/api/accounting/receipts', {
        method: 'POST',
        body,
      })

      savedReceiptId = result?.receipt?.id

      if (typeof savedReceiptId !== 'string') {
        throw new Error('購入記録は保存されましたが、記録IDを取得できませんでした。')
      }

      editingReceipt.value = result.receipt
    }

    if (savedReceiptId && receiptImageFiles.value.length > 0) {
      await uploadReceiptImages(savedReceiptId)
    }

    receiptDialog.value = false
    await loadAll()
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message ??
      error?.data?.error ??
      error?.message ??
      '購入記録の保存に失敗しました。'
  } finally {
    saving.value = false
  }
}

const config = useRuntimeConfig()

const receiptImageUrl = (file: ReceiptFile) => {
  const baseURL = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
  const objectKey = file.object_key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')

  return `${baseURL}/api/files/${objectKey}`
}

const openReceiptImagePreview = (receipt: Receipt) => {
  const files = receipt.files ?? []
  if (files.length === 0) return

  previewReceiptFiles.value = files
  previewReceiptImageIndex.value = 0
  receiptImagePreviewDialog.value = true
}

const deleteReceiptFile = async (file: ReceiptFile) => {
  const receiptId = editingReceipt.value?.id
  if (!receiptId || deletingReceiptFileId.value) return

  const confirmed = await confirm({
    title: '添付画像の削除',
    message: `「${file.original_name}」をこの購入記録から外しますか？画像ファイル自体は削除されません。`,
    confirmText: '添付を外す',
    confirmColor: 'error',
  })

  if (!confirmed) return

  deletingReceiptFileId.value = file.id
  errorMessage.value = ''

  try {
    await apiFetch(
      `/api/accounting/receipts/${receiptId}/files/${file.id}`,
      { method: 'DELETE' },
    )

    if (editingReceipt.value?.id === receiptId) {
      editingReceipt.value = {
        ...editingReceipt.value,
        files: (editingReceipt.value.files ?? []).filter(
          (attachedFile) => attachedFile.id !== file.id,
        ),
      }
    }

    receipts.value = receipts.value.map((receipt) =>
      receipt.id === receiptId
        ? {
            ...receipt,
            files: (receipt.files ?? []).filter(
              (attachedFile) => attachedFile.id !== file.id,
            ),
          }
        : receipt,
    )
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message ??
      error?.data?.error ??
      error?.message ??
      '添付画像の削除に失敗しました。'
  } finally {
    deletingReceiptFileId.value = null
  }
}

const deleteReceipt = async () => {
  if (!editingReceipt.value) return

  const confirmed = await confirm({
    title: '購入記録の削除',
    message: 'この購入記録を削除しますか？',
    confirmText: '削除',
    confirmColor: 'error',
  })

  if (!confirmed) {
    return
  }

  saving.value = true

  try {
    await apiFetch(
      `/api/accounting/receipts/${editingReceipt.value.id}`,
      {
        method: 'DELETE',
      },
    )

    receiptDialog.value = false
    await loadAll()
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message ??
      error?.data?.error ??
      error?.message ??
      '購入記録の削除に失敗しました。'
  } finally {
    saving.value = false
  }
}

const saveBudgetSources = async () => {
  budgetSourceSaving.value = true
  errorMessage.value = ''

  try {
    let budgetId = currentBudgetId.value

    if (!budgetId) {
      if (!canCreate.value) {
        throw new Error('予算登録権限がありません。')
      }

      const created = await apiFetch<any>(
        '/api/accounting/budgets',
        {
          method: 'POST',
          body: {
            name: '38R 星陵祭予算',
          },
        },
      )

      budgetId = created?.budget?.id ?? created?.id ?? null

      if (!budgetId) {
        throw new Error('予算IDを取得できませんでした。')
      }

      currentBudgetId.value = budgetId
    } else if (!canEdit.value) {
      throw new Error('予算編集権限がありません。')
    }

    await apiFetch(
      `/api/accounting/budgets/${budgetId}/sources`,
      {
        method: 'PATCH',
        body: {
          class_collection: Number(
            budgetSourceForm.class_collection || 0,
          ),
          organization_subsidy: Number(
            budgetSourceForm.organization_subsidy || 0,
          ),
        },
      },
    )

    await loadAll()
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message ??
      error?.data?.error ??
      error?.message ??
      '予算原資の保存に失敗しました。'
  } finally {
    budgetSourceSaving.value = false
  }
}

const openBudgetDialog = (item?: BudgetItem) => {
  editingBudget.value = item ?? null
  budgetForm.name = item?.name ?? ''
  budgetForm.budget_amount = Number(item?.budget_amount ?? 0)
  budgetDialog.value = true
}

const saveBudget = async () => {
  if (!budgetForm.name.trim()) {
    errorMessage.value = '予算項目名を入力してください。'
    return
  }

  saving.value = true

  try {
    const budgetAmount = Number(budgetForm.budget_amount || 0)

    if (editingBudget.value) {
      await apiFetch(
        `/api/accounting/budget-items/${editingBudget.value.id}`,
        {
          method: 'PATCH',
          body: {
            budget_id: editingBudget.value.budget_id,
            name: budgetForm.name.trim(),
            budgeted_amount: budgetAmount,
          },
        },
      )
    } else {
      const budgetsResponse = await apiFetch<any>(
        '/api/accounting/budgets',
      )

      const budgets = Array.isArray(budgetsResponse?.budgets)
        ? budgetsResponse.budgets
        : []

      let budgetId = budgets[0]?.id

      if (!budgetId) {
        const created = await apiFetch<any>(
          '/api/accounting/budgets',
          {
            method: 'POST',
            body: {
              name: '38R 星陵祭予算',
              amount: budgetAmount,
            },
          },
        )

        budgetId = created?.budget?.id ?? created?.id
      }

      if (!budgetId) {
        throw new Error('予算IDを取得できませんでした。')
      }

      await apiFetch(
        `/api/accounting/budgets/${budgetId}/items`,
        {
          method: 'POST',
          body: {
            name: budgetForm.name.trim(),
            budgeted_amount: budgetAmount,
          },
        },
      )
    }

    budgetDialog.value = false
    await loadAll()
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message ??
      error?.data?.error ??
      error?.message ??
      '予算の保存に失敗しました。'
  } finally {
    saving.value = false
  }
}

const markReimbursementPaid = async (item: Reimbursement) => {
  if (!canApprove.value) return

  const confirmed = await confirm({
    title: '立替の精算',
    message: 'この立替を精算済みにしますか？',
    confirmText: '精算済みにする',
    confirmColor: 'primary',
  })

  if (!confirmed) {
    return
  }

  try {
    await apiFetch(
      `/api/accounting/reimbursements/${item.id}`,
      {
        method: 'PATCH',
        body: {
          status: 'paid',
        },
      },
    )

    await loadAll()
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message ??
      error?.data?.error ??
      error?.message ??
      '立替精算の更新に失敗しました。'
  }
}

onMounted(async () => {
  await nextTick()
  await loadAll()
})
</script>

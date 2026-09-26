<template>
  <v-container
    fluid
    class="pa-4 pa-sm-6"
  >
    <div class="mb-6">
      <h1 class="text-h5 font-weight-bold">
        タスク管理
      </h1>

      <p class="text-body-2 text-medium-emphasis mt-1">
        星陵祭準備に関するタスクを管理します
      </p>
    </div>

    <v-row>
      <v-col
        cols="12"
        sm="6"
      >
        <v-card
          variant="outlined"
          class="rounded-xl h-100"
          hover
          @click="navigateTo('/tasks/class-representative')"
        >
          <v-card-text class="pa-5">
            <div class="d-flex align-center mb-4">
              <v-avatar
                size="44"
                color="primary"
                variant="tonal"
              >
                <v-icon icon="mdi-account-group" />
              </v-avatar>

              <div class="ml-3">
                <div class="text-h6 font-weight-bold">
                  クラ代向けタスク
                </div>

                <div class="text-body-2 text-medium-emphasis">
                  クラス代表が担当するタスク
                </div>
              </div>
            </div>

            <v-btn
              color="primary"
              variant="tonal"
              block
            >
              タスク一覧を見る
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col
        cols="12"
        sm="6"
      >
        <v-card
          variant="outlined"
          class="rounded-xl h-100"
          hover
          @click="navigateTo('/tasks/class')"
        >
          <v-card-text class="pa-5">
            <div class="d-flex align-center mb-4">
              <v-avatar
                size="44"
                color="primary"
                variant="tonal"
              >
                <v-icon icon="mdi-account-multiple" />
              </v-avatar>

              <div class="ml-3">
                <div class="text-h6 font-weight-bold">
                  クラス向けタスク
                </div>

                <div class="text-body-2 text-medium-emphasis">
                  クラス全体に関するタスク
                </div>
              </div>
            </div>

            <v-btn
              color="primary"
              variant="tonal"
              block
            >
              タスク一覧を見る
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12">
        <v-card
          variant="outlined"
          class="rounded-xl"
          hover
          @click="navigateTo('/admin/tasks/create')"
        >
          <v-card-text class="pa-5">
            <div class="d-flex align-center">
              <v-avatar
                size="44"
                color="primary"
                variant="tonal"
              >
                <v-icon icon="mdi-plus" />
              </v-avatar>

              <div class="ml-3 flex-grow-1">
                <div class="text-h6 font-weight-bold">
                  タスクを作成
                </div>

                <div class="text-body-2 text-medium-emphasis">
                  新しいタスクを登録する
                </div>
              </div>

              <v-icon icon="mdi-chevron-right" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})
</script>

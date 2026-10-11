<template>
  <v-container class="class-representative-page py-8">
    <v-col cols="12" lg="10" class="pt-4 pb-0">
      <LayoutBackButton />
    </v-col>

    <div class="page-header">
      <div>
        <div class="page-eyebrow">
          CLASS REPRESENTATIVE
        </div>

        <h1 class="page-title">
          クラ代画面
        </h1>

        <p class="page-description">
          38Rの星陵祭準備に関するクラス運営を管理できます。
        </p>
      </div>
    </div>

    <v-row class="mt-4">
      <v-col
        v-for="item in implementedFeatures"
        :key="item.title"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card
          :to="item.to"
          rounded="xl"
          variant="outlined"
          class="feature-card"
        >
          <v-card-item>
            <template #prepend>
              <v-icon
                :icon="item.icon"
                size="32"
                color="primary"
              />
            </template>

            <v-card-title>
              {{ item.title }}
            </v-card-title>

            <v-card-subtitle>
              {{ item.description }}
            </v-card-subtitle>
          </v-card-item>

          <v-card-actions>
            <v-spacer />

            <v-icon icon="mdi-chevron-right" />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <div class="section-header">
      <div>
        <div class="section-eyebrow">
          COMING SOON
        </div>

        <h2 class="section-title">
          今後実装する機能
        </h2>

        <p class="section-description">
          クラス運営のために今後追加予定の機能です。
        </p>
      </div>
    </div>

    <v-row class="mt-4">
      <v-col
        v-for="item in plannedFeatures"
        :key="item.title"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card
          rounded="xl"
          variant="outlined"
          class="feature-card planned-card"
        >
          <v-card-item>
            <template #prepend>
              <v-icon
                :icon="item.icon"
                size="32"
                color="medium-emphasis"
              />
            </template>

            <v-card-title>
              {{ item.title }}
            </v-card-title>

            <v-card-subtitle>
              {{ item.description }}
            </v-card-subtitle>
          </v-card-item>

          <v-card-actions>
            <v-spacer />

            <v-chip
              size="small"
              variant="tonal"
              color="grey"
            >
              未実装
            </v-chip>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'class-representative'],
})

const implementedFeatures = [
  {
    title: 'タスク管理',
    description: '38Rの星陵祭準備タスクを管理',
    icon: 'mdi-checkbox-marked-circle-outline',
    to: '/tasks/class-representative',
  },
  {
    title: 'スケジュール',
    description: '星陵祭準備の予定を確認',
    icon: 'mdi-calendar-month-outline',
    to: '/calendar',
  },
  {
    title: 'お知らせ',
    description: '38Rに関するお知らせを確認',
    icon: 'mdi-bullhorn-outline',
    to: '/news',
  },
  {
    title: '備品・小道具',
    description: '必要な備品や小道具を管理',
    icon: 'mdi-package-variant-closed',
    to: '/supplies',
  },
]

const plannedFeatures = [
  {
    title: '会計',
    description: '38Rの予算・支出などを管理',
    icon: 'mdi-cash-multiple',
  },
  {
    title: '出欠管理',
    description: '星陵祭準備の出欠・参加状況を管理',
    icon: 'mdi-account-check-outline',
  },
  {
    title: 'アンケート・投票',
    description: 'クラス内のアンケートや投票を管理',
    icon: 'mdi-vote-outline',
  },
  {
    title: '意思決定記録',
    description: 'クラスで決定した内容を記録',
    icon: 'mdi-notebook-check-outline',
  },
  {
    title: '資料管理',
    description: '星陵祭準備に必要な資料を管理',
    icon: 'mdi-file-document-multiple-outline',
  },
]
</script>

<style scoped>
.class-representative-page {
  max-width: 1200px;
}

.page-header {
  padding: 8px 4px;
}

.page-eyebrow {
  color: #78909c;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.page-title {
  margin-top: 4px;
  color: var(--color-primary);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
}

.page-description {
  margin-top: 8px;
  color: #78909c;
  font-size: 0.95rem;
}

.feature-card {
  height: 100%;
  color: var(--color-primary);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.feature-card:hover {
  transform: translateY(-2px);
}

.section-header {
  margin-top: 48px;
  padding: 8px 4px;
}

.section-eyebrow {
  color: #90a4ae;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.section-title {
  margin-top: 4px;
  color: var(--color-primary);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.3;
}

.section-description {
  margin-top: 6px;
  color: #78909c;
  font-size: 0.9rem;
}

.planned-card {
  color: #607d8b;
  background: #fafafa;
  border-style: dashed;
  cursor: default;
}

.planned-card:hover {
  transform: none;
}
</style>

<template>
  <v-container class="admin-page py-8">
    <v-col cols="12" lg="10" class="pt-4 pb-0">
      <LayoutBackButton />
    </v-col>
      <div class="page-header">
        <div>
          <div class="page-eyebrow">
            ADMINISTRATION
          </div>

          <h1 class="page-title">
            管理者画面
          </h1>

          
        </div>
      </div>

      <v-row class="mt-4">
        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <v-card
            to="/admin/users"
            rounded="xl"
            variant="outlined"
            class="admin-card"
          >
            <v-card-item>
              <template #prepend>
                <v-icon
                  icon="mdi-account-group"
                  size="32"
                  color="primary"
                />
              </template>

              <v-card-title>
                メンバー管理
              </v-card-title>

              <v-card-subtitle>
                38Rメンバーの登録・編集・削除
              </v-card-subtitle>
            </v-card-item>

            <v-card-actions>
              <v-spacer />

              <v-icon icon="mdi-chevron-right" />
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <v-card
            to="/tasks"
            rounded="xl"
            variant="outlined"
            class="admin-card"
          >
            <v-card-item>
              <template #prepend>
                <v-icon
                  icon="mdi-checkbox-marked-circle-outline"
                  size="32"
                  color="primary"
                />
              </template>

              <v-card-title>
                タスク管理
              </v-card-title>

              <v-card-subtitle>
                星陵祭準備のタスクを管理
              </v-card-subtitle>
            </v-card-item>

            <v-card-actions>
              <v-spacer />

              <v-icon icon="mdi-chevron-right" />
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <v-card
            to="/calendar"
            rounded="xl"
            variant="outlined"
            class="admin-card"
          >
            <v-card-item>
              <template #prepend>
                <v-icon
                  icon="mdi-calendar-month-outline"
                  size="32"
                  color="primary"
                />
              </template>

              <v-card-title>
                スケジュール管理
              </v-card-title>

              <v-card-subtitle>
                星陵祭準備の予定を管理
              </v-card-subtitle>
            </v-card-item>

            <v-card-actions>
              <v-spacer />

              <v-icon icon="mdi-chevron-right" />
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <v-card
            to="/news"
            rounded="xl"
            variant="outlined"
            class="admin-card"
          >
            <v-card-item>
              <template #prepend>
                <v-icon
                  icon="mdi-bullhorn-outline"
                  size="32"
                  color="primary"
                />
              </template>

              <v-card-title>
                お知らせ管理
              </v-card-title>

              <v-card-subtitle>
                38Rメンバーへのお知らせを管理
              </v-card-subtitle>
            </v-card-item>

            <v-card-actions>
              <v-spacer />

              <v-icon icon="mdi-chevron-right" />
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <v-card
            to="/admin/roles"
            rounded="xl"
            variant="outlined"
            class="admin-card"
          >
            <v-card-item>
              <template #prepend>
                <v-icon
                  icon="mdi-account-multiple-outline"
                  size="32"
                  color="primary"
                />
              </template>

              <v-card-title>
                活動ロール管理
              </v-card-title>

              <v-card-subtitle>
                委員会や担当などの役割を管理
              </v-card-subtitle>
            </v-card-item>

            <v-card-actions>
              <v-spacer />

              <v-icon icon="mdi-chevron-right" />
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <v-card
            to="/admin/permissions"
            rounded="xl"
            variant="outlined"
            class="admin-card"
          >
            <v-card-item>
              <template #prepend>
                <v-icon
                  icon="mdi-account-multiple-outline"
                  size="32"
                  color="primary"
                />
              </template>

              <v-card-title>
                権限管理
              </v-card-title>

              <v-card-subtitle>
                係や個人への細かい権限を管理
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
            管理者画面に追加予定の機能です。
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
            class="admin-card planned-card"
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
  middleware: ['auth', 'admin'],
})

const plannedFeatures = [
  
  {
    title: '台本管理',
    description: 'クラス劇の台本を管理',
    icon: 'mdi-script-text-outline',
  },
  {
    title: '資料管理',
    description: '星陵祭準備に必要な資料を管理',
    icon: 'mdi-file-document-multiple-outline',
  },
  {
    title: 'サイト設定',
    description: '38Rサイト全体の設定を管理',
    icon: 'mdi-cog-outline',
  },
]
</script>

<style scoped>
.admin-page {
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

.admin-card {
  height: 100%;
  color: var(--color-primary);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.admin-card:hover {
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

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

          <p class="page-description">
            38Rサイトのメンバーや権限などを管理できます。
          </p>
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
            to="/admin/account-roles"
            rounded="xl"
            variant="outlined"
            class="admin-card"
          >
            <v-card-item>
              <template #prepend>
                <v-icon
                  icon="mdi-shield-account-outline"
                  size="32"
                  color="primary"
                />
              </template>

              <v-card-title>
                アカウント権限
              </v-card-title>

              <v-card-subtitle>
                管理者などのアカウント権限を管理
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
                  icon="mdi-account-multiple-check-outline"
                  size="32"
                  color="primary"
                />
              </template>

              <v-card-title>
                役割管理
              </v-card-title>

              <v-card-subtitle>
                38R内の役割・担当を管理
              </v-card-subtitle>
            </v-card-item>

            <v-card-actions>
              <v-spacer />

              <v-icon icon="mdi-chevron-right" />
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
</style>

<template>
  <v-container
    fluid
    class="pa-4 pa-sm-6"
  >
    <div class="d-flex align-center mb-6">
      <BackButton />

      <div>
        <h1 class="text-h5 font-weight-bold">
          お知らせ
        </h1>

        <p class="text-body-2 text-medium-emphasis mt-1">
          星陵祭準備に関するお知らせを確認できます
        </p>
      </div>

      <v-spacer />

      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        aria-label="更新"
        @click="loadNews"
      />
    </div>

    <template v-if="auth.hasPermission('news.view')">
      <div class="d-flex align-center mb-3">
        <div class="text-subtitle-1 font-weight-bold">
          お知らせ一覧
        </div>

        <span class="text-body-2 text-medium-emphasis ml-2">
          {{ newsList.length }}件
        </span>

        <v-spacer />

        <v-btn
          v-if="auth.hasPermission('news.create')"
          color="primary"
          prepend-icon="mdi-plus"
          @click="navigateTo('/news/create')"
        >
          新規作成
        </v-btn>
      </div>

      <div v-if="loading">
        <v-skeleton-loader
          v-for="index in 4"
          :key="index"
          type="card"
          class="mb-3"
        />
      </div>

      <template v-else>
        <v-card
          v-if="newsList.length === 0"
          variant="outlined"
          class="rounded-xl"
        >
          <v-card-text class="text-center py-10">
            <v-icon
              icon="mdi-bell-outline"
              size="48"
              class="mb-3"
            />

            <div class="text-h6 font-weight-bold">
              お知らせはありません
            </div>

            <div class="text-body-2 text-medium-emphasis mt-2">
              現在掲載されているお知らせはありません。
            </div>
          </v-card-text>
        </v-card>

        <div v-else class="news-list">
          <v-card
            v-for="item in newsList"
            :key="item.id"
            variant="outlined"
            class="news-card rounded-xl mb-3"
            :class="{ 'news-card-important': item.is_important === 1 }"
            @click="openNews(item.id)"
          >
            <v-card-text class="pa-4">
              <div class="d-flex align-start ga-3">
                <div class="news-card-main">
                  <div class="d-flex flex-wrap align-center ga-2 mb-2">
                    <v-chip
                      v-if="item.is_important === 1"
                      color="error"
                      size="small"
                      variant="flat"
                    >
                      <v-icon
                        start
                        icon="mdi-alert"
                      />
                      重要
                    </v-chip>

                    <span class="text-body-2 text-medium-emphasis">
                      {{ formatDate(item.created_at) }}
                    </span>
                  </div>

                  <div class="text-subtitle-1 font-weight-bold news-title">
                    {{ item.title }}
                  </div>

                  <div class="text-body-2 text-medium-emphasis mt-2 news-detail">
                    {{ item.detail }}
                  </div>

                  <div class="text-caption text-medium-emphasis mt-3">
                    {{ item.author }}
                  </div>
                </div>

                <v-icon
                  icon="mdi-chevron-right"
                  class="news-arrow"
                />
              </div>
            </v-card-text>
          </v-card>
        </div>
      </template>
    </template>

    <v-card
      v-else
      variant="outlined"
      class="rounded-xl"
    >
      <v-card-text class="text-center py-10">
        <v-icon
          icon="mdi-lock-outline"
          size="48"
          class="mb-3"
        />

        <div class="text-h6 font-weight-bold">
          お知らせを閲覧できません
        </div>

        <div class="text-body-2 text-medium-emphasis mt-2">
          お知らせを閲覧する権限がありません。
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

import { onMounted, ref } from 'vue'
import {
  type News,
  useApi,
} from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const { getNews } = useApi()

const newsList = ref<News[]>([])
const loading = ref(false)

const formatDate = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

const loadNews = async () => {
  if (!auth.hasPermission('news.view')) {
    return
  }

  loading.value = true

  try {
    const response = await getNews()
    newsList.value = response.news
  } catch (error) {
    console.error('Failed to load news:', error)
  } finally {
    loading.value = false
  }
}

const openNews = (newsId: string) => {
  navigateTo(`/news/${newsId}`)
}

onMounted(() => {
  loadNews()
})
</script>

<style scoped>
.news-card {
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.news-card:hover {
  transform: translateY(-1px);
}

.news-card-important {
  border-color: rgba(var(--v-theme-error), 0.45) !important;
}

.news-card-main {
  min-width: 0;
  flex: 1;
}

.news-title {
  overflow-wrap: anywhere;
}

.news-detail {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
}

.news-arrow {
  flex: 0 0 auto;
  margin-top: 2px;
}
</style>

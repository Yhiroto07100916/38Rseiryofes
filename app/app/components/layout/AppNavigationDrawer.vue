<template>
  <v-navigation-drawer
    v-model="isOpen"
    temporary
    location="left"
    width="300"
    class="app-navigation-drawer"
  >
    <div class="drawer-content">
      <!--<header class="site-branding">
        <v-img
          v-if="siteStatus?.logo_url"
          :src="siteStatus.logo_url"
          alt="サイトロゴ"
          width="56"
          height="56"
          max-width="56"
          class="site-branding-logo mb-2"
          cover
        />
        <div class="site-branding-name">{{ siteStatus?.site_name || "38R 星陵祭準備サイト" }}</div>
        <div class="site-branding-event">
          {{ siteStatus ? `${siteStatus.event_year}年度 ${siteStatus.event_name}` : "38R 準備サイト" }}
        </div>
      </header>-->

      <section class="account-section">
        <template v-if="auth.isLoggedIn">
          <div class="account-header">
            <UserAvatar :user="auth.user" :size="48" />

            <div class="account-info">
              <div class="account-status">
                ログイン中
              </div>

              <div class="account-name">
                {{ auth.user?.nickname || auth.user?.name }}
              </div>

              <div class="account-student-number">
                {{ auth.user?.student_number }}
              </div>
            </div>
          </div>

          <div class="d-flex flex-column ga-2">

            <v-btn
              v-if="isAdmin"
              block
              variant="outlined"
              rounded="xl"
              color="primary"
              class="font-weight-bold"
              size="large"
              density="comfortable"
              prepend-icon="mdi-shield-crown"
              to="/admin"
            >
              管理者設定
            </v-btn>

            <v-btn
              v-if="isAdmin || isclassrepresentative"
              block
              variant="outlined"
              rounded="xl"
              color="primary"
              class="font-weight-bold"
              size="large"
              density="comfortable"
              prepend-icon="mdi-key-variant"
              to="/class-representative"
            >
              クラ代ページ
            </v-btn>

            <v-btn
              block
              variant="outlined"
              rounded="xl"
              color="primary"
              prepend-icon="mdi-logout"
              class="font-weight-bold"
              size="large"
              density="comfortable"
              @click="handleLogout"
            >
              ログアウト
            </v-btn>
          </div>
        </template>

        <template v-else>
          <div class="account-header">
            <v-icon
              icon="mdi-account-circle"
              size="40"
              class="account-icon"
            />

            <div class="account-info">
              <div class="account-status">
                ログインしていません
              </div>
            </div>
          </div>

          <v-btn
            block
            variant="outlined"
            rounded="xl"
            color="primary"
            prepend-icon="mdi-login"
            class="login-button"
            to="/login"
            @click="isOpen = false"
          >
            ログイン
          </v-btn>
        </template>
      </section>

      <v-divider />

      <nav class="drawer-navigation">
        <template v-for="item in items" :key="item.title">
          <NuxtLink
            v-if="(item.to !== '/notifications' || auth.isLoggedIn) && (!item.permission || auth.hasPermission(item.permission)) && (!item.permissions || item.permissions.some(permission => auth.hasPermission(permission))) && (!item.feature || siteStatus?.feature_enabled?.[item.feature] !== false)"
            :to="item.to"
            class="drawer-item"
            :class="{ 'is-active': route.path === item.to }"
            @click="isOpen = false"
          >
            <v-icon
              :icon="item.icon"
              size="23"
              class="drawer-item-icon"
            />
            <span>{{ item.title }}</span>
          </NuxtLink>
        </template>
      </nav>

      <footer v-if="socialLinks.length" class="drawer-social-links" aria-label="SNSリンク">
        <a
          v-for="item in socialLinks"
          :key="item.key"
          :href="item.url"
          :aria-label="item.label"
          target="_blank"
          rel="noopener noreferrer"
          class="drawer-social-link"
        >
          <v-icon v-if="item.icon" :icon="item.icon" size="24" />
          <svg
            v-else-if="item.key === 'discord'"
            class="drawer-social-discord"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Discord"
          >
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
          </svg>
          <span v-else class="drawer-social-x">𝕏</span>
        </a>
      </footer>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
interface NavigationItem {
  title: string
  icon: string
  to: string
  permission?: string
  permissions?: string[]
  feature?: string
}

const isOpen = defineModel<boolean>({
  default: false,
})

const route = useRoute()
const auth = useAuthStore()
const siteStatus = useSiteStatus()

const socialLinkOptions = [
  { key: 'instagram', label: 'Instagram', icon: 'mdi-instagram' },
  { key: 'x', label: 'X', icon: '' },
  { key: 'tiktok', label: 'TikTok', icon: 'mdi-music-note' },
  { key: 'youtube', label: 'YouTube', icon: 'mdi-youtube' },
  { key: 'github', label: 'GitHub', icon: 'mdi-github' },
  { key: 'discord', label: 'Discord', icon: '' },
] as const

const socialLinks = computed(() =>
  socialLinkOptions.flatMap((item) => {
    const url = siteStatus.value?.social_links?.[item.key]?.trim()
    return url ? [{ ...item, url }] : []
  }),
)

const isAdmin = computed(() =>
  auth.accountRoles.some((role) => role.name === 'admin'),
)

const isclassrepresentative = computed(() =>
  auth.accountRoles.some(
    (role) =>
      role.name === 'class_representative' ||
      role.name === 'admin',
  ),
)

const items: NavigationItem[] = [
{ icon: "mdi-bullhorn", title: "NEWS", to: "/news", feature: "news" },
{ icon: "mdi-clipboard-check-outline", title: "提出物管理", to: "/submissions", permission: "submissions.view", feature: "submissions" },
{ icon: "mdi-cart-outline", title: "ほしい物リスト", to: "/wishlist", feature: "wishlist" },
{ icon: "mdi-toolbox-outline", title: "工具・機材の貸出記録", to: "/tool-rental", permissions: ["tool_rental.view", "tool_rental.checkout", "tool_rental.return", "tool_rental.history", "tool_rental.manage"], feature: "tool_rental" },
{ title: "投票", icon: "mdi-vote-outline", to: "/surveys", feature: "surveys" },
{ title: "議事録", icon: "mdi-clipboard-text-multiple", to: "/minutes", feature: "minutes" },
{ title: "決定事項", icon: "mdi-notebook-check-outline", to: "/decisions", feature: "decisions" },
{ icon: "mdi-file-document", title: "書類", to: "/files", feature: "files" },
{ title: "牛乳パック外部受け取り", icon: "mdi-recycle", to: "/milk-collection", feature: "milk_collection" },
]

const handleLogout = async () => {
  await auth.logout()
  isOpen.value = false
  await navigateTo('/login')
}
</script>

<style scoped>
.app-navigation-drawer {
  box-shadow: 4px 0 18px rgb(0 0 0 / 12%);
}

.drawer-content {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: white;
}

.site-branding {
  padding: 58px 18px 14px;
  border-bottom: 1px solid rgb(18 58 92 / 10%);
}

.site-branding-name {
  overflow-wrap: anywhere;
  color: var(--color-primary);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.4;
}

.site-branding-event {
  margin-top: 4px;
  color: #78909c;
  font-size: 0.75rem;
  font-weight: 600;
}

.account-section {
  flex: 0 0 auto;
  padding: 60px 16px 16px;
}

.account-header {
  display: flex;
  align-items: center;
  min-height: 52px;
}

.account-icon {
  flex: 0 0 auto;
  color: var(--color-primary);
}

.account-info {
  min-width: 0;
  margin-left: 12px;
}

.account-status {
  color: #78909c;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.3;
}

.account-name {
  overflow: hidden;
  color: var(--color-primary);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-student-number {
  color: #90a4ae;
  font-size: 0.75rem;
  line-height: 1.3;
}

.logout-button,
.login-button {
  margin-top: 14px;
  font-weight: 700;
}

.drawer-navigation {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 12px;
}

.drawer-item {
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 0 14px;
  border-radius: 10px;
  color: var(--color-primary);
  text-decoration: none;
  font-size: 0.98rem;
  font-weight: 600;
  transition: background-color 0.15s ease;
}

.drawer-item:hover {
  background: rgb(18 58 92 / 6%);
}

.drawer-item.is-active {
  background: rgb(18 58 92 / 9%);
}

.drawer-item-icon {
  flex: 0 0 24px;
}

.drawer-social-links {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  align-self: stretch;
  gap: 8px;
  width: 100%;
  margin-left: auto;
  padding: 18px 16px max(18px, env(safe-area-inset-bottom));
  border-top: 1px solid rgb(18 58 92 / 8%);
}

.drawer-social-link {
  display: inline-flex;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #78909c;
  text-decoration: none;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.drawer-social-link:hover {
  color: var(--color-primary);
  background: rgb(18 58 92 / 7%);
}

.drawer-social-discord {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.drawer-social-x {
  font-size: 23px;
  font-weight: 700;
  line-height: 1;
}
</style>

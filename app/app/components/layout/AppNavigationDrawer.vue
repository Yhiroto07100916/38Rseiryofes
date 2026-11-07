<template>
  <v-navigation-drawer
    v-model="isOpen"
    temporary
    location="left"
    width="300"
    class="app-navigation-drawer"
  >
    <div class="drawer-content">
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
            v-if="!item.permission || auth.hasPermission(item.permission)"
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
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
interface NavigationItem {
  title: string
  icon: string
  to: string
  permission?: string
}

const isOpen = defineModel<boolean>({
  default: false,
})

const route = useRoute()
const auth = useAuthStore()

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
{ icon: "mdi-bullhorn", title: "NEWS", to: "/news" },
{ icon: "mdi-clipboard-check-outline", title: "提出物管理", to: "/submissions", permission: "submissions.view" },
{ icon: "mdi-cart-outline", title: "ほしい物リスト", to: "/wishlist" },
{ icon: "mdi-toolbox-outline", title: "工具貸出管理", to: "/tool-rental", permission: "tool_rental.view" },
{ title: "投票", icon: "mdi-vote-outline", to: "/surveys" },
{ title: "議事録", icon: "mdi-clipboard-text-multiple", to: "/minutes" },
{ title: "決定事項", icon: "mdi-notebook-check-outline", to: "/decisions" },
{ icon: "mdi-file-document", title: "書類", to: "/files" },
{ title: "牛乳パック外部受け取り", icon: "mdi-recycle", to: "/milk-collection" },
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
  min-height: 100%;
  background: white;
}

.account-section {
  padding: 56px 16px 16px;
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
  flex-direction: column;
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
</style>

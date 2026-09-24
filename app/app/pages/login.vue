<template>
  <v-container class="login-page">
    <v-row
      align="center"
      justify="center"
      class="fill-height"
    >
      <v-col
        cols="11"
        sm="8"
        md="5"
        lg="4"
      >
        <v-card
          rounded="xl"
          elevation="2"
          class="pa-6"
        >
          <v-card-title class="text-center text-h5 font-weight-bold">
            ログイン
          </v-card-title>

          <v-card-text class="pt-6">
            <v-alert
              v-if="errorMessage"
              type="error"
              variant="tonal"
              class="mb-4"
            >
              {{ errorMessage }}
            </v-alert>

            <v-text-field
              v-model="studentNumber"
              label="学籍番号"
              placeholder="例：TEST001"
              variant="outlined"
              autocomplete="username"
              class="mb-2"
              :disabled="loading"
            />

            <v-text-field
              v-model="password"
              label="パスワード"
              variant="outlined"
              :type="showPassword ? 'text' : 'password'"
              :append-inner-icon="
                showPassword ? 'mdi-eye-off' : 'mdi-eye'
              "
              autocomplete="current-password"
              :disabled="loading"
              @click:append-inner="showPassword = !showPassword"
              @keyup.enter="handleLogin"
            />
          </v-card-text>

          <v-card-actions class="px-4 pb-2">
            <v-btn
              block
              size="large"
              color="primary"
              variant="flat"
              rounded="lg"
              :loading="loading"
              :disabled="!studentNumber || !password"
              @click="handleLogin"
            >
              ログイン
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  layout: false,
  middleware: 'guest',
})

const auth = useAuthStore()

const studentNumber = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  if (!studentNumber.value || !password.value || loading.value) {
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    await auth.login(
      studentNumber.value,
      password.value,
    )

    await navigateTo('/')
  } catch (error: any) {
    console.error('Login failed:', error)

    errorMessage.value =
      error?.data?.detail?.message ||
      error?.data?.detail ||
      'ログインに失敗しました。学籍番号とパスワードを確認してください。'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
}
</style>

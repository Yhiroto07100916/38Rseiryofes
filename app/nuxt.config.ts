import vuetify from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-16',

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8787',
    },
  },

  modules: [
    '@pinia/nuxt',
  ],

  css: [
    'vuetify/styles',
    '~/assets/main.css',
  ],

  build: {
    transpile: ['vuetify'],
  },

  vite: {
    plugins: [
      vuetify({
        autoImport: true,
      }),
    ],
  },
})

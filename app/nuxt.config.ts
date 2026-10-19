import vuetify from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-16',

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8787',
    },
  },

  app: {
    head: {
      title: '38R 星陵祭準備サイト',
      meta: [
        {
          name: 'theme-color',
          content: '#123a5c',
        },
        {
          name: 'apple-mobile-web-app-capable',
          content: 'yes',
        },
        {
          name: 'apple-mobile-web-app-title',
          content: '38R準備',
        },
      ],
      link: [
        {
          rel: 'icon',
          type: 'image/x-icon',
          href: '/favicon.ico',
        },
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: '/apple-touch-icon-180x180.png',
        },
        {
          rel: 'manifest',
          href: '/manifest.webmanifest',
        },
      ],
    },
  },

  modules: [
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
  ],

  pwa: {
    registerType: 'autoUpdate',
    manifestFilename: 'manifest.webmanifest',
    manifest: {
      id: '/',
      name: '38R 星陵祭準備サイト',
      short_name: '38R準備',
      description: '38Rの星陵祭準備を円滑に進めるためのサイト',
      lang: 'ja',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#123a5c',
      background_color: '#ffffff',
      icons: [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    pwaAssets: {
      disabled: true,
    },
    includeAssets: [
      'favicon.ico',
      'apple-touch-icon-180x180.png',
    ],
    devOptions: {
      enabled: false,
    },
  },

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

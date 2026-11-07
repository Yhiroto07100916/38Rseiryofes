import type { RouteMeta } from 'vue-router'

declare module '#app' {
  interface PageMeta {
    permissions?: string[]
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    permissions?: string[]
  }
}

export {}

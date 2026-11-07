<template>
  <v-avatar :size="size" color="primary" :aria-label="alt">
    <v-img v-if="imageSrc && !imageFailed" :src="imageSrc" cover @error="imageFailed = true">
      <template #error><span class="avatar-initial">{{ initial }}</span></template>
    </v-img>
    <span v-else class="avatar-initial">{{ initial }}</span>
  </v-avatar>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface AvatarUser {
  id: string
  name: string
  nickname: string | null
  avatar_key?: string | null
}

const props = withDefaults(defineProps<{
  user: AvatarUser | null | undefined
  size?: number | string
  src?: string
  alt?: string
}>(), { size: 40, src: undefined, alt: 'ユーザーアイコン' })

const config = useRuntimeConfig()
const imageFailed = ref(false)
const initial = computed(() => {
  const name = props.user?.nickname || props.user?.name || ''
  return name.trim().charAt(0) || '?'
})
const imageSrc = computed(() => {
  if (props.src) return props.src
  if (!props.user?.id || !props.user.avatar_key) return ''
  return `${config.public.apiBaseUrl}/api/avatars/${encodeURIComponent(props.user.id)}?v=${encodeURIComponent(props.user.avatar_key)}`
})
watch(imageSrc, () => { imageFailed.value = false })
</script>

<style scoped>
.avatar-initial {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: white;
  font-weight: 700;
}
</style>

<template>
  <div class="hamburger-box">
    <div
      class="hamburgermenu"
      :class="{ active: open }"
      :aria-expanded="open"
      :aria-label="open ? 'メニューを閉じる' : 'メニューを開く'"
      role="button"
      tabindex="0"
      @click="emit('menu')"
      @keydown.enter="emit('menu')"
      @keydown.space.prevent="emit('menu')"
    >
      <div class="hamburger-btn">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  menu: []
}>()
</script>

<style scoped>
.hamburger-box {
  position: fixed;
  top: 5px;
  left: 5px;
  z-index: 1200;
}

.hamburgermenu {
  position: relative;
  background: #ffffff89;
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.hamburgermenu .hamburger-btn {
  transition: all 0.6s;
  width: 40px;
  height: 40px;
}

.hamburgermenu span {
  display: inline-block;
  transition: all 0.4s;
  position: absolute;
  left: 9px;
  height: 3px;
  border-radius: 2px;
  background: var(--color-primary);
  width: 55%;
}

.hamburgermenu span:nth-of-type(1) {
  top: 10px;
}

.hamburgermenu span:nth-of-type(2) {
  top: 18px;
}

.hamburgermenu span:nth-of-type(3) {
  top: 26px;
}

.hamburgermenu.active .hamburger-btn {
  transform: rotate(360deg);
}

.hamburgermenu.active span:nth-of-type(1) {
  top: 13px;
  left: 9px;
  transform: translateY(6px) rotate(-45deg);
  width: 55%;
}

.hamburgermenu.active span:nth-of-type(2) {
  opacity: 0;
}

.hamburgermenu.active span:nth-of-type(3) {
  top: 25px;
  left: 9px;
  transform: translateY(-6px) rotate(45deg);
  width: 55%;
}
</style>

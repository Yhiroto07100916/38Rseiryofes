
<template>
  <div class="rabbit-layer" aria-hidden="true">
    <svg
  class="rabbit-svg background-line rellax"
  data-rellax-speed="-10"
  viewBox="0 0 1000 2400"
  preserveAspectRatio="none"
>
      <!-- 背景の曲線：丸が追従する経路 -->
      <path
        ref="pathRef"
        class="rabbit-track"
        d="
          M -100 100
          C 400 100, 600 500, 1300 500
          C 1000 800, 300 1100, -300 800
          C -100 900, -100 1500, 1500 1300
          <!-- C 600 1800, 1100 1600, 1100 1600
          C 1100 1900, 600 2500, 1100 2300 -->
        "
      />
    </svg>

    <svg
      class="rabbit-svg marker-line rellax"
      data-rellax-speed="-10"
      viewBox="0 0 1000 2400"
      preserveAspectRatio="none"
    >
      <!-- 移動する丸 -->
      <g :transform="rabbitTransform">
        <circle
          cx="0"
          cy="0"
          r="17"
          fill="var(--color-accent-light)"
        />
        <circle
          cx="0"
          cy="0"
          r="10"
          fill="var(--color-accent)"
          stroke="#ffffff"
          stroke-width="3"
        />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const pathRef = ref<SVGPathElement | null>(null)

const rabbitTransform = ref('translate(0 0)')

let animationFrame = 0

const updateRabbit = () => {
  if (!pathRef.value) return

  const path = pathRef.value
  const totalLength = path.getTotalLength()

  const maxScroll =
    document.documentElement.scrollHeight - window.innerHeight

  const progress =
    maxScroll > 0
      ? Math.min(1, Math.max(0, window.scrollY / maxScroll))
      : 0

  const point = path.getPointAtLength(
    totalLength * progress
  )

  rabbitTransform.value =
    `translate(${point.x} ${point.y})`
}

const handleScroll = () => {
  cancelAnimationFrame(animationFrame)
  animationFrame = requestAnimationFrame(updateRabbit)
}

const handleResize = () => {
  cancelAnimationFrame(animationFrame)
  animationFrame = requestAnimationFrame(updateRabbit)
}

onMounted(() => {
  updateRabbit()

  window.addEventListener('scroll', handleScroll, {
    passive: true
  })

  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleResize)

  cancelAnimationFrame(animationFrame)
})
</script>

<style scoped>
.rabbit-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}

.rabbit-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.background-line {
  z-index: 0;
}

.background-line path {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.35;
}
</style>

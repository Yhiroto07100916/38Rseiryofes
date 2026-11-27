<template>
  <div class="rabbit-layer" aria-hidden="true">
    <svg
      ref="svgRef"
      class="rabbit-svg"
      viewBox="0 0 1000 2400"
      preserveAspectRatio="none"
    >
      <!-- うさぎが走る赤い導線 -->
      <path
        ref="pathRef"
        class="rabbit-track"
        d="
          M 80 60
          C 500 60, 620 170, 620 380
          C 620 600, 420 700, 80 700
          C -80 700, -60 920, 160 1080
          C 400 1260, 850 1140, 920 960
          C 1000 780, 850 650, 900 520
          C 980 300, 1120 350, 1120 550
          C 1120 850, 850 900, 780 1120
          C 680 1400, 850 1650, 1080 1700
          C 1280 1750, 1220 2050, 950 2180
          C 750 2280, 400 2300, 80 2350
        "
      />

      <!-- 走るうさぎ -->
      <g
        ref="rabbitRef"
        :transform="rabbitTransform"
        class="rabbit-character"
        :class="{ running: isRunning }"
      >
        <!-- 体 -->
        <ellipse
          cx="0"
          cy="0"
          rx="19"
          ry="12"
          fill="#17364D"
        />

        <!-- 頭 -->
        <circle
          cx="16"
          cy="-9"
          r="9"
          fill="#17364D"
        />

        <!-- 耳 -->
        <ellipse
          cx="12"
          cy="-23"
          rx="3.5"
          ry="12"
          transform="rotate(-15 12 -23)"
          fill="#17364D"
        />
        <ellipse
          cx="20"
          cy="-23"
          rx="3.5"
          ry="11"
          transform="rotate(15 20 -23)"
          fill="#17364D"
        />

        <!-- 耳の内側 -->
        <ellipse
          cx="12"
          cy="-23"
          rx="1.4"
          ry="7"
          transform="rotate(-15 12 -23)"
          fill="#F2A0A4"
        />

        <!-- しっぽ -->
        <circle
          cx="-20"
          cy="-5"
          r="5"
          fill="#17364D"
        />

        <!-- 目 -->
        <circle
          cx="19"
          cy="-11"
          r="1.4"
          fill="white"
        />

        <!-- 足 -->
        <g class="rabbit-legs">
          <path
            d="M -8 8 L -13 17 L -3 17"
            fill="none"
            stroke="#17364D"
            stroke-width="4"
            stroke-linecap="round"
          />
          <path
            d="M 9 8 L 5 17 L 15 17"
            fill="none"
            stroke="#17364D"
            stroke-width="4"
            stroke-linecap="round"
          />
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const svgRef = ref<SVGSVGElement | null>(null)
const pathRef = ref<SVGPathElement | null>(null)
const rabbitRef = ref<SVGGElement | null>(null)

const rabbitTransform = ref('translate(80 60)')
const isRunning = ref(false)

let animationFrame = 0
let stopTimer: ReturnType<typeof setTimeout> | undefined
let lastScrollY = 0

const updateRabbit = () => {
  if (!pathRef.value) return

  const path = pathRef.value
  const totalLength = path.getTotalLength()

  // ページ全体のスクロール進行度
  const maxScroll =
    document.documentElement.scrollHeight - window.innerHeight

  const progress =
    maxScroll > 0
      ? Math.min(1, Math.max(0, window.scrollY / maxScroll))
      : 0

  // 曲線上の現在位置
  const distance = totalLength * progress

  const point = path.getPointAtLength(distance)

  // 接線から進行方向を計算
  const nextPoint = path.getPointAtLength(
    Math.min(distance + 1, totalLength)
  )

  const angle =
    Math.atan2(
      nextPoint.y - point.y,
      nextPoint.x - point.x
    ) * (180 / Math.PI)

  rabbitTransform.value =
    `translate(${point.x} ${point.y}) rotate(${angle})`
}

const handleScroll = () => {
  // スクロールが発生したら走る
  isRunning.value = true

  if (stopTimer) clearTimeout(stopTimer)

  stopTimer = setTimeout(() => {
    isRunning.value = false
  }, 150)

  // 1フレームにまとめて座標を更新
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

  if (stopTimer) clearTimeout(stopTimer)
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
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.rabbit-track {
  fill: none;
  stroke: #ef4b55;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.85;
}

.rabbit-character {
  transform-box: view-box;
  transform-origin: center;
}

.rabbit-legs {
  transform-origin: center;
}

.rabbit-character.running .rabbit-legs {
  animation: rabbit-run 0.2s infinite alternate;
}

@keyframes rabbit-run {
  from {
    transform: translateY(-2px);
  }

  to {
    transform: translateY(3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .rabbit-character.running .rabbit-legs {
    animation: none;
  }
}
</style>

<script setup lang="ts">
// RabbitPathのscript
</script>

<style scoped>
/* RabbitPathのstyle */
</style>
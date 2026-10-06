<template>
  <div class="home-page">
    <div class="ambient ambient-one" />
    <div class="ambient ambient-two" />
    <div class="ambient ambient-three" />

    <section class="hero-section">
      <div class="hero-grid" />

      <div class="hero-content">
        <div class="eyebrow">
          <span class="eyebrow-dot" />
          38R / SEIRYOFES PREPARATION
        </div>

        <div class="hero-title-wrap">
          <div class="hero-small-text">WE ARE</div>

          <h1 class="hero-title">
            <span class="hero-number">38</span><span class="hero-r">R</span>
          </h1>

          <div class="hero-side-text">
            <span>SEIRYOFES</span>
            <span>2027</span>
          </div>
        </div>

        <div class="hero-message">
          <p class="message-main">
            一緒につくる。
          </p>

          <p class="message-sub">
            一度しかない、38Rの星陵祭。
          </p>
        </div>

        <div class="countdown-area">
          <div class="countdown-label">
            <span>COUNTDOWN TO SEIRYOFES</span>
            <span>09.11.2027</span>
          </div>

          <div class="countdown">
            <div class="count-item">
              <strong>{{ displayTime.days }}</strong>
              <span>DAYS</span>
            </div>

            <div class="count-divider">:</div>

            <div class="count-item">
              <strong>{{ displayTime.hours }}</strong>
              <span>HOURS</span>
            </div>

            <div class="count-divider">:</div>

            <div class="count-item">
              <strong>{{ displayTime.minutes }}</strong>
              <span>MINUTES</span>
            </div>

            <div class="count-divider">:</div>

            <div class="count-item seconds">
              <strong>{{ displayTime.seconds }}</strong>
              <span>SECONDS</span>
            </div>
          </div>
        </div>

        <button class="enter-button" type="button" @click="scrollToNow">
          <span>ENTER 38R</span>
          <span class="arrow">↓</span>
        </button>
      </div>

      <div class="vertical-label left-label">
        38RSEIRYOFES
      </div>

      <div class="vertical-label right-label">
        MAKE IT OURS
      </div>

      <div class="hero-number-background">
        38
      </div>
    </section>

    <section id="now" class="now-section">
      <div class="section-header">
        <div>
          <span class="section-kicker">01 / NOW</span>
          <h2>38R IS<br /><em>BUILDING.</em></h2>
        </div>

        <p class="section-description">
          ここは、星陵祭までの一年を<br />
          みんなでつくっていく場所。
        </p>
      </div>

      <div class="progress-card">
        <div class="progress-card-top">
          <div>
            <span class="mini-label">PREPARATION MODE</span>
            <h3>THE STORY<br />HAS JUST BEGUN.</h3>
          </div>

          <div class="big-percent">01</div>
        </div>

        <div class="progress-track">
          <div class="progress-fill" />
        </div>

        <div class="progress-footer">
          <span>IDEA</span>
          <span>PREPARATION</span>
          <span>REHEARSAL</span>
          <span>SHOWTIME</span>
        </div>
      </div>
    </section>

    <section class="words-section">
      <div class="marquee">
        <span>IDEA</span>
        <span>PEOPLE</span>
        <span>STORY</span>
        <span>STAGE</span>
        <span>IDEA</span>
        <span>PEOPLE</span>
        <span>STORY</span>
        <span>STAGE</span>
      </div>

      <div class="words-content">
        <span class="section-kicker">02 / WHAT WE MAKE</span>

        <p>
          文化祭は、<br />
          <strong>完成したものを見る場所</strong>じゃない。
        </p>

        <p class="large-word">
          つくる。
        </p>

        <p>
          考えて、迷って、笑って、<br />
          ときどき失敗して、また進む。
        </p>
      </div>
    </section>

    <section class="base-section">
      <div class="base-background">38R</div>

      <div class="base-content">
        <span class="section-kicker">03 / OUR BASE</span>

        <h2>
          THIS IS<br />
          <span>OUR BASE.</span>
        </h2>

        <p>
          タスクも、予定も、台本も、<br />
          みんなの活動も。
        </p>

        <div class="base-links">
          <NuxtLink to="/scripts" class="base-link">
            <span>
              <small>PLAY / 01</small>
              台本を見る
            </span>
            <strong>→</strong>
          </NuxtLink>

          <button type="button" class="base-link" @click="scrollToTop">
            <span>
              <small>PLAY / 02</small>
              もう一度、最初から
            </span>
            <strong>↑</strong>
          </button>
        </div>
      </div>
    </section>

    <footer class="home-footer">
      <div>
        <strong>38R</strong>
        <span>SEIRYOFES PREPARATION SITE</span>
      </div>

      <span>WE'LL MAKE IT.</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

definePageMeta({
  middleware: 'auth',
})

const festivalDate = new Date('2027-09-11T09:00:00+09:00')

const remaining = ref({
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
})

const mounted = ref(false)

const updateCountdown = () => {
  const diff = festivalDate.getTime() - Date.now()

  if (diff <= 0) {
    remaining.value = {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    }
    return
  }

  const totalSeconds = Math.floor(diff / 1000)

  remaining.value = {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

const displayTime = computed(() => {
  if (!mounted.value) {
    return {
      days: '--',
      hours: '--',
      minutes: '--',
      seconds: '--',
    }
  }

  return {
    days: String(remaining.value.days).padStart(3, '0'),
    hours: String(remaining.value.hours).padStart(2, '0'),
    minutes: String(remaining.value.minutes).padStart(2, '0'),
    seconds: String(remaining.value.seconds).padStart(2, '0'),
  }
})

let countdownTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  mounted.value = true
  updateCountdown()

  countdownTimer = setInterval(updateCountdown, 1000)
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})

const scrollToNow = () => {
  document.querySelector('#now')?.scrollIntoView({
    behavior: 'smooth',
  })
}

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}
</script>

<style scoped>
.home-page {
  position: relative;
  width: 100%;
  min-height: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle at 75% 12%, rgba(87, 132, 255, 0.15), transparent 28%),
    radial-gradient(circle at 15% 75%, rgba(133, 92, 255, 0.12), transparent 30%),
    #08090d;
  color: #f5f5f2;
}

.home-page::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 20;
  opacity: 0.055;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px);
  background-size: 80px 80px;
}

.ambient {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
}

.ambient-one {
  width: 300px;
  height: 300px;
  top: 5%;
  right: -100px;
  background: rgba(81, 114, 255, 0.22);
  animation: float-one 12s ease-in-out infinite;
}

.ambient-two {
  width: 250px;
  height: 250px;
  top: 55%;
  left: -100px;
  background: rgba(156, 82, 255, 0.16);
  animation: float-two 15s ease-in-out infinite;
}

.ambient-three {
  width: 180px;
  height: 180px;
  top: 28%;
  left: 45%;
  background: rgba(255, 255, 255, 0.06);
  animation: float-three 10s ease-in-out infinite;
}

.hero-section {
  position: relative;
  min-height: calc(100svh - 20px);
  display: flex;
  align-items: center;
  overflow: hidden;
  isolation: isolate;
}

.hero-grid {
  position: absolute;
  inset: 0;
  opacity: 0.18;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 70px 70px;
  mask-image: linear-gradient(to bottom, black, transparent 90%);
}

.hero-content {
  position: relative;
  z-index: 3;
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 90px 0 110px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.55);
}

.eyebrow-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.8);
  animation: pulse 1.8s ease-in-out infinite;
}

.hero-title-wrap {
  position: relative;
  display: flex;
  align-items: flex-end;
}

.hero-small-text {
  position: absolute;
  top: 6px;
  left: 4px;
  font-size: clamp(14px, 2vw, 22px);
  font-weight: 800;
  letter-spacing: 0.25em;
  color: rgba(255, 255, 255, 0.5);
}

.hero-title {
  margin: 35px 0 0;
  font-size: clamp(150px, 27vw, 390px);
  line-height: 0.72;
  letter-spacing: -0.09em;
  font-weight: 900;
  white-space: nowrap;
}

.hero-number {
  background: linear-gradient(145deg, #ffffff 5%, #a9b6ff 48%, #7659ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-r {
  color: rgba(255, 255, 255, 0.16);
}

.hero-side-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 15px 30px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.45);
}

.hero-message {
  margin-top: 60px;
}

.message-main {
  margin: 0;
  font-size: clamp(32px, 5vw, 68px);
  font-weight: 800;
  letter-spacing: -0.06em;
}

.message-sub {
  margin: 12px 0 0;
  font-size: clamp(15px, 2vw, 22px);
  color: rgba(255, 255, 255, 0.48);
  letter-spacing: 0.08em;
}

.countdown-area {
  width: min(650px, 100%);
  margin-top: 55px;
}

.countdown-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.35);
}

.countdown {
  display: flex;
  align-items: center;
  gap: clamp(10px, 2vw, 22px);
}

.count-item {
  display: flex;
  flex-direction: column;
  min-width: 75px;
}

.count-item strong {
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.06em;
}

.count-item span {
  margin-top: 8px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.3);
}

.count-divider {
  align-self: flex-start;
  margin-top: 5px;
  font-size: 30px;
  color: rgba(255, 255, 255, 0.18);
}

.enter-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 220px;
  height: 58px;
  margin-top: 55px;
  padding: 0 18px 0 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  cursor: pointer;
  backdrop-filter: blur(16px);
  transition:
    transform 0.3s ease,
    background 0.3s ease,
    border-color 0.3s ease;
}

.enter-button:hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.11);
  border-color: rgba(255, 255, 255, 0.45);
}

.enter-button .arrow {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: #fff;
  color: #08090d;
  font-size: 15px;
}

.vertical-label {
  position: absolute;
  z-index: 4;
  top: 50%;
  writing-mode: vertical-rl;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.35em;
  color: rgba(255, 255, 255, 0.22);
}

.left-label {
  left: 20px;
  transform: translateY(-50%) rotate(180deg);
}

.right-label {
  right: 20px;
  transform: translateY(-50%);
}

.hero-number-background {
  position: absolute;
  z-index: -1;
  right: -8vw;
  bottom: -15vw;
  font-size: min(65vw, 900px);
  line-height: 0.8;
  font-weight: 900;
  letter-spacing: -0.1em;
  color: rgba(255, 255, 255, 0.018);
  user-select: none;
}

.now-section,
.words-section,
.base-section {
  position: relative;
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
}

.now-section {
  padding: 150px 0;
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 40px;
}

.section-kicker {
  display: block;
  margin-bottom: 20px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.25em;
  color: rgba(255, 255, 255, 0.3);
}

.section-header h2 {
  margin: 0;
  font-size: clamp(54px, 9vw, 120px);
  line-height: 0.8;
  letter-spacing: -0.08em;
}

.section-header h2 em {
  font-style: normal;
  color: #8e8aff;
}

.section-description {
  margin: 0 0 4px;
  font-size: 15px;
  line-height: 2;
  color: rgba(255, 255, 255, 0.42);
}

.progress-card {
  position: relative;
  margin-top: 80px;
  padding: clamp(28px, 5vw, 60px);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 28px;
  background:
    radial-gradient(circle at 85% 20%, rgba(103, 87, 255, 0.18), transparent 35%),
    rgba(255, 255, 255, 0.025);
  overflow: hidden;
}

.progress-card::after {
  content: "38R";
  position: absolute;
  right: -20px;
  bottom: -100px;
  font-size: 280px;
  line-height: 1;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.025);
}

.progress-card-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.mini-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.25em;
  color: rgba(255, 255, 255, 0.35);
}

.progress-card h3 {
  margin: 18px 0 0;
  font-size: clamp(30px, 5vw, 62px);
  line-height: 0.9;
  letter-spacing: -0.06em;
}

.big-percent {
  font-size: clamp(60px, 10vw, 140px);
  font-weight: 900;
  line-height: 0.7;
  letter-spacing: -0.08em;
  color: rgba(255, 255, 255, 0.1);
}

.progress-track {
  position: relative;
  z-index: 1;
  height: 3px;
  margin-top: 80px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-fill {
  width: 18%;
  height: 100%;
  background: linear-gradient(90deg, #fff, #8377ff);
  box-shadow: 0 0 20px rgba(131, 119, 255, 0.7);
}

.progress-footer {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.25);
}

.words-section {
  width: 100%;
  padding: 80px 0 180px;
  overflow: hidden;
}

.marquee {
  display: flex;
  gap: 45px;
  width: max-content;
  margin-bottom: 140px;
  transform: rotate(-3deg) translateX(-5%);
  animation: marquee 28s linear infinite;
}

.marquee span {
  font-size: clamp(70px, 12vw, 180px);
  font-weight: 900;
  line-height: 0.8;
  letter-spacing: -0.08em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255, 255, 255, 0.18);
}

.words-content {
  width: min(850px, calc(100% - 48px));
  margin: 0 auto;
}

.words-content > p:not(.large-word) {
  margin: 0 0 25px;
  font-size: clamp(22px, 4vw, 44px);
  line-height: 1.5;
  letter-spacing: -0.05em;
  color: rgba(255, 255, 255, 0.55);
}

.words-content > p strong {
  color: #fff;
}

.large-word {
  margin: 50px 0 40px;
  font-size: clamp(90px, 18vw, 230px);
  font-weight: 900;
  line-height: 0.8;
  letter-spacing: -0.1em;
  background: linear-gradient(135deg, #fff, #7e70ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.base-section {
  min-height: 720px;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.base-background {
  position: absolute;
  right: -5%;
  bottom: -12%;
  font-size: min(65vw, 800px);
  line-height: 0.7;
  font-weight: 900;
  letter-spacing: -0.1em;
  color: rgba(255, 255, 255, 0.025);
  user-select: none;
}

.base-content {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 100px 0;
}

.base-content h2 {
  margin: 0;
  font-size: clamp(70px, 12vw, 170px);
  line-height: 0.78;
  letter-spacing: -0.09em;
}

.base-content h2 span {
  color: #8880ff;
}

.base-content > p {
  margin: 55px 0 50px;
  font-size: 18px;
  line-height: 1.9;
  color: rgba(255, 255, 255, 0.42);
}

.base-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.base-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 260px;
  min-height: 90px;
  padding: 20px 22px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.035);
  color: #fff;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.3s ease,
    background 0.3s ease;
}

.base-link:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.08);
}

.base-link span {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
}

.base-link small {
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.3);
}

.base-link strong {
  font-size: 25px;
  font-weight: 400;
}

.home-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 100px 0 40px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.25);
}

.home-footer div {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.home-footer strong {
  font-size: 28px;
  color: #fff;
}

.home-footer span {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.8);
  }

  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes float-one {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(-50px, 35px, 0);
  }
}

@keyframes float-two {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(50px, -40px, 0);
  }
}

@keyframes float-three {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(20px, -30px, 0) scale(1.3);
  }
}

@keyframes marquee {
  from {
    transform: rotate(-3deg) translateX(-5%);
  }

  to {
    transform: rotate(-3deg) translateX(-45%);
  }
}

@media (max-width: 700px) {
  .hero-section {
    min-height: calc(100svh - 10px);
  }

  .hero-content {
    width: calc(100% - 32px);
    padding: 65px 0 90px;
  }

  .eyebrow {
    font-size: 8px;
    letter-spacing: 0.16em;
  }

  .hero-title {
    font-size: clamp(130px, 39vw, 240px);
  }

  .hero-side-text {
    display: none;
  }

  .hero-message {
    margin-top: 50px;
  }

  .message-main {
    font-size: 38px;
  }

  .message-sub {
    font-size: 13px;
    line-height: 1.7;
  }

  .countdown-area {
    margin-top: 45px;
  }

  .countdown-label {
    font-size: 7px;
  }

  .countdown {
    gap: 6px;
  }

  .count-item {
    min-width: 0;
    flex: 1;
  }

  .count-item strong {
    font-size: clamp(25px, 9vw, 42px);
  }

  .count-item span {
    font-size: 6px;
  }

  .count-divider {
    font-size: 20px;
  }

  .enter-button {
    width: 190px;
    margin-top: 40px;
  }

  .vertical-label {
    display: none;
  }

  .now-section,
  .words-section,
  .base-section {
    width: calc(100% - 32px);
  }

  .now-section {
    padding: 100px 0;
  }

  .section-header {
    display: block;
  }

  .section-header h2 {
    font-size: 62px;
  }

  .section-description {
    margin-top: 30px;
    font-size: 13px;
  }

  .progress-card {
    margin-top: 55px;
    padding: 28px 22px;
    border-radius: 22px;
  }

  .progress-card h3 {
    font-size: 34px;
  }

  .big-percent {
    font-size: 65px;
  }

  .progress-track {
    margin-top: 55px;
  }

  .progress-footer {
    font-size: 6px;
  }

  .words-section {
    padding: 40px 0 100px;
  }

  .marquee {
    margin-bottom: 90px;
  }

  .words-content {
    width: calc(100% - 32px);
  }

  .words-content > p:not(.large-word) {
    font-size: 23px;
  }

  .large-word {
    margin: 45px 0 35px;
    font-size: 105px;
  }

  .base-section {
    min-height: 650px;
  }

  .base-content {
    padding: 80px 0;
  }

  .base-content h2 {
    font-size: 75px;
  }

  .base-content > p {
    margin: 40px 0;
    font-size: 14px;
  }

  .base-links {
    display: flex;
    flex-direction: column;
  }

  .base-link {
    width: 100%;
    min-width: 0;
  }

  .home-footer {
    width: calc(100% - 32px);
    padding: 70px 0 30px;
  }

  .home-footer > span {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ambient,
  .marquee,
  .eyebrow-dot {
    animation: none;
  }

  html {
    scroll-behavior: auto;
  }
}
</style>
<template>
  <div class="seiryo-home">
    <!-- HERO -->
    <section class="hero">
      <div class="hero-top">
        <span class="eyebrow">38R / SEIRYOFES 2027</span>
        <span class="hero-status">
          <span class="status-dot"></span>
          PREPARING
        </span>
      </div>

    <p>
      38Rの活動をまとめるサイトです。うお
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

definePageMeta({
  middleware: 'auth',
})

/*
 * 星陵祭の日付
 * 実際の日程が確定したらここだけ変更すればOK
 */
const festivalDate = new Date('2027-09-11T09:00:00+09:00')

const now = ref(new Date())

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 60 * 1000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

const countdownDays = computed(() => {
  const diff = festivalDate.getTime() - now.value.getTime()

  if (diff <= 0) return 0

  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const todayText = computed(() => {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(now.value)
})

const todaySchedule = [
  {
    time: '16:00',
    title: 'クラスミーティング',
    place: '38R',
  },
  {
    time: '17:00',
    title: '劇準備',
    place: '放課後',
  },
  {
    time: '18:00',
    title: '委員会活動',
    place: '各担当場所',
  },
]

const todayMessage = '準備は、できるところから。'

const phases = [
  {
    icon: '🌱',
    title: '準備開始',
  },
  {
    icon: '🌿',
    title: '企画決定',
  },
  {
    icon: '🌳',
    title: '練習開始',
  },
  {
    icon: '🔥',
    title: '本番直前',
  },
  {
    icon: '⭐',
    title: '星陵祭',
  },
]

const currentPhase = 0

const progressPercent = computed(() => {
  return ((currentPhase + 1) / phases.length) * 100
})

const news = [
  {
    date: '09.30',
    tag: 'INFO',
    title: '38R星陵祭準備サイトがスタートしました',
  },
  {
    date: '09.29',
    tag: 'PLAY',
    title: 'クラス劇の準備が始まりました',
  },
  {
    date: '09.25',
    tag: '38R',
    title: '今年の星陵祭に向けて動き始めています',
  },
]

const activities = [
  {
    icon: '🎭',
    title: 'クラス劇',
    description: '劇づくりに向けて準備中',
  },
  {
    icon: '📅',
    title: 'スケジュール',
    description: 'これから予定を追加していきます',
  },
  {
    icon: '💬',
    title: '38Rの活動',
    description: 'みんなの活動を記録していきます',
  },
]

const menuItems = [
  {
    icon: '🎭',
    title: '台本',
    description: 'クラス劇の台本を見る',
    to: '/scripts',
  },
  {
    icon: '📅',
    title: 'カレンダー',
    description: '38Rの予定を見る',
    to: '/calendar',
  },
  {
    icon: '✓',
    title: 'タスク',
    description: 'やることを確認する',
    to: '/tasks',
  },
  {
    icon: '📦',
    title: '備品',
    description: '必要なものを確認する',
    to: '/supplies',
  },
  {
    icon: '👤',
    title: 'マイページ',
    description: '自分の活動を見る',
    to: '/mypage',
  },
]
</script>

<style scoped>
.seiryo-home {
  --navy: #102b43;
  --blue: #245b7a;
  --sky: #dfeef4;
  --cream: #f6f4ee;
  --paper: #fbfaf7;
  --text: #17232d;
  --muted: #71808a;
  --line: #dce2e5;

  min-height: 100%;
  background: var(--paper);
  color: var(--text);
  overflow: hidden;
}

/* =========================
   HERO
========================= */

.hero {
  position: relative;
  min-height: 610px;
  padding: 44px clamp(24px, 6vw, 90px) 70px;
  background:
    radial-gradient(circle at 78% 25%, rgba(255, 255, 255, 0.8), transparent 24%),
    linear-gradient(135deg, #e8f2f5 0%, #f5f4ee 58%, #e8edf0 100%);
  display: flex;
  flex-direction: column;
}

.hero::after {
  content: '38R';
  position: absolute;
  right: -4vw;
  bottom: -6vw;
  font-size: clamp(180px, 28vw, 440px);
  font-weight: 900;
  line-height: 0.8;
  letter-spacing: -0.08em;
  color: rgba(16, 43, 67, 0.045);
  pointer-events: none;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 1;
}

.eyebrow {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--navy);
}

.hero-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: var(--muted);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5c9b73;
}

.hero-main {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 60px;
  width: min(1180px, 100%);
  margin: auto auto 40px;
}

.hero-kicker {
  margin: 0 0 20px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--blue);
}

.hero h1 {
  margin: 0;
  font-size: clamp(48px, 7vw, 96px);
  line-height: 1.02;
  letter-spacing: -0.07em;
  font-weight: 900;
  color: var(--navy);
}

.hero h1 span {
  color: var(--blue);
}

.hero-description {
  margin: 28px 0 0;
  font-size: 15px;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.countdown {
  min-width: 245px;
  padding: 28px 30px;
  border-left: 1px solid rgba(16, 43, 67, 0.18);
}

.countdown-label {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: var(--muted);
}

.countdown-number {
  font-size: clamp(58px, 8vw, 88px);
  line-height: 0.9;
  font-weight: 900;
  letter-spacing: -0.07em;
  color: var(--navy);
}

.countdown-number span {
  margin-left: 7px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.countdown-date {
  margin: 14px 0 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--muted);
}

.hero-scroll {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(1180px, 100%);
  margin: 0 auto;
}

.hero-scroll span {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--muted);
}

.scroll-line {
  width: 45px;
  height: 1px;
  background: var(--muted);
}

/* =========================
   COMMON
========================= */

.section {
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 100px 0;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 34px;
}

.section-label {
  display: block;
  margin-bottom: 9px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: var(--blue);
}

.section-heading h2 {
  margin: 0;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1;
  letter-spacing: -0.06em;
  color: var(--navy);
}

.section-date {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.text-link {
  color: var(--navy);
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
}

.text-link:hover {
  color: var(--blue);
}

/* =========================
   TODAY
========================= */

.today-section {
  padding-top: 90px;
}

.today-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 18px;
}

.today-card {
  min-height: 300px;
  border-radius: 4px;
}

.schedule-card {
  padding: 30px;
  background: white;
  border: 1px solid var(--line);
}

.card-top {
  display: flex;
  justify-content: space-between;
}

.card-label {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.18em;
  color: var(--muted);
}

.card-icon {
  color: var(--muted);
}

.schedule-list {
  margin-top: 40px;
}

.schedule-item {
  display: flex;
  gap: 25px;
  padding: 19px 0;
  border-top: 1px solid var(--line);
}

.schedule-time {
  width: 48px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 800;
  color: var(--blue);
}

.schedule-content {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.schedule-content strong {
  font-size: 15px;
}

.schedule-content span {
  font-size: 11px;
  color: var(--muted);
}

.message-card {
  position: relative;
  overflow: hidden;
  padding: 30px;
  background: var(--navy);
  color: white;
}

.message-card .card-label {
  color: rgba(255, 255, 255, 0.5);
}

.message-mark {
  position: absolute;
  right: 20px;
  top: 25px;
  font-family: Georgia, serif;
  font-size: 110px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.08);
}

.message-card p {
  position: relative;
  margin: 85px 0 24px;
  max-width: 280px;
  font-size: clamp(25px, 3vw, 34px);
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.05em;
}

.message-note {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

/* =========================
   PLAY
========================= */

.play-section {
  padding-top: 70px;
}

.play-card {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  min-height: 450px;
  background: #eeeae1;
  color: var(--text);
  text-decoration: none;
  overflow: hidden;
}

.play-poster {
  position: relative;
  min-height: 450px;
  overflow: hidden;
  background: #203b4c;
}

.poster-background {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(145deg, transparent 35%, rgba(255, 255, 255, 0.08) 35%),
    linear-gradient(40deg, transparent 55%, rgba(255, 255, 255, 0.05) 55%),
    #203b4c;
}

.poster-content {
  position: absolute;
  inset: 50px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: white;
}

.poster-small {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.2em;
  opacity: 0.65;
}

.poster-content h3 {
  margin: auto 0;
  font-size: clamp(48px, 7vw, 84px);
  line-height: 0.84;
  letter-spacing: -0.07em;
}

.poster-year {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.15em;
  opacity: 0.65;
}

.poster-corner {
  position: absolute;
  right: 22px;
  top: 22px;
  font-size: 12px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.5);
}

.play-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(35px, 6vw, 80px);
}

.play-status {
  margin-bottom: 22px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
  color: var(--blue);
}

.play-info h3 {
  margin: 0;
  font-size: clamp(34px, 5vw, 62px);
  line-height: 1;
  letter-spacing: -0.07em;
  color: var(--navy);
}

.play-info p {
  margin: 25px 0 0;
  max-width: 380px;
  font-size: 13px;
  line-height: 1.9;
  color: var(--muted);
}

.play-arrow {
  display: flex;
  justify-content: space-between;
  margin-top: 55px;
  padding-top: 17px;
  border-top: 1px solid rgba(16, 43, 67, 0.18);
  font-size: 11px;
  font-weight: 800;
}

/* =========================
   NOW
========================= */

.now-section {
  padding-bottom: 80px;
}

.progress-card {
  padding: 35px;
  background: white;
  border: 1px solid var(--line);
}

.progress-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 45px;
}

.progress-small {
  display: block;
  margin-bottom: 7px;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.18em;
  color: var(--muted);
}

.progress-header strong {
  font-size: 28px;
  letter-spacing: -0.05em;
}

.progress-percent {
  font-size: 12px;
  font-weight: 900;
  color: var(--blue);
}

.timeline {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
}

.timeline-item {
  position: relative;
}

.timeline-point {
  position: relative;
  width: 13px;
  height: 13px;
  margin-bottom: 17px;
  border: 2px solid #cbd4d9;
  border-radius: 50%;
  background: white;
  z-index: 1;
}

.timeline-item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 5px;
  left: 13px;
  width: calc(100% - 13px);
  height: 2px;
  background: #dce2e5;
}

.timeline-item.active .timeline-point {
  border-color: var(--blue);
  background: var(--blue);
}

.timeline-item.active:not(:last-child)::after {
  background: var(--blue);
}

.timeline-text {
  display: flex;
  gap: 7px;
  align-items: center;
}

.timeline-text span {
  font-size: 14px;
}

.timeline-text strong {
  font-size: 11px;
  color: var(--muted);
}

.timeline-item.active .timeline-text strong {
  color: var(--navy);
}

.progress-bar {
  height: 3px;
  margin-top: 38px;
  background: #e6eaec;
}

.progress-fill {
  height: 100%;
  background: var(--blue);
  transition: width 0.4s ease;
}

/* =========================
   NEWS
========================= */

.news-section {
  padding-top: 60px;
}

.news-list {
  border-top: 1px solid var(--line);
}

.news-item {
  display: grid;
  grid-template-columns: 90px 1fr 25px;
  align-items: center;
  gap: 20px;
  padding: 22px 4px;
  border-bottom: 1px solid var(--line);
  color: var(--text);
  text-decoration: none;
  transition: padding 0.2s ease;
}

.news-item:hover {
  padding-left: 12px;
  padding-right: 12px;
}

.news-date {
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
}

.news-main {
  display: flex;
  align-items: center;
  gap: 13px;
}

.news-main strong {
  font-size: 14px;
}

.news-tag {
  padding: 4px 7px;
  background: #e8f0f3;
  color: var(--blue);
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.news-arrow {
  color: var(--muted);
}

/* =========================
   ACTIVITY
========================= */

.activity-section {
  padding-top: 60px;
}

.activity-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.activity-card {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 120px;
  padding: 24px;
  background: #eef2f3;
}

.activity-icon {
  font-size: 25px;
}

.activity-card div {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.activity-card strong {
  font-size: 14px;
}

.activity-card span:last-child {
  font-size: 10px;
  line-height: 1.5;
  color: var(--muted);
}

/* =========================
   MENU
========================= */

.menu-section {
  padding-top: 60px;
}

.menu-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.menu-item {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 190px;
  padding: 23px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  color: var(--text);
  text-decoration: none;
  transition:
    background 0.2s ease,
    transform 0.2s ease;
}

.menu-item:hover {
  background: white;
  transform: translateY(-3px);
}

.menu-icon {
  font-size: 22px;
  margin-bottom: auto;
}

.menu-item div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.menu-item strong {
  font-size: 14px;
}

.menu-item div span {
  font-size: 10px;
  color: var(--muted);
}

.menu-arrow {
  position: absolute;
  right: 18px;
  top: 18px;
  font-size: 14px;
  color: var(--muted);
}

/* =========================
   FOOTER
========================= */

.home-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 30px;
  padding: 70px clamp(24px, 6vw, 90px) 100px;
  background: var(--navy);
  color: white;
}

.footer-logo {
  display: flex;
  flex-direction: column;
}

.footer-logo span {
  font-size: 58px;
  line-height: 0.9;
  font-weight: 900;
  letter-spacing: -0.08em;
}

.footer-logo small {
  margin-top: 10px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.2em;
  opacity: 0.5;
}

.home-footer p {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}

/* =========================
   MOBILE
========================= */

@media (max-width: 800px) {
  .hero {
    min-height: 650px;
    padding: 28px 22px 45px;
  }

  .hero-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 45px;
  }

  .hero h1 {
    font-size: clamp(45px, 14vw, 70px);
  }

  .hero-description {
    font-size: 13px;
  }

  .countdown {
    width: 100%;
    min-width: 0;
    padding: 22px 0 0;
    border-left: 0;
    border-top: 1px solid rgba(16, 43, 67, 0.18);
  }

  .countdown-number {
    font-size: 65px;
  }

  .section {
    width: calc(100% - 36px);
    padding: 70px 0;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
    margin-bottom: 25px;
  }

  .section-heading h2 {
    font-size: 31px;
  }

  .today-grid {
    grid-template-columns: 1fr;
  }

  .today-card {
    min-height: auto;
  }

  .message-card {
    min-height: 260px;
  }

  .play-card {
    grid-template-columns: 1fr;
  }

  .play-poster {
    min-height: 390px;
  }

  .play-info {
    min-height: 350px;
    padding: 35px 28px;
  }

  .progress-card {
    padding: 25px 20px;
    overflow-x: auto;
  }

  .timeline {
    min-width: 620px;
  }

  .progress-bar {
    min-width: 620px;
  }

  .news-item {
    grid-template-columns: 55px 1fr 15px;
    gap: 10px;
  }

  .news-main {
    align-items: flex-start;
    flex-direction: column;
    gap: 5px;
  }

  .news-main strong {
    font-size: 13px;
    line-height: 1.5;
  }

  .activity-grid {
    grid-template-columns: 1fr;
  }

  .activity-card {
    min-height: 95px;
  }

  .menu-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .menu-item {
    min-height: 160px;
    padding: 18px;
  }

  .home-footer {
    align-items: flex-start;
    flex-direction: column;
    padding: 60px 24px 90px;
  }
}

@media (max-width: 430px) {
  .hero-top {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .hero {
    min-height: 610px;
  }

  .hero h1 {
    font-size: 46px;
  }

  .schedule-item {
    gap: 15px;
  }

  .schedule-time {
    width: 42px;
  }

  .menu-grid {
    grid-template-columns: 1fr 1fr;
  }

  .menu-item {
    min-height: 145px;
  }

  .menu-icon {
    font-size: 19px;
  }
}
</style>

<template>
  <main class="home-page">



    <!-- うさぎの導線・アニメーション -->
    <RabbitPath />

    <div class="content-layer">

      <!-- ヘッダー -->
      <header class="site-header">
        <!-- <NuxtLink to="/" class="logo">
          38R
          <span>CLASS PROJECT</span>
        </NuxtLink> -->
      </header>

      <!-- メインビジュアル -->
      <section class="hero">
        <p class="eyebrow">2027年度 星陵祭</p>

        <h1>
          38Rの<br>
          <span>星陵祭準備サイト</span>
        </h1>

        <div class="hero-actions">
          <NuxtLink to="/script" class="primary-button">
            台本を見る <span>→</span>
          </NuxtLink>

          <NuxtLink to="/calendar" class="secondary-button">
            予定を確認
          </NuxtLink>
        </div>
      </section>

      <!-- クイックアクセス -->
      <section class="quick-section">
        <div class="section-heading">
          <p class="section-label">MENU</p>
          <h2>何をする？</h2>
        </div>

        <div class="quick-grid">

          <NuxtLink to="/script" class="quick-card">
  <span class="card-icon">
    <BookOpen :size="24" :stroke-width="1.8" />
  </span>
  <h3>台本</h3>
  <p>最新の台本を確認する</p>
  <span class="card-arrow">
    <ArrowRight :size="18" />
  </span>
</NuxtLink>

<NuxtLink to="/calendar" class="quick-card">
  <span class="card-icon">
    <CalendarDays :size="24" :stroke-width="1.8" />
  </span>
  <h3>カレンダー</h3>
  <p>練習・イベントの予定</p>
  <span class="card-arrow">
    <ArrowRight :size="18" />
  </span>
</NuxtLink>

<NuxtLink to="/vote" class="quick-card">
  <span class="card-icon">
    <Vote :size="24" :stroke-width="1.8" />
  </span>
  <h3>投票</h3>
  <p>クラスの意見を集める</p>
  <span class="card-arrow">
    <ArrowRight :size="18" />
  </span>
</NuxtLink>

<NuxtLink to="/tasks" class="quick-card">
  <span class="card-icon">
    <CheckSquare :size="24" :stroke-width="1.8" />
  </span>
  <h3>タスク</h3>
  <p>自分のやることを確認</p>
  <span class="card-arrow">
    <ArrowRight :size="18" />
  </span>
</NuxtLink>
        </div>
      </section>

      <!-- お知らせ -->
      <section class="news-section">
        <div class="section-heading">
          <p class="section-label">INFORMATION</p>
          <h2>お知らせ</h2>
        </div>

        <div class="news-list">

          <article class="news-item">
            <span class="news-label new">NEW</span>
            <div class="news-content">
              <h3></h3>
              <p></p>
            </div>
            <span class="card-arrow">
              <ArrowRight :size="18" />
            </span>
          </article>

          <article class="news-item">
            <span class="news-label info">INFO</span>
            <div class="news-content">
              <h3></h3>
              <p></p>
            </div>
            <span class="card-arrow">
              <ArrowRight :size="18" />
            </span>
          </article>

          <article class="news-item">
            <span class="news-label info">INFO</span>
            <div class="news-content">
              <h3></h3>
              <p></p>
            </div>
            <span class="card-arrow">
              <ArrowRight :size="18" />
            </span>
          </article>

        </div>
      </section>

      <!-- 公演準備の進捗 -->
      <section class="progress-section">
        <div class="section-heading">
          <p class="section-label">OUR PROJECT</p>
          <h2>本番に向けて</h2>
        </div>

        <div class="progress-card">
          <div class="progress-top">
            <div>
              <p>星陵祭まで</p>
              <h3>あと ○○日</h3>
            </div>
            <span class="progress-icon">
              <Rabbit :size="24" />
            </span>
          </div>

          <div class="progress-info">
            <span>準備の進捗</span>
            <strong>??%</strong>
          </div>

          <div class="progress-bar">
            <div class="progress-value"></div>
          </div>

          <p class="progress-message">
          </p>
        </div>
      </section>

    </div>
  </main>
</template>

<script setup lang="ts">
import RabbitPath from '~/components/RabbitPath.vue'
import { Rabbit, ArrowRight, BookOpen, CalendarDays, CheckSquare, Vote } from 'lucide-vue-next'

const { $initRellax, $destroyRellax } = useNuxtApp()

onMounted(() => {
  $initRellax()
})

onBeforeUnmount(() => {
  $destroyRellax()
})

useHead({
  title: '38R 星陵祭準備サイト',
  meta: [
    {
      name: 'description',
      content: '38Rの星陵祭準備を管理するサイト'
    },
    {
      name: 'theme-color',
      content: '#ffffff'
    }
  ]
})
</script>

<style scoped>

/* ========================================
   1. 全体設定
======================================== */

.home-page {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: #ffffff;
  min-height: 2400px;
}

/* 背景レイヤー */
.parallax-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.background-curve {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* ドット背景 */
.home-page::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: radial-gradient(
    circle,
    #dce3e8 2px,
    transparent 2.5px
  );
  background-size: 44px 44px;
  opacity: 0.5;
}

/* ========================================
   2. Rellax 背景装飾
======================================== */

.background-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(4px);
  opacity: 0.25;
}

.circle-one {
  width: 280px;
  height: 280px;
  background: #29c64b;
  top: 300px;
  left: -100px;
}

.circle-two {
  width: 350px;
  height: 350px;
  background: #06a0d8;
  top: 1000px;
  right: -130px;
}

.circle-three {
  width: 220px;
  height: 220px;
  background: #ff0033;
  top: 1750px;
  left: -100px;
}

/* ========================================
   3. コンテンツ共通
======================================== */

.content-layer {
  position: relative;
  z-index: 2;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 40px;
}

/* ========================================
   4. ヘッダー
======================================== */


.pc-nav {
  display: flex;
  gap: 36px;
}

.pc-nav a {
  color: #17364d;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s;
}

.pc-nav a:hover {
  color: #ef4b55;
}

.menu-button {
  display: none;
}

/* ========================================
   5. メインビジュアル
======================================== */

.hero {
  min-height: 520px;
  padding: 100px 0 80px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.eyebrow {
  color: #52758a;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 2px;
}

.hero h1 {
  margin: 15px 0;
  font-size: clamp(38px, 6vw, 68px);
  line-height: 1.35;
  letter-spacing: -2px;
  font-weight: 900;
}

.hero h1 span {
  color: var(--color-primary);
}

.hero-description {
  color: #71818b;
  font-size: 17px;
  line-height: 2;
}

.hero-actions {
  display: flex;
  gap: 14px;
  margin-top: 30px;
}

.primary-button,
.secondary-button {
  padding: 15px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  transition: 0.2s;
}

.primary-button {
  color: white;
  background: #17364d;
}

.primary-button:hover {
  background: #284e69;
}

.primary-button span {
  margin-left: 15px;
}

.secondary-button {
  color: #17364d;
  background: white;
  border: 1px solid #cbd5dc;
}

.secondary-button:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* ========================================
   6. セクション見出し
======================================== */

.section-heading {
  margin-bottom: 25px;
}

.section-label {
  margin-bottom: 5px;
  color: #ef4b55;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
}

.section-heading h2 {
  font-size: 23px;
  font-weight: 800;
}

/* ========================================
   7. クイックアクセス
======================================== */

.quick-section {
  padding: 50px 0;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.quick-card {
  display: block;
  position: relative;
  padding: 30px;
  color: #17364d;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8ed;
  border-radius: 16px;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.quick-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(23, 54, 77, 0.07);
}

.card-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  background: rgba(23, 54, 77, 0.05);
  border-radius: 14px;
}

.quick-card h3 {
  margin: 14px 0 8px;
  font-size: 18px;
}

.quick-card p {
  color: #71818b;
  font-size: 13px;
}

.card-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #17364d;
}

/* ========================================
   8. お知らせ
======================================== */

.news-section {
  padding: 70px 0;
}

.news-list {
  padding: 10px 25px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8ed;
  border-radius: 16px;
}

.news-item {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px 5px;
  border-bottom: 1px solid #e5eaee;
}

.news-item:last-child {
  border-bottom: none;
}

.news-label {
  padding: 6px 10px;
  color: var(--color-primary);
  background: rgba(203, 3, 150, 0.05);
  border-radius: 5px;
  font-size: 11px;
  font-weight: 800;
}

.news-label.info {
  color: #52758a;
  background: #eaf0f4;
}

.news-content {
  flex: 1;
}

.news-item h3 {
  font-size: 14px;
}

.news-item p {
  margin-top: 6px;
  color: #9aa7af;
  font-size: 11px;
}

/* ========================================
   9. 進捗
======================================== */

.progress-section {
  padding: 50px 0;
}

.progress-card {
  padding: 30px;
  background: #fcebec;
  border-radius: 18px;
}

.progress-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progress-top p {
  color: #71818b;
  font-size: 13px;
}

.progress-top h3 {
  margin-top: 5px;
  font-size: 28px;
}

.progress-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 30px;
  font-size: 13px;
}

.progress-bar {
  height: 9px;
  margin-top: 10px;
  overflow: hidden;
  background: white;
  border-radius: 20px;
}

.progress-value {
  width: 65%;
  height: 100%;
  background: #ef4b55;
  border-radius: 20px;
}

.progress-message {
  margin-top: 15px;
  color: #71818b;
  font-size: 12px;
}

/* ========================================
   10. フッター
======================================== */

.site-footer {
  padding: 80px 0 40px;
  color: #9aa7af;
  font-size: 12px;
  text-align: center;
}

.site-footer h2 {
  margin-bottom: 5px;
  color: #17364d;
  font-size: 28px;
}

/* ========================================
   11. スマホ用ナビ
======================================== */

.bottom-nav {
  display: none;
}

/* ========================================
   12. スマホ対応
======================================== */

@media (max-width: 640px) {
  .home-page {
    padding-bottom: 100px;
  }

  .content-layer {
    padding: 0 24px;
  }

  .site-header {
    height: 75px;
  }

  .logo {
    font-size: 22px;
  }

  .pc-nav {
    display: none;
  }

  .menu-button {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px;
    border: none;
    background: transparent;
  }

  .menu-button span {
    width: 25px;
    height: 3px;
    display: block;
    background: #17364d;
    border-radius: 3px;
  }

  .hero {
    min-height: 470px;
    padding: 65px 0;
  }

  .hero h1 {
    font-size: 38px;
  }

  .hero-description {
    font-size: 14px;
  }

  .hero-actions {
    flex-wrap: wrap;
  }

  .quick-section {
    padding: 35px 0;
  }

  .quick-grid {
    gap: 12px;
  }

  .quick-card {
    padding: 20px 16px;
  }

  .quick-card h3 {
    font-size: 15px;
  }

  .quick-card p {
    font-size: 11px;
  }

  .news-section {
    padding: 45px 0;
  }

  .news-list {
    padding: 5px 12px;
  }

  .news-item {
    gap: 10px;
  }

  .news-item h3 {
    font-size: 12px;
  }

  .progress-card {
    padding: 22px;
  }

  .bottom-nav {
    position: fixed;
    z-index: 20;
    right: 0;
    bottom: 0;
    left: 0;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding-bottom: env(safe-area-inset-bottom);
    background: rgba(255, 255, 255, 0.97);
    border-top: 1px solid #e5eaee;
  }

  .bottom-nav a {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: #71818b;
    text-decoration: none;
  }

  .bottom-nav a span {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bottom-nav a small {
    font-size: 10px;
  }

  .bottom-nav a.active {
    color: #17364d;
    background: #eaf0f4;
  }
}

/* ========================================
   13. アクセシビリティ
======================================== */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}

</style>

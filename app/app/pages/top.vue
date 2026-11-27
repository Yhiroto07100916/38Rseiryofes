<template>
  <main class="home-page">

    <!-- うさぎと赤い導線 -->
    <RabbitPath />

    <!-- コンテンツ -->
    <div class="content-layer">

      <!-- ヘッダー -->
      <header class="site-header">
        <div class="logo">
          38R
          <span>CLASS PROJECT</span>
        </div>

        <nav class="pc-nav">
          <a href="#">ホーム</a>
          <a href="#">台本</a>
          <a href="#">カレンダー</a>
          <a href="#">タスク</a>
        </nav>

        <button class="menu-button" aria-label="メニュー">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </header>

      <!-- メインビジュアル -->
      <section class="hero">
        <p class="eyebrow">2027年度 星陵祭</p>

        <h1>
          38Rの<br />
          <span>星陵祭準備サイト</span>
        </h1>

        <p class="hero-description">
          みんなで作る、最高の舞台。
          <br />
          38Rの星陵祭準備をここから。
        </p>

        <div class="hero-actions">
          <a href="#" class="primary-button">
            台本を見る
            <span>→</span>
          </a>

          <a href="#" class="secondary-button">
            予定を確認
          </a>
        </div>
      </section>

      <!-- 情報カード -->
      <section class="quick-section">
        <h2>QUICK ACCESS</h2>

        <div class="quick-grid">
          <a href="#" class="quick-card">
            <span class="card-icon">📖</span>
            <h3>台本</h3>
            <p>最新の台本を確認する</p>
            <span class="card-arrow">→</span>
          </a>

          <a href="#" class="quick-card">
            <span class="card-icon">📅</span>
            <h3>カレンダー</h3>
            <p>練習・イベントの予定</p>
            <span class="card-arrow">→</span>
          </a>

          <a href="#" class="quick-card">
            <span class="card-icon">🗳️</span>
            <h3>投票</h3>
            <p>クラスの意見を集める</p>
            <span class="card-arrow">→</span>
          </a>

          <a href="#" class="quick-card">
            <span class="card-icon">✓</span>
            <h3>タスク</h3>
            <p>自分のやることを確認</p>
            <span class="card-arrow">→</span>
          </a>
        </div>
      </section>

      <!-- お知らせ -->
      <section class="news-section">
        <h2>NEWS / お知らせ</h2>

        <article class="news-item">
          <span class="news-label">NEW</span>
          <div>
            <h3>台本の第2場が更新されました</h3>
            <p>2026.11.25</p>
          </div>
          <span class="card-arrow">→</span>
        </article>

        <article class="news-item">
          <span class="news-label info">INFO</span>
          <div>
            <h3>次回の練習について</h3>
            <p>2026.11.24</p>
          </div>
          <span class="card-arrow">→</span>
        </article>
      </section>

      <!-- 下部 -->
      <footer class="site-footer">
        <p>38R CLASS PROJECT</p>
        <p>© 2026 38R</p>
      </footer>

    </div>
  </main>
</template>

<script setup lang="ts">
import RabbitPath from '~/components/RabbitPath.vue'

useHead({
  title: '38R 星陵祭準備サイト',
  meta: [
    {
      name: 'description',
      content: '38Rの星陵祭準備を管理するサイト'
    }
  ]
})
</script>

<script setup lang="ts">
import RabbitPath from '~/components/RabbitPath.vue'

useHead({
  title: '38R 星陵祭準備サイト'
})
</script>

<style scoped>
.home-page {
  position: relative;
  min-height: 2400px;
  background: #ffffff;
  color: #17364d;
  overflow: hidden;
}

/* ドット背景 */
.home-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    circle,
    #dce3e8 2px,
    transparent 2.5px
  );
  background-size: 44px 44px;
  opacity: 0.55;
  pointer-events: none;
  z-index: 0;
}

.content-layer {
  position: relative;
  z-index: 2;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 40px;
}

/* ヘッダー */
.site-header {
  height: 90px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #edf0f2;
  background: rgba(255, 255, 255, 0.92);
}

.logo {
  font-size: 25px;
  font-weight: 900;
  letter-spacing: -1px;
}

.logo span {
  display: block;
  font-size: 9px;
  letter-spacing: 2px;
  color: #71818b;
}

.pc-nav {
  display: flex;
  gap: 36px;
}

.pc-nav a {
  color: #17364d;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

.menu-button {
  display: none;
}

/* メインビジュアル */
.hero {
  min-height: 520px;
  padding: 100px 0 80px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.eyebrow {
  color: #52758a;
  font-weight: 700;
  letter-spacing: 2px;
}

.hero h1 {
  font-size: clamp(38px, 6vw, 68px);
  line-height: 1.35;
  letter-spacing: -2px;
  margin: 15px 0;
  font-weight: 900;
}

.hero h1 span {
  color: #ef4b55;
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
  text-decoration: none;
  font-weight: 700;
  font-size: 14px;
}

.primary-button {
  color: white;
  background: #17364d;
}

.primary-button span {
  margin-left: 15px;
}

.secondary-button {
  color: #17364d;
  border: 1px solid #cbd5dc;
  background: white;
}

/* クイックアクセス */
.quick-section {
  padding: 50px 0;
}

.quick-section h2,
.news-section h2 {
  font-size: 20px;
  margin-bottom: 25px;
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
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e2e8ed;
  border-radius: 16px;
  text-decoration: none;
  color: #17364d;
  transition: transform 0.2s, box-shadow 0.2s;
}

.quick-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(23, 54, 77, 0.07);
}

.card-icon {
  font-size: 26px;
}

.quick-card h3 {
  font-size: 18px;
  margin: 14px 0 8px;
}

.quick-card p {
  font-size: 13px;
  color: #71818b;
}

.card-arrow {
  color: #ef4b55;
  font-weight: 700;
}

/* お知らせ */
.news-section {
  padding: 70px 0;
}

.news-item {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px 10px;
  border-bottom: 1px solid #e5eaee;
}

.news-label {
  background: #fcebec;
  color: #ef4b55;
  font-size: 11px;
  font-weight: 800;
  padding: 6px 10px;
  border-radius: 5px;
}

.news-label.info {
  background: #eaf0f4;
  color: #52758a;
}

.news-item div {
  flex: 1;
}

.news-item h3 {
  font-size: 14px;
}

.news-item p {
  font-size: 11px;
  color: #9aa7af;
  margin-top: 6px;
}

/* フッター */
.site-footer {
  padding: 80px 0 40px;
  text-align: center;
  color: #9aa7af;
  font-size: 12px;
}

/* スマホ */
@media (max-width: 640px) {
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
    border: none;
    background: transparent;
    padding: 10px;
  }

  .menu-button span {
    display: block;
    width: 25px;
    height: 3px;
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

  .news-item {
    gap: 10px;
  }

  .news-item h3 {
    font-size: 12px;
  }
}
</style>

<script setup lang="ts">
definePageMeta({})
</script>
<template>
  <footer class="legal-links">
    <nav aria-label="法的情報">
      <NuxtLink to="/privacy-policy">プライバシーポリシー</NuxtLink>
      <span aria-hidden="true">·</span>
      <NuxtLink to="/terms">利用規約</NuxtLink>
    </nav>
    <p>© {{ new Date().getFullYear() }} 38R 星陵祭準備サイト</p>
  </footer>
</template>

<style scoped>
.legal-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 18px;
  padding: 24px 16px 32px;
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.8rem;
  text-align: center;
}

.legal-links nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.legal-links a {
  color: inherit;
  text-decoration: none;
}

.legal-links a:hover {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
}

.legal-links p {
  margin: 0;
}
</style>

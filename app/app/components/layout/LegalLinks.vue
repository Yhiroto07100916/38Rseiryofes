<template>
  <footer class="legal-links">
    <p>© {{ new Date().getFullYear() }} 38R 星陵祭準備サイト</p>
	<p>{{ systemInfo.app_version }}<p>
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

<template>
  <footer class="legal-links">
    <p>© {{ new Date().getFullYear() }} 38R 星陵祭準備サイト</p>
  </footer>
</template>
<script>
async function loadSettings() {
  loading.value = true

  try {
    const response = await api.apiFetch<{ settings: Partial<SiteSettings> }>(
      '/api/admin/settings',
    )
    Object.assign(settings, response.settings)
    settings.social_links = {
      ...defaultSettings().social_links,
      ...(response.settings.social_links ?? {}),
    }
    const featureDefaults = defaultFeatureSettings()
    const storedFeatures = response.settings.feature_settings ?? {}
    settings.feature_settings = Object.fromEntries(
      Object.entries({ ...featureDefaults, ...storedFeatures }).map(([key, config]) => [
        key,
        {
          ...(featureDefaults[key] ?? {
            enabled: true, view: true, create: true, edit: true, delete: true,
          }),
          ...config,
        },
      ]),
    )
    settings.notification_settings = {
      ...defaultSettings().notification_settings,
      ...(response.settings.notification_settings ?? {}),
      categories: {
        ...defaultSettings().notification_settings.categories,
        ...(response.settings.notification_settings?.categories ?? {}),
      },
      return_due_all_users: true,
    }
    settings.operation_settings = {
      ...defaultSettings().operation_settings,
      ...(response.settings.operation_settings ?? {}),
    }
    settings.security_settings = {
      ...defaultSettings().security_settings,
      ...(response.settings.security_settings ?? {}),
    }
    initialSnapshot.value = JSON.stringify(settings)
    const logResponse = await api.apiFetch<{ logs: SettingLog[] }>(
      '/api/admin/settings/logs',
    )
    settingLogs.value = logResponse.logs
    try {
      systemInfo.value = await api.apiFetch<{
        api_status: string
        database_status: string
        app_version: string
        release_notes: string
        deployment_id: string
        deployment_tag: string | null
        checked_at: string
      }>('/api/admin/settings/system-info')
    } catch (systemError) {
      console.warn('システム情報を取得できませんでした。', systemError)
      systemInfo.value = null
    }

    try {
      const adminResponse = await api.apiFetch<{ users: UserOption[] }>(
        '/api/admin/settings/roles',
      )
      isImportantSettingsAdmin.value = true
      importantAdmins.value = adminResponse.users
    } catch {
      isImportantSettingsAdmin.value = false
    }

    if (isImportantSettingsAdmin.value) {
      try {
        const candidateResponse = await api.apiFetch<{ users: UserOption[] }>(
          '/api/admin/settings/roles/candidates',
        )
        users.value = candidateResponse.users
      } catch (error) {
        console.error(error)
        snackbar.error('重要設定管理者の候補一覧を取得できませんでした。')
      }
    }
  } catch (error) {
    console.error(error)
    snackbar.error('サイト設定を取得できませんでした。')
  } finally {
    loading.value = false
  }
}
</script>

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

self.addEventListener('push', (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {
      title: '38Rサイト',
      body: '新しいお知らせがあります。',
    }
  }

  const title = typeof payload.title === 'string'
    ? payload.title
    : '38Rサイト'

  const options = {
    body: typeof payload.body === 'string' ? payload.body : '',
    icon: typeof payload.icon === 'string' ? payload.icon : '/pwa-192x192.png',
    badge: typeof payload.badge === 'string' ? payload.badge : '/pwa-64x64.png',
    tag: typeof payload.tag === 'string' ? payload.tag : undefined,
    renotify: false,
    data: {
      url: typeof payload.url === 'string' ? payload.url : '/',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const rawUrl = event.notification.data?.url
  let targetUrl = '/'

  if (
    typeof rawUrl === 'string' &&
    rawUrl.startsWith('/') &&
    !rawUrl.startsWith('//')
  ) {
    targetUrl = rawUrl
  }

  event.waitUntil((async () => {
    const target = new URL(targetUrl, self.location.origin)

    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) {
        continue
      }

      try {
        const navigatedClient = await client.navigate(target.href)
        if (navigatedClient) {
          await navigatedClient.focus()
          return navigatedClient
        }
      } catch (error) {
        console.error('Failed to navigate existing PWA window:', error)
      }

      return self.clients.openWindow(target.href)
    }

    return self.clients.openWindow(target.href)
  })())
})

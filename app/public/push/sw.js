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

  const rawUrl = event.notification.data && event.notification.data.url
  let targetUrl = '/'

  if (typeof rawUrl === 'string') {
    try {
      const candidate = new URL(rawUrl, self.location.origin)

      if (
        candidate.origin === self.location.origin &&
        /^\\/news\\/[A-Za-z0-9-]+$/.test(candidate.pathname)
      ) {
        targetUrl = candidate.pathname + candidate.search + candidate.hash
      }
    } catch {
      targetUrl = '/'
    }
  }

  event.waitUntil((async () => {
    const target = new URL(targetUrl, self.location.origin)
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(target.href)
        return client.focus()
      }
    }

    return self.clients.openWindow(target.href)
  })())
})

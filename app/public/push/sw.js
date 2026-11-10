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
      notificationId: typeof payload.notificationId === 'string'
        ? payload.notificationId
        : typeof payload.tag === 'string'
          ? payload.tag
          : null,
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
    const notificationId = event.notification.data?.notificationId

    // Push通知から開いた場合も、ログイン中なら正本の既読状態を先に更新する。
    if (typeof notificationId === 'string' && notificationId.length <= 64) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2500)
      try {
        await fetch(new URL('/api/notifications/' + encodeURIComponent(notificationId) + '/read', self.location.origin), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: true }),
          signal: controller.signal,
        })
      } catch (error) {
        console.error('Failed to mark the opened Push notification as read:', error)
      } finally {
        clearTimeout(timeout)
      }
    }

    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) {
        continue
      }

      try {
        const handledByApp = await new Promise((resolve) => {
          const channel = new MessageChannel()
          const timeout = setTimeout(() => {
            channel.port1.close()
            resolve(false)
          }, 500)

          channel.port1.onmessage = (messageEvent) => {
            clearTimeout(timeout)
            channel.port1.close()
            resolve(messageEvent.data?.handled === true)
          }

          client.postMessage({ type: '38R_PUSH_NAVIGATE', url: target.href }, [channel.port2])
        })

        if (handledByApp) {
          await client.focus()
          return client
        }

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

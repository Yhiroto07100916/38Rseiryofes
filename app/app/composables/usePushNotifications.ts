import { computed, ref } from 'vue'
import { useApi } from '~/composables/useApi'

type PushStatus =
  | 'loading'
  | 'unsupported'
  | 'not-registered'
  | 'registered'
  | 'permission-denied'
  | 'error'

const ENDPOINT_STORAGE_KEY = '38r-push-endpoint'

function toApplicationServerKey(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = window.atob(base64)

  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandaloneApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

async function waitUntilActivated(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  if (registration.active) {
    return
  }

  const worker = registration.installing || registration.waiting

  if (!worker) {
    throw new Error('通知用サービスワーカーを起動できませんでした。')
  }

  await new Promise<void>((resolve, reject) => {
    const onStateChange = () => {
      if (worker.state === 'activated') {
        worker.removeEventListener('statechange', onStateChange)
        resolve()
      } else if (worker.state === 'redundant') {
        worker.removeEventListener('statechange', onStateChange)
        reject(new Error('通知用サービスワーカーの起動に失敗しました。'))
      }
    }

    worker.addEventListener('statechange', onStateChange)
    onStateChange()
  })
}

export const usePushNotifications = () => {
  const { apiFetch } = useApi()
  const status = ref<PushStatus>('loading')
  const busy = ref(false)
  const error = ref('')

  const supported = computed(() => {
    if (!import.meta.client) {
      return false
    }

    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  })

  const statusLabel = computed(() => {
    const labels: Record<PushStatus, string> = {
      loading: '確認中',
      unsupported: 'この環境では利用できません',
      'not-registered': '未登録',
      registered: '登録済み',
      'permission-denied': 'スマートフォン側で通知が拒否されています',
      error: '状態を確認できません',
    }

    return labels[status.value]
  })

  const statusColor = computed(() => {
    if (status.value === 'registered') return 'success'
    if (status.value === 'permission-denied' || status.value === 'error') return 'error'
    return 'default'
  })

  const deleteServerSubscription = async (endpoint: string) => {
    await apiFetch('/api/push/subscriptions', {
      method: 'DELETE',
      body: { endpoint },
    })
  }

  const refresh = async () => {
    if (!import.meta.client) return

    error.value = ''

    if (!supported.value) {
      status.value = 'unsupported'
      return
    }

    status.value = 'loading'

    try {
      const permission = Notification.permission
      const registration = await navigator.serviceWorker.getRegistration('/push/')
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null

      if (permission === 'denied') {
        const endpoint = subscription?.endpoint ||
          localStorage.getItem(ENDPOINT_STORAGE_KEY)

        if (endpoint) {
          await deleteServerSubscription(endpoint)
        }

        if (subscription) {
          await subscription.unsubscribe()
        }

        localStorage.removeItem(ENDPOINT_STORAGE_KEY)
        status.value = 'permission-denied'
        return
      }

      if (!subscription) {
        const previousEndpoint = localStorage.getItem(ENDPOINT_STORAGE_KEY)

        if (previousEndpoint) {
          await deleteServerSubscription(previousEndpoint)
          localStorage.removeItem(ENDPOINT_STORAGE_KEY)
        }

        status.value = 'not-registered'
        return
      }

      const result = await apiFetch<{ registered: boolean }>(
        `/api/push/subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`,
      )

      if (result.registered) {
        localStorage.setItem(ENDPOINT_STORAGE_KEY, subscription.endpoint)
        status.value = 'registered'
      } else {
        status.value = 'not-registered'
      }
    } catch (cause) {
      console.error('Failed to refresh push notification status:', cause)
      status.value = 'error'
      error.value = '通知の登録状態を確認できませんでした。通信環境を確認して再読み込みしてください。'
    }
  }

  const enable = async () => {
    if (!import.meta.client || busy.value) return

    error.value = ''

    if (!supported.value) {
      status.value = 'unsupported'
      error.value = 'このブラウザではプッシュ通知を利用できません。'
      return
    }

    if (isIosDevice() && !isStandaloneApp()) {
      error.value = 'iPhoneでは、38Rサイトをホーム画面に追加し、ホーム画面のアイコンから開いてください。'
      return
    }

    busy.value = true

    try {
      // 通知許可の要求は、ユーザーがボタンを押した操作の中で行う。
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission

      if (permission !== 'granted') {
        status.value = 'permission-denied'
        error.value = 'スマートフォン側で38Rサイトの通知を許可してください。'
        return
      }

      const config = await apiFetch<{ publicKey: string }>('/api/push/config')
      const registration = await navigator.serviceWorker.register(
        '/push/sw.js',
        { scope: '/push/' },
      )

      await waitUntilActivated(registration)

      const subscription = await registration.pushManager.getSubscription() ||
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toApplicationServerKey(config.publicKey),
        })

      const json = subscription.toJSON()

      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error('スマートフォンから通知登録情報を取得できませんでした。')
      }

      await apiFetch('/api/push/subscriptions', {
        method: 'POST',
        body: json,
      })

      localStorage.setItem(ENDPOINT_STORAGE_KEY, json.endpoint)
      status.value = 'registered'
    } catch (cause: any) {
      console.error('Failed to enable push notifications:', cause)
      status.value = 'error'
      error.value =
        cause?.data?.error ||
        cause?.message ||
        '通知を有効にできませんでした。時間をおいて再度お試しください。'
    } finally {
      busy.value = false
    }
  }

  const disable = async () => {
    if (!import.meta.client || busy.value) return

    busy.value = true
    error.value = ''

    try {
      const registration = await navigator.serviceWorker.getRegistration('/push/')
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null
      const endpoint = subscription?.endpoint ||
        localStorage.getItem(ENDPOINT_STORAGE_KEY)

      if (endpoint) {
        await deleteServerSubscription(endpoint)
      }

      if (subscription) {
        await subscription.unsubscribe()
      }

      if (registration) {
        await registration.unregister()
      }

      localStorage.removeItem(ENDPOINT_STORAGE_KEY)
      status.value = 'not-registered'
    } catch (cause: any) {
      console.error('Failed to disable push notifications:', cause)
      status.value = 'error'
      error.value =
        cause?.data?.error ||
        cause?.message ||
        '通知を無効にできませんでした。時間をおいて再度お試しください。'
    } finally {
      busy.value = false
    }
  }

  return {
    status,
    busy,
    error,
    supported,
    statusLabel,
    statusColor,
    refresh,
    enable,
    disable,
  }
}

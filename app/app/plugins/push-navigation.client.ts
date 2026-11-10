export default defineNuxtPlugin(() => {
  const router = useRouter()

  if (!("serviceWorker" in navigator)) return

  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: unknown; url?: unknown } | null
    if (data?.type !== "38R_PUSH_NAVIGATE" || typeof data.url !== "string") return

    let target: URL
    try {
      target = new URL(data.url, window.location.origin)
    } catch {
      event.ports[0]?.postMessage({ handled: false })
      return
    }

    if (target.origin !== window.location.origin || !target.pathname.startsWith("/")) {
      event.ports[0]?.postMessage({ handled: false })
      return
    }

    void router.replace(target.pathname + target.search + target.hash)
      .then(() => event.ports[0]?.postMessage({ handled: true }))
      .catch(() => event.ports[0]?.postMessage({ handled: false }))
  })
})

import { useUploadQueueStore } from '~/stores/uploadQueue'

interface UploadOptions<T> {
  headers?: Record<string, string>
  contextKey?: string
  onSuccess?: (response: T) => void | Promise<void>
}

export const useUpload = () => {
  const config = useRuntimeConfig()
  const queue = useUploadQueueStore()

  const upload = <T>(
    file: File,
    path: string,
    formData: FormData,
    options: UploadOptions<T> = {},
  ) => {
    return queue.enqueue(file, async (onProgress, signal) => {
      const response = await new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const baseURL = String(config.public.apiBaseUrl || window.location.origin).replace(/\/$/, '')
        const url = new URL(path, `${baseURL}/`)

        xhr.open('POST', url.toString(), true)
        xhr.withCredentials = true

        for (const [name, value] of Object.entries(options.headers || {})) {
          xhr.setRequestHeader(name, value)
        }

        xhr.upload.addEventListener('progress', event => {
          if (event.lengthComputable) {
            onProgress((event.loaded / event.total) * 100)
          }
        })

        xhr.addEventListener('load', () => {
          let data: unknown = xhr.responseText
          try {
            data = xhr.responseText ? JSON.parse(xhr.responseText) : {}
          } catch {
            data = { message: xhr.responseText || 'サーバーから不正な応答が返されました。' }
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data as T)
            return
          }

          const body = data && typeof data === 'object'
            ? data as Record<string, unknown>
            : {}
          const message = String(body.message || body.error || `アップロードに失敗しました（HTTP ${xhr.status}）。`)
          reject(Object.assign(new Error(message), {
            status: xhr.status,
            data: body,
          }))
        })

        xhr.addEventListener('error', () => reject(new Error('通信に失敗しました。ネットワークを確認してください。')))
        xhr.addEventListener('abort', () => reject(new Error('アップロードをキャンセルしました。')))

        if (signal.aborted) {
          xhr.abort()
          return
        }

        signal.addEventListener('abort', () => xhr.abort(), { once: true })
        xhr.send(formData)
      })

      await options.onSuccess?.(response)
      return response
    }, { contextKey: options.contextKey })
  }

  return { upload, queue }
}

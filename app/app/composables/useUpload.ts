import { useUploadQueueStore } from '~/stores/uploadQueue'

interface UploadOptions {
  headers?: Record<string, string>
}

export const useUpload = () => {
  const config = useRuntimeConfig()
  const queue = useUploadQueueStore()

  const upload = <T>(
    file: File,
    path: string,
    formData: FormData,
    options: UploadOptions = {},
  ) => {
    return queue.enqueue(file, (onProgress, signal) => new Promise<T>((resolve, reject) => {
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
        let response: unknown = xhr.responseText
        try {
          response = xhr.responseText ? JSON.parse(xhr.responseText) : {}
        } catch {
          response = { message: xhr.responseText || 'サーバーから不正な応答が返されました。' }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response as T)
          return
        }

        const data = response && typeof response === 'object'
          ? response as Record<string, unknown>
          : {}
        const message = String(data.message || data.error || `アップロードに失敗しました（HTTP ${xhr.status}）。`)
        const error = Object.assign(new Error(message), {
          status: xhr.status,
          data,
        })
        reject(error)
      })

      xhr.addEventListener('error', () => reject(new Error('通信に失敗しました。ネットワークを確認してください。')))
      xhr.addEventListener('abort', () => reject(new Error('アップロードをキャンセルしました。')))

      if (signal.aborted) {
        xhr.abort()
        return
      }

      signal.addEventListener('abort', () => xhr.abort(), { once: true })
      xhr.send(formData)
    }))
  }

  return { upload, queue }
}

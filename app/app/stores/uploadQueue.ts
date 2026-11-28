import { computed, ref } from 'vue'

export type UploadTaskStatus = 'queued' | 'uploading' | 'completed' | 'failed' | 'cancelled'

export interface UploadTask {
  id: string
  fileName: string
  fileSize: number
  contentType: string
  status: UploadTaskStatus
  progress: number
  error: string
  createdAt: number
  finishedAt: number | null
  result: unknown
  resultId: string | null
  contextKey: string | null
  linked: boolean
}

type UploadExecutor = (
  onProgress: (progress: number) => void,
  signal: AbortSignal,
) => Promise<unknown>

interface Deferred {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

const MAX_CONCURRENT_UPLOADS = 3
const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const HISTORY_STORAGE_KEY = '38rseiryofes:upload-history:v1'
const executors = new Map<string, UploadExecutor>()
const controllers = new Map<string, AbortController>()
const deferreds = new Map<string, Deferred>()

const createDeferred = () => {
  let resolve!: (value: unknown) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'アップロードに失敗しました。'

export const useUploadQueueStore = defineStore('uploadQueue', () => {
  const tasks = ref<UploadTask[]>([])
  const initialized = ref(false)
  const activeCount = computed(() => tasks.value.filter(task => task.status === 'uploading').length)
  const pendingCount = computed(() => tasks.value.filter(task => task.status === 'queued').length)
  const failedCount = computed(() => tasks.value.filter(task => task.status === 'failed').length)
  const hasActiveTasks = computed(() => activeCount.value > 0 || pendingCount.value > 0)

  const saveHistory = () => {
    if (!import.meta.client) return
    const cutoff = Date.now() - HISTORY_RETENTION_MS
    const history = tasks.value
      .filter(task => task.status === 'completed' && task.finishedAt !== null && task.finishedAt >= cutoff)
      .map(task => ({
        ...task,
        result: null,
      }))
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
    } catch (error) {
      console.warn('[UploadQueue] Failed to persist upload history:', error)
    }
  }

  const pruneHistory = () => {
    const cutoff = Date.now() - HISTORY_RETENTION_MS
    tasks.value = tasks.value.filter(task =>
      task.status !== 'completed' || task.finishedAt === null || task.finishedAt >= cutoff,
    )
    saveHistory()
  }

  const initialize = () => {
    if (!import.meta.client || initialized.value) return
    initialized.value = true
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          const history = parsed.filter((item): item is UploadTask =>
            !!item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.fileName === 'string' &&
            item.status === 'completed' &&
            typeof item.finishedAt === 'number',
          )
          tasks.value = history.map(task => ({
            ...task,
            result: task.resultId ? { id: task.resultId } : null,
            contextKey: typeof task.contextKey === 'string' ? task.contextKey : null,
            linked: Boolean(task.linked),
          }))
        }
      }
    } catch (error) {
      console.warn('[UploadQueue] Failed to restore upload history:', error)
    }
    pruneHistory()
  }

  const createTaskPromise = (id: string) => {
    const deferred = createDeferred()
    deferreds.set(id, deferred)
    return deferred.promise
  }

  const startTask = async (task: UploadTask) => {
    const executor = executors.get(task.id)
    if (!executor) {
      task.status = 'failed'
      task.error = 'アップロード処理を復元できません。ファイルを再選択してください。'
      return
    }

    const controller = new AbortController()
    controllers.set(task.id, controller)
    task.status = 'uploading'
    task.progress = 0
    task.error = ''

    try {
      const result = await executor(
        progress => {
          task.progress = Math.max(0, Math.min(100, Math.round(progress)))
        },
        controller.signal,
      )
      task.result = result
      task.resultId = result && typeof result === 'object' && 'id' in result && typeof (result as { id?: unknown }).id === 'string'
        ? (result as { id: string }).id
        : null
      task.progress = 100
      task.status = 'completed'
      task.finishedAt = Date.now()
      deferreds.get(task.id)?.resolve(result)
      deferreds.delete(task.id)
      executors.delete(task.id)
      saveHistory()
    } catch (error) {
      if (controller.signal.aborted) {
        task.status = 'cancelled'
        task.error = 'キャンセルしました。'
      } else {
        task.status = 'failed'
        task.error = errorMessage(error)
      }
      task.finishedAt = null
      deferreds.get(task.id)?.reject(error)
      deferreds.delete(task.id)
    } finally {
      controllers.delete(task.id)
      pump()
    }
  }

  function pump() {
    while (activeCount.value < MAX_CONCURRENT_UPLOADS) {
      const next = tasks.value.find(task => task.status === 'queued')
      if (!next) break
      void startTask(next)
    }
  }

  const enqueue = (
    file: File,
    executor: UploadExecutor,
    metadata: { contextKey?: string } = {},
  ): { id: string; promise: Promise<unknown> } => {
    initialize()
    const id = crypto.randomUUID()
    const task: UploadTask = {
      id,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      status: 'queued',
      progress: 0,
      error: '',
      createdAt: Date.now(),
      finishedAt: null,
      result: null,
      resultId: null,
      contextKey: metadata.contextKey ?? null,
      linked: false,
    }
    tasks.value.unshift(task)
    executors.set(id, executor)
    const promise = createTaskPromise(id)
    pump()
    return { id, promise }
  }

  const retry = (id: string) => {
    const task = tasks.value.find(item => item.id === id)
    if (!task || !['failed', 'cancelled'].includes(task.status) || !executors.has(id)) {
      return Promise.reject(new Error('このファイルは再試行できません。'))
    }
    task.status = 'queued'
    task.progress = 0
    task.error = ''
    task.finishedAt = null
    task.result = null
    task.resultId = null
    const promise = createTaskPromise(id)
    pump()
    return promise
  }

  const cancel = (id: string) => {
    const task = tasks.value.find(item => item.id === id)
    if (!task || !['queued', 'uploading'].includes(task.status)) return

    if (task.status === 'uploading') {
      controllers.get(id)?.abort()
      return
    }

    task.status = 'cancelled'
    task.error = 'キャンセルしました。'
    deferreds.get(id)?.reject(new Error(task.error))
    deferreds.delete(id)
  }

  const cancelAll = () => {
    for (const task of tasks.value) {
      if (task.status === 'uploading') {
        controllers.get(task.id)?.abort()
      } else if (task.status === 'queued') {
        task.status = 'cancelled'
        task.error = 'キャンセルしました。'
        deferreds.get(task.id)?.reject(new Error(task.error))
        deferreds.delete(task.id)
      }
    }
  }

  const clearCompleted = () => {
    tasks.value = tasks.value.filter(task => task.status !== 'completed')
    saveHistory()
  }

  const markLinked = (ids: string[]) => {
    const idSet = new Set(ids)
    for (const task of tasks.value) {
      if (idSet.has(task.id)) task.linked = true
    }
    saveHistory()
  }

  return {
    tasks,
    initialized,
    activeCount,
    pendingCount,
    failedCount,
    hasActiveTasks,
    initialize,
    enqueue,
    retry,
    cancel,
    cancelAll,
    clearCompleted,
    markLinked,
  }
})

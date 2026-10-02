import { defineStore } from 'pinia'
import { ref } from 'vue'

type SnackbarType = 'success' | 'error' | 'warning' | 'info'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
}

export const useUiStore = defineStore('ui', () => {
  const snackbarVisible = ref(false)
  const snackbarMessage = ref('')
  const snackbarType = ref<SnackbarType>('info')
  const snackbarTimeout = ref(3000)

  const confirmVisible = ref(false)
  const confirmTitle = ref('確認')
  const confirmMessage = ref('')
  const confirmText = ref('確認')
  const confirmCancelText = ref('キャンセル')
  const confirmColor = ref('primary')

  let confirmResolver: ((value: boolean) => void) | null = null

  const showSnackbar = (
    message: string,
    type: SnackbarType = 'info',
    timeout = 3000,
  ) => {
    snackbarMessage.value = message
    snackbarType.value = type
    snackbarTimeout.value = timeout
    snackbarVisible.value = true
  }

  const success = (message: string, timeout = 3000) => {
    showSnackbar(message, 'success', timeout)
  }

  const error = (message: string, timeout = 4000) => {
    showSnackbar(message, 'error', timeout)
  }

  const warning = (message: string, timeout = 3500) => {
    showSnackbar(message, 'warning', timeout)
  }

  const info = (message: string, timeout = 3000) => {
    showSnackbar(message, 'info', timeout)
  }

  const closeSnackbar = () => {
    snackbarVisible.value = false
  }

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    console.log('[Confirm] opened:', options.title)

    if (confirmResolver) {
      console.log('[Confirm] previous resolver cancelled')
      confirmResolver(false)
    }

    confirmTitle.value = options.title ?? '確認'
    confirmMessage.value = options.message
    confirmText.value = options.confirmText ?? '確認'
    confirmCancelText.value = options.cancelText ?? 'キャンセル'
    confirmColor.value = options.confirmColor ?? 'primary'
    confirmVisible.value = true

    return new Promise((resolve) => {
      confirmResolver = resolve
    })
  }

  const resolveConfirm = (value: boolean) => {
    console.log('[Confirm] resolved:', value)

    confirmVisible.value = false

    if (confirmResolver) {
      confirmResolver(value)
      confirmResolver = null
    } else {
      console.warn('[Confirm] resolver is missing')
    }
  }

  return {
    snackbarVisible,
    snackbarMessage,
    snackbarType,
    snackbarTimeout,
    confirmVisible,
    confirmTitle,
    confirmMessage,
    confirmText,
    confirmCancelText,
    confirmColor,
    showSnackbar,
    success,
    error,
    warning,
    info,
    closeSnackbar,
    confirm,
    resolveConfirm,
  }
})

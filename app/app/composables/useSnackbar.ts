import { useUiStore } from '~/stores/ui'

export const useSnackbar = () => {
  const ui = useUiStore()

  return {
    show: ui.showSnackbar,
    success: ui.success,
    error: ui.error,
    warning: ui.warning,
    info: ui.info,
  }
}

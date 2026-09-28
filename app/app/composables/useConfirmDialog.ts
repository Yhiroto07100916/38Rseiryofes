import { useUiStore } from '~/stores/ui'

export const useConfirmDialog = () => {
  const ui = useUiStore()

  return {
    confirm: ui.confirm,
  }
}

import Rellax from 'rellax'

export default defineNuxtPlugin(() => {
  let rellax: InstanceType<typeof Rellax> | null = null

  const initRellax = () => {
    rellax?.destroy()

    rellax = new Rellax('.rellax', {
      speed: -30,
      center: false,
      wrapper: null,
      round: true,
      vertical: true,
      horizontal: false,
    })
  }

  return {
    provide: {
      initRellax,
      destroyRellax: () => {
        rellax?.destroy()
        rellax = null
      },
    },
  }
})
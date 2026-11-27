import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

export default defineNuxtPlugin(() => {
    const lenis = new Lenis({
    autoRaf: true,
    lerp: 0.08,
    smoothWheel: true,
    wheelMultiplier: 0.9,
    })

  // 背景の視差効果
    lenis.on('scroll', ({ scroll }) => {
    document.documentElement.style.setProperty(
        '--parallax-offset',
      `${scroll * 0.2}px`
    )
  })

  return {
    provide: {
      lenis,
    },
  }
})
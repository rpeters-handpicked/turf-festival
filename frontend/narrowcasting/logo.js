/**
 * TURF narrowcasting — geanimeerd logo (Lottie van de TURF-website)
 *
 * Gedeeld door de player en de editor in de Studio. De Lottie-bibliotheek wordt
 * meegegeven (player: window.lottie uit vendor/, Studio: het npm-pakket lottie-web),
 * zodat dit bestand zelf niets hoeft te importeren.
 *
 * Gebruik: zet `data-turf-logo` op een leeg element en roep mountLogos(root, …) aan.
 * De animatie loopt synchroon met de klok, zodat het logo bij een slidewissel
 * gewoon doorloopt in plaats van steeds opnieuw te beginnen.
 */

export const LOGO_ANIM = {
  file: 'turf-logo-anim.json',
  /** hoogte / breedte van de animatie (242 × 24) */
  ratio: 24 / 242,
}

const dataCache = new Map()

function loadData(assets) {
  const url = `${assets}/${LOGO_ANIM.file}`
  if (!dataCache.has(url)) {
    dataCache.set(
      url,
      fetch(url)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .catch(err => {
          dataCache.delete(url)
          throw err
        }),
    )
  }
  return dataCache.get(url)
}

// De animatie is zwart; met deze regel volgt hij de tekstkleur (`color`) van zijn container.
let styled = false
function injectStyle() {
  if (styled || typeof document === 'undefined') return
  styled = true
  const style = document.createElement('style')
  style.textContent = '[data-turf-logo] svg path{fill:currentColor!important}[data-turf-logo] svg{display:block}'
  document.head.appendChild(style)
}

function staticFallback(node, assets) {
  if (node.querySelector('img')) return
  const img = document.createElement('img')
  img.src = `${assets}/turf-logo.svg`
  img.alt = 'TURF'
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block'
  node.appendChild(img)
}

/**
 * Start de animatie in één element. Geeft een opruimfunctie terug.
 * `align`: 'left' | 'center' (standaard uit data-align of 'center').
 */
export function mountLogo(node, lottie, assets, {align} = {}) {
  injectStyle()
  let anim = null
  let stopped = false
  const position = (align || node.dataset.align) === 'left' ? 'xMinYMid meet' : 'xMidYMid meet'

  if (!lottie) {
    staticFallback(node, assets)
    return () => {}
  }

  loadData(assets)
    .then(data => {
      if (stopped) return
      anim = lottie.loadAnimation({
        container: node,
        renderer: 'svg',
        loop: true,
        autoplay: false,
        // Lottie past de data aan tijdens het afspelen: elke keer een eigen kopie.
        animationData: structuredClone(data),
        rendererSettings: {preserveAspectRatio: position, progressiveLoad: false},
      })
      const durationMs = ((data.op - data.ip) / data.fr) * 1000
      anim.addEventListener('DOMLoaded', () => anim.goToAndPlay(Date.now() % durationMs, false))
    })
    .catch(err => {
      console.warn('[narrowcasting] logo-animatie niet geladen, statisch logo gebruikt:', err)
      if (!stopped) staticFallback(node, assets)
    })

  return () => {
    stopped = true
    anim?.destroy()
  }
}

/** Start alle `[data-turf-logo]`-elementen binnen `root`. Geeft één opruimfunctie terug. */
export function mountLogos(root, lottie, assets) {
  const stops = [...root.querySelectorAll('[data-turf-logo]')].map(node => mountLogo(node, lottie, assets))
  return () => stops.forEach(stop => stop())
}

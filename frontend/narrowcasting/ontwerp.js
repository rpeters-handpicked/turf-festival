/**
 * TURF narrowcasting — eigen ontwerpen (slide-editor)
 *
 * Dit bestand wordt gedeeld door de player én de editor in de Studio. Beide bouwen
 * een ontwerp op uit dezelfde beschrijving, zodat wat je in de editor ziet exact is
 * wat op het scherm komt. Pure functies: geen DOM, geen React.
 */

import {LOGO_ANIM} from './logo.js'

export const SANITY ={projectId: 'x545nfex', dataset: 'production'}

export const CANVAS = {
  landscape: {w: 1920, h: 1080},
  portrait: {w: 1080, h: 1920},
}

export const KLEUREN = [
  {naam: 'Wit', hex: '#ffffff'},
  {naam: 'Inkt', hex: '#0d2023'},
  {naam: 'Oranje', hex: '#f0641e'},
  {naam: 'Geel', hex: '#f2b63f'},
  {naam: 'Paars', hex: '#7a2cf5'},
  {naam: 'Roze', hex: '#d94080'},
  {naam: 'Lime', hex: '#c8f04a'},
]

export const FONTS = {
  thunder: {
    label: 'Thunder (koppen)',
    family: "'Thunder', Impact, 'Arial Narrow', sans-serif",
    lineHeight: 0.86,
    weights: [500, 600, 700, 800],
  },
  barlow: {
    label: 'Barlow (tekst)',
    family: "'Barlow', 'Helvetica Neue', Arial, sans-serif",
    lineHeight: 1.2,
    weights: [400, 500, 600, 700],
  },
}

export const ACHTERGRONDEN = [
  {value: 'verloop1', label: 'Verloop 1'},
  {value: 'verloop2', label: 'Verloop 2'},
  {value: 'verloop3', label: 'Verloop 3'},
  {value: 'kleur', label: 'Effen kleur'},
  {value: 'afbeelding', label: 'Eigen afbeelding'},
]

/** Tekstcodes die de player bij het tonen invult. */
export const TOKENS = [
  {code: '{tijd}', uitleg: 'huidige tijd'},
  {code: '{dag}', uitleg: 'festivaldag'},
  {code: '{locatie}', uitleg: 'locatie van het scherm'},
  {code: '{volgende_tijd}', uitleg: 'starttijd volgend event hier'},
  {code: '{volgende_titel}', uitleg: 'titel volgend event hier'},
  {code: '{volgende_sprekers}', uitleg: 'sprekers volgend event hier'},
]

export function fillTokens(text, values = {}) {
  return String(text ?? '').replace(/\{([a-z_]+)\}/g, (match, key) => (key in values ? values[key] ?? '' : match))
}

/** URL van een Sanity-afbeelding, rechtstreeks uit de asset-referentie. */
export function imageUrl(image, {w} = {}) {
  const m = /^image-([a-zA-Z0-9]+)-(\d+x\d+)-(\w+)$/.exec(image?.asset?._ref || '')
  if (!m) return ''
  const base = `https://cdn.sanity.io/images/${SANITY.projectId}/${SANITY.dataset}/${m[1]}-${m[2]}.${m[3]}`
  return w && m[3] !== 'svg' ? `${base}?w=${Math.round(w)}&auto=format&q=80` : base
}

/**
 * Het TURF-kader: een afgerond vlak met een uitgebeten hoek linksboven en rechtsonder,
 * zoals bij de sprekersfoto's in de huisstijl.
 */
export function kaderPath(w, h) {
  const n = Math.round(Math.min(w, h) * 0.13)
  const r = Math.round(n * 0.45)
  return [
    `M${n + r},0`,
    `H${w - r}`,
    `A${r},${r} 0 0 1 ${w},${r}`,
    `V${h - n - r}`,
    `A${r},${r} 0 0 1 ${w - r},${h - n}`,
    `H${w - n + r}`,
    `A${r},${r} 0 0 0 ${w - n},${h - n + r}`,
    `V${h - r}`,
    `A${r},${r} 0 0 1 ${w - n - r},${h}`,
    `H${r}`,
    `A${r},${r} 0 0 1 0,${h - r}`,
    `V${n + r}`,
    `A${r},${r} 0 0 1 ${r},${n}`,
    `H${n - r}`,
    `A${r},${r} 0 0 0 ${n},${n - r}`,
    `V${r}`,
    `A${r},${r} 0 0 1 ${n + r},0`,
    'Z',
  ].join(' ')
}

/** Achtergrond van het hele canvas. `assets` = map met de verloop-afbeeldingen. */
export function backgroundStyle(ontwerp, orient, assets) {
  const type = ontwerp?.achtergrond || 'verloop1'
  const cover = {backgroundSize: 'cover', backgroundPosition: 'center'}
  if (type === 'kleur') return {backgroundColor: ontwerp.achtergrondKleur || '#0d2023'}
  if (type === 'afbeelding') {
    const url = imageUrl(ontwerp.achtergrondAfbeelding, {w: 1920})
    return url ? {backgroundColor: '#000', backgroundImage: `url("${url}")`, ...cover} : {backgroundColor: '#0d2023'}
  }
  const nr = /^verloop([123])$/.exec(type)?.[1] || '1'
  return {backgroundImage: `url("${assets}/bg-${nr}-${orient}.jpg")`, ...cover}
}

/**
 * Beschrijft één element als {box, inner}: `box` is de positionering op het canvas,
 * `inner` wat erin staat ({tag, style, text?, src?}). Stijlen zijn gewone
 * camelCase-objecten, bruikbaar voor zowel `element.style` als React.
 */
export function describeElement(el, {assets, tokens} = {}) {
  const box = {
    position: 'absolute',
    left: `${el.x || 0}px`,
    top: `${el.y || 0}px`,
    width: `${el.w || 0}px`,
    height: `${el.h || 0}px`,
    transform: el.rotatie ? `rotate(${el.rotatie}deg)` : '',
  }
  const fill = {width: '100%', height: '100%', display: 'block'}

  if (el.soort === 'tekst') {
    const font = FONTS[el.font] || FONTS.thunder
    return {
      box,
      inner: {
        tag: 'div',
        text: tokens ? fillTokens(el.tekst, tokens) : el.tekst || '',
        style: {
          ...fill,
          fontFamily: font.family,
          fontSize: `${el.grootte || 120}px`,
          fontWeight: String(el.gewicht || font.weights[font.weights.length - 2]),
          lineHeight: String(font.lineHeight),
          letterSpacing: el.font === 'barlow' ? '0' : '0.5px',
          color: el.kleur || '#ffffff',
          textAlign: el.uitlijning || 'left',
          textTransform: el.hoofdletters ? 'uppercase' : 'none',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
        },
      },
    }
  }

  if (el.soort === 'vorm') {
    return {
      box,
      inner: {
        tag: 'div',
        style: {
          ...fill,
          background: el.kleur || '#ffffff',
          opacity: String((el.dekking ?? 100) / 100),
          borderRadius: el.vorm === 'cirkel' ? '50%' : el.vorm === 'pill' ? '9999px' : `${el.radius || 0}px`,
          clipPath: el.vorm === 'kader' ? `path("${kaderPath(el.w, el.h)}")` : '',
        },
      },
    }
  }

  if (el.soort === 'afbeelding') {
    return {
      box,
      inner: {
        tag: 'img',
        src: imageUrl(el.afbeelding, {w: Math.min(2400, (el.w || 800) * 1.5)}),
        style: {
          ...fill,
          objectFit: el.passing === 'contain' ? 'contain' : 'cover',
          borderRadius: el.kader ? '' : `${el.radius || 0}px`,
          clipPath: el.kader ? `path("${kaderPath(el.w, el.h)}")` : '',
        },
      },
    }
  }

  if (el.soort === 'logoAnimatie') {
    // Een lege container; de player en de editor starten er de Lottie in (logo.js).
    return {
      box,
      inner: {tag: 'lottie', style: {...fill, color: el.kleur === 'donker' ? '#000000' : '#ffffff'}},
    }
  }

  // logo
  return {
    box,
    inner: {
      tag: 'img',
      src: `${assets}/turf-logo.svg`,
      style: {...fill, objectFit: 'contain', filter: el.kleur === 'donker' ? 'brightness(0)' : ''},
    },
  }
}

let keyCounter = 0
export const newKey = () => `${Date.now().toString(36)}${(keyCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Een nieuw element met zinnige beginwaarden, gecentreerd op het canvas. */
export function newElement(soort, orient, extra = {}) {
  const {w: W, h: H} = CANVAS[orient]
  const base = {_key: newKey(), _type: 'ontwerpElement', soort}
  const center = (w, h) => ({x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h})
  if (soort === 'tekst') {
    const w = Math.round(W * 0.8)
    return {...base, ...center(w, 220), tekst: 'Jouw tekst', font: 'thunder', grootte: 200, gewicht: 800, kleur: '#ffffff', uitlijning: 'left', hoofdletters: true, ...extra}
  }
  if (soort === 'vorm') return {...base, ...center(600, 400), vorm: 'rechthoek', kleur: '#0d2023', dekking: 85, radius: 36, ...extra}
  if (soort === 'afbeelding') return {...base, ...center(700, 800), passing: 'cover', kader: true, radius: 0, ...extra}
  if (soort === 'logoAnimatie') {
    const w = Math.round(W * 0.6)
    return {...base, ...center(w, Math.round(w * LOGO_ANIM.ratio)), kleur: 'wit', ...extra}
  }
  return {...base, ...center(Math.round(W * 0.4), Math.round(W * 0.4 * 0.151)), kleur: 'wit', ...extra}
}

/** Zet een ontwerp om naar de andere oriëntatie: alles verkleind en gecentreerd, als startpunt. */
export function convertLayout(ontwerp, from, to) {
  const a = CANVAS[from]
  const b = CANVAS[to]
  const s = Math.min(b.w / a.w, b.h / a.h)
  const ox = (b.w - a.w * s) / 2
  const oy = (b.h - a.h * s) / 2
  const r = n => Math.round(n)
  return {
    ...ontwerp,
    elementen: (ontwerp?.elementen || []).map(el => ({
      ...el,
      _key: newKey(),
      x: r(el.x * s + ox),
      y: r(el.y * s + oy),
      w: r(el.w * s),
      h: r(el.h * s),
      ...(el.grootte ? {grootte: r(el.grootte * s)} : {}),
      ...(el.radius ? {radius: r(el.radius * s)} : {}),
    })),
  }
}

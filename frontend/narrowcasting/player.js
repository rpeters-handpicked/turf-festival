/**
 * TURF narrowcasting — player
 * Laadt de scherm-configuratie + het programma uit Sanity en speelt de playlist af.
 * Geen build-stap: gewone ES-modules, gehost als statische bestanden.
 */
import {TEMPLATES, fallbackSlide} from './templates.js'
import {FESTIVAL, pad, toMinutes, currentDag, displayDag, isScheduled} from './schedule.js'

const CONFIG = {
  projectId: 'x545nfex',
  dataset: 'production',
  apiVersion: 'v2024-01-01',
  defaultDuration: 12,
  pollMs: 5 * 60 * 1000,
  fadeMs: 700,
}

const params = new URLSearchParams(location.search)
const SCREEN_ID = params.get('id')
const DEMO = params.has('demo')
const DEBUG = params.has('debug')

// ── Klok (met optionele simulatie) ─────────────────────────────────────────
const simStart = params.get('now') ? new Date(params.get('now')).getTime() : null
const bootedAt = Date.now()
export const now = () =>
  simStart && !Number.isNaN(simStart) ? new Date(simStart + (Date.now() - bootedAt)) : new Date()

// ── Sanity ─────────────────────────────────────────────────────────────────
function sanityUrl(host, path) {
  return `https://${CONFIG.projectId}.${host}.sanity.io/${CONFIG.apiVersion}/data/${path}/${CONFIG.dataset}`
}

async function query(groq, vars = {}, {cdn = true} = {}) {
  const qs = new URLSearchParams({query: groq})
  for (const [k, v] of Object.entries(vars)) qs.set(`$${k}`, JSON.stringify(v))
  const res = await fetch(`${sanityUrl(cdn ? 'apicdn' : 'api', 'query')}?${qs}`)
  if (!res.ok) throw new Error(`Sanity ${res.status}`)
  return (await res.json()).result
}

const SCREEN_QUERY = `*[_type == "scherm" && slug.current == $id][0]{
  _id, naam, soort, orientatie, rotatie,
  "locaties": locaties[]->{_id, naam},
  "playlist": playlist->{
    naam,
    "items": items[]{
      _key, duur, dagen, van, tot,
      "slide": slide->{
        _id, naam, type, duur, achtergrond, titel,
        "video": video.asset->url,
        "videoPortrait": videoPortrait.asset->url,
        "afbeelding": afbeelding.asset->url,
        "afbeeldingPortrait": afbeeldingPortrait.asset->url
      }
    }
  }
}`

const EVENTS_QUERY = `*[_type == "event" && gepubliceerd == true]{
  _id, dag, startTijd, eindTijd, type, zaal,
  "titel": coalesce(titel.nl, titel),
  "ondertitel": coalesce(ondertitel.nl, ondertitel),
  "thema": thema->{naam, slug, kleur},
  "locatie": locatie->{_id, naam},
  "sprekers": sprekers[]->{naam, organisatie, "rol": coalesce(rol.nl, rol), "foto": foto.asset->url},
  "afbeelding": afbeelding.asset->url
}`

const LOCATIES_QUERY = `*[_type == "locatie"]{_id, naam}`

const text = v => (typeof v === 'string' ? v.trim() : '')

/** Zet een event om naar iets waar templates mee kunnen rekenen. */
function normalizeEvent(e) {
  const date = FESTIVAL.dates[e.dag]
  const startMin = e.startTijd ? toMinutes(e.startTijd) : null
  if (!date || startMin == null) return null
  const base = new Date(`${date}T00:00:00`).getTime()
  let endMin = e.eindTijd ? toMinutes(e.eindTijd) : null
  const openEnd = endMin == null
  if (openEnd) endMin = startMin + 120
  if (endMin <= startMin) endMin += 24 * 60
  return {
    id: e._id,
    dag: e.dag,
    startTijd: e.startTijd,
    eindTijd: openEnd ? null : e.eindTijd,
    start: new Date(base + startMin * 60000),
    end: new Date(base + endMin * 60000),
    titel: text(e.titel) || 'Zonder titel',
    ondertitel: text(e.ondertitel),
    type: e.type || '',
    zaal: text(e.zaal),
    thema: e.thema || null,
    locatie: e.locatie || null,
    sprekers: (e.sprekers || []).filter(Boolean).map(s => ({...s, rol: text(s.rol)})),
    afbeelding: e.afbeelding || null,
  }
}

// ── State ──────────────────────────────────────────────────────────────────
const state = {screen: null, events: [], loadedAt: null, online: true, error: null}
const CACHE_KEY = `turf-nc:${DEMO ? 'demo' : SCREEN_ID}`

async function loadDemoScreen() {
  const demo = await (await fetch('narrowcasting/demo.json')).json()
  const orient = params.get('orient')
  if (orient === 'portrait' || orient === 'landscape') demo.orientatie = orient
  if (params.has('rot')) demo.rotatie = Number(params.get('rot')) || 0
  const loc = (params.get('loc') || '').toLowerCase()
  const locaties = await query(LOCATIES_QUERY)
  const match = loc
    ? locaties.filter(l => l.naam.toLowerCase().includes(loc))
    : locaties.filter(l => l.naam === demo.locatieNaam)
  demo.locaties = match.length ? match : locaties.slice(0, 1)
  return demo
}

async function loadData({fresh = false} = {}) {
  try {
    const [screen, events] = await Promise.all([
      DEMO ? loadDemoScreen() : query(SCREEN_QUERY, {id: SCREEN_ID}, {cdn: !fresh}),
      query(EVENTS_QUERY, {}, {cdn: !fresh}),
    ])
    if (!screen) throw new Error(`Scherm "${SCREEN_ID}" bestaat niet (of is niet gepubliceerd)`)
    applyData(screen, events)
    state.online = true
    state.error = null
    state.loadedAt = new Date()
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({screen, events}))
    } catch {}
  } catch (err) {
    state.online = false
    state.error = err.message
    if (!state.screen) {
      // Eerste keer laden mislukt: val terug op de laatst bekende content.
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
        if (cached) applyData(cached.screen, cached.events)
      } catch {}
    }
    console.warn('[narrowcasting] laden mislukt:', err)
  }
}

function applyData(screen, events) {
  state.screen = screen
  state.events = (events || []).map(normalizeEvent).filter(Boolean).sort((a, b) => a.start - b.start)
  layoutStage()
}

/** Luistert naar wijzigingen in Sanity en ververst direct. */
function listen() {
  const groq = '*[_type in ["scherm","playlist","slide","event","spreker","locatie","thema"]]'
  const qs = new URLSearchParams({query: groq, includeResult: 'false', visibility: 'query'})
  let timer = null
  try {
    const es = new EventSource(`${sanityUrl('api', 'listen')}?${qs}`)
    es.addEventListener('mutation', () => {
      clearTimeout(timer)
      timer = setTimeout(() => loadData({fresh: true}), 1500)
    })
  } catch (err) {
    console.warn('[narrowcasting] live-verbinding niet beschikbaar:', err)
  }
}

// ── Stage: vast canvas, geschaald naar het scherm ──────────────────────────
const viewport = document.getElementById('viewport')
const stage = document.getElementById('stage')

function layoutStage() {
  const orient = state.screen?.orientatie === 'portrait' ? 'portrait' : 'landscape'
  const rot = Number(state.screen?.rotatie) || 0
  const w = orient === 'portrait' ? 1080 : 1920
  const h = orient === 'portrait' ? 1920 : 1080
  const rotated = rot === 90 || rot === 270
  const scale = Math.min(innerWidth / (rotated ? h : w), innerHeight / (rotated ? w : h))
  stage.style.width = `${w}px`
  stage.style.height = `${h}px`
  stage.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`
  stage.className = orient
}
addEventListener('resize', layoutStage)

// ── Afspelen ───────────────────────────────────────────────────────────────
let pointer = -1
let current = null
let timer = null

function buildContext() {
  const t = now()
  const orient = state.screen?.orientatie === 'portrait' ? 'portrait' : 'landscape'
  return {
    now: t,
    orient,
    dag: displayDag(t),
    isFestivalDag: !!currentDag(t),
    dagDate: FESTIVAL.dates[displayDag(t)],
    events: state.events,
    locaties: state.screen?.locaties?.filter(Boolean) || [],
    soort: state.screen?.soort || 'klein',
  }
}

/** Zoekt vanaf de huidige positie de eerstvolgende slide die nu iets te tonen heeft. */
function pickNext() {
  const items = (state.screen?.playlist?.items || []).filter(i => i?.slide)
  const t = now()
  for (let step = 1; step <= items.length; step++) {
    const i = (Math.max(pointer, -1) + step) % items.length
    const item = items[i]
    if (!isScheduled(item, t)) continue
    const tpl = TEMPLATES[item.slide.type]
    if (!tpl) continue
    let rendered = null
    try {
      rendered = tpl(item.slide, buildContext())
    } catch (err) {
      console.error(`[narrowcasting] slide "${item.slide.naam}" faalde:`, err)
    }
    if (rendered) {
      pointer = i
      return {item, rendered}
    }
  }
  return null
}

function advance() {
  clearTimeout(timer)
  const picked = pickNext()
  const ctx = buildContext()
  const rendered = picked?.rendered || fallbackSlide(ctx, state)
  const duration = Math.max(
    3,
    rendered.duration || picked?.item.duur || picked?.item.slide.duur || CONFIG.defaultDuration,
  )

  const el = rendered.el
  el.classList.add('slide')
  stage.appendChild(el)
  // Forceer een reflow zodat de fade-in altijd afspeelt.
  void el.offsetWidth
  el.classList.add('is-visible')

  const previous = current
  current = {el, rendered, name: picked?.item.slide.naam || '(fallback)', until: Date.now() + duration * 1000}
  if (previous) {
    previous.el.classList.remove('is-visible')
    setTimeout(() => {
      previous.rendered.destroy?.()
      previous.el.remove()
    }, CONFIG.fadeMs + 50)
  }

  let done = false
  const next = () => {
    if (done) return
    done = true
    advance()
  }
  // Templates (video) mogen zelf bepalen wanneer ze klaar zijn; de timer blijft het vangnet.
  rendered.start?.(next)
  timer = setTimeout(next, (rendered.maxDuration || duration) * 1000)
}

// ── Debugbalk ──────────────────────────────────────────────────────────────
function renderDebug() {
  const el = document.getElementById('debug')
  if (!DEBUG) return
  el.hidden = false
  const t = now()
  const left = current ? Math.max(0, Math.round((current.until - Date.now()) / 1000)) : 0
  el.textContent = [
    state.screen?.naam || '—',
    `${pad(t.getDate())}-${pad(t.getMonth() + 1)} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}${simStart ? ' (sim)' : ''}`,
    `dag: ${currentDag(t) || 'geen'}`,
    `slide: ${current?.name || '—'} (${left}s)`,
    `events: ${state.events.length}`,
    state.online ? 'online' : `OFFLINE: ${state.error}`,
  ].join('  ·  ')
}

// ── Start ──────────────────────────────────────────────────────────────────
async function boot() {
  layoutStage()
  if (!SCREEN_ID && !DEMO) {
    stage.appendChild(
      Object.assign(document.createElement('div'), {
        className: 'slide is-visible boot-message',
        textContent: 'Geen scherm gekozen. Gebruik /screen.html?id=<scherm-id> of ?demo=1',
      }),
    )
    return
  }
  await loadData()
  advance()
  if (!DEMO) listen()
  setInterval(() => loadData(), CONFIG.pollMs)
  setInterval(renderDebug, 1000)
}

boot()

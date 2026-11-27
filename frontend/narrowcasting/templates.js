/**
 * TURF narrowcasting — slide-templates
 *
 * Elke template is een functie (slide, ctx) => {el, duration?, maxDuration?, start?, destroy?} | null
 * `null` betekent: nu niets te tonen, de player slaat de slide over.
 */

import {CANVAS, backgroundStyle, describeElement} from './ontwerp.js'
import {WALKING_MAP} from './walking-map-data.js'

const ASSETS = 'narrowcasting/assets'
// Absoluut: een url() in een CSS-variabele wordt anders t.o.v. player.css opgezocht.
const BG = (nr, orient) => `url('${new URL(`${ASSETS}/bg-${nr}-${orient}.jpg`, document.baseURI).href}')`
const DAG_LABELS = {dag1: 'Donderdag 26 november', dag2: 'Vrijdag 27 november', dag3: 'Zaterdag 28 november'}

// ── Helpers ────────────────────────────────────────────────────────────────
const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c])

const pad = n => String(n).padStart(2, '0')
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const img = (url, w, h) => (url ? `${url}?w=${w}&h=${h}&fit=crop&auto=format&q=80` : '')
const chunk = (arr, n) => Array.from({length: Math.ceil(arr.length / n)}, (_, i) => arr.slice(i * n, i * n + n))
const safeColor = c => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#ffffff')

function html(markup) {
  const t = document.createElement('template')
  t.innerHTML = markup.trim()
  return t.content.firstElementChild
}

/** Vaste opbouw van een programmaslide: verloop-achtergrond, logo, klok. */
function frame(slide, ctx, {kicker, title, body, footer = ''}) {
  const bg = [1, 2, 3].includes(slide.achtergrond) ? slide.achtergrond : 1
  return html(`
    <section class="tpl" style="--bg:${BG(bg, ctx.orient)}">
      <header class="tpl-head">
        <div class="tpl-logo" data-turf-logo data-align="left"></div>
        <div class="tpl-clock">${hhmm(ctx.now)}</div>
      </header>
      <div class="tpl-title">
        ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}
        <h1 class="${title.length > 22 ? 'is-long' : ''}">${esc(title)}</h1>
      </div>
      <div class="tpl-body">${body}</div>
      ${footer}
    </section>`)
}

const isToday = (e, ctx) => e.dag === ctx.dag
const isLive = (e, ctx) => ctx.now >= e.start && ctx.now < e.end
const isUpcoming = (e, ctx) => e.start > ctx.now
const atScreen = (e, ctx) => ctx.locaties.some(l => l._id === e.locatie?._id)

const sprekerNames = e => e.sprekers.map(s => s.naam).filter(Boolean).join(', ')
const locLabel = e => [e.locatie?.naam?.trim(), e.zaal].filter(Boolean).join(' · ')
const screenLocName = ctx => ctx.locaties.map(l => l.naam.trim()).join(' + ')

function countdown(e, ctx) {
  const min = Math.round((e.start - ctx.now) / 60000)
  if (min <= 0 || min > 90) return ''
  return min === 1 ? 'over 1 minuut' : `over ${min} minuten`
}

function themaDot(e) {
  return `<span class="dot" style="background:${safeColor(e.thema?.kleur)}"></span>`
}

// ── What's next — deze locatie ─────────────────────────────────────────────
function whatsNextLocatie(slide, ctx) {
  if (!ctx.locaties.length) return null
  if (ctx.locaties.length > 1) return whatsNextZalen(slide, ctx)
  const here = ctx.events.filter(e => isToday(e, ctx) && atScreen(e, ctx))
  const live = here.find(e => isLive(e, ctx))
  const next = here.find(e => isUpcoming(e, ctx))
  const main = next || live
  if (!main) return null

  const isNext = main === next
  const foto = main.sprekers.find(s => s.foto)?.foto || main.afbeelding
  const [pw, ph] = ctx.orient === 'portrait' ? [960, 760] : [640, 760]
  const soon = isNext ? countdown(main, ctx) : ''
  const multiLoc = ctx.locaties.length > 1

  const body = `
    <div class="next ${foto ? '' : 'no-photo'}">
      <div class="next-text">
        <div class="next-time">
          ${esc(main.startTijd)}${main.eindTijd ? `<span class="next-end">– ${esc(main.eindTijd)}</span>` : ''}
          ${soon ? `<span class="pill">${esc(soon)}</span>` : ''}
          ${!isNext ? '<span class="pill pill-live"><i></i>Nu live</span>' : ''}
        </div>
        <h2 class="next-title ${main.titel.length > 48 ? 'is-long' : ''}">${esc(main.titel)}</h2>
        ${sprekerNames(main) ? `<p class="next-speakers">${esc(sprekerNames(main))}</p>` : ''}
        <p class="next-meta">${themaDot(main)}${esc(
          [main.type, multiLoc ? locLabel(main) : main.zaal].filter(Boolean).join(' · '),
        )}</p>
      </div>
      ${foto ? `<div class="next-photo"><img src="${img(foto, pw, ph)}" alt=""></div>` : ''}
    </div>`

  const footer =
    isNext && live
      ? `<footer class="tpl-foot"><span class="pill pill-live"><i></i>Nu live</span>
           <strong>${esc(live.titel)}</strong>
           ${live.eindTijd ? `<span>tot ${esc(live.eindTijd)}</span>` : ''}</footer>`
      : ''

  return {
    el: frame(slide, ctx, {
      kicker: screenLocName(ctx),
      title: slide.titel || (isNext ? 'Straks op deze locatie' : 'Nu op deze locatie'),
      body,
      footer,
    }),
  }
}

/**
 * What's next voor een scherm met meerdere locaties (bijv. De Avenue Main Stage + Up Stage):
 * één kolom (staand: één rij) per zaal, met daarin het eerstvolgende of lopende event.
 */
function whatsNextZalen(slide, ctx) {
  const portrait = ctx.orient === 'portrait'
  const namen = ctx.locaties.map(l => l.naam.trim())
  // Gemeenschappelijk begin ("De Avenue") wordt de bovenregel, de rest ("Main Stage") het zaallabel.
  const woorden = namen.map(n => n.split(/\s+/))
  let k = 0
  while (woorden.every(w => k < w.length - 1 && w[k] === woorden[0][k])) k++
  const gedeeld = woorden[0].slice(0, k).join(' ')

  const zalen = ctx.locaties.map((loc, i) => {
    const hier = ctx.events.filter(e => isToday(e, ctx) && e.locatie?._id === loc._id)
    const live = hier.find(e => isLive(e, ctx))
    const next = hier.find(e => isUpcoming(e, ctx))
    const label = (k ? woorden[i].slice(k).join(' ') : namen[i]).replace(/^\((.*)\)$/, '$1')
    return {label, live, next, main: next || live}
  })
  if (!zalen.some(z => z.main)) return null

  const [pw, ph] = portrait ? [420, 420] : [800, 420]
  const kolom = (z, i) => {
    const {main, live, next} = z
    if (!main) {
      return `<article class="zaal is-leeg" style="--i:${i}">
        <div class="zaal-tekst"><div class="zaal-naam">${esc(z.label)}</div>
        <p class="zaal-leeg">Vandaag geen sessies meer</p></div></article>`
    }
    const isNext = main === next
    const foto = main.sprekers.find(s => s.foto)?.foto || main.afbeelding
    const soon = isNext ? countdown(main, ctx) : ''
    return `<article class="zaal ${foto ? '' : 'no-photo'}" style="--i:${i}">
      ${foto ? `<div class="zaal-foto"><img src="${img(foto, pw, ph)}" alt=""></div>` : ''}
      <div class="zaal-tekst">
        <div class="zaal-naam">${esc(z.label)}</div>
        <div class="zaal-tijd">
          ${esc(main.startTijd)}${main.eindTijd ? `<span class="next-end">– ${esc(main.eindTijd)}</span>` : ''}
          ${soon ? `<span class="pill">${esc(soon)}</span>` : ''}
          ${!isNext ? '<span class="pill pill-live"><i></i>Nu live</span>' : ''}
        </div>
        <h2 class="zaal-titel ${main.titel.length > 48 ? 'is-long' : ''}">${esc(main.titel)}</h2>
        ${sprekerNames(main) ? `<p class="zaal-sprekers">${esc(sprekerNames(main))}</p>` : ''}
        ${isNext && live ? `<p class="zaal-nu"><span class="pill pill-live"><i></i>Nu</span>${esc(live.titel)}</p>` : ''}
      </div>
    </article>`
  }

  return {
    el: frame(slide, ctx, {
      kicker: gedeeld || namen.join(' + '),
      title: slide.titel || "What's next",
      body: `<div class="zalen zalen-${zalen.length}">${zalen.map(kolom).join('')}</div>`,
    }),
  }
}

/** Sprekerskaarten + tekstpaneel; gedeeld door spreker-intro en closing keynote. */
function introBody(event, ctx, started, {wordly = false} = {}) {
  wordly = wordly && !!event.wordlyQr
  const portrait = ctx.orient === 'portrait'
  const metFoto = event.sprekers.filter(s => s.foto).slice(0, portrait ? 2 : 3)
  const cards = metFoto.length
    ? metFoto
    : event.afbeelding
      ? [{foto: event.afbeelding, naam: '', rol: ''}]
      : []
  const [pw, ph] = portrait ? [Math.round(936 / cards.length) || 936, 820] : [Math.round(900 / (cards.length || 1)), 700]
  const zonderFoto = event.sprekers.filter(s => !metFoto.includes(s)).map(s => s.naam)

  const body = `
    <div class="intro ${cards.length ? '' : 'no-photo'} ${wordly ? 'has-wordly' : ''}">
      ${
        cards.length
          ? `<div class="intro-cards">${cards
              .map(
                (s, n) => `
              <figure class="intro-card" style="--i:${n}">
                <img src="${img(s.foto, pw, ph)}" alt="">
                ${
                  s.naam
                    ? `<figcaption><strong>${esc(s.naam)}</strong>${
                        s.rol || s.organisatie ? `<span>${esc([s.rol, s.organisatie].filter(Boolean).join(' · '))}</span>` : ''
                      }</figcaption>`
                    : ''
                }
              </figure>`,
              )
              .join('')}</div>`
          : ''
      }
      <div class="intro-text">
        <div class="next-time">
          ${esc(event.startTijd)}${event.eindTijd ? `<span class="next-end">– ${esc(event.eindTijd)}</span>` : ''}
          ${started ? '<span class="pill pill-live"><i></i>Nu live</span>' : `<span class="pill">${esc(countdown(event, ctx) || 'zo meteen')}</span>`}
        </div>
        <h2 class="next-title ${event.titel.length > 48 ? 'is-long' : ''}">${esc(event.titel)}</h2>
        ${zonderFoto.length ? `<p class="next-speakers">${esc((metFoto.length ? 'Met ' : '') + zonderFoto.join(', '))}</p>` : ''}
        <p class="next-meta">${themaDot(event)}${esc([event.type, locLabel(event)].filter(Boolean).join(' · '))}</p>
        ${
          wordly
            ? `<div class="wordly">
            <img class="wordly-qr" src="${esc(event.wordlyQr)}?w=400" alt="">
            <div class="wordly-tekst">
              <strong>Live translation</strong>
              <span>Scan the code to follow this session in your own language with Wordly</span>
            </div>
          </div>`
            : ''
        }
      </div>
    </div>`

  return body
}

// ── Introductie spreker/event — deze locatie ───────────────────────────────
function sprekerIntro(slide, ctx) {
  if (!ctx.locaties.length) return null
  const vooraf = (Number(slide.minutenVooraf) || 15) * 60000
  const naloop = 5 * 60000
  const event = ctx.events.find(
    e => atScreen(e, ctx) && ctx.now >= e.start.getTime() - vooraf && ctx.now < e.start.getTime() + naloop,
  )
  if (!event) return null

  const started = ctx.now >= event.start
  // Wordly-QR (live vertaling) alleen hier, op de locatie zelf; niet bij de closing keynote op andere locaties.
  const body = introBody(event, ctx, started, {wordly: true})

  return {
    el: frame(slide, ctx, {
      kicker: screenLocName(ctx),
      title: slide.titel || (started ? 'Nu' : 'Zo meteen'),
      body,
    }),
    eigenQr: !!event.wordlyQr,
  }
}

// ── Closing keynote ────────────────────────────────────────────────────────
// Eén gekozen event, op alle schermen: vanaf `minutenVooraf` voor de start tot het einde.
function closingKeynote(slide, ctx) {
  const event = ctx.alleEvents.find(e => e.id === slide.event)
  // Op de locatie van de keynote zelf niet: daar kondigt What's next/Introductie spreker hem al aan.
  if (!event || atScreen(event, ctx)) return null
  const vooraf = (Number(slide.minutenVooraf) || 30) * 60000
  if (ctx.now < event.start.getTime() - vooraf || ctx.now >= event.end) return null
  const started = ctx.now >= event.start
  const plek = event.locatie?.naam?.trim() || ''
  return {
    el: frame(slide, ctx, {
      kicker: [started ? 'Nu live' : 'Straks', plek].filter(Boolean).join(' · '),
      title: slide.titel || 'Closing keynote',
      body: introBody(event, ctx, started),
    }),
  }
}

// ── Avondprogramma ─────────────────────────────────────────────────────────
// Een gekozen set events (bijv. het gratis avondprogramma), als kaarten met beeld.
function avondprogramma(slide, ctx) {
  const portrait = ctx.orient === 'portrait'
  const events = (slide.events || [])
    .map(id => ctx.alleEvents.find(e => e.id === id))
    .filter(e => e && e.end > ctx.now)
    .sort((x, y) => x.start - y.start)
    .slice(0, 6)
  if (!events.length) return null
  const [iw, ih] = portrait ? [360, 360] : [300, 300]
  const cards = events
    .map((e, n) => {
      const beeld = e.afbeelding || e.sprekers.find(s => s.foto)?.foto
      const live = isLive(e, ctx)
      return `
      <article class="av-card" style="--i:${n};--thema:${safeColor(e.thema?.kleur)}">
        <div class="av-img">${beeld ? `<img src="${img(beeld, iw, ih)}" alt="">` : `<span>${esc(e.startTijd)}</span>`}</div>
        <div class="av-text">
          <div class="av-time">${esc(e.startTijd)}${e.eindTijd ? ` – ${esc(e.eindTijd)}` : ''}${
            live ? ' <span class="pill pill-live"><i></i>Nu live</span>' : ''
          }</div>
          <h2 class="av-title">${esc(e.titel)}</h2>
          ${e.ondertitel ? `<p class="av-sub">${esc(e.ondertitel)}</p>` : ''}
          <p class="av-meta">${themaDot(e)}${esc([locLabel(e), e.type].filter(Boolean).join(' · '))}</p>
        </div>
      </article>`
    })
    .join('')
  return {
    el: frame(slide, ctx, {
      kicker: slide.kicker || 'Tech Thursday · gratis toegankelijk',
      title: slide.titel || 'Avondprogramma',
      body: `<div class="av-grid av-n${events.length}">${cards}</div>`,
    }),
  }
}

// ── Programmaregels (gedeeld) ──────────────────────────────────────────────
function row(e, ctx, {showLoc}, i = 0) {
  const status = isLive(e, ctx) ? 'is-live' : e.end <= ctx.now ? 'is-past' : ''
  // Staand is er geen ruimte voor een locatiekolom: de locatie schuift naar de tweede regel.
  const locInSub = showLoc && ctx.orient === 'portrait'
  const sub = [locInSub ? locLabel(e) : '', sprekerNames(e), showLoc ? '' : e.zaal].filter(Boolean).join(' · ')
  return `
    <li class="row ${status}" style="--i:${i}">
      <div class="row-time">${esc(e.startTijd)}${status === 'is-live' && showLoc ? '<i class="live-dot"></i>' : ''}</div>
      <div class="row-main">
        <div class="row-title">${themaDot(e)}<span>${esc(e.titel)}</span></div>
        ${sub ? `<div class="row-sub">${esc(sub)}</div>` : ''}
      </div>
      ${
        locInSub
          ? ''
          : showLoc
            ? `<div class="row-tag row-loc">${esc(locLabel(e))}</div>`
          : status === 'is-live'
            ? '<div class="row-tag pill pill-live"><i></i>Live</div>'
            : ''
      }
    </li>`
}

/** Lijst die zichzelf in pagina's verdeelt en die binnen de duur van de slide doorloopt. */
function pagedList(events, ctx, {perPage, columns = 1, showLoc, maxPages = 4, secondsPerPage = 9}) {
  const pages = chunk(events, perPage).slice(0, maxPages)
  const markup = pages
    .map(
      (page, i) => `
      <ul class="rows cols-${columns} ${i === 0 ? 'is-active' : ''}" style="--per-col:${Math.ceil(perPage / columns)}">
        ${page.map((e, n) => row(e, ctx, {showLoc}, n)).join('')}
      </ul>`,
    )
    .join('')
  const pager =
    pages.length > 1
      ? `<div class="pager">${pages.map((_, i) => `<i class="${i === 0 ? 'is-active' : ''}"></i>`).join('')}</div>`
      : ''
  let interval = null
  return {
    markup: `<div class="pages">${markup}</div>${pager}`,
    duration: pages.length > 1 ? pages.length * secondsPerPage : null,
    start(el) {
      if (pages.length < 2) return
      let i = 0
      const lists = el.querySelectorAll('.rows')
      const dots = el.querySelectorAll('.pager i')
      interval = setInterval(() => {
        i = Math.min(i + 1, pages.length - 1)
        lists.forEach((l, n) => l.classList.toggle('is-active', n === i))
        dots.forEach((d, n) => d.classList.toggle('is-active', n === i))
      }, secondsPerPage * 1000)
    },
    destroy: () => clearInterval(interval),
  }
}

function listSlide(slide, ctx, {events, kicker, title, list}) {
  if (!events.length) return null
  const paged = pagedList(events, ctx, list)
  const el = frame(slide, ctx, {kicker, title: slide.titel || title, body: paged.markup})
  return {
    el,
    duration: paged.duration,
    start: () => paged.start(el),
    destroy: paged.destroy,
  }
}

const dagKicker = ctx => DAG_LABELS[ctx.dag] || ''

// ── What's next — heel TURF ────────────────────────────────────────────────
function whatsNextOverall(slide, ctx) {
  const portrait = ctx.orient === 'portrait'
  const events = ctx.events.filter(e => isToday(e, ctx) && isUpcoming(e, ctx)).slice(0, portrait ? 9 : 5)
  return listSlide(slide, ctx, {
    events,
    kicker: dagKicker(ctx),
    title: 'Straks op TURF',
    list: {perPage: portrait ? 9 : 5, showLoc: true},
  })
}

// ── Programma — deze locatie ───────────────────────────────────────────────
function programmaLocatie(slide, ctx) {
  if (!ctx.locaties.length) return null
  const portrait = ctx.orient === 'portrait'
  const events = ctx.events.filter(e => isToday(e, ctx) && atScreen(e, ctx))
  // Alles al afgelopen? Dan heeft het programma van deze locatie geen zin meer.
  if (!events.some(e => e.end > ctx.now)) return null
  return listSlide(slide, ctx, {
    events,
    kicker: `${dagKicker(ctx)} · ${screenLocName(ctx)}`,
    title: 'Programma',
    list: {perPage: portrait ? 9 : 5, showLoc: ctx.locaties.length > 1},
  })
}

// ── Programma — hele dag ───────────────────────────────────────────────────
function programmaDag(slide, ctx) {
  const portrait = ctx.orient === 'portrait'
  // Afgelopen events laten we weg: op een scherm telt wat je nog kunt bezoeken.
  const events = ctx.events.filter(e => isToday(e, ctx) && e.end > ctx.now)
  return listSlide(slide, ctx, {
    events,
    kicker: dagKicker(ctx),
    title: ctx.isFestivalDag ? 'Vandaag op TURF' : 'Programma',
    list: {perPage: portrait ? 9 : 10, columns: portrait ? 1 : 2, showLoc: true},
  })
}

// ── Sponsoren ──────────────────────────────────────────────────────────────
// Logo's komen uit Sanity (type 'sponsor'), eenmalig geïmporteerd uit Webflow.
// Per prio een eigen formaat: prio 1 groot, prio 3 klein. Elke prio begint op een nieuwe pagina.
const SPONSOR_LAYOUT = {
  landscape: {1: {cols: 4, max: 8}, 2: {cols: 6, max: 12}, 3: {cols: 6, max: 18}},
  portrait: {1: {cols: 2, max: 8}, 2: {cols: 3, max: 12}, 3: {cols: 3, max: 18}},
}

function sponsoren(slide, ctx) {
  const lijst = (ctx.sponsors || []).filter(s => s?.logo)
  if (!lijst.length) return null
  const layout = SPONSOR_LAYOUT[ctx.orient]
  const pages = []
  for (const prio of [1, 2, 3]) {
    const groep = lijst.filter(s => Math.min(3, Math.max(1, s.prio || 3)) === prio)
    const {cols, max} = layout[prio]
    // Evenwichtig verdelen: liever 2 × 7 dan 12 + 2.
    const perPage = Math.ceil(groep.length / Math.ceil(groep.length / max))
    for (const items of chunk(groep, perPage)) pages.push({prio, cols, items})
  }
  const secondsPerPage = 8
  const markup = pages
    .map(
      (p, i) => `
      <div class="sp-page sp-prio-${p.prio} ${i === 0 ? 'is-active' : ''}" style="--cols:${p.cols}">
        ${p.items.map((s, n) => `<div class="sp-logo" style="--i:${n}"><img src="${esc(s.logo)}" alt="${esc(s.naam)}"></div>`).join('')}
      </div>`,
    )
    .join('')
  const pager =
    pages.length > 1
      ? `<div class="pager">${pages.map((_, i) => `<i class="${i === 0 ? 'is-active' : ''}"></i>`).join('')}</div>`
      : ''
  const el = frame(slide, ctx, {
    kicker: 'Partners & makers',
    title: slide.titel || 'Met dank aan',
    body: `<div class="pages sp-pages">${markup}</div>${pager}`,
  })
  let interval = null
  return {
    el,
    duration: pages.length > 1 ? pages.length * secondsPerPage : null,
    start() {
      if (pages.length < 2) return
      let i = 0
      const all = el.querySelectorAll('.sp-page')
      const dots = el.querySelectorAll('.pager i')
      interval = setInterval(() => {
        i = Math.min(i + 1, pages.length - 1)
        all.forEach((p, n) => p.classList.toggle('is-active', n === i))
        dots.forEach((d, n) => d.classList.toggle('is-active', n === i))
      }, secondsPerPage * 1000)
    },
    destroy: () => clearInterval(interval),
  }
}

// ── Walking map ────────────────────────────────────────────────────────────
// Stratenkaart en looproutes komen uit scripts/build-walking-map.mjs (OpenStreetMap).
const MAP_COLORS = ['#f0641e', '#f2b63f', '#d94080', '#c8f04a']
// Afmeting van het kaartpaneel in px (zie .wm-map in player.css).
const MAP_PANEL = {landscape: [960, 804], portrait: [888, 860]}

const wmKey = (lat, lng) => `${lat.toFixed(5)},${lng.toFixed(5)}`

/** Projectie naar de meters van de kaart (zelfde als scripts/build-walking-map.mjs). */
function wmXY(lat, lon) {
  const [lat0, lon0] = WALKING_MAP.midden || [lat, lon]
  return [(lon - lon0) * 111320 * Math.cos((lat0 * Math.PI) / 180), -(lat - lat0) * 110540]
}

/** Gemeenschappelijk begin van de namen: "De Avenue Main Stage" + "De Avenue Up Stage" → "De Avenue". */
function wmNaam(namen) {
  if (namen.length === 1) return namen[0]
  const woorden = namen.map(n => n.split(/\s+/))
  const prefix = []
  for (let i = 0; woorden.every(w => w[i] && w[i] === woorden[0][i]); i++) prefix.push(woorden[0][i])
  const naam = prefix.join(' ').replace(/[\s\-–(]+$/, '')
  return naam || namen[0]
}

/** De punten op de kaart: gekozen locaties (zalen op één adres samengevoegd), of de vaste venues. */
function wmPlekken(slide, ctx) {
  const M = WALKING_MAP
  const venueVan = ids => M.venues.find(v => v.locaties.some(id => ids.includes(id)))
  const fromVenue = v => ({key: wmKey(v.lat, v.lon), naam: v.naam, adres: v.adres, lat: v.lat, lon: v.lon, label: v.label, venue: v})

  const gekozen = (slide.kaartLocaties || []).filter(l => l?.geo?.lat != null)
  let plekken
  if (!gekozen.length) {
    plekken = M.venues.map(fromVenue)
  } else {
    const groepen = new Map()
    for (const l of gekozen) {
      const key = wmKey(l.geo.lat, l.geo.lng)
      if (!groepen.has(key)) groepen.set(key, [])
      groepen.get(key).push(l)
    }
    plekken = [...groepen].map(([key, locs]) => {
      const venue = venueVan(locs.map(l => l._id))
      if (venue) return {...fromVenue(venue), key}
      return {
        key,
        naam: wmNaam(locs.map(l => l.naam.trim())),
        adres: (locs[0].adres || '').trim().replace(/,?\s*\d{4}\s?[A-Z]{2}/, '').replace(/,?\s*Breda$/i, ''),
        lat: locs[0].geo.lat,
        lon: locs[0].geo.lng,
      }
    })
  }

  // Waar staat dit scherm? Die plek staat er altijd op.
  const ids = ctx.locaties.map(l => l._id)
  const hereVenue = venueVan(ids)
  const hereLoc = ctx.locaties.find(l => l.geo?.lat != null)
  const hereKey = hereVenue ? wmKey(hereVenue.lat, hereVenue.lon) : hereLoc ? wmKey(hereLoc.geo.lat, hereLoc.geo.lng) : null
  let here = hereKey ? plekken.find(p => p.key === hereKey) : null
  if (hereKey && !here) {
    here = hereVenue
      ? fromVenue(hereVenue)
      : {key: hereKey, naam: wmNaam(ctx.locaties.map(l => l.naam)), adres: '', lat: hereLoc.geo.lat, lon: hereLoc.geo.lng}
    plekken.unshift(here)
  }
  for (const p of plekken) p.xy = wmXY(p.lat, p.lon)
  return {plekken, here, hereVenue}
}

function walkingMap(slide, ctx) {
  const M = WALKING_MAP
  const [pw, ph] = MAP_PANEL[ctx.orient]
  const {plekken, here, hereVenue} = wmPlekken(slide, ctx)
  if (!plekken.length) return null

  // Looproute vanaf "hier": berekend (OpenStreetMap) of, voor nieuwe locaties, een schatting in rechte lijn.
  const route = p => {
    if (!here || p === here) return null
    const echt = hereVenue && M.routes[`${hereVenue.key}>${p.key}`]
    if (echt) return echt
    const afstand = Math.hypot(p.xy[0] - here.xy[0], p.xy[1] - here.xy[1])
    return {schatting: true, minuten: Math.max(1, Math.ceil((afstand * 1.3) / 80)), d: `M${here.xy.join(',')}L${p.xy.join(',')}`}
  }
  const minutes = p => route(p)?.minuten ?? null

  // Volgorde en nummering: eerst waar je bent, dan op looptijd.
  plekken.sort((a, b) => (a === here ? -1 : b === here ? 1 : (minutes(a) ?? 99) - (minutes(b) ?? 99)))
  plekken.forEach((p, i) => Object.assign(p, {nr: i + 1, kleur: MAP_COLORS[i % MAP_COLORS.length]}))

  // Uitsnede: alle punten met marge (minimaal ~600 m breed), passend op de verhouding van het paneel.
  const xs = plekken.map(p => p.xy[0])
  const ys = plekken.map(p => p.xy[1])
  const marge = 190
  let [x0, x1, y0, y1] = [Math.min(...xs) - marge, Math.max(...xs) + marge, Math.min(...ys) - marge, Math.max(...ys) + marge]
  const minW = 600
  if (x1 - x0 < minW) [x0, x1] = [(x0 + x1) / 2 - minW / 2, (x0 + x1) / 2 + minW / 2]
  const aspect = pw / ph
  if ((x1 - x0) / (y1 - y0) < aspect) {
    const extra = (y1 - y0) * aspect - (x1 - x0)
    x0 -= extra / 2
    x1 += extra / 2
  } else {
    const extra = (x1 - x0) / aspect - (y1 - y0)
    y0 -= extra / 2
    y1 += extra / 2
  }
  const k = pw / (x1 - x0) // px per meter
  const u = px => +(px / k).toFixed(2) // px op het scherm → meters in de kaart
  const R = M.radius

  // Markeringen die (bijna) op elkaar liggen iets uit elkaar duwen, zodat elk nummer leesbaar blijft.
  for (const p of plekken) p.pos = [...p.xy]
  const minAfstand = u(50)
  for (let ronde = 0; ronde < 30; ronde++) {
    let bewogen = false
    for (let i = 0; i < plekken.length; i++) {
      for (let j = i + 1; j < plekken.length; j++) {
        const [a, b] = [plekken[i].pos, plekken[j].pos]
        let [dx, dy] = [b[0] - a[0], b[1] - a[1]]
        let d = Math.hypot(dx, dy)
        if (d >= minAfstand) continue
        if (d < 0.01) [dx, dy, d] = [1, 0, 1]
        const duw = (minAfstand - d) / 2
        a[0] -= (dx / d) * duw
        a[1] -= (dy / d) * duw
        b[0] += (dx / d) * duw
        b[1] += (dy / d) * duw
        bewogen = true
      }
    }
    if (!bewogen) break
  }

  // Labels links of rechts van de markering, zodat ze elkaar en de kaartrand zo min mogelijk raken.
  const box = (p, right) => {
    const [cx, cy] = [(p.pos[0] - x0) * k, (p.pos[1] - y0) * k]
    const w = p.naam.length * 19 + 20
    const h = p === here ? 80 : 44
    const x = right ? cx + 28 : cx - 28 - w
    return {x, y: cy - 26, w, h}
  }
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  const blokken = plekken.map(p => {
    const [cx, cy] = [(p.pos[0] - x0) * k, (p.pos[1] - y0) * k]
    return {x: cx - 26, y: cy - 26, w: 52, h: 52}
  })
  const geplaatst = []
  for (const p of plekken) {
    const score = right => {
      const b = box(p, right)
      const buiten = Math.max(0, -b.x) + Math.max(0, b.x + b.w - pw)
      return [...blokken, ...geplaatst].reduce((s, o) => s + overlap(b, o), 0) + buiten * 200
    }
    const voorkeur = p.label ? p.label !== 'links' : true
    const [sa, sb] = [score(voorkeur), score(!voorkeur)]
    p.right = sb < sa ? !voorkeur : voorkeur
    geplaatst.push(box(p, p.right))
  }

  const routes = plekken
    .map(route)
    .filter(Boolean)
    .map(
      (r, i) => `<path class="wm-route ${r.schatting ? 'is-schatting' : ''}" style="--i:${i}" d="${r.d}"
          stroke-width="${u(7)}" stroke-dasharray="0 ${u(r.schatting ? 22 : 15)}"/>`,
    )
    .join('')

  const marker = (p, i) => {
    const [x, y] = p.pos
    const isHere = p === here
    const size = u(isHere ? 50 : 40)
    const right = p.right
    const tx = x + (right ? 1 : -1) * (size / 2 + u(14))
    return `
      <g class="wm-marker ${isHere ? 'is-here' : ''}" style="--i:${i};--c:${p.kleur}">
        ${isHere ? `<circle class="wm-pulse" cx="${x}" cy="${y}" r="${u(36)}" stroke-width="${u(3)}"/>` : ''}
        <rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="${u(10)}"/>
        <text class="wm-nr" x="${x}" y="${y + u(10)}" font-size="${u(isHere ? 34 : 28)}">${p.nr}</text>
        <text class="wm-label" x="${tx}" y="${y + u(12)}" font-size="${u(36)}" text-anchor="${right ? 'start' : 'end'}"
          stroke-width="${u(8)}">${esc(p.naam)}</text>
        ${isHere ? `<text class="wm-here" x="${tx}" y="${y + u(42)}" font-size="${u(21)}" text-anchor="${right ? 'start' : 'end'}" stroke-width="${u(6)}">U bent hier</text>` : ''}
      </g>`
  }

  const tijden = plekken.map(minutes).filter(m => m != null)
  const maxMin = tijden.length ? Math.max(...tijden) : null

  const el = html(`
    <section class="tpl walkmap" style="--bg:${BG([1, 2, 3].includes(slide.achtergrond) ? slide.achtergrond : 3, ctx.orient)}">
      <header class="tpl-head">
        <div class="tpl-logo" data-turf-logo data-align="left"></div>
        <div class="tpl-clock">${hhmm(ctx.now)}</div>
      </header>
      <div class="wm-grid ${plekken.length > 6 ? 'is-vol is-heel-vol' : plekken.length > 4 ? 'is-vol' : ''}">
        <div class="wm-side">
          <div class="tpl-title">
            <div class="kicker">${esc(here ? `Vanaf ${here.naam}` : 'TURF-locaties')}</div>
            <h1>${esc(slide.titel || 'Walking map')}</h1>
          </div>
          <ol class="wm-list">
            ${plekken
              .map(
                (p, i) => `
              <li class="${p === here ? 'is-here' : ''}" style="--c:${p.kleur};--i:${i}">
                <span class="wm-num">${p.nr}</span>
                <div class="wm-text"><strong>${esc(p.naam)}</strong>${p.adres ? `<span>${esc(p.adres)}</span>` : ''}</div>
                <em>${p === here ? 'U bent hier' : minutes(p) ? `${route(p).schatting ? '±' : ''}${minutes(p)} min` : ''}</em>
              </li>`,
              )
              .join('')}
          </ol>
          <div class="wm-foot"><span class="pill">${
            here ? `Looptijden vanaf ${esc(here.naam)}` : maxMin ? `Max. ${maxMin} min lopen` : 'TURF-locaties'
          }</span></div>
        </div>
        <div class="wm-map">
          <svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" preserveAspectRatio="xMidYMid slice">
            <image href="${ASSETS}/walking-map.svg" x="${-R}" y="${-R}" width="${2 * R}" height="${2 * R}"/>
            ${routes}
            ${plekken.map(marker).join('')}
          </svg>
          <small class="wm-credit">Kaart © OpenStreetMap</small>
        </div>
      </div>
    </section>`)
  return {el}
}

// ── Eigen ontwerp (slide-editor) ───────────────────────────────────────────
function ontwerp(slide, ctx) {
  const hasContent = o => !!o && (o.elementen?.length > 0 || (o.achtergrond && o.achtergrond !== 'verloop1'))
  const own = ctx.orient === 'portrait' ? slide.ontwerpPortrait : slide.ontwerpLandscape
  const other = ctx.orient === 'portrait' ? slide.ontwerpLandscape : slide.ontwerpPortrait
  const layout = hasContent(own) ? own : hasContent(other) ? other : null
  if (!layout) return null
  // Geen ontwerp voor deze oriëntatie: toon het andere, passend verkleind en gecentreerd.
  const srcOrient = layout === own ? ctx.orient : ctx.orient === 'portrait' ? 'landscape' : 'portrait'
  const src = CANVAS[srcOrient]
  const dst = CANVAS[ctx.orient]
  const scale = Math.min(dst.w / src.w, dst.h / src.h)

  const next = ctx.events.find(e => isToday(e, ctx) && atScreen(e, ctx) && isUpcoming(e, ctx))
  const tokens = {
    tijd: hhmm(ctx.now),
    dag: DAG_LABELS[ctx.dag] || '',
    locatie: screenLocName(ctx),
    volgende_tijd: next?.startTijd || '',
    volgende_titel: next?.titel || '',
    volgende_sprekers: next ? sprekerNames(next) : '',
  }

  const el = html('<section class="ontwerp"><div class="ontwerp-canvas"></div></section>')
  Object.assign(el.style, backgroundStyle(layout, ctx.orient, ASSETS))
  const canvas = el.firstElementChild
  Object.assign(canvas.style, {
    width: `${src.w}px`,
    height: `${src.h}px`,
    transform: `translate(-50%, -50%) scale(${scale})`,
  })
  for (const item of layout.elementen || []) {
    const {box, inner} = describeElement(item, {assets: ASSETS, tokens})
    const wrap = document.createElement('div')
    Object.assign(wrap.style, box)
    const node = document.createElement(inner.tag)
    Object.assign(node.style, inner.style)
    if (inner.tag === 'lottie') {
      const logo = document.createElement('div')
      Object.assign(logo.style, inner.style)
      logo.setAttribute('data-turf-logo', '')
      wrap.appendChild(logo)
      canvas.appendChild(wrap)
      continue
    }
    if (inner.tag === 'img') {
      if (!inner.src) continue
      node.src = inner.src
      node.alt = ''
    } else if (inner.text != null) {
      node.textContent = inner.text
    }
    wrap.appendChild(node)
    canvas.appendChild(wrap)
  }
  return {el}
}

// ── Video ──────────────────────────────────────────────────────────────────
// Video's die de browser niet kan tonen (bijv. geen H.264) slaan we de rest van de sessie over,
// zodat een scherm niet minutenlang zwart blijft.
const brokenVideos = new Set()

function video(slide, ctx) {
  const src = ctx.orient === 'portrait' ? slide.videoPortrait || slide.video : slide.video || slide.videoPortrait
  if (!src || brokenVideos.has(src)) return null
  const el = html(`<section class="media"><video muted playsinline preload="auto" src="${esc(src)}"></video></section>`)
  const v = el.querySelector('video')
  return {
    el,
    // Video's spelen helemaal af; dit is alleen het vangnet als 'ended' nooit komt.
    maxDuration: 600,
    start(next) {
      const giveUp = reason => {
        brokenVideos.add(src)
        console.warn(`[narrowcasting] video "${slide.naam}" overgeslagen: ${reason}`)
        next()
      }
      v.addEventListener('ended', next, {once: true})
      v.addEventListener('error', () => giveUp('kan niet worden geladen'), {once: true})
      // Geluid zonder beeld: de browser kent de videocodec niet.
      v.addEventListener('loadedmetadata', () => !v.videoWidth && giveUp('geen beeld — exporteer als MP4 met H.264'), {once: true})
      v.play().catch(() => setTimeout(next, 3000))
    },
    destroy() {
      v.pause()
      v.removeAttribute('src')
      v.load()
    },
  }
}

// ── Afbeelding ─────────────────────────────────────────────────────────────
function afbeelding(slide, ctx) {
  const portrait = ctx.orient === 'portrait'
  const src = portrait ? slide.afbeeldingPortrait || slide.afbeelding : slide.afbeelding || slide.afbeeldingPortrait
  if (!src) return null
  const [w, h] = portrait ? [1080, 1920] : [1920, 1080]
  return {el: html(`<section class="media"><img src="${img(src, w, h)}" alt=""></section>`)}
}

// ── Fallback: als er niets te tonen is ─────────────────────────────────────
export function fallbackSlide(ctx, state) {
  const note = !state.screen ? state.error || 'Geen verbinding' : ''
  return {
    el: html(`
      <section class="tpl fallback" style="--bg:${BG(1, ctx.orient)}">
        <div class="fallback-logo" data-turf-logo></div>
        ${note ? `<p class="fallback-note">${esc(note)}</p>` : ''}
      </section>`),
    duration: 15,
  }
}

// ── Melding: vervangt de playlist zolang hij actief is ─────────────────────
export function meldingSlide(melding, ctx) {
  const urgent = melding.stijl === 'urgent'
  return {
    el: html(`
      <section class="tpl melding ${urgent ? 'is-urgent' : ''}" ${
        urgent ? '' : `style="--bg:${BG(2, ctx.orient)}"`
      }>
        <header class="tpl-head">
          <div class="tpl-logo" data-turf-logo data-align="left"></div>
          <div class="tpl-clock">${hhmm(ctx.now)}</div>
        </header>
        <div class="melding-body">
          <h1 class="${(melding.titel || '').length > 16 ? 'is-long' : ''}">${esc(melding.titel)}</h1>
          ${melding.tekst ? `<p>${esc(melding.tekst).replace(/\n/g, '<br>')}</p>` : ''}
        </div>
      </section>`),
    duration: 15,
  }
}

export const TEMPLATES = {
  whatsNextLocatie,
  whatsNextOverall,
  programmaLocatie,
  programmaDag,
  sprekerIntro,
  closingKeynote,
  avondprogramma,
  walkingMap,
  sponsoren,
  ontwerp,
  video,
  afbeelding,
}

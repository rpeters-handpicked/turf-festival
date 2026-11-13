/**
 * TURF narrowcasting — slide-templates
 *
 * Elke template is een functie (slide, ctx) => {el, duration?, maxDuration?, start?, destroy?} | null
 * `null` betekent: nu niets te tonen, de player slaat de slide over.
 */

const ASSETS = 'narrowcasting/assets'
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
    <section class="tpl" style="background-image:url('${ASSETS}/bg-${bg}-${ctx.orient}.jpg')">
      <header class="tpl-head">
        <img class="tpl-logo" src="${ASSETS}/turf-logo.svg" alt="TURF">
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

// ── Programmaregels (gedeeld) ──────────────────────────────────────────────
function row(e, ctx, {showLoc}) {
  const status = isLive(e, ctx) ? 'is-live' : e.end <= ctx.now ? 'is-past' : ''
  // Staand is er geen ruimte voor een locatiekolom: de locatie schuift naar de tweede regel.
  const locInSub = showLoc && ctx.orient === 'portrait'
  const sub = [locInSub ? locLabel(e) : '', sprekerNames(e), showLoc ? '' : e.zaal].filter(Boolean).join(' · ')
  return `
    <li class="row ${status}">
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
        ${page.map(e => row(e, ctx, {showLoc})).join('')}
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

// ── Video ──────────────────────────────────────────────────────────────────
function video(slide, ctx) {
  const src = ctx.orient === 'portrait' ? slide.videoPortrait || slide.video : slide.video || slide.videoPortrait
  if (!src) return null
  const el = html(`<section class="media"><video muted playsinline preload="auto" src="${esc(src)}"></video></section>`)
  const v = el.querySelector('video')
  return {
    el,
    // Video's spelen helemaal af; dit is alleen het vangnet als 'ended' nooit komt.
    maxDuration: 600,
    start(next) {
      v.addEventListener('ended', next, {once: true})
      v.addEventListener('error', next, {once: true})
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
      <section class="tpl fallback" style="background-image:url('${ASSETS}/bg-1-${ctx.orient}.jpg')">
        <img class="fallback-logo" src="${ASSETS}/turf-logo.svg" alt="TURF">
        ${note ? `<p class="fallback-note">${esc(note)}</p>` : ''}
      </section>`),
    duration: 15,
  }
}

export const TEMPLATES = {
  whatsNextLocatie,
  whatsNextOverall,
  programmaLocatie,
  programmaDag,
  video,
  afbeelding,
}

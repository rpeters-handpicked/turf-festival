class TurfHighlightsList extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.events = []
    this.currentView = 'list'
    this.attrHeading = null
  }

  get cfg() { return typeof TURF_CONFIG !== 'undefined' ? TURF_CONFIG : {} }
  get projectId() { return this.getAttribute('project-id') || this.cfg.sanityProjectId || 'x545nfex' }
  get dataset() { return this.getAttribute('dataset') || this.cfg.sanityDataset || 'production' }
  get cdnUrl() { return `https://${this.projectId}.api.sanity.io/v2024-01-01/data/query/${this.dataset}` }

  get baseUrl() {
    const script = document.querySelector('script[src*="turf-highlights-list-widget"]')
    if (script) return script.src.substring(0, script.src.lastIndexOf('/') + 1)
    return ''
  }

  get lang() {
    const l = (document.documentElement.lang || 'nl').toLowerCase()
    return l.startsWith('en') ? 'en' : 'nl'
  }

  localeField(field) {
    return this.lang === 'en'
      ? `coalesce(${field}.en, ${field}.nl, ${field})`
      : `coalesce(${field}.nl, ${field})`
  }

  get ui() {
    const en = this.lang === 'en'
    return {
      loading:         en ? 'Loading programme…'              : 'Programma laden...',
      loadingEvent:    en ? 'Loading event…'                   : 'Event laden...',
      backBtn:         en ? 'Back to programme'                : 'Terug naar programma',
      saved:           en ? 'Saved'                            : 'Opgeslagen',
      favorite:        en ? 'Favorite'                         : 'Favoriet',
      aboutEvent:      en ? 'About this event'                 : 'Over dit event',
      locationSection: en ? 'Location'                         : 'Locatie',
      otherEvents:     en ? 'Other events at this location'    : 'Andere events op deze locatie',
      noOtherEvents:   en ? 'No other events at this location' : 'Geen andere events op deze locatie',
      thema:           en ? 'Theme'                            : 'Thema',
      typeLabel:       'Type',
      dagLabel:        en ? 'Day'                              : 'Dag',
      tijdLabel:       en ? 'Time'                             : 'Tijd',
      locatieLabel:    en ? 'Location'                         : 'Locatie',
      accessLabel:     en ? 'Access'                           : 'Toegang',
      freeAccess:      en ? 'Free'                             : 'Gratis',
      tags:            'Tags',
    }
  }

  get dagLabels() {
    const en = this.lang === 'en'
    return {
      dag1: { short: en ? 'THU 26/11' : 'DO 26/11', name: en ? 'THURSDAY' : 'DONDERDAG', date: '26 nov', prefix: en ? 'THU 26 Nov' : 'DO 26 nov', full: en ? 'Thursday 26 November 2026' : 'Donderdag 26 november 2026', num: '1' },
      dag2: { short: en ? 'FRI 27/11' : 'VR 27/11', name: en ? 'FRIDAY'   : 'VRIJDAG',   date: '27 nov', prefix: en ? 'FRI 27 Nov' : 'VR 27 nov', full: en ? 'Friday 27 November 2026'   : 'Vrijdag 27 november 2026',   num: '2' },
      dag3: { short: en ? 'SAT 28/11' : 'ZA 28/11', name: en ? 'SATURDAY' : 'ZATERDAG',  date: '28 nov', prefix: en ? 'SAT 28 Nov' : 'ZA 28 nov', full: en ? 'Saturday 28 November 2026' : 'Zaterdag 28 november 2026',  num: '3' },
    }
  }

  get themaLabels() {
    return { talks: '⬡ TURF Talks', live: '◈ TURF Live', night: '◉ TURF by Night' }
  }

  get tagClass() {
    return { talks: 'tag-talks', live: 'tag-live', night: 'tag-night' }
  }

  // ── Favorites (shared localStorage key) ─────────────────────────────────────
  getFavorites() {
    try { return JSON.parse(localStorage.getItem('turf-favorites') || '[]') } catch { return [] }
  }
  saveFavorites(favs) { localStorage.setItem('turf-favorites', JSON.stringify(favs)) }
  isFavorite(id) { return this.getFavorites().includes(id) }
  toggleFavorite(id) {
    const favs = this.getFavorites()
    const idx = favs.indexOf(id)
    if (idx > -1) { favs.splice(idx, 1) } else { favs.push(id) }
    this.saveFavorites(favs)
    return idx === -1
  }

  getNow() {
    const cfg = this.cfg
    return cfg.devTime ? new Date(cfg.devTime) : new Date()
  }

  isEventLive(e) {
    const now = this.getNow()
    const dagDate = this.cfg.festivalDates || { dag1: '2026-11-26', dag2: '2026-11-27', dag3: '2026-11-28' }
    const dateStr = dagDate[e.dag]
    if (!dateStr || !e.startTime) return false
    const start = new Date(`${dateStr}T${e.startTime}:00`)
    const end = e.endTime ? new Date(`${dateStr}T${e.endTime}:00`) : new Date(start.getTime() + 2 * 3600000)
    if (end <= start) end.setDate(end.getDate() + 1)
    return now >= start && now < end
  }

  slugify(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

  resolveHash(hash) {
    if (!hash) return null
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(hash)) return hash
    const match = this.events.find(e => this.slugify(e.title) === hash)
    return match ? match._id : null
  }

  async connectedCallback() {
    const headingAttr = this.getAttribute('heading')
    if (headingAttr) this.attrHeading = headingAttr

    this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="root"><div class="loading">${this.ui.loading}</div></div>`

    await this.loadEvents()

    const hash = window.location.hash.slice(1)
    const hashId = this.resolveHash(hash)
    if (hashId) {
      await this.renderDetail(hashId)
    } else {
      this.renderList()
    }

    window.addEventListener('hashchange', () => {
      const id = this.resolveHash(window.location.hash.slice(1))
      if (id) { this.renderDetail(id) } else { this.renderList() }
    })
  }

  async sanityFetch(query, params = {}) {
    let url = `${this.cdnUrl}?query=${encodeURIComponent(query)}`
    for (const [key, val] of Object.entries(params)) {
      url += `&$${key}="${encodeURIComponent(val)}"`
    }
    const res = await fetch(url)
    const data = await res.json()
    return data.result
  }

  async loadEvents() {
    const raw = await this.sanityFetch(`
      *[_type == "event" && gepubliceerd == true && coalesce(prioriteit, 0) == 1] | order(dag asc, startTijd asc) {
        _id,
        "titel": ${this.localeField('titel')},
        "ondertitel": ${this.localeField('ondertitel')},
        dag, startTijd, eindTijd,
        "themaSlug": thema->slug,
        "themaNaam": thema->naam,
        "locatieNaam": locatie->naam,
        "locatieRef": locatie._ref,
        "sprekerNamen": sprekers[]->naam,
        "afbeelding": afbeelding.asset->url
      }
    `)

    this.events = (raw || []).map(e => {
      let desc = e.ondertitel || ''
      return {
        _id: e._id,
        title: e.titel || '',
        dag: e.dag,
        startTime: e.startTijd || '',
        endTime: e.eindTijd || '',
        location: e.locatieNaam || '',
        locatieRef: e.locatieRef || null,
        theme: e.themaSlug || 'talks',
        themeName: e.themaNaam || '',
        speakers: (e.sprekerNamen || []).filter(Boolean),
        image: e.afbeelding || '',
        desc,
      }
    })
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────

  renderList() {
    this.currentView = 'list'
    const root = this.shadowRoot.querySelector('.root')
    root.innerHTML = `
      ${this.attrHeading ? `<h2 class="widget-heading">${this.attrHeading}</h2>` : ''}
      <div class="event-list">
        ${this.events.length === 0
          ? `<div class="empty-state"><h3>Geen uitgelichte events</h3></div>`
          : this.events.map(e => this.renderCard(e)).join('')
        }
      </div>
    `

    root.querySelectorAll('.event-card[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        const ev = this.events.find(e => e._id === card.dataset.id)
        const slug = ev ? this.slugify(ev.title) : card.dataset.id
        window.history.pushState(null, '', `#${slug}`)
        this.renderDetail(card.dataset.id)
      })
    })
  }

  renderCard(e) {
    const dag = this.dagLabels[e.dag] || { short: e.dag, full: e.dag }
    const timeStr = e.startTime + (e.endTime ? ` – ${e.endTime}` : '')
    const themeLabel = this.themaLabels[e.theme] || e.themeName
    const metaParts = [dag.full, timeStr, e.location].filter(Boolean)
    const speakersStr = e.speakers.length ? e.speakers.join(', ') : ''

    const imgHtml = e.image
      ? `<img class="card-img" src="${e.image}?w=720&h=480&fit=crop" alt="${e.title}" loading="lazy">`
      : `<div class="card-img-placeholder"><span class="card-img-icon">◈</span></div>`

    return `
      <div class="event-card" data-id="${e._id}" role="button" tabindex="0">
        ${imgHtml}
        <div class="card-content">
          <div class="card-meta">
            ${metaParts.map((p, i) => `${i > 0 ? '<span class="sep">·</span>' : ''}${p}`).join('')}
          </div>
          <div class="card-title">${e.title}</div>
          ${speakersStr ? `<div class="card-speakers">${speakersStr}</div>` : ''}
          ${e.desc ? `<div class="card-desc">${e.desc}</div>` : ''}
          <div class="card-footer">
            <span class="theme-pill theme-pill--${e.theme}">${themeLabel}</span>
          </div>
        </div>
      </div>
    `
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────────

  async renderDetail(eventId) {
    this.currentView = 'detail'
    const root = this.shadowRoot.querySelector('.root')
    root.innerHTML = `<div class="loading">${this.ui.loadingEvent}</div>`

    const e = await this.sanityFetch(
      `*[_type == "event" && _id == $id][0] {
        _id,
        "titel": ${this.localeField('titel')},
        "ondertitel": ${this.localeField('ondertitel')},
        "beschrijving": ${this.localeField('beschrijving')},
        dag, startTijd, eindTijd, type, tags, gratis, aanmelding, aanmeldLink,
        "themaSlug": thema->slug,
        "themaNaam": thema->naam,
        "locatieNaam": locatie->naam,
        "locatieAdres": locatie->adres,
        "locatieRef": locatie._ref,
        "sprekers": sprekers[]->{ naam, "rol": ${this.localeField('rol')}, organisatie, "foto": foto.asset->url },
        "afbeelding": afbeelding.asset->url,
        "afbeeldingRatio": afbeelding.asset->metadata.dimensions.aspectRatio
      }`,
      { id: eventId }
    )

    if (!e) { this.renderList(); return }

    const slug = this.slugify(e.titel)
    if (slug && window.location.hash.slice(1) !== slug) {
      window.history.replaceState(null, '', `#${slug}`)
    }

    const dag = this.dagLabels[e.dag] || { short: e.dag, full: e.dag }
    const theme = e.themaSlug || 'talks'
    const timeStr = `${e.startTijd}${e.eindTijd ? ' – ' + e.eindTijd : ''}`
    const themeLabel = { talks: 'TURF Talks', live: 'TURF Live', night: 'TURF by Night' }
    const detailLiveData = { _id: e._id, dag: e.dag, startTime: e.startTijd, endTime: e.eindTijd }
    const isLive = this.isEventLive(detailLiveData)

    const sprekersHtml = e.sprekers && e.sprekers.length > 0
      ? `<div class="speakers-section">${e.sprekers.map(sp => `
          <div class="speaker-card">
            <div class="speaker-avatar">${sp.foto ? `<img src="${sp.foto}?w=160&h=160&fit=crop" alt="${sp.naam}">` : '🎙️'}</div>
            <div>
              <div class="speaker-name">${sp.naam}</div>
              <div class="speaker-role">${[sp.rol, sp.organisatie].filter(Boolean).join(' · ')}</div>
            </div>
          </div>`).join('')}</div>`
      : ''

    const tagsHtml = e.tags && e.tags.length > 0
      ? `<div class="sidebar-card"><div class="sidebar-heading">${this.ui.tags}</div><div class="tags-list">${e.tags.map(t => `<span class="sidebar-tag">${t}</span>`).join('')}</div></div>`
      : ''

    const beschrijving = e.beschrijving
      ? e.beschrijving.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')
      : ''

    const mapsKey = this.cfg.googleMapsApiKey || 'AIzaSyBKtiBfiuLmG_td0BKfK6XABATDe8P1YPw'
    const mapQuery = encodeURIComponent(`${e.locatieNaam}${e.locatieAdres ? ', ' + e.locatieAdres : ', Breda'}`)
    const mapHtml = `<div class="map-container"><iframe src="https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${mapQuery}&zoom=15" allowfullscreen loading="lazy"></iframe></div>`

    root.innerHTML = `
      <div class="back-bar">
        <button class="back-btn" id="backBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
          ${this.attrHeading ? `Back to ${this.attrHeading}` : this.ui.backBtn}
        </button>
        <button class="detail-fav-btn ${this.isFavorite(eventId) ? 'fav-active' : ''}" id="detailFav">
          <span class="detail-fav-icon">★</span>
          <span class="detail-fav-label">${this.isFavorite(eventId) ? this.ui.saved : this.ui.favorite}</span>
        </button>
      </div>
      <div class="detail-page">
        <div class="detail-left">
          ${e.afbeelding ? (() => {
            const ratio = e.afbeeldingRatio
            const isLandscape = ratio && ratio > 1
            const imgSrc = isLandscape
              ? `${e.afbeelding}?w=1200&fit=max`
              : `${e.afbeelding}?w=800&h=800&fit=crop`
            const imgStyle = isLandscape
              ? `style="width:100%;aspect-ratio:${ratio.toFixed(4)};object-fit:cover;display:block;"`
              : `style="width:100%;aspect-ratio:1;object-fit:cover;display:block;"`
            return `<div class="hero-image"><img src="${imgSrc}" alt="${e.titel}" ${imgStyle}></div>`
          })() : ''}
          <div class="hero ${isLive ? 'hero-live' : ''}">
            ${isLive ? '<div class="detail-live-badge"><span class="detail-live-dot"></span>LIVE NU</div>' : ''}
            <h1 class="event-title-detail">${e.titel}</h1>
            <div class="event-meta-row">
              <span class="meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>${dag.full}</span>
              <span class="meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>${timeStr}</span>
            </div>
            <div class="event-meta-row">
              <span class="meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>${e.locatieNaam}${e.locatieAdres ? ' — ' + e.locatieAdres : ''}</span>
            </div>
            ${sprekersHtml}
          </div>
          ${beschrijving ? `<div class="section"><h2 class="section-title">${this.ui.aboutEvent}</h2><p class="description">${beschrijving}</p></div>` : ''}
          <div class="section"><h2 class="section-title">${this.ui.locationSection}</h2>${mapHtml}</div>
          <div class="section"><h2 class="section-title">${this.ui.otherEvents}</h2><div id="relatedList"></div></div>
        </div>
        <aside class="detail-sidebar">
          <div class="sidebar-card">
            <div class="sidebar-heading">Details</div>
            <div class="detail-row"><span class="detail-key">${this.ui.thema}</span><span class="detail-val">${themeLabel[theme] || e.themaNaam}</span></div>
            ${e.type ? `<div class="detail-row"><span class="detail-key">${this.ui.typeLabel}</span><span class="detail-val">${e.type}</span></div>` : ''}
            <div class="detail-row"><span class="detail-key">${this.ui.dagLabel}</span><span class="detail-val">${dag.full?.replace(' 2026', '') || ''}</span></div>
            <div class="detail-row"><span class="detail-key">${this.ui.tijdLabel}</span><span class="detail-val">${timeStr}</span></div>
            <div class="detail-row"><span class="detail-key">${this.ui.locatieLabel}</span><span class="detail-val">${e.locatieNaam}</span></div>
            ${e.gratis ? `<div class="detail-row"><span class="detail-key">${this.ui.accessLabel}</span><span class="detail-val" style="color:var(--accent-lime)">${this.ui.freeAccess}</span></div>` : ''}
          </div>
          ${tagsHtml}
        </aside>
      </div>
    `

    root.querySelector('#backBtn')?.addEventListener('click', () => {
      window.history.pushState(null, '', window.location.pathname + window.location.search)
      this.renderList()
    })

    root.querySelector('#detailFav')?.addEventListener('click', () => {
      const isFav = this.toggleFavorite(eventId)
      const btn = root.querySelector('#detailFav')
      btn.classList.toggle('fav-active', isFav)
      btn.querySelector('.detail-fav-label').textContent = isFav ? this.ui.saved : this.ui.favorite
    })

    if (e.locatieRef) {
      const related = await this.sanityFetch(
        `*[_type == "event" && locatie._ref == $locRef && _id != $id && gepubliceerd == true][0..3] | order(dag asc, startTijd asc) {
          _id,
          "titel": ${this.localeField('titel')},
          dag, startTijd, eindTijd,
          "themaSlug": thema->slug,
          "locatieNaam": locatie->naam
        }`,
        { locRef: e.locatieRef, id: eventId }
      )

      const relatedList = root.querySelector('#relatedList')
      if (relatedList && related && related.length > 0) {
        relatedList.innerHTML = related.map(r => {
          const rdag = this.dagLabels[r.dag] || { short: r.dag }
          const rtheme = r.themaSlug || 'talks'
          return `
            <div class="related-event" data-id="${r._id}">
              <div class="related-img">${this.themaLabels[rtheme]?.[0] || '◈'}</div>
              <div>
                <div class="related-meta">${rdag.short} · ${r.startTijd}${r.eindTijd ? ' – ' + r.eindTijd : ''} · ${r.locatieNaam}</div>
                <div class="related-title">${r.titel}</div>
                <span class="related-tag ${this.tagClass[rtheme]}">${this.themaLabels[rtheme]}</span>
              </div>
            </div>`
        }).join('')

        relatedList.querySelectorAll('.related-event').forEach(el => {
          el.addEventListener('click', () => {
            const ev = this.events.find(e => e._id === el.dataset.id)
            const slug = ev ? this.slugify(ev.title) : el.dataset.id
            window.history.pushState(null, '', `#${slug}`)
            this.renderDetail(el.dataset.id)
          })
        })
      } else if (relatedList) {
        relatedList.innerHTML = `<p style="color:var(--muted);font-size:20px;">${this.ui.noOtherEvents}</p>`
      }
    }

    root.scrollTop = 0
  }

  // ── STYLES ───────────────────────────────────────────────────────────────────

  getStyles() {
    const base = this.baseUrl
    return `
      @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700&display=swap');

      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-BoldLC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-BoldLC.woff') format('woff');
        font-weight: 700; font-display: swap;
      }
      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-SemiBoldLC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-SemiBoldLC.woff') format('woff');
        font-weight: 600; font-display: swap;
      }

      :host {
        display: block;
        position: relative;
        --text:          #ffffff;
        --muted:         rgba(255,255,255,0.55);
        --surface:       rgba(255,255,255,0.06);
        --surface2:      rgba(255,255,255,0.03);
        --surface-hover: rgba(255,255,255,0.1);
        --border:        rgba(255,255,255,0.12);
        --accent:        #e85d3a;
        --accent-lime:   #c8f04a;
        --tag-talks:     #e85d3a;
        --tag-live:      #d94080;
        --tag-night:     #9b3bf5;
        --radius:        100px;
        --radius-card:   16px;
        --font-heading:  'Thunder', Impact, sans-serif;
        --font-body:     'Barlow', sans-serif;
        --nav-bg:        rgba(10,10,10,0.85);
      }

      *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

      .root {
        background: var(--nav-bg);
        color: var(--text);
        font-family: var(--font-body);
        display: flex;
        flex-direction: column;
        border-radius: 20px;
        overflow: hidden;
      }

      .loading {
        padding: 80px 0; text-align: center;
        font-size: 14px; font-weight: 500; color: var(--muted);
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      /* ── WIDGET HEADING ── */
      .widget-heading {
        font-family: var(--font-heading); font-weight: 900;
        font-size: clamp(36px, 8vw, 96px);
        line-height: 0.95; letter-spacing: -0.5px;
        text-transform: uppercase; color: var(--text);
        margin: 0; padding: 24px 20px 16px;
      }

      /* ── LIST ── */
      .event-list { display: flex; flex-direction: column; gap: 3px; padding: 24px 20px; }

      .empty-state { padding: 80px 32px; text-align: center; }
      .empty-state h3 {
        font-family: var(--font-heading); font-size: 42px; font-weight: 700;
        color: var(--text); margin-bottom: 8px;
      }

      /* ── EVENT CARD ── */
      .event-card {
        display: grid;
        grid-template-columns: 320px 1fr;
        background: var(--surface);
        border-radius: var(--radius-card);
        overflow: hidden;
        cursor: pointer;
        transition: background 0.2s;
      }
      .event-card:hover { background: var(--surface-hover); }
      .event-card:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }

      .card-img { width: 320px; height: 220px; object-fit: cover; display: block; }
      .card-img-placeholder {
        width: 320px; height: 220px;
        background: rgba(255,255,255,0.04);
        display: flex; align-items: center; justify-content: center;
      }
      .card-img-icon { font-size: 56px; opacity: 0.15; }

      .card-content {
        padding: 24px 28px;
        display: flex; flex-direction: column; justify-content: center;
      }

      .card-meta {
        display: flex; align-items: center; flex-wrap: wrap;
        margin-bottom: 10px;
        font-size: 11px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.5px; color: var(--muted);
      }
      .sep { margin: 0 8px; opacity: 0.3; }

      .card-title {
        font-family: var(--font-heading);
        font-size: clamp(32px, 4vw, 48px);
        font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.5px; line-height: 1;
        color: var(--text); margin-bottom: 10px;
      }

      .card-speakers {
        font-size: 14px; font-weight: 500; color: var(--muted); margin-bottom: 8px;
      }

      .card-desc {
        font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.6);
        max-width: 480px;
        display: -webkit-box; -webkit-line-clamp: 2;
        -webkit-box-orient: vertical; overflow: hidden;
        margin-bottom: 12px;
      }

      .card-footer { display: flex; align-items: center; gap: 12px; margin-top: auto; }

      .theme-pill {
        display: inline-flex; align-items: center;
        padding: 4px 12px; border-radius: var(--radius);
        border: 1px solid var(--border);
        font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
        background: rgba(255,255,255,0.05); color: var(--muted);
      }
      .theme-pill--talks { border-color: rgba(232,93,58,0.4); color: var(--tag-talks); background: rgba(232,93,58,0.1); }
      .theme-pill--live  { border-color: rgba(217,64,128,0.4); color: var(--tag-live);  background: rgba(217,64,128,0.1); }
      .theme-pill--night { border-color: rgba(155,59,245,0.4); color: var(--tag-night); background: rgba(155,59,245,0.1); }

      .card-cta {
        font-size: 12px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.5px; color: rgba(255,255,255,0.3);
        margin-left: auto; transition: color 0.15s;
      }
      .event-card:hover .card-cta { color: var(--text); }

      /* ── DETAIL BACK BAR ── */
      .back-bar {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 24px; border-bottom: 1px solid var(--border);
        position: sticky; top: 0; background: var(--nav-bg);
        backdrop-filter: blur(12px); z-index: 50;
      }
      .back-btn {
        display: flex; align-items: center; gap: 8px;
        background: none; border: none; color: var(--text);
        font-family: var(--font-heading); font-size: 24px; font-weight: 600;
        cursor: pointer; letter-spacing: 0.5px; padding: 0;
        text-transform: uppercase; transition: opacity 0.15s;
      }
      .back-btn:hover { opacity: 0.7; }

      .detail-fav-btn {
        display: flex; align-items: center; gap: 8px;
        background: transparent; border: 1.5px solid var(--border);
        color: var(--text); font-family: var(--font-body); font-size: 20px;
        font-weight: 600; cursor: pointer; padding: 8px 18px;
        border-radius: var(--radius); transition: all 0.15s;
      }
      .detail-fav-btn:hover { border-color: #fff; }
      .detail-fav-btn.fav-active { background: #ffd700; border-color: #ffd700; color: #111; }
      .detail-fav-icon { font-size: 1.125rem; }

      /* ── DETAIL LAYOUT ── */
      .detail-page {
        display: grid; grid-template-columns: 1fr 300px;
        gap: 32px; padding: 32px 24px;
        max-width: 1100px; margin: 0 auto;
      }

      .hero-image { border-radius: var(--radius-card); overflow: hidden; margin-bottom: 24px; }
      .hero-image img { width: 100%; display: block; }

      .hero { margin-bottom: 28px; }
      .hero.hero-live { border-left: 3px solid var(--accent); padding-left: 16px; }
      .detail-live-badge {
        display: inline-flex; align-items: center; gap: 6px;
        background: var(--accent); color: #fff; font-family: var(--font-heading);
        font-size: 1.125rem; font-weight: 700; padding: 4px 12px; border-radius: 100px;
        letter-spacing: 1px; margin-bottom: 12px; animation: pulse 2s infinite;
      }
      .detail-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #fff; animation: pulse 1.5s infinite; }

      .event-title-detail {
        font-family: var(--font-heading); font-size: clamp(48px, 7.5vw, 78px);
        font-weight: 700; line-height: 1.05; margin-bottom: 16px; color: var(--text);
      }
      .event-meta-row { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 8px; }
      .meta-item {
        display: flex; align-items: center; gap: 4px;
        font-size: 16px; color: var(--muted); font-weight: 500;
        text-transform: uppercase; letter-spacing: 0.3px;
      }

      .speakers-section { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
      .speaker-card { display: flex; gap: 12px; align-items: center; }
      .speaker-avatar {
        width: 48px; height: 48px; border-radius: 50%; overflow: hidden;
        background: var(--surface); display: flex; align-items: center;
        justify-content: center; font-size: 1.125rem; flex-shrink: 0;
      }
      .speaker-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .speaker-name { font-weight: 600; font-size: 1.125rem; margin-bottom: 2px; }
      .speaker-role { font-size: 1.125rem; color: var(--muted); }

      .section { margin-bottom: 32px; }
      .section-title {
        font-family: var(--font-heading); font-size: 1.125rem; font-weight: 700;
        color: var(--text); margin-bottom: 14px; letter-spacing: 0.5px;
        text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: 8px;
      }
      .description { font-size: 1.125rem; line-height: 1.7; color: rgba(255,255,255,0.8); }

      .map-container { border-radius: var(--radius-card); overflow: hidden; }
      .map-container iframe { width: 100%; height: 280px; border: none; display: block; }

      .related-event {
        display: flex; gap: 14px; align-items: center;
        padding: 12px 0; border-bottom: 1px solid var(--border);
        cursor: pointer; transition: opacity 0.15s;
      }
      .related-event:hover { opacity: 0.7; }
      .related-event:last-child { border-bottom: none; }
      .related-img {
        width: 40px; height: 40px; border-radius: 8px;
        background: var(--surface); display: flex; align-items: center;
        justify-content: center; font-size: 27px; flex-shrink: 0;
      }
      .related-meta { font-size: 0.8rem; color: var(--muted); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.3px; }
      .related-title { font-family: var(--font-heading); font-size: 1.35rem; font-weight: 700; margin-bottom: 4px; }
      .related-tag { font-size: 0.84rem; font-weight: 700; padding: 2px 8px; border-radius: 100px; }
      .tag-talks { background: rgba(232,93,58,0.2); color: var(--tag-talks); }
      .tag-live  { background: rgba(217,64,128,0.2); color: var(--tag-live); }
      .tag-night { background: rgba(155,59,245,0.2); color: var(--tag-night); }

      .detail-sidebar { display: flex; flex-direction: column; gap: 16px; }
      .sidebar-card {
        background: var(--surface); border: 1px solid var(--border);
        border-radius: var(--radius-card); padding: 20px;
      }
      .sidebar-heading {
        font-family: var(--font-heading); font-size: 1.125rem; font-weight: 700;
        letter-spacing: 1px; text-transform: uppercase; color: var(--muted); margin-bottom: 14px;
      }
      .detail-row {
        display: flex; justify-content: space-between; gap: 8px;
        padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .detail-row:last-child { border-bottom: none; }
      .detail-key { font-size: 1.125rem; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; }
      .detail-val { font-size: 1.125rem; font-weight: 600; text-align: right; }
      .tags-list { display: flex; flex-wrap: wrap; gap: 6px; }
      .sidebar-tag {
        font-size: 0.84rem; font-weight: 600; padding: 4px 12px;
        border-radius: 100px; background: var(--surface2); border: 1px solid var(--border);
        cursor: default; transition: all 0.15s;
      }

      /* ── SCROLLBAR ── */
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

      /* ── MOBILE ── */
      @media (max-width: 768px) {
        .event-list { padding: 16px 12px; }
        .event-card { grid-template-columns: 1fr; }
        .card-img { width: 100%; height: 200px; }
        .card-img-placeholder { width: 100%; height: 200px; }
        .card-content { padding: 16px 20px; }
        .card-title { font-size: 32px; }

        .detail-page { grid-template-columns: 1fr; padding: 16px 12px; gap: 20px; }
        .detail-sidebar { order: -1; }
        .hero-image img { height: 220px; }
        .back-bar { padding: 12px 16px; }
      }
    `
  }
}

customElements.define('turf-highlights-list', TurfHighlightsList)

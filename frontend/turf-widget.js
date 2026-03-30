class TurfProgramma extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.events = []
    this.locations = []
    this.activeDay = null
    this.activeCat = 'all'
    this.activeLocation = null
    this.activeType = null
    this.activeTag = null
    this.showFavoritesOnly = false
    this.searchQuery = ''
    this.currentView = 'list'
    this.scrollPos = 0
  }

  // ─── FAVORITES (localStorage) ─────────────────────────────────────────────
  getFavorites() {
    try { return JSON.parse(localStorage.getItem('turf-favorites') || '[]') } catch { return [] }
  }
  saveFavorites(favs) {
    localStorage.setItem('turf-favorites', JSON.stringify(favs))
  }
  isFavorite(id) {
    return this.getFavorites().includes(id)
  }
  toggleFavorite(id) {
    const favs = this.getFavorites()
    const idx = favs.indexOf(id)
    if (idx > -1) { favs.splice(idx, 1) } else { favs.push(id) }
    this.saveFavorites(favs)
    return idx === -1 // returns true if now favorited
  }

  // DEV MODE: simulate time as Thursday 10:30 — set to null for real time
  get devTime() { return new Date('2026-11-26T10:30:00') }
  // get devTime() { return null }

  getNow() { return this.devTime || new Date() }

  isEventLive(e) {
    const now = this.getNow()
    const dagDate = { dag1: '2026-11-26', dag2: '2026-11-27', dag3: '2026-11-28' }
    const dateStr = dagDate[e.dag]
    if (!dateStr || !e.startTime) return false
    const start = new Date(`${dateStr}T${e.startTime}:00`)
    const end = e.endTime ? new Date(`${dateStr}T${e.endTime}:00`) : new Date(start.getTime() + 2 * 3600000)
    // Handle overnight events (end < start means next day)
    if (end <= start) end.setDate(end.getDate() + 1)
    return now >= start && now < end
  }

  get routeUrl() { return this.getAttribute('route-url') || 'turf-route.html' }
  get projectId() { return this.getAttribute('project-id') || 'x545nfex' }
  get dataset() { return this.getAttribute('dataset') || 'production' }
  get cdnUrl() { return `https://${this.projectId}.api.sanity.io/v2024-01-01/data/query/${this.dataset}` }

  async connectedCallback() {
    this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="root"><div class="loading">Programma laden...</div></div>`
    await this.loadEvents()

    // Check for location filter from URL param
    const urlParams = new URLSearchParams(window.location.search)
    const locationParam = urlParams.get('location')
    if (locationParam) this.activeLocation = locationParam

    // Check for deep link in URL hash
    const hash = window.location.hash.slice(1)
    if (hash) {
      await this.renderDetail(hash)
    } else {
      this.renderList()
    }

    // Listen for back/forward navigation
    window.addEventListener('hashchange', () => {
      const id = window.location.hash.slice(1)
      if (id) {
        this.renderDetail(id)
      } else {
        this.renderList()
      }
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

  // ─── DATA ───────────────────────────────────────────────────────────────────

  get dagLabels() {
    return {
      dag1: { short: 'DO 26/11', prefix: 'DO 26 nov', full: 'Donderdag 26 november 2026', num: '1' },
      dag2: { short: 'VR 27/11', prefix: 'VR 27 nov', full: 'Vrijdag 27 november 2026', num: '2' },
      dag3: { short: 'ZA 28/11', prefix: 'ZA 28 nov', full: 'Zaterdag 28 november 2026', num: '3' },
    }
  }

  get themaLabels() {
    return { talks: '⬡ TURF Talks', live: '◈ TURF Live', night: '◉ TURF by Night' }
  }

  get tagClass() {
    return { talks: 'tag-talks', live: 'tag-live', night: 'tag-night' }
  }

  async loadEvents() {
    const raw = await this.sanityFetch(`*[_type == "event" && gepubliceerd == true] | order(dag asc, startTijd asc) {
      _id, titel, ondertitel, dag, startTijd, eindTijd, type, tags,
      "themaSlug": thema->slug,
      "themaNaam": thema->naam,
      "themaKleur": thema->kleur,
      "locatieNaam": locatie->naam,
      "locatieRef": locatie._ref,
      "afbeelding": afbeelding.asset->url
    }`)

    this.events = raw.map(e => ({
      _id: e._id,
      title: e.titel,
      subtitle: e.ondertitel || '',
      day: this.dagLabels[e.dag]?.num || '1',
      dag: e.dag,
      timeLabel: `${this.dagLabels[e.dag]?.prefix || e.dag} @ ${e.startTijd}`,
      startTime: e.startTijd,
      endTime: e.eindTijd || '',
      location: e.locatieNaam || '',
      locatieRef: e.locatieRef || '',
      theme: e.themaSlug || 'talks',
      themeName: e.themaNaam || '',
      type: e.type || '',
      tags: e.tags || [],
      image: e.afbeelding || '',
    }))

    this.locations = [...new Set(this.events.map(e => e.location))].filter(Boolean).sort()
    this.types = [...new Set(this.events.map(e => e.type))].filter(Boolean).sort()
  }

  // ─── LIST VIEW ──────────────────────────────────────────────────────────────

  renderList() {
    this.currentView = 'list'
    const root = this.shadowRoot.querySelector('.root')
    root.innerHTML = `
      <div class="category-bar desktop-only">
        <button class="cat-tab active" data-cat="all">All Events</button>
        <button class="cat-tab" data-cat="talks">⬡ TURF Talks</button>
        <button class="cat-tab" data-cat="live">◈ TURF Live</button>
        <button class="cat-tab" data-cat="night">◉ TURF by Night</button>
        <button class="cat-tab cat-tab-fav ${this.showFavoritesOnly ? 'active' : ''}" id="favFilter">★ Favorites</button>
      </div>
      ${this.activeTag ? `<div class="active-tag-bar">Filtered by tag: <strong>${this.activeTag}</strong> <button id="clearTag">✕</button></div>` : ''}
      <div class="main">
        <aside class="sidebar">
          <div class="results-count">Showing <strong id="count">0</strong> results</div>
          <div class="search-box">
            <span class="search-icon">⌕</span>
            <input type="text" id="search" placeholder="Search event..." value="${this.searchQuery}">
          </div>
          <!-- Desktop filters -->
          <div class="filter-section desktop-only">
            <div class="filter-label">Date <button id="clearDate">—</button></div>
            <div class="date-grid">
              <button class="date-btn ${this.activeDay === '1' ? 'active' : ''}" data-day="1"><span class="day-name">DO</span><span class="day-num">26-11</span></button>
              <button class="date-btn ${this.activeDay === '2' ? 'active' : ''}" data-day="2"><span class="day-name">VR</span><span class="day-num">27-11</span></button>
              <button class="date-btn ${this.activeDay === '3' ? 'active' : ''}" data-day="3"><span class="day-name">ZA</span><span class="day-num">28-11</span></button>
            </div>
          </div>
          <div class="filter-section desktop-only">
            <div class="filter-label">Location <button id="clearLoc">—</button></div>
            <div class="location-list" id="locationList"></div>
          </div>
          <a href="${this.routeUrl}" target="_blank" class="route-btn desktop-only">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            TURF ROUTE
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          <!-- Mobile filters (dropdowns) -->
          <div class="mobile-filters mobile-only">
            <select class="mobile-select" id="mobileDate">
              <option value="">Alle dagen</option>
              <option value="1" ${this.activeDay === '1' ? 'selected' : ''}>DO 26-11</option>
              <option value="2" ${this.activeDay === '2' ? 'selected' : ''}>VR 27-11</option>
              <option value="3" ${this.activeDay === '3' ? 'selected' : ''}>ZA 28-11</option>
            </select>
            <select class="mobile-select" id="mobileLocation">
              <option value="">Alle locaties</option>
              ${this.locations.map(loc => `<option value="${loc}" ${this.activeLocation === loc ? 'selected' : ''}>${loc}</option>`).join('')}
            </select>
            <select class="mobile-select" id="mobileCat">
              <option value="all" ${this.activeCat === 'all' ? 'selected' : ''}>All Events</option>
              <option value="talks" ${this.activeCat === 'talks' ? 'selected' : ''}>⬡ TURF Talks</option>
              <option value="live" ${this.activeCat === 'live' ? 'selected' : ''}>◈ TURF Live</option>
              <option value="night" ${this.activeCat === 'night' ? 'selected' : ''}>◉ TURF by Night</option>
            </select>
            <button class="mobile-fav-btn ${this.showFavoritesOnly ? 'fav-active' : ''}" id="mobileFavFilter">★</button>
          </div>
          <a href="${this.routeUrl}" target="_blank" class="route-btn mobile-only">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            TURF ROUTE
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </aside>
        <main class="content" id="eventList"></main>
      </div>
    `

    this.bindListEvents()
    this.renderLocations()
    this.applyFilters()

    // Clear tag filter
    root.querySelector('#clearTag')?.addEventListener('click', () => {
      this.activeTag = null
      this.renderList()
    })

    if (this.scrollPos) {
      root.querySelector('.content')?.scrollTo(0, this.scrollPos)
    }
  }

  bindListEvents() {
    const root = this.shadowRoot

    // Category tabs
    root.querySelectorAll('.cat-tab:not(.cat-tab-fav)').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        this.activeCat = btn.dataset.cat
        this.showFavoritesOnly = false
        this.applyFilters()
      })
    })

    // Favorites filter toggle
    root.getElementById('favFilter')?.addEventListener('click', () => {
      this.showFavoritesOnly = !this.showFavoritesOnly
      if (this.showFavoritesOnly) {
        root.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'))
        root.getElementById('favFilter').classList.add('active')
        this.activeCat = 'all'
      } else {
        root.getElementById('favFilter').classList.remove('active')
        const allTab = root.querySelector('.cat-tab[data-cat="all"]')
        if (allTab) allTab.classList.add('active')
      }
      this.applyFilters()
    })

    // Date buttons
    root.querySelectorAll('.date-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = btn.dataset.day
        if (this.activeDay === day) {
          this.activeDay = null
          btn.classList.remove('active')
        } else {
          root.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'))
          this.activeDay = day
          btn.classList.add('active')
        }
        this.applyFilters()
      })
    })

    root.getElementById('clearDate')?.addEventListener('click', () => {
      this.activeDay = null
      root.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'))
      this.applyFilters()
    })

    root.getElementById('clearLoc')?.addEventListener('click', () => {
      this.activeLocation = null
      this.renderLocations()
      this.applyFilters()
    })

    // Search
    root.getElementById('search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value
      this.applyFilters()
    })

    // Mobile dropdowns
    root.getElementById('mobileDate')?.addEventListener('change', (e) => {
      this.activeDay = e.target.value || null
      // Sync desktop buttons
      root.querySelectorAll('.date-btn').forEach(b => b.classList.toggle('active', b.dataset.day === this.activeDay))
      this.applyFilters()
    })

    root.getElementById('mobileLocation')?.addEventListener('change', (e) => {
      this.activeLocation = e.target.value || null
      this.renderLocations()
      this.applyFilters()
    })

    root.getElementById('mobileCat')?.addEventListener('change', (e) => {
      this.activeCat = e.target.value
      this.showFavoritesOnly = false
      // Sync desktop tabs
      root.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'))
      root.querySelector(`.cat-tab[data-cat="${this.activeCat}"]`)?.classList.add('active')
      root.getElementById('favFilter')?.classList.remove('active')
      root.getElementById('mobileFavFilter')?.classList.remove('fav-active')
      this.applyFilters()
    })

    // Mobile favorites toggle
    root.getElementById('mobileFavFilter')?.addEventListener('click', () => {
      this.showFavoritesOnly = !this.showFavoritesOnly
      const btn = root.getElementById('mobileFavFilter')
      btn.classList.toggle('fav-active', this.showFavoritesOnly)
      // Sync desktop
      root.getElementById('favFilter')?.classList.toggle('active', this.showFavoritesOnly)
      if (this.showFavoritesOnly) {
        this.activeCat = 'all'
        root.querySelectorAll('.cat-tab:not(.cat-tab-fav)').forEach(b => b.classList.remove('active'))
        root.getElementById('mobileCat').value = 'all'
      }
      this.applyFilters()
    })
  }

  renderLocations() {
    const list = this.shadowRoot.getElementById('locationList')
    if (!list) return
    list.innerHTML = this.locations.map(loc =>
      `<button class="loc-btn ${this.activeLocation === loc ? 'active' : ''}" data-loc="${loc}">${loc}</button>`
    ).join('')

    list.querySelectorAll('.loc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const loc = btn.dataset.loc
        this.activeLocation = this.activeLocation === loc ? null : loc
        this.renderLocations()
        this.applyFilters()
      })
    })
  }

  applyFilters() {
    const q = this.searchQuery.toLowerCase()
    const favs = this.showFavoritesOnly ? this.getFavorites() : null
    const filtered = this.events.filter(e => {
      if (favs && !favs.includes(e._id)) return false
      if (this.activeDay && e.day !== this.activeDay) return false
      if (this.activeCat !== 'all' && e.theme !== this.activeCat) return false
      if (this.activeLocation && e.location !== this.activeLocation) return false
      if (this.activeTag && (!e.tags || !e.tags.includes(this.activeTag))) return false
      if (q && !e.title.toLowerCase().includes(q) && !e.location.toLowerCase().includes(q) && !(e.tags && e.tags.some(t => t.toLowerCase().includes(q)))) return false
      return true
    })
    this.renderEvents(filtered)
  }

  renderEvents(filtered) {
    const container = this.shadowRoot.getElementById('eventList')
    const countEl = this.shadowRoot.getElementById('count')
    if (!container) return
    if (countEl) countEl.textContent = filtered.length

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state"><h3>Geen Events Gevonden</h3><p>Pas je filters aan</p></div>`
      return
    }

    const groups = {}
    filtered.forEach(e => {
      if (!groups[e.timeLabel]) groups[e.timeLabel] = []
      groups[e.timeLabel].push(e)
    })

    container.innerHTML = Object.entries(groups).map(([label, evts]) => {
      const hasLive = evts.some(e => this.isEventLive(e))
      return `
      <div class="time-divider ${hasLive ? 'has-live' : ''}">${hasLive ? '<span class="live-badge">LIVE</span>' : ''}${label}</div>
      ${evts.map(e => {
        const isLive = this.isEventLive(e)
        const imgHtml = e.image
          ? `<img class="event-img" src="${e.image}?w=200&h=200&fit=crop" alt="${e.title}">`
          : `<div class="event-img">${this.themaLabels[e.theme]?.[0] || '◈'}</div>`
        return `
        <div class="event-card ${isLive ? 'event-live' : ''}" data-id="${e._id}">
          ${imgHtml}
          <div class="event-card-body">
            <div class="event-meta">
              ${isLive ? '<span class="meta-live"><span class="live-dot"></span>LIVE</span>' : ''}
              <span class="meta-item">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
                ${this.dagLabels[e.dag]?.short || e.dag}
              </span>
              <span class="meta-item">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
                ${e.startTime}${e.endTime ? ' – ' + e.endTime : ''}
              </span>
              <span class="meta-item">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                ${e.location}
              </span>
            </div>
            <div class="event-title">${e.title}</div>
            ${e.subtitle ? `<div class="event-subtitle">${e.subtitle}</div>` : ''}
            <div class="event-tags">
              <span class="tag ${this.tagClass[e.theme]}">${this.themaLabels[e.theme] || e.themeName}</span>
              ${e.type ? `<span class="tag tag-type">${e.type}</span>` : ''}
            </div>
          </div>
          <button class="fav-btn ${this.isFavorite(e._id) ? 'fav-active' : ''}" data-fav="${e._id}" title="Favorite">★</button>
        </div>`
      }).join('')}`
    }).join('')

    // Bind fav buttons (before card click to prevent propagation)
    container.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const id = btn.dataset.fav
        const isFav = this.toggleFavorite(id)
        btn.classList.toggle('fav-active', isFav)
        // If showing favorites only, re-filter
        if (this.showFavoritesOnly) this.applyFilters()
      })
    })

    // Bind click events on cards
    container.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', () => {
        this.scrollPos = container.scrollTop
        window.history.pushState(null, '', `#${card.dataset.id}`)
        this.renderDetail(card.dataset.id)
      })
    })
  }

  // ─── DETAIL VIEW ────────────────────────────────────────────────────────────

  async renderDetail(eventId) {
    this.currentView = 'detail'
    const root = this.shadowRoot.querySelector('.root')
    root.innerHTML = `<div class="loading">Event laden...</div>`

    const e = await this.sanityFetch(
      `*[_type == "event" && _id == $id][0] {
        _id, titel, ondertitel, beschrijving, dag, startTijd, eindTijd, type, tags, gratis, aanmelding, aanmeldLink,
        "themaSlug": thema->slug,
        "themaNaam": thema->naam,
        "locatieNaam": locatie->naam,
        "locatieAdres": locatie->adres,
        "locatieRef": locatie._ref,
        "sprekers": sprekers[]->{ naam, rol, organisatie, "foto": foto.asset->url },
        "afbeelding": afbeelding.asset->url
      }`,
      { id: eventId }
    )

    if (!e) { this.renderList(); return }

    const dag = this.dagLabels[e.dag] || { short: e.dag, full: e.dag }
    const theme = e.themaSlug || 'talks'
    const timeStr = `${e.startTijd}${e.eindTijd ? ' – ' + e.eindTijd : ''}`
    const themeLabel = { talks: 'TURF Talks', live: 'TURF Live', night: 'TURF by Night' }

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
      ? `<div class="sidebar-card"><div class="sidebar-heading">Tags</div><div class="tags-list">${e.tags.map(t => `<span class="sidebar-tag sidebar-tag-clickable" data-tag="${t}">${t}</span>`).join('')}</div></div>`
      : ''

    const beschrijving = e.beschrijving
      ? e.beschrijving.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')
      : ''

    // Check if this event is live
    const detailLiveData = { _id: e._id, dag: e.dag, startTime: e.startTijd, endTime: e.eindTijd }
    const isLive = this.isEventLive(detailLiveData)

    // Google Maps embed URL
    const mapQuery = encodeURIComponent(`${e.locatieNaam}${e.locatieAdres ? ', ' + e.locatieAdres : ', Breda'}`)
    const mapHtml = `<div class="map-container"><iframe src="https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${mapQuery}&zoom=15" allowfullscreen loading="lazy"></iframe></div>`

    root.innerHTML = `
      <div class="back-bar">
        <button class="back-btn" id="backBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
          Terug naar programma
        </button>
        <button class="detail-fav-btn ${this.isFavorite(eventId) ? 'fav-active' : ''}" id="detailFav">
          <span class="detail-fav-icon">★</span>
          <span class="detail-fav-label">${this.isFavorite(eventId) ? 'Saved' : 'Favorite'}</span>
        </button>
      </div>
      <div class="detail-page">
        <div class="detail-left">
          ${e.afbeelding ? `<div class="hero-image"><img src="${e.afbeelding}?w=800&h=400&fit=crop" alt="${e.titel}"></div>` : ''}
          <div class="hero ${isLive ? 'hero-live' : ''}">
            ${isLive ? '<div class="detail-live-badge"><span class="detail-live-dot"></span>LIVE NU</div>' : ''}
            <h1 class="event-title-detail">${e.titel}</h1>
            <div class="event-meta-row">
              <span class="meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
                ${dag.full}
              </span>
              <span class="meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
                ${timeStr}
              </span>
            </div>
            <div class="event-meta-row">
              <span class="meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                ${e.locatieNaam}${e.locatieAdres ? ' — ' + e.locatieAdres : ''}
              </span>
            </div>
            ${sprekersHtml}
          </div>
          ${beschrijving ? `<div class="section"><h2 class="section-title">Over dit event</h2><p class="description">${beschrijving}</p></div>` : ''}
          <div class="section">
            <h2 class="section-title">Locatie</h2>
            ${mapHtml}
          </div>
          <div class="section"><h2 class="section-title">Andere events op deze locatie</h2><div id="relatedList"></div></div>
        </div>
        <aside class="detail-sidebar">
          <div class="sidebar-card">
            <div class="sidebar-heading">Details</div>
            <div class="detail-row"><span class="detail-key">Thema</span><span class="detail-val">${themeLabel[theme] || e.themaNaam}</span></div>
            ${e.type ? `<div class="detail-row"><span class="detail-key">Type</span><span class="detail-val">${e.type}</span></div>` : ''}
            <div class="detail-row"><span class="detail-key">Dag</span><span class="detail-val">${dag.full?.replace(' 2026', '') || ''}</span></div>
            <div class="detail-row"><span class="detail-key">Tijd</span><span class="detail-val">${timeStr}</span></div>
            <div class="detail-row"><span class="detail-key">Locatie</span><span class="detail-val">${e.locatieNaam}</span></div>
            ${e.gratis ? `<div class="detail-row"><span class="detail-key">Toegang</span><span class="detail-val" style="color:var(--accent-lime)">Gratis</span></div>` : ''}
          </div>
          ${tagsHtml}
        </aside>
      </div>
    `

    // Back button
    root.querySelector('#backBtn')?.addEventListener('click', () => {
      window.history.pushState(null, '', window.location.pathname + window.location.search)
      this.renderList()
    })

    // Clickable tags → filter list by tag
    root.querySelectorAll('.sidebar-tag-clickable').forEach(tag => {
      tag.addEventListener('click', () => {
        this.activeTag = tag.dataset.tag
        window.history.pushState(null, '', window.location.pathname + window.location.search)
        this.renderList()
      })
    })

    // Detail favorite button
    root.querySelector('#detailFav')?.addEventListener('click', () => {
      const isFav = this.toggleFavorite(eventId)
      const btn = root.querySelector('#detailFav')
      btn.classList.toggle('fav-active', isFav)
      btn.querySelector('.detail-fav-label').textContent = isFav ? 'Saved' : 'Favorite'
    })

    // Load related events
    if (e.locatieRef) {
      const related = await this.sanityFetch(
        `*[_type == "event" && locatie._ref == $locRef && _id != $id && gepubliceerd == true][0..3] | order(dag asc, startTijd asc) {
          _id, titel, dag, startTijd, eindTijd,
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
            window.history.pushState(null, '', `#${el.dataset.id}`)
            this.renderDetail(el.dataset.id)
          })
        })
      } else if (relatedList) {
        relatedList.innerHTML = '<p style="color:var(--muted);font-size:13px;">Geen andere events op deze locatie</p>'
      }
    }

    // Scroll to top
    root.scrollTop = 0
  }

  // ─── STYLES ─────────────────────────────────────────────────────────────────

  get baseUrl() {
    const script = document.querySelector('script[src*="turf-widget"]')
    if (script) return script.src.substring(0, script.src.lastIndexOf('/') + 1)
    return ''
  }

  getStyles() {
    const base = this.baseUrl
    return `
      @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700&display=swap');
      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-BoldLC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-BoldLC.woff') format('woff');
        font-weight: 700;
        font-display: swap;
      }
      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-MediumLC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-MediumLC.woff') format('woff');
        font-weight: 500;
        font-display: swap;
      }
      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-SemiBoldLC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-SemiBoldLC.woff') format('woff');
        font-weight: 600;
        font-display: swap;
      }
      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-LC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-LC.woff') format('woff');
        font-weight: 400;
        font-display: swap;
      }

      :host {
        display: block;
        --bg: transparent;
        --surface: rgba(255,255,255,0.08);
        --surface2: rgba(255,255,255,0.05);
        --border: rgba(255,255,255,0.15);
        --text: #fff;
        --muted: rgba(255,255,255,0.5);
        --accent: #e85d3a;
        --accent-hover: #ff7a5c;
        --pill-bg: rgba(80,30,20,0.7);
        --pill-active: var(--accent);
        --tag-talks: #e85d3a;
        --tag-live: #d94080;
        --tag-night: #9b3bf5;
        --radius: 100px;
        --radius-card: 16px;
        --font-heading: 'Thunder', Impact, sans-serif;
        --font-body: 'Barlow', sans-serif;
      }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      .root {
        background: var(--bg);
        color: var(--text);
        font-family: var(--font-body);
        min-height: 400px;
      }

      .loading {
        padding: 80px 32px;
        text-align: center;
        color: var(--muted);
        font-family: var(--font-body);
        font-size: 14px;
        font-weight: 500;
      }

      /* ── CATEGORY TABS ── */
      .category-bar {
        display: flex; gap: 10px; padding: 20px 24px;
        overflow-x: auto; flex-wrap: wrap; align-items: center;
      }
      .cat-tab {
        padding: 14px 28px; border: none; background: #111;
        color: #fff; font-family: var(--font-heading); font-size: 18px;
        font-weight: 400; cursor: pointer; transition: all 0.2s;
        white-space: nowrap; text-transform: uppercase; letter-spacing: 1px;
        border-radius: var(--radius);
      }
      .cat-tab:hover { background: transparent; outline: 2px solid #fff; outline-offset: -2px; color: #fff; }
      .cat-tab.active { background: #fff; color: #111; }

      /* ── LAYOUT ── */
      .main { display: grid; grid-template-columns: 280px 1fr; min-height: 600px; gap: 0; }

      /* ── SIDEBAR ── */
      .sidebar {
        padding: 28px 24px;
        position: sticky; top: 0; height: 100vh; overflow-y: auto;
      }
      .results-count {
        font-family: var(--font-body); font-size: 12px; font-weight: 600;
        color: #fff; text-transform: uppercase; margin-bottom: 24px; letter-spacing: 0.5px;
      }
      .results-count strong { color: #fff; font-size: 16px; font-weight: 700; }
      .search-box { position: relative; margin-bottom: 28px; }
      .search-box input {
        width: 100%; background: transparent; border: 2px solid var(--border);
        color: var(--text); padding: 12px 16px 12px 40px; font-family: var(--font-body);
        font-size: 14px; outline: none; transition: border-color 0.2s;
        border-radius: var(--radius);
      }
      .search-box input:focus { border-color: #fff; background: #fff; color: #111; }
      .search-box input:focus + .search-icon, .search-box:focus-within .search-icon { color: #111; }
      .search-box input::placeholder { color: var(--muted); }
      .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 16px; }
      .filter-section { margin-bottom: 28px; }
      .filter-label {
        font-family: var(--font-body); font-size: 11px; font-weight: 700; letter-spacing: 1px;
        text-transform: uppercase; color: #fff; margin-bottom: 12px;
        display: flex; justify-content: space-between; align-items: center;
      }
      .filter-label button { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 16px; display: none; }
      .filter-label button:hover { color: #fff; }

      /* ── DATE BUTTONS ── */
      .date-grid { display: flex; gap: 8px; }
      .date-btn {
        padding: 12px 18px; border: none; background: #111;
        color: #fff; font-family: var(--font-heading); font-size: 16px; font-weight: 400;
        cursor: pointer; text-align: center; transition: all 0.2s; line-height: 1.4;
        border-radius: var(--radius);
      }
      .date-btn:hover { background: transparent; outline: 2px solid #fff; outline-offset: -2px; color: #fff; }
      .date-btn.active { background: #fff; color: #111; }
      .date-btn .day-name { display: block; font-size: 18px; font-weight: 400; text-transform: uppercase; letter-spacing: 1px; }
      .date-btn .day-num { display: block; font-size: 12px; opacity: 0.7; margin-top: 2px; font-family: var(--font-body); font-weight: 500; }

      /* ── LOCATION ── */
      .location-list { display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow-y: auto; }
      .loc-btn {
        padding: 8px 14px; border: none; background: transparent;
        color: rgba(255,255,255,0.7); font-family: var(--font-body); font-size: 13px; font-weight: 500;
        cursor: pointer; text-align: left; transition: all 0.2s;
        display: flex; align-items: center; gap: 10px;
        border-radius: 8px;
      }
      .loc-btn::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.3); flex-shrink: 0; transition: all 0.2s; }
      .loc-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }
      .loc-btn.active { color: #fff; font-weight: 700; background: rgba(255,255,255,0.1); }
      .loc-btn.active::before { background: #fff; }

      /* ── TIME DIVIDER ── */
      .time-divider {
        background: rgba(0,0,0,0.3); backdrop-filter: blur(10px);
        padding: 14px 32px; font-family: var(--font-body); font-size: 13px; font-weight: 600;
        letter-spacing: 1px; color: var(--text); display: flex; align-items: center; gap: 12px;
        position: sticky; top: 0; z-index: 10; text-transform: uppercase;
      }
      .time-divider::before { display: none; }
      .time-divider.has-live { color: #fff; }

      .live-badge {
        display: inline-flex; align-items: center; gap: 6px;
        background: #e53935; color: #fff; padding: 3px 10px;
        border-radius: var(--radius); font-size: 11px; font-weight: 700;
        letter-spacing: 1px; margin-right: 8px; animation: livePulse 1.5s infinite;
      }
      .live-badge::before {
        content: ''; width: 6px; height: 6px; background: #fff;
        border-radius: 50%;
      }
      @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

      .meta-live {
        display: inline-flex; align-items: center; gap: 5px;
        color: #e53935; font-family: var(--font-body); font-size: 10px;
        font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
      }
      .live-dot {
        width: 6px; height: 6px; background: #e53935; border-radius: 50%;
        animation: liveDot 1.5s infinite;
      }
      @keyframes liveDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.7)} }

      .event-live { background: rgba(229,57,53,0.06); }

      .hero-live { border-color: #e53935; }
      .hero-live::before { background: #e53935; }
      .detail-live-badge {
        display: inline-flex; align-items: center; gap: 8px;
        background: #e53935; color: #fff; padding: 6px 16px;
        border-radius: var(--radius); font-family: var(--font-body);
        font-size: 13px; font-weight: 700; letter-spacing: 1px;
        text-transform: uppercase; margin-bottom: 16px;
        animation: livePulse 1.5s infinite;
      }
      .detail-live-dot {
        width: 8px; height: 8px; background: #fff; border-radius: 50%;
        display: inline-block; animation: liveDot 1.5s infinite;
      }

      .map-container {
        border-radius: var(--radius-card); overflow: hidden;
        border: 1px solid var(--border); margin-top: 8px;
      }
      .map-container iframe {
        width: 100%; height: 280px; border: none; display: block;
        filter: grayscale(0.3);
      }

      /* ── EVENT CARD ── */
      .event-card {
        display: grid; grid-template-columns: 90px 1fr auto; gap: 20px; align-items: start;
        padding: 20px 32px;
        border-bottom: 1px solid var(--border);
        transition: all 0.2s; cursor: pointer; color: inherit;
      }
      .event-card:hover { background: var(--surface); }
      .event-card:hover .event-title { color: var(--accent-hover); }
      .event-img {
        width: 90px; height: 90px; object-fit: cover; background: var(--surface);
        display: flex; align-items: center; justify-content: center; font-size: 32px;
        flex-shrink: 0; border-radius: 12px; overflow: hidden;
      }
      img.event-img { display: block; border-radius: 12px; }
      .event-meta { display: flex; gap: 16px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
      .meta-item {
        font-family: var(--font-body); font-size: 11px; font-weight: 500;
        color: var(--muted); text-transform: uppercase; display: flex; align-items: center; gap: 4px;
      }
      .meta-item svg { opacity: 0.5; }
      .event-title {
        font-family: var(--font-heading); font-size: 28px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 1px;
        margin-bottom: 4px; transition: color 0.2s; line-height: 1;
      }
      .event-subtitle {
        font-size: 12px; color: var(--muted); font-weight: 500;
        margin-bottom: 10px; font-family: var(--font-body);
      }
      .event-tags { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
      .tag {
        padding: 4px 12px; font-family: var(--font-body); font-size: 10px; font-weight: 600;
        letter-spacing: 0.5px; text-transform: uppercase; border-radius: var(--radius);
      }
      .tag-talks { background: #111; color: #fff; }
      .tag-live { background: #111; color: #fff; }
      .tag-night { background: #111; color: #fff; }
      .tag-type { background: var(--surface); color: var(--muted); }

      /* ── FAVORITE BUTTONS ── */
      .fav-btn {
        background: none; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.3);
        width: 40px; height: 40px; border-radius: 50%; cursor: pointer;
        font-size: 18px; display: flex; align-items: center; justify-content: center;
        transition: all 0.2s; flex-shrink: 0; align-self: center;
      }
      .fav-btn:hover { border-color: #fff; color: #fff; }
      .fav-btn.fav-active { background: #fff; border-color: #fff; color: #111; }

      .back-bar { display: flex; align-items: center; justify-content: space-between; }
      .detail-fav-btn {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 10px 24px; background: #111; border: none; color: #fff;
        font-family: var(--font-heading); font-size: 16px; font-weight: 400;
        text-transform: uppercase; letter-spacing: 1px;
        border-radius: var(--radius); cursor: pointer; transition: all 0.2s;
      }
      .detail-fav-btn:hover { background: transparent; outline: 2px solid #fff; outline-offset: -2px; }
      .detail-fav-btn.fav-active { background: #fff; color: #111; }
      .detail-fav-icon { font-size: 14px; }

      .cat-tab-fav { margin-left: auto; }

      .active-tag-bar {
        padding: 12px 24px; background: rgba(255,255,255,0.1);
        font-family: var(--font-body); font-size: 13px; font-weight: 500;
        color: rgba(255,255,255,0.7); display: flex; align-items: center; gap: 12px;
      }
      .active-tag-bar strong { color: #fff; font-weight: 700; }
      .active-tag-bar button {
        background: none; border: none; color: rgba(255,255,255,0.5);
        font-size: 16px; cursor: pointer; transition: color 0.2s;
        margin-left: 4px;
      }
      .active-tag-bar button:hover { color: #fff; }

      .route-btn {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 12px 24px; background: #111; color: #fff;
        font-family: var(--font-heading); font-size: 16px; font-weight: 400;
        text-transform: uppercase; letter-spacing: 1px;
        text-decoration: none; border-radius: var(--radius);
        transition: all 0.2s; margin-top: 16px; cursor: pointer;
      }
      .route-btn:hover { background: transparent; outline: 2px solid #fff; outline-offset: -2px; }
      .route-btn svg { flex-shrink: 0; }

      .sidebar-tag-clickable { cursor: pointer; }
      .sidebar-tag-clickable:hover { background: rgba(255,255,255,0.15); color: #fff; border-color: rgba(255,255,255,0.4); }
      .mobile-fav-btn {
        width: 46px; height: 46px; border: none; background: #111; color: rgba(255,255,255,0.4);
        font-size: 20px; border-radius: 50%; cursor: pointer; transition: all 0.2s;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .mobile-fav-btn:hover { background: transparent; outline: 2px solid #fff; outline-offset: -2px; color: #fff; }
      .mobile-fav-btn.fav-active { background: #fff; color: #111; }

      .empty-state { padding: 80px 32px; text-align: center; color: var(--muted); }
      .empty-state h3 { font-family: var(--font-heading); font-size: 42px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; color: rgba(255,255,255,0.2); }
      .empty-state p { font-family: var(--font-body); font-size: 14px; }

      /* ── DETAIL VIEW ── */
      .back-bar { padding: 20px 40px; }
      .back-btn {
        display: inline-flex; align-items: center; gap: 10px;
        font-family: var(--font-body); font-size: 13px; font-weight: 600;
        text-transform: uppercase; color: var(--muted); cursor: pointer;
        background: var(--pill-bg); border: none; padding: 10px 24px;
        border-radius: var(--radius); transition: all 0.2s; letter-spacing: 0.5px;
      }
      .back-btn:hover { background: var(--accent); color: #fff; }
      .back-btn:hover svg { transform: translateX(-3px); }
      .back-btn svg { transition: transform 0.2s; }

      .detail-page {
        display: grid; grid-template-columns: 1fr 360px; gap: 0;
        max-width: 1200px; margin: 0 auto; padding: 48px 40px; align-items: start;
      }
      .detail-left { padding-right: 64px; }

      .hero-image {
        border-radius: var(--radius-card); overflow: hidden; margin-bottom: 24px;
        border: 1px solid var(--border);
      }
      .hero-image img {
        width: 100%; height: 300px; object-fit: cover; display: block;
      }

      .hero {
        background: var(--surface); backdrop-filter: blur(10px);
        border: 1px solid var(--border); border-radius: var(--radius-card);
        padding: 40px; margin-bottom: 32px; position: relative; overflow: hidden;
      }
      .hero::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--accent); border-radius: 2px; }

      .event-title-detail {
        font-family: var(--font-heading); font-size: 56px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 2px;
        line-height: 1; margin-bottom: 24px;
      }
      .event-meta-row { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 8px; }

      .speakers-section { margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
      .speaker-card {
        display: flex; align-items: center; gap: 16px;
        background: var(--surface2); border: 1px solid var(--border);
        padding: 16px 20px; border-radius: 12px;
      }
      .speaker-avatar {
        width: 64px; height: 64px; background: var(--surface); border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; flex-shrink: 0; overflow: hidden;
      }
      .speaker-avatar img {
        width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
      }
      .speaker-name { font-family: var(--font-heading); font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
      .speaker-role { font-size: 12px; color: var(--muted); font-family: var(--font-body); font-weight: 500; }

      .section { margin-top: 40px; }
      .section-title {
        font-family: var(--font-heading); font-size: 28px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 2px;
        margin-bottom: 16px; color: var(--text); display: flex; align-items: center; gap: 12px;
      }
      .section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }
      .description { font-size: 15px; line-height: 1.75; color: rgba(255,255,255,0.7); max-width: 680px; }

      /* ── DETAIL SIDEBAR ── */
      .detail-sidebar { position: sticky; top: 20px; }
      .sidebar-card {
        background: var(--surface); backdrop-filter: blur(10px);
        border: 1px solid var(--border); border-radius: var(--radius-card);
        padding: 28px; margin-bottom: 16px;
      }
      .sidebar-heading {
        font-family: var(--font-heading); font-size: 24px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 2px;
        margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border);
      }
      .detail-row {
        display: flex; justify-content: space-between; align-items: baseline;
        padding: 11px 0; border-bottom: 1px solid var(--border); gap: 16px;
      }
      .detail-row:last-child { border-bottom: none; }
      .detail-key {
        font-family: var(--font-body); font-size: 11px; font-weight: 600; letter-spacing: 1px;
        text-transform: uppercase; color: var(--muted); flex-shrink: 0;
      }
      .detail-val {
        font-family: var(--font-body); font-size: 13px; font-weight: 600;
        text-transform: uppercase; color: var(--text); text-align: right;
      }
      .tags-list { display: flex; flex-wrap: wrap; gap: 8px; }
      .sidebar-tag {
        padding: 6px 14px; background: var(--surface2); border: 1px solid var(--border);
        font-family: var(--font-body); font-size: 11px; font-weight: 500;
        text-transform: uppercase; color: var(--muted); cursor: default;
        border-radius: var(--radius); transition: all 0.2s;
      }

      /* ── RELATED EVENTS ── */
      .related-event {
        display: grid; grid-template-columns: 60px 1fr; gap: 16px;
        padding: 16px 0; border-bottom: 1px solid var(--border);
        cursor: pointer; transition: all 0.2s; color: inherit;
      }
      .related-event:hover .related-title { color: var(--accent-hover); }
      .related-img {
        width: 60px; height: 60px; background: var(--surface);
        border-radius: 10px; display: flex; align-items: center; justify-content: center;
        font-size: 22px; flex-shrink: 0;
      }
      .related-meta {
        font-family: var(--font-body); font-size: 10px; font-weight: 500;
        color: var(--muted); text-transform: uppercase; margin-bottom: 4px;
      }
      .related-title {
        font-family: var(--font-heading); font-size: 20px; font-weight: 700;
        text-transform: uppercase; transition: color 0.2s; line-height: 1;
      }
      .related-tag {
        display: inline-block; margin-top: 6px; padding: 3px 10px;
        font-family: var(--font-body); font-size: 9px; font-weight: 600;
        text-transform: uppercase; border-radius: var(--radius);
      }

      /* ── MOBILE DROPDOWNS ── */
      .mobile-only { display: none; }
      .mobile-filters { display: none; gap: 8px; flex-wrap: wrap; }
      .mobile-select {
        flex: 1; padding: 12px 16px; background: var(--pill-bg);
        color: var(--text); border: 2px solid var(--border); border-radius: var(--radius);
        font-family: var(--font-body); font-size: 13px; font-weight: 600;
        text-transform: uppercase; cursor: pointer; outline: none;
        appearance: none; -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 14px center;
        padding-right: 36px;
      }
      .mobile-select:focus { border-color: var(--accent); }
      .mobile-select option { background: #2a1a14; color: var(--text); }

      /* ── SCROLLBAR ── */
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      .location-list::-webkit-scrollbar { width: 8px; }
      .location-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 4px; }
      .location-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }
      .location-list { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) transparent; }

      /* ── MOBILE ── */
      @media (max-width: 768px) {
        .category-bar { padding: 12px 16px; gap: 6px; }
        .cat-tab { padding: 8px 16px; font-size: 11px; }
        .main { grid-template-columns: 1fr; }
        .sidebar { position: static; height: auto; padding: 16px; }
        .desktop-only { display: none; }
        .mobile-only { display: block; }
        .mobile-filters { display: flex; }
        .event-card { grid-template-columns: 70px 1fr auto; gap: 14px; padding: 16px 16px; }
        .fav-btn { width: 34px; height: 34px; font-size: 14px; }
        .event-img { width: 70px; height: 70px; font-size: 24px; }
        img.event-img { width: 70px; height: 70px; }
        .event-title { font-size: 22px; }
        .event-meta { gap: 8px; }
        .meta-item { font-size: 9px; }
        .time-divider { padding: 12px 16px; font-size: 12px; }
        .back-bar { padding: 16px 16px; }
        .detail-page { grid-template-columns: 1fr; padding: 20px 16px; }
        .detail-left { padding-right: 0; margin-bottom: 32px; }
        .event-title-detail { font-size: 34px; }
        .hero { padding: 24px; }
        .detail-sidebar { position: static; }
        .results-count { margin-bottom: 16px; }
        .search-box { margin-bottom: 16px; }
      }
    `
  }
}

customElements.define('turf-programma', TurfProgramma)

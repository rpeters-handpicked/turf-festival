class TurfProgrammaV2 extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.events = []
    this.tracks = []
    this.locations = []
    this.activeDay = null
    this.activeCat = 'all'
    this.activeLocations = new Set()
    this.activeTrack = null
    this.showFavoritesOnly = false
    this.searchQuery = ''
    this.currentView = 'list'
    this.scrollPos = 0
    this.locDropdownOpen = false
    this.trackDropdownOpen = false
  }

  // ─── FAVORITES ──────────────────────────────────────────────────────────────
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
    const cfg = typeof TURF_CONFIG !== 'undefined' ? TURF_CONFIG : {}
    return cfg.devTime ? new Date(cfg.devTime) : new Date()
  }

  isEventLive(e) {
    const now = this.getNow()
    const cfg = typeof TURF_CONFIG !== 'undefined' ? TURF_CONFIG : {}
    const dagDate = cfg.festivalDates || { dag1: '2026-11-26', dag2: '2026-11-27', dag3: '2026-11-28' }
    const dateStr = dagDate[e.dag]
    if (!dateStr || !e.startTime) return false
    const start = new Date(`${dateStr}T${e.startTime}:00`)
    const end = e.endTime ? new Date(`${dateStr}T${e.endTime}:00`) : new Date(start.getTime() + 2 * 3600000)
    if (end <= start) end.setDate(end.getDate() + 1)
    return now >= start && now < end
  }

  get cfg() { return typeof TURF_CONFIG !== 'undefined' ? TURF_CONFIG : {} }
  get routeUrl() { return this.getAttribute('route-url') || this.cfg.routeUrl || '/route' }
  get projectId() { return this.getAttribute('project-id') || this.cfg.sanityProjectId || 'x545nfex' }
  get dataset() { return this.getAttribute('dataset') || this.cfg.sanityDataset || 'production' }
  get cdnUrl() { return `https://${this.projectId}.api.sanity.io/v2024-01-01/data/query/${this.dataset}` }

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
      loading:          en ? 'Loading programme…'              : 'Programma laden...',
      loadingEvent:     en ? 'Loading event…'                   : 'Event laden...',
      allEvents:        en ? 'All Events'                       : 'Alle Events',
      favorites:        '★ Favorites',
      showing:          en ? 'SHOWING'                          : 'GEVONDEN',
      results:          en ? 'RESULTS'                          : 'RESULTATEN',
      searchPlaceholder: en ? '⌕ Search by name, speaker, artist' : '⌕ Zoek op naam, spreker, artiest',
      allDays:          en ? 'All days'                         : 'Alle dagen',
      noEvents:         en ? 'No Events Found'                  : 'Geen Events Gevonden',
      adjustFilters:    en ? 'Adjust your filters'              : 'Pas je filters aan',
      backBtn:          en ? 'Back to programme'                : 'Terug naar programma',
      saved:            en ? 'Saved'                            : 'Opgeslagen',
      favorite:         en ? 'Favorite'                         : 'Favoriet',
      aboutEvent:       en ? 'About this event'                 : 'Over dit event',
      locationSection:  en ? 'Location'                         : 'Locatie',
      otherEvents:      en ? 'Other events at this location'    : 'Andere events op deze locatie',
      noOtherEvents:    en ? 'No other events at this location' : 'Geen andere events op deze locatie',
      thema:            en ? 'Theme'                            : 'Thema',
      typeLabel:        'Type',
      dagLabel:         en ? 'Day'                              : 'Dag',
      tijdLabel:        en ? 'Time'                             : 'Tijd',
      locatieLabel:     en ? 'Location'                         : 'Locatie',
      accessLabel:      en ? 'Access'                           : 'Toegang',
      freeAccess:       en ? 'Free'                             : 'Gratis',
      tags:             'Tags',
      allLocations:     en ? 'All Locations'                    : 'Alle Locaties',
      allTracks:        en ? 'All Tracks'                       : 'Alle Tracks',
      tracks:           en ? 'TRACKS'                           : 'TRACKS',
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

  async connectedCallback() {
    this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="root"><div class="loading">${this.ui.loading}</div></div>`

    await this.loadData()

    const urlParams = new URLSearchParams(window.location.search)
    const locationParam = urlParams.get('location')
    if (locationParam) this.activeLocations.add(locationParam)

    const hash = window.location.hash.slice(1)
    if (hash) {
      await this.renderDetail(hash)
    } else {
      this.renderList()
    }

    window.addEventListener('hashchange', () => {
      const id = window.location.hash.slice(1)
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

  // ─── DATA ───────────────────────────────────────────────────────────────────

  async loadData() {
    const [rawEvents, rawTracks] = await Promise.all([
      this.sanityFetch(`*[_type == "event" && gepubliceerd == true] | order(dag asc, startTijd asc) {
        _id,
        "titel": ${this.localeField('titel')},
        "ondertitel": ${this.localeField('ondertitel')},
        dag, startTijd, eindTijd, type, tags,
        prioriteit,
        "themaSlug": thema->slug,
        "themaNaam": thema->naam,
        "locatieNaam": locatie->naam,
        "locatieRef": locatie._ref,
        "afbeelding": afbeelding.asset->url,
        "sprekerNamen": sprekers[]->naam,
        "trackSlug": track->slug.current,
        "trackNaam": ${this.localeField('track->naam')}
      }`),
      this.sanityFetch(`*[_type == "track" && gepubliceerd == true] | order(naam.nl asc) {
        "slug": slug.current,
        "naam": ${this.localeField('naam')},
        dag, kleur
      }`)
    ])

    this.events = (rawEvents || []).map(e => ({
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
      priority: e.prioriteit || 1,
      speakers: (e.sprekerNamen || []).filter(Boolean),
      trackSlug: e.trackSlug || null,
      trackNaam: e.trackNaam || '',
    }))

    this.tracks = (rawTracks || [])
    this.locations = [...new Set(this.events.map(e => e.location))].filter(Boolean).sort()
  }

  _shuffleGroups(arr) {
    const result = []
    let i = 0
    while (i < arr.length) {
      let j = i + 1
      while (j < arr.length && arr[j].dag === arr[i].dag && (arr[j].priority || 1) === (arr[i].priority || 1)) j++
      const group = arr.slice(i, j)
      for (let k = group.length - 1; k > 0; k--) {
        const m = Math.floor(Math.random() * (k + 1));
        [group[k], group[m]] = [group[m], group[k]]
      }
      result.push(...group)
      i = j
    }
    return result
  }

  // ─── LIST VIEW ──────────────────────────────────────────────────────────────

  renderList() {
    this.currentView = 'list'
    const locCount = this.locations.length
    const activeLocLabel = this.activeLocations.size > 0
      ? `${this.activeLocations.size} LOCATIE${this.activeLocations.size !== 1 ? 'S' : ''} ↓`
      : `ALLE ${locCount} LOCATIES ↓`
    const activeTrackLabel = this.activeTrack
      ? `${(this.tracks.find(t => t.slug === this.activeTrack)?.naam || this.activeTrack).toUpperCase()} ↓`
      : `${this.ui.tracks} ↓`

    const root = this.shadowRoot.querySelector('.root')
    root.innerHTML = `
      <nav class="top-nav">
        <!-- Row 1: Days + Search -->
        <div class="nav-row nav-row-days">
          <div class="day-filters" role="group">
            <button class="day-btn ${this.activeDay === '1' ? 'active' : ''}" data-day="1">
              <span class="day-name">${this.dagLabels.dag1.name}</span><span class="day-date">${this.dagLabels.dag1.date}</span>
            </button>
            <button class="day-btn ${this.activeDay === '2' ? 'active' : ''}" data-day="2">
              <span class="day-name">${this.dagLabels.dag2.name}</span><span class="day-date">${this.dagLabels.dag2.date}</span>
            </button>
            <button class="day-btn ${this.activeDay === '3' ? 'active' : ''}" data-day="3">
              <span class="day-name">${this.dagLabels.dag3.name}</span><span class="day-date">${this.dagLabels.dag3.date}</span>
            </button>
          </div>
          <div class="search-wrap">
            <input type="text" id="search" class="search-input" placeholder="${this.ui.searchPlaceholder}" value="${this.searchQuery}" autocomplete="off">
            <button id="search-clear" class="search-clear" aria-label="Wis zoekopdracht" style="display:${this.searchQuery ? 'flex' : 'none'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Row 2: Theme pills + dropdowns + results/fav -->
        <div class="nav-row nav-row-filters">
          <div class="theme-filters" role="group">
            <button class="theme-btn ${this.activeCat === 'all' ? 'active' : ''}" data-cat="all">
              <span class="dot dot-all"></span>${this.ui.allEvents}
            </button>
            <button class="theme-btn ${this.activeCat === 'talks' ? 'active' : ''}" data-cat="talks">
              <span class="dot dot-talks"></span>TURF TALKS
            </button>
            <button class="theme-btn ${this.activeCat === 'live' ? 'active' : ''}" data-cat="live">
              <span class="dot dot-live"></span>TURF LIVE
            </button>
            <button class="theme-btn ${this.activeCat === 'night' ? 'active' : ''}" data-cat="night">
              <span class="dot dot-night"></span>TURF BY NIGHT
            </button>
          </div>

          <div class="filter-divider">|</div>

          <div class="dropdown-group">
            <div class="dropdown" id="locDropdown">
              <button class="dropdown-btn ${this.activeLocations.size > 0 ? 'active' : ''}" id="locBtn">${activeLocLabel}</button>
              <div class="dropdown-panel" id="locPanel">
                <label class="dropdown-option ${this.activeLocations.size === 0 ? 'selected' : ''}" id="clearLocOption">
                  <span class="option-check">${this.activeLocations.size === 0 ? '✓' : ''}</span>
                  ${this.ui.allLocations}
                </label>
                ${this.locations.map(loc => `
                  <label class="dropdown-option ${this.activeLocations.has(loc) ? 'selected' : ''}" data-loc="${loc}">
                    <span class="option-check">${this.activeLocations.has(loc) ? '✓' : ''}</span>
                    ${loc}
                  </label>`).join('')}
              </div>
            </div>

            ${this.tracks.length > 0 ? `
            <div class="dropdown" id="trackDropdown">
              <button class="dropdown-btn ${this.activeTrack ? 'active' : ''}" id="trackBtn">${activeTrackLabel}</button>
              <div class="dropdown-panel" id="trackPanel">
                <label class="dropdown-option ${!this.activeTrack ? 'selected' : ''}" id="clearTrackOption">
                  <span class="option-check">${!this.activeTrack ? '✓' : ''}</span>
                  ${this.ui.allTracks}
                </label>
                ${this.tracks.map(t => `
                  <label class="dropdown-option ${this.activeTrack === t.slug ? 'selected' : ''}" data-track="${t.slug}">
                    <span class="option-check">${this.activeTrack === t.slug ? '✓' : ''}</span>
                    ${t.naam}
                  </label>`).join('')}
              </div>
            </div>` : ''}
          </div>

          <div class="nav-spacer"></div>

          <div class="results-fav">
            <span class="results-count"><span id="count">0</span> ${this.ui.results}</span>
            <button class="fav-btn-top ${this.showFavoritesOnly ? 'active' : ''}" id="favFilter">★ FAVORITES</button>
          </div>
        </div>
      </nav>

      <main class="event-list" id="eventList"></main>
    `

    this.bindNavEvents()
    this.applyFilters()

    if (this.scrollPos) {
      root.querySelector('.event-list')?.scrollTo(0, this.scrollPos)
    }
  }

  bindNavEvents() {
    const root = this.shadowRoot

    // Day buttons
    root.querySelectorAll('.day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = btn.dataset.day
        if (this.activeDay === day) {
          this.activeDay = null
          btn.classList.remove('active')
        } else {
          root.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'))
          this.activeDay = day
          btn.classList.add('active')
        }
        this.applyFilters()
      })
    })

    // Theme pills
    root.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        this.activeCat = btn.dataset.cat
        this.showFavoritesOnly = false
        root.getElementById('favFilter')?.classList.remove('active')
        this.applyFilters()
      })
    })

    // Search
    root.getElementById('search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value
      const btn = root.getElementById('search-clear')
      if (btn) btn.style.display = this.searchQuery ? 'flex' : 'none'
      this.applyFilters()
    })

    root.getElementById('search-clear')?.addEventListener('click', () => {
      this.searchQuery = ''
      const inp = root.getElementById('search')
      if (inp) inp.value = ''
      root.getElementById('search-clear').style.display = 'none'
      this.applyFilters()
    })

    // Favorites
    root.getElementById('favFilter')?.addEventListener('click', () => {
      this.showFavoritesOnly = !this.showFavoritesOnly
      root.getElementById('favFilter').classList.toggle('active', this.showFavoritesOnly)
      if (this.showFavoritesOnly) {
        this.activeCat = 'all'
        root.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'))
        root.querySelector('.theme-btn[data-cat="all"]')?.classList.add('active')
      }
      this.applyFilters()
    })

    // Location dropdown
    const locBtn = root.getElementById('locBtn')
    const locPanel = root.getElementById('locPanel')
    locBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.locDropdownOpen = !this.locDropdownOpen
      this.trackDropdownOpen = false
      locPanel?.classList.toggle('open', this.locDropdownOpen)
      root.getElementById('trackPanel')?.classList.remove('open')
    })

    // Stop wheel events from bubbling to Lenis (smooth scroll library on host page)
    locPanel?.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })
    locPanel?.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true })

    root.getElementById('clearLocOption')?.addEventListener('click', () => {
      this.activeLocations.clear()
      this.locDropdownOpen = false
      locPanel?.classList.remove('open')
      this.renderList()
    })

    locPanel?.querySelectorAll('[data-loc]').forEach(opt => {
      opt.addEventListener('click', () => {
        const loc = opt.dataset.loc
        if (this.activeLocations.has(loc)) {
          this.activeLocations.delete(loc)
        } else {
          this.activeLocations.add(loc)
        }
        this.locDropdownOpen = false
        locPanel?.classList.remove('open')
        this.renderList()
      })
    })

    // Track dropdown
    const trackBtn = root.getElementById('trackBtn')
    const trackPanel = root.getElementById('trackPanel')
    trackBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.trackDropdownOpen = !this.trackDropdownOpen
      this.locDropdownOpen = false
      trackPanel?.classList.toggle('open', this.trackDropdownOpen)
      locPanel?.classList.remove('open')
    })

    trackPanel?.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })
    trackPanel?.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true })

    root.getElementById('clearTrackOption')?.addEventListener('click', () => {
      this.activeTrack = null
      this.trackDropdownOpen = false
      trackPanel?.classList.remove('open')
      this.renderList()
    })

    trackPanel?.querySelectorAll('[data-track]').forEach(opt => {
      opt.addEventListener('click', () => {
        this.activeTrack = opt.dataset.track
        this.trackDropdownOpen = false
        trackPanel?.classList.remove('open')
        this.renderList()
      })
    })

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      this.locDropdownOpen = false
      this.trackDropdownOpen = false
      locPanel?.classList.remove('open')
      trackPanel?.classList.remove('open')
    }, { once: false })
    root.querySelector('.top-nav')?.addEventListener('click', (e) => e.stopPropagation())
  }

  applyFilters() {
    const q = this.searchQuery.toLowerCase()
    const favs = this.showFavoritesOnly ? this.getFavorites() : null
    const filtered = this.events.filter(e => {
      if (favs && !favs.includes(e._id)) return false
      if (this.activeDay && e.day !== this.activeDay) return false
      if (this.activeCat !== 'all' && e.theme !== this.activeCat) return false
      if (this.activeLocations.size > 0 && !this.activeLocations.has(e.location)) return false
      if (this.activeTrack && e.trackSlug !== this.activeTrack) return false
      if (q && !e.title.toLowerCase().includes(q) && !e.location.toLowerCase().includes(q) && !(e.speakers && e.speakers.some(s => s.toLowerCase().includes(q))) && !(e.tags && e.tags.some(t => t.toLowerCase().includes(q)))) return false
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
      container.innerHTML = `<div class="empty-state"><h3>${this.ui.noEvents}</h3><p>${this.ui.adjustFilters}</p></div>`
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
          ? `<img class="event-img" src="${e.image}?w=400&h=400&fit=crop" alt="${e.title}">`
          : `<div class="event-img-placeholder">${this.themaLabels[e.theme]?.[0] || '◈'}</div>`
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
            ${e.speakers.length > 0 ? `<div class="event-speakers">${e.speakers.join(' · ')}</div>` : ''}
            <div class="event-tags">
              <span class="tag ${this.tagClass[e.theme]}">${this.themaLabels[e.theme] || e.themeName}</span>
              ${e.type ? `<span class="tag tag-type">${e.type}</span>` : ''}
              ${e.trackNaam ? `<span class="tag tag-track">${e.trackNaam}</span>` : ''}
            </div>
          </div>
          <button class="fav-btn ${this.isFavorite(e._id) ? 'fav-active' : ''}" data-fav="${e._id}" title="Favorite">★</button>
        </div>`
      }).join('')}`
    }).join('')

    container.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const isFav = this.toggleFavorite(btn.dataset.fav)
        btn.classList.toggle('fav-active', isFav)
        if (this.showFavoritesOnly) this.applyFilters()
      })
    })

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
      ? `<div class="sidebar-card"><div class="sidebar-heading">${this.ui.tags}</div><div class="tags-list">${e.tags.map(t => `<span class="sidebar-tag" data-tag="${t}">${t}</span>`).join('')}</div></div>`
      : ''

    const beschrijving = e.beschrijving
      ? e.beschrijving.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')
      : ''

    const detailLiveData = { _id: e._id, dag: e.dag, startTime: e.startTijd, endTime: e.eindTijd }
    const isLive = this.isEventLive(detailLiveData)

    const mapQuery = encodeURIComponent(`${e.locatieNaam}${e.locatieAdres ? ', ' + e.locatieAdres : ', Breda'}`)
    const mapsKey = this.cfg.googleMapsApiKey || 'AIzaSyBKtiBfiuLmG_td0BKfK6XABATDe8P1YPw'
    const mapHtml = `<div class="map-container"><iframe src="https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${mapQuery}&zoom=15" allowfullscreen loading="lazy"></iframe></div>`

    root.innerHTML = `
      <div class="back-bar">
        <button class="back-btn" id="backBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
          ${this.ui.backBtn}
        </button>
        <button class="detail-fav-btn ${this.isFavorite(eventId) ? 'fav-active' : ''}" id="detailFav">
          <span class="detail-fav-icon">★</span>
          <span class="detail-fav-label">${this.isFavorite(eventId) ? this.ui.saved : this.ui.favorite}</span>
        </button>
      </div>
      <div class="detail-page">
        <div class="detail-left">
          ${e.afbeelding ? `<div class="hero-image"><img src="${e.afbeelding}?w=800&h=400&fit=crop" alt="${e.titel}"></div>` : ''}
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

    root.querySelectorAll('.sidebar-tag[data-tag]').forEach(tag => {
      tag.addEventListener('click', () => {
        window.history.pushState(null, '', window.location.pathname + window.location.search)
        this.renderList()
      })
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
            window.history.pushState(null, '', `#${el.dataset.id}`)
            this.renderDetail(el.dataset.id)
          })
        })
      } else if (relatedList) {
        relatedList.innerHTML = `<p style="color:var(--muted);font-size:20px;">${this.ui.noOtherEvents}</p>`
      }
    }

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
        font-weight: 700; font-display: swap;
      }
      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-MediumLC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-MediumLC.woff') format('woff');
        font-weight: 500; font-display: swap;
      }
      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-SemiBoldLC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-SemiBoldLC.woff') format('woff');
        font-weight: 600; font-display: swap;
      }
      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-LC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-LC.woff') format('woff');
        font-weight: 400; font-display: swap;
      }

      :host {
        display: block;
        height: auto;
        --bg: transparent;
        --surface: rgba(255,255,255,0.08);
        --surface2: rgba(255,255,255,0.05);
        --border: rgba(255,255,255,0.2);
        --text: #fff;
        --muted: rgba(255,255,255,0.5);
        --accent: #e85d3a;
        --accent-hover: #ff7a5c;
        --accent-lime: #c8f04a;
        --tag-talks: #e85d3a;
        --tag-live: #d94080;
        --tag-night: #9b3bf5;
        --radius: 100px;
        --radius-card: 16px;
        --font-heading: 'Thunder', Impact, sans-serif;
        --font-body: 'Barlow', sans-serif;
        --nav-bg: rgba(0,0,0,0.85);
      }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      .root {
        background: var(--nav-bg);
        color: var(--text);
        font-family: var(--font-body);
        display: flex;
        flex-direction: column;
        border-radius: 20px;
        overflow: clip;
      }

      /* ── LOADING ── */
      .loading {
        padding: 80px 32px; text-align: center;
        color: var(--muted); font-size: 21px; font-weight: 500;
      }

      /* ────────────────────────────────────────
         TOP NAV
      ──────────────────────────────────────── */
      .top-nav {
        background: rgba(0,0,0,0.8);
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
        position: sticky; top: 100px; z-index: 100;
      }

      .nav-row {
        display: flex; align-items: center; gap: 8px;
        padding: 0 20px;
      }

      /* Row 1: days + search */
      .nav-row-days {
        padding-top: 14px; padding-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        flex-wrap: wrap; gap: 8px;
      }

      .day-filters {
        display: flex; gap: 6px; flex-wrap: nowrap;
        overflow-x: auto; -webkit-overflow-scrolling: touch;
        scrollbar-width: none; flex: 0 0 auto;
      }
      .day-filters::-webkit-scrollbar { display: none; }

      .day-btn {
        display: flex; align-items: center; gap: 6px;
        padding: 8px 18px; border: 1.5px solid var(--border);
        background: transparent; color: var(--text);
        font-family: var(--font-heading); font-size: 26px; font-weight: 600;
        cursor: pointer; transition: all 0.15s; white-space: nowrap;
        border-radius: var(--radius); letter-spacing: 0.5px;
        line-height: 1;
      }
      .day-btn .day-name { font-weight: 700; text-transform: uppercase; }
      .day-btn .day-date { font-weight: 400; opacity: 0.7; font-size: 21px; }
      .day-btn:hover { border-color: #fff; background: rgba(255,255,255,0.08); }
      .day-btn.active { background: #fff; color: #111; border-color: #fff; }
      .day-btn.active .day-date { opacity: 0.6; }

      .search-wrap {
        flex: 1; min-width: 180px; max-width: 340px; margin-left: auto;
        position: relative;
      }
      .search-input {
        width: 100%; background: var(--surface);
        border: 1.5px solid var(--border); color: var(--text);
        padding: 8px 40px 8px 16px; font-family: var(--font-body);
        font-size: 20px; font-weight: 400; outline: none;
        transition: border-color 0.15s, background 0.15s;
        border-radius: var(--radius);
      }
      .search-input::placeholder { color: var(--muted); }
      .search-input:focus { border-color: #fff; background: #fff; color: #111; }
      .search-input:focus::placeholder { color: #999; }
      .search-clear {
        position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
        background: none; border: none; cursor: pointer; padding: 4px;
        color: var(--muted); display: flex; align-items: center; justify-content: center;
        border-radius: 50%; transition: color 0.15s, background 0.15s;
      }
      .search-clear:hover { color: var(--text); background: var(--surface); }
      .search-input:focus ~ .search-clear { color: #999; }
      .search-input:focus ~ .search-clear:hover { color: #111; background: rgba(0,0,0,0.1); }

      /* Row 2: theme pills + dropdowns + results */
      .nav-row-filters {
        padding-top: 10px; padding-bottom: 12px;
        flex-wrap: wrap; gap: 6px;
      }

      .theme-filters {
        display: flex; gap: 4px; flex-wrap: nowrap;
        overflow-x: auto; -webkit-overflow-scrolling: touch;
        scrollbar-width: none; flex: 0 0 auto;
      }
      .theme-filters::-webkit-scrollbar { display: none; }

      .theme-btn {
        display: flex; align-items: center; gap: 6px;
        padding: 6px 14px; border: 1.5px solid transparent;
        background: transparent; color: var(--muted);
        font-family: var(--font-heading); font-size: 22px; font-weight: 600;
        cursor: pointer; transition: all 0.15s; white-space: nowrap;
        border-radius: var(--radius); letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .theme-btn:hover { color: #fff; border-color: var(--border); }
      .theme-btn.active { background: #fff; color: #111; border-color: #fff; }

      .dot {
        width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        background: currentColor; opacity: 0.6;
      }
      .theme-btn.active .dot { opacity: 1; }
      .dot-all { background: #fff; }
      .dot-talks { background: var(--tag-talks); }
      .dot-live  { background: var(--tag-live); }
      .dot-night { background: var(--tag-night); }

      .filter-divider {
        color: var(--border); font-size: 30px; font-weight: 300;
        flex-shrink: 0; padding: 0 2px; align-self: center;
      }

      .dropdown-group { display: flex; gap: 6px; flex-shrink: 0; }

      .dropdown { position: relative; }

      .dropdown-btn {
        padding: 6px 14px; border: 1.5px solid var(--border);
        background: transparent; color: var(--text);
        font-family: var(--font-heading); font-size: 21px; font-weight: 600;
        cursor: pointer; transition: all 0.15s; white-space: nowrap;
        border-radius: var(--radius); letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .dropdown-btn:hover { border-color: #fff; }
      .dropdown-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }

      .dropdown-panel {
        display: none; position: absolute; top: calc(100% + 8px); left: 0;
        background: #1a1a1a; border: 1px solid var(--border);
        border-radius: 12px; min-width: 200px; z-index: 200;
        padding: 6px; box-shadow: 0 16px 48px rgba(0,0,0,0.6);
        max-height: 300px; overflow-y: scroll;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
      .dropdown-panel.open { display: block; }

      .dropdown-option {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 12px; cursor: pointer; border-radius: 8px;
        font-family: var(--font-body); font-size: 20px; font-weight: 500;
        color: var(--muted); transition: background 0.1s, color 0.1s;
        white-space: nowrap; user-select: none;
      }
      .dropdown-option:hover { background: rgba(255,255,255,0.08); color: #fff; }
      .dropdown-option.selected { color: #fff; }

      .option-check {
        width: 16px; height: 16px; border: 1.5px solid var(--border);
        border-radius: 4px; display: flex; align-items: center; justify-content: center;
        font-size: 16px; color: var(--accent); flex-shrink: 0;
      }
      .dropdown-option.selected .option-check { background: var(--accent); border-color: var(--accent); color: #fff; }

      .nav-spacer { flex: 1; }

      .results-fav {
        display: flex; align-items: center; gap: 12px;
        flex-shrink: 0; white-space: nowrap;
      }
      .results-count {
        font-family: var(--font-heading); font-size: 21px; font-weight: 600;
        color: var(--muted); letter-spacing: 0.5px; text-transform: uppercase;
      }
      .results-count #count { color: #fff; font-size: 24px; }

      .fav-btn-top {
        padding: 6px 14px; border: 1.5px solid var(--border);
        background: transparent; color: var(--muted);
        font-family: var(--font-heading); font-size: 21px; font-weight: 600;
        cursor: pointer; transition: all 0.15s; border-radius: var(--radius);
        letter-spacing: 0.5px; white-space: nowrap;
      }
      .fav-btn-top:hover { border-color: #fff; color: #fff; }
      .fav-btn-top.active { background: #fff; color: #111; border-color: #fff; }

      /* ────────────────────────────────────────
         EVENT LIST
      ──────────────────────────────────────── */
      .event-list {
        padding: 24px 20px;
      }

      .time-divider {
        font-family: var(--font-heading); font-size: 20px; font-weight: 600;
        color: var(--muted); letter-spacing: 1px; text-transform: uppercase;
        padding: 20px 0 10px; border-bottom: 1px solid var(--border);
        margin-bottom: 12px; display: flex; align-items: center; gap: 10px;
      }
      .time-divider.has-live { color: #fff; }
      .live-badge {
        background: var(--accent); color: #fff; font-size: 15px; font-weight: 700;
        padding: 2px 8px; border-radius: 100px; letter-spacing: 1px;
        animation: pulse 2s infinite;
      }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }

      .event-card {
        display: flex; gap: 16px; align-items: flex-start;
        padding: 16px; border-radius: var(--radius-card);
        border: 1px solid var(--border); background: var(--surface2);
        cursor: pointer; transition: all 0.15s; margin-bottom: 10px;
        position: relative;
      }
      .event-card:hover { border-color: rgba(255,255,255,0.3); background: var(--surface); transform: translateY(-1px); }
      .event-card.event-live { border-color: rgba(232,93,58,0.4); background: rgba(232,93,58,0.06); }

      .event-img {
        width: 144px; height: 144px; border-radius: 10px;
        object-fit: cover; flex-shrink: 0;
      }
      .event-img-placeholder {
        width: 144px; height: 144px; border-radius: 10px;
        background: var(--surface); display: flex; align-items: center;
        justify-content: center; font-size: 42px; flex-shrink: 0;
      }

      .event-card-body { flex: 1; min-width: 0; }

      .event-meta {
        display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        margin-bottom: 6px;
      }
      .meta-item {
        display: flex; align-items: center; gap: 4px;
        font-size: 16px; color: var(--muted); font-weight: 500;
        text-transform: uppercase; letter-spacing: 0.3px;
      }
      .meta-live {
        display: flex; align-items: center; gap: 4px;
        font-size: 15px; font-weight: 700; color: var(--accent);
        text-transform: uppercase; letter-spacing: 1px;
      }
      .live-dot {
        width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
        animation: pulse 1.5s infinite;
      }

      .event-title {
        font-family: var(--font-heading); font-size: 30px; font-weight: 700;
        color: var(--text); line-height: 1.1; margin-bottom: 3px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .event-subtitle {
        font-size: 18px; color: var(--muted); margin-bottom: 4px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .event-speakers {
        font-size: 18px; color: rgba(255,255,255,0.65); margin-bottom: 6px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      .event-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
      .tag {
        font-size: 15px; font-weight: 700; letter-spacing: 0.5px;
        padding: 3px 10px; border-radius: 100px; text-transform: uppercase;
        background: rgba(255,255,255,0.1); color: #fff;
      }
      .tag-talks { background: rgba(232,93,58,0.2); color: var(--tag-talks); }
      .tag-live  { background: rgba(217,64,128,0.2); color: var(--tag-live); }
      .tag-night { background: rgba(155,59,245,0.2); color: var(--tag-night); }
      .tag-type  { background: rgba(255,255,255,0.08); color: var(--muted); }
      .tag-track { background: rgba(200,240,74,0.15); color: var(--accent-lime); }

      .fav-btn {
        position: absolute; top: 12px; right: 12px;
        background: none; border: none; color: var(--muted);
        font-size: 27px; cursor: pointer; transition: color 0.15s, transform 0.15s;
        line-height: 1; padding: 4px;
      }
      .fav-btn:hover { color: #fff; transform: scale(1.2); }
      .fav-btn.fav-active { color: #ffd700; }

      .empty-state {
        padding: 80px 32px; text-align: center;
      }
      .empty-state h3 {
        font-family: var(--font-heading); font-size: 42px; font-weight: 700;
        color: var(--text); margin-bottom: 8px;
      }
      .empty-state p { font-size: 21px; color: var(--muted); }

      /* ────────────────────────────────────────
         DETAIL VIEW
      ──────────────────────────────────────── */
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
      .detail-fav-icon { font-size: 24px; }

      .detail-page { display: grid; grid-template-columns: 1fr 300px; gap: 32px; padding: 32px 24px; max-width: 1100px; margin: 0 auto; }

      .hero-image { border-radius: var(--radius-card); overflow: hidden; margin-bottom: 24px; }
      .hero-image img { width: 100%; height: 320px; object-fit: cover; display: block; }

      .hero { margin-bottom: 28px; }
      .hero.hero-live { border-left: 3px solid var(--accent); padding-left: 16px; }
      .detail-live-badge {
        display: inline-flex; align-items: center; gap: 6px;
        background: var(--accent); color: #fff; font-family: var(--font-heading);
        font-size: 18px; font-weight: 700; padding: 4px 12px; border-radius: 100px;
        letter-spacing: 1px; margin-bottom: 12px; animation: pulse 2s infinite;
      }
      .detail-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #fff; animation: pulse 1.5s infinite; }

      .event-title-detail {
        font-family: var(--font-heading); font-size: clamp(48px, 7.5vw, 78px);
        font-weight: 700; line-height: 1.05; margin-bottom: 16px; color: var(--text);
      }
      .event-meta-row { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 8px; }

      .speakers-section { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
      .speaker-card { display: flex; gap: 12px; align-items: center; }
      .speaker-avatar { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: var(--surface); display: flex; align-items: center; justify-content: center; font-size: 33px; flex-shrink: 0; }
      .speaker-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .speaker-name { font-weight: 600; font-size: 21px; margin-bottom: 2px; }
      .speaker-role { font-size: 18px; color: var(--muted); }

      .section { margin-bottom: 32px; }
      .section-title { font-family: var(--font-heading); font-size: 30px; font-weight: 700; color: var(--text); margin-bottom: 14px; letter-spacing: 0.5px; text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
      .description { font-size: 22px; line-height: 1.7; color: rgba(255,255,255,0.8); }

      .map-container { border-radius: var(--radius-card); overflow: hidden; }
      .map-container iframe { width: 100%; height: 280px; border: none; display: block; }

      .related-event { display: flex; gap: 14px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border); cursor: pointer; transition: opacity 0.15s; }
      .related-event:hover { opacity: 0.7; }
      .related-event:last-child { border-bottom: none; }
      .related-img { width: 40px; height: 40px; border-radius: 8px; background: var(--surface); display: flex; align-items: center; justify-content: center; font-size: 27px; flex-shrink: 0; }
      .related-meta { font-size: 16px; color: var(--muted); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.3px; }
      .related-title { font-family: var(--font-heading); font-size: 24px; font-weight: 700; margin-bottom: 4px; }
      .related-tag { font-size: 15px; font-weight: 700; padding: 2px 8px; border-radius: 100px; }

      .detail-sidebar { display: flex; flex-direction: column; gap: 16px; }
      .sidebar-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 20px; }
      .sidebar-heading { font-family: var(--font-heading); font-size: 21px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
      .detail-row { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .detail-row:last-child { border-bottom: none; }
      .detail-key { font-size: 18px; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; }
      .detail-val { font-size: 20px; font-weight: 600; text-align: right; }
      .tags-list { display: flex; flex-wrap: wrap; gap: 6px; }
      .sidebar-tag { font-size: 18px; font-weight: 600; padding: 4px 12px; border-radius: 100px; background: var(--surface2); border: 1px solid var(--border); cursor: pointer; transition: all 0.15s; }
      .sidebar-tag:hover { background: var(--accent); border-color: var(--accent); color: #fff; }

      /* ────────────────────────────────────────
         MOBILE (≤768px)
      ──────────────────────────────────────── */
      @media (max-width: 768px) {
        .nav-row { padding: 0 12px; }

        .nav-row-days { padding-top: 12px; padding-bottom: 8px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
        .nav-row-days::-webkit-scrollbar { display: none; }

        .day-btn { padding: 7px 14px; font-size: 22px; }
        .day-btn .day-date { display: none; }

        .search-wrap { min-width: 100%; max-width: 100%; margin-left: 0; order: 10; flex-basis: 100%; padding-bottom: 10px; }
        .search-input { font-size: 20px; }

        .nav-row-filters {
          padding-top: 8px; padding-bottom: 10px;
          flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .nav-row-filters::-webkit-scrollbar { display: none; }

        .theme-filters { flex-shrink: 0; }
        .theme-btn { font-size: 20px; padding: 5px 11px; }

        .filter-divider { display: none; }
        .dropdown-group { flex-shrink: 0; }
        .dropdown-btn { font-size: 18px; padding: 5px 11px; }

        .nav-spacer { display: none; }
        .results-fav { flex-shrink: 0; gap: 8px; }
        .results-count { display: none; }
        .fav-btn-top { font-size: 18px; padding: 5px 10px; }

        .event-list { padding: 16px 12px; }
        .event-card { gap: 12px; padding: 12px; }
        .event-img { width: 120px; height: 120px; }
        .event-img-placeholder { width: 120px; height: 120px; }
        .event-title { font-size: 26px; }

        .detail-page { grid-template-columns: 1fr; padding: 16px 12px; gap: 20px; }
        .detail-sidebar { order: -1; }
        .hero-image img { height: 220px; }
        .back-bar { padding: 12px 16px; }
        .dropdown-panel { left: auto; right: 0; min-width: 220px; }
      }

      @media (max-width: 480px) {
        .day-btn .day-name { font-size: 20px; }
        .theme-btn { font-size: 18px; padding: 5px 10px; }
        .theme-btn .dot { display: none; }
        .event-title { white-space: normal; }
      }
    `
  }
}

customElements.define('turf-programma-002', TurfProgrammaV2)

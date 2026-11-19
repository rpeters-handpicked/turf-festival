class TurfLocaties extends HTMLElement {
  static get observedAttributes() { return ['view', 'dag', 'heading', 'programurl'] }

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.locations = []
    this.groups = []
    this.view = 'list'
    this.activeDay = 'all'
    this.activeType = 'all'
    this.search = ''
    this.selectedGroup = null
    this.map = null
    this.markers = new Map()
  }

  attributeChangedCallback(name, _old, val) {
    if (name === 'view') this.view = val === 'map' || val === 'kaart' ? 'map' : 'list'
    if (name === 'dag') this.activeDay = { do: 'dag1', vr: 'dag2', za: 'dag3', thu: 'dag1', fri: 'dag2', sat: 'dag3' }[val?.toLowerCase()] || 'all'
    if (this.locations.length) this.render()
  }

  get cfg() { return typeof TURF_CONFIG !== 'undefined' ? TURF_CONFIG : {} }
  get projectId() { return this.cfg.sanityProjectId || 'x545nfex' }
  get dataset() { return this.cfg.sanityDataset || 'production' }
  get programUrl() { return this.getAttribute('programurl') || this.cfg.programUrl || '/program' }
  get baseUrl() {
    const script = document.querySelector('script[src*="turf-locaties-widget"]')
    return script ? script.src.substring(0, script.src.lastIndexOf('/') + 1) : ''
  }

  get lang() { return (document.documentElement.lang || 'nl').toLowerCase().startsWith('en') ? 'en' : 'nl' }
  localeField(f) { return this.lang === 'en' ? `coalesce(${f}.en, ${f}.nl, ${f})` : `coalesce(${f}.nl, ${f})` }

  get ui() {
    const en = this.lang === 'en'
    return {
      loading: en ? 'Loading locations…' : 'Locaties laden...',
      list: en ? 'List' : 'Lijst',
      map: en ? 'Map' : 'Kaart',
      allDays: en ? 'All days' : 'Alle dagen',
      search: en ? '⌕ Search name or street' : '⌕ Zoek op naam of straat',
      allTypes: en ? 'All' : 'Alle',
      locations: en ? 'locations' : 'locaties',
      location: en ? 'location' : 'locatie',
      none: en ? 'No locations found' : 'Geen locaties gevonden',
      colImg: en ? 'Image' : 'Afbeelding',
      colName: en ? 'Name / address' : 'Naam / adres',
      colType: 'Type',
      colDesc: en ? 'Description' : 'Beschrijving',
      colDays: en ? 'Events per day' : 'Events per dag',
      noEvents: en ? 'No events' : 'Geen events',
      event: 'event',
      events: 'events',
      during: en ? 'events during TURF' : 'events tijdens TURF',
      on: en ? 'on' : 'op',
      viewProgram: en ? 'View programme' : 'Bekijk programma',
      legend: en ? 'Number = events' : 'Cijfer = aantal events',
      legendAll: en ? 'across all days' : 'over alle dagen',
      active: en ? 'locations active' : 'locaties actief',
      of: en ? 'of' : 'van',
      close: en ? 'Close' : 'Sluiten',
      rooms: en ? 'Rooms' : 'Zalen',
    }
  }

  get days() {
    const en = this.lang === 'en'
    return [
      { key: 'dag1', short: en ? 'THU' : 'DO', date: '26/11', long: en ? 'Thursday 26/11' : 'donderdag 26/11' },
      { key: 'dag2', short: en ? 'FRI' : 'VR', date: '27/11', long: en ? 'Friday 27/11' : 'vrijdag 27/11' },
      { key: 'dag3', short: en ? 'SAT' : 'ZA', date: '28/11', long: en ? 'Saturday 28/11' : 'zaterdag 28/11' },
    ]
  }

  get typeLabels() {
    const en = this.lang === 'en'
    return { club: 'Club', theater: 'Theater', outdoor: 'Outdoor', galerie: en ? 'Gallery' : 'Galerie', overig: en ? 'Other' : 'Overig' }
  }

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  async connectedCallback() {
    this.style.touchAction = 'pan-y'
    const v = this.getAttribute('view')
    if (v) this.view = v === 'map' || v === 'kaart' ? 'map' : 'list'
    this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="root"><div class="loading">${this.ui.loading}</div></div>`
    await this.loadData()
    this.render()
  }

  // ─── DATA ──────────────────────────────────────────────────────────────────

  async loadData() {
    const query = `{
      "locs": *[_type == "locatie"] | order(naam asc) {
        _id, naam, adres, type, geo,
        "beschrijving": ${this.localeField('beschrijving')},
        "img": afbeelding.asset->url
      },
      "events": *[_type == "event" && gepubliceerd == true && defined(locatie)] { dag, "loc": locatie._ref }
    }`
    const url = `https://${this.projectId}.api.sanity.io/v2024-01-01/data/query/${this.dataset}?query=${encodeURIComponent(query)}`
    const { result } = await (await fetch(url)).json()

    const counts = {}
    for (const e of result.events) {
      counts[e.loc] ??= { dag1: 0, dag2: 0, dag3: 0 }
      if (counts[e.loc][e.dag] !== undefined) counts[e.loc][e.dag]++
    }

    this.locations = result.locs.map(l => {
      const c = counts[l._id] || { dag1: 0, dag2: 0, dag3: 0 }
      return { ...l, naam: l.naam.trim(), adres: (l.adres || '').trim(), counts: c, total: c.dag1 + c.dag2 + c.dag3 }
    })
    this.groups = this.buildGroups()
  }

  buildGroups() {
    const byKey = new Map()
    for (const l of this.locations) {
      if (!l.geo) continue
      const key = `${l.geo.lat.toFixed(5)},${l.geo.lng.toFixed(5)}`
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push(l)
    }
    return [...byKey.entries()].map(([key, locs]) => {
      const counts = { dag1: 0, dag2: 0, dag3: 0 }
      locs.forEach(l => { for (const d in counts) counts[d] += l.counts[d] })
      locs.sort((a, b) => b.total - a.total || a.naam.localeCompare(b.naam))
      return {
        key, locs, counts,
        total: counts.dag1 + counts.dag2 + counts.dag3,
        naam: this.groupName(locs),
        adres: locs[0].adres,
        type: locs[0].type,
        lat: locs[0].geo.lat, lng: locs[0].geo.lng,
      }
    })
  }

  // Halls on one address ("MEZZ (grote zaal)", "Grote Kerk Breda - expo") share one pin under their base name.
  groupName(locs) {
    if (locs.length === 1) return locs[0].naam
    const bases = locs.map(l => l.naam.replace(/\s*\(.*\)$/, '').replace(/\s+-\s+.*$/, '').trim())
    const freq = {}
    bases.forEach(b => freq[b] = (freq[b] || 0) + 1)
    const [top, n] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
    if (n > 1) return top
    const words = bases.map(b => b.split(' '))
    const prefix = []
    for (let i = 0; i < words[0].length; i++) {
      if (words.every(w => w[i] === words[0][i])) prefix.push(words[0][i]); else break
    }
    return prefix.length ? prefix.join(' ') : bases[0]
  }

  countFor(item) {
    return this.activeDay === 'all' ? item.total : item.counts[this.activeDay]
  }

  dayTotal(key) {
    return this.locations.reduce((s, l) => s + (key === 'all' ? l.total : l.counts[key]), 0)
  }

  programLink(names) {
    const sep = this.programUrl.includes('?') ? '&' : '?'
    return `${this.programUrl}${sep}location=${encodeURIComponent(names.join(','))}`
  }

  initials(name) {
    return name.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  render() {
    const root = this.shadowRoot.querySelector('.root')
    const heading = this.getAttribute('heading')
    root.innerHTML = `
      ${heading ? `<h2 class="widget-heading">${this.esc(heading)}</h2>` : ''}
      <div class="top-bar">
        <div class="day-filters">${this.renderDayPills()}</div>
        <div class="view-toggle" role="tablist">
          <button class="view-btn ${this.view === 'list' ? 'active' : ''}" data-view="list" role="tab" aria-selected="${this.view === 'list'}">${this.ui.list}</button>
          <button class="view-btn ${this.view === 'map' ? 'active' : ''}" data-view="map" role="tab" aria-selected="${this.view === 'map'}">${this.ui.map}</button>
        </div>
      </div>
      <div class="view-body"></div>`

    root.querySelectorAll('.day-btn').forEach(b => b.addEventListener('click', () => {
      this.activeDay = b.dataset.day
      this.render()
    }))
    root.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      if (this.view === b.dataset.view) return
      this.view = b.dataset.view
      this.render()
    }))

    const body = root.querySelector('.view-body')
    if (this.view === 'map') this.renderMap(body)
    else this.renderList(body)
  }

  renderDayPills() {
    const pill = (key, label) => `
      <button class="day-btn ${this.activeDay === key ? 'active' : ''}" data-day="${key}">
        <span class="day-name">${label}</span><span class="day-count">· ${this.dayTotal(key)}</span>
      </button>`
    return pill('all', this.ui.allDays) + this.days.map(d => pill(d.key, `${d.short} ${d.date}`)).join('')
  }

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────

  filteredLocations() {
    const q = this.search.toLowerCase()
    return this.locations.filter(l =>
      (this.activeType === 'all' || l.type === this.activeType) &&
      (this.activeDay === 'all' || l.counts[this.activeDay] > 0) &&
      (!q || l.naam.toLowerCase().includes(q) || l.adres.toLowerCase().includes(q))
    )
  }

  renderList(body) {
    const types = [...new Set(this.locations.map(l => l.type).filter(Boolean))]
      .sort((a, b) => Object.keys(this.typeLabels).indexOf(a) - Object.keys(this.typeLabels).indexOf(b))
    body.innerHTML = `
      <div class="list-filters">
        <div class="search-wrap">
          <input class="search-input" type="search" placeholder="${this.ui.search}" value="${this.esc(this.search)}" aria-label="${this.ui.search}">
        </div>
        <div class="type-filters">
          <button class="type-btn ${this.activeType === 'all' ? 'active' : ''}" data-type="all">${this.ui.allTypes}</button>
          ${types.map(t => `<button class="type-btn ${this.activeType === t ? 'active' : ''}" data-type="${t}">${this.typeLabels[t] || t}</button>`).join('')}
        </div>
      </div>
      <div class="list-wrap"></div>`

    const input = body.querySelector('.search-input')
    input.addEventListener('input', () => { this.search = input.value; this.renderRows(body.querySelector('.list-wrap')) })
    body.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => {
      this.activeType = b.dataset.type
      body.querySelectorAll('.type-btn').forEach(x => x.classList.toggle('active', x === b))
      this.renderRows(body.querySelector('.list-wrap'))
    }))
    this.renderRows(body.querySelector('.list-wrap'))
  }

  renderRows(wrap) {
    const locs = this.filteredLocations()
    const ui = this.ui
    wrap.innerHTML = `
      <div class="results-count"><span class="count-num">${locs.length}</span> ${locs.length === 1 ? ui.location : ui.locations}</div>
      ${locs.length ? `
      <div class="loc-head" aria-hidden="true">
        <span>${ui.colImg}</span><span>${ui.colName}</span><span>${ui.colType}</span><span>${ui.colDesc}</span><span>${ui.colDays}</span>
      </div>
      <ul class="loc-list">
        ${locs.map(l => `
          <li>
            <button class="loc-row" data-id="${l._id}">
              ${l.img
                ? `<img class="loc-img" src="${l.img}?w=240&h=240&fit=crop&auto=format" alt="" loading="lazy">`
                : `<span class="loc-img loc-img-ph">${this.esc(this.initials(l.naam))}</span>`}
              <span class="loc-name-wrap">
                <span class="loc-name">${this.esc(l.naam)}</span>
                <span class="loc-addr">${this.esc(l.adres)}</span>
              </span>
              <span class="loc-type">${l.type ? `<span class="tag">${this.typeLabels[l.type] || l.type}</span>` : ''}</span>
              <span class="loc-desc">${this.esc(l.beschrijving || '')}</span>
              <span class="loc-days">
                ${this.days.map(d => `
                  <span class="day-cell ${l.counts[d.key] ? 'has' : ''} ${this.activeDay === d.key ? 'current' : ''}">
                    <small>${d.short}</small><b>${l.counts[d.key] || '—'}</b>
                  </span>`).join('')}
              </span>
            </button>
          </li>`).join('')}
      </ul>` : `<div class="empty">${ui.none}</div>`}`

    wrap.querySelectorAll('.loc-row').forEach(r => r.addEventListener('click', () => {
      const g = this.groups.find(g => g.locs.some(l => l._id === r.dataset.id))
      this.view = 'map'
      this.selectedGroup = g?.key || null
      this.render()
    }))
  }

  // ─── MAP VIEW ──────────────────────────────────────────────────────────────

  sortedGroups() {
    return [...this.groups].sort((a, b) => this.countFor(b) - this.countFor(a) || a.naam.localeCompare(b.naam))
  }

  renderMap(body) {
    const ui = this.ui
    const activeCount = this.groups.filter(g => this.countFor(g) > 0).length
    const dayInfo = this.activeDay === 'all'
      ? `${this.dayTotal('all')} ${ui.events}`
      : `${this.dayTotal(this.activeDay)} ${ui.events} ${ui.on} ${this.days.find(d => d.key === this.activeDay).long}`
    body.innerHTML = `
      <div class="map-summary">${activeCount} ${ui.of} ${this.groups.length} ${ui.active} · ${dayInfo}</div>
      <div class="map-layout">
        <ul class="side-list">${this.renderSideItems()}</ul>
        <div class="map-wrap">
          <div class="map-canvas"></div>
          <div class="map-legend"><span class="legend-pin">3</span>${ui.legend} ${this.activeDay === 'all' ? ui.legendAll : `${ui.on} ${this.days.find(d => d.key === this.activeDay).long}`}</div>
          <div class="popup-slot"></div>
        </div>
      </div>`

    body.querySelectorAll('.side-item').forEach(el => el.addEventListener('click', () => this.selectGroup(el.dataset.key, true)))
    this.mountMap(body.querySelector('.map-canvas'))
  }

  renderSideItems() {
    return this.sortedGroups().map(g => {
      const n = this.countFor(g)
      return `
        <li><button class="side-item ${this.selectedGroup === g.key ? 'active' : ''} ${n ? '' : 'inactive'}" data-key="${g.key}">
          <span class="side-text">
            <span class="side-name">${this.esc(g.naam)}</span>
            <span class="side-addr">${this.esc(g.adres)}</span>
          </span>
          <span class="count-badge ${n ? '' : 'zero'}">${n}</span>
        </button></li>`
    }).join('')
  }

  loadGoogleMaps() {
    if (window.google?.maps?.OverlayView) return Promise.resolve()
    if (window.__turfMapsLoading) return window.__turfMapsLoading
    window.__turfMapsLoading = new Promise((resolve, reject) => {
      window.__turfMapsReady = resolve
      const s = document.createElement('script')
      const key = this.cfg.googleMapsApiKey || 'AIzaSyBKtiBfiuLmG_td0BKfK6XABATDe8P1YPw'
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__turfMapsReady`
      s.async = true
      s.onerror = reject
      document.head.appendChild(s)
    })
    return window.__turfMapsLoading
  }

  async mountMap(el) {
    await this.loadGoogleMaps()
    const g = google.maps
    this.map = new g.Map(el, {
      center: { lat: 51.5885, lng: 4.7765 },
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: g.ControlPosition.RIGHT_TOP },
      gestureHandling: 'cooperative',
      clickableIcons: false,
      backgroundColor: '#161616',
      styles: TurfLocaties.mapStyle,
    })

    // Fit to the city-centre cluster; far-off venues stay reachable via the sidebar
    const median = arr => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)]
    const cLat = median(this.groups.map(x => x.lat))
    const cLng = median(this.groups.map(x => x.lng))
    const km = grp => Math.hypot((grp.lat - cLat) * 111, (grp.lng - cLng) * 69)
    const bounds = new g.LatLngBounds()
    this.markers.clear()
    for (const grp of this.groups) {
      const marker = new (TurfLocaties.pinClass())(grp, this.countFor(grp), () => this.selectGroup(grp.key, false))
      marker.setMap(this.map)
      this.markers.set(grp.key, marker)
      if (km(grp) < 1) bounds.extend({ lat: grp.lat, lng: grp.lng })
    }
    this.map.fitBounds(bounds, 40)
    this.map.addListener('click', () => this.selectGroup(null))

    if (this.selectedGroup) {
      g.event.addListenerOnce(this.map, 'idle', () => this.selectGroup(this.selectedGroup, true))
    }
  }

  selectGroup(key, pan) {
    this.selectedGroup = key
    this.markers.forEach((m, k) => m.setActive(k === key))
    this.shadowRoot.querySelectorAll('.side-item').forEach(el => el.classList.toggle('active', el.dataset.key === key))
    const slot = this.shadowRoot.querySelector('.popup-slot')
    const grp = this.groups.find(g => g.key === key)
    if (!grp) { slot.innerHTML = ''; return }

    const sideItem = this.shadowRoot.querySelector(`.side-item[data-key="${key}"]`)
    sideItem?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (pan && this.map) {
      this.map.panTo({ lat: grp.lat, lng: grp.lng })
      if (this.map.getZoom() < 16) this.map.setZoom(16)
    }
    slot.innerHTML = this.renderPopup(grp)
    slot.querySelector('.popup-close').addEventListener('click', () => this.selectGroup(null))
  }

  renderPopup(grp) {
    const ui = this.ui
    const n = this.countFor(grp)
    const dayLabel = this.activeDay === 'all' ? '' : ` — ${this.countFor(grp)} ${ui.on} ${this.days.find(d => d.key === this.activeDay).long}`
    const meta = grp.type ? `<span class="popup-type">${this.typeLabels[grp.type] || grp.type}</span>` : ''
    return `
      <div class="popup" role="dialog" aria-label="${this.esc(grp.naam)}">
        <button class="popup-close" aria-label="${ui.close}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l12 12M13 1L1 13"/></svg>
        </button>
        <h3 class="popup-name">${this.esc(grp.naam)}</h3>
        <div class="popup-addr">${this.esc(grp.adres)}</div>
        ${meta ? `<div class="popup-meta">${meta}</div>` : ''}
        ${grp.locs.length > 1 ? `
          <div class="popup-rooms">
            <span class="popup-rooms-label">${ui.rooms}</span>
            ${grp.locs.map(l => `<span class="room">${this.esc(l.naam)} <b>${this.activeDay === 'all' ? l.total : l.counts[this.activeDay]}</b></span>`).join('')}
          </div>` : ''}
        <div class="popup-days">
          ${this.days.map(d => {
            const c = grp.counts[d.key]
            return `<span class="popup-day ${c ? 'has' : 'none'} ${this.activeDay === d.key ? 'current' : ''}">
              <span class="pd-date">${d.short} ${d.date}</span>
              <span class="pd-count">${c ? `${c} ${c === 1 ? ui.event : ui.events}` : ui.noEvents}</span>
            </span>`
          }).join('')}
        </div>
        <div class="popup-total">${grp.total} ${ui.during}${dayLabel}</div>
        ${grp.total ? `<a class="popup-cta" href="${this.esc(this.programLink(grp.locs.map(l => l.naam)))}">${ui.viewProgram} <span aria-hidden="true">→</span></a>` : ''}
      </div>`
  }

  static pinClass() {
    if (TurfLocaties._Pin) return TurfLocaties._Pin
    TurfLocaties._Pin = class extends google.maps.OverlayView {
      constructor(grp, count, onClick) {
        super()
        this.grp = grp
        this.el = document.createElement('button')
        this.el.className = `pin ${count ? '' : 'pin-zero'}`
        this.el.textContent = count || ''
        this.el.setAttribute('aria-label', `${grp.naam}: ${count}`)
        this.el.addEventListener('click', e => { e.stopPropagation(); onClick() })
      }
      onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.el) }
      draw() {
        const p = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(this.grp.lat, this.grp.lng))
        if (p) { this.el.style.left = `${p.x}px`; this.el.style.top = `${p.y}px` }
      }
      onRemove() { this.el.remove() }
      setActive(on) { this.el.classList.toggle('pin-active', on) }
    }
    return TurfLocaties._Pin
  }

  static mapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1c1c1c' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#7a7a7a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1c1c1c' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1f2a1d' }] },
    { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#232323' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2f2f2f' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#383838' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#424242' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1b26' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a6378' }] },
  ]

  // ─── STYLES ────────────────────────────────────────────────────────────────

  getStyles() {
    const base = this.baseUrl
    return `
      @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700&display=swap');
      @font-face { font-family: 'Thunder'; src: url('${base}fonts/THUNDER/Thunder-BoldLC.woff2') format('woff2'), url('${base}fonts/THUNDER/Thunder-BoldLC.woff') format('woff'); font-weight: 700; font-display: swap; }
      @font-face { font-family: 'Thunder'; src: url('${base}fonts/THUNDER/Thunder-SemiBoldLC.woff2') format('woff2'), url('${base}fonts/THUNDER/Thunder-SemiBoldLC.woff') format('woff'); font-weight: 600; font-display: swap; }
      @font-face { font-family: 'Thunder'; src: url('${base}fonts/THUNDER/Thunder-MediumLC.woff2') format('woff2'), url('${base}fonts/THUNDER/Thunder-MediumLC.woff') format('woff'); font-weight: 500; font-display: swap; }

      :host {
        display: block;
        --surface: rgba(255,255,255,0.08);
        --surface2: rgba(255,255,255,0.05);
        --border: rgba(255,255,255,0.2);
        --text: #fff;
        --muted: rgba(255,255,255,0.5);
        --accent: #e85d3a;
        --radius: 100px;
        --radius-card: 16px;
        --font-heading: 'Thunder', Impact, sans-serif;
        --font-body: 'Barlow', sans-serif;
        --nav-bg: rgba(0,0,0,0.85);
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; text-align: left; }
      ul { list-style: none; }

      .root {
        background: var(--nav-bg); color: var(--text); font-family: var(--font-body);
        border-radius: 20px; overflow: hidden;
      }
      .loading { padding: 80px 32px; text-align: center; color: var(--muted); font-size: 21px; font-weight: 500; }

      .widget-heading {
        font-family: var(--font-heading); font-weight: 700;
        font-size: clamp(36px, 8vw, 96px); line-height: 0.95;
        text-transform: uppercase; padding: 24px 20px 8px;
      }

      /* ── TOP BAR ── */
      .top-bar {
        display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        padding: 14px 20px 12px; border-bottom: 1px solid var(--border);
      }
      .day-filters {
        display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;
        flex: 1 1 auto; min-width: 0;
      }
      .day-filters::-webkit-scrollbar { display: none; }
      .day-btn {
        display: flex; align-items: baseline; gap: 6px;
        padding: 8px 18px; border: 1.5px solid var(--border); border-radius: var(--radius);
        font-family: var(--font-heading); font-size: 26px; font-weight: 600;
        line-height: 1; letter-spacing: 0.5px; white-space: nowrap; transition: all 0.15s;
      }
      .day-btn .day-name { font-weight: 700; text-transform: uppercase; }
      .day-btn .day-count { font-weight: 500; opacity: 0.6; font-size: 21px; }
      .day-btn:hover { border-color: #fff; background: var(--surface); }
      .day-btn.active { background: #fff; color: #111; border-color: #fff; }

      .view-toggle {
        display: flex; gap: 4px; padding: 4px; margin-left: auto;
        border: 1.5px solid var(--border); border-radius: var(--radius); flex-shrink: 0;
      }
      .view-btn {
        padding: 6px 18px; border-radius: var(--radius);
        font-family: var(--font-heading); font-size: 22px; font-weight: 600;
        letter-spacing: 0.5px; text-transform: uppercase; color: var(--muted);
        transition: all 0.15s; line-height: 1;
      }
      .view-btn:hover { color: #fff; }
      .view-btn.active { background: #fff; color: #111; }

      /* ── LIST FILTERS ── */
      .list-filters {
        display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .search-wrap { flex: 0 1 300px; min-width: 200px; }
      .search-input {
        width: 100%; background: var(--surface); border: 1.5px solid var(--border);
        color: var(--text); padding: 8px 16px; border-radius: var(--radius);
        font-family: var(--font-body); font-size: 14px; outline: none;
        transition: border-color 0.15s, background 0.15s;
      }
      .search-input::placeholder { color: var(--muted); }
      .search-input:focus { border-color: #fff; background: #fff; color: #111; }
      .type-filters { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
      .type-filters::-webkit-scrollbar { display: none; }
      .type-btn {
        padding: 6px 14px; border: 1.5px solid transparent; border-radius: var(--radius);
        font-family: var(--font-heading); font-size: 22px; font-weight: 600;
        letter-spacing: 0.5px; text-transform: uppercase; color: var(--muted);
        white-space: nowrap; transition: all 0.15s;
      }
      .type-btn:hover { color: #fff; border-color: var(--border); }
      .type-btn.active { background: #fff; color: #111; border-color: #fff; }

      /* ── LIST ── */
      .list-wrap { padding: 16px 20px 24px; }
      .results-count {
        font-family: var(--font-heading); font-size: 21px; font-weight: 600;
        color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;
        padding-bottom: 10px;
      }
      .count-num { color: #fff; font-size: 24px; }

      .loc-head, .loc-row {
        display: grid; align-items: center; gap: 16px;
        grid-template-columns: 88px minmax(160px, 1.3fr) 100px minmax(160px, 2fr) 156px;
      }
      .loc-head {
        padding: 8px 16px; border-bottom: 1px solid var(--border); margin-bottom: 10px;
        font-family: var(--font-heading); font-size: 16px; font-weight: 600;
        color: var(--muted); letter-spacing: 1px; text-transform: uppercase;
      }
      .loc-row {
        width: 100%; padding: 12px 16px; margin-bottom: 8px;
        border: 1px solid var(--border); border-radius: var(--radius-card);
        background: var(--surface2); transition: all 0.15s;
      }
      .loc-row:hover { border-color: rgba(255,255,255,0.35); background: var(--surface); transform: translateY(-1px); }
      .loc-row:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      .loc-img { width: 88px; height: 88px; border-radius: 10px; object-fit: cover; display: block; }
      .loc-img-ph {
        display: flex; align-items: center; justify-content: center; background: var(--surface);
        font-family: var(--font-heading); font-size: 34px; font-weight: 700; color: var(--muted);
      }
      .loc-name-wrap { display: flex; flex-direction: column; min-width: 0; }
      .loc-name {
        font-family: var(--font-heading); font-size: 30px; font-weight: 700; line-height: 1.05;
        text-transform: uppercase;
      }
      .loc-addr { font-size: 16px; color: var(--muted); margin-top: 2px; }
      .tag {
        display: inline-block; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px;
        padding: 3px 10px; border-radius: 100px; text-transform: uppercase;
        background: rgba(255,255,255,0.1); color: #fff;
      }
      .loc-desc {
        font-size: 15px; line-height: 1.4; color: rgba(255,255,255,0.7);
        display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
      }
      .loc-days { display: flex; gap: 6px; }
      .day-cell {
        width: 46px; padding: 6px 0; border-radius: 10px; text-align: center;
        border: 1px solid rgba(255,255,255,0.1); color: var(--muted);
        display: flex; flex-direction: column; gap: 2px;
      }
      .day-cell small { font-family: var(--font-heading); font-size: 14px; font-weight: 600; letter-spacing: 0.5px; }
      .day-cell b { font-family: var(--font-heading); font-size: 24px; font-weight: 700; line-height: 1; }
      .day-cell.has { color: #fff; border-color: var(--border); background: var(--surface2); }
      .day-cell.has.current { background: var(--accent); border-color: var(--accent); }
      .empty { padding: 60px 0; text-align: center; color: var(--muted); font-size: 21px; font-weight: 500; }

      /* ── MAP VIEW ── */
      .map-summary {
        padding: 12px 20px 0; font-family: var(--font-heading); font-size: 20px; font-weight: 600;
        color: var(--muted); letter-spacing: 0.5px; text-transform: uppercase;
      }
      .map-layout {
        display: grid; grid-template-columns: 300px 1fr; gap: 16px;
        padding: 12px 20px 20px; height: 680px;
      }
      .side-list {
        overflow-y: auto; overscroll-behavior: contain; padding-right: 4px;
        border: 1px solid var(--border); border-radius: var(--radius-card); padding: 8px;
        scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) transparent;
      }
      .side-item {
        width: 100%; display: flex; align-items: center; gap: 12px;
        padding: 10px 12px; border-radius: 12px; transition: background 0.15s;
      }
      .side-item:hover { background: var(--surface2); }
      .side-item.active { background: var(--surface); }
      .side-item.inactive .side-name { color: var(--muted); }
      .side-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .side-name {
        font-family: var(--font-heading); font-size: 24px; font-weight: 700; line-height: 1.05;
        text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .side-addr { font-size: 14px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .count-badge {
        flex-shrink: 0; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 100px;
        display: flex; align-items: center; justify-content: center;
        background: var(--accent); color: #fff;
        font-family: var(--font-heading); font-size: 20px; font-weight: 700;
      }
      .count-badge.zero { background: transparent; border: 1.5px solid var(--border); color: var(--muted); }

      .map-wrap {
        position: relative; border-radius: var(--radius-card); overflow: hidden;
        border: 1px solid var(--border); background: #161616;
      }
      .map-canvas { position: absolute; inset: 0; }

      .pin {
        position: absolute; transform: translate(-50%, -50%);
        min-width: 30px; height: 30px; padding: 0 8px; border-radius: 100px;
        display: flex; align-items: center; justify-content: center; text-align: center;
        background: var(--accent); color: #fff; border: 2px solid #111;
        font-family: var(--font-heading); font-size: 19px; font-weight: 700; line-height: 1;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5); transition: transform 0.15s, background 0.15s;
      }
      .pin:hover { transform: translate(-50%, -50%) scale(1.15); z-index: 2; }
      .pin-zero { min-width: 18px; height: 18px; padding: 0; background: #555; border-color: #222; }
      .pin-active {
        background: #fff; color: #111; border-color: var(--accent);
        transform: translate(-50%, -50%) scale(1.3); z-index: 3;
      }
      .pin-active:hover { transform: translate(-50%, -50%) scale(1.3); }

      .map-legend {
        position: absolute; left: 16px; bottom: 16px; z-index: 1;
        display: flex; align-items: center; gap: 8px; padding: 8px 14px 8px 8px;
        background: rgba(0,0,0,0.85); border: 1px solid var(--border); border-radius: 100px;
        font-family: var(--font-heading); font-size: 17px; font-weight: 600; letter-spacing: 0.3px;
      }
      .legend-pin {
        width: 24px; height: 24px; border-radius: 50%; background: var(--accent);
        display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700;
      }

      .popup-slot { position: absolute; right: 16px; bottom: 16px; z-index: 2; width: min(400px, calc(100% - 32px)); }
      .popup {
        position: relative; background: #111; border: 1px solid var(--border);
        border-radius: 20px; padding: 22px 22px 20px; box-shadow: 0 16px 48px rgba(0,0,0,0.6);
        max-height: 600px; overflow-y: auto;
      }
      .popup-close {
        position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        border: 1.5px solid var(--border); color: #fff; transition: all 0.15s;
      }
      .popup-close:hover { background: #fff; color: #111; border-color: #fff; }
      .popup-name {
        font-family: var(--font-heading); font-size: 40px; font-weight: 700; line-height: 1;
        text-transform: uppercase; padding-right: 48px;
      }
      .popup-addr { font-size: 16px; color: rgba(255,255,255,0.7); margin-top: 6px; }
      .popup-meta { font-size: 13px; color: var(--muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
      .popup-type { color: var(--accent); }
      .popup-rooms { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; align-items: center; }
      .popup-rooms-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-right: 2px; }
      .room {
        font-size: 13px; padding: 4px 10px; border-radius: 100px; background: var(--surface);
        display: flex; gap: 6px; align-items: center;
      }
      .room b { color: var(--accent); }
      .popup-days { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
      .popup-day {
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
        padding: 10px 4px; border-radius: 14px; text-align: center;
        border: 1px solid var(--border); background: var(--surface2);
      }
      .popup-day.none { border-style: dashed; color: var(--muted); background: transparent; }
      .popup-day.current { background: var(--accent); border-color: var(--accent); border-style: solid; color: #fff; }
      .pd-date { font-family: var(--font-heading); font-size: 22px; font-weight: 700; line-height: 1; }
      .pd-count { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
      .popup-total { font-size: 15px; color: rgba(255,255,255,0.75); margin-top: 14px; }
      .popup-cta {
        display: inline-flex; align-items: center; gap: 10px; margin-top: 16px;
        padding: 10px 22px; border-radius: var(--radius); background: #fff; color: #111;
        font-family: var(--font-heading); font-size: 22px; font-weight: 700; letter-spacing: 0.5px;
        text-transform: uppercase; text-decoration: none; transition: all 0.15s;
      }
      .popup-cta:hover { background: var(--accent); color: #fff; }

      /* ── RESPONSIVE ── */
      @media (max-width: 1100px) {
        .loc-head { display: none; }
        .loc-row {
          grid-template-columns: 72px 1fr auto;
          grid-template-areas: "img name days" "img type days" "desc desc desc";
          gap: 6px 14px;
        }
        .loc-img { width: 72px; height: 72px; grid-area: img; }
        .loc-name-wrap { grid-area: name; }
        .loc-type { grid-area: type; }
        .loc-desc { grid-area: desc; -webkit-line-clamp: 2; }
        .loc-days { grid-area: days; justify-content: flex-end; }
      }
      @media (max-width: 800px) {
        .map-layout { grid-template-columns: 1fr; grid-template-rows: 62vh auto; height: auto; padding: 12px; }
        .map-wrap { order: -1; min-height: 420px; }
        .side-list { max-height: 360px; }
        .popup-slot { left: 8px; right: 8px; bottom: 8px; width: auto; }
        .popup { max-height: calc(62vh - 16px); padding: 18px; }
        .popup-name { font-size: 32px; }
        .map-legend { display: none; }
      }
      @media (max-width: 600px) {
        .top-bar { padding: 12px; }
        .view-toggle { margin-left: 0; }
        .day-btn { font-size: 21px; padding: 7px 14px; }
        .day-btn .day-count { font-size: 17px; }
        .list-filters { padding: 10px 12px; }
        .search-wrap { flex: 1 1 100%; }
        .list-wrap { padding: 12px; }
        .loc-row {
          grid-template-columns: 64px 1fr;
          grid-template-areas: "img name" "img type" "desc desc" "days days";
          padding: 12px;
        }
        .loc-img { width: 64px; height: 64px; }
        .loc-name { font-size: 26px; }
        .loc-days { justify-content: flex-start; }
        .map-summary { padding: 10px 12px 0; font-size: 17px; }
      }
    `
  }
}

customElements.define('turf-locaties', TurfLocaties)

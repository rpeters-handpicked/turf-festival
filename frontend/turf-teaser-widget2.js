class TurfTeaser2 extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.events = []
    this.activeDay = null
    this.showFavoritesOnly = false
  }

  get cfg() { return typeof TURF_CONFIG !== 'undefined' ? TURF_CONFIG : {} }
  get projectId() { return this.getAttribute('project-id') || this.cfg.sanityProjectId || 'x545nfex' }
  get dataset() { return this.getAttribute('dataset') || this.cfg.sanityDataset || 'production' }
  get cdnUrl() { return `https://${this.projectId}.api.sanity.io/v2024-01-01/data/query/${this.dataset}` }

  get baseUrl() {
    const script = document.querySelector('script[src*="turf-teaser-widget2"]')
    if (script) return script.src.substring(0, script.src.lastIndexOf('/') + 1)
    return ''
  }

  get dagLabels() {
    return {
      dag1: { short: 'DO 26/11', full: 'Donderdag 26 nov' },
      dag2: { short: 'VR 27/11', full: 'Vrijdag 27 nov' },
      dag3: { short: 'ZA 28/11', full: 'Zaterdag 28 nov' },
    }
  }

  get themaLabels() {
    return { talks: '⬡ TURF Talks', live: '◈ TURF Live', night: '◉ TURF by Night' }
  }

  // ── Favorites — gedeelde key met turf-widget + turf-teaser-widget ──────────
  getFavorites() {
    try { return JSON.parse(localStorage.getItem('turf-favorites') || '[]') } catch { return [] }
  }
  saveFavorites(favs) {
    try { localStorage.setItem('turf-favorites', JSON.stringify(favs)) } catch {}
  }
  isFavorite(id) { return this.getFavorites().includes(id) }
  toggleFavorite(id) {
    const favs = this.getFavorites()
    const idx = favs.indexOf(id)
    if (idx > -1) { favs.splice(idx, 1) } else { favs.push(id) }
    this.saveFavorites(favs)
    return idx === -1
  }

  async connectedCallback() {
    this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="root"><div class="loading">Programma laden…</div></div>`
    await this.loadEvents()
    this.render()
  }

  async sanityFetch(query) {
    const url = `${this.cdnUrl}?query=${encodeURIComponent(query)}`
    const res = await fetch(url)
    const data = await res.json()
    return data.result
  }

  async loadEvents() {
    const raw = await this.sanityFetch(`
      *[_type == "event" && gepubliceerd == true] | order(dag asc, startTijd asc) {
        _id, titel, ondertitel, beschrijving, dag, startTijd, eindTijd,
        "themaSlug": thema->slug,
        "themaNaam": thema->naam,
        "locatieNaam": locatie->naam,
        "afbeelding": afbeelding.asset->url
      }
    `)

    this.events = (raw || []).map(e => {
      let desc = e.ondertitel || ''
      if (!desc && e.beschrijving) {
        const first = e.beschrijving.split(/(?<=[.!?])\s/)[0]
        desc = first ? first.trim() : ''
      }
      return {
        _id: e._id,
        title: e.titel,
        dag: e.dag,
        startTime: e.startTijd || '',
        endTime: e.eindTijd || '',
        location: e.locatieNaam || '',
        theme: e.themaSlug || 'talks',
        themeName: e.themaNaam || '',
        image: e.afbeelding || '',
        desc,
      }
    })
  }

  render() {
    const root = this.shadowRoot.querySelector('.root')
    const favs = this.showFavoritesOnly ? this.getFavorites() : null
    const filtered = this.events.filter(e => {
      if (this.activeDay && e.dag !== this.activeDay) return false
      if (favs && !favs.includes(e._id)) return false
      return true
    })

    root.innerHTML = `
      <div class="day-filter">
        <button class="day-tab ${!this.activeDay ? 'active' : ''}" data-day="">Alle Dagen</button>
        <button class="day-tab ${this.activeDay === 'dag1' ? 'active' : ''}" data-day="dag1">
          Donderdag <span class="sub">26 nov</span>
        </button>
        <button class="day-tab ${this.activeDay === 'dag2' ? 'active' : ''}" data-day="dag2">
          Vrijdag <span class="sub">27 nov</span>
        </button>
        <button class="day-tab ${this.activeDay === 'dag3' ? 'active' : ''}" data-day="dag3">
          Zaterdag <span class="sub">28 nov</span>
        </button>
        <button class="fav-filter-btn ${this.showFavoritesOnly ? 'active' : ''}" id="favFilterBtn">★ Favorites</button>
      </div>
      <div class="count-line"><strong>${filtered.length}</strong> events</div>
      <div class="card-grid">
        ${filtered.length === 0
          ? `<div class="empty">Geen events gevonden</div>`
          : filtered.map(e => this.renderCard(e)).join('')
        }
      </div>
    `

    root.querySelectorAll('.day-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeDay = btn.dataset.day || null
        this.render()
      })
    })

    root.getElementById('favFilterBtn')?.addEventListener('click', () => {
      this.showFavoritesOnly = !this.showFavoritesOnly
      this.render()
    })

    root.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation()
        const isFav = this.toggleFavorite(btn.dataset.fav)
        btn.classList.toggle('fav-active', isFav)
      })
    })
  }

  renderCard(e) {
    const dag = this.dagLabels[e.dag] || { short: e.dag, full: e.dag }
    const timeStr = e.startTime + (e.endTime ? ` – ${e.endTime}` : '')
    const themeLabel = this.themaLabels[e.theme] || e.themeName
    const icon = this.themaLabels[e.theme]?.[0] || '◈'

    const bgStyle = e.image
      ? `background-image: url('${e.image}?w=600&h=840&fit=crop')`
      : `background: #111`

    // Split title at last space before midpoint for two-line display
    const words = e.title.split(' ')
    const mid = Math.ceil(words.length / 2)
    const titleLine1 = words.slice(0, mid).join(' ')
    const titleLine2 = words.slice(mid).join(' ')
    const titleHtml = titleLine2
      ? `${titleLine1}<br>${titleLine2}`
      : titleLine1

    return `
      <div class="event-card" data-id="${e._id}">
        <div class="card-bg" style="${bgStyle}">
          ${!e.image ? `<div class="card-placeholder-icon">${icon}</div>` : ''}
        </div>
        <div class="card-overlay"></div>
        <button class="fav-btn ${this.isFavorite(e._id) ? 'fav-active' : ''}" data-fav="${e._id}" title="Bewaar als favoriet">★</button>
        <div class="card-content">
          <div class="card-meta">${dag.short} · ${timeStr} · ${e.location}</div>
          <div class="card-title">${titleHtml}</div>
          ${e.desc ? `<div class="card-desc">${e.desc}</div>` : ''}
          <div class="theme-pill">${themeLabel}</div>
        </div>
      </div>
    `
  }

  getStyles() {
    const base = this.baseUrl
    return `
      @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&display=swap');

      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-BoldLC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-BoldLC.woff') format('woff');
        font-weight: 700;
        font-display: swap;
      }
      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-SemiBoldLC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-SemiBoldLC.woff') format('woff');
        font-weight: 600;
        font-display: swap;
      }

      :host {
        display: block;
        --text:          #ffffff;
        --muted:         rgba(255,255,255,0.6);
        --border:        rgba(255,255,255,0.15);
        --radius:        100px;
        --font-heading:  'Thunder', Impact, sans-serif;
        --font-body:     'Barlow', sans-serif;
      }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      .root {
        color: var(--text);
        font-family: var(--font-body);
      }

      /* ── LOADING ── */
      .loading {
        padding: 80px 0;
        text-align: center;
        font-size: 14px;
        font-weight: 500;
        color: var(--muted);
      }

      /* ── DAY FILTER ── */
      .day-filter {
        display: flex;
        gap: 10px;
        padding-bottom: 28px;
        flex-wrap: wrap;
        align-items: center;
      }

      .day-tab {
        padding: 14px 28px;
        border: none;
        background: rgba(0,0,0,0.5);
        color: var(--text);
        font-family: var(--font-heading);
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        cursor: pointer;
        border-radius: var(--radius);
        transition: background 0.2s, outline 0.1s;
        white-space: nowrap;
        line-height: 1;
      }
      .day-tab:hover {
        background: transparent;
        outline: 2px solid var(--text);
        outline-offset: -2px;
      }
      .day-tab.active {
        background: var(--text);
        color: #111;
      }
      .day-tab .sub {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 500;
        opacity: 0.55;
        margin-left: 6px;
        letter-spacing: 0;
        text-transform: none;
      }
      .day-tab.active .sub { opacity: 0.45; }

      /* ── FAVORITES FILTER ── */
      .fav-filter-btn {
        margin-left: auto;
        padding: 14px 28px;
        border: none;
        background: rgba(0,0,0,0.5);
        color: var(--text);
        font-family: var(--font-heading);
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        cursor: pointer;
        border-radius: var(--radius);
        transition: background 0.2s, outline 0.1s;
        white-space: nowrap;
        line-height: 1;
      }
      .fav-filter-btn:hover {
        background: transparent;
        outline: 2px solid var(--text);
        outline-offset: -2px;
      }
      .fav-filter-btn.active {
        background: var(--text);
        color: #111;
      }

      /* ── COUNT ── */
      .count-line {
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--muted);
        margin-bottom: 20px;
      }
      .count-line strong { color: var(--text); font-size: 14px; }

      /* ── GRID ── */
      .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 4px;
      }

      /* ── CARD ── */
      .event-card {
        position: relative;
        aspect-ratio: 3 / 4;
        overflow: hidden;
        cursor: default;
      }

      /* image layer */
      .card-bg {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center top;
        transition: transform 0.4s ease;
      }
      .event-card:hover .card-bg { transform: scale(1.04); }

      .card-placeholder-icon {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 80px;
        opacity: 0.08;
        color: #fff;
      }

      /* gradient overlay */
      .card-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to top,
          rgba(0,0,0,0.88) 0%,
          rgba(0,0,0,0.5)  40%,
          rgba(0,0,0,0.1)  70%,
          rgba(0,0,0,0)    100%
        );
      }

      /* ── FAV BUTTON ── */
      .fav-btn {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.25);
        background: rgba(0,0,0,0.35);
        color: rgba(255,255,255,0.4);
        font-size: 17px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        z-index: 2;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      .fav-btn:hover { border-color: #fff; color: #fff; }
      .fav-btn.fav-active { background: #fff; border-color: #fff; color: #111; }

      /* ── CARD CONTENT ── */
      .card-content {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 0 22px 20px;
        z-index: 1;
      }

      .card-meta {
        font-family: var(--font-body);
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255,255,255,0.55);
        margin-bottom: 8px;
      }

      .card-title {
        font-family: var(--font-heading);
        font-size: 42px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        line-height: 0.92;
        color: var(--text);
        margin-bottom: 10px;
      }

      .card-desc {
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 400;
        line-height: 1.5;
        color: rgba(255,255,255,0.6);
        margin-bottom: 12px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .theme-pill {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        border-radius: var(--radius);
        background: rgba(0,0,0,0.45);
        border: 1px solid rgba(255,255,255,0.2);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        font-family: var(--font-body);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: rgba(255,255,255,0.7);
      }

      /* ── EMPTY ── */
      .empty {
        grid-column: 1 / -1;
        padding: 60px 0;
        text-align: center;
        font-family: var(--font-heading);
        font-size: 32px;
        font-weight: 700;
        text-transform: uppercase;
        color: rgba(255,255,255,0.2);
        letter-spacing: 2px;
      }

      /* ── MOBILE ── */
      @media (max-width: 600px) {
        .day-filter { gap: 8px; padding-bottom: 20px; }
        .day-tab { padding: 10px 18px; font-size: 15px; }
        .fav-filter-btn { padding: 10px 18px; font-size: 15px; }
        .card-grid { grid-template-columns: repeat(2, 1fr); gap: 3px; }
        .card-title { font-size: 28px; }
        .card-content { padding: 0 14px 14px; }
      }
    `
  }
}

customElements.define('turf-teaser2', TurfTeaser2)

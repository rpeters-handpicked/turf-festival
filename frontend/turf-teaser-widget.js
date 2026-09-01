class TurfTeaser extends HTMLElement {
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
    const script = document.querySelector('script[src*="turf-teaser-widget"]')
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

  // ── Favorites (shared localStorage key met turf-widget) ──────────────────
  getFavorites() {
    try { return JSON.parse(localStorage.getItem('turf-favorites') || '[]') } catch { return [] }
  }
  saveFavorites(favs) {
    try { localStorage.setItem('turf-favorites', JSON.stringify(favs)) } catch {}
  }
  isFavorite(id) {
    return this.getFavorites().includes(id)
  }
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
      // One-liner: prefer ondertitel, else first sentence of beschrijving
      let desc = e.ondertitel || ''
      if (!desc && e.beschrijving) {
        const firstSentence = e.beschrijving.split(/(?<=[.!?])\s/)[0]
        desc = firstSentence ? firstSentence.trim() : ''
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
      <div class="event-list">
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

    root.querySelector('#favFilterBtn')?.addEventListener('click', () => {
      this.showFavoritesOnly = !this.showFavoritesOnly
      this.render()
    })

    root.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const isFav = this.toggleFavorite(btn.dataset.fav)
        btn.classList.toggle('fav-active', isFav)
      })
    })
  }

  renderCard(e) {
    const dag = this.dagLabels[e.dag] || { full: e.dag }
    const timeStr = e.startTime + (e.endTime ? ` – ${e.endTime}` : '')
    const themeLabel = this.themaLabels[e.theme] || e.themeName
    const icon = this.themaLabels[e.theme]?.[0] || '◈'

    const imgHtml = e.image
      ? `<img class="card-img" src="${e.image}?w=720&h=480&fit=crop" alt="${e.title}" loading="lazy">`
      : `<div class="card-img-placeholder"><span>${icon}</span></div>`

    const metaParts = [dag.full, timeStr, e.location].filter(Boolean)

    return `
      <div class="event-card">
        ${imgHtml}
        <div class="card-content">
          <div class="card-meta">
            ${metaParts.map((p, i) => `${i > 0 ? '<span class="sep">·</span>' : ''}${p}`).join('')}
          </div>
          <div class="card-title">${e.title}</div>
          ${e.desc ? `<div class="card-desc">${e.desc}</div>` : ''}
          <div class="card-footer">
            <span class="theme-pill">${themeLabel}</span>
            <button class="fav-btn ${this.isFavorite(e._id) ? 'fav-active' : ''}" data-fav="${e._id}" title="Bewaar als favoriet">★</button>
          </div>
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
        --text:         #ffffff;
        --muted:        rgba(255,255,255,0.55);
        --surface:      rgba(0,0,0,0.35);
        --surface-hover:rgba(0,0,0,0.5);
        --border:       rgba(255,255,255,0.12);
        --radius:       100px;
        --radius-card:  16px;
        --font-heading: 'Thunder', Impact, sans-serif;
        --font-body:    'Barlow', sans-serif;
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
        font-family: var(--font-body);
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
      .count-line strong {
        color: var(--text);
        font-size: 14px;
      }

      /* ── EVENT LIST ── */
      .event-list {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      /* ── EVENT CARD ── */
      .event-card {
        display: grid;
        grid-template-columns: 360px 1fr;
        background: var(--surface);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-radius: var(--radius-card);
        overflow: hidden;
        transition: background 0.2s;
      }
      .event-card:hover { background: var(--surface-hover); }

      /* ── IMAGE ── */
      .card-img {
        width: 360px;
        height: 240px;
        object-fit: cover;
        display: block;
        flex-shrink: 0;
      }

      .card-img-placeholder {
        width: 360px;
        height: 240px;
        background: rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 72px;
        opacity: 0.15;
      }

      /* ── CONTENT ── */
      .card-content {
        padding: 28px 32px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0;
      }

      .card-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0;
        margin-bottom: 12px;
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--muted);
      }
      .card-meta .sep {
        margin: 0 10px;
        opacity: 0.3;
      }

      .card-title {
        font-family: var(--font-heading);
        font-size: 44px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        line-height: 1;
        color: var(--text);
        margin-bottom: 14px;
        text-wrap: balance;
      }

      .card-desc {
        font-family: var(--font-body);
        font-size: 14px;
        font-weight: 400;
        line-height: 1.6;
        color: var(--muted);
        max-width: 500px;
      }

      .card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 16px;
      }

      .theme-pill {
        display: inline-flex;
        align-items: center;
        padding: 5px 14px;
        border-radius: var(--radius);
        background: rgba(0,0,0,0.4);
        border: 1px solid var(--border);
        font-family: var(--font-body);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: var(--muted);
      }

      /* ── FAV BUTTON ── */
      .fav-btn {
        background: none;
        border: 1px solid rgba(255,255,255,0.2);
        color: rgba(255,255,255,0.3);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
      }
      .fav-btn:hover {
        border-color: #fff;
        color: #fff;
      }
      .fav-btn.fav-active {
        background: #fff;
        border-color: #fff;
        color: #111;
      }

      /* ── EMPTY ── */
      .empty {
        padding: 60px 0;
        text-align: center;
        font-family: var(--font-heading);
        font-size: 32px;
        font-weight: 700;
        text-transform: uppercase;
        color: rgba(255,255,255,0.2);
        letter-spacing: 2px;
      }

      /* ── SCROLLBAR ── */
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

      /* ── MOBILE ── */
      @media (max-width: 768px) {
        .day-filter { gap: 8px; padding-bottom: 20px; }
        .day-tab { padding: 10px 20px; font-size: 15px; }

        .event-card { grid-template-columns: 1fr; }
        .card-img { width: 100%; height: 220px; }
        .card-img-placeholder { width: 100%; height: 220px; }
        .card-content { padding: 20px; }
        .card-title { font-size: 32px; }
      }
    `
  }
}

customElements.define('turf-teaser', TurfTeaser)

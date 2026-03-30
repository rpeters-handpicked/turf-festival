class TurfProgramma extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.events = []
    this.locations = []
    this.activeDay = null
    this.activeCat = 'all'
    this.activeLocation = null
    this.searchQuery = ''
    this.currentView = 'list'
    this.scrollPos = 0
  }

  get projectId() { return this.getAttribute('project-id') || 'x545nfex' }
  get dataset() { return this.getAttribute('dataset') || 'production' }
  get cdnUrl() { return `https://${this.projectId}.api.sanity.io/v2024-01-01/data/query/${this.dataset}` }

  async connectedCallback() {
    this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="root"><div class="loading">Programma laden...</div></div>`
    await this.loadEvents()
    this.renderList()
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
      _id, titel, ondertitel, dag, startTijd, eindTijd, type,
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
      image: e.afbeelding || '',
    }))

    this.locations = [...new Set(this.events.map(e => e.location))].filter(Boolean).sort()
  }

  // ─── LIST VIEW ──────────────────────────────────────────────────────────────

  renderList() {
    this.currentView = 'list'
    const root = this.shadowRoot.querySelector('.root')
    root.innerHTML = `
      <div class="category-bar">
        <button class="cat-tab active" data-cat="all">All Events</button>
        <button class="cat-tab" data-cat="talks">⬡ TURF Talks</button>
        <button class="cat-tab" data-cat="live">◈ TURF Live</button>
        <button class="cat-tab" data-cat="night">◉ TURF by Night</button>
      </div>
      <div class="main">
        <aside class="sidebar">
          <div class="results-count">Showing <strong id="count">0</strong> results</div>
          <div class="search-box">
            <span class="search-icon">⌕</span>
            <input type="text" id="search" placeholder="Search event..." value="${this.searchQuery}">
          </div>
          <div class="filter-section">
            <div class="filter-label">Date <button id="clearDate">—</button></div>
            <div class="date-grid">
              <button class="date-btn ${this.activeDay === '1' ? 'active' : ''}" data-day="1"><span class="day-name">DO</span><span class="day-num">26-11</span></button>
              <button class="date-btn ${this.activeDay === '2' ? 'active' : ''}" data-day="2"><span class="day-name">VR</span><span class="day-num">27-11</span></button>
              <button class="date-btn ${this.activeDay === '3' ? 'active' : ''}" data-day="3"><span class="day-name">ZA</span><span class="day-num">28-11</span></button>
            </div>
          </div>
          <div class="filter-section">
            <div class="filter-label">Location <button id="clearLoc">—</button></div>
            <div class="location-list" id="locationList"></div>
          </div>
        </aside>
        <main class="content" id="eventList"></main>
      </div>
    `

    this.bindListEvents()
    this.renderLocations()
    this.applyFilters()

    if (this.scrollPos) {
      root.querySelector('.content')?.scrollTo(0, this.scrollPos)
    }
  }

  bindListEvents() {
    const root = this.shadowRoot

    // Category tabs
    root.querySelectorAll('.cat-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        this.activeCat = btn.dataset.cat
        this.applyFilters()
      })
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
    const filtered = this.events.filter(e => {
      if (this.activeDay && e.day !== this.activeDay) return false
      if (this.activeCat !== 'all' && e.theme !== this.activeCat) return false
      if (this.activeLocation && e.location !== this.activeLocation) return false
      if (q && !e.title.toLowerCase().includes(q) && !e.location.toLowerCase().includes(q)) return false
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

    container.innerHTML = Object.entries(groups).map(([label, evts]) => `
      <div class="time-divider">${label}</div>
      ${evts.map(e => {
        const imgHtml = e.image
          ? `<img class="event-img" src="${e.image}?w=200&h=200&fit=crop" alt="${e.title}">`
          : `<div class="event-img">${this.themaLabels[e.theme]?.[0] || '◈'}</div>`
        return `
        <div class="event-card" data-id="${e._id}">
          ${imgHtml}
          <div>
            <div class="event-meta">
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
        </div>`
      }).join('')}
    `).join('')

    // Bind click events on cards
    container.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', () => {
        this.scrollPos = container.scrollTop
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
      ? e.sprekers.map(sp => `
        <div class="speaker-card">
          <div class="speaker-avatar">${sp.foto ? `<img src="${sp.foto}?w=112&h=112&fit=crop" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '🎙️'}</div>
          <div>
            <div class="speaker-name">${sp.naam}</div>
            <div class="speaker-role">${[sp.rol, sp.organisatie].filter(Boolean).join(' · ')}</div>
          </div>
        </div>`).join('')
      : ''

    const tagsHtml = e.tags && e.tags.length > 0
      ? `<div class="sidebar-card"><div class="sidebar-heading">Tags</div><div class="tags-list">${e.tags.map(t => `<span class="sidebar-tag">${t}</span>`).join('')}</div></div>`
      : ''

    const beschrijving = e.beschrijving
      ? e.beschrijving.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')
      : ''

    root.innerHTML = `
      <div class="back-bar">
        <button class="back-btn" id="backBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
          Terug naar programma
        </button>
      </div>
      <div class="detail-page">
        <div class="detail-left">
          <div class="hero">
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
    root.querySelector('#backBtn')?.addEventListener('click', () => this.renderList())

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
          el.addEventListener('click', () => this.renderDetail(el.dataset.id))
        })
      } else if (relatedList) {
        relatedList.innerHTML = '<p style="color:var(--muted);font-size:13px;">Geen andere events op deze locatie</p>'
      }
    }

    // Scroll to top
    root.scrollTop = 0
  }

  // ─── STYLES ─────────────────────────────────────────────────────────────────

  getStyles() {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');

      :host {
        display: block;
        --black: #0a0a0a;
        --surface: #1a1a1a;
        --surface2: #222;
        --border: #2a2a2a;
        --text: #e8e8e8;
        --muted: #666;
        --accent-lime: #c8f53b;
        --accent-blue: #3b8bf5;
        --accent-purple: #9b3bf5;
        --tag-talks: #c8f53b;
        --tag-live: #3b8bf5;
        --tag-night: #9b3bf5;
      }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      .root {
        background: var(--black);
        color: var(--text);
        font-family: 'DM Sans', sans-serif;
        min-height: 400px;
      }

      .loading {
        padding: 80px 32px;
        text-align: center;
        color: var(--muted);
        font-family: 'Space Mono', monospace;
        font-size: 12px;
        letter-spacing: 2px;
      }

      /* ── CATEGORY TABS ── */
      .category-bar {
        display: flex; gap: 4px; padding: 16px 40px;
        border-bottom: 1px solid var(--border);
        background: var(--black); overflow-x: auto;
      }
      .cat-tab {
        padding: 8px 20px; border: 1px solid var(--border); background: transparent;
        color: var(--muted); font-family: 'Space Mono', monospace; font-size: 11px;
        letter-spacing: 2px; cursor: pointer; transition: all 0.15s;
        white-space: nowrap; text-transform: uppercase;
      }
      .cat-tab:hover { border-color: var(--text); color: var(--text); }
      .cat-tab.active { background: var(--text); color: var(--black); border-color: var(--text); font-weight: 700; }
      .cat-tab[data-cat="talks"].active { background: var(--tag-talks); border-color: var(--tag-talks); }
      .cat-tab[data-cat="live"].active { background: var(--tag-live); border-color: var(--tag-live); color: #fff; }
      .cat-tab[data-cat="night"].active { background: var(--tag-night); border-color: var(--tag-night); color: #fff; }

      /* ── LAYOUT ── */
      .main { display: grid; grid-template-columns: 300px 1fr; min-height: 600px; }

      /* ── SIDEBAR ── */
      .sidebar {
        border-right: 1px solid var(--border); padding: 28px 24px;
        position: sticky; top: 0; height: 100vh; overflow-y: auto;
      }
      .results-count {
        font-family: 'Space Mono', monospace; font-size: 10px;
        letter-spacing: 2px; color: var(--muted); text-transform: uppercase; margin-bottom: 24px;
      }
      .results-count strong { color: var(--accent-lime); font-size: 14px; }
      .search-box { position: relative; margin-bottom: 28px; }
      .search-box input {
        width: 100%; background: var(--surface); border: 1px solid var(--border);
        color: var(--text); padding: 10px 14px 10px 36px; font-family: 'DM Sans', sans-serif;
        font-size: 13px; outline: none; transition: border-color 0.15s;
      }
      .search-box input:focus { border-color: var(--accent-lime); }
      .search-box input::placeholder { color: var(--muted); }
      .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 14px; }
      .filter-section { margin-bottom: 28px; }
      .filter-label {
        font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 2px;
        text-transform: uppercase; color: var(--muted); margin-bottom: 12px;
        display: flex; justify-content: space-between; align-items: center;
      }
      .filter-label button { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 16px; }

      /* ── DATE BUTTONS ── */
      .date-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
      .date-btn {
        padding: 10px 6px; border: 1px solid var(--border); background: transparent;
        color: var(--muted); font-family: 'Space Mono', monospace; font-size: 10px;
        cursor: pointer; text-align: center; transition: all 0.15s; line-height: 1.4;
      }
      .date-btn:hover { border-color: var(--text); color: var(--text); }
      .date-btn.active { border-color: var(--accent-lime); color: var(--accent-lime); background: rgba(200,245,59,0.08); }
      .date-btn .day-name { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
      .date-btn .day-num { display: block; font-size: 9px; opacity: 0.7; margin-top: 2px; }

      /* ── LOCATION ── */
      .location-list { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
      .loc-btn {
        padding: 8px 12px; border: 1px solid transparent; background: transparent;
        color: var(--muted); font-family: 'DM Sans', sans-serif; font-size: 12px;
        cursor: pointer; text-align: left; transition: all 0.15s;
        display: flex; align-items: center; gap: 8px;
      }
      .loc-btn::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--border); flex-shrink: 0; transition: background 0.15s; }
      .loc-btn:hover { color: var(--text); }
      .loc-btn.active { color: var(--accent-lime); }
      .loc-btn.active::before { background: var(--accent-lime); }

      /* ── TIME DIVIDER ── */
      .time-divider {
        background: var(--surface); border-bottom: 1px solid var(--border);
        padding: 12px 32px; font-family: 'Space Mono', monospace; font-size: 12px;
        letter-spacing: 2px; color: var(--text); display: flex; align-items: center; gap: 12px;
        position: sticky; top: 0; z-index: 10;
      }
      .time-divider::before {
        content: ''; width: 8px; height: 8px; background: var(--accent-lime);
        border-radius: 50%; animation: pulse 2s infinite;
      }
      @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }

      /* ── EVENT CARD ── */
      .event-card {
        display: grid; grid-template-columns: 100px 1fr; gap: 24px; align-items: start;
        padding: 24px 32px; border-bottom: 1px solid var(--border);
        transition: background 0.15s; cursor: pointer; color: inherit;
      }
      .event-card:hover { background: var(--surface); }
      .event-card:hover .event-title { color: var(--accent-lime); }
      .event-img {
        width: 100px; height: 100px; object-fit: cover; background: var(--surface);
        display: flex; align-items: center; justify-content: center; font-size: 36px;
        flex-shrink: 0; border: 1px solid var(--border);
      }
      img.event-img { display: block; }
      .event-meta { display: flex; gap: 16px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
      .meta-item {
        font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 1px;
        color: var(--muted); text-transform: uppercase; display: flex; align-items: center; gap: 4px;
      }
      .meta-item svg { opacity: 0.5; }
      .event-title {
        font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 2px;
        margin-bottom: 6px; transition: color 0.15s; line-height: 1.1;
      }
      .event-subtitle {
        font-size: 11px; color: var(--muted); letter-spacing: 1px;
        text-transform: uppercase; margin-bottom: 12px; font-family: 'Space Mono', monospace;
      }
      .event-tags { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
      .tag {
        padding: 3px 10px; font-family: 'Space Mono', monospace; font-size: 9px;
        letter-spacing: 1.5px; text-transform: uppercase; border: 1px solid; font-weight: 700;
      }
      .tag-talks { color: var(--tag-talks); border-color: var(--tag-talks); }
      .tag-live { color: var(--tag-live); border-color: var(--tag-live); }
      .tag-night { color: var(--tag-night); border-color: var(--tag-night); }
      .tag-type { color: var(--muted); border-color: var(--border); font-weight: 400; }

      .empty-state { padding: 80px 32px; text-align: center; color: var(--muted); }
      .empty-state h3 { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 3px; margin-bottom: 8px; color: var(--border); }

      /* ── DETAIL VIEW ── */
      .back-bar { padding: 16px 40px; border-bottom: 1px solid var(--border); }
      .back-btn {
        display: inline-flex; align-items: center; gap: 10px;
        font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 2px;
        text-transform: uppercase; color: var(--muted); cursor: pointer;
        background: none; border: none; transition: color 0.15s;
      }
      .back-btn:hover { color: var(--accent-lime); }
      .back-btn:hover svg { transform: translateX(-3px); }
      .back-btn svg { transition: transform 0.15s; }

      .detail-page {
        display: grid; grid-template-columns: 1fr 360px; gap: 0;
        max-width: 1200px; margin: 0 auto; padding: 48px 40px; align-items: start;
      }
      .detail-left { padding-right: 64px; }

      .hero {
        background: var(--surface); border: 1px solid var(--border);
        padding: 36px; margin-bottom: 32px; position: relative; overflow: hidden;
      }
      .hero::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--accent-lime); }

      .event-title-detail {
        font-family: 'Bebas Neue', sans-serif; font-size: 48px;
        letter-spacing: 3px; line-height: 1.05; margin-bottom: 24px;
      }
      .event-meta-row { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 8px; }

      .speaker-card {
        display: flex; align-items: center; gap: 16px;
        background: var(--surface2); border: 1px solid var(--border);
        padding: 16px 20px; margin-top: 20px;
      }
      .speaker-avatar {
        width: 56px; height: 56px; background: var(--border); border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; flex-shrink: 0; border: 1px solid var(--border); overflow: hidden;
      }
      .speaker-name { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; margin-bottom: 3px; }
      .speaker-role { font-size: 12px; color: var(--muted); font-family: 'Space Mono', monospace; letter-spacing: 0.5px; }

      .section { margin-top: 40px; }
      .section-title {
        font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px;
        margin-bottom: 16px; color: var(--text); display: flex; align-items: center; gap: 12px;
      }
      .section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }
      .description { font-size: 15px; line-height: 1.75; color: #bbb; max-width: 680px; }

      /* ── DETAIL SIDEBAR ── */
      .detail-sidebar { position: sticky; top: 20px; }
      .sidebar-card { background: var(--surface); border: 1px solid var(--border); padding: 28px; margin-bottom: 16px; }
      .sidebar-heading {
        font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 3px;
        margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border);
      }
      .detail-row {
        display: flex; justify-content: space-between; align-items: baseline;
        padding: 11px 0; border-bottom: 1px solid var(--border); gap: 16px;
      }
      .detail-row:last-child { border-bottom: none; }
      .detail-key {
        font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 2px;
        text-transform: uppercase; color: var(--muted); flex-shrink: 0;
      }
      .detail-val {
        font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 1px;
        text-transform: uppercase; color: var(--text); text-align: right;
      }
      .tags-list { display: flex; flex-wrap: wrap; gap: 6px; }
      .sidebar-tag {
        padding: 5px 12px; border: 1px solid var(--border);
        font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 1.5px;
        text-transform: uppercase; color: var(--muted); cursor: default; transition: all 0.15s;
      }

      /* ── RELATED EVENTS ── */
      .related-event {
        display: grid; grid-template-columns: 60px 1fr; gap: 16px;
        padding: 16px 0; border-bottom: 1px solid var(--border);
        cursor: pointer; transition: background 0.15s; color: inherit;
      }
      .related-event:hover .related-title { color: var(--accent-lime); }
      .related-img {
        width: 60px; height: 60px; background: var(--surface); border: 1px solid var(--border);
        display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;
      }
      .related-meta {
        font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 1px;
        color: var(--muted); text-transform: uppercase; margin-bottom: 5px;
      }
      .related-title { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 1.5px; transition: color 0.15s; line-height: 1.1; }
      .related-tag {
        display: inline-block; margin-top: 6px; padding: 2px 8px;
        font-family: 'Space Mono', monospace; font-size: 8px; letter-spacing: 1.5px;
        text-transform: uppercase; border: 1px solid; font-weight: 700;
      }

      /* ── SCROLLBAR ── */
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: var(--black); }
      ::-webkit-scrollbar-thumb { background: var(--border); }

      /* ── MOBILE ── */
      @media (max-width: 768px) {
        .category-bar { padding: 12px 20px; }
        .main { grid-template-columns: 1fr; }
        .sidebar { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--border); padding: 20px; }
        .event-card { grid-template-columns: 72px 1fr; gap: 16px; padding: 16px 20px; }
        .event-img { width: 72px; height: 72px; font-size: 24px; }
        img.event-img { width: 72px; height: 72px; }
        .event-title { font-size: 18px; }
        .time-divider { padding: 10px 20px; }
        .back-bar { padding: 12px 20px; }
        .detail-page { grid-template-columns: 1fr; padding: 24px 20px; }
        .detail-left { padding-right: 0; margin-bottom: 32px; }
        .event-title-detail { font-size: 34px; }
        .detail-sidebar { position: static; }
      }
    `
  }
}

customElements.define('turf-programma', TurfProgramma)

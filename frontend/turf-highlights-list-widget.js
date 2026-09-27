class TurfHighlightsList extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.events = []
    this.currentView = 'list' // 'list' | 'detail'
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

  get dagLabels() {
    const en = this.lang === 'en'
    return {
      dag1: { short: en ? 'THU 26/11' : 'DO 26/11', full: en ? 'Thursday 26 November 2026' : 'Donderdag 26 november 2026' },
      dag2: { short: en ? 'FRI 27/11' : 'VR 27/11', full: en ? 'Friday 27 November 2026'   : 'Vrijdag 27 november 2026'   },
      dag3: { short: en ? 'SAT 28/11' : 'ZA 28/11', full: en ? 'Saturday 28 November 2026' : 'Zaterdag 28 november 2026'  },
    }
  }

  get themaLabels() {
    const en = this.lang === 'en'
    return {
      talks: en ? 'TURF Talks' : 'TURF Talks',
      live:  en ? 'TURF Live'  : 'TURF Live',
      night: en ? 'TURF by Night' : 'TURF by Night',
    }
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

    this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="root"><div class="loading">Laden…</div></div>`

    await this.loadEvents()

    // Hash-based routing
    const hash = window.location.hash.slice(1)
    const hashId = this.resolveHash(hash)
    if (hashId) {
      this.renderDetail(hashId)
    } else {
      this.renderList()
    }

    window.addEventListener('popstate', () => {
      const h = window.location.hash.slice(1)
      const id = this.resolveHash(h)
      if (id) { this.renderDetail(id) } else { this.renderList() }
    })
  }

  async sanityFetch(query, params) {
    let url = `${this.cdnUrl}?query=${encodeURIComponent(query)}`
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url += `&$${k}=${encodeURIComponent(JSON.stringify(v))}`
      }
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
        "beschrijving": ${this.localeField('beschrijving')},
        dag, startTijd, eindTijd,
        "themaSlug": thema->slug,
        "themaNaam": thema->naam,
        "locatieNaam": locatie->naam,
        "sprekers": sprekers[]->{ naam },
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
        title: e.titel || '',
        dag: e.dag,
        startTime: e.startTijd || '',
        endTime: e.eindTijd || '',
        location: e.locatieNaam || '',
        theme: e.themaSlug || 'talks',
        themeName: e.themaNaam || '',
        speakers: (e.sprekers || []).map(s => s.naam).filter(Boolean),
        image: e.afbeelding || '',
        desc,
      }
    })
  }

  renderList() {
    this.currentView = 'list'
    const root = this.shadowRoot.querySelector('.root')
    root.innerHTML = `
      ${this.attrHeading ? `<h2 class="widget-heading">${this.attrHeading}</h2>` : ''}
      <div class="event-list">
        ${this.events.length === 0
          ? `<div class="empty">Geen uitgelichte events gevonden</div>`
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
            <span class="card-cta">Lees meer →</span>
          </div>
        </div>
      </div>
    `
  }

  async renderDetail(eventId) {
    this.currentView = 'detail'
    const root = this.shadowRoot.querySelector('.root')
    root.innerHTML = `<div class="loading">Laden…</div>`

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
    const themeLabel = this.themaLabels[theme] || e.themaNaam || theme
    const backLabel = this.attrHeading
      ? `← ${this.attrHeading}`
      : (this.lang === 'en' ? '← Back' : '← Terug')

    const sprekersHtml = e.sprekers && e.sprekers.length > 0
      ? `<div class="speakers-section">
          ${e.sprekers.map(sp => `
            <div class="speaker-card">
              <div class="speaker-avatar">${sp.foto ? `<img src="${sp.foto}?w=160&h=160&fit=crop" alt="${sp.naam}">` : '🎙️'}</div>
              <div>
                <div class="speaker-name">${sp.naam}</div>
                ${sp.rol || sp.organisatie ? `<div class="speaker-role">${[sp.rol, sp.organisatie].filter(Boolean).join(' · ')}</div>` : ''}
              </div>
            </div>`).join('')}
        </div>`
      : ''

    const beschrijving = e.beschrijving
      ? e.beschrijving.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')
      : ''

    const mapsKey = this.cfg.googleMapsApiKey || 'AIzaSyBKtiBfiuLmG_td0BKfK6XABATDe8P1YPw'
    const mapQuery = encodeURIComponent(`${e.locatieNaam}${e.locatieAdres ? ', ' + e.locatieAdres : ', Breda'}`)
    const mapHtml = `<div class="map-container"><iframe src="https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${mapQuery}&zoom=15" allowfullscreen loading="lazy"></iframe></div>`

    root.innerHTML = `
      <div class="back-bar">
        <button class="back-btn" id="backBtn">${backLabel}</button>
      </div>
      <div class="detail-page">
        <div class="detail-main">
          ${e.afbeelding ? (() => {
            const ratio = e.afbeeldingRatio
            const isLandscape = ratio && ratio > 1
            const imgSrc = isLandscape ? `${e.afbeelding}?w=1200&fit=max` : `${e.afbeelding}?w=800&h=800&fit=crop`
            const imgStyle = isLandscape
              ? `width:100%;aspect-ratio:${ratio.toFixed(4)};object-fit:cover;display:block;`
              : `width:100%;aspect-ratio:1;object-fit:cover;display:block;`
            return `<div class="hero-image"><img src="${imgSrc}" alt="${e.titel}" style="${imgStyle}"></div>`
          })() : ''}
          <div class="hero">
            <h1 class="event-title-detail">${e.titel}</h1>
            <div class="event-meta-row">
              <span class="meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
                ${dag.full}
              </span>
              <span class="meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
                ${timeStr}
              </span>
              <span class="meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                ${e.locatieNaam}${e.locatieAdres ? ' — ' + e.locatieAdres : ''}
              </span>
            </div>
            ${sprekersHtml}
          </div>
          ${beschrijving ? `<div class="detail-section"><h2 class="section-title">Over dit event</h2><p class="description">${beschrijving}</p></div>` : ''}
          <div class="detail-section"><h2 class="section-title">Locatie</h2>${mapHtml}</div>
        </div>
        <aside class="detail-sidebar">
          <div class="sidebar-card">
            <div class="sidebar-heading">Details</div>
            <div class="detail-row"><span class="detail-key">Thema</span><span class="detail-val">${themeLabel}</span></div>
            ${e.type ? `<div class="detail-row"><span class="detail-key">Type</span><span class="detail-val">${e.type}</span></div>` : ''}
            <div class="detail-row"><span class="detail-key">Datum</span><span class="detail-val">${dag.full?.replace(' 2026', '') || ''}</span></div>
            <div class="detail-row"><span class="detail-key">Tijd</span><span class="detail-val">${timeStr}</span></div>
            <div class="detail-row"><span class="detail-key">Locatie</span><span class="detail-val">${e.locatieNaam}</span></div>
            ${e.gratis ? `<div class="detail-row"><span class="detail-key">Toegang</span><span class="detail-val" style="color:#c8f04a">Gratis</span></div>` : ''}
          </div>
          ${e.aanmelding && e.aanmeldLink ? `<a class="signup-btn" href="${e.aanmeldLink}" target="_blank" rel="noopener">Aanmelden ↗</a>` : ''}
        </aside>
      </div>
    `

    root.querySelector('#backBtn')?.addEventListener('click', () => {
      window.history.pushState(null, '', window.location.pathname + window.location.search)
      this.renderList()
    })

    root.scrollTop = 0
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
        color: var(--text);
        font-family: var(--font-body);
      }

      .loading {
        padding: 80px 0;
        text-align: center;
        font-size: 14px;
        font-weight: 500;
        color: var(--muted);
      }

      /* ── WIDGET HEADING ── */
      .widget-heading {
        font-family: var(--font-heading);
        font-size: clamp(36px, 6vw, 64px);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--text);
        margin-bottom: 32px;
        line-height: 1;
      }

      /* ── LIST ── */
      .event-list {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

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

      .card-img {
        width: 320px;
        height: 220px;
        object-fit: cover;
        display: block;
      }

      .card-img-placeholder {
        width: 320px;
        height: 220px;
        background: rgba(255,255,255,0.04);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card-img-icon { font-size: 56px; opacity: 0.15; }

      .card-content {
        padding: 24px 28px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0;
      }

      .card-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 10px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--muted);
      }
      .sep { margin: 0 8px; opacity: 0.3; }

      .card-title {
        font-family: var(--font-heading);
        font-size: clamp(32px, 4vw, 48px);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        line-height: 1;
        color: var(--text);
        margin-bottom: 10px;
      }

      .card-speakers {
        font-size: 14px;
        font-weight: 500;
        color: var(--muted);
        margin-bottom: 8px;
      }

      .card-desc {
        font-size: 14px;
        line-height: 1.6;
        color: rgba(255,255,255,0.6);
        max-width: 480px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin-bottom: 12px;
      }

      .card-footer {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: auto;
      }

      .theme-pill {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        border-radius: var(--radius);
        border: 1px solid var(--border);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        background: rgba(255,255,255,0.05);
        color: var(--muted);
      }
      .theme-pill--talks { border-color: rgba(232,93,58,0.4); color: var(--tag-talks); background: rgba(232,93,58,0.1); }
      .theme-pill--live  { border-color: rgba(217,64,128,0.4); color: var(--tag-live);  background: rgba(217,64,128,0.1); }
      .theme-pill--night { border-color: rgba(155,59,245,0.4); color: var(--tag-night); background: rgba(155,59,245,0.1); }

      .card-cta {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255,255,255,0.35);
        margin-left: auto;
        transition: color 0.15s;
      }
      .event-card:hover .card-cta { color: var(--text); }

      /* ── DETAIL BACK BAR ── */
      .back-bar {
        display: flex;
        align-items: center;
        padding: 16px 0 24px;
      }
      .back-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background: none;
        border: none;
        color: var(--text);
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 600;
        cursor: pointer;
        letter-spacing: 0.5px;
        padding: 0;
        text-transform: uppercase;
        transition: opacity 0.15s;
      }
      .back-btn:hover { opacity: 0.65; }

      /* ── DETAIL LAYOUT ── */
      .detail-page {
        display: grid;
        grid-template-columns: 1fr 280px;
        gap: 32px;
        max-width: 1100px;
      }

      .hero-image {
        border-radius: var(--radius-card);
        overflow: hidden;
        margin-bottom: 24px;
      }

      .hero { margin-bottom: 28px; }

      .event-title-detail {
        font-family: var(--font-heading);
        font-size: clamp(44px, 7vw, 78px);
        font-weight: 700;
        line-height: 1.0;
        margin-bottom: 16px;
        color: var(--text);
        text-transform: uppercase;
      }

      .event-meta-row {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 14px;
        color: var(--muted);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .speakers-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 20px;
      }
      .speaker-card {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .speaker-avatar {
        width: 48px; height: 48px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--surface);
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      }
      .speaker-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .speaker-name { font-weight: 600; font-size: 15px; margin-bottom: 2px; }
      .speaker-role { font-size: 13px; color: var(--muted); }

      .detail-section { margin-bottom: 32px; }
      .section-title {
        font-family: var(--font-heading);
        font-size: 18px;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 14px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        border-bottom: 1px solid var(--border);
        padding-bottom: 8px;
      }
      .description {
        font-size: 16px;
        line-height: 1.75;
        color: rgba(255,255,255,0.8);
      }

      .map-container { border-radius: var(--radius-card); overflow: hidden; }
      .map-container iframe { width: 100%; height: 280px; border: none; display: block; }

      /* ── SIDEBAR ── */
      .detail-sidebar { display: flex; flex-direction: column; gap: 16px; }
      .sidebar-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 20px;
      }
      .sidebar-heading {
        font-family: var(--font-heading);
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 14px;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .detail-row:last-child { border-bottom: none; }
      .detail-key {
        font-size: 13px;
        color: var(--muted);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .detail-val { font-size: 13px; font-weight: 600; text-align: right; }

      .signup-btn {
        display: block;
        text-align: center;
        padding: 14px 24px;
        background: var(--accent);
        color: #fff;
        font-family: var(--font-heading);
        font-size: 20px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        border-radius: var(--radius);
        text-decoration: none;
        transition: opacity 0.15s;
      }
      .signup-btn:hover { opacity: 0.85; }

      /* ── SCROLLBAR ── */
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

      /* ── MOBILE ── */
      @media (max-width: 768px) {
        .event-card { grid-template-columns: 1fr; }
        .card-img { width: 100%; height: 200px; }
        .card-img-placeholder { width: 100%; height: 200px; }
        .card-content { padding: 16px 20px; }
        .card-title { font-size: 32px; }

        .detail-page { grid-template-columns: 1fr; gap: 20px; }
        .detail-sidebar { order: -1; }
        .event-title-detail { font-size: clamp(36px, 9vw, 60px); }
      }
    `
  }
}

customElements.define('turf-highlights-list', TurfHighlightsList)

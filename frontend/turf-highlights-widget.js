class TurfHighlights extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.events = []
  }

  get cfg() { return typeof TURF_CONFIG !== 'undefined' ? TURF_CONFIG : {} }
  get projectId() { return this.getAttribute('project-id') || this.cfg.sanityProjectId || 'x545nfex' }
  get dataset() { return this.getAttribute('dataset') || this.cfg.sanityDataset || 'production' }
  get cdnUrl() { return `https://${this.projectId}.api.sanity.io/v2024-01-01/data/query/${this.dataset}` }

  get baseUrl() {
    const script = document.querySelector('script[src*="turf-highlights-widget"]')
    if (script) return script.src.substring(0, script.src.lastIndexOf('/') + 1)
    return ''
  }

  // Kleur per thema (voor categorie-label)
  get themaConfig() {
    return {
      talks:   { label: 'Talks',   color: '#f5a623' },
      live:    { label: 'Live',    color: '#f5a623' },
      night:   { label: 'By Night',color: '#f5a623' },
      culture: { label: 'Culture', color: '#b066f5' },
    }
  }

  async connectedCallback() {
    this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="root"><div class="loading">Laden…</div></div>`
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
        _id, titel, dag,
        "themaSlug": thema->slug,
        "themaNaam": thema->naam,
        "afbeelding": afbeelding.asset->url
      }
    `)

    const dagLabels = {
      dag1: 'DO 26/11',
      dag2: 'VR 27/11',
      dag3: 'ZA 28/11',
    }

    this.events = (raw || []).map(e => ({
      _id: e._id,
      title: e.titel,
      dag: dagLabels[e.dag] || e.dag || '',
      theme: e.themaSlug || 'talks',
      themeName: e.themaNaam || '',
      image: e.afbeelding || '',
    }))
  }

  render() {
    const root = this.shadowRoot.querySelector('.root')

    if (!this.events.length) {
      root.innerHTML = ''
      return
    }

    root.innerHTML = `
      <div class="track">
        ${this.events.map(e => this.renderCard(e)).join('')}
      </div>
    `
  }

  renderCard(e) {
    const cfg = this.themaConfig[e.theme]
    const label = cfg?.label || e.themeName || e.theme
    const color = cfg?.color || '#f5a623'

    const bgStyle = e.image
      ? `background-image: url('${e.image}?w=480&h=720&fit=crop')`
      : ''

    return `
      <div class="card ${!e.image ? 'card-no-photo' : ''}">
        <div class="card-bg" style="${bgStyle}"></div>
        <div class="card-overlay"></div>
        ${!e.image ? '<div class="card-foto-label">FOTO</div>' : ''}
        <div class="card-content">
          <div class="card-category" style="color:${color}">${label.toUpperCase()}</div>
          <div class="card-title">${e.title}</div>
          <div class="card-date">${e.dag}</div>
        </div>
      </div>
    `
  }

  getStyles() {
    const base = this.baseUrl
    return `
      @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600&display=swap');

      @font-face {
        font-family: 'Thunder';
        src: url('${base}fonts/THUNDER/Thunder-BoldLC.woff2') format('woff2'),
             url('${base}fonts/THUNDER/Thunder-BoldLC.woff') format('woff');
        font-weight: 700;
        font-display: swap;
      }

      :host {
        display: block;
        --font-heading: 'Thunder', Impact, sans-serif;
        --font-body:    'Barlow', sans-serif;
        --card-w: 220px;
        --card-h: 340px;
        --radius: 18px;
        --gap: 12px;
      }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      .root {
        width: 100%;
        overflow: hidden;
      }

      /* ── LOADING ── */
      .loading {
        padding: 40px 0;
        font-family: var(--font-body);
        font-size: 13px;
        color: rgba(255,255,255,0.5);
      }

      /* ── HORIZONTALE SCROLLRIJ ── */
      .track {
        display: flex;
        gap: var(--gap);
        overflow-x: auto;
        overflow-y: visible;
        padding-bottom: 12px;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none; /* Firefox */
      }
      .track::-webkit-scrollbar { display: none; }

      /* ── KAART ── */
      .card {
        flex: 0 0 var(--card-w);
        height: var(--card-h);
        border-radius: var(--radius);
        position: relative;
        overflow: hidden;
        scroll-snap-align: start;
        cursor: default;
      }

      /* foto-achtergrond */
      .card-bg {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center top;
        transition: transform 0.4s ease;
      }
      .card:hover .card-bg { transform: scale(1.05); }

      /* placeholder-patroon voor kaarten zonder foto */
      .card-no-photo .card-bg {
        background-image: repeating-linear-gradient(
          -45deg,
          rgba(255,255,255,0.03) 0px,
          rgba(255,255,255,0.03) 1px,
          transparent 1px,
          transparent 12px
        );
        background-color: #1a1a1a;
      }

      /* gradient overlay onderaan */
      .card-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to top,
          rgba(0,0,0,0.85) 0%,
          rgba(0,0,0,0.3)  45%,
          rgba(0,0,0,0)    75%
        );
      }
      .card-no-photo .card-overlay {
        background: linear-gradient(
          to top,
          rgba(0,0,0,0.75) 0%,
          rgba(0,0,0,0.1)  60%,
          rgba(0,0,0,0)    100%
        );
      }

      /* FOTO label voor placeholders */
      .card-foto-label {
        position: absolute;
        top: 16px;
        left: 18px;
        font-family: var(--font-body);
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: rgba(255,255,255,0.2);
        z-index: 1;
      }

      /* ── INHOUD ── */
      .card-content {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 0 18px 20px;
        z-index: 1;
      }

      .card-category {
        font-family: var(--font-body);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        margin-bottom: 6px;
        line-height: 1;
      }

      .card-title {
        font-family: var(--font-heading);
        font-size: 36px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        line-height: 0.9;
        color: #ffffff;
        margin-bottom: 8px;
      }

      .card-date {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        color: rgba(255,255,255,0.5);
        text-transform: uppercase;
      }

      /* ── RESPONSIVE ── */
      @media (min-width: 1200px) {
        :host { --card-w: 240px; --card-h: 370px; }
        .card-title { font-size: 40px; }
      }

      @media (max-width: 600px) {
        :host { --card-w: 180px; --card-h: 290px; --gap: 10px; }
        .card-title { font-size: 30px; }
        .card-content { padding: 0 14px 16px; }
      }
    `
  }
}

customElements.define('turf-highlights', TurfHighlights)

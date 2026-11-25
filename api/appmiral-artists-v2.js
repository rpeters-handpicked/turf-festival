const SANITY_PROJECT_ID = 'x545nfex'
const SANITY_DATASET = 'production'

// Festivaldagen → UTC datum (November = CET = UTC+1)
const DAG_DATE = {
  dag1: '2026-11-26',
  dag2: '2026-11-27',
  dag3: '2026-11-28',
}

// Thema-slug → Appmiral category
const THEMA_CATEGORY = {
  talks:   'regular',
  live:    'featured',
  night:   'headliner',
  culture: 'regular',
}

/**
 * Zet een lokale tijd (HH:MM, CET = UTC+1) om naar Appmiral UTC-formaat.
 * Als eindTijd vóór startTijd valt → event loopt door na middernacht → +1 dag.
 */
function toUtc(dagKey, timeStr, { isEnd = false, startStr = null } = {}) {
  const date = DAG_DATE[dagKey]
  if (!date || !timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return undefined

  let [h, m] = timeStr.split(':').map(Number)

  // Nacht-correctie: eindtijd vroeger dan starttijd → dag over middernacht
  let dayOffset = 0
  if (isEnd && startStr) {
    const [sh] = startStr.split(':').map(Number)
    if (h < sh) dayOffset = 1
  }

  // CET → UTC: −1 uur; als dat negatief wordt, vorige dag
  let utcH = h - 1
  if (utcH < 0) { utcH += 24; dayOffset -= 1 }

  const base = new Date(date + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() + dayOffset)
  const utcDate = base.toISOString().slice(0, 10)

  return `${utcDate} ${String(utcH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const eventQuery = `
    *[_type == "event" && gepubliceerd == true && negeerAppmiral != true] | order(dag asc, startTijd asc) {
      _id,
      titel,
      beschrijving,
      dag,
      startTijd,
      eindTijd,
      type,
      tags,
      "themaSlug": thema->slug,
      "themaNaam": thema->naam,
      "trackSlug": track->slug.current,
      "locatieId": locatie->_id,
      "locatieNaam": locatie->naam,
      "afbeelding": afbeelding.asset->url,
      "sprekerIds": sprekers[]._ref
    }
  `

  const sprekerQuery = `
    *[_type == "spreker"] | order(naam asc) {
      _id,
      naam,
      rol,
      bio,
      type,
      "foto": foto.asset->url,
      website,
      instagram
    }
  `

  try {
    const baseUrl = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/${SANITY_DATASET}`
    const [eventRes, sprekerRes] = await Promise.all([
      fetch(`${baseUrl}?query=${encodeURIComponent(eventQuery)}`),
      fetch(`${baseUrl}?query=${encodeURIComponent(sprekerQuery)}`),
    ])
    const [eventData, sprekerData] = await Promise.all([eventRes.json(), sprekerRes.json()])

    // Normaliseer locale velden: plain string → { nl: string }, localeObject → strip _type
    // Vult altijd 'en' in als fallback op 'nl' — Appmiral vereist Engels als standaardtaal
    const toLocale = v => {
      if (!v) return undefined
      if (typeof v === 'string') return { nl: v, en: v }
      const { _type, ...langs } = v
      if (!Object.keys(langs).length) return undefined
      if (langs.nl && !langs.en) langs.en = langs.nl
      return langs
    }

    const events = eventData.result || []
    const sprekers = sprekerData.result || []

    // Bouw reverse-index: sprekerID → lijst van eventIDs
    const sprekerToEvents = {}
    for (const event of events) {
      for (const sid of (event.sprekerIds || [])) {
        if (!sprekerToEvents[sid]) sprekerToEvents[sid] = []
        sprekerToEvents[sid].push(event._id)
      }
    }

    // Events als Appmiral artist-entries
    const eventEntries = events.map((event, index) => {
      const start = toUtc(event.dag, event.startTijd)
      const end   = toUtc(event.dag, event.eindTijd, { isEnd: true, startStr: event.startTijd })

      // Tip uit documentatie: als tijd nog onbekend, gebruik zelfde start én eindtijd op die dag
      const perfStart = start ?? toUtc(event.dag, '00:00')
      const perfEnd   = end   ?? perfStart

      const performance = {
        id:              `${event._id}-perf`,
        stage_id:        event.locatieId,
        show_in_schedule: true,
        show_in_lineup:   true,
        show_in_calendar: true,
      }
      if (perfStart) performance.start_time = perfStart
      if (perfEnd)   performance.end_time   = perfEnd

      const artist = {
        id:       event._id,
        name:     toLocale(event.titel),
        priority: index + 1,
        category: THEMA_CATEGORY[event.themaSlug] ?? 'regular',
        performances: [performance],
        show_in_artists: true,
      }

      const desc = toLocale(event.beschrijving)
      if (desc) artist.description = desc
      if (event.afbeelding) artist.image = `${event.afbeelding}?w=1500&h=1500&fit=crop`

      // Tag 'event' als eerste, gevolgd door thema/track/type tags
      const tags = ['event']
      if (event.themaSlug)  tags.push(event.themaSlug)
      if (event.trackSlug)  tags.push(event.trackSlug)
      if (event.type)       tags.push(event.type.toLowerCase().replace(/\s+/g, '-'))
      if (event.tags?.length) tags.push(...event.tags.map(t => t.toLowerCase().replace(/\s+/g, '-')))
      artist.tags = [...new Set(tags)]

      // Koppel sprekers via related
      if (event.sprekerIds?.length) artist.related = event.sprekerIds

      return artist
    })

    // Sprekers/artiesten als Appmiral artist-entries (geen performances)
    const sprekerEntries = sprekers.map((spr, index) => {
      const entry = {
        id:              spr._id,
        name:            { nl: spr.naam, en: spr.naam },
        priority:        events.length + index + 1,
        show_in_artists: true,
      }

      const bio = toLocale(spr.bio)
      if (bio) entry.description = bio
      if (spr.foto)      entry.image     = `${spr.foto}?w=1500&h=1500&fit=crop`
      if (spr.website)   entry.website   = spr.website
      if (spr.instagram) entry.instagram = `https://instagram.com/${spr.instagram.replace(/^@/, '')}`

      // Tag op basis van type veld ('spreker' of 'artiest')
      entry.tags = spr.type ? [spr.type] : []

      // Koppel events via related
      const eventIds = sprekerToEvents[spr._id]
      if (eventIds?.length) entry.related = eventIds

      return entry
    })

    res.status(200).json({ artists: [...eventEntries, ...sprekerEntries] })
  } catch (err) {
    console.error('Appmiral artists error:', err)
    res.status(500).json({ error: 'Failed to fetch events from Sanity' })
  }
}

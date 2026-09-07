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
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')

  const query = `
    *[_type == "event" && gepubliceerd == true] | order(dag asc, startTijd asc) {
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
      "locatieId": locatie->_id,
      "locatieNaam": locatie->naam,
      "afbeelding": afbeelding.asset->url
    }
  `

  try {
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/${SANITY_DATASET}?query=${encodeURIComponent(query)}`
    const response = await fetch(url)
    const data = await response.json()

    const artists = (data.result || []).map((event, index) => {
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
        name:     event.titel,
        priority: index + 1,
        category: THEMA_CATEGORY[event.themaSlug] ?? 'regular',
        performances: [performance],
        show_in_artists: true,
      }

      if (event.beschrijving) artist.description = event.beschrijving
      // Minimaal 1500×1500 vereist door Appmiral
      if (event.afbeelding)   artist.image       = `${event.afbeelding}?w=1500&h=1500&fit=crop`

      // Thema + eventtype als tags
      const tags = []
      if (event.themaSlug) tags.push(event.themaSlug)
      if (event.type)      tags.push(event.type.toLowerCase().replace(/\s+/g, '-'))
      if (event.tags?.length) tags.push(...event.tags.map(t => t.toLowerCase().replace(/\s+/g, '-')))
      if (tags.length) artist.tags = [...new Set(tags)]

      return artist
    })

    res.status(200).json({ artists })
  } catch (err) {
    console.error('Appmiral artists error:', err)
    res.status(500).json({ error: 'Failed to fetch events from Sanity' })
  }
}

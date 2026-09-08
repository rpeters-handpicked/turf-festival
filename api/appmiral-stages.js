const SANITY_PROJECT_ID = 'x545nfex'
const SANITY_DATASET = 'production'

// Locatie-type → prioriteit volgorde
const TYPE_PRIORITY = { club: 1, theater: 2, outdoor: 3, galerie: 4, overig: 5 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const query = `
    *[_type == "locatie"] | order(naam asc) {
      _id,
      naam,
      beschrijving,
      type,
      capaciteit,
      "afbeelding": afbeelding.asset->url
    }
  `

  try {
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/${SANITY_DATASET}?query=${encodeURIComponent(query)}`
    const response = await fetch(url)
    const data = await response.json()

    const stages = (data.result || []).map((loc, index) => {
      const stage = {
        id: loc._id,
        name: loc.naam,
        priority: (TYPE_PRIORITY[loc.type] ?? 10) * 10 + index,
      }

      // Normaliseer locale veld: plain string → { nl: string }, object → doorsturen
      const desc = loc.beschrijving
        ? (typeof loc.beschrijving === 'string' ? { nl: loc.beschrijving } : loc.beschrijving)
        : undefined
      if (desc) stage.description = desc
      if (loc.capaciteit)   stage.capacity    = String(loc.capaciteit)
      // Minimaal 1500×1500 vereist door Appmiral
      if (loc.afbeelding)   stage.image       = `${loc.afbeelding}?w=1500&h=1500&fit=crop`

      return stage
    })

    res.status(200).json({ stages })
  } catch (err) {
    console.error('Appmiral stages error:', err)
    res.status(500).json({ error: 'Failed to fetch stages from Sanity' })
  }
}

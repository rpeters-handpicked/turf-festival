const WEBFLOW_COLLECTION_ID = '66ffbef1b74c5df12ef25138'
const WEBFLOW_API_BASE = 'https://api.webflow.com/v2'

// Webflow type option ID → Appmiral tag
const TYPE_TAGS = {
  c355713da19199dec5d1fef0a3416bad: { slug: 'news',      name: { nl: 'Nieuws',    en: 'News'      }, color: '#c8f53b', text_color: '#0a0a0a' },
  '6073648131af800d0ea58a2388e8de0f': { slug: 'interview', name: { nl: 'Interview', en: 'Interview' }, color: '#3b8bf5', text_color: '#ffffff' },
  '6b5e045392079e3f0897db3a19686b81': { slug: 'story',     name: { nl: 'Verhaal',  en: 'Story'     }, color: '#9b3bf5', text_color: '#ffffff' },
  a60b70014ae7add081f030fb736e6413: { slug: 'guide',     name: { nl: 'Tips',     en: 'Guide'     }, color: '#f5a53b', text_color: '#0a0a0a' },
}


function toAppmiral(isoStr) {
  if (!isoStr) return undefined
  return new Date(isoStr).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z')
}

async function fetchAllItems(apiKey) {
  const items = []
  let offset = 0
  const limit = 100

  while (true) {
    const url = `${WEBFLOW_API_BASE}/collections/${WEBFLOW_COLLECTION_ID}/items?limit=${limit}&offset=${offset}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, 'accept-version': '1.0.0' },
    })
    if (!res.ok) throw new Error(`Webflow API error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    items.push(...data.items)
    if (items.length >= data.pagination.total) break
    offset += limit
  }

  return items
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const apiKey = process.env.WEBFLOW_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'WEBFLOW_API_KEY not configured' })
  }

  try {
    const allItems = await fetchAllItems(apiKey)

    // Filter: only published, non-archived, non-draft items
    const published = allItems.filter(item => !item.isArchived && !item.isDraft && item.lastPublished)

    const cards = published
      .sort((a, b) => new Date(b.lastPublished) - new Date(a.lastPublished))
      .map((item, index) => {
        const f = item.fieldData
        const slug = f.slug || item.id

        const title = f.titel || f.name
        const body  = f['page-content'] || f.intro || ''
        const url   = `https://www.turf-event.nl/updates/${slug}`

        const card = {
          id:             `card-${slug}`,
          title:          { nl: title, en: title },
          priority:       index + 1,
          description:    { nl: body, en: body },
          show_from_time: toAppmiral(f.datum || item.lastPublished),
          published_time: toAppmiral(item.lastPublished),
          author:         'TURF',
          link:           { nl: url, en: url },
        }

        if (f['cover-image']?.url) {
          card.image = f['cover-image'].url
        }

        const tag = TYPE_TAGS[f.type]
        if (tag) {
          card.tags = [tag]
        }

        return card
      })

    res.status(200).json({ cards })
  } catch (err) {
    console.error('Appmiral cards error:', err)
    res.status(500).json({ error: 'Failed to fetch updates from Webflow' })
  }
}

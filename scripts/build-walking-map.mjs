#!/usr/bin/env node
/**
 * Bouwt de walking map voor de narrowcasting uit OpenStreetMap-data.
 *
 *   node scripts/build-walking-map.mjs
 *
 * Schrijft:
 *   frontend/narrowcasting/assets/walking-map.svg   gestileerde stratenkaart (coördinaten in meters)
 *   frontend/narrowcasting/walking-map-data.js      venues, looproutes en kaartmaten voor de player
 *
 * Alleen opnieuw draaien als de venues of het kaartgebied veranderen.
 * Kaartdata © OpenStreetMap-bijdragers (ODbL).
 */
import {writeFileSync} from 'node:fs'

// ── Invoer ───────────────────────────────────────────────────────────────────
// `label`: aan welke kant van de markering de naam staat (links/rechts), tegen overlap.
// `locaties`: Sanity-ID's van de locaties die bij deze venue horen. Daarmee weet
// een scherm waar het zelf staat ("U bent hier") en worden zalen samengevoegd.
const VENUES = [
  {key: 'grotekerk', naam: 'Grote Kerk', adres: 'Kerkplein 2', label: 'rechts', lat: 51.5889061, lon: 4.7753374,
    locaties: ['loc-20', '3aa72ed9-1d30-4822-8241-c6b9aebb352a']},
  {key: 'nassau', naam: 'Hotel Nassau', adres: 'Nieuwstraat 23', label: 'links', lat: 51.5868696, lon: 4.7741227,
    locaties: ['loc-19']},
  {key: 'avenue', naam: 'De Avenue', adres: 'Waterstraat 5', label: 'rechts', lat: 51.5865228, lon: 4.7746182,
    locaties: ['loc-18', '5a1fb3ba-ba32-4697-a473-bc5153250803']},
  {key: 'rooipannen', naam: 'De Rooi Pannen', adres: 'Fellenoordstraat 93', label: 'rechts', lat: 51.5850321, lon: 4.7732614,
    locaties: ['loc-17', '847a003f-5293-4d61-b69a-2a1c34e7a05d']},
]
// Kaartgebied: ruim om de venues heen, zodat er ook in staand formaat context is.
const RADIUS = 1100 // meter

const UA = 'turf-narrowcasting-map-build/1.0'
const OUT_SVG = 'frontend/narrowcasting/assets/walking-map.svg'
const OUT_JS = 'frontend/narrowcasting/walking-map-data.js'

// ── Projectie: lokale meters rond het midden (x naar oost, y naar zuid) ───────
const lat0 = VENUES.reduce((s, v) => s + v.lat, 0) / VENUES.length
const lon0 = VENUES.reduce((s, v) => s + v.lon, 0) / VENUES.length
const KX = 111320 * Math.cos((lat0 * Math.PI) / 180)
const KY = 110540
const project = (lat, lon) => [(lon - lon0) * KX, -(lat - lat0) * KY]
const r1 = n => Math.round(n * 10) / 10

const bbox = [lat0 - RADIUS / KY, lon0 - RADIUS / KX, lat0 + RADIUS / KY, lon0 + RADIUS / KX]

// ── OpenStreetMap ophalen ────────────────────────────────────────────────────
async function overpass() {
  const b = bbox.join(',')
  const query = `[out:json][timeout:90];
(
  way["highway"](${b});
  way["natural"="water"](${b});
  way["waterway"~"riverbank|canal|river|dock"](${b});
  relation["natural"="water"](${b});
  way["leisure"~"park|garden"](${b});
  way["landuse"~"grass|recreation_ground"](${b});
  way["railway"="rail"](${b});
);
out geom;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded'},
    body: 'data=' + encodeURIComponent(query),
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`)
  return (await res.json()).elements
}

async function route(a, b) {
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`
  const res = await fetch(url, {headers: {'User-Agent': UA}})
  if (!res.ok) throw new Error(`Routing ${res.status}`)
  const r = (await res.json()).routes[0]
  return {
    meters: Math.round(r.distance),
    // Wandeltempo van ~4,8 km/u, afgerond naar boven; minimaal 1 minuut.
    minuten: Math.max(1, Math.ceil(r.distance / 80)),
    d: 'M' + r.geometry.coordinates.map(([lon, lat]) => project(lat, lon).map(r1).join(',')).join('L'),
  }
}

// ── SVG opbouwen ─────────────────────────────────────────────────────────────
const STREET = {
  major: {match: /^(primary|secondary|tertiary|trunk)(_link)?$/, width: 16, opacity: 0.5},
  street: {match: /^(residential|unclassified|living_street|pedestrian|road)$/, width: 10, opacity: 0.38},
  service: {match: /^service$/, width: 6, opacity: 0.22},
  path: {match: /^(footway|path|cycleway|steps|track)$/, width: 4, opacity: 0.2},
}

const pathOf = geom => 'M' + geom.map(p => project(p.lat, p.lon).map(r1).join(',')).join('L')
const closed = g => g.length > 2 && g[0].lat === g.at(-1).lat && g[0].lon === g.at(-1).lon

function buildSvg(elements) {
  const layers = {water: [], waterline: [], green: [], squares: [], rail: [], major: [], street: [], service: [], path: []}
  for (const el of elements) {
    const t = el.tags || {}
    if (el.type === 'relation') {
      // Meervlak water (bijv. de Mark): alleen de buitenranden.
      const d = (el.members || []).filter(m => m.role === 'outer' && m.geometry).map(m => pathOf(m.geometry)).join('')
      if (d) layers.water.push(d)
      continue
    }
    if (!el.geometry) continue
    const d = pathOf(el.geometry)
    if (t.natural === 'water' || /riverbank|dock/.test(t.waterway || '')) layers.water.push(d + 'Z')
    else if (t.waterway) layers.waterline.push(d)
    else if (t.leisure || t.landuse) closed(el.geometry) && layers.green.push(d + 'Z')
    else if (t.railway) layers.rail.push(d)
    else if (t.highway) {
      if (t.area === 'yes' && closed(el.geometry)) {
        layers.squares.push(d + 'Z')
        continue
      }
      const kind = Object.entries(STREET).find(([, s]) => s.match.test(t.highway))?.[0]
      if (kind) layers[kind].push(d)
    }
  }
  const R = RADIUS
  const stroke = (kind, color = '#fff') =>
    `<path d="${layers[kind].join('')}" fill="none" stroke="${color}" stroke-opacity="${STREET[kind].opacity}" stroke-width="${STREET[kind].width}" stroke-linecap="round" stroke-linejoin="round"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-R} ${-R} ${2 * R} ${2 * R}" width="${2 * R}" height="${2 * R}">
<!-- Kaartdata © OpenStreetMap-bijdragers (ODbL). Gegenereerd door scripts/build-walking-map.mjs -->
<path d="${layers.green.join('')}" fill="#c8f04a" fill-opacity="0.07"/>
<path d="${layers.water.join('')}" fill="#7a2cf5" fill-opacity="0.55" fill-rule="evenodd"/>
<path d="${layers.waterline.join('')}" fill="none" stroke="#7a2cf5" stroke-opacity="0.55" stroke-width="8" stroke-linecap="round"/>
<path d="${layers.squares.join('')}" fill="#fff" fill-opacity="0.1"/>
<path d="${layers.rail.join('')}" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="5" stroke-dasharray="14 10"/>
${stroke('path')}
${stroke('service')}
${stroke('street')}
${stroke('major')}
</svg>`
}

// ── Draaien ──────────────────────────────────────────────────────────────────
const elements = await overpass()
const svg = buildSvg(elements)
writeFileSync(OUT_SVG, svg)
console.log(`${OUT_SVG}: ${elements.length} OSM-objecten, ${(svg.length / 1024).toFixed(0)} kB`)

const routes = {}
for (const a of VENUES) {
  for (const b of VENUES) {
    if (a === b) continue
    routes[`${a.key}>${b.key}`] = await route(a, b)
    await new Promise(r => setTimeout(r, 400)) // de publieke routeserver niet overbelasten
  }
}

const data = {
  radius: RADIUS,
  venues: VENUES.map(v => ({...v, xy: project(v.lat, v.lon).map(r1)})),
  routes,
}
writeFileSync(
  OUT_JS,
  `// Gegenereerd door scripts/build-walking-map.mjs — niet met de hand aanpassen.
// Kaartdata en looproutes © OpenStreetMap-bijdragers (ODbL).
export const WALKING_MAP = ${JSON.stringify(data, null, 2)}
`,
)
console.log(`${OUT_JS}: ${VENUES.length} venues, ${Object.keys(routes).length} routes`)
for (const [k, r] of Object.entries(routes)) console.log(`  ${k}: ${r.meters} m, ${r.minuten} min`)

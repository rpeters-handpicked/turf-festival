/**
 * TURF narrowcasting — festivaldagen en tijdvensters.
 * Pure functies (geen DOM), zodat ze los te testen zijn.
 */
export const FESTIVAL = {
  dates: {dag1: '2026-11-26', dag2: '2026-11-27', dag3: '2026-11-28'},
  // Tijden vóór dit uur horen bij de festivaldag ervoor (clubnachten).
  dayCutoffHour: 6,
}

export const pad = n => String(n).padStart(2, '0')
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toMinutes = t => {
  const [h, m] = String(t).split(':').map(Number)
  if (Number.isNaN(h)) return null
  return (h < FESTIVAL.dayCutoffHour ? h + 24 : h) * 60 + (m || 0)
}

/** De festivaldag die nu loopt (dag1/dag2/dag3) of null buiten het festival. */
export function currentDag(t) {
  const shifted = new Date(t.getTime() - FESTIVAL.dayCutoffHour * 3600e3)
  const iso = isoDate(shifted)
  return Object.keys(FESTIVAL.dates).find(k => FESTIVAL.dates[k] === iso) || null
}

/** De dag waarvan we het programma tonen: vandaag, anders de eerstvolgende (handig voor previews). */
export function displayDag(t) {
  const dag = currentDag(t)
  if (dag) return dag
  const iso = isoDate(t)
  const keys = Object.keys(FESTIVAL.dates)
  return keys.find(k => FESTIVAL.dates[k] > iso) || keys[keys.length - 1]
}

/** Minuten sinds 00:00 van de festivaldag (kan > 24u zijn na middernacht). */
export function minutesIntoDag(t, dag) {
  const base = new Date(`${FESTIVAL.dates[dag]}T00:00:00`)
  return (t.getTime() - base.getTime()) / 60000
}

/** Mag dit playlist-item nu getoond worden (dagen + tijdvenster)? */
export function isScheduled(item, t) {
  const dag = currentDag(t)
  if (item.dagen?.length && !item.dagen.includes(dag)) return false
  if (!item.van && !item.tot) return true
  if (!dag) return false
  const m = minutesIntoDag(t, dag)
  const van = item.van ? toMinutes(item.van) : 0
  let tot = item.tot ? toMinutes(item.tot) : 30 * 60
  if (tot <= van) tot += 24 * 60
  return m >= van && m < tot
}

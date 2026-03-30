# TURF Festival — Claude Code Briefing

Plak dit aan het begin van je Claude Code sessie. Claude Code leest dit en kent direct de volledige context.

---

## Project overzicht

**TURF** is een 3-daags stadsfestival in Breda op 26, 27 en 28 november 2026.
Thema's: elektronische muziek, kunst, cultuur en technologie.
Website: turf-event.nl (gebouwd in Webflow)

Het doel van deze sessie: het festival programma platform live krijgen.

---

## Wat er al staat

### Lokaal project
- **Pad:** `/Users/rob/turf-festival`
- **Type:** Sanity Studio (clean setup, geen framework eromheen)
- **Package manager:** npm
- **Node versie:** controleer met `node --version`

### Sanity schema's (al aangemaakt in `/schemaTypes/`)
Vier document types:
- `locatie` — naam, adres, capaciteit, type, beschrijving, afbeelding
- `thema` — naam, slug (talks/live/night), kleur, beschrijving
- `spreker` — naam, rol, organisatie, bio, foto, website, instagram
- `event` — titel, ondertitel, beschrijving, dag (dag1/dag2/dag3), startTijd, eindTijd, thema (ref), locatie (ref), sprekers (array ref), type, tags, gratis, aanmelding, gepubliceerd

### Data (nog niet geïmporteerd)
`import.js` staat klaar in de projectroot met:
- 3 thema's
- 20 locaties
- 15 sprekers
- 75 events

Import script vereist nog: `JOUW_PROJECT_ID` en `JOUW_WRITE_TOKEN` invullen bovenaan het bestand.

### Frontend (losse HTML bestanden, nog niet in dit project)
- `turf-programma.html` — programmaoverzicht met filters (dag/thema/locatie/zoeken)
- `turf-detail.html` — event detailpagina met speaker, beschrijving, sidebar
- Beide bestanden zijn gestyled in TURF huisstijl: zwart, Bebas Neue, lime groen (#c8f53b)
- Nog niet gekoppeld aan Sanity — draaien nu op dummy data

---

## Wat we vandaag willen doen

### Stap 1 — GitHub koppelen
- Check of git al geïnitialiseerd is (`git status`)
- Zo niet: `git init` en eerste commit
- Nieuwe private repo aanmaken op github.com/rob (of bestaande koppelen)
- Remote toevoegen en pushen

### Stap 2 — Online krijgen
**Sanity Studio deployen:**
```bash
npx sanity deploy
```
Kies naam: `turf-studio` → wordt bereikbaar op `turf-studio.sanity.studio`

**Frontend deployen op Vercel:**
- De twee HTML bestanden (`turf-programma.html` en `turf-detail.html`) moeten in dit project komen
- Vercel project aanmaken en koppelen aan GitHub repo
- Environment variables instellen in Vercel dashboard:
  - `SANITY_PROJECT_ID`
  - `SANITY_TOKEN`

**CORS instellen in Sanity:**
- sanity.io/manage → API → CORS Origins
- Toevoegen: je Vercel URL + `http://localhost:3333`

### Stap 3 — Data importeren
```bash
npm install @sanity/client
node --experimental-vm-modules import.js
```

---

## Technische context

### Sanity project
- **Project ID:** staat op sanity.io/manage (nog in te vullen door Rob)
- **Dataset:** production
- **Studio URL lokaal:** http://localhost:3333
- **Studio URL live:** turf-studio.sanity.studio (na deploy)

### GROQ query voor de frontend
```js
*[_type == "event" && gepubliceerd == true] | order(dag asc, startTijd asc) {
  _id, titel, ondertitel, beschrijving,
  dag, startTijd, eindTijd, type, tags, gratis,
  "thema": thema->{ naam, slug, kleur },
  "locatie": locatie->{ naam, adres },
  "sprekers": sprekers[]->{ naam, rol, organisatie, "foto": foto.asset->url },
  "afbeelding": afbeelding.asset->url
}
```

### Frontend API koppeling (toe te voegen aan turf-programma.html)
```js
const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID
const SANITY_TOKEN      = process.env.SANITY_TOKEN
const SANITY_URL = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/production`
```

### Huisstijl
- Achtergrond: `#0a0a0a`
- Accent: `#c8f53b` (lime)
- Blauw: `#3b8bf5`
- Paars: `#9b3bf5`
- Fonts: Bebas Neue (titels), DM Sans (body), Space Mono (labels/meta)

---

## Aandachtspunten

- De HTML frontend bestanden staan **niet** in de Sanity projectmap — die moeten er nog bij
- Het import script heeft nog echte credentials nodig voor het kan draaien
- Vercel kan statische HTML files direct hosten zonder build stap
- Voor productie: overweeg de Sanity token server-side te houden (bijv. via Vercel Edge Functions) zodat die niet zichtbaar is in de browser

---

## Vraag aan Claude Code

> Lees de projectstructuur in `/Users/rob/turf-festival`, controleer wat er al staat, en help me stap voor stap: (1) GitHub koppelen, (2) Sanity Studio en de frontend deployen via Vercel, (3) de data importeren. Begin met `git status` en een overzicht van de huidige mappenstructuur.

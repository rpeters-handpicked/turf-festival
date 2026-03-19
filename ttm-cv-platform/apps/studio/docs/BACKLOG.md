# TTM CV Platform — Product Backlog

**Project:** Tech to Market CV Platform
**Versie:** 1.0
**Datum:** maart 2026
**Prioriteit:** M = Must have · S = Should have · C = Could have
**Status:** 🔴 Open · 🟡 In progress · 🟢 Done · ⏸️ On hold

---

## Hoe gebruik je deze backlog?

- Voeg stories toe onder het juiste epic
- Pas de status aan terwijl je werkt
- Geef Claude opdrachten zoals:
  - "Voeg een story toe aan Epic 2 over het kunnen dupliceren van een prospect-link"
  - "Markeer story E1-3 als Done"
  - "Voeg een nieuw epic toe voor rapportage"

---

## Rollen

| Rol | Omschrijving |
|-----|-------------|
| **Beheerder** | TTM medewerker die profielen beheert en prospect-links aanmaakt |
| **Prospect** | Klant die een beveiligde link ontvangt en profielen beoordeelt |
| **Consultant** | De TTM professional wiens profiel wordt getoond |

---

## Epic 1 — Profielbeheer

| ID | Story | Prioriteit | Status |
|----|-------|-----------|--------|
| E1-1 | Als beheerder wil ik een nieuw consultant-profiel aanmaken zodat ik deze kan opnemen in prospect-selecties. | M | 🔴 Open |
| E1-2 | Als beheerder wil ik een bestaand profiel bewerken zodat de informatie altijd actueel is. | M | 🔴 Open |
| E1-3 | Als beheerder wil ik de beschikbaarheidsstatus van een consultant instellen (beschikbaar / niet beschikbaar / datum) zodat prospects alleen relevante profielen te zien krijgen. | M | 🔴 Open |
| E1-4 | Als beheerder wil ik een foto uploaden bij een profiel zodat de prospect een persoonlijkere indruk krijgt. | M | 🔴 Open |
| E1-5 | Als beheerder wil ik werkervaring invoeren per functie zodat de prospect een volledig beeld krijgt van de achtergrond. | M | 🔴 Open |
| E1-6 | Als beheerder wil ik de talenkennis van een consultant vastleggen zodat taalcompatibiliteit direct zichtbaar is voor prospects. | S | 🔴 Open |
| E1-7 | Als beheerder wil ik het dag- of uurtarief van een consultant invoeren zodat ik dit optioneel kan tonen aan prospects. | S | 🔴 Open |

### Acceptatiecriteria E1-1
- Naam, rol, samenvatting, foto, ervaring, vaardigheden, talen, tarief en beschikbaarheidsdatum kunnen worden ingevoerd
- Profiel is pas zichtbaar voor prospects nadat het gepubliceerd is
- Sanity Studio geeft een validatiefout als verplichte velden ontbreken

### Acceptatiecriteria E1-2
- Alle velden zijn bewerkbaar na publicatie
- Wijzigingen zijn direct zichtbaar in de frontend na opslaan
- Versiegeschiedenis is beschikbaar in Sanity Studio

### Acceptatiecriteria E1-3
- Status heeft drie opties: beschikbaar, niet beschikbaar, beschikbaar vanaf datum
- Status is zichtbaar als badge op de profielkaart in de prospect-view
- Niet-beschikbare profielen worden uitgegrijd getoond maar niet verborgen

### Acceptatiecriteria E1-4
- Foto wordt opgeslagen via Sanity's image pipeline
- Automatisch bijgesneden naar een vierkant formaat (1:1 ratio)
- Maximale bestandsgrootte: 5 MB

### Acceptatiecriteria E1-5
- Per ervaringsitem: bedrijfsnaam, functietitel, periode (van/tot), en optionele beschrijving
- Ervaring wordt gesorteerd op meest recent eerst
- Maximaal 10 ervaringsitems per profiel

### Acceptatiecriteria E1-6
- Meerdere talen kunnen worden toegevoegd, elk met niveau (basis / gevorderd / moedertaal)
- Talen worden getoond in het profiel als pills/badges

### Acceptatiecriteria E1-7
- Tarief kan ingesteld worden als dag- of uurtarief
- Tariefweergave is per prospect-link aan/uit te zetten
- Tarief is standaard verborgen tenzij expliciet ingeschakeld

---

## Epic 2 — Prospect-links aanmaken & beheren

| ID | Story | Prioriteit | Status |
|----|-------|-----------|--------|
| E2-1 | Als beheerder wil ik een beveiligde link aanmaken voor een specifieke prospect zodat alleen die prospect toegang heeft tot de geselecteerde profielen. | M | 🔴 Open |
| E2-2 | Als beheerder wil ik bij het aanmaken van een link de bedrijfsnaam en contactpersoon invoeren zodat de prospect-view gepersonaliseerd is. | M | 🔴 Open |
| E2-3 | Als beheerder wil ik een challenge of context meegeven aan een prospect-link zodat de prospect begrijpt waarvoor de profielen zijn geselecteerd. | M | 🔴 Open |
| E2-4 | Als beheerder wil ik één of meerdere consultantprofielen koppelen aan een prospect-link zodat de prospect alleen de relevante profielen te zien krijgt. | M | 🔴 Open |
| E2-5 | Als beheerder wil ik een overzicht zien van alle aangemaakte prospect-links zodat ik kan bijhouden welke links actief zijn en wat de status is. | M | 🔴 Open |
| E2-6 | Als beheerder wil ik een link kunnen kopiëren naar mijn klembord zodat ik deze makkelijk kan delen via e-mail of LinkedIn. | M | 🔴 Open |
| E2-7 | Als beheerder wil ik de vervaldatum van een bestaande link kunnen verlengen zodat een prospect meer tijd krijgt zonder dat ik een nieuwe link hoef aan te maken. | S | 🔴 Open |

### Acceptatiecriteria E2-1
- Link bevat een uniek, cryptografisch token (UUID v4)
- Link is standaard 30 dagen geldig
- Link geeft een foutmelding als deze verlopen of ongeldig is

### Acceptatiecriteria E2-2
- Bedrijfsnaam wordt getoond in de header van de prospect-view
- Contactpersoon wordt opgeslagen voor interne tracking

### Acceptatiecriteria E2-3
- Vrij tekstveld, maximaal 300 tekens
- Challenge wordt zichtbaar getoond als badge/introductietekst in de prospect-view

### Acceptatiecriteria E2-4
- Minimaal 1, maximaal 5 profielen per link
- Volgorde van profielen is instelbaar
- Alleen gepubliceerde profielen kunnen worden geselecteerd

### Acceptatiecriteria E2-5
- Overzicht toont: bedrijfsnaam, aanmaakdatum, vervaldatum, aantal bekeken keren, of een voorkeur is ingediend
- Links kunnen worden gedeactiveerd zonder te worden verwijderd
- Verlopen links zijn duidelijk gemarkeerd

### Acceptatiecriteria E2-6
- Eén klik kopieert de volledige URL
- Visuele bevestiging na kopiëren (toast notificatie)

### Acceptatiecriteria E2-7
- Vervaldatum is in te stellen per link
- Prospect ontvangt geen automatische notificatie bij verlenging

---

## Epic 3 — Prospect-view

| ID | Story | Prioriteit | Status |
|----|-------|-----------|--------|
| E3-1 | Als prospect wil ik via een beveiligde link de voor mij geselecteerde profielen kunnen bekijken zodat ik een goede indruk krijg van de voorgestelde consultants. | M | 🔴 Open |
| E3-2 | Als prospect wil ik op een profielkaart klikken voor meer details zodat ik een volledig beeld krijg voordat ik een keuze maak. | M | 🔴 Open |
| E3-3 | Als prospect wil ik mijn voorkeur(en) kunnen aangeven zodat Tech to Market weet met welk(e) profiel(en) ik verder wil. | M | 🔴 Open |
| E3-4 | Als prospect wil ik de pagina kunnen bekijken op mijn mobiel zodat ik niet achter een computer hoef te zitten. | M | 🔴 Open |
| E3-5 | Als prospect wil ik een duidelijke melding zien als de link verlopen is zodat ik weet dat ik contact moet opnemen met Tech to Market. | M | 🔴 Open |

### Acceptatiecriteria E3-1
- Pagina laadt zonder login
- Toont naam van Tech to Market én de bedrijfsnaam van de prospect
- Toont de ingestelde challenge als context
- Toont alle gekoppelde profielkaarten

### Acceptatiecriteria E3-2
- Detail-view toont: foto, naam, rol, samenvatting, vaardigheden, talenkennis, werkervaring, beschikbaarheid
- Detail-view opent als modal
- Sluitknop is duidelijk aanwezig

### Acceptatiecriteria E3-3
- Prospect kan één of meerdere profielen selecteren
- Geselecteerde profielen worden visueel gemarkeerd
- Bevestigingsknop is pas actief als minimaal één profiel is geselecteerd
- Na bevestiging verschijnt een bedankpagina

### Acceptatiecriteria E3-4
- Volledig responsive design (mobile-first)
- Profielkaarten stapelen verticaal op kleine schermen
- Knoppen zijn minimaal 44x44px (touch-friendly)

### Acceptatiecriteria E3-5
- Verlopen link toont een vriendelijke foutpagina met contactgegevens van TTM
- Geen technische foutmeldingen zichtbaar voor de prospect

---

## Epic 4 — Notificaties & verwerking

| ID | Story | Prioriteit | Status |
|----|-------|-----------|--------|
| E4-1 | Als beheerder wil ik een e-mailnotificatie ontvangen zodra een prospect een voorkeur heeft ingediend zodat ik direct kan opvolgen. | M | 🔴 Open |
| E4-2 | Als beheerder wil ik in het dashboard kunnen zien welke profielen een prospect heeft geselecteerd zodat ik dit kan opvolgen zonder mijn e-mail te hoeven raadplegen. | M | 🔴 Open |
| E4-3 | Als beheerder wil ik dat de voorkeur van een prospect automatisch naar ons CRM wordt gestuurd zodat ik geen dubbel werk heb. | C | ⏸️ On hold |

### Acceptatiecriteria E4-1
- E-mail bevat: naam prospect-bedrijf, contactpersoon, geselecteerde profiel(en), tijdstip van indienen
- E-mail wordt verstuurd naar het TTM team-adres (instelbaar in configuratie)
- Notificatie wordt verstuurd via Resend

### Acceptatiecriteria E4-2
- Per prospect-link is de ingediende voorkeur zichtbaar in het overzicht
- Status toont: nog niet bekeken / bekeken / voorkeur ingediend
- Datum en tijdstip van indienen worden getoond

### Acceptatiecriteria E4-3
- Integratie met CRM (nader te bepalen)
- Voorkeur wordt aangemaakt als deal of activiteit in het CRM
- Bij falen van de CRM-integratie wordt alsnog de e-mailnotificatie verstuurd als fallback

---

## Epic 5 — Authenticatie & toegangsbeheer

| ID | Story | Prioriteit | Status |
|----|-------|-----------|--------|
| E5-1 | Als beheerder wil ik inloggen met mijn Tech to Market Google-account zodat ik geen apart wachtwoord hoef te onthouden. | M | 🔴 Open |
| E5-2 | Als beheerder wil ik dat de beheer-omgeving volledig afgeschermd is voor niet-ingelogde gebruikers zodat prospects of anderen geen toegang hebben. | M | 🔴 Open |

### Acceptatiecriteria E5-1
- Login via Google OAuth (NextAuth.js)
- Alleen e-mailadressen met @tech-to-market.com domein krijgen toegang
- Sessie blijft 7 dagen actief

### Acceptatiecriteria E5-2
- Alle `/admin` routes zijn beveiligd met middleware
- Niet-ingelogde gebruikers worden doorgestuurd naar de loginpagina
- De prospect-view (`/share/[token]`) is publiek toegankelijk (geen login vereist)

---

## Epic 6 — Technische & niet-functionele vereisten

| ID | Story | Prioriteit | Status |
|----|-------|-----------|--------|
| E6-1 | Als ontwikkelaar wil ik dat alle omgevingsvariabelen worden beheerd via `.env` bestanden zodat API-keys nooit in de codebase terechtkomen. | M | 🟢 Done |
| E6-2 | Als ontwikkelaar wil ik dat de applicatie automatisch wordt gedeployed via Vercel bij elke push naar `main` zodat er altijd een actuele versie live staat. | M | 🔴 Open |
| E6-3 | Als beheerder wil ik dat de applicatie beschikbaar is op een subdomein van tech-to-market.com zodat het professioneel overkomt bij prospects. | S | 🔴 Open |
| E6-4 | Als beheerder wil ik dat de prospect-view snel laadt (onder 2 seconden) zodat de eerste indruk goed is. | S | 🔴 Open |

### Acceptatiecriteria E6-3
- Subdomein: `cv.tech-to-market.com`

### Acceptatiecriteria E6-4
- Lighthouse Performance score > 85
- Afbeeldingen worden geoptimaliseerd via Next.js Image component

---

## Datamodel

### Sanity schema's

**`consultant`**
| Veld | Type | Verplicht |
|------|------|-----------|
| name | string | ja |
| role | string | ja |
| slug | slug | ja |
| photo | image | nee |
| available | string (available / unavailable / available_from) | ja |
| availableFrom | date | conditioneel |
| summary | text | nee |
| skills | array of strings | nee |
| languages | array: { language, level } | nee |
| experience | array: { company, title, startDate, endDate, description } | nee |
| rateType | string (hourly / daily) | nee |
| rate | number | nee |

**`prospectLink`**
| Veld | Type | Verplicht |
|------|------|-----------|
| token | string (UUID, unique) | ja |
| companyName | string | ja |
| contactPerson | string | ja |
| challenge | text (max 300) | nee |
| consultants | array of references → consultant | ja |
| showRate | boolean (default: false) | ja |
| expiresAt | datetime | ja |
| isActive | boolean (default: true) | ja |
| createdBy | string | ja |
| createdAt | datetime | ja |

### Supabase tabel

**`preference`**
| Veld | Type | Verplicht |
|------|------|-----------|
| id | uuid (PK) | ja |
| linkToken | string (FK → prospectLink.token) | ja |
| selectedConsultants | array of consultant IDs | ja |
| submittedAt | datetime | ja |
| ipAddress | string | nee |

---

## Changelog

| Versie | Datum | Wijziging |
|--------|-------|-----------|
| 1.0 | maart 2026 | Initiële backlog aangemaakt |

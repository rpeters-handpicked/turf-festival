/**
 * TURF Festival — Centrale configuratie
 * ─────────────────────────────────────
 * Pas hier alle variabelen aan op één plek.
 * Dit bestand wordt geladen door de widget, route pagina en standalone pagina's.
 */

const TURF_CONFIG = {

  // ── Sanity CMS ──────────────────────────────────────────────────────────
  sanityProjectId: 'x545nfex',
  sanityDataset: 'production',

  // ── Google Maps ─────────────────────────────────────────────────────────
  googleMapsApiKey: 'AIzaSyBKtiBfiuLmG_td0BKfK6XABATDe8P1YPw',

  // ── URLs ────────────────────────────────────────────────────────────────
  programUrl: '/program-copy',       // URL van de programma pagina (Webflow)
  routeUrl: '/route',                // URL van de route pagina (Webflow)

  // ── Live indicator ──────────────────────────────────────────────────────
  // Zet op null voor echte tijd, of een datum-string om te simuleren.
  // Voorbeeld: '2026-11-26T10:30:00' simuleert donderdag 10:30.
  devTime: '2026-11-26T10:30:00',
  // devTime: null,

  // ── Festival data ───────────────────────────────────────────────────────
  festivalDates: {
    dag1: '2026-11-26',
    dag2: '2026-11-27',
    dag3: '2026-11-28',
  },

};

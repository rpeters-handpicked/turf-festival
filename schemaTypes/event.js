export default {
  name: 'event',
  title: 'Event',
  type: 'document',
  fields: [
    // ── Basisinfo ──
    {
      name: 'titel',
      title: 'Titel',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'ondertitel',
      title: 'Ondertitel / Gepresenteerd door',
      type: 'string'
    },
    {
      name: 'beschrijving',
      title: 'Beschrijving',
      type: 'text',
      rows: 6,
      validation: Rule => Rule.required()
    },
    {
      name: 'afbeelding',
      title: 'Afbeelding / Poster',
      type: 'image',
      options: { hotspot: true }
    },

    // ── Datum & tijd ──
    {
      name: 'dag',
      title: 'Dag',
      type: 'string',
      options: {
        list: [
          { title: 'Donderdag 26 november', value: 'dag1' },
          { title: 'Vrijdag 27 november',   value: 'dag2' },
          { title: 'Zaterdag 28 november',  value: 'dag3' }
        ],
        layout: 'radio'
      },
      validation: Rule => Rule.required()
    },
    {
      name: 'startTijd',
      title: 'Starttijd',
      type: 'string',
      description: 'Formaat: 21:00',
      validation: Rule => Rule.required()
    },
    {
      name: 'eindTijd',
      title: 'Eindtijd',
      type: 'string',
      description: 'Formaat: 23:00'
    },

    // ── Classificatie ──
    {
      name: 'thema',
      title: 'Thema',
      type: 'reference',
      to: [{ type: 'thema' }],
      validation: Rule => Rule.required()
    },
    {
      name: 'type',
      title: 'Event type',
      type: 'string',
      options: {
        list: [
          'Keynote', 'Panel', 'Workshop', 'Performance',
          'Installatie', 'Club Night', 'DJ Set', 'Showcase',
          'Rondleiding', 'Screening'
        ].map(t => ({ title: t, value: t }))
      }
    },
    {
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' }
    },

    // ── Locatie ──
    {
      name: 'locatie',
      title: 'Locatie',
      type: 'reference',
      to: [{ type: 'locatie' }],
      validation: Rule => Rule.required()
    },
    {
      name: 'zaal',
      title: 'Zaal / Ruimte (optioneel)',
      type: 'string',
      description: 'Bijv. "Grote Zaal" of "Foyer"'
    },

    // ── Sprekers ──
    {
      name: 'sprekers',
      title: 'Sprekers / Artiesten',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'spreker' }] }]
    },

    // ── Toegang ──
    {
      name: 'gratis',
      title: 'Gratis toegang',
      type: 'boolean',
      initialValue: false
    },
    {
      name: 'aanmelding',
      title: 'Aanmelding vereist',
      type: 'boolean',
      initialValue: false
    },
    {
      name: 'aanmeldLink',
      title: 'Aanmeldlink',
      type: 'url'
    },

    // ── Status ──
    {
      name: 'gepubliceerd',
      title: 'Gepubliceerd',
      type: 'boolean',
      initialValue: false
    }
  ],

  // Volgorde velden in studio
  groups: [
    { name: 'basis', title: 'Basisinfo', default: true },
    { name: 'tijd', title: 'Datum & tijd' },
    { name: 'classificatie', title: 'Classificatie' },
    { name: 'locatie', title: 'Locatie' },
    { name: 'sprekers', title: 'Sprekers' },
    { name: 'toegang', title: 'Toegang' },
  ],

  preview: {
    select: {
      title: 'titel',
      subtitle: 'startTijd',
      media: 'afbeelding'
    },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle ? `🕐 ${subtitle}` : '' }
    }
  }
}

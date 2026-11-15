export default {
  name: 'melding',
  title: 'Melding (narrowcasting)',
  type: 'document',
  description: 'Een actieve melding vervangt de playlist op de gekozen schermen tot je hem uitzet.',
  fields: [
    {
      name: 'titel',
      title: 'Kop',
      type: 'string',
      description: 'Kort en groot, bijv. "Programmawijziging"',
      validation: Rule => Rule.required().max(60),
    },
    {
      name: 'tekst',
      title: 'Tekst',
      type: 'text',
      rows: 3,
      validation: Rule => Rule.max(240),
    },
    {
      name: 'stijl',
      title: 'Stijl',
      type: 'string',
      options: {
        list: [
          {title: 'Mededeling (TURF-stijl)', value: 'info'},
          {title: 'Urgent (rood)', value: 'urgent'},
        ],
        layout: 'radio',
      },
      initialValue: 'info',
    },
    {
      name: 'schermen',
      title: 'Schermen',
      type: 'array',
      description: 'Leeg = alle schermen',
      of: [{type: 'reference', to: [{type: 'scherm'}]}],
    },
    {
      name: 'tot',
      title: 'Automatisch stoppen om',
      type: 'datetime',
      description: 'Leeg = blijft staan tot je de melding uitzet',
    },
    {
      name: 'actief',
      title: 'Actief',
      type: 'boolean',
      description: 'Aan = direct op de schermen (na publiceren)',
      initialValue: false,
    },
  ],
  preview: {
    select: {title: 'titel', actief: 'actief', stijl: 'stijl'},
    prepare({title, actief, stijl}) {
      return {title, subtitle: `${actief ? '● ACTIEF' : 'uit'}${stijl === 'urgent' ? ' · urgent' : ''}`}
    },
  },
}

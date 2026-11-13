const tijdRegel = Rule =>
  Rule.regex(/^([01]\d|2[0-3]):[0-5]\d$/, {name: 'tijd'}).error('Gebruik het formaat 21:00')

export default {
  name: 'playlist',
  title: 'Playlist (narrowcasting)',
  type: 'document',
  fields: [
    {
      name: 'naam',
      title: 'Naam',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'items',
      title: 'Slides',
      type: 'array',
      description:
        'Worden in deze volgorde herhaald. Een slide zonder inhoud (bijv. geen volgend event) wordt overgeslagen.',
      of: [
        {
          name: 'playlistItem',
          title: 'Slide',
          type: 'object',
          fields: [
            {
              name: 'slide',
              title: 'Slide',
              type: 'reference',
              to: [{type: 'slide'}],
              validation: Rule => Rule.required(),
            },
            {
              name: 'duur',
              title: 'Duur (seconden)',
              type: 'number',
              description: 'Leeg = de standaardduur van de slide. Video\'s spelen altijd helemaal af.',
              validation: Rule => Rule.min(3).max(600),
            },
            {
              name: 'dagen',
              title: 'Alleen op deze dagen',
              type: 'array',
              description: 'Leeg = alle dagen',
              of: [{type: 'string'}],
              options: {
                list: [
                  {title: 'Donderdag 26 november', value: 'dag1'},
                  {title: 'Vrijdag 27 november', value: 'dag2'},
                  {title: 'Zaterdag 28 november', value: 'dag3'},
                ],
              },
            },
            {
              name: 'van',
              title: 'Tonen vanaf',
              type: 'string',
              description: 'Formaat 21:00. Leeg = hele dag. Tijden na middernacht (tot 06:00) horen bij de festivaldag ervoor.',
              validation: tijdRegel,
            },
            {
              name: 'tot',
              title: 'Tonen tot',
              type: 'string',
              description: 'Formaat 23:00',
              validation: tijdRegel,
            },
          ],
          preview: {
            select: {title: 'slide.naam', type: 'slide.type', duur: 'duur', dagen: 'dagen', van: 'van', tot: 'tot'},
            prepare({title, type, duur, dagen, van, tot}) {
              const dagLabel = {dag1: 'do', dag2: 'vr', dag3: 'za'}
              const venster = [
                dagen?.length ? dagen.map(d => dagLabel[d] || d).join('/') : null,
                van || tot ? `${van || '…'}–${tot || '…'}` : null,
                duur ? `${duur}s` : null,
              ].filter(Boolean)
              return {
                title: title || 'Geen slide gekozen',
                subtitle: [type, ...venster].filter(Boolean).join(' · '),
              }
            },
          },
        },
      ],
    },
  ],
  preview: {
    select: {title: 'naam', items: 'items'},
    prepare({title, items}) {
      return {title, subtitle: `${items?.length || 0} slides`}
    },
  },
}

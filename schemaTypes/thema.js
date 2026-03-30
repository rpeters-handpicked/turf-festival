export default {
  name: 'thema',
  title: 'Thema',
  type: 'document',
  fields: [
    {
      name: 'naam',
      title: 'Naam',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'slug',
      title: 'Slug (voor URL)',
      type: 'string',
      options: {
        list: [
          { title: 'TURF Talks', value: 'talks' },
          { title: 'TURF Live', value: 'live' },
          { title: 'TURF by Night', value: 'night' }
        ]
      },
      validation: Rule => Rule.required()
    },
    {
      name: 'kleur',
      title: 'Kleurcode (hex)',
      type: 'string',
      description: 'Bijv. #c8f53b voor Talks, #3b8bf5 voor Live'
    },
    {
      name: 'beschrijving',
      title: 'Korte beschrijving',
      type: 'text',
      rows: 2
    }
  ],
  preview: {
    select: { title: 'naam', subtitle: 'slug' }
  }
}

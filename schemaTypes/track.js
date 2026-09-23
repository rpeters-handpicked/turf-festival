export default {
  name: 'track',
  title: 'Track',
  type: 'document',
  fields: [
    {
      name: 'naam',
      title: 'Naam',
      type: 'localeString',
      validation: Rule => Rule.custom(v => v?.nl ? true : 'Nederlandstalige naam is verplicht'),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'naam.nl', maxLength: 96 },
      validation: Rule => Rule.required(),
    },
    {
      name: 'dag',
      title: 'Dag',
      type: 'string',
      options: {
        list: [
          { title: 'Donderdag 26 november', value: 'dag1' },
          { title: 'Vrijdag 27 november',   value: 'dag2' },
          { title: 'Zaterdag 28 november',  value: 'dag3' },
        ],
        layout: 'radio',
      },
      validation: Rule => Rule.required(),
    },
    {
      name: 'thema',
      title: 'Thema',
      type: 'reference',
      to: [{ type: 'thema' }],
    },
    {
      name: 'beschrijving',
      title: 'Beschrijving',
      type: 'localeText',
    },
    {
      name: 'kleur',
      title: 'Accentkleur',
      type: 'string',
      description: 'Hex kleurcode, bijv. #e85d3a',
    },
    {
      name: 'afbeelding',
      title: 'Afbeelding',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'gepubliceerd',
      title: 'Gepubliceerd',
      type: 'boolean',
      initialValue: false,
    },
  ],

  preview: {
    select: {
      title: 'naam.nl',
      subtitle: 'dag',
      media: 'afbeelding',
    },
    prepare({ title, subtitle }) {
      const dag = { dag1: 'DO 26/11', dag2: 'VR 27/11', dag3: 'ZA 28/11' }
      return { title, subtitle: dag[subtitle] || subtitle }
    },
  },
}

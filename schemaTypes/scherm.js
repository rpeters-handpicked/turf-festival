export default {
  name: 'scherm',
  title: 'Scherm (narrowcasting)',
  type: 'document',
  fields: [
    {
      name: 'naam',
      title: 'Naam',
      type: 'string',
      description: 'Bijv. "MEZZ foyer links"',
      validation: Rule => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Scherm-ID',
      type: 'slug',
      description: 'Het scherm opent op /screen.html?id=<scherm-id>',
      options: {source: 'naam', maxLength: 60},
      validation: Rule => Rule.required(),
    },
    {
      name: 'soort',
      title: 'Soort scherm',
      type: 'string',
      options: {
        list: [
          {title: 'Hoofdscherm', value: 'hoofd'},
          {title: 'Klein scherm', value: 'klein'},
        ],
        layout: 'radio',
      },
      initialValue: 'klein',
    },
    {
      name: 'orientatie',
      title: 'Oriëntatie',
      type: 'string',
      options: {
        list: [
          {title: 'Landscape (liggend, 1920×1080)', value: 'landscape'},
          {title: 'Portrait (staand, 1080×1920)', value: 'portrait'},
        ],
        layout: 'radio',
      },
      initialValue: 'landscape',
      validation: Rule => Rule.required(),
    },
    {
      name: 'rotatie',
      title: 'Beeld draaien',
      type: 'number',
      description:
        'Alleen nodig als het scherm staand hangt maar de browser liggend beeld uitstuurt.',
      options: {
        list: [
          {title: 'Niet draaien', value: 0},
          {title: '90° met de klok mee', value: 90},
          {title: '90° tegen de klok in', value: 270},
        ],
      },
      initialValue: 0,
    },
    {
      name: 'locaties',
      title: 'Locatie(s)',
      type: 'array',
      description:
        'Bepaalt wat "deze locatie" is voor What\'s next en Programma. Meerdere mogelijk, bijv. een foyer met twee zalen.',
      of: [{type: 'reference', to: [{type: 'locatie'}]}],
    },
    {
      name: 'playlist',
      title: 'Playlist',
      type: 'reference',
      to: [{type: 'playlist'}],
    },
  ],
  preview: {
    select: {title: 'naam', slug: 'slug.current', orientatie: 'orientatie', playlist: 'playlist.naam'},
    prepare({title, slug, orientatie, playlist}) {
      return {
        title,
        subtitle: [orientatie, playlist || 'geen playlist', slug].filter(Boolean).join(' · '),
      }
    },
  },
}

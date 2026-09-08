export default {
  name: 'spreker',
  title: 'Spreker / Artiest',
  type: 'document',
  fields: [
    {
      name: 'naam',
      title: 'Naam',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'rol',
      title: 'Rol / Functietitel',
      type: 'localeString',
      description: 'Bijv. DJ / Activist · Rotterdam',
    },
    {
      name: 'organisatie',
      title: 'Organisatie',
      type: 'string'
    },
    {
      name: 'bio',
      title: 'Biografie',
      type: 'localeText',
    },
    {
      name: 'foto',
      title: 'Foto',
      type: 'image',
      options: { hotspot: true }
    },
    {
      name: 'website',
      title: 'Website',
      type: 'url'
    },
    {
      name: 'instagram',
      title: 'Instagram handle',
      type: 'string'
    }
  ],
  preview: {
    select: { title: 'naam', subtitle: 'rol.nl', media: 'foto' }
  }
}

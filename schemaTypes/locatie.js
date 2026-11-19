export default {
  name: 'locatie',
  title: 'Locatie',
  type: 'document',
  fields: [
    {
      name: 'naam',
      title: 'Naam',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'adres',
      title: 'Adres',
      type: 'string'
    },
    {
      name: 'geo',
      title: 'Locatie op kaart',
      type: 'geopoint',
      description: 'Positie van de pin op de locatiekaart'
    },
    {
      name: 'capaciteit',
      title: 'Capaciteit',
      type: 'number'
    },
    {
      name: 'type',
      title: 'Type locatie',
      type: 'string',
      options: {
        list: [
          { title: 'Club', value: 'club' },
          { title: 'Theater', value: 'theater' },
          { title: 'Outdoor', value: 'outdoor' },
          { title: 'Galerie', value: 'galerie' },
          { title: 'Overig', value: 'overig' }
        ]
      }
    },
    {
      name: 'beschrijving',
      title: 'Beschrijving',
      type: 'localeText',
    },
    {
      name: 'afbeelding',
      title: 'Afbeelding',
      type: 'image',
      options: { hotspot: true }
    }
  ],
  preview: {
    select: { title: 'naam', subtitle: 'adres' }
  }
}

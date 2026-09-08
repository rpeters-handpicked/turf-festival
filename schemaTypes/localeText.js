// Herbruikbaar type voor langere tekstvelden in NL + EN
export default {
  name: 'localeText',
  title: 'Tekst (NL + EN)',
  type: 'object',
  options: { collapsible: false },
  fields: [
    {
      name: 'nl',
      title: 'Nederlands',
      type: 'text',
      rows: 4,
    },
    {
      name: 'en',
      title: 'English',
      type: 'text',
      rows: 4,
    },
  ],
}

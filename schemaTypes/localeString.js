// Herbruikbaar type voor kortere tekstvelden in NL + EN
export default {
  name: 'localeString',
  title: 'Tekst (NL + EN)',
  type: 'object',
  options: { collapsible: false },
  fields: [
    {
      name: 'nl',
      title: 'Nederlands',
      type: 'string',
    },
    {
      name: 'en',
      title: 'English',
      type: 'string',
    },
  ],
}

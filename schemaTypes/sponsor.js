// Sponsor/partner voor de sponsorslide in de narrowcasting.
// Geïmporteerd uit Webflow (collectie "Founder logos"); bij wijzigingen daar opnieuw importeren.
// Je kunt hier ook zelf sponsors toevoegen of aanpassen.
export default {
  name: 'sponsor',
  title: 'Sponsor (narrowcasting)',
  type: 'document',
  fields: [
    {
      name: 'naam',
      title: 'Naam',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'prio',
      title: 'Prio',
      type: 'number',
      description: '1 = groot, 2 = middel, 3 = klein. Elke prio krijgt een eigen pagina op de slide.',
      options: {list: [1, 2, 3], layout: 'radio', direction: 'horizontal'},
      initialValue: 2,
      validation: Rule => Rule.required(),
    },
    {
      name: 'logo',
      title: 'Logo',
      type: 'image',
      description: 'Wit logo op transparante achtergrond (PNG of SVG). Gaat vóór de Webflow-link.',
    },
    {
      name: 'logoUrl',
      title: 'Logo-link (uit Webflow)',
      type: 'url',
      description: 'Ingevuld door de import uit Webflow. Wordt gebruikt als er hierboven geen logo is geüpload.',
    },
    {
      name: 'actief',
      title: 'Tonen op de schermen',
      type: 'boolean',
      initialValue: true,
    },
    {
      name: 'webflowId',
      title: 'Webflow-ID',
      type: 'string',
      readOnly: true,
      hidden: ({value}) => !value,
    },
  ],
  orderings: [
    {title: 'Prio, dan naam', name: 'prioNaam', by: [{field: 'prio', direction: 'asc'}, {field: 'naam', direction: 'asc'}]},
  ],
  preview: {
    select: {title: 'naam', prio: 'prio', actief: 'actief', media: 'logo'},
    prepare({title, prio, actief, media}) {
      return {title, subtitle: `Prio ${prio || '?'}${actief === false ? ' · verborgen' : ''}`, media}
    },
  },
}

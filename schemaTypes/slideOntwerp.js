// Opslagvorm van een eigen ontwerp (slide-editor). De velden worden niet met de hand
// ingevuld: de editor (tools/narrowcasting/OntwerpEditor.jsx) schrijft dit object.

export const ontwerpElement = {
  name: 'ontwerpElement',
  title: 'Element',
  type: 'object',
  fields: [
    {name: 'soort', type: 'string', options: {list: ['tekst', 'afbeelding', 'vorm', 'logo']}},
    {name: 'x', type: 'number'},
    {name: 'y', type: 'number'},
    {name: 'w', type: 'number'},
    {name: 'h', type: 'number'},
    {name: 'rotatie', type: 'number'},
    // tekst
    {name: 'tekst', type: 'text'},
    {name: 'font', type: 'string'},
    {name: 'grootte', type: 'number'},
    {name: 'gewicht', type: 'number'},
    {name: 'uitlijning', type: 'string'},
    {name: 'hoofdletters', type: 'boolean'},
    // tekst, vorm, logo
    {name: 'kleur', type: 'string'},
    // vorm
    {name: 'vorm', type: 'string'},
    {name: 'dekking', type: 'number'},
    // vorm, afbeelding
    {name: 'radius', type: 'number'},
    // afbeelding
    {name: 'afbeelding', type: 'image'},
    {name: 'passing', type: 'string'},
    {name: 'kader', type: 'boolean'},
  ],
}

export const slideOntwerp = {
  name: 'slideOntwerp',
  title: 'Ontwerp',
  type: 'object',
  fields: [
    {name: 'achtergrond', type: 'string'},
    {name: 'achtergrondKleur', type: 'string'},
    {name: 'achtergrondAfbeelding', type: 'image'},
    {name: 'elementen', type: 'array', of: [{type: 'ontwerpElement'}]},
  ],
}

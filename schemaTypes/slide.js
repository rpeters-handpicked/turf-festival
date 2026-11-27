import OntwerpEditor from '../tools/narrowcasting/OntwerpEditor'

export const SLIDE_TYPES = [
  {title: "What's next — deze locatie", value: 'whatsNextLocatie'},
  {title: "What's next — heel TURF", value: 'whatsNextOverall'},
  {title: 'Programma — deze locatie', value: 'programmaLocatie'},
  {title: 'Programma — hele dag', value: 'programmaDag'},
  {title: 'Introductie spreker/event — deze locatie', value: 'sprekerIntro'},
  {title: 'Closing keynote (één event, alle schermen)', value: 'closingKeynote'},
  {title: 'Avondprogramma (gekozen events)', value: 'avondprogramma'},
  {title: 'Walking map', value: 'walkingMap'},
  {title: 'Sponsoren', value: 'sponsoren'},
  {title: 'Eigen ontwerp (editor)', value: 'ontwerp'},
  {title: 'Video', value: 'video'},
  {title: 'Afbeelding', value: 'afbeelding'},
]

const DYNAMISCH = [
  'whatsNextLocatie', 'whatsNextOverall', 'programmaLocatie', 'programmaDag', 'sprekerIntro',
  'closingKeynote', 'avondprogramma', 'walkingMap', 'sponsoren',
]
const isType = (...types) => ({parent}) => !types.includes(parent?.type)

export default {
  name: 'slide',
  title: 'Slide (narrowcasting)',
  type: 'document',
  fields: [
    {
      name: 'naam',
      title: 'Naam',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {list: SLIDE_TYPES},
      validation: Rule => Rule.required(),
    },
    {
      name: 'duur',
      title: 'Standaardduur (seconden)',
      type: 'number',
      initialValue: 12,
      hidden: isType(...DYNAMISCH, 'afbeelding', 'ontwerp'),
      validation: Rule => Rule.min(3).max(600),
    },
    {
      name: 'minutenVooraf',
      title: 'Tonen vanaf … minuten voor aanvang',
      type: 'number',
      description:
        'Introductie spreker: verschijnt zoveel minuten voor het volgende event op deze locatie, tot 5 minuten na de start. Closing keynote: verschijnt zoveel minuten voor de start en blijft tot het einde, behalve op schermen van de locatie van de keynote zelf.',
      initialValue: 15,
      hidden: isType('sprekerIntro', 'closingKeynote'),
      validation: Rule => Rule.min(1).max(120),
    },
    {
      name: 'event',
      title: 'Event',
      type: 'reference',
      to: [{type: 'event'}],
      description: 'Titel, tijden, locatie en sprekers komen uit dit event.',
      hidden: isType('closingKeynote'),
    },
    {
      name: 'events',
      title: 'Events',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'event'}]}],
      description: 'Worden op starttijd gesorteerd (max. 6). Afgelopen events verdwijnen vanzelf.',
      hidden: isType('avondprogramma'),
      validation: Rule => Rule.max(6),
    },
    {
      name: 'kicker',
      title: 'Bovenregel',
      type: 'string',
      description: 'Kleine regel boven de kop. Leeg = "Tech Thursday · gratis toegankelijk".',
      hidden: isType('avondprogramma'),
    },
    {
      name: 'achtergrond',
      title: 'Achtergrond',
      type: 'number',
      options: {
        list: [
          {title: 'Verloop 1', value: 1},
          {title: 'Verloop 2', value: 2},
          {title: 'Verloop 3', value: 3},
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 1,
      hidden: isType(...DYNAMISCH),
    },
    {
      name: 'titel',
      title: 'Eigen kop (optioneel)',
      type: 'string',
      description: 'Vervangt de standaardkop, bijv. "Straks op TURF".',
      hidden: isType(...DYNAMISCH),
    },
    {
      name: 'locaties',
      title: 'Locaties op de kaart',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'locatie'}], options: {disableNew: true}}],
      description:
        'Kies welke TURF-locaties op deze walking map staan. Zalen op hetzelfde adres worden één punt. De locatie van het scherm zelf staat er altijd op ("U bent hier"). Leeg = de vier hoofdlocaties.',
      hidden: isType('walkingMap'),
      validation: Rule => [Rule.unique(), Rule.max(8).warning('Meer dan 8 locaties past niet leesbaar in de lijst naast de kaart.')],
    },
    {
      name: 'ontwerpLandscape',
      title: 'Ontwerp — liggend (1920×1080)',
      type: 'slideOntwerp',
      options: {orient: 'landscape'},
      components: {input: OntwerpEditor},
      hidden: isType('ontwerp'),
    },
    {
      name: 'ontwerpPortrait',
      title: 'Ontwerp — staand (1080×1920)',
      description: 'Leeg = het liggende ontwerp wordt verkleind getoond op staande schermen.',
      type: 'slideOntwerp',
      options: {orient: 'portrait'},
      components: {input: OntwerpEditor},
      hidden: isType('ontwerp'),
    },
    {
      name: 'video',
      title: 'Video (liggend)',
      type: 'file',
      description: 'MP4 (H.264), 1920×1080. Speelt zonder geluid.',
      options: {accept: 'video/mp4,video/webm'},
      hidden: isType('video'),
    },
    {
      name: 'videoPortrait',
      title: 'Video (staand)',
      type: 'file',
      description: 'MP4 (H.264), 1080×1920. Leeg = de liggende video wordt bijgesneden.',
      options: {accept: 'video/mp4,video/webm'},
      hidden: isType('video'),
    },
    {
      name: 'afbeelding',
      title: 'Afbeelding (liggend)',
      type: 'image',
      description: '1920×1080',
      hidden: isType('afbeelding'),
    },
    {
      name: 'afbeeldingPortrait',
      title: 'Afbeelding (staand)',
      type: 'image',
      description: '1080×1920. Leeg = de liggende afbeelding wordt bijgesneden.',
      hidden: isType('afbeelding'),
    },
  ],
  preview: {
    select: {title: 'naam', type: 'type', media: 'afbeelding'},
    prepare({title, type, media}) {
      return {title, subtitle: SLIDE_TYPES.find(t => t.value === type)?.title || type, media}
    },
  },
}

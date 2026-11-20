import OntwerpEditor from '../tools/narrowcasting/OntwerpEditor'

export const SLIDE_TYPES = [
  {title: "What's next — deze locatie", value: 'whatsNextLocatie'},
  {title: "What's next — heel TURF", value: 'whatsNextOverall'},
  {title: 'Programma — deze locatie', value: 'programmaLocatie'},
  {title: 'Programma — hele dag', value: 'programmaDag'},
  {title: 'Introductie spreker/event — deze locatie', value: 'sprekerIntro'},
  {title: 'Walking map', value: 'walkingMap'},
  {title: 'Sponsoren', value: 'sponsoren'},
  {title: 'Eigen ontwerp (editor)', value: 'ontwerp'},
  {title: 'Video', value: 'video'},
  {title: 'Afbeelding', value: 'afbeelding'},
]

const DYNAMISCH = ['whatsNextLocatie', 'whatsNextOverall', 'programmaLocatie', 'programmaDag', 'sprekerIntro', 'walkingMap', 'sponsoren']
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
      description: 'De slide verschijnt automatisch zoveel minuten voor het volgende event op deze locatie, tot 5 minuten na de start.',
      initialValue: 15,
      hidden: isType('sprekerIntro'),
      validation: Rule => Rule.min(1).max(120),
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

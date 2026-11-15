import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {PresentationIcon} from '@sanity/icons'
import {schemaTypes} from './schemaTypes'
import NarrowcastingTool from './tools/narrowcasting/NarrowcastingTool'

export default defineConfig({
  name: 'default',
  title: 'turf-festival',

  projectId: 'x545nfex',
  dataset: 'production',

  plugins: [structureTool(), visionTool()],

  tools: prev => [
    ...prev,
    {name: 'narrowcasting', title: 'Narrowcasting', icon: PresentationIcon, component: NarrowcastingTool},
  ],

  schema: {
    types: schemaTypes,
  },
})

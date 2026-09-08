/**
 * Migratiescript: zet plain-string velden om naar localeString/localeText objecten.
 * Verplaatst bestaande Nederlandse tekst naar het .nl subveld.
 *
 * Gebruik: node migrate-to-locale.js
 * (Vereist SANITY_TOKEN in omgeving, of pas TOKEN hieronder aan.)
 */

import { createClient } from '@sanity/client'

const client = createClient({
  projectId: 'x545nfex',
  dataset: 'production',
  apiVersion: '2024-01-01',
  // Haal een schrijf-token op via sanity.io → project → API → Tokens
  token: process.env.SANITY_TOKEN,
  useCdn: false,
})

async function migrateDocuments(type, fields) {
  console.log(`\n── Migreren: ${type} ──`)

  // Bouw filter: documenten waarbij minstens één veld nog een string is
  const fieldFilters = fields.map(f => `defined(${f}) && string(${f}) == ${f}`).join(' || ')
  const query = `*[_type == "${type}" && (${fieldFilters})]{ _id, ${fields.join(', ')} }`
  const docs = await client.fetch(query)

  console.log(`  Gevonden: ${docs.length} documenten om te migreren`)
  if (!docs.length) return

  const tx = client.transaction()

  for (const doc of docs) {
    const patch = {}
    for (const field of fields) {
      const val = doc[field]
      // Alleen migreren als het nog een plain string is (geen object)
      if (typeof val === 'string' && val.trim()) {
        patch[field] = { nl: val }
      }
    }
    if (Object.keys(patch).length) {
      tx.patch(doc._id, p => p.set(patch))
    }
  }

  const result = await tx.commit()
  console.log(`  ✓ ${result.results?.length ?? '?'} documenten bijgewerkt`)
}

async function run() {
  console.log('Sanity locale migratie gestart...')

  await migrateDocuments('event',   ['titel', 'ondertitel', 'beschrijving'])
  await migrateDocuments('locatie', ['beschrijving'])
  await migrateDocuments('thema',   ['beschrijving'])
  await migrateDocuments('spreker', ['rol', 'bio'])

  console.log('\n✅ Migratie voltooid.')
}

run().catch(err => {
  console.error('❌ Migratie mislukt:', err.message)
  process.exit(1)
})

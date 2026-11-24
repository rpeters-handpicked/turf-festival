import {useCallback, useEffect, useMemo, useState} from 'react'
import {useClient} from 'sanity'
import {IntentLink} from 'sanity/router'
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Grid,
  Heading,
  Select,
  Spinner,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Text,
  useToast,
} from '@sanity/ui'
import {AddIcon, CopyIcon, EditIcon, LaunchIcon} from '@sanity/icons'
import {FESTIVAL, currentDag, toMinutes} from '../../frontend/narrowcasting/schedule.js'
import {SLIDE_TYPES} from '../../schemaTypes/slide'

// Waar de player draait. Lokaal (sanity dev) kijken we naar `npm run dev:frontend`.
// (`serve` haalt lokaal de .html-extensie weg en gooit daarbij de query weg, vandaar het andere pad.)
const LOCAL = typeof location !== 'undefined' && location.hostname === 'localhost'
const PLAYER_URL = LOCAL ? 'http://localhost:3000/screen' : 'https://turf-festival.vercel.app/screen.html'

const DAGEN = [
  {value: 'dag1', kort: 'Do 26 nov'},
  {value: 'dag2', kort: 'Vr 27 nov'},
  {value: 'dag3', kort: 'Za 28 nov'},
]

const QUERY = `{
  "schermen": *[_type == "scherm"] | order(naam asc){
    _id, naam, "slug": slug.current, soort, orientatie,
    "locaties": locaties[]->naam,
    "playlist": playlist->{_id, naam}
  },
  "playlists": *[_type == "playlist"] | order(naam asc){
    _id, naam,
    "items": items[]{_key, duur, dagen, van, tot, "slide": slide->{_id, naam, type, duur}},
    "schermen": *[_type == "scherm" && references(^._id)].naam
  },
  "meldingen": *[_type == "melding"] | order(_updatedAt desc){
    _id, titel, tekst, stijl, actief, tot, "schermen": schermen[]->naam
  }
}`

const playerUrl = (slug, simNow) =>
  `${PLAYER_URL}?id=${encodeURIComponent(slug)}${simNow ? `&now=${simNow}` : ''}`

const typeLabel = type => SLIDE_TYPES.find(t => t.value === type)?.title || type

/** Laadt alles wat het tabblad nodig heeft en ververst bij elke wijziging. */
function useNarrowcastingData() {
  const client = useClient({apiVersion: '2024-01-01'})
  // De schermen tonen alleen gepubliceerde content; het overzicht dus ook.
  const published = useMemo(() => client.withConfig({perspective: 'published'}), [client])
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    published
      .fetch(QUERY)
      .then(result => {
        setData(result)
        setError(null)
      })
      .catch(err => setError(err.message))
  }, [published])

  useEffect(() => {
    load()
    let timer
    const sub = published
      .listen('*[_type in ["scherm","playlist","slide","melding"]]', {}, {includeResult: false, visibility: 'query'})
      .subscribe({
        next: () => {
          clearTimeout(timer)
          timer = setTimeout(load, 800)
        },
        error: () => {},
      })
    return () => {
      clearTimeout(timer)
      sub.unsubscribe()
    }
  }, [load, published])

  return {data, error, client: published}
}

// ── Meldingen ──────────────────────────────────────────────────────────────
function Meldingen({meldingen, client}) {
  const toast = useToast()
  const toggle = melding => {
    client
      .patch(melding._id)
      .set({actief: !melding.actief})
      .commit()
      .then(() =>
        toast.push({
          status: melding.actief ? 'info' : 'warning',
          title: melding.actief ? 'Melding gestopt' : `"${melding.titel}" staat nu op de schermen`,
        }),
      )
      .catch(err => toast.push({status: 'error', title: 'Wijzigen mislukt', description: err.message}))
  }

  return (
    <Card padding={4} radius={3} border>
      <Stack space={4}>
        <Flex align="center" justify="space-between" gap={3}>
          <Stack space={2}>
            <Heading size={1}>Meldingen</Heading>
            <Text size={1} muted>
              Een actieve melding vervangt direct de playlist op de gekozen schermen.
            </Text>
          </Stack>
          <Button as={IntentLink} intent="create" params={{type: 'melding'}} icon={AddIcon} text="Nieuwe melding" mode="ghost" />
        </Flex>
        {meldingen.length === 0 && (
          <Text size={1} muted>
            Nog geen meldingen. Maak er vooraf een paar klaar (en publiceer ze), dan zet je ze tijdens het festival met één
            klik aan.
          </Text>
        )}
        {meldingen.map(m => (
          <Card key={m._id} padding={3} radius={2} tone={m.actief ? (m.stijl === 'urgent' ? 'critical' : 'caution') : 'default'} border>
            <Flex align="center" gap={3}>
              <Switch checked={!!m.actief} onChange={() => toggle(m)} aria-label={`Melding ${m.titel} aan of uit`} />
              <Box flex={1}>
                <Stack space={2}>
                  <Text weight="semibold">{m.titel}</Text>
                  <Text size={1} muted>
                    {[m.tekst, m.schermen?.length ? `Alleen: ${m.schermen.join(', ')}` : 'Alle schermen'].filter(Boolean).join(' — ')}
                  </Text>
                </Stack>
              </Box>
              {m.actief && <Badge tone={m.stijl === 'urgent' ? 'critical' : 'caution'}>Actief</Badge>}
              <Button as={IntentLink} intent="edit" params={{id: m._id, type: 'melding'}} icon={EditIcon} mode="bleed" aria-label="Bewerk melding" />
            </Flex>
          </Card>
        ))}
      </Stack>
    </Card>
  )
}

// ── Schermen ───────────────────────────────────────────────────────────────
function SchermCard({scherm, simNow, showPreview}) {
  const toast = useToast()
  // Met een preview-tijdstip openen/kopiëren we de URL mét &now=, zodat je hem op volle grootte kunt bekijken.
  const url = scherm.slug ? playerUrl(scherm.slug, simNow) : null
  const portrait = scherm.orientatie === 'portrait'

  return (
    <Card padding={3} radius={3} border>
      <Stack space={3}>
        {showPreview && url && (
          <Flex justify="center" style={{background: '#000', borderRadius: 6, overflow: 'hidden'}}>
            <iframe
              title={`Preview ${scherm.naam}`}
              src={url}
              style={{border: 0, display: 'block', aspectRatio: portrait ? '9 / 16' : '16 / 9', width: portrait ? '45%' : '100%'}}
            />
          </Flex>
        )}
        <Flex align="center" gap={2} wrap="wrap">
          <Box flex={1}>
            <Text weight="semibold">{scherm.naam}</Text>
          </Box>
          <Badge>{portrait ? 'Staand' : 'Liggend'}</Badge>
          <Badge tone={scherm.soort === 'hoofd' ? 'primary' : 'default'}>{scherm.soort === 'hoofd' ? 'Hoofdscherm' : 'Klein'}</Badge>
        </Flex>
        <Text size={1} muted>
          {scherm.locaties?.filter(Boolean).join(' + ') || 'Geen locatie gekozen'}
        </Text>
        <Text size={1}>
          Playlist:{' '}
          {scherm.playlist ? (
            <IntentLink intent="edit" params={{id: scherm.playlist._id, type: 'playlist'}}>
              {scherm.playlist.naam}
            </IntentLink>
          ) : (
            <span style={{color: 'var(--card-badge-critical-fg-color, #c00)'}}>geen — scherm toont alleen het logo</span>
          )}
        </Text>
        <Flex gap={2} wrap="wrap">
          <Button as={IntentLink} intent="edit" params={{id: scherm._id, type: 'scherm'}} icon={EditIcon} text="Bewerk" mode="ghost" fontSize={1} />
          {url && <Button as="a" href={url} target="_blank" rel="noreferrer" icon={LaunchIcon} text={simNow ? 'Open preview' : 'Open'} mode="ghost" fontSize={1} />}
          {url && (
            <Button
              icon={CopyIcon}
              text={simNow ? 'Kopieer preview-URL' : 'Kopieer URL'}
              mode="ghost"
              fontSize={1}
              onClick={() =>
                navigator.clipboard
                  .writeText(url)
                  .then(() =>
                    toast.push(
                      simNow
                        ? {status: 'warning', title: 'Preview-URL gekopieerd', description: 'Deze URL draait op het gekozen preview-tijdstip. Niet gebruiken op een echt scherm.'}
                        : {status: 'success', title: 'URL gekopieerd'},
                    ),
                  )
                  .catch(() => toast.push({status: 'error', title: 'Kopiëren mislukt', description: url}))
              }
            />
          )}
        </Flex>
      </Stack>
    </Card>
  )
}

function Schermen({schermen}) {
  const [simDag, setSimDag] = useState('')
  const [simTijd, setSimTijd] = useState('20:00')
  const [previews, setPreviews] = useState(schermen.length <= 12)
  const simNow = simDag ? `${FESTIVAL.dates[simDag]}T${simTijd || '12:00'}` : ''

  const groepen = useMemo(() => {
    const map = new Map()
    for (const s of schermen) {
      const key = s.locaties?.filter(Boolean)[0] || 'Zonder locatie'
      map.set(key, [...(map.get(key) || []), s])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [schermen])

  return (
    <Stack space={5}>
      <Flex align="flex-end" gap={3} wrap="wrap">
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Preview-tijdstip
          </Text>
          <Flex gap={2}>
            <Select value={simDag} onChange={e => setSimDag(e.currentTarget.value)}>
              <option value="">Nu (echte tijd)</option>
              {DAGEN.map(d => (
                <option key={d.value} value={d.value}>
                  {d.kort}
                </option>
              ))}
            </Select>
            {simDag && (
              <input
                type="time"
                value={simTijd}
                onChange={e => setSimTijd(e.currentTarget.value)}
                aria-label="Tijdstip"
                style={{font: 'inherit', padding: '0 8px', borderRadius: 3, border: '1px solid var(--card-border-color)', background: 'transparent', color: 'inherit'}}
              />
            )}
          </Flex>
        </Stack>
        <Flex align="center" gap={2} paddingBottom={2}>
          <Switch checked={previews} onChange={() => setPreviews(v => !v)} id="nc-previews" />
          <Text size={1}>
            <label htmlFor="nc-previews">Live previews tonen</label>
          </Text>
        </Flex>
        <Box flex={1} />
        <Button as={IntentLink} intent="create" params={{type: 'scherm'}} icon={AddIcon} text="Nieuw scherm" tone="primary" />
      </Flex>

      {schermen.length === 0 && (
        <Card padding={5} radius={3} border tone="transparent">
          <Stack space={3}>
            <Heading size={1}>Nog geen schermen</Heading>
            <Text muted>
              Maak eerst een paar slides en een playlist, en daarna een scherm met een locatie en die playlist. Alleen
              gepubliceerde schermen verschijnen hier.
            </Text>
          </Stack>
        </Card>
      )}

      {groepen.map(([locatie, lijst]) => (
        <Stack key={locatie} space={3}>
          <Heading size={1}>{locatie}</Heading>
          <Grid columns={[1, 2, 3]} gap={3}>
            {lijst.map(s => (
              <SchermCard key={s._id} scherm={s} simNow={simNow} showPreview={previews} />
            ))}
          </Grid>
        </Stack>
      ))}
    </Stack>
  )
}

// ── Planning ───────────────────────────────────────────────────────────────
const AXIS_START = 8 * 60 // 08:00
const AXIS_END = 30 * 60 // 06:00 de volgende ochtend
const pct = min => `${((Math.min(Math.max(min, AXIS_START), AXIS_END) - AXIS_START) / (AXIS_END - AXIS_START)) * 100}%`
const HOURS = Array.from({length: (AXIS_END - AXIS_START) / 120 + 1}, (_, i) => AXIS_START + i * 120)
const hourLabel = min => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:00`

function itemWindow(item) {
  const van = item.van ? toMinutes(item.van) : AXIS_START
  let tot = item.tot ? toMinutes(item.tot) : AXIS_END
  if (tot <= van) tot += 24 * 60
  return {van, tot}
}

function Planning({playlists}) {
  const [playlistId, setPlaylistId] = useState(playlists[0]?._id || '')
  const [dag, setDag] = useState(() => currentDag(new Date()) || 'dag1')
  const playlist = playlists.find(p => p._id === playlistId) || playlists[0]

  const now = new Date()
  const nowMin =
    currentDag(now) === dag ? (now.getTime() - new Date(`${FESTIVAL.dates[dag]}T00:00:00`).getTime()) / 60000 : null

  if (!playlist) {
    return (
      <Card padding={5} radius={3} border tone="transparent">
        <Stack space={4}>
          <Text muted>Nog geen (gepubliceerde) playlists.</Text>
          <Flex>
            <Button as={IntentLink} intent="create" params={{type: 'playlist'}} icon={AddIcon} text="Nieuwe playlist" tone="primary" />
          </Flex>
        </Stack>
      </Card>
    )
  }

  const items = (playlist.items || []).filter(i => i?.slide)

  return (
    <Stack space={4}>
      <Flex gap={3} align="center" wrap="wrap">
        <Select value={playlist._id} onChange={e => setPlaylistId(e.currentTarget.value)} style={{minWidth: 220}}>
          {playlists.map(p => (
            <option key={p._id} value={p._id}>
              {p.naam}
            </option>
          ))}
        </Select>
        <TabList space={1}>
          {DAGEN.map(d => (
            <Tab key={d.value} id={`nc-dag-${d.value}`} aria-controls="nc-planning" label={d.kort} selected={dag === d.value} onClick={() => setDag(d.value)} />
          ))}
        </TabList>
        <Box flex={1} />
        <Button as={IntentLink} intent="edit" params={{id: playlist._id, type: 'playlist'}} icon={EditIcon} text="Bewerk playlist" mode="ghost" />
      </Flex>

      <Text size={1} muted>
        {playlist.schermen?.length ? `Draait op: ${playlist.schermen.join(', ')}` : 'Nog aan geen enkel scherm gekoppeld'}
      </Text>

      <Card id="nc-planning" padding={4} radius={3} border>
        <div style={{display: 'grid', gridTemplateColumns: 'minmax(180px, 26%) 1fr', rowGap: 10, columnGap: 16, alignItems: 'center'}}>
          <div />
          <div style={{position: 'relative', height: 18}}>
            {HOURS.map(h => (
              <span key={h} style={{position: 'absolute', left: pct(h), transform: 'translateX(-50%)', fontSize: 11, color: 'var(--card-muted-fg-color)'}}>
                {hourLabel(h)}
              </span>
            ))}
          </div>

          {items.length === 0 && (
            <Box style={{gridColumn: '1 / -1'}} paddingY={3}>
              <Text muted>Deze playlist heeft nog geen slides.</Text>
            </Box>
          )}

          {items.map(item => {
            const opDezeDag = !item.dagen?.length || item.dagen.includes(dag)
            const {van, tot} = itemWindow(item)
            const duur = item.duur || item.slide.duur
            return [
              <Stack key={`${item._key}-label`} space={2}>
                <Text size={1} weight="semibold" textOverflow="ellipsis">
                  {item.slide.naam}
                </Text>
                <Text size={0} muted textOverflow="ellipsis">
                  {[typeLabel(item.slide.type), item.slide.type === 'video' ? null : duur ? `${duur}s` : null].filter(Boolean).join(' · ')}
                </Text>
              </Stack>,
              <div
                key={`${item._key}-bar`}
                style={{position: 'relative', height: 30, borderRadius: 4, background: 'var(--card-border-color)', overflow: 'hidden'}}
              >
                {HOURS.map(h => (
                  <i key={h} style={{position: 'absolute', left: pct(h), top: 0, bottom: 0, width: 1, background: 'var(--card-bg-color)', opacity: 0.6}} />
                ))}
                {opDezeDag ? (
                  <div
                    title={`${item.van || 'begin'} – ${item.tot || 'einde'}`}
                    style={{
                      position: 'absolute', top: 3, bottom: 3, left: pct(van), width: `calc(${pct(tot)} - ${pct(van)})`,
                      borderRadius: 3, background: 'var(--card-focus-ring-color, #2276fc)',
                      color: '#fff', fontSize: 11, lineHeight: '24px', padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden',
                    }}
                  >
                    {item.van || item.tot ? `${item.van || '…'} – ${item.tot || '…'}` : 'hele dag'}
                  </div>
                ) : (
                  <span style={{position: 'absolute', left: 10, top: 0, lineHeight: '30px', fontSize: 11, color: 'var(--card-muted-fg-color)'}}>
                    niet op deze dag
                  </span>
                )}
                {nowMin != null && nowMin >= AXIS_START && nowMin <= AXIS_END && (
                  <i style={{position: 'absolute', left: pct(nowMin), top: 0, bottom: 0, width: 2, background: '#e5484d'}} />
                )}
              </div>,
            ]
          })}
        </div>
      </Card>
      <Text size={1} muted>
        Slides zonder tijdvenster draaien de hele dag mee. Dynamische slides (what's next, introductie spreker) verschijnen
        binnen hun venster alleen als er iets te tonen is.
      </Text>
    </Stack>
  )
}

// ── Tabblad ────────────────────────────────────────────────────────────────
export default function NarrowcastingTool() {
  const {data, error, client} = useNarrowcastingData()
  const [tab, setTab] = useState('schermen')

  return (
    <Card height="fill" overflow="auto" tone="transparent">
      {/* Padding op een aparte Box: op Container zelf telt hij óp bij width: 100% en schuift de rechterkant buiten beeld. */}
      <Box padding={[3, 4, 5]}>
      <Container width={5}>
        <Stack space={5}>
          <Flex align="center" justify="space-between" gap={3} wrap="wrap">
            <Heading size={3}>Narrowcasting</Heading>
            <TabList space={1}>
              <Tab id="nc-tab-schermen" aria-controls="nc-panel-schermen" label={`Schermen${data ? ` (${data.schermen.length})` : ''}`} selected={tab === 'schermen'} onClick={() => setTab('schermen')} />
              <Tab id="nc-tab-planning" aria-controls="nc-panel-planning" label="Planning" selected={tab === 'planning'} onClick={() => setTab('planning')} />
            </TabList>
          </Flex>

          {error && (
            <Card padding={3} radius={2} tone="critical" border>
              <Text size={1}>Laden mislukt: {error}</Text>
            </Card>
          )}

          {!data && !error && (
            <Flex justify="center" padding={6}>
              <Spinner muted />
            </Flex>
          )}

          {data && (
            <>
              <Meldingen meldingen={data.meldingen} client={client} />
              <TabPanel id="nc-panel-schermen" aria-labelledby="nc-tab-schermen" hidden={tab !== 'schermen'}>
                <Schermen schermen={data.schermen} />
              </TabPanel>
              <TabPanel id="nc-panel-planning" aria-labelledby="nc-tab-planning" hidden={tab !== 'planning'}>
                <Planning playlists={data.playlists} />
              </TabPanel>
            </>
          )}
        </Stack>
      </Container>
      </Box>
    </Card>
  )
}

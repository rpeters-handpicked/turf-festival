import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {set, unset, useClient, useFormValue} from 'sanity'
import {createPortal} from 'react-dom'
import {Box, Button, Card, Flex, Select, Stack, Text, TextArea, useToast} from '@sanity/ui'
import {
  ACHTERGRONDEN,
  CANVAS,
  FONTS,
  KLEUREN,
  TOKENS,
  backgroundStyle,
  convertLayout,
  describeElement,
  newElement,
  newKey,
} from '../../frontend/narrowcasting/ontwerp.js'

// Fonts, logo en verlopen komen van de player zelf, zodat de editor exact hetzelfde toont.
const LOCAL = typeof location !== 'undefined' && location.hostname === 'localhost'
const PLAYER_ORIGIN = LOCAL ? 'http://localhost:3000' : 'https://turf-festival.vercel.app'
const ASSETS = `${PLAYER_ORIGIN}/narrowcasting/assets`
const FONT_CSS = [
  ['MediumLC', 500],
  ['SemiBoldLC', 600],
  ['BoldLC', 700],
  ['ExtraBoldLC', 800],
]
  .map(
    ([file, weight]) =>
      `@font-face{font-family:'Thunder';src:url('${PLAYER_ORIGIN}/fonts/THUNDER/Thunder-${file}.woff2') format('woff2');font-weight:${weight};font-display:swap}`,
  )
  .join('\n')
  .concat("\n@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap');")

const SOORT_LABEL = {tekst: 'Tekst', afbeelding: 'Afbeelding', vorm: 'Vorm', logo: 'TURF-logo'}
const HANDLES = ['nw', 'ne', 'sw', 'se']
const MIN_SIZE = 24
const SNAP = 12

const emptyOntwerp = () => ({_type: 'slideOntwerp', achtergrond: 'verloop1', elementen: []})

// ── Kleine invoervelden ────────────────────────────────────────────────────
const fieldStyle = {
  font: 'inherit', fontSize: 13, width: '100%', padding: '6px 8px', borderRadius: 3,
  border: '1px solid var(--card-border-color)', background: 'transparent', color: 'inherit',
}

function Field({label, children}) {
  return (
    <Stack space={2}>
      <Text size={0} weight="semibold" muted>
        {label}
      </Text>
      {children}
    </Stack>
  )
}

function NumberField({label, value, onChange, min, max, step = 1}) {
  return (
    <Field label={label}>
      <input
        type="number"
        style={fieldStyle}
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        onChange={e => {
          const n = Number(e.currentTarget.value)
          if (e.currentTarget.value !== '' && !Number.isNaN(n)) onChange(n)
        }}
      />
    </Field>
  )
}

function ColorField({label, value, onChange}) {
  return (
    <Field label={label}>
      <Flex gap={1} wrap="wrap" align="center">
        {KLEUREN.map(k => (
          <button
            key={k.hex}
            type="button"
            title={k.naam}
            aria-label={k.naam}
            onClick={() => onChange(k.hex)}
            style={{
              width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', background: k.hex, padding: 0,
              border: '1px solid var(--card-border-color)',
              outline: (value || '').toLowerCase() === k.hex ? '2px solid var(--card-focus-ring-color)' : 'none',
              outlineOffset: 2,
            }}
          />
        ))}
        <input
          type="color"
          aria-label="Eigen kleur"
          value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#ffffff'}
          onChange={e => onChange(e.currentTarget.value)}
          style={{width: 30, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer'}}
        />
      </Flex>
    </Field>
  )
}

// ── Eén element op het canvas ──────────────────────────────────────────────
function CanvasElement({el, selected, scale, onPointerDown}) {
  const {box, inner} = describeElement(el, {assets: ASSETS})
  const handle = 14 / scale
  return (
    <div
      style={{...box, cursor: 'move', touchAction: 'none', userSelect: 'none'}}
      onPointerDown={e => onPointerDown(e, el, 'move')}
    >
      {inner.tag === 'img' ? (
        inner.src ? (
          <img src={inner.src} alt="" draggable={false} style={{...inner.style, pointerEvents: 'none'}} />
        ) : (
          <div style={{width: '100%', height: '100%', background: 'rgba(255,255,255,.15)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 40}}>
            Geen afbeelding
          </div>
        )
      ) : (
        <div style={inner.style}>{inner.text}</div>
      )}
      {selected && (
        <>
          <div style={{position: 'absolute', inset: 0, outline: `${2 / scale}px solid #2276fc`, pointerEvents: 'none'}} />
          {HANDLES.map(h => (
            <div
              key={h}
              onPointerDown={e => onPointerDown(e, el, h)}
              style={{
                position: 'absolute', width: handle, height: handle, background: '#fff',
                border: `${2 / scale}px solid #2276fc`, borderRadius: '50%',
                top: h[0] === 'n' ? -handle / 2 : undefined, bottom: h[0] === 's' ? -handle / 2 : undefined,
                left: h[1] === 'w' ? -handle / 2 : undefined, right: h[1] === 'e' ? -handle / 2 : undefined,
                cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize', touchAction: 'none',
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}

// ── Eigenschappen van het geselecteerde element ────────────────────────────
function Eigenschappen({el, update, onUploadImage, actions}) {
  const font = FONTS[el.font] || FONTS.thunder
  return (
    <Stack space={4}>
      <Flex align="center" justify="space-between">
        <Text weight="semibold">{SOORT_LABEL[el.soort]}</Text>
        <Flex gap={1}>
          <Button mode="bleed" fontSize={1} padding={2} text="Dupliceer" onClick={actions.duplicate} />
          <Button mode="bleed" tone="critical" fontSize={1} padding={2} text="Verwijder" onClick={actions.remove} />
        </Flex>
      </Flex>

      {el.soort === 'tekst' && (
        <>
          <Field label="Tekst">
            <TextArea rows={3} fontSize={1} value={el.tekst || ''} onChange={e => update({tekst: e.currentTarget.value})} />
          </Field>
          <Text size={0} muted>
            Codes die het scherm zelf invult: {TOKENS.map(t => `${t.code} ${t.uitleg}`).join(' · ')}
          </Text>
          <Flex gap={2}>
            <Box flex={2}>
              <Field label="Lettertype">
                <Select fontSize={1} value={el.font || 'thunder'} onChange={e => update({font: e.currentTarget.value, gewicht: FONTS[e.currentTarget.value].weights.at(-2)})}>
                  {Object.entries(FONTS).map(([key, f]) => (
                    <option key={key} value={key}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </Box>
            <Box flex={1}>
              <Field label="Dikte">
                <Select fontSize={1} value={el.gewicht || font.weights.at(-2)} onChange={e => update({gewicht: Number(e.currentTarget.value)})}>
                  {font.weights.map(w => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </Select>
              </Field>
            </Box>
          </Flex>
          <Flex gap={2}>
            <Box flex={1}>
              <NumberField label="Grootte (px)" value={el.grootte} min={12} max={900} onChange={grootte => update({grootte})} />
            </Box>
            <Box flex={1}>
              <Field label="Uitlijning">
                <Select fontSize={1} value={el.uitlijning || 'left'} onChange={e => update({uitlijning: e.currentTarget.value})}>
                  <option value="left">Links</option>
                  <option value="center">Midden</option>
                  <option value="right">Rechts</option>
                </Select>
              </Field>
            </Box>
          </Flex>
          <Text size={1}>
            <label>
              <input type="checkbox" checked={!!el.hoofdletters} onChange={e => update({hoofdletters: e.currentTarget.checked})} /> Hoofdletters
            </label>
          </Text>
          <ColorField label="Kleur" value={el.kleur} onChange={kleur => update({kleur})} />
        </>
      )}

      {el.soort === 'vorm' && (
        <>
          <Field label="Vorm">
            <Select fontSize={1} value={el.vorm || 'rechthoek'} onChange={e => update({vorm: e.currentTarget.value})}>
              <option value="rechthoek">Rechthoek</option>
              <option value="pill">Pil</option>
              <option value="cirkel">Cirkel / ovaal</option>
              <option value="kader">TURF-kader</option>
            </Select>
          </Field>
          <ColorField label="Kleur" value={el.kleur} onChange={kleur => update({kleur})} />
          <Flex gap={2}>
            <Box flex={1}>
              <NumberField label="Dekking (%)" value={el.dekking ?? 100} min={5} max={100} onChange={dekking => update({dekking})} />
            </Box>
            {(el.vorm || 'rechthoek') === 'rechthoek' && (
              <Box flex={1}>
                <NumberField label="Ronde hoeken (px)" value={el.radius ?? 0} min={0} max={500} onChange={radius => update({radius})} />
              </Box>
            )}
          </Flex>
        </>
      )}

      {el.soort === 'afbeelding' && (
        <>
          <Button mode="ghost" fontSize={1} text={el.afbeelding ? 'Andere afbeelding kiezen' : 'Afbeelding uploaden'} onClick={() => onUploadImage(asset => update({afbeelding: asset}))} />
          <Text size={1}>
            <label>
              <input type="checkbox" checked={!!el.kader} onChange={e => update({kader: e.currentTarget.checked})} /> TURF-kader (uitgebeten hoeken)
            </label>
          </Text>
          <Flex gap={2}>
            <Box flex={1}>
              <Field label="Passend maken">
                <Select fontSize={1} value={el.passing || 'cover'} onChange={e => update({passing: e.currentTarget.value})}>
                  <option value="cover">Vullen (bijsnijden)</option>
                  <option value="contain">Passend (heel beeld)</option>
                </Select>
              </Field>
            </Box>
            {!el.kader && (
              <Box flex={1}>
                <NumberField label="Ronde hoeken (px)" value={el.radius ?? 0} min={0} max={500} onChange={radius => update({radius})} />
              </Box>
            )}
          </Flex>
        </>
      )}

      {el.soort === 'logo' && (
        <Field label="Kleur">
          <Select fontSize={1} value={el.kleur || 'wit'} onChange={e => update({kleur: e.currentTarget.value})}>
            <option value="wit">Wit</option>
            <option value="donker">Zwart</option>
          </Select>
        </Field>
      )}

      <Flex gap={2}>
        {[
          ['X', 'x'],
          ['Y', 'y'],
          ['Breedte', 'w'],
          ['Hoogte', 'h'],
        ].map(([label, key]) => (
          <Box flex={1} key={key}>
            <NumberField label={label} value={Math.round(el[key] || 0)} onChange={n => update({[key]: key === 'w' || key === 'h' ? Math.max(MIN_SIZE, n) : n})} />
          </Box>
        ))}
      </Flex>
      <Flex gap={2}>
        <Button mode="ghost" fontSize={1} text="Naar voren" onClick={() => actions.reorder(1)} />
        <Button mode="ghost" fontSize={1} text="Naar achteren" onClick={() => actions.reorder(-1)} />
        <Button mode="ghost" fontSize={1} text="Centreer" onClick={actions.center} />
      </Flex>
    </Stack>
  )
}

// ── De editor (custom input voor een slideOntwerp-veld) ────────────────────
export default function OntwerpEditor(props) {
  const {value, onChange, schemaType, readOnly} = props
  const orient = schemaType.options?.orient === 'portrait' ? 'portrait' : 'landscape'
  const other = orient === 'portrait' ? 'landscape' : 'portrait'
  const {w: W, h: H} = CANVAS[orient]
  const client = useClient({apiVersion: '2024-01-01'})
  const toast = useToast()
  const otherValue = useFormValue([other === 'portrait' ? 'ontwerpPortrait' : 'ontwerpLandscape'])

  // Lokale kopie: tijdens slepen werken we die bij en pas bij loslaten gaat er een wijziging naar Sanity.
  const [local, setLocal] = useState(value || emptyOntwerp())
  const dragging = useRef(false)
  useEffect(() => {
    if (!dragging.current) setLocal(value || emptyOntwerp())
  }, [value])

  const [selectedKey, setSelectedKey] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const elementen = local.elementen || []
  const selected = elementen.find(e => e._key === selectedKey) || null

  const commit = useCallback(
    next => {
      setLocal(next)
      const isEmpty = !next.elementen?.length && (next.achtergrond || 'verloop1') === 'verloop1' && !value
      onChange(isEmpty ? unset() : set({...next, _type: 'slideOntwerp'}))
    },
    [onChange, value],
  )

  const withElement = (ontwerp, key, patch) => ({
    ...ontwerp,
    elementen: (ontwerp.elementen || []).map(e => (e._key === key ? {...e, ...patch} : e)),
  })
  const updateSelected = patch => selected && commit(withElement(local, selected._key, patch))

  const add = el => {
    commit({...local, elementen: [...elementen, el]})
    setSelectedKey(el._key)
  }

  // ── Schaal: het canvas past zich aan de beschikbare ruimte aan ──
  const areaRef = useRef(null)
  const [scale, setScale] = useState(0.3)
  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area) return undefined
    const measure = () => {
      const maxH = fullscreen ? area.clientHeight : orient === 'portrait' ? 640 : Infinity
      setScale(Math.max(0.05, Math.min(area.clientWidth / W, maxH / H)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(area)
    return () => ro.disconnect()
  }, [W, H, fullscreen, orient])

  // ── Slepen en schalen ──
  const onPointerDown = (e, el, mode) => {
    if (readOnly || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setSelectedKey(el._key)
    const start = {x: e.clientX, y: e.clientY, el}
    const ratio = el.w / el.h
    let latest = null
    dragging.current = true

    const move = ev => {
      const dx = (ev.clientX - start.x) / scale
      const dy = (ev.clientY - start.y) / scale
      let {x, y, w, h} = start.el
      if (mode === 'move') {
        x = Math.round(x + dx)
        y = Math.round(y + dy)
        // Klik vast op het midden van het canvas.
        if (Math.abs(x + w / 2 - W / 2) < SNAP) x = Math.round(W / 2 - w / 2)
        if (Math.abs(y + h / 2 - H / 2) < SNAP) y = Math.round(H / 2 - h / 2)
      } else {
        const east = mode[1] === 'e'
        const south = mode[0] === 's'
        w = Math.max(MIN_SIZE, Math.round(start.el.w + (east ? dx : -dx)))
        h = Math.max(MIN_SIZE, Math.round(start.el.h + (south ? dy : -dy)))
        // Logo's en afbeeldingen houden hun verhouding, tenzij je Shift indrukt; bij tekst en vormen andersom.
        const keepRatio = (start.el.soort === 'logo' || start.el.soort === 'afbeelding') !== ev.shiftKey
        if (keepRatio) h = Math.max(MIN_SIZE, Math.round(w / ratio))
        if (!east) x = start.el.x + start.el.w - w
        if (!south) y = start.el.y + start.el.h - h
      }
      latest = {x, y, w, h}
      setLocal(prev => withElement(prev, el._key, latest))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      dragging.current = false
      if (latest) commit(withElement(local, el._key, latest))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ── Toetsenbord ──
  const onKeyDown = e => {
    if (!selected || readOnly || e.target !== e.currentTarget) return
    const step = e.shiftKey ? 10 : 1
    const moves = {ArrowLeft: {x: selected.x - step}, ArrowRight: {x: selected.x + step}, ArrowUp: {y: selected.y - step}, ArrowDown: {y: selected.y + step}}
    if (moves[e.key]) {
      e.preventDefault()
      updateSelected(moves[e.key])
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      actions.remove()
    } else if (e.key === 'Escape') {
      setSelectedKey(null)
    }
  }

  // ── Afbeelding uploaden ──
  const fileRef = useRef(null)
  const onPicked = useRef(null)
  const pickImage = callback => {
    onPicked.current = callback
    fileRef.current?.click()
  }
  const onFile = e => {
    const file = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (!file) return
    setUploading(true)
    client.assets
      .upload('image', file, {filename: file.name})
      .then(doc => onPicked.current?.({_type: 'image', asset: {_type: 'reference', _ref: doc._id}}, doc))
      .catch(err => toast.push({status: 'error', title: 'Uploaden mislukt', description: err.message}))
      .finally(() => setUploading(false))
  }

  const actions = {
    remove: () => {
      if (!selected) return
      commit({...local, elementen: elementen.filter(e => e._key !== selected._key)})
      setSelectedKey(null)
    },
    duplicate: () => selected && add({...selected, _key: newKey(), x: selected.x + 40, y: selected.y + 40}),
    center: () => selected && updateSelected({x: Math.round((W - selected.w) / 2), y: Math.round((H - selected.h) / 2)}),
    reorder: dir => {
      const i = elementen.findIndex(e => e._key === selected?._key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= elementen.length) return
      const next = [...elementen]
      ;[next[i], next[j]] = [next[j], next[i]]
      commit({...local, elementen: next})
    },
  }

  const addImage = () =>
    pickImage((asset, doc) => {
      // Begin met de verhouding van de foto zelf, op een redelijke grootte.
      const dims = doc?.metadata?.dimensions
      const ratio = dims ? dims.width / dims.height : 0.85
      const h = Math.round(H * 0.6)
      const w = Math.min(Math.round(h * ratio), Math.round(W * 0.8))
      add(newElement('afbeelding', orient, {afbeelding: asset, w, h: Math.round(w / ratio), x: Math.round((W - w) / 2), y: Math.round((H - w / ratio) / 2)}))
    })

  const background = useMemo(() => backgroundStyle(local, orient, ASSETS), [local, orient])

  const toolbar = (
    <Flex gap={2} wrap="wrap" align="center">
      <Button mode="ghost" fontSize={1} text="+ Tekst" disabled={readOnly} onClick={() => add(newElement('tekst', orient))} />
      <Button mode="ghost" fontSize={1} text={uploading ? 'Uploaden…' : '+ Afbeelding'} disabled={readOnly || uploading} onClick={addImage} />
      <Button mode="ghost" fontSize={1} text="+ Vlak" disabled={readOnly} onClick={() => add(newElement('vorm', orient))} />
      <Button mode="ghost" fontSize={1} text="+ TURF-logo" disabled={readOnly} onClick={() => add(newElement('logo', orient))} />
      <Box flex={1} />
      {otherValue?.elementen?.length > 0 && elementen.length === 0 && (
        <Button
          mode="ghost"
          fontSize={1}
          text={`Neem ${other === 'landscape' ? 'liggend' : 'staand'} ontwerp over`}
          disabled={readOnly}
          onClick={() => commit(convertLayout(otherValue, other, orient))}
        />
      )}
      <Button mode={fullscreen ? 'default' : 'ghost'} tone="primary" fontSize={1} text={fullscreen ? 'Sluiten' : 'Groot bewerken'} onClick={() => setFullscreen(v => !v)} />
    </Flex>
  )

  const canvas = (
    <div ref={areaRef} style={{flex: 1, minWidth: 0, minHeight: 0, height: fullscreen ? '100%' : undefined, display: 'flex', justifyContent: 'center', alignItems: fullscreen ? 'center' : 'flex-start'}}>
      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={() => setSelectedKey(null)}
        aria-label={`Canvas ${orient === 'portrait' ? 'staand' : 'liggend'}`}
        style={{width: W * scale, height: H * scale, position: 'relative', overflow: 'hidden', borderRadius: 4, outline: 'none', boxShadow: '0 0 0 1px var(--card-border-color)', flex: 'none'}}
      >
        <div style={{width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0, color: '#fff', ...background}}>
          {elementen.map(el => (
            <CanvasElement key={el._key} el={el} selected={el._key === selectedKey} scale={scale} onPointerDown={onPointerDown} />
          ))}
        </div>
      </div>
    </div>
  )

  const panel = (
    <Stack space={4}>
      <Stack space={3}>
        <Text size={0} weight="semibold" muted>
          Achtergrond
        </Text>
        <Select fontSize={1} value={local.achtergrond || 'verloop1'} disabled={readOnly} onChange={e => commit({...local, achtergrond: e.currentTarget.value})}>
          {ACHTERGRONDEN.map(a => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
        {local.achtergrond === 'kleur' && <ColorField label="Kleur" value={local.achtergrondKleur || '#0d2023'} onChange={achtergrondKleur => commit({...local, achtergrondKleur})} />}
        {local.achtergrond === 'afbeelding' && (
          <Button mode="ghost" fontSize={1} text={local.achtergrondAfbeelding ? 'Andere achtergrond kiezen' : 'Achtergrond uploaden'} disabled={uploading} onClick={() => pickImage(asset => commit({...local, achtergrondAfbeelding: asset}))} />
        )}
      </Stack>
      <Card borderTop paddingTop={4}>
        {selected ? (
          <Eigenschappen el={selected} update={updateSelected} onUploadImage={pickImage} actions={actions} />
        ) : (
          <Text size={1} muted>
            Klik op een element om het aan te passen. Slepen verplaatst, de hoekpunten schalen, de pijltjestoetsen schuiven
            per pixel (Shift = 10) en Delete verwijdert.
          </Text>
        )}
      </Card>
    </Stack>
  )

  const hidden = (
    <>
      <style>{FONT_CSS}</style>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </>
  )

  if (fullscreen) {
    return (
      <>
        <Card padding={3} radius={2} border tone="transparent">
          <Text size={1} muted>
            Dit ontwerp is groot geopend.
          </Text>
        </Card>
        {/* Rechtstreeks in <body> met een hoge z-index: de Studio-navigatie en -panelen mogen er niet doorheen komen. */}
        {createPortal(
          <div style={{position: 'fixed', inset: 0, zIndex: 2000000, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'}}>
            <Card height="fill" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
              {hidden}
              <Card padding={3} borderBottom>
                {toolbar}
              </Card>
              <Flex style={{flex: 1, minHeight: 0}}>
                <Card flex={1} padding={4} tone="transparent" style={{minWidth: 0, minHeight: 0}}>
                  {canvas}
                </Card>
                <Card borderLeft padding={4} overflow="auto" style={{width: 340, flex: 'none'}}>
                  {panel}
                </Card>
              </Flex>
            </Card>
          </div>,
          document.body,
        )}
      </>
    )
  }

  return (
    <Stack space={3}>
      {hidden}
      {toolbar}
      {canvas}
      <Card padding={3} radius={2} border>
        {panel}
      </Card>
    </Stack>
  )
}

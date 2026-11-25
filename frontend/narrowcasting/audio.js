/**
 * Achtergrondgeluid per playlist: loopt door onder de slides en trekt zich niets aan van slidewissels.
 *
 * Browsers starten geluid alleen automatisch als dat mag (autoplay-beleid). Op de schermen
 * Chrome starten met --autoplay-policy=no-user-gesture-required, of één keer op het scherm
 * klikken/tikken: dan start het geluid alsnog.
 */
import {isScheduled} from './schedule.js'

const FADE_MS = 1500

export function createAudioPlayer({now, onBlocked = () => {}}) {
  const audio = new Audio()
  audio.preload = 'auto'
  let config = null // {nummers, volume, shuffle, van, tot}
  let signature = ''
  let order = []
  let index = -1
  let blocked = false
  let fadeTimer = null

  const targetVolume = () => Math.min(1, Math.max(0, (config?.volume ?? 60) / 100))
  const shouldPlay = () => !!config?.nummers?.length && isScheduled(config, now())

  function fadeTo(volume, then) {
    clearInterval(fadeTimer)
    const from = audio.volume
    const start = performance.now()
    fadeTimer = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / FADE_MS)
      audio.volume = from + (volume - from) * p
      if (p === 1) {
        clearInterval(fadeTimer)
        then?.()
      }
    }, 50)
  }

  function shuffled(n) {
    const a = [...Array(n).keys()]
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function buildOrder() {
    const n = config.nummers.length
    order = config.shuffle ? shuffled(n) : [...Array(n).keys()]
    index = -1
  }

  function playNext() {
    if (!shouldPlay()) return
    index++
    if (index >= order.length) buildOrder(), index++
    audio.src = config.nummers[order[index]]
    audio.volume = 0
    tryPlay()
  }

  function tryPlay() {
    audio
      .play()
      .then(() => {
        setBlocked(false)
        fadeTo(targetVolume())
      })
      .catch(err => {
        if (err.name === 'NotAllowedError') {
          setBlocked(true)
          console.warn('[narrowcasting] geluid geblokkeerd door de browser; klik op het scherm om te starten')
        } else {
          console.warn('[narrowcasting] nummer overgeslagen:', err.message)
          setTimeout(playNext, 1000)
        }
      })
  }

  function setBlocked(v) {
    if (v === blocked) return
    blocked = v
    onBlocked(v)
  }

  function stop() {
    setBlocked(false)
    if (audio.paused) return
    fadeTo(0, () => audio.pause())
  }

  audio.addEventListener('ended', playNext)
  audio.addEventListener('error', () => {
    console.warn('[narrowcasting] audiobestand kon niet laden:', audio.src)
    setTimeout(playNext, 2000)
  })

  // Eén klik of toets op het scherm heft de autoplay-blokkade op.
  const unlock = () => blocked && tryPlay()
  addEventListener('pointerdown', unlock)
  addEventListener('keydown', unlock)

  /** Nieuwe playlist-instellingen; herstart alleen als de nummers of de volgorde-instelling veranderen. */
  function update(geluid) {
    config = geluid?.nummers?.filter(Boolean).length ? {...geluid, nummers: geluid.nummers.filter(Boolean)} : null
    const sig = config ? JSON.stringify([config.nummers, !!config.shuffle]) : ''
    if (sig !== signature) {
      signature = sig
      if (!config) return stop()
      buildOrder()
      clearInterval(fadeTimer)
      audio.pause()
      playNext()
      return
    }
    check()
  }

  /** Start of stop op basis van het tijdvenster; past het volume aan. */
  function check() {
    if (!config) return
    if (!shouldPlay()) return stop()
    if (audio.paused) {
      if (!audio.src || audio.ended) playNext()
      else tryPlay()
    } else if (Math.abs(audio.volume - targetVolume()) > 0.01) fadeTo(targetVolume())
  }
  setInterval(check, 30 * 1000)

  function status() {
    if (!config) return 'geluid: uit'
    if (blocked) return 'geluid: GEBLOKKEERD (klik op scherm)'
    if (audio.paused) return 'geluid: stil (buiten venster)'
    return `♪ nummer ${index + 1}/${order.length}`
  }

  return {update, status}
}

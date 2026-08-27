import { useState, useEffect } from 'react'
import { imgSrc, gifSrc } from '../lib/exercises.js'
import { media } from '../lib/backend/index.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// Big autoplaying animation; tap toggles to the still frame. `compact` shrinks it (superset cards).
// Custom exercises have no media — the animation stays blank by design (issue #11).
// `minimizable` (workout view) adds a persistent minimize/expand control so the animation stops
// eating the screen; the chosen size is saved to settings and carries across exercises and
// future workouts (issue #12).
//
// Hook useGif: starts showing the bundled local JPG immediately so there is never a blank screen
// or loading spinner, and upgrades seamlessly to the animated GIF as soon as resolveGif resolves
// from the local LRU cache or downloads over WiFi.
export function useGif(ex) {
  const [activeGif, setActiveGif] = useState(null)
  // Settings' "Download on WiFi only" switch is the user's call, so it has to reach the
  // provider: without passing it the toggle stores a value that nothing ever reads.
  const wifiOnly = useStore(s => s.S.wifiOnlyMedia) !== false

  useEffect(() => {
    let mounted = true
    if (!ex?.gif) {
      setActiveGif(null)
      return
    }

    if (typeof media?.resolveGif === 'function') {
      media.resolveGif(ex, { allowCellular: !wifiOnly }).then(uri => {
        if (mounted && uri) setActiveGif(uri)
      }).catch(() => {})
    } else {
      setActiveGif(gifSrc(ex))
    }

    return () => {
      mounted = false
    }
  }, [ex?.id, ex?.gif, wifiOnly])

  return activeGif
}

export default function Media({ ex, id, compact, minimizable }) {
  const [playing, setPlaying] = useState(true)
  const gifSource = useGif(ex)
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)

  if (!ex?.gif && !ex?.img) return null
  const mini = minimizable && gifSize === 'mini'
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }

  const staticImg = imgSrc(ex)
  const currentSrc = playing ? (gifSource || staticImg) : staticImg

  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id} onClick={() => setPlaying(p => !p)}>
      <img decoding="async" src={currentSrc} alt={ex.n} />
      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
      {!mini && (
        <span className="gifhint">
          <Icon name={playing ? 'pause' : 'play'} />{playing ? t('tap to pause') : t('tap to play')}
        </span>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  if (!ex?.img) return <div className="thumb thumb-x"><Icon name="dumbbell" /></div>
  return <img className="thumb" loading="lazy" decoding="async" src={imgSrc(ex)} alt="" />
}

import { useEffect } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

const clock = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

// One bar, two meanings: the rest countdown between sets, and the work countdown during a
// timed set (issue #16). They are mutually exclusive by construction — startWork() stops any
// running rest — so the bar can never have to show both, and a work set gets its own colour
// plus a "Done" that logs the time actually held.
export default function RestTimer() {
  const timer = useUI(s => s.timer)
  const work = useUI(s => s.work)
  const { addRest, stopRest, finishWorkEarly, stopWork } = useUI()
  const on = work || timer

  // The bar is fixed above the tab bar and floats over whatever is beneath it — during a
  // rest that was the next set's row. Extra bottom padding lets the page scroll clear.
  useEffect(() => {
    document.body.classList.toggle('resting', !!on)
    return () => document.body.classList.remove('resting')
  }, [!!on])

  if (!on) return null

  if (work) {
    const isOver = work.left <= 0
    const pct = isOver ? 100 : Math.max(0, Math.min(100, ((work.total - work.left) / work.total) * 100))
    const displayTime = isOver ? `+${Math.abs(work.left)}s` : clock(work.left)

    return (
      <div id="timer" className={`working ${isOver ? 'target-reached' : ''}`}>
        <div className="t" style={{ color: isOver ? 'var(--green, #34c759)' : 'var(--acc)' }}>
          {displayTime}
        </div>
        <div className="grow">
          <div className="lbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{work.label || t('Work set')}</span>
            <span style={{ fontSize: 11, color: isOver ? 'var(--green, #34c759)' : 'var(--label-3)', fontWeight: 600 }}>
              {isOver ? `🎯 ${t('Objetivo cumplido')} (${work.total}s)` : `${work.total}s`}
            </span>
          </div>
          <div className="bar">
            <i style={{
              width: pct + '%',
              background: isOver ? 'var(--green, #34c759)' : 'var(--acc)'
            }} />
          </div>
        </div>
        <Button size="sm" onClick={stopWork}>{t('Cancel')}</Button>
        <Button
          size="sm"
          variant="primary"
          icon="check"
          style={isOver ? { background: 'var(--green, #34c759)', borderColor: 'var(--green, #34c759)', color: '#fff' } : undefined}
          onClick={finishWorkEarly}
        >
          {t('Done')}
        </Button>
      </div>
    )
  }

  // Rest timer
  const pct = Math.max(0, Math.min(100, (timer.left / timer.total) * 100))
  return (
    <div id="timer" className="rest">
      <div className="t">{clock(timer.left)}</div>
      <div className="grow" style={{ flex: 1, minWidth: 0 }}>
        <div className="lbl" style={{ fontSize: 12, color: 'var(--label-2)', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {timer.betweenExercises
            ? (timer.nextExName ? t('Next: {0}', timer.nextExName) : t('Rest between exercises'))
            : t('Resting between sets')}
        </div>
        <div className="bar"><i style={{ width: pct + '%' }} /></div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => addRest(30)}>+30s</Button>
      <Button
        size="sm"
        variant="primary"
        className="skip"
        icon={timer.betweenExercises ? 'forward' : 'play'}
        onClick={() => stopRest()}
      >
        {timer.betweenExercises
          ? (timer.nextExName ? t('Start {0}', timer.nextExName) : t('Next exercise'))
          : t('Ready / Next set')}
      </Button>
    </div>
  )
}

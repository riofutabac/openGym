import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { todayISO, weekKey } from '../lib/format.js'
import BodyMap, { BodyMapLegend } from './BodyMap.jsx'
import { loadOfWorkouts, rankOf, MUSCLE_NAME } from '../lib/muscles.js'
import { isHardSet } from '../lib/effort.js'
import { Button, Segmented } from './ui.jsx'

// Which muscles the training in a window actually hit — and, the point of the card,
// which ones it keeps missing. Shading is relative within the window (lib/muscles.js).
export default function MuscleBalance({ S }) {
  const [win, setWin] = useState(7)
  const [hard, setHard] = useState(false)
  const [sel, setSel] = useState(null)
  const now = Date.now()
  const inWin = S.workouts.filter(w =>
    win === 0 ? true
      : win === 7 ? weekKey(w.d) === weekKey(todayISO())
        : (w.start || new Date(w.d).getTime()) > now - win * 86400000)

  const rated = inWin.some(w => w.entries.some(e => e.sets.some(s => s.done && isHardSet(s))))
  const on = hard && rated
  const load = loadOfWorkouts(inWin, on ? isHardSet : null)
  const { worked, missed } = rankOf(load)
  const top = worked.slice(0, 4)
  const max = worked.length ? load[worked[0]] : 0
  const sets = m => Math.round((load[m] || 0) * 10) / 10

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>
          {t('Muscle balance')} <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>· {on ? t('by hard sets') : t('by sets worked')}</span>
        </h2>
        {rated && (
          <Button size="sm" icon="flame" style={on ? { color: 'var(--yellow)' } : undefined}
            onClick={() => { setHard(h => !h); setSel(null) }}>{on ? t('Hard') : t('All')}</Button>
        )}
      </div>
      <Segmented className="seg-range" value={win} onChange={v => { setWin(v); setSel(null) }}
        options={[{ value: 7, label: t('Week') }, { value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 0, label: t('All') }]} />
      {inWin.length ? (
        <>
          <BodyMap className="tappable" load={load} body={S.body} selected={sel}
            onMuscle={m => setSel(s => (s === m ? null : m))} />
          <BodyMapLegend />
          {sel && (
            <div className="mrow" style={{ borderTop: 'var(--hair) solid var(--sep)', marginTop: 4, paddingTop: 10 }}>
              <span className="nm"><b>{t(MUSCLE_NAME[sel])}</b></span>
              <span className="v">{sets(sel) ? t('{0} sets', sets(sel)) : on ? t('no hard sets') : t('not trained')}</span>
            </div>
          )}
          {!sel && top.map(m => (
            <div key={m} className="mrow">
              <span className="nm">{t(MUSCLE_NAME[m])}</span>
              <div className="bar"><div className="fill" style={{ width: max ? (load[m] / max * 100) + '%' : '0%' }} /></div>
              <span className="v">{t('{0} sets', sets(m))}</span>
            </div>
          ))}
          {missed.length > 0 && (
            <div className="muted small" style={{ marginTop: 8 }}>
              {t('Not trained:')}{' '}
              {missed.slice(0, 4).map(m => t(MUSCLE_NAME[m])).join(', ')}
            </div>
          )}
        </>
      ) : (
        <div className="muted small" style={{ marginTop: 12 }}>
          {t('No workouts in this period.')}
        </div>
      )}
    </div>
  )
}

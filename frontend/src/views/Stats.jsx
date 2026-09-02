import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { streakWeeks, workoutVolume } from '../lib/history.js'
import { fmtNum, fmtDate, fmtVol, fmtDur, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { workoutDetailSheet, WorkoutRow } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import MuscleBalance from '../components/MuscleBalance.jsx'
import Icon from '../components/Icon.jsx'
import {
  hasEffort, displayScale, scaleName, toScale, effortSummary, effortWeeks,
  effortHistogram, HARD_RIR
} from '../lib/effort.js'
import { Button, Segmented } from '../components/ui.jsx'

// How hard the training was — governed by the global range window.
function EffortCard({ S, win }) {
  const kind = displayScale(S)
  const hd = scaleName(kind)
  const sum = effortSummary(S, win)
  const weeks = effortWeeks(S, win)
  const hist = effortHistogram(S, win)
  const maxBin = Math.max(1, ...hist.map(b => b.n))
  const pts = weeks.map(w => ({ t: w.t, y: toScale(kind, w.rir), note: t('{0} sets', w.sets) }))
  const binLabel = b => kind === 'rpe' ? (b.tail ? '≤ 6' : String(10 - b.rir)) : (b.tail ? b.rir + '+' : String(b.rir))

  return (
    <div className="card">
      <h2>{t('Effort')} <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>· {t('how close to failure')}</span></h2>
      {sum.rated === 0 ? <div className="muted small">{t('No rated sets in this period.')}</div> : <>
        <div className="row between" style={{ alignItems: 'flex-end', gap: 12 }}>
          <div>
            <div className="stat-v">{sum.avg == null ? '—' : fmtNum(toScale(kind, sum.avg)) + ' ' + hd}</div>
            <div className="small dim">{t('average effort')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="stat-v" style={{ color: 'var(--yellow)' }}>{sum.hardPct == null ? '—' : Math.round(sum.hardPct * 100) + '%'}</div>
            <div className="small dim">{t('at {0} {1} or harder', hd, fmtNum(toScale(kind, HARD_RIR)))}</div>
          </div>
        </div>
        <div className="small dim" style={{ marginTop: 8 }}>{t('{0} of {1} finished sets rated', sum.rated, sum.done)}</div>
        {pts.length > 1 && <>
          <h4 className="sec" style={{ marginTop: 12 }}>{t('Week by week')}</h4>
          <div className="chart"><LineChart points={pts} h={140} unit={hd} color="var(--yellow)" invert={kind === 'rir'} /></div>
        </>}
        <h4 className="sec" style={{ marginTop: 12 }}>{t('Where the sets land')}</h4>
        {hist.map(b => <div key={b.rir} className="mrow">
          <span className="nm">{hd} {binLabel(b)}</span>
          <span className="bar"><i style={{ width: Math.round(b.n / maxBin * 100) + '%', background: b.rir <= HARD_RIR ? 'var(--yellow)' : 'var(--label-3)' }} /></span>
          <span className="v">{b.n ? b.n + ' · ' + Math.round(b.pct * 100) + '%' : '—'}</span>
        </div>)}
        <div className="small dim" style={{ marginTop: 8 }}>
          {t('Most working sets belong close to failure without living there — half at the floor and half at the top average out to a healthy-looking middle.')}
        </div>
      </>}
    </div>
  )
}

export default function Stats() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [range, setRange] = useState(90)
  const now = Date.now()
  const anyEffort = hasEffort(S)

  const inWin = S.workouts.filter(w =>
    range === 0 ? true : (w.start || new Date(w.d).getTime()) > now - range * 86400000
  )
  const totalVol = inWin.reduce((acc, w) => acc + (w.vol || workoutVolume(w)), 0)
  const totalSec = inWin.reduce((acc, w) => acc + Math.max(0, ((w.end || w.start) - w.start) / 1000), 0)

  return (
    <div className="narrow">
      <div className="hdr">
        <div>
          <h1>{t('Stats')}</h1>
          <div className="sub">{t('Progress & history')}</div>
        </div>
        <button className="iconbtn" onClick={() => nav('/history')} aria-label={t('History')}><Icon name="history" /></button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Segmented
          className="seg-range"
          value={range}
          onChange={setRange}
          options={[
            { value: 30, label: '30d' },
            { value: 90, label: '90d' },
            { value: 365, label: '1Y' },
            { value: 0, label: t('All') },
          ]}
        />
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="l"><Icon name="dumbbell" />{t('Workouts')}</div>
          <div className="v">{inWin.length}</div>
        </div>
        <div className="tile">
          <div className="l"><Icon name="timer" />{t('Time')}</div>
          <div className="v" style={{ fontSize: '1.25rem' }}>{totalSec > 0 ? fmtDur(totalSec) : '0m'}</div>
        </div>
        <div className="tile">
          <div className="l"><Icon name="flame" />{t('Week streak')}</div>
          <div className="v">{streakWeeks(S)}</div>
        </div>
        <div className="tile">
          <div className="l"><Icon name="chartLine" />{t('Volume')}</div>
          <div className="v" style={{ fontSize: '1.25rem' }}>{fmtVol(totalVol, S.unit)}</div>
        </div>
      </div>

      {S.workouts.length > 0 && <MuscleBalance S={S} />}
      {anyEffort && <EffortCard S={S} win={range} />}

      {S.workouts.length > 0 && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h4 className="sec" style={{ margin: 0 }}>{t('Recent workouts')}</h4>
            <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/history')}>
              {t('All')} {S.workouts.length}
            </Button>
          </div>
          <div className="list">
            {[...S.workouts].reverse().slice(0, 6).map(w => (
              <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

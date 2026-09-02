import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI, stopWorkoutHeartbeat } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { effectiveRoutine, effectiveRestSec, lastEntryFor, bestWeightFor, buildSets, setsDoneActive, supersetUnits, unitOf, setLabel, modeOf, isBw, isPerSide, sideReps, repStep, EFFORT, effortOf } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, exCount, DAYN } from '../lib/format.js'
import { beep, vibrate } from '../lib/sound.js'
import { t } from '../lib/i18n.js'
import Media from '../components/Media.jsx'
import { startFlow, exerciseDetailSheet, finishWorkout, confirmSheet, effortPickerSheet, toggleActiveSet } from '../sheets.jsx'
import { clearOngoingWorkoutNotification } from '../lib/mobile.js'
import Icon from '../components/Icon.jsx'
import { Button, Check, NumberField } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'

/* ---------- start chooser (no active workout) ---------- */
function StartChooser() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const todayR = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const others = S.routines.filter(r => r !== todayR)
  return <div className="narrow">
    <div className="hdr"><div><h1>{t('Start workout')}</h1><div className="sub">{t(DAYN[new Date().getDay()])} — {todayR ? t('today is {0}', todayR.name) : t('rest day, but no one’s stopping you')}</div></div></div>
    {todayR && <div className="card" style={{ borderColor: 'var(--acc)' }}>
      <h2 className="accent">{t("Today's plan")}{todayOvr ? ' · ' + t('rescheduled') : ''}</h2>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div><div className="big">{todayR.name}</div><div className="muted small">{exCount(todayR.ex.length)}</div></div>
        <span className="lrow-i" style={{ width: 38, height: 38, borderRadius: 9, fontSize: 22 }}><Icon name={glyphOf(todayR.emoji)} /></span>
      </div>
      <Button variant="primary" icon="play" onClick={() => startFlow(todayR.id)}>{t('Start {0}', todayR.name)}</Button>
    </div>}
    {others.length > 0 && <><h4 className="sec">{t('Other routines')}</h4>
      <div className="list">{others.map(r => <div key={r.id} className="item" onClick={() => startFlow(r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <span className="tag acc">{t('Start')}</span></div>)}</div></>}
    <div style={{ height: 14 }} />
    <Button icon="shuffle" onClick={() => startFlow(null)}>{t('Freestyle workout (pick as you go)')}</Button>
    {!S.routines.length && <><div style={{ height: 10 }} /><Button variant="primary" onClick={() => nav('/plan')}>{t('Build a plan first')}</Button></>}
  </div>
}

/* ---------- elapsed clock (isolated so the workout tree doesn't re-render every second) ---------- */
function Elapsed({ start }) {
  const [t, setT] = useState('0:00')
  useEffect(() => {
    const tick = () => { const s = Math.floor((Date.now() - start) / 1000); setT(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')) }
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [start])
  return <span>{t}</span>
}

/* ---------- one exercise block (reps: weight×reps · time: a held duration · cardio: duration+speed) ---------- */
function ExerciseBlock({ entryIdx, compact, onToggle, onField, onStartTimed }) {
  const S = useStore(s => s.S)
  const working = useUI(s => s.work)
  const entry = S.active.entries[entryIdx]
  const ex = exOr(entry.id)
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  const cardio = mode === 'cardio'
  const timed = mode === 'time'
  const last = lastEntryFor(S, entry.id)
  const best = cardio ? 0 : Math.max(bestWeightFor(S, entry.id), (S.exWeights[entry.id] || {}).w || 0)
  const plan = entry.plan
  const cfg = { ...(entry.target || {}), id: entry.id }
  const bw = !cardio && isBw(cfg)

  const kind = effortOf(S)
  const eff = EFFORT[kind]

  const bumpWeight = (s, i, dir) => {
    const cur = s.w || 0
    onField(i, 'w', Math.max(0, Math.round((cur + dir * 2.5) * 100) / 100))
  }

  const activeSetIdx = entry.sets.findIndex(s => !s.done)

  return <>
    <Media ex={ex} key={entry.id} compact={compact} minimizable />
    <div className="row between" style={{ marginBottom: 6 }}>
      <div style={{ fontSize: compact ? 17 : 20, fontWeight: 600, letterSpacing: '-.02em', textTransform: 'capitalize', lineHeight: 1.2 }}>{ex.n}</div>
      <button className="iconbtn" aria-label={t('Details')} onClick={() => exerciseDetailSheet(ex)}><Icon name="info" /></button>
    </div>
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      {cardio && <span className="tag acc"><Icon name="figureRun" />{t('Cardio')}</span>}
      {!cardio && !timed && isPerSide(cfg) && <span className="tag acc nocap"><Icon name="shuffle" />{t('{0} per side', fmtNum(sideReps(entry.sets.find(s => !s.done)?.r ?? entry.sets[0]?.r)))}</span>}
      {(ex.tg || ex.bp) && <span className="tag">{t(ex.tg || ex.bp)}</span>}
      {ex.eq && <span className="tag">{t(ex.eq)}</span>}
      {best > 0 && <span className="tag nocap">{t('Best:')} {fmtNum(best)} {S.unit}</span>}
    </div>
    {last && <div className="small dim" style={{ marginBottom: 4 }}>{t('Last time')} ({fmtDate(last.d)}): {last.sets.map(s => setLabel(entry.id, s, last.target)).join(', ')}</div>}
    {plan && plan.why && plan.kind !== 'off' && <div className={'progline' + (plan.kind === 'deload' ? ' warn' : '')}>
      <Icon name={plan.kind === 'up' ? 'arrowUp' : plan.kind === 'deload' ? 'arrowDown' : 'lightbulb'} />
      <span>{t(...plan.why)}</span>
    </div>}
    <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>
      <div className="sethead">
        <span className="n-sp" />
        <span className="w-sp">{cardio ? t('Duration') : timed ? t('Seconds') : (bw ? t('Added weight (+{0})', S.unit) : t('Weight ({0})', S.unit))}</span>
        <span className="r-sp">{cardio ? t('Speed (km/h)') : t('Reps')}</span>
        <span className="ck-sp" />
      </div>

      {entry.sets.map((s, i) => {
        if (s.done) {
          return (
            <div key={i} className="setrow done">
              <div className="n done">{i + 1}</div>
              <div className="set-summary">
                {cardio ? (
                  <span><b>{s.min} min</b> @ <b>{s.speed} km/h</b></span>
                ) : timed ? (
                  <span><b>{s.sec}s</b> {s.w > 0 ? `· +${fmtNum(s.w)} ${S.unit}` : ''}</span>
                ) : (
                  <span>
                    <b>{s.w > 0 ? `${fmtNum(s.w)} ${S.unit}` : t('BW')}</b> × <b>{s.r}</b>
                    {s[kind] != null && <span className="eff-tag" style={{ marginLeft: 6 }}>{kind === 'rpe' ? `RPE ${s[kind]}` : `${s[kind]} RIR`}</span>}
                  </span>
                )}
              </div>
              <Check checked={true} onChange={() => onToggle(i)} />
            </div>
          )
        }

        const isHero = i === activeSetIdx

        return (
          <div key={i} className={'setrow ' + (isHero ? 'hero' : 'upcoming')}>
            {isHero && (
              <div className="hero-badge">
                <div className="n hero">{i + 1}</div>
                <span className="hero-label">{t('Current set')}</span>
              </div>
            )}
            {!isHero && <div className="n">{i + 1}</div>}
            <div className="hero-controls">
              <div className="hero-fields">
                {cardio ? (
                  <>
                    <div className="rep-badge"><span className="rep-num">{s.min}</span><span className="rep-lbl">min</span></div>
                    <div className="rep-badge"><span className="rep-num">{s.speed}</span><span className="rep-lbl">km/h</span></div>
                  </>
                ) : timed ? (
                  <>
                    <div className="rep-badge"><span className="rep-num">{s.sec}</span><span className="rep-lbl">s</span></div>
                    {bw ? null : (
                      <div className="stp w">
                        <button aria-label="Decrease" onClick={() => bumpWeight(s, i, -1)}><Icon name="minus" /></button>
                        <span className="val"><NumberField decimal value={s.w ?? ''} onChange={v => onField(i, 'w', v)} /></span>
                        <button aria-label="Increase" onClick={() => bumpWeight(s, i, 1)}><Icon name="plus" /></button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Live Weight Stepper */}
                    <div className="stp w">
                      <button aria-label="Decrease" onClick={() => bumpWeight(s, i, -1)}><Icon name="minus" /></button>
                      <span className="val"><NumberField decimal value={s.w ?? ''} onChange={v => onField(i, 'w', v)} /></span>
                      <button aria-label="Increase" onClick={() => bumpWeight(s, i, 1)}><Icon name="plus" /></button>
                    </div>
                    {/* Fixed Reps Badge */}
                    <div className="rep-badge">
                      <span className="rep-num">{s.r}</span>
                      <span className="rep-lbl">{t('Reps')}</span>
                    </div>
                  </>
                )}
              </div>
              {mode === 'reps' && eff && (
                <button
                  type="button"
                  className={'eff-pill' + (s[kind] != null ? ' set' : '')}
                  onClick={() => effortPickerSheet(s[kind], kind, v => onField(i, kind, v))}
                  title={t('Rate of Perceived Exertion (RPE)')}
                >
                  <Icon name="chartLine" />
                  <span>{s[kind] != null ? (kind === 'rpe' ? `RPE ${s[kind]}` : `${s[kind]} RIR`) : t('+ Effort')}</span>
                </button>
              )}
            </div>
            {timed && (
              <button className={'setgo' + (isHero ? ' hero' : '')} aria-label={t('Start set')} disabled={s.done || !!working}
                onClick={() => onStartTimed(i)}><Icon name="play" /></button>
            )}
            <Check checked={false} onChange={() => onToggle(i)} />
          </div>
        )
      })}
    </div>
  </>
}

/* ---------- active workout ---------- */
function ActiveWorkout() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { startRest, stopRest } = useUI()
  const timer = useUI(s => s.timer)
  const A = S.active
  const units = supersetUnits(A.entries)
  const cur = Math.min(A.cur, Math.max(0, A.entries.length - 1))
  const unit = A.entries.length ? unitOf(units, cur) : []
  const unitIdx = units.findIndex(u => u === unit)
  const isSuperset = unit.length > 1

  const total = A.entries.reduce((n, e) => n + e.sets.length, 0)
  const done = setsDoneActive(A)

  const mutEntry = (idx, fn) => update(s => { fn(s.active.entries[idx]) }, true)
  const setField = (idx, i, field, v) => mutEntry(idx, e => {
    if (v == null) delete e.sets[i][field]; else e.sets[i][field] = v
  })
  const modeAt = idx => modeOf({ ...(A.entries[idx].target || {}), id: A.entries[idx].id })

  const startTimed = (idx, i) => {
    const e = A.entries[idx]
    useUI.getState().startWork(e.sets[i].sec || 45, exOr(e.id).n, elapsed => {
      mutEntry(idx, en => { en.sets[i].sec = elapsed })
      if (!useStore.getState().S.active.entries[idx].sets[i].done) toggle(idx, i)
    })
  }

  const toggle = (idx, i) => toggleActiveSet(idx, i)

  const discardPrompt = () => {
    confirmSheet({
      title: t('Discard workout?'),
      message: t('The sets you logged in this session will be lost.'),
      confirmText: t('Discard'),
      danger: true,
      onConfirm: () => {
        update(s => { s.active = null })
        stopRest()
        stopWorkoutHeartbeat()
        nav('/home')
      }
    })
  }

  // Focus mode: back navigation protection
  useEffect(() => {
    if (!A) return
    window.history.pushState({ workoutLock: true }, '')
    const onPop = () => {
      if (useStore.getState().S.active) {
        window.history.pushState({ workoutLock: true }, '')
        discardPrompt()
      }
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [!A])

  const exDone = A.entries.filter(e => e.sets.length && e.sets.every(s => s.done)).length
  const allDone = A.entries.length > 0 && exDone === A.entries.length

  return <div className="narrow">
    {timer ? (
      <div className="rest-hdr">
        <div className="rest-top">
          <span className="rest-tag">
            <Icon name={timer.betweenExercises ? 'forward' : 'pause'} />
            {' '}
            {timer.betweenExercises
              ? (timer.nextExName ? t('Next: {0}', timer.nextExName) : t('Rest between exercises'))
              : t('Resting between sets')}
          </span>
          <button className="iconbtn" aria-label={t('Discard')} onClick={discardPrompt}><Icon name="xmark" /></button>
        </div>
        <div className="rest-clock">{Math.floor(timer.left / 60)}:{String(timer.left % 60).padStart(2, '0')}</div>
        <div className="rest-bar"><i style={{ width: ((timer.left / timer.total) * 100) + '%' }} /></div>
      </div>
    ) : (
      <div className="hdr" style={{ alignItems: 'center', marginBottom: 12 }}>
        <button className="iconbtn" aria-label={t('Discard')} onClick={discardPrompt}><Icon name="xmark" /></button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{A.name}</div>
          <div className="sub" style={{ fontSize: 13, marginTop: 2 }}>
            <Elapsed start={A.start} /> · {t('{0} sets', done + '/' + total)}
          </div>
        </div>
        <div style={{ width: 36 }} />
      </div>
    )}

    {/* Top exercise navigation bar */}
    <div className="row between" style={{ alignItems: 'center', background: 'var(--surface-1)', padding: '6px 10px', borderRadius: 'var(--r-md)', marginBottom: 10 }}>
      <button
        className="iconbtn"
        style={{ width: 34, height: 34 }}
        disabled={unitIdx <= 0}
        onClick={() => update(s => { s.active.cur = units[unitIdx - 1][0] })}
        aria-label={t('Prev')}
      >
        <Icon name="chevronLeft" />
      </button>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)' }}>
          {isSuperset ? t('Superset {0} / {1}', unitIdx + 1, units.length) : t('Exercise {0} / {1}', unitIdx + 1, units.length)}
        </div>
      </div>

      <button
        className="iconbtn"
        style={{ width: 34, height: 34 }}
        disabled={unitIdx < 0 || unitIdx >= units.length - 1}
        onClick={() => update(s => { s.active.cur = units[unitIdx + 1][0] })}
        aria-label={t('Next')}
      >
        <Icon name="chevronRight" />
      </button>
    </div>

    <div className="wprog"><i style={{ width: (total ? done / total * 100 : 0) + '%' }} /></div>

    {A.entries.length ? (
      isSuperset ? (
        <div className="ss-card">
          <div className="ss-hd"><Icon name="link" />{t('Superset · do these back-to-back, rest after both')}</div>
          {unit.map((idx, k) => <div key={idx} className="ss-ex">
            {k > 0 && <div className="ss-amp">+</div>}
            <ExerciseBlock entryIdx={idx} compact
              onToggle={i => toggle(idx, i)} onField={(i, f, v) => setField(idx, i, f, v)} onStartTimed={i => startTimed(idx, i)} />
          </div>)}
        </div>
      ) : (
        <ExerciseBlock entryIdx={cur} onToggle={i => toggle(cur, i)} onField={(i, f, v) => setField(cur, i, f, v)} onStartTimed={i => startTimed(cur, i)} />
      )
    ) : <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises in this workout.')}</div>}

    {allDone && (
      <>
        <div style={{ height: 20 }} />
        <Button
          variant="primary"
          style={{ width: '100%', minHeight: 48, fontSize: 16, fontWeight: 600 }}
          icon="flag"
          onClick={finishWorkout}
        >
          {t('Finish workout')}
        </Button>
      </>
    )}

    <div style={{ height: 40 }} />
  </div>
}

export default function Workout() {
  const active = useStore(s => s.S.active)
  return active ? <ActiveWorkout /> : <StartChooser />
}

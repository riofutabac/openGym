import { create } from 'zustand'
import { uid } from '../lib/format.js'
import { beep, vibrate } from '../lib/sound.js'
import { t } from '../lib/i18n.js'
import { useStore } from './useStore.js'
import { scheduleRestNotification, cancelRestNotification, updateOngoingWorkoutNotification, clearOngoingWorkoutNotification, onNotificationAction, WorkoutNotification, MOBILE } from '../lib/mobile.js'
import { isBw, effectiveRestSec } from '../lib/history.js'
import { EXIDX, isCardio } from '../lib/exercises.js'
import { toggleActiveSet } from '../sheets.jsx'

const activeName = () => useStore.getState().S?.active?.name

export const getActiveWorkoutMeta = () => {
  const store = useStore.getState()
  const active = store.S?.active
  if (!active) return null
  const curIdx = active.cur || 0
  const entry = active.entries[curIdx]
  const ex = entry ? EXIDX[entry.id] : null
  const exName = entry ? (ex?.n || entry.id) : active.name
  const totalSets = entry ? entry.sets.length : 0
  const doneSets = entry ? entry.sets.filter(s => s.done).length : 0
  const currentSet = entry ? (entry.sets.find(s => !s.done) || entry.sets[entry.sets.length - 1]) : null
  const setIdx = entry ? Math.min(totalSets, doneSets + 1) : 1
  const reps = currentSet?.r ?? entry?.target?.reps ?? 10
  const weight = currentSet?.w ?? entry?.target?.weight ?? 0
  const bw = isBw(entry || { id: entry?.id })
  const cardio = isCardio(entry?.id)
  const nextEntry = active.entries[curIdx + 1]
  const nextExName = nextEntry ? (EXIDX[nextEntry.id]?.n || nextEntry.id) : null

  return {
    name: active.name,
    exerciseName: exName,
    setIndex: setIdx,
    totalSets,
    reps,
    weight,
    weightUnit: store.S?.unit || 'kg',
    nextExName,
    isBw: bw,
    isCardio: cardio
  }
}

let heartbeatInt = null

export const syncWorkoutNotification = (restEndsAt) => {
  if (!MOBILE) return
  const meta = getActiveWorkoutMeta()
  if (!meta) {
    if (heartbeatInt) { clearInterval(heartbeatInt); heartbeatInt = null }
    clearOngoingWorkoutNotification().catch(() => {})
    return
  }
  const tm = useUI.getState().timer
  const endsAt = restEndsAt !== undefined ? restEndsAt : (tm && tm.endsAt > Date.now() ? tm.endsAt : undefined)
  updateOngoingWorkoutNotification({ ...meta, restEndsAt: endsAt }).catch(() => {})

  if (!heartbeatInt) {
    heartbeatInt = setInterval(() => {
      const curMeta = getActiveWorkoutMeta()
      if (!curMeta) {
        clearInterval(heartbeatInt)
        heartbeatInt = null
        clearOngoingWorkoutNotification().catch(() => {})
        return
      }
      const curTimer = useUI.getState().timer
      const curEndsAt = curTimer && curTimer.endsAt > Date.now() ? curTimer.endsAt : undefined
      updateOngoingWorkoutNotification({ ...curMeta, restEndsAt: curEndsAt }).catch(() => {})
    }, 30000)
  }
}

export const stopWorkoutHeartbeat = () => {
  if (heartbeatInt) { clearInterval(heartbeatInt); heartbeatInt = null }
  clearOngoingWorkoutNotification().catch(() => {})
}

if (MOBILE && typeof WorkoutNotification?.addListener === 'function') {
  try {
    WorkoutNotification.addListener('notificationAction', (event) => {
      if (!event || !event.action) return
      const store = useStore.getState()
      const active = store.S?.active
      if (!active) return

      const curIdx = active.cur || 0
      const entry = active.entries[curIdx]
      if (!entry) return

      if (event.action === 'stepReps') {
        const sIdx = entry.sets.findIndex(s => !s.done)
        const targetSetIdx = sIdx >= 0 ? sIdx : entry.sets.length - 1
        if (targetSetIdx < 0) return

        store.update(s => {
          const e = s.active.entries[curIdx]
          if (!e || !e.sets[targetSetIdx]) return
          const curR = e.sets[targetSetIdx].r ?? e.target?.reps ?? 10
          e.sets[targetSetIdx].r = Math.max(0, curR + (event.delta || 0))
        })
        syncWorkoutNotification()
      } else if (event.action === 'stepWeight') {
        const sIdx = entry.sets.findIndex(s => !s.done)
        const targetSetIdx = sIdx >= 0 ? sIdx : entry.sets.length - 1
        if (targetSetIdx < 0) return

        store.update(s => {
          const e = s.active.entries[curIdx]
          if (!e || !e.sets[targetSetIdx]) return
          const curW = e.sets[targetSetIdx].w ?? e.target?.weight ?? 0
          e.sets[targetSetIdx].w = Math.max(0, Math.round((curW + (event.delta || 0)) * 100) / 100)
        })
        syncWorkoutNotification()
      } else if (event.action === 'completeSet') {
        const sIdx = entry.sets.findIndex(s => !s.done)
        const targetSetIdx = sIdx >= 0 ? sIdx : entry.sets.length - 1
        if (targetSetIdx >= 0) {
          toggleActiveSet(curIdx, targetSetIdx)
        }
      } else if (event.action === 'skipRest') {
        useUI.getState().stopRest()
        syncWorkoutNotification()
      }
    }).catch(() => {})
  } catch (e) {}
}

const pushRestTimer = (sec) => {
  if (!MOBILE) return
  const meta = getActiveWorkoutMeta()
  const name = meta?.name || activeName()
  scheduleRestNotification(sec, { workoutName: name }).catch(() => {})
  syncWorkoutNotification(Date.now() + sec * 1000)
}

const cancelPushRestTimer = (repost = true) => {
  if (!MOBILE) return
  cancelRestNotification().catch(() => {})
  if (!repost) return
  syncWorkoutNotification(null)
}

let toastTm = null
let timerInt = null
let timerTick = null
let workInt = null
let workTick = null
let workDone = null

export const useUI = create((set, get) => ({
  sheets: [],          // { id, render:(close)=>JSX, kind:'sheet'|'center', locked }
  toastMsg: '',
  timer: null,         // rest countdown between sets — { left, total, endsAt }
  work: null,          // work countdown DURING a timed set (issue #16) — { left, total, endsAt, label }

  openSheet(render, { kind = 'sheet', locked = false } = {}) {
    const id = uid()
    set(s => ({ sheets: [...s.sheets, { id, render, kind, locked }] }))
    const close = () => get().closeSheet(id)
    return { id, close, lock: v => set(s => ({ sheets: s.sheets.map(x => x.id === id ? { ...x, locked: v } : x) })) }
  },
  closeSheet(id) { set(s => ({ sheets: s.sheets.filter(x => x.id !== id) })) },
  closeAll() { set({ sheets: [] }) },

  toast(msg) {
    set({ toastMsg: msg })
    clearTimeout(toastTm)
    toastTm = setTimeout(() => set({ toastMsg: '' }), 2200)
  },

  startRest(sec, meta = {}) {
    get().stopRest({ repost: false })
    const endsAt = Date.now() + sec * 1000
    set({ timer: { left: sec, total: sec, endsAt, ...meta } })
    pushRestTimer(sec)
    timerTick = () => {
      const tm = get().timer
      if (!tm) return
      const left = Math.max(0, Math.round((tm.endsAt - Date.now()) / 1000))
      if (left === tm.left) return
      const snd = useStore.getState().S.sound
      if (left <= 0) {
        cancelPushRestTimer()
        beep(snd, 880, 0.15); beep(snd, 880, 0.15, 0.25); beep(snd, 1320, 0.4, 0.5)
        vibrate([200, 100, 200]); get().toast(t('Rest over — next set!')); get().stopRest(); return
      }
      if (left <= 3) beep(snd, 660, 0.1)
      set({ timer: { ...tm, left } })
    }
    timerInt = setInterval(timerTick, 1000)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', timerTick)
  },
  addRest(sec) {
    const tm = get().timer
    if (!tm) return
    const left = tm.left + sec
    // taking off more than is left means "I'm ready now" — same as skipping, and it keeps a
    // negative duration out of both the progress bar and the server-side push schedule
    if (left <= 0) { get().stopRest(); return }
    set({ timer: { ...tm, left, total: tm.total + sec, endsAt: tm.endsAt + sec * 1000 } })
    pushRestTimer(left)
  },
  stopRest(opts = {}) {
    if (timerInt) clearInterval(timerInt); timerInt = null
    if (timerTick && typeof document !== 'undefined') document.removeEventListener('visibilitychange', timerTick); timerTick = null
    cancelPushRestTimer(opts.repost !== false)
    set({ timer: null })
  },

  /* ---- work timer (issue #16) ----
     Times the set itself, not the recovery after it. Kept separate from the rest timer on
     purpose: the two mean opposite things, they must never run together, and a work set is
     something you are watching — so it gets no server push (that endpoint says "rest over",
     and a plank does not need a notification you are staring at anyway).
     Times the set itself, not the recovery after it. Kept separate from the rest timer on
     purpose: the two mean opposite things, they must never run together, and a work set is
     something you are watching — so it gets no server push (that endpoint says "rest over",
     and a plank does not need a notification you are staring at anyway).
     `onDone(elapsedSec)` is called on finish; the actual elapsed time is what gets logged,
     so stopping at 0:38 of a 0:45 target records 0:38, and holding past 0:45 (e.g. 0:52) records 0:52.
     The prescribed duration is an advisory target, not a hard cutoff. */
  startWork(sec, label, onDone) {
    get().stopWork()
    get().stopRest()
    const total = Math.max(1, Math.round(sec) || 1)
    const startedAt = Date.now()
    const endsAt = startedAt + total * 1000
    workDone = onDone
    set({ work: { left: total, total, startedAt, endsAt, label, targetReached: false } })
    workTick = () => {
      const wk = get().work
      if (!wk) return
      const now = Date.now()
      const left = Math.round((wk.endsAt - now) / 1000)
      const elapsed = Math.max(0, Math.round((now - wk.startedAt) / 1000))
      const snd = useStore.getState().S.sound

      if (left <= 0 && !wk.targetReached) {
        beep(snd, 880, 0.15); beep(snd, 880, 0.15, 0.25); beep(snd, 1320, 0.4, 0.5)
        vibrate([200, 100, 200])
        set({ work: { ...wk, left, elapsed, targetReached: true } })
        return
      }
      if (left > 0 && left <= 3 && !wk.targetReached) {
        beep(snd, 660, 0.1)
      }
      set({ work: { ...wk, left, elapsed } })
    }
    workInt = setInterval(workTick, 1000)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', workTick)
  },
  // User confirmed completion — log the actual time held (early, on time, or beyond target).
  finishWorkEarly() {
    const wk = get().work
    if (!wk) return
    const elapsed = Math.max(1, Math.round((Date.now() - (wk.startedAt || (wk.endsAt - wk.total * 1000))) / 1000))
    const done = workDone
    vibrate(30)
    get().stopWork()
    if (done) done(elapsed)
  },
  // Abandon without logging anything.
  stopWork() {
    if (workInt) clearInterval(workInt); workInt = null
    if (workTick && typeof document !== 'undefined') document.removeEventListener('visibilitychange', workTick); workTick = null
    workDone = null
    set({ work: null })
  }
}))

// Lock-screen buttons on the rest alarm. Registered once, native build only.
//
// The handler re-reads live state instead of closing over the rest it was scheduled with:
// the tap can arrive long after, and if the app was killed in between there is no timer left
// to extend — addRest already no-ops in that case, which is the honest outcome rather than
// resurrecting a rest the user has long since finished.
if (MOBILE) {
  onNotificationAction(({ actionId }) => {
    if (actionId === 'rest-add') useUI.getState().addRest(15)
    else if (actionId === 'rest-skip') useUI.getState().stopRest()
  })
}

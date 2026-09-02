import { todayISO } from './format.js'

export function lastDoneAt(S, routineId) {
  if (!S?.workouts?.length || !routineId) return null
  let latest = null
  let maxTime = -1
  for (const w of S.workouts) {
    if (w.rid === routineId) {
      const t = w.start || (w.d ? new Date(w.d + 'T12:00:00').getTime() : 0)
      if (t > maxTime) {
        maxTime = t
        latest = w.d
      }
    }
  }
  return latest
}

export function lastDoneTimestamp(S, routineId) {
  if (!S?.workouts?.length || !routineId) return 0
  let maxTime = 0
  for (const w of S.workouts) {
    if (w.rid === routineId) {
      const t = w.start || (w.d ? new Date(w.d + 'T12:00:00').getTime() : 0)
      if (t > maxTime) {
        maxTime = t
      }
    }
  }
  return maxTime
}

export function nextRoutine(S) {
  const routines = S?.routines || []
  if (!routines.length) return null

  let chosen = routines[0]
  let oldestTime = Infinity

  for (const r of routines) {
    const t = lastDoneTimestamp(S, r.id)
    if (t < oldestTime) {
      oldestTime = t
      chosen = r
    }
  }

  return chosen
}

export function seedRotationFromWeek(S) {
  const routines = S?.routines || []
  if (!routines.length) return []
  const week = S?.week || {}
  const seen = new Set()
  const ordered = []

  const dayOrder = [1, 2, 3, 4, 5, 6, 0]
  for (const d of dayOrder) {
    const rid = week[d]
    if (rid && !seen.has(rid)) {
      const r = routines.find(x => x.id === rid)
      if (r) {
        seen.add(rid)
        ordered.push(r)
      }
    }
  }
  for (const r of routines) {
    if (!seen.has(r.id)) {
      seen.add(r.id)
      ordered.push(r)
    }
  }
  return ordered
}

export function daysSinceDone(S, routineId, today = todayISO()) {
  const d = lastDoneAt(S, routineId)
  if (!d) return null
  const todayMs = new Date(today + 'T12:00:00').getTime()
  const doneMs = new Date(d + 'T12:00:00').getTime()
  const diffDays = Math.round((todayMs - doneMs) / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

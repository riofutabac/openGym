import { hasData } from '../store/useStore.js'
import { starterRoutines } from './starter.js'
import { todayISO } from './format.js'

export function needsOnboarding(S) {
  if (!S) return false
  return !hasData(S) && (!S.bodyweight || S.bodyweight.length === 0)
}

export function computeTargetWeight(weight, goal) {
  const w = parseFloat(weight)
  if (!w || isNaN(w) || w <= 0) return null
  if (goal === 'lose') {
    return Math.round(w * 0.95 * 2) / 2
  }
  if (goal === 'gain') {
    return Math.round(w * 1.05 * 2) / 2
  }
  if (goal === 'maintain') {
    return w
  }
  return null
}

export function applyOnboarding(S, answers = {}) {
  const next = S ? { ...S } : {}
  if (answers.unit) {
    next.unit = answers.unit
  }
  const w = parseFloat(answers.weight)
  if (w && w > 0) {
    const iso = answers.iso || todayISO()
    const timestamp = answers.timestamp || Date.now()
    const bwList = [...(next.bodyweight || [])]
    const ex = bwList.find(b => b.d === iso)
    if (ex) {
      ex.w = w
      ex.t = timestamp
    } else {
      bwList.push({ d: iso, w, t: timestamp })
    }
    bwList.sort((a, b) => (a.d < b.d ? -1 : 1))
    next.bodyweight = bwList

    if (answers.goal) {
      next.targetW = computeTargetWeight(w, answers.goal)
    }
  }

  if (!next.routines || next.routines.length === 0) {
    next.routines = starterRoutines()
  }

  return next
}

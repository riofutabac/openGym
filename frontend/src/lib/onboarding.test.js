import { describe, it, expect } from 'vitest'
import { needsOnboarding, computeTargetWeight, applyOnboarding } from './onboarding.js'
import { DEF } from '../store/useStore.js'

describe('onboarding logic', () => {
  describe('needsOnboarding', () => {
    it('returns true for a fresh clean state with no data', () => {
      const cleanState = { ...DEF, bodyweight: [], routines: [], workouts: [] }
      expect(needsOnboarding(cleanState)).toBe(true)
    })

    it('returns false if there is existing bodyweight', () => {
      const stateWithBw = { ...DEF, bodyweight: [{ d: '2026-01-01', w: 75, t: 1 }] }
      expect(needsOnboarding(stateWithBw)).toBe(false)
    })

    it('returns false if there are existing workouts (reinstalled user with synced history)', () => {
      const stateWithWorkouts = { ...DEF, bodyweight: [], workouts: [{ d: '2026-01-01', entries: [] }] }
      expect(needsOnboarding(stateWithWorkouts)).toBe(false)
    })

    it('returns false if there are existing routines', () => {
      const stateWithRoutines = { ...DEF, bodyweight: [], routines: [{ id: 'r1', name: 'Full Body', ex: [] }] }
      expect(needsOnboarding(stateWithRoutines)).toBe(false)
    })
  })

  describe('computeTargetWeight', () => {
    it('calculates 5% weight loss rounded to 0.5', () => {
      // 80 * 0.95 = 76.0
      expect(computeTargetWeight(80, 'lose')).toBe(76)
      // 73 * 0.95 = 69.35 -> 69.5
      expect(computeTargetWeight(73, 'lose')).toBe(69.5)
      // 100 * 0.95 = 95.0
      expect(computeTargetWeight(100, 'lose')).toBe(95)
    })

    it('calculates 5% weight gain rounded to 0.5', () => {
      // 70 * 1.05 = 73.5
      expect(computeTargetWeight(70, 'gain')).toBe(73.5)
      // 62 * 1.05 = 65.1 -> 65.0
      expect(computeTargetWeight(62, 'gain')).toBe(65)
    })

    it('keeps same weight for maintain', () => {
      expect(computeTargetWeight(75.5, 'maintain')).toBe(75.5)
    })

    it('handles lbs unit values gracefully', () => {
      // 160 * 0.95 = 152
      expect(computeTargetWeight(160, 'lose')).toBe(152)
      // 150 * 1.05 = 157.5
      expect(computeTargetWeight(150, 'gain')).toBe(157.5)
    })
  })

  describe('applyOnboarding', () => {
    it('populates initial bodyweight, target weight, unit, and starter routines atomically', () => {
      const state = { ...DEF, bodyweight: [], routines: [], workouts: [] }
      const answers = {
        weight: 78,
        unit: 'kg',
        goal: 'lose',
        weeklyTarget: 3,
        iso: '2026-09-01',
        timestamp: 123456789,
      }
      const updated = applyOnboarding(state, answers)

      expect(updated.unit).toBe('kg')
      expect(updated.bodyweight).toHaveLength(1)
      expect(updated.bodyweight[0]).toEqual({ d: '2026-09-01', w: 78, t: 123456789 })
      expect(updated.targetW).toBe(74) // 78 * 0.95 = 74.1 -> 74.0
      expect(updated.routines).toHaveLength(4) // Upper/Lower 4-day starter routines
      expect(updated.routines[0].name).toBe('Upper A (Push)')
    })

    it('does not overwrite existing routines if present', () => {
      const existingRoutine = { id: 'custom-1', name: 'Upper', ex: [] }
      const state = { ...DEF, bodyweight: [], routines: [existingRoutine], workouts: [] }
      const updated = applyOnboarding(state, { weight: 80, goal: 'maintain' })

      expect(updated.routines).toHaveLength(1)
      expect(updated.routines[0].id).toBe('custom-1')
      expect(updated.targetW).toBe(80)
    })

    it('does not write bodyweight entry or fake target when weight is null, but seeds routines', () => {
      const state = { ...DEF, bodyweight: [], routines: [], workouts: [] }
      const updated = applyOnboarding(state, { weight: null, unit: 'kg', goal: 'maintain' })

      expect(updated.bodyweight).toEqual([])
      expect(updated.targetW).toBeNull()
      expect(updated.routines).toHaveLength(4)
    })
  })
})


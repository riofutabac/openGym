import { describe, it, expect } from 'vitest'
import { lastDoneAt, lastDoneTimestamp, nextRoutine, seedRotationFromWeek, daysSinceDone } from './rotation.js'

describe('rotation logic', () => {
  const rPush = { id: 'r-push', name: 'Push Day', ex: [] }
  const rPull = { id: 'r-pull', name: 'Pull Day', ex: [] }
  const rLegs = { id: 'r-legs', name: 'Leg Day', ex: [] }

  describe('nextRoutine', () => {
    it('returns null when there are no routines', () => {
      const S = { routines: [], workouts: [] }
      expect(nextRoutine(S)).toBeNull()
    })

    it('returns the first routine when there is no workout history', () => {
      const S = { routines: [rPush, rPull, rLegs], workouts: [] }
      expect(nextRoutine(S)).toEqual(rPush)
    })

    it('suggests the next routine in rotation based on oldest completed workout', () => {
      const S = {
        routines: [rPush, rPull, rLegs],
        workouts: [
          { rid: 'r-push', d: '2026-08-28', start: 1000 },
          { rid: 'r-pull', d: '2026-08-30', start: 2000 },
        ],
      }
      // Push was done at 1000, Pull at 2000, Legs never done (0) -> Legs is next
      expect(nextRoutine(S)).toEqual(rLegs)
    })

    it('rotates cyclically when all routines have been done', () => {
      const S = {
        routines: [rPush, rPull, rLegs],
        workouts: [
          { rid: 'r-push', d: '2026-08-28', start: 1000 },
          { rid: 'r-pull', d: '2026-08-30', start: 2000 },
          { rid: 'r-legs', d: '2026-09-01', start: 3000 },
        ],
      }
      // Push is oldest (1000) -> Push is next
      expect(nextRoutine(S)).toEqual(rPush)
    })

    it('breaks ties using routine order in S.routines', () => {
      const S = {
        routines: [rPush, rPull, rLegs],
        workouts: [
          { rid: 'r-legs', d: '2026-09-01', start: 3000 },
        ],
      }
      // Push and Pull both have timestamp 0. Push is first in S.routines -> Push is next
      expect(nextRoutine(S)).toEqual(rPush)
    })
  })

  describe('lastDoneAt and daysSinceDone', () => {
    it('returns null when routine was never done', () => {
      const S = { routines: [rPush], workouts: [] }
      expect(lastDoneAt(S, 'r-push')).toBeNull()
      expect(daysSinceDone(S, 'r-push', '2026-09-01')).toBeNull()
    })

    it('returns date and days difference for completed routines', () => {
      const S = {
        routines: [rPush],
        workouts: [
          { rid: 'r-push', d: '2026-08-29', start: 1000 },
          { rid: 'r-push', d: '2026-08-31', start: 2000 },
        ],
      }
      expect(lastDoneAt(S, 'r-push')).toBe('2026-08-31')
      expect(daysSinceDone(S, 'r-push', '2026-09-01')).toBe(1)
      expect(daysSinceDone(S, 'r-push', '2026-08-31')).toBe(0)
    })
  })

  describe('seedRotationFromWeek', () => {
    it('orders routines starting from Monday through Sunday', () => {
      const S = {
        routines: [rLegs, rPull, rPush],
        week: { 1: 'r-push', 3: 'r-pull', 5: 'r-legs' },
      }
      const ordered = seedRotationFromWeek(S)
      expect(ordered.map(r => r.id)).toEqual(['r-push', 'r-pull', 'r-legs'])
    })

    it('appends unassigned routines to the end', () => {
      const rCardio = { id: 'r-cardio', name: 'Cardio', ex: [] }
      const S = {
        routines: [rCardio, rLegs, rPull, rPush],
        week: { 1: 'r-push', 3: 'r-pull' },
      }
      const ordered = seedRotationFromWeek(S)
      expect(ordered.map(r => r.id)).toEqual(['r-push', 'r-pull', 'r-cardio', 'r-legs'])
    })
  })

  describe('week assignment and eviction', () => {
    it('assigns weekday to routine and allows unassigning', () => {
      const week = {}
      week[1] = 'r-push'
      expect(week[1]).toBe('r-push')
      delete week[1]
      expect(week[1]).toBeUndefined()
    })

    it('evicts previous routine when reassigning weekday', () => {
      const week = { 1: 'r-push' }
      const prevOwner = week[1]
      week[1] = 'r-pull'
      expect(prevOwner).toBe('r-push')
      expect(week[1]).toBe('r-pull')
    })
  })
})

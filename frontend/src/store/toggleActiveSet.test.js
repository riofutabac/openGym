import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './useStore.js'
import { useUI } from './useUI.js'
import { toggleActiveSet, beginWorkout } from '../sheets.jsx'

const mockStorage = new Map()
globalThis.localStorage = {
  getItem: key => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: key => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
}

describe('toggleActiveSet - Single source of truth for completing sets', () => {
  beforeEach(() => {
    useUI.getState().stopRest()
    useUI.getState().stopWork()
    useStore.setState({
      S: {
        unit: 'kg',
        sound: false,
        restSec: 90,
        routines: [
          {
            id: 'r1',
            name: 'Test Routine',
            ex: [
              { id: 'chest-press', sets: 2, reps: 10, weight: 50, restSec: 60 },
              { id: 'lat-pulldown', sets: 2, reps: 10, weight: 60, restSec: 90 }
            ]
          }
        ],
        workouts: [],
        exWeights: {},
        dayPlan: {},
        week: {},
        active: null
      }
    })
  })

  it('toggles set done, updates exWeights when max weight is logged, and starts between-set rest', () => {
    beginWorkout('r1')
    const active = useStore.getState().S.active
    expect(active).not.toBeNull()
    expect(active.entries[0].sets[0].done).toBe(false)

    // Complete set 0 of exercise 0
    toggleActiveSet(0, 0)

    const st = useStore.getState().S
    expect(st.active.entries[0].sets[0].done).toBe(true)
    expect(st.exWeights['chest-press']).toEqual({ w: 50, d: expect.any(String) })

    // Between-set rest was started with chest-press's restSec (60s)
    const timer = useUI.getState().timer
    expect(timer).not.toBeNull()
    expect(timer.total).toBe(60)
    expect(timer.betweenExercises).toBe(false)
  })

  it('completing last set of an exercise advances active.cur to next exercise and starts between-exercise rest', () => {
    beginWorkout('r1')
    toggleActiveSet(0, 0)
    // Complete set 1 (last set of chest-press)
    toggleActiveSet(0, 1)

    const st = useStore.getState().S
    expect(st.active.cur).toBe(1) // advanced to lat-pulldown

    // Between-exercise rest uses upcoming exercise's restSec (90s)
    const timer = useUI.getState().timer
    expect(timer).not.toBeNull()
    expect(timer.total).toBe(90)
    expect(timer.betweenExercises).toBe(true)
  })

  it('completing final set of entire workout finishes workout and clears active state', () => {
    beginWorkout('r1')
    toggleActiveSet(0, 0)
    toggleActiveSet(0, 1)
    toggleActiveSet(1, 0)
    // Complete last set of last exercise
    toggleActiveSet(1, 1)

    const st = useStore.getState().S
    expect(st.active).toBeNull() // workout is finished and cleared!
    expect(st.workouts.length).toBe(1)
    expect(st.workouts[0].name).toBe('Test Routine')
  })
})

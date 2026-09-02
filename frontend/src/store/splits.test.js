import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore, migrateSplits, DEF } from './useStore.js'
import { activeSplit, activeWeek, seedRotationFromWeek } from '../lib/rotation.js'
import { effectiveRoutineId } from '../lib/history.js'
import { buildPlanBundle, parsePlan, mergePlan } from '../lib/plan-share.js'
import { instantiateTemplate } from '../lib/starter.js'

const mockStorage = new Map()
globalThis.localStorage = {
  getItem: key => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: key => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
}

describe('Split Container Model & Reusable Routines', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
    useStore.setState({
      S: JSON.parse(JSON.stringify(DEF)),
      user: null,
      ready: false,
    })
  })

  describe('Legacy State Migration', () => {
    it('automatically migrates legacy week mapping into a default split', () => {
      const legacy = {
        routines: [{ id: 'r1', name: 'Upper', ex: [] }, { id: 'r2', name: 'Lower', ex: [] }],
        week: { 1: 'r1', 4: 'r2' },
        splits: [],
        activeSplitId: null,
      }

      migrateSplits(legacy)

      expect(legacy.splits).toHaveLength(1)
      expect(legacy.splits[0].name).toBe('Mi Split')
      expect(legacy.splits[0].week).toEqual({ 1: 'r1', 4: 'r2' })
      expect(legacy.activeSplitId).toBe(legacy.splits[0].id)
    })

    it('sets activeSplitId to first split if current activeSplitId is missing/invalid', () => {
      const st = {
        routines: [{ id: 'r1', name: 'Full Body', ex: [] }],
        splits: [
          { id: 'sp1', name: '3-Day Split', week: { 1: 'r1', 3: 'r1', 5: 'r1' } },
        ],
        activeSplitId: 'invalid_id',
      }

      migrateSplits(st)

      expect(st.activeSplitId).toBe('sp1')
      expect(st.week).toEqual({ 1: 'r1', 3: 'r1', 5: 'r1' })
    })

    it('does NOT resurrect a default split just because routines still exist — only a genuine legacy week does', () => {
      // Simulates the state right after deleteSplit() removes the user's only split:
      // splits/week are empty, but routines are untouched. migrateSplits runs on every
      // update(), so this must stay empty rather than recreating "Mi Split".
      const afterDeletingLastSplit = {
        routines: [{ id: 'r1', name: 'Upper', ex: [] }],
        splits: [],
        activeSplitId: null,
        week: {},
      }

      migrateSplits(afterDeletingLastSplit)

      expect(afterDeletingLastSplit.splits).toHaveLength(0)
      expect(afterDeletingLastSplit.activeSplitId).toBeNull()
    })
  })

  describe('Split Management Actions', () => {
    it('creates a new split, sets it as active, and syncs week', () => {
      const store = useStore.getState()
      const newSplit = store.createSplit({
        name: 'Upper / Lower 4D',
        emoji: '🏋️',
        week: { 1: 'r_upper', 2: 'r_lower', 4: 'r_upper', 5: 'r_lower' }
      })

      const S = useStore.getState().S
      expect(S.splits).toHaveLength(1)
      expect(S.activeSplitId).toBe(newSplit.id)
      expect(S.splits[0].name).toBe('Upper / Lower 4D')
      expect(S.week).toEqual({ 1: 'r_upper', 2: 'r_lower', 4: 'r_upper', 5: 'r_lower' })
    })

    it('switches active split and updates effective activeWeek', () => {
      const store = useStore.getState()
      const splitA = store.createSplit({ name: 'Split A', week: { 1: 'rA' } })
      const splitB = store.createSplit({ name: 'Split B', week: { 2: 'rB' } })

      expect(useStore.getState().S.activeSplitId).toBe(splitB.id)

      store.setActiveSplit(splitA.id)
      const S = useStore.getState().S
      expect(S.activeSplitId).toBe(splitA.id)
      expect(activeSplit(S).id).toBe(splitA.id)
      expect(activeWeek(S)).toEqual({ 1: 'rA' })
    })

    it('deletes a split and cleans up its exclusive routines from routines library', () => {
      const store = useStore.getState()
      store.update(s => {
        s.routines = [
          { id: 'r1', name: 'R1', ex: [] },
          { id: 'r2', name: 'R2', ex: [] },
          { id: 'r_shared', name: 'R Shared', ex: [] }
        ]
      })
      const sp1 = store.createSplit({ name: 'Split 1', week: { 1: 'r1', 3: 'r_shared' } })
      const sp2 = store.createSplit({ name: 'Split 2', week: { 2: 'r2', 4: 'r_shared' } })

      store.deleteSplit(sp2.id)

      const S = useStore.getState().S
      expect(S.splits).toHaveLength(1)
      expect(S.activeSplitId).toBe(sp1.id)
      expect(activeWeek(S)).toEqual({ 1: 'r1', 3: 'r_shared' })
      // r2 was exclusively in sp2 and should be removed, while r1 and r_shared remain
      expect(S.routines.map(r => r.id)).toEqual(['r1', 'r_shared'])
    })
  })

  describe('Effective Routine Resolution with Active Split', () => {
    it('resolves routine from active split week and returns null for unassigned rest days', () => {
      const rUpper = { id: 'r_upper', name: 'Upper', ex: [] }
      const rLower = { id: 'r_lower', name: 'Lower', ex: [] }

      const S = {
        routines: [rUpper, rLower],
        splits: [
          { id: 'sp1', name: 'UL', week: { 1: 'r_upper', 2: 'r_lower' } },
        ],
        activeSplitId: 'sp1',
        dayPlan: {},
        workouts: [],
      }

      // Monday (day 1) -> 2026-09-07 is a Monday
      const mondayIso = '2026-09-07'
      expect(effectiveRoutineId(S, mondayIso)).toBe('r_upper')

      // Tuesday (day 2) -> 2026-09-08 is a Tuesday
      const tuesdayIso = '2026-09-08'
      expect(effectiveRoutineId(S, tuesdayIso)).toBe('r_lower')

      // Wednesday (day 3) -> 2026-09-09 is Wednesday (Rest day in this split)
      const wednesdayIso = '2026-09-09'
      expect(effectiveRoutineId(S, wednesdayIso)).toBeNull()
    })
  })

  describe('Plan Sharing & Export/Import — one split at a time', () => {
    it('exports a single split in the bundle and re-imports it as one new split with remapped routine IDs', () => {
      const r1 = { id: 'orig_r1', name: 'Torso', emoji: '💪', ex: [] }
      const r2 = { id: 'orig_r2', name: 'Pierna', emoji: '🦵', ex: [] }
      // A routine NOT in the shared split — must not leak into the export.
      const r3 = { id: 'orig_r3', name: 'Other split only', emoji: '🏃', ex: [] }

      const S = {
        routines: [r1, r2, r3],
        splits: [
          {
            id: 'orig_sp1',
            name: 'Upper/Lower Split',
            emoji: '🔥',
            week: { 1: 'orig_r1', 2: 'orig_r2' }
          },
          {
            id: 'orig_sp2',
            name: 'Other split',
            emoji: '🏃',
            week: { 3: 'orig_r3' }
          }
        ],
        activeSplitId: 'orig_sp1',
        customEx: [],
      }

      const bundle = buildPlanBundle(S, 'orig_sp1', 'My Upper/Lower')
      expect(bundle.name).toBe('My Upper/Lower')
      expect(bundle.routines.map(r => r.name)).toEqual(['Torso', 'Pierna'])
      expect(bundle.splits).toBeUndefined()

      const parsed = parsePlan(bundle)
      expect(parsed.routineCount).toBe(2)

      const targetDraft = {
        routines: [],
        splits: [],
        customEx: [],
        week: {},
      }

      mergePlan(targetDraft, parsed, { schedule: true })

      expect(targetDraft.routines).toHaveLength(2)
      expect(targetDraft.splits).toHaveLength(1)
      expect(targetDraft.activeSplitId).toBe(targetDraft.splits[0].id)

      // Ensure week references remapped IDs, not original IDs
      const newR1Id = targetDraft.routines[0].id
      const newR2Id = targetDraft.routines[1].id
      expect(newR1Id).not.toBe('orig_r1')
      expect(targetDraft.splits[0].week).toEqual({ 1: newR1Id, 2: newR2Id })
    })

    it('preserves custom restSec on exercises across buildPlanBundle, parsePlan, and mergePlan', () => {
      const r1 = {
        id: 'r_bench',
        name: 'Bench Day',
        emoji: '🏋️',
        ex: [
          { id: '0577', sets: 3, reps: 8, weight: 80, restSec: 120 }, // custom 120s rest
          { id: '0178', sets: 3, reps: 12, weight: 10, restSec: 45 },  // custom 45s rest
          { id: '0194', sets: 3, reps: 10, weight: 25 },                // default (no restSec override)
        ]
      }

      const S = {
        routines: [r1],
        splits: [{ id: 'sp1', name: 'Upper', emoji: '💪', week: { 1: 'r_bench' } }],
        activeSplitId: 'sp1',
        customEx: [],
      }

      const bundle = buildPlanBundle(S, 'sp1', 'Custom Rest Plan')
      expect(bundle.routines[0].ex[0].restSec).toBe(120)
      expect(bundle.routines[0].ex[1].restSec).toBe(45)
      expect(bundle.routines[0].ex[2].restSec).toBeUndefined()

      const parsed = parsePlan(bundle)
      const targetDraft = { routines: [], splits: [], customEx: [], week: {} }
      mergePlan(targetDraft, parsed)

      expect(targetDraft.routines[0].ex[0].restSec).toBe(120)
      expect(targetDraft.routines[0].ex[1].restSec).toBe(45)
      expect(targetDraft.routines[0].ex[2].restSec).toBeUndefined()
    })
  })

  describe('Multi-Split Isolation', () => {
    it('modifying routine days on a specific split does not touch other splits or global active week', () => {
      const store = useStore.getState()
      const spActive = store.createSplit({ name: 'Active Split', week: { 1: 'r1', 3: 'r2' } })
      const spSecondary = store.createSplit({ name: 'Secondary Split', week: { 2: 'r1', 4: 'r2' } })

      store.setActiveSplit(spActive.id)
      expect(useStore.getState().S.activeSplitId).toBe(spActive.id)
      expect(useStore.getState().S.week).toEqual({ 1: 'r1', 3: 'r2' })

      // Simulate editing routine 'r1' within spSecondary (e.g. toggling Friday day 5)
      store.update(s => {
        const target = s.splits.find(sp => sp.id === spSecondary.id)
        target.week[5] = 'r1'
        if (s.activeSplitId === spSecondary.id) s.week = { ...target.week }
      })

      const S = useStore.getState().S
      // Secondary split has day 5
      expect(S.splits.find(sp => sp.id === spSecondary.id).week).toEqual({ 2: 'r1', 4: 'r2', 5: 'r1' })
      // Active split unchanged
      expect(S.splits.find(sp => sp.id === spActive.id).week).toEqual({ 1: 'r1', 3: 'r2' })
      // Active week unchanged
      expect(S.week).toEqual({ 1: 'r1', 3: 'r2' })
    })

    it('sequentially loading multiple template programs preserves both splits and updates activeWeek', () => {
      const { routines: rUpperLower, split: splitUL } = instantiateTemplate('upper-lower')
      const { routines: rPPL, split: splitPPL } = instantiateTemplate('ppl-6d')

      const store = useStore.getState()
      // Load first template (Upper/Lower)
      store.update(st => {
        st.splits = [splitUL]
        st.routines = [...rUpperLower]
        st.activeSplitId = splitUL.id
        st.week = { ...splitUL.week }
      })

      expect(useStore.getState().S.splits).toHaveLength(1)
      expect(activeSplit(useStore.getState().S).name).toBe(splitUL.name)
      expect(activeWeek(useStore.getState().S)).toEqual(splitUL.week)

      // Load second template (PPL 6D) as a new split
      store.update(st => {
        st.routines.push(...rPPL)
        st.splits.unshift(splitPPL)
        st.activeSplitId = splitPPL.id
        st.week = { ...splitPPL.week }
      })

      const S2 = useStore.getState().S
      expect(S2.splits).toHaveLength(2)
      expect(S2.activeSplitId).toBe(splitPPL.id)
      expect(activeSplit(S2).name).toBe(splitPPL.name)
      expect(activeWeek(S2)).toEqual(splitPPL.week)

      // Switching back to Upper/Lower activates it cleanly
      store.setActiveSplit(splitUL.id)
      const S3 = useStore.getState().S
      expect(S3.activeSplitId).toBe(splitUL.id)
      expect(activeSplit(S3).name).toBe(splitUL.name)
      expect(activeWeek(S3)).toEqual(splitUL.week)
    })
  })
})

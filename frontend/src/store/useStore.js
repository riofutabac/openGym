import { create } from 'zustand'
import { auth, state as stateRepo } from '../lib/backend/index.js'
import { localTZ } from '../lib/format.js'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED } from '../lib/demo.js'
import { MOBILE, syncReminder } from '../lib/mobile.js'

const KEY = 'gym_state_v1'
export const DEF = {
  unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'en',
  theme: 'dark', accent: 'lime', body: 'male', targetW: null,
  bodyweight: [], routines: [], week: {}, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
  reminder: { on: false, time: '08:00', tz: null }, effort: null
}
const clone = o => JSON.parse(JSON.stringify(o))

function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return Object.assign(clone(DEF), JSON.parse(raw))
  } catch (e) { /* ignore */ }
  return clone(DEF)
}

const hasData = st => !!((st.workouts || []).length || (st.routines || []).length || (st.bodyweight || []).length)

export const useStore = create((set, get) => {
  let pushTm = null
  let saveTm = null
  const syncedWorkoutIds = new Set()

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = () => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => { saveTm = null; stateRepo.save(get().S); syncReminder(get().S) }, 800)
  }

  const persist = (S, push = true) => {
    S._ts = S._ts || Date.now()
    registerCustom(S.customEx)
    localStorage.setItem(KEY, JSON.stringify(S))
    set({ S })
    if (MOBILE) nativePersist()
    if (push && get().user) {
      clearTimeout(pushTm)
      pushTm = setTimeout(() => get().pushState(), 1500)
    }
  }

  // A setting changed right before switching away/closing the tab must not get lost mid-debounce
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return
      if (MOBILE && saveTm) {
        clearTimeout(saveTm)
        saveTm = null
        stateRepo.save(get().S)
      }
      if (pushTm) {
        clearTimeout(pushTm)
        pushTm = null
        get().pushState()
      }
    })
  }

  // Everything a sign-out leaves behind on this device, whichever way it was triggered.
  const clearLocalSession = () => {
    syncedWorkoutIds.clear()
    get().setUser(null)
    localStorage.removeItem('gym_guest')
    localStorage.removeItem('gym_dirty')
    localStorage.removeItem(KEY)
    persist(clone(DEF), false)
  }

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    user: (() => { try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null } })(),
    ready: false,

    // Mutate a draft of S via producer fn, then persist + schedule sync.
    update(mut, push = true) {
      const S = clone(get().S)
      S._ts = Date.now()
      mut(S)
      persist(S, push)
    },
    replaceState(S, push = false) {
      S._ts = S._ts || Date.now()
      persist(clone(S), push)
    },

    isGuest: () => localStorage.getItem('gym_guest') === '1',
    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },

    setUser(u) {
      if (u) { localStorage.setItem('gym_user', JSON.stringify(u)); localStorage.removeItem('gym_guest') }
      else localStorage.removeItem('gym_user')
      set({ user: u })
    },

    async pushState() {
      clearTimeout(pushTm)
      const user = get().user
      const S = get().S
      if (!user) return

      try {
        if (stateRepo.supportsPerSessionRows) {
          // active is device-local and must never leak into settings/remote profile
          const { routines, week, dayPlan, exWeights, customEx, bodyweight, workouts, active, _ts, ...settings } = S
          const profile = {
            ts: _ts || Date.now(),
            settings,
            routines: routines || [],
            week: week || {},
            dayPlan: dayPlan || {},
            exWeights: exWeights || {},
            customEx: customEx || [],
            bodyweight: bodyweight || [],
          }
          await stateRepo.saveProfile(user.id, profile)

          // Only upload new / unsynced workouts instead of rewriting entire history
          if (Array.isArray(workouts)) {
            for (const w of workouts) {
              if (w?.id && !syncedWorkoutIds.has(String(w.id))) {
                await stateRepo.saveWorkout(user.id, w)
                syncedWorkoutIds.add(String(w.id))
              }
            }
          }
        } else {
          await stateRepo.save(S)
        }
        localStorage.removeItem('gym_dirty')
      } catch (e) {
        localStorage.setItem('gym_dirty', '1')
      }
    },

    async pullState() {
      const user = get().user
      const S = get().S

      try {
        if (stateRepo.supportsPerSessionRows && user?.id) {
          const [remoteProf, remoteWorkouts] = await Promise.all([
            stateRepo.loadProfile(user.id),
            stateRepo.listWorkouts(user.id),
          ])

          const dirty = localStorage.getItem('gym_dirty') === '1'
          const next = clone(S)

          // 1. Profile: timestamp check governs profile fields only
          if (remoteProf && (!hasData(S) || ((remoteProf.ts || 0) >= (S._ts || 0) && !dirty))) {
            next._ts = remoteProf.ts
            Object.assign(next, remoteProf.settings || {})
            next.routines = remoteProf.routines || []
            next.week = remoteProf.week || {}
            next.dayPlan = remoteProf.dayPlan || {}
            next.exWeights = remoteProf.exWeights || {}
            next.customEx = remoteProf.customEx || []
            next.bodyweight = remoteProf.bodyweight || []
          } else if (hasData(S)) {
            // Local profile is newer/dirty: push local profile to remote
            const { routines, week, dayPlan, exWeights, customEx, bodyweight, workouts, active, _ts, ...settings } = S
            await stateRepo.saveProfile(user.id, {
              ts: _ts || Date.now(),
              settings,
              routines: routines || [],
              week: week || {},
              dayPlan: dayPlan || {},
              exWeights: exWeights || {},
              customEx: customEx || [],
              bodyweight: bodyweight || [],
            })
          }

          // 2. Workouts: merge union by ID (completed sessions are immutable)
          const localWorkouts = S.workouts || []
          const localMap = new Map(localWorkouts.map(w => [String(w.id), w]))
          const remoteMap = new Map((remoteWorkouts || []).map(w => [String(w.id), w]))

          // Incoming remote workouts not present locally
          for (const rw of remoteWorkouts || []) {
            syncedWorkoutIds.add(String(rw.id))
            if (!localMap.has(String(rw.id))) {
              localMap.set(String(rw.id), rw)
            }
          }

          // Upload any local workouts not yet saved in remote
          for (const lw of localWorkouts) {
            if (lw?.id && !remoteMap.has(String(lw.id))) {
              await stateRepo.saveWorkout(user.id, lw).catch(() => {})
              syncedWorkoutIds.add(String(lw.id))
            } else if (lw?.id) {
              syncedWorkoutIds.add(String(lw.id))
            }
          }

          const mergedWorkouts = Array.from(localMap.values())
          mergedWorkouts.sort((a, b) => {
            if (a.d !== b.d) return (a.d || '') > (b.d || '') ? 1 : -1
            return (a.start || 0) - (b.start || 0)
          })

          next.workouts = mergedWorkouts
          // Ensure active is never overwritten by remote state
          next.active = S.active || null

          persist(next, false)
          localStorage.removeItem('gym_dirty')
        } else {
          // Facade fallback for local adapter / demo
          const state = await stateRepo.load()
          const dirty = localStorage.getItem('gym_dirty') === '1'
          if (state && (!hasData(S) || ((state._ts || 0) >= (S._ts || 0) && !dirty))) {
            const active = S.active
            const next = Object.assign(clone(DEF), state)
            if (active) next.active = active
            persist(next, false)
          } else if (hasData(S) && user) {
            await get().pushState()
          }
        }
      } catch (e) {
        // Offline — keep local state intact
      }
    },

    async signOut() {
      try { await get().pushState(); await auth.logout() } catch (e) { /* */ }
      clearLocalSession()
    },

    async signOutAll() {
      await get().pushState()
      await auth.logoutEverywhere()
      clearLocalSession()
    },

    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      localStorage.removeItem('gym_dirty')
      persist(Object.assign(clone(DEF), buildDemoState()), false)
    },

    async boot() {
      if (DEMO && !localStorage.getItem(DEMO_SEEDED)) {
        localStorage.setItem(DEMO_SEEDED, '1')
        await get().resetDemo()
      }

      try {
        const me = await auth.currentUser()
        if (me && !me.guest) {
          get().setUser(me)
        } else if (me?.guest) {
          get().setGuest(true)
        } else {
          get().setUser(null)
        }

        await get().pullState()

        if (MOBILE) {
          syncReminder(get().S)
        }

        const tz = localTZ()
        if (get().S.reminder?.on && get().S.reminder.tz !== tz) {
          get().update(s => { s.reminder = { ...s.reminder, tz } })
        }
      } catch (e) {
        if (e.status === 401) get().setUser(null)
      }
      set({ ready: true })
    }
  }
})

export { hasData }

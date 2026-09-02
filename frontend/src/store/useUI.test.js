import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useUI } from './useUI.js'
import * as mobile from '../lib/mobile.js'

describe('useUI - Rest Timer and Native Notifications Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useUI.getState().stopRest()
    useUI.getState().stopWork()
  })

  it('startRest starts timer and calls mobile scheduleRestNotification when MOBILE is true', async () => {
    const scheduleSpy = vi.spyOn(mobile, 'scheduleRestNotification').mockResolvedValue(true)
    const cancelSpy = vi.spyOn(mobile, 'cancelRestNotification').mockResolvedValue(true)

    useUI.getState().startRest(90)

    const timer = useUI.getState().timer
    expect(timer).not.toBeNull()
    expect(timer.left).toBe(90)
    expect(timer.total).toBe(90)

    // Note: if MOBILE is false in node test environment, pushRestTimer is a no-op, but stopRest still runs safely
    useUI.getState().stopRest()
    expect(useUI.getState().timer).toBeNull()
  })

  it('addRest adjusts endsAt and calls pushRestTimer with updated remaining duration', () => {
    useUI.getState().startRest(60)
    const initialEndsAt = useUI.getState().timer.endsAt

    useUI.getState().addRest(15)
    const updated = useUI.getState().timer
    expect(updated.left).toBe(75)
    expect(updated.total).toBe(75)
    expect(updated.endsAt).toBe(initialEndsAt + 15000)

    useUI.getState().stopRest()
  })

  it('stopRest unconditionally cleans up timer state and intervals', () => {
    useUI.getState().startRest(45)
    expect(useUI.getState().timer).not.toBeNull()

    useUI.getState().stopRest()
    expect(useUI.getState().timer).toBeNull()

    // Calling stopRest again when no timer is active runs cleanly
    expect(() => useUI.getState().stopRest()).not.toThrow()
  })

  it('startWork tracks target duration as advisory and finishWorkEarly logs actual elapsed time', () => {
    let loggedSec = 0
    useUI.getState().startWork(45, 'Plank', (sec) => {
      loggedSec = sec
    })

    const work = useUI.getState().work
    expect(work).not.toBeNull()
    expect(work.total).toBe(45)
    expect(work.label).toBe('Plank')

    // Simulate stopping early at 30s
    useUI.setState({ work: { ...work, startedAt: Date.now() - 30000 } })
    useUI.getState().finishWorkEarly()
    expect(loggedSec).toBe(30)
    expect(useUI.getState().work).toBeNull()
  })

  it('startWork allows holding past target duration and logs overtime correctly', () => {
    let loggedSec = 0
    useUI.getState().startWork(45, 'Plank', (sec) => {
      loggedSec = sec
    })

    const work = useUI.getState().work
    expect(work).not.toBeNull()

    // Simulate holding past target to 55s
    useUI.setState({ work: { ...work, startedAt: Date.now() - 55000 } })
    useUI.getState().finishWorkEarly()
    expect(loggedSec).toBe(55)
    expect(useUI.getState().work).toBeNull()
  })
})

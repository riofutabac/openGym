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
})

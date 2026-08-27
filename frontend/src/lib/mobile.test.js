import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  scheduleRestNotification,
  cancelRestNotification,
  syncReminder,
  REST_NOTIFICATION_ID,
} from './mobile.js'

describe('mobile.js - Native Local Notifications & Rest Alarm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('cancels any existing rest alarm and schedules a new one with allowWhileIdle', async () => {
    const cancelMock = vi.fn().mockResolvedValue(undefined)
    const scheduleMock = vi.fn().mockResolvedValue(undefined)
    const checkPermsMock = vi.fn().mockResolvedValue({ display: 'granted' })

    const mockPlugin = {
      cancel: cancelMock,
      schedule: scheduleMock,
      checkPermissions: checkPermsMock,
      requestPermissions: vi.fn(),
    }

    const before = Date.now()
    const res = await scheduleRestNotification(90, { plugin: mockPlugin })
    const after = Date.now()

    expect(res).toBe(true)
    // Cancels existing rest alarm before scheduling
    expect(cancelMock).toHaveBeenCalledWith({ notifications: [{ id: REST_NOTIFICATION_ID }] })
    expect(scheduleMock).toHaveBeenCalledTimes(1)

    const schedCall = scheduleMock.mock.calls[0][0]
    expect(schedCall.notifications).toHaveLength(1)
    const notif = schedCall.notifications[0]
    expect(notif.id).toBe(REST_NOTIFICATION_ID)
    expect(notif.schedule.allowWhileIdle).toBe(true)

    // Schedule timestamp is approx now + 90s
    const targetMs = notif.schedule.at.getTime()
    expect(targetMs).toBeGreaterThanOrEqual(before + 89000)
    expect(targetMs).toBeLessThanOrEqual(after + 91000)
  })

  it('returns false without popping permission dialog if display permission is not granted', async () => {
    const requestPermMock = vi.fn()
    const mockPlugin = {
      cancel: vi.fn().mockResolvedValue(undefined),
      schedule: vi.fn(),
      checkPermissions: vi.fn().mockResolvedValue({ display: 'denied' }),
      requestPermissions: requestPermMock,
    }

    const res = await scheduleRestNotification(60, { plugin: mockPlugin })
    expect(res).toBe(false)
    expect(requestPermMock).not.toHaveBeenCalled()
    expect(mockPlugin.schedule).not.toHaveBeenCalled()
  })

  it('cancelRestNotification unconditionally cancels the rest notification ID', async () => {
    const cancelMock = vi.fn().mockResolvedValue(undefined)
    const mockPlugin = {
      cancel: cancelMock,
    }

    const res = await cancelRestNotification({ plugin: mockPlugin })
    expect(res).toBe(true)
    expect(cancelMock).toHaveBeenCalledWith({ notifications: [{ id: REST_NOTIFICATION_ID }] })
  })

  it('syncReminder schedules weekly plan without overlapping rest alarm ID', async () => {
    const scheduleMock = vi.fn().mockResolvedValue(undefined)
    const cancelMock = vi.fn().mockResolvedValue(undefined)
    const mockPlugin = {
      cancel: cancelMock,
      schedule: scheduleMock,
      checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
      requestPermissions: vi.fn(),
    }

    const S = {
      reminder: { on: true, time: '09:30' },
      week: { 1: 'r1' }, // Monday
      routines: [{ id: 'r1', name: 'Leg Day' }],
    }

    const res = await syncReminder(S, false, { plugin: mockPlugin })
    expect(res).toBe(true)
    expect(scheduleMock).toHaveBeenCalledTimes(1)

    const schedCall = scheduleMock.mock.calls[0][0]
    expect(schedCall.notifications[0].id).toBe(101) // 100 + 1 (Monday)
    expect(schedCall.notifications[0].id).not.toBe(REST_NOTIFICATION_ID)
  })
})

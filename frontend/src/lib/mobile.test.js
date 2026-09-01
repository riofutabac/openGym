import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  scheduleRestNotification,
  cancelRestNotification,
  updateOngoingWorkoutNotification,
  clearOngoingWorkoutNotification,
  onNotificationAction,
  syncReminder,
  checkExactNotificationSetting,
  openExactAlarmSettings,
  REST_NOTIFICATION_ID,
  REST_CHANNEL_ID,
  WORKOUT_CHANNEL_ID,
  REST_ACTION_TYPE,
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

  it('updates ongoing workout notification with ongoing: true in status bar', async () => {
    const scheduleMock = vi.fn().mockResolvedValue(undefined)
    const mockPlugin = {
      schedule: scheduleMock,
      checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
      createChannel: vi.fn().mockResolvedValue(undefined),
    }

    const res = await updateOngoingWorkoutNotification({ name: 'Legs & Abs', restLeft: 45 }, { plugin: mockPlugin })
    expect(res).toBe(true)
    expect(scheduleMock).toHaveBeenCalledTimes(1)
    const notif = scheduleMock.mock.calls[0][0].notifications[0]
    expect(notif.id).toBe(199)
    expect(notif.ongoing).toBe(true)
  })

  it('clears ongoing workout notification on cancel', async () => {
    const cancelMock = vi.fn().mockResolvedValue(undefined)
    const mockPlugin = { cancel: cancelMock }

    const res = await clearOngoingWorkoutNotification({ plugin: mockPlugin })
    expect(res).toBe(true)
    expect(cancelMock).toHaveBeenCalledWith({ notifications: [{ id: 199 }] })
  })
})

describe('mobile.js — ongoing workout card', () => {
  const mkPlugin = (display = 'granted') => ({
    schedule: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    createChannel: vi.fn().mockResolvedValue(undefined),
    registerActionTypes: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    checkPermissions: vi.fn().mockResolvedValue({ display }),
    requestPermissions: vi.fn(),
  })

  it('posts the card on the silent channel, never on the alarm channel', async () => {
    const plugin = mkPlugin()
    await updateOngoingWorkoutNotification({ name: 'Push day' }, { plugin })

    const notif = plugin.schedule.mock.calls[0][0].notifications[0]
    expect(notif.channelId).toBe(WORKOUT_CHANNEL_ID)
    expect(notif.channelId).not.toBe(REST_CHANNEL_ID)
    expect(notif.ongoing).toBe(true)
    expect(notif.autoCancel).toBe(false)
  })

  it('declares the workout channel as low importance with no vibration', async () => {
    const plugin = mkPlugin()
    await updateOngoingWorkoutNotification({ name: 'Push day' }, { plugin })

    const workoutChannel = plugin.createChannel.mock.calls
      .map(c => c[0])
      .find(c => c.id === WORKOUT_CHANNEL_ID)
    expect(workoutChannel.importance).toBe(2)
    expect(workoutChannel.vibration).toBe(false)
  })

  it('shows the end time and never a countdown that would freeze', async () => {
    const plugin = mkPlugin()
    const restEndsAt = Date.now() + 90 * 1000
    await updateOngoingWorkoutNotification({ name: 'Push day', restEndsAt }, { plugin })

    const notif = plugin.schedule.mock.calls[0][0].notifications[0]
    expect(notif.title).not.toMatch(/\b90s?\b/)
    expect(notif.title).toContain(
      new Date(restEndsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    )
  })

  it('falls back to the plain workout title once rest is over', async () => {
    const plugin = mkPlugin()
    await updateOngoingWorkoutNotification({ name: 'Push day', restEndsAt: Date.now() - 1000 }, { plugin })

    const notif = plugin.schedule.mock.calls[0][0].notifications[0]
    expect(notif.title).toBe('Push day')
  })

  it('posts nothing when notifications are not granted', async () => {
    const plugin = mkPlugin('denied')
    const res = await updateOngoingWorkoutNotification({ name: 'Push day' }, { plugin })
    expect(res).toBe(false)
    expect(plugin.schedule).not.toHaveBeenCalled()
  })
})

describe('mobile.js — rest alarm actions', () => {
  it('attaches the lock-screen action buttons to the rest alarm', async () => {
    const plugin = {
      schedule: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      createChannel: vi.fn().mockResolvedValue(undefined),
      registerActionTypes: vi.fn().mockResolvedValue(undefined),
      checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    }
    await scheduleRestNotification(90, { plugin })

    const notif = plugin.schedule.mock.calls[0][0].notifications[0]
    expect(notif.actionTypeId).toBe(REST_ACTION_TYPE)
    expect(notif.channelId).toBe(REST_CHANNEL_ID)

    const actions = plugin.registerActionTypes.mock.calls[0][0].types[0].actions
    expect(actions.map(a => a.id)).toEqual(['rest-add', 'rest-skip'])
  })

  it('returns a plain unsubscribe function, never the plugin proxy', () => {
    const plugin = { addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) }
    const unsub = onNotificationAction(() => {}, { plugin })

    expect(typeof unsub).toBe('function')
    // The proxy trap: anything with .then gets awaited by JS and blows up on Android.
    expect(unsub.then).toBeUndefined()
  })

  it('never subscribes at all when unsubscribed before the plugin resolves', async () => {
    const plugin = { addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) }
    const unsub = onNotificationAction(() => {}, { plugin })
    unsub()
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()

    expect(plugin.addListener).not.toHaveBeenCalled()
  })

  it('removes the handle when unsubscribed while addListener is still in flight', async () => {
    const remove = vi.fn()
    let settle = null
    const plugin = {
      addListener: vi.fn(() => new Promise((res) => { settle = () => res({ remove }) })),
    }
    const unsub = onNotificationAction(() => {}, { plugin })
    await Promise.resolve()          // let addListener actually be called
    expect(plugin.addListener).toHaveBeenCalled()

    unsub()                          // user signs out mid-flight
    settle()
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()

    expect(remove).toHaveBeenCalled()
  })

  it('routes an action event to the handler without the raw plugin payload', async () => {
    let fire = null
    const plugin = {
      addListener: vi.fn((_ev, cb) => { fire = cb; return Promise.resolve({ remove: vi.fn() }) }),
    }
    const handler = vi.fn()
    onNotificationAction(handler, { plugin })
    await Promise.resolve(); await Promise.resolve()

    fire({ actionId: 'rest-add', notification: { id: 200, extra: { kind: 'rest' } } })
    expect(handler).toHaveBeenCalledWith({ actionId: 'rest-add', notificationId: 200, extra: { kind: 'rest' } })
  })
})

// Regression: the Capacitor plugin proxy on Android is thenable-looking. Awaiting it makes JS
// call .then(), and Android answers '"LocalNotifications.then()" is not implemented'. Any
// helper that returns the raw proxy from an async function reintroduces that bug silently —
// the promise rejects, the notification never posts, and no test notices. This mock throws on
// .then exactly like the device does, so the whole module is exercised against the real trap.
describe('mobile.js — Android plugin proxy trap', () => {
  const thenableProxy = () => {
    const plugin = {
      schedule: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      createChannel: vi.fn().mockResolvedValue(undefined),
      registerActionTypes: vi.fn().mockResolvedValue(undefined),
      addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
      checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    }
    Object.defineProperty(plugin, 'then', {
      get() { throw new Error('"LocalNotifications.then()" is not implemented on android') },
    })
    return plugin
  }

  it('schedules the rest alarm without ever awaiting the raw proxy', async () => {
    const plugin = thenableProxy()
    const res = await scheduleRestNotification(90, { plugin })
    expect(res).toBe(true)
    expect(plugin.schedule).toHaveBeenCalled()
  })

  it('posts the ongoing card without ever awaiting the raw proxy', async () => {
    const plugin = thenableProxy()
    const res = await updateOngoingWorkoutNotification({ name: 'Push day' }, { plugin })
    expect(res).toBe(true)
    expect(plugin.schedule).toHaveBeenCalled()
  })

  it('cancels the rest alarm without ever awaiting the raw proxy', async () => {
    const plugin = thenableProxy()
    const res = await cancelRestNotification({ plugin })
    expect(res).toBe(true)
    expect(plugin.cancel).toHaveBeenCalled()
  })

  it('checks exact notification setting and reports permission', async () => {
    const plugin = {
      checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
      checkExactNotificationSetting: vi.fn().mockResolvedValue({ exact_alarm: 'granted' }),
    }
    const res = await checkExactNotificationSetting({ plugin })
    expect(res).toEqual({ display: 'granted', exact: true })
  })

  it('opens exact alarm settings and returns granted status', async () => {
    const plugin = {
      changeExactNotificationSetting: vi.fn().mockResolvedValue({ exact_alarm: 'granted' }),
    }
    const res = await openExactAlarmSettings({ plugin })
    expect(res).toBe(true)
    expect(plugin.changeExactNotificationSetting).toHaveBeenCalled()
  })

  it('checks exact notification setting without ever awaiting the raw proxy', async () => {
    const plugin = thenableProxy()
    plugin.checkExactNotificationSetting = vi.fn().mockResolvedValue({ exact_alarm: 'granted' })
    const res = await checkExactNotificationSetting({ plugin })
    expect(res).toEqual({ display: 'granted', exact: true })
  })

  it('opens exact alarm settings without ever awaiting the raw proxy', async () => {
    const plugin = thenableProxy()
    plugin.changeExactNotificationSetting = vi.fn().mockResolvedValue({ exact_alarm: 'granted' })
    const res = await openExactAlarmSettings({ plugin })
    expect(res).toBe(true)
    expect(plugin.changeExactNotificationSetting).toHaveBeenCalled()
  })
})


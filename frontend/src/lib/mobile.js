// Mobile build (VITE_MOBILE=1) — the standalone app-store version (Capacitor native shell).
//
// There is no backend: nothing to sign in to, everything lives on the phone. Unlike guest
// mode in a browser, this is the user's only copy of their training log, so it can't depend
// on WebView localStorage alone (iOS evicts that under storage pressure). State persistence
// is handled by the local backend adapter (lib/backend/local.js).
//
// The workout reminder and rest timer alarms use native local notifications scheduled
// on the operating system — no server involved, and works even when the WebView is frozen.
//
// Note on Capacitor Plugins: NEVER return a plugin proxy directly from an async function or
// pass it into Promise.resolve(), to avoid the "LocalNotifications.then() is not implemented on android" trap.
import { registerPlugin } from '@capacitor/core'
import { t } from './i18n.js'
import { activeWeek } from './rotation.js'

export const MOBILE = import.meta.env.VITE_MOBILE === '1'
export const WorkoutNotification = registerPlugin('WorkoutNotification')

export const WORKOUT_ONGOING_ID = 199
export const REST_NOTIFICATION_ID = 200

// Two channels on purpose, and the split is the whole point. The rest alarm has to be able to
// wake someone with the screen off, so it is IMPORTANCE_HIGH with sound and vibration. The
// ongoing workout card is a place to look, never a thing that interrupts: posting it on the
// alarm channel makes the phone buzz on every single set until the user silences openGym —
// and silencing it takes the rest alarm down with it, which is the one that matters.
export const REST_CHANNEL_ID = 'opengym-rest-timer'
export const WORKOUT_CHANNEL_ID = 'opengym-workout'
export const REST_ACTION_TYPE = 'opengym-rest-actions'

// Wall-clock HH:MM in the device locale. Used by the ongoing card, which must stay true
// however long the phone is asleep.
const fmtClock = (ms) => {
  try {
    return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const payloadName = (options = {}) => options.workoutName || ''

// Helper that wraps the plugin in a plain object to prevent any `.then()` proxy traps
async function getPlugin(options = {}) {
  if (options.plugin) return { plugin: options.plugin }
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  return { plugin: LocalNotifications }
}

let channelsReady = null

export async function initNotificationChannels(options = {}) {
  if (channelsReady && !options.plugin) return channelsReady
  const run = (async () => {
    try {
      const { plugin: LocalNotifications } = await getPlugin(options)
      if (typeof LocalNotifications.createChannel === 'function') {
        await LocalNotifications.createChannel({
          id: REST_CHANNEL_ID,
          name: 'Rest timer',
          description: 'Fires when a rest interval between sets is over',
          importance: 5, // IMPORTANCE_HIGH — heads-up banner, sound, lockscreen
          visibility: 1, // VISIBILITY_PUBLIC
          vibration: true,
        }).catch(() => {})
        await LocalNotifications.createChannel({
          id: WORKOUT_CHANNEL_ID,
          name: 'Workout in progress',
          description: 'Silent card shown while a workout is running',
          importance: 2, // IMPORTANCE_LOW — visible in the shade, never interrupts
          visibility: 1,
          vibration: false,
          sound: null,
        }).catch(() => {})
      }
      // Buttons on the rest alarm, so a rest can be extended or skipped from the lockscreen
      // without unlocking the phone with chalk on both hands.
      if (typeof LocalNotifications.registerActionTypes === 'function') {
        await LocalNotifications.registerActionTypes({
          types: [{
            id: REST_ACTION_TYPE,
            actions: [
              { id: 'rest-add', title: t('+15s') },
              { id: 'rest-skip', title: t('Skip rest'), destructive: true },
            ],
          }],
        }).catch(() => {})
      }
      return true
    } catch (e) {
      return false
    }
  })()
  if (!options.plugin) channelsReady = run
  return run
}

// Subscribe to taps and action buttons on our notifications. Returns a plain unsubscribe
// function — never the plugin's listener handle, which is a native proxy that JS would try
// to call .then() on.
export function onNotificationAction(handler, options = {}) {
  if (typeof handler !== 'function') return () => {}
  let unsubscribed = false
  let handle = null

  getPlugin(options)
    .then(({ plugin: LocalNotifications }) => {
      if (unsubscribed || typeof LocalNotifications.addListener !== 'function') return null
      return LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        if (unsubscribed) return
        try {
          handler({
            actionId: event?.actionId,
            notificationId: event?.notification?.id,
            extra: event?.notification?.extra || {},
          })
        } catch { /* a listener must not take the app down */ }
      })
    })
    .then((h) => {
      if (unsubscribed) h?.remove?.()
      else handle = h
    })
    .catch(() => {})

  return () => {
    unsubscribed = true
    handle?.remove?.()
  }
}

// (Re)schedule the workout-day reminder: one repeating notification per weekday that has a
// routine in the weekly plan. Cheap enough to run after any state change — the plan or the
// reminder time may just have been edited. `interactive` gates the OS permission prompt to
// the Settings toggle; a background resync never pops a dialog.
export async function syncReminder(S, interactive = false, options = {}) {
  try {
    const { plugin: LocalNotifications } = await getPlugin(options)
    await LocalNotifications.cancel({ notifications: [0, 1, 2, 3, 4, 5, 6].map(d => ({ id: 100 + d })) }).catch(() => {})
    const r = S.reminder
    if (!r?.on) return true
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted' && interactive) perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return false
    const [hour, minute] = (r.time || '08:00').split(':').map(Number)
    const notifications = Object.entries(activeWeek(S) || {})
      .filter(([, rid]) => rid && (S.routines || []).some(x => x.id === rid))
      .map(([day, rid]) => ({
        id: 100 + Number(day),
        title: t('Workout day'),
        body: t('{0} is on the plan today — let’s go!', S.routines.find(x => x.id === rid).name),
        // Capacitor weekdays are 1 (Sunday) … 7 (Saturday); S.week uses getDay() 0…6.
        schedule: { on: { weekday: Number(day) + 1, hour, minute }, allowWhileIdle: true },
      }))
    if (notifications.length) await LocalNotifications.schedule({ notifications })
    return true
  } catch (e) { return false }
}

// Schedule an OS-level rest timer alarm at endsAt so that the user is notified
// even if Android suspends the WebView when the screen is locked.
export async function scheduleRestNotification(sec, options = {}) {
  if (!sec || sec <= 0) return false
  try {
    const { plugin: LocalNotifications } = await getPlugin(options)
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] }).catch(() => {})

    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return false

    await initNotificationChannels(options)

    const at = new Date(Date.now() + Math.round(sec) * 1000)
    await LocalNotifications.schedule({
      notifications: [{
        id: REST_NOTIFICATION_ID,
        title: t('Rest over — next set!'),
        body: payloadName(options) || t('Back to work'),
        channelId: REST_CHANNEL_ID,
        actionTypeId: REST_ACTION_TYPE,
        extra: { kind: 'rest' },
        schedule: { at, allowWhileIdle: true },
      }]
    })
    return true
  } catch (e) {
    return false
  }
}

// Unconditionally cancel any scheduled rest timer alarm
export async function cancelRestNotification(options = {}) {
  try {
    const { plugin: LocalNotifications } = await getPlugin(options)
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] }).catch(() => {})
    return true
  } catch (e) {
    return false
  }
}

// The ongoing workout card. Two rules shape it.
//
// It is silent: WORKOUT_CHANNEL_ID is IMPORTANCE_LOW, so re-posting it on every set updates
// the card in place without a buzz or a banner.
//
// And it never shows a countdown. Android freezes the WebView with the screen off, so a
// "90s left" written once stays 90 forever while the real rest drains away — a number that is
// wrong within seconds is worse than no number. The end time is written instead, because
// "rest until 18:42" stays true no matter how long the phone sits in a pocket.
export async function updateOngoingWorkoutNotification(payload = {}, options = {}) {
  try {
    if (MOBILE && !options.plugin) {
      try {
        const resting = typeof payload.restEndsAt === 'number' && payload.restEndsAt > Date.now()
        await WorkoutNotification.update({
          exerciseName: payload.exerciseName || payload.name || t('Workout'),
          setIndex: payload.setIndex || 1,
          totalSets: payload.totalSets || 1,
          reps: Number(payload.reps) || 10,
          weight: Number(payload.weight) || 0,
          weightUnit: payload.weightUnit || 'kg',
          isResting: resting,
          restUntil: resting ? payload.restEndsAt : 0,
          nextExName: payload.nextExName || null,
          isBw: !!payload.isBw,
          isCardio: !!payload.isCardio
        })
        return true
      } catch (err) {
        // Fallback to LocalNotifications
      }
    }

    const { plugin: LocalNotifications } = await getPlugin(options)
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return false

    await initNotificationChannels(options)

    const name = payload.name || t('Workout')
    const resting = typeof payload.restEndsAt === 'number' && payload.restEndsAt > Date.now()

    let title
    if (payload.exerciseName && payload.setIndex != null && payload.totalSets) {
      title = `${payload.exerciseName} · ${t('Set {0}/{1}', payload.setIndex, payload.totalSets)}`
    } else {
      title = resting ? t('Resting until {0}', fmtClock(payload.restEndsAt)) : name
    }

    const body = resting
      ? t('Resting until {0}', fmtClock(payload.restEndsAt))
      : (payload.name || t('Workout in progress — tap to return'))

    await LocalNotifications.schedule({
      notifications: [{
        id: WORKOUT_ONGOING_ID,
        title,
        body,
        channelId: WORKOUT_CHANNEL_ID,
        ongoing: true,
        autoCancel: false,
        extra: { kind: 'workout' },
      }]
    })
    return true
  } catch (e) {
    return false
  }
}

// Clear persistent workout notification
export async function clearOngoingWorkoutNotification(options = {}) {
  try {
    if (MOBILE && !options.plugin) {
      WorkoutNotification.clear().catch(() => {})
    }
    const { plugin: LocalNotifications } = await getPlugin(options)
    await LocalNotifications.cancel({ notifications: [{ id: WORKOUT_ONGOING_ID }] }).catch(() => {})
    return true
  } catch (e) {
    return false
  }
}

// Check exact alarm / notification permission on native platforms
export async function checkExactNotificationSetting(options = {}) {
  try {
    const { plugin: LocalNotifications } = await getPlugin(options)
    const perm = await LocalNotifications.checkPermissions()
    if (typeof LocalNotifications.checkExactNotificationSetting === 'function') {
      const exact = await LocalNotifications.checkExactNotificationSetting()
      return { display: perm.display, exact: exact.exact_alarm === 'granted' }
    }
    return { display: perm.display, exact: true }
  } catch (e) {
    return { display: 'unknown', exact: false }
  }
}

// Open Android exact alarm settings screen interactively
export async function openExactAlarmSettings(options = {}) {
  try {
    const { plugin: LocalNotifications } = await getPlugin(options)
    if (typeof LocalNotifications.changeExactNotificationSetting === 'function') {
      const res = await LocalNotifications.changeExactNotificationSetting()
      return res?.exact_alarm === 'granted'
    }
    return true
  } catch (e) {
    return false
  }
}

// Request notification permission from Settings interactively
export async function requestNotificationPermissions(options = {}) {
  try {
    const { plugin: LocalNotifications } = await getPlugin(options)
    const perm = await LocalNotifications.requestPermissions()
    await initNotificationChannels(options)
    return perm.display === 'granted'
  } catch (e) {
    return false
  }
}

// WKWebView can't do blob-URL downloads, so the backup goes out through the OS share sheet
// (Files, AirDrop, mail, …) from a temp file instead.
export async function shareExport(json, filename) {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const w = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: json, encoding: Encoding.UTF8 })
  await Share.share({ title: filename, url: w.uri })
}

import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { ACCENTS, todayISO, localTZ } from '../lib/format.js'
import { effortOf } from '../lib/history.js'
import { wakeLockSupported } from '../lib/wakelock.js'
import { t, LANGS, INSTR_LANGS } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { MOBILE, shareExport, syncReminder } from '../lib/mobile.js'
import { loadStarterPlan, confirmSheet, importFromApp } from '../sheets.jsx'
import { media } from '../lib/backend/index.js'
import Icon from '../components/Icon.jsx'
import { Section, Row, SelectRow, Switch, Segmented, Button } from '../components/ui.jsx'

export default function Settings() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const { update, replaceState, signOut, signOutAll, resetDemo } = useStore()
  const toast = useUI(s => s.toast)
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const wakeOK = wakeLockSupported()

  const doExport = async () => {
    const json = JSON.stringify(S, null, 2)
    const name = 'opengym-backup-' + todayISO() + '.json'
    if (MOBILE) {
      try { await shareExport(json, name); toast(t('Backup exported')) } catch (e) { /* share sheet dismissed */ }
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    toast(t('Backup exported'))
  }

  const doImport = ev => {
    const f = ev.target.files[0]; if (!f) return
    const rd = new FileReader()
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result)
        if (!data.workouts || !data.routines) throw new Error('not an openGym backup')
        confirmSheet({ title: t('Import backup?'), message: t('This replaces all current data with the backup file.'), confirmText: t('Import'), danger: true, onConfirm: () => { replaceState(Object.assign(JSON.parse(JSON.stringify(DEF)), data), true); toast(t('Backup imported')) } })
      } catch (e) { toast(t('Import failed: {0}', e.message)) }
    }
    rd.readAsText(f)
  }

  const signOutEverywhere = () => confirmSheet({
    title: t('Sign out everywhere?'),
    message: t('Signs this account out on every device, including this one.'),
    confirmText: t('Sign out everywhere'), danger: true,
    onConfirm: async () => {
      try { await signOutAll(); nav('/home'); toast(t('Signed out on all devices')) }
      catch (e) { toast(t('Could not sign out everywhere — you are still signed in.')) }
    },
  })

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Settings')}</h1></div>
    </div>

    {/* ---------- account ---------- */}
    <Section title={DEMO ? t('Demo') : t('Account')}>
      {DEMO ? <>
        <Row icon="sparkles" iconTint="var(--acc)" title={t('You’re in the demo')} subtitle={t('Example data, stored only in this browser — change anything you like.')} />
        <Row icon="reset" iconTint="var(--blue)" title={t('Reset demo data')} accessory="chevron"
          onClick={() => confirmSheet({ title: t('Reset demo data?'), message: t('Puts the example plan, workouts and weigh-ins back the way they started.'), confirmText: t('Reset'), onConfirm: () => { resetDemo(); nav('/home'); toast(t('Demo data reset')) } })} />
        <Row icon="rocket" iconTint="var(--indigo)" title={t('Self-host openGym')} subtitle={t('Appwrite cloud/self-hosted backend, sync across your devices.')} accessory="chevron"
          onClick={() => window.open(REPO, '_blank', 'noopener')} />
      </> : user ? <>
        <Row icon="personCircle" iconTint="var(--grey)" title={user.name} subtitle={user.email ? user.email : t('Signed in — data syncs to this account.')} />
        <SyncRow />
        <Row icon="signOut" iconTint="var(--red)" title={t('Sign out')} danger onClick={() => confirmSheet({ title: t('Sign out?'), message: t('Your data is synced to your account first, then cleared from this device.'), confirmText: t('Sign out'), danger: true, onConfirm: () => { signOut(); nav('/home') } })} />
        <Row icon="shield" iconTint="var(--red)" title={t('Sign out everywhere')} subtitle={t('Ends this account’s sessions on all your devices.')} danger onClick={signOutEverywhere} />
      </> : (
        <Row icon="person" iconTint="var(--grey)" title={t('Not signed in')} />
      )}
    </Section>
    {!user && !DEMO && <p className="sect-f" style={{ marginTop: -18, marginBottom: 22 }}>{t('Guest mode — data lives only in this browser.')}</p>}

    {/* ---------- general ---------- */}
    <Section title={t('General')} footer={t('Note: switching units only changes the label — logged numbers are not converted.')}>
      <SelectRow
        icon="globe" iconTint="var(--blue)" title={t('Language')}
        value={S.lang || 'en'} onChange={v => update(s => { s.lang = v })}
        options={Object.entries(LANGS).map(([k, name]) => ({
          value: k, label: name,
          subtitle: INSTR_LANGS.includes(k) ? null : t("Exercise instructions aren't available in this language yet — they stay in English."),
        }))}
      />
      <Row icon="scale" iconTint="var(--teal)" title={t('Weight unit')}>
        <Segmented className="seg-inline"
          options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
          value={S.unit || 'kg'} onChange={v => update(s => { s.unit = v })} />
      </Row>
      <Row icon="timer" iconTint="var(--orange)" title={t('Default rest')}>
        <Segmented className="seg-inline"
          options={[{ value: 60, label: '60s' }, { value: 90, label: '90s' }, { value: 120, label: '120s' }, { value: 180, label: '180s' }]}
          value={S.restSec || 90} onChange={v => update(s => { s.restSec = v })} />
      </Row>
      <Row icon="sound" iconTint="var(--pink)" title={t('Rest timer sound')}>
        <Switch checked={S.sound !== false} onChange={v => update(s => { s.sound = v })} />
      </Row>
      <Row icon="gauge" iconTint="var(--purple)" title={t('Log set effort')}
        subtitle={t('Add a column to workouts to track how close each set was to failure.')}>
        <Segmented className="seg-inline"
          options={[
            { value: 'none', label: t('Off') },
            { value: 'rir', label: t('RIR') },
            { value: 'rpe', label: t('RPE') },
          ]}
          value={effortOf(S)}
          onChange={v => update(s => { s.effort = v })}
        />
      </Row>
      {wakeOK && (
        <Row icon="sun" iconTint="var(--yellow)" title={t('Keep screen awake')} subtitle={t('Prevents the display from sleeping during an active workout.')}>
          <Switch checked={S.keepAwake !== false} onChange={v => update(s => { s.keepAwake = v })} />
        </Row>
      )}
    </Section>

    {/* ---------- appearance ---------- */}
    <Section title={t('Appearance')}>
      <Row icon="sun" iconTint="var(--yellow)" title={t('Theme')}>
        <Segmented className="seg-inline"
          options={[{ value: 'dark', label: t('Dark') }, { value: 'light', label: t('Light') }]}
          value={S.theme || 'dark'} onChange={v => update(s => { s.theme = v })} />
      </Row>
      <Row icon="palette" iconTint="var(--acc)" title={t('Accent color')}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {Object.entries(ACCENTS).map(([key, col]) => (
            <button key={key} onClick={() => update(s => { s.accent = key })}
              aria-label={key}
              style={{
                width: 26, height: 26, borderRadius: '50%', background: col, border: 'none', cursor: 'pointer',
                outline: (S.accent || 'lime') === key ? '3px solid var(--fg)' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </Row>
      <Row icon="image" iconTint="var(--teal)" title={t('Demonstration animations')}
        subtitle={t('Shown in exercise details and workout logger.')}>
        <Segmented className="seg-inline"
          options={[
            { value: 'full', label: t('Full') },
            { value: 'compact', label: t('Compact') },
            { value: 'off', label: t('Off') },
          ]}
          value={S.gifSize || 'full'} onChange={v => update(s => { s.gifSize = v })} />
      </Row>
    </Section>

    {/* ---------- notifications ---------- */}
    {MOBILE && <MobileReminderCard S={S} update={update} toast={toast} />}

    {/* ---------- storage & cache ---------- */}
    <MediaCacheCard S={S} update={update} toast={toast} />

    {/* ---------- data & backup ---------- */}
    <Section title={t('Data & Backups')} footer={t('Backups contain your complete workout history, routines, custom exercises, and body weight logs.')}>
      <Row icon="download" iconTint="var(--blue)" title={t('Export backup JSON')} subtitle={t('Save all workouts, routines and body weight history.')} accessory="chevron" onClick={doExport} />
      <Row icon="upload" iconTint="var(--teal)" title={t('Import backup JSON')} subtitle={t('Restore from a previously exported backup file.')} accessory="chevron" onClick={() => fileRef.current?.click()} />
      <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={doImport} />
      <Row icon="share" iconTint="var(--indigo)" title={t('Import from Hevy / Strong')} subtitle={t('Import routine CSV exports from other workout apps.')} accessory="chevron" onClick={() => importRef.current?.click()} />
      <input ref={importRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={ev => importFromApp(ev.target.files?.[0])} />
      <Row icon="sparkles" iconTint="var(--acc)" title={t('Load starter plan')} subtitle={t('Add a balanced 3-day Push/Pull/Legs program.')} accessory="chevron" onClick={loadStarterPlan} />
    </Section>
  </div>
}

function MobileReminderCard({ S, update, toast }) {
  const setReminder = patch => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), ...patch, tz: localTZ() } })
  const toggle = async () => {
    const on = !S.reminder?.on
    if (on) {
      const ok = await syncReminder({ ...S, reminder: { ...(S.reminder || DEF.reminder), on: true } }, true)
      if (!ok) { toast(t('Could not change notification settings')); return }
    }
    setReminder({ on })
  }
  return (
    <Section title={t('Notifications')}
      footer={S.reminder?.on ? t('Reminds you at this time on days that have a routine planned.') : null}>
      <Row icon="calendar" iconTint="var(--orange)" title={t('Workout day reminder')}>
        <Switch checked={!!S.reminder?.on} onChange={toggle} />
      </Row>
      {S.reminder?.on && (
        <Row icon="clock" iconTint="var(--purple)" title={t('Reminder time')}>
          <input type="time" className="timef" value={S.reminder?.time || DEF.reminder.time}
            onChange={e => setReminder({ time: e.target.value })} />
        </Row>
      )}
    </Section>
  )
}

function MediaCacheCard({ S, update, toast }) {
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    if (typeof media?.getCacheUsage === 'function') {
      media.getCacheUsage().then(setUsage).catch(() => {})
    }
  }, [])

  const doClearCache = async () => {
    if (typeof media?.clearCache === 'function') {
      await media.clearCache()
      const u = await media.getCacheUsage()
      setUsage(u)
      toast(t('Animation cache cleared'))
    }
  }

  const mb = usage ? (usage.usedBytes / (1024 * 1024)).toFixed(1) : '0.0'
  const count = usage?.count || 0

  return (
    <Section title={t('Storage & Cache')} footer={t('Animations are cached up to 50 MB on device. Exercise images always stay offline.')}>
      <Row icon="archive" iconTint="var(--indigo)" title={t('Animation cache')} subtitle={`${mb} MB used (${count} animations)`}>
        {count > 0 && <Button variant="secondary" size="sm" onClick={doClearCache}>{t('Clear')}</Button>}
      </Row>
      <Row icon="wifi" iconTint="var(--teal)" title={t('Download on WiFi only')}>
        <Switch checked={S.wifiOnlyMedia !== false} onChange={v => update(s => { s.wifiOnlyMedia = v })} />
      </Row>
    </Section>
  )
}

function SyncRow() {
  const isSyncing = useStore(s => s.isSyncing)
  const pendingCount = useStore(s => s.pendingCount) || 0
  const failedWorkouts = useStore(s => s.failedWorkouts) || {}
  const { syncNow } = useStore()
  const toast = useUI(s => s.toast)

  const failedEntries = Object.entries(failedWorkouts)
  const failedCount = failedEntries.length

  const handleSync = async () => {
    if (isSyncing) return
    toast(t('Syncing...'))
    const res = await syncNow()
    if (res?.ok) {
      toast(t('Sync completed'))
    } else {
      toast(t('Sync failed — offline or network error'))
    }
  }

  let subtitle = t('Up to date with cloud')
  let iconTint = 'var(--acc)'

  if (isSyncing) {
    subtitle = t('Syncing...')
    iconTint = 'var(--blue)'
  } else if (failedCount > 0) {
    const firstErr = failedEntries[0][1]?.msg || 'Error'
    subtitle = t('{0} failed to sync ({1})', failedCount, firstErr)
    iconTint = 'var(--red)'
  } else if (pendingCount > 0) {
    subtitle = t('{0} pending workout(s) to upload', pendingCount)
    iconTint = 'var(--orange)'
  }

  return (
    <Row
      icon="refresh"
      iconTint={iconTint}
      title={t('Cloud Sync')}
      subtitle={subtitle}
      accessory="chevron"
      onClick={handleSync}
    />
  )
}


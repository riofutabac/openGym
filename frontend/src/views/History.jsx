import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { WorkoutRow, workoutDetailSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isSyncing = useStore(s => s.isSyncing)
  const pendingCount = useStore(s => s.pendingCount) || 0
  const failedWorkouts = useStore(s => s.failedWorkouts) || {}
  const { syncNow } = useStore()
  const [shown, setShown] = useState(25)

  const hasFailed = Object.keys(failedWorkouts).length > 0
  const badgeColor = hasFailed ? 'var(--red)' : pendingCount > 0 ? 'var(--orange)' : null

  const allWorkouts = [...S.workouts].reverse()

  return (
    <div className="narrow">
      <div className="hdr">
        <button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}>
          <Icon name="chevronLeft" />
        </button>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <h1>{t('History')}</h1>
          <div className="sub">{t('{0} workouts', S.workouts.length)}</div>
        </div>
        {user && (
          <button
            className="iconbtn"
            style={{ position: 'relative' }}
            onClick={() => syncNow()}
            aria-label={t('Sync')}
            title={isSyncing ? t('Syncing...') : pendingCount > 0 ? t('{0} pending', pendingCount) : t('Cloud Sync')}
          >
            <Icon name="repeat" className={isSyncing ? 'spin' : ''} />
            {badgeColor && (
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: badgeColor,
                }}
              />
            )}
          </button>
        )}
      </div>

      {allWorkouts.length ? (
        <>
          <div className="list">
            {allWorkouts.slice(0, shown).map(w => (
              <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />
            ))}
          </div>
          {allWorkouts.length > shown && (
            <>
              <div style={{ height: 12 }} />
              <Button onClick={() => setShown(s => s + 25)}>{t('Show more')}</Button>
            </>
          )}
        </>
      ) : (
        <div className="empty">
          <div className="ico"><Icon name="history" /></div>
          {t('No workouts yet.')}
        </div>
      )}
    </div>
  )
}

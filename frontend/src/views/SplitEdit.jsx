import { useNavigate, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { uid, exCount, DAYS } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, Switch } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { glyphPicker, confirmSheet, routinePickerSheet, planToolsSheet } from '../sheets.jsx'
import { daysSinceDone } from '../lib/rotation.js'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun

export default function SplitEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const setActiveSplit = useStore(s => s.setActiveSplit)
  const deleteSplit = useStore(s => s.deleteSplit)

  const split = (S.splits || []).find(x => x.id === id)

  useEffect(() => {
    if (!split) nav('/plan')
  }, [split, nav])

  if (!split) return null

  const isActive = S.activeSplitId === id
  const weekMap = split.week || {}

  // Routines assigned to this split, in day order, de-duplicated (a routine can
  // cover more than one day, e.g. Mon + Thu, but should only show once).
  const routineDays = new Map()
  WEEK_DAYS.forEach(d => {
    const rid = weekMap[d]
    if (!rid) return
    if (!routineDays.has(rid)) routineDays.set(rid, [])
    routineDays.get(rid).push(d)
  })
  const splitRoutines = [...routineDays.entries()]
    .map(([rid, days]) => ({ routine: S.routines.find(r => r.id === rid), days }))
    .filter(x => x.routine)

  const addExistingRoutine = () => {
    routinePickerSheet(S.routines.filter(r => !routineDays.has(r.id)), rid => {
      update(s => {
        const sp = (s.splits || []).find(x => x.id === id)
        if (!sp) return
        sp.week = sp.week || {}
        // Land the routine on the first day of the week that's still free.
        const free = WEEK_DAYS.find(d => !sp.week[d])
        sp.week[free ?? WEEK_DAYS[0]] = rid
        if (s.activeSplitId === id) s.week = { ...sp.week }
      })
    })
  }

  const addNewRoutine = () => {
    const newRoutine = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => {
      s.routines = s.routines || []
      s.routines.push(newRoutine)
      const sp = (s.splits || []).find(x => x.id === id)
      if (sp) {
        sp.week = sp.week || {}
        const free = WEEK_DAYS.find(d => !sp.week[d])
        sp.week[free ?? WEEK_DAYS[0]] = newRoutine.id
        if (s.activeSplitId === id) s.week = { ...sp.week }
      }
    })
    nav('/plan/r/' + newRoutine.id + '?split=' + id)
  }

  const removeFromSplit = rid => {
    update(s => {
      const sp = (s.splits || []).find(x => x.id === id)
      if (!sp || !sp.week) return
      Object.keys(sp.week).forEach(d => { if (sp.week[d] === rid) delete sp.week[d] })
      if (s.activeSplitId === id) s.week = { ...sp.week }
    })
  }

  return (
    <div className="narrow">
      <div className="hdr">
        <button className="iconbtn" onClick={() => nav('/plan')} aria-label={t('Plan')}>
          <Icon name="chevronLeft" />
        </button>
        <div style={{ flex: 1, margin: '0 12px' }}>
          <input
            className="input"
            defaultValue={split.name}
            style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-.021em' }}
            onBlur={e => update(s => {
              const sp = (s.splits || []).find(x => x.id === id)
              if (sp) sp.name = e.target.value.trim() || t('Split')
            })}
          />
        </div>
        <button
          className="iconbtn"
          aria-label={t('Pick an icon')}
          onClick={() => glyphPicker(split.emoji || '💪', g => update(s => {
            const sp = (s.splits || []).find(x => x.id === id)
            if (sp) sp.emoji = g
          }))}
        >
          <Icon name={glyphOf(split.emoji || '💪')} />
        </button>
        <button className="iconbtn" onClick={() => planToolsSheet(id)} aria-label={t('Share this split')} title={t('Share this split')}>
          <Icon name="upload" />
        </button>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: '14px 16px' }}>
        <div className="row between" style={{ alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{t('Active split')}</div>
            <div className="dim small" style={{ marginTop: 2 }}>
              {isActive ? t('Currently used for your daily workouts and rotation') : t('Make this your primary training schedule')}
            </div>
          </div>
          <Switch
            checked={isActive}
            onChange={checked => {
              if (checked) setActiveSplit(id)
            }}
          />
        </div>
      </div>

      <div className="row between" style={{ margin: '0 4px 8px', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{t('Routines')}</h2>
        <Button size="sm" variant="tinted" icon="plus" onClick={addNewRoutine}>
          {t('New')}
        </Button>
      </div>

      {splitRoutines.length > 0 ? (
        <div className="list" style={{ marginBottom: 16 }}>
          {splitRoutines.map(({ routine: r, days }) => {
            const daysDone = daysSinceDone(S, r.id)
            const lastDoneLabel = daysDone == null
              ? t('Never performed')
              : daysDone === 0
                ? t('done today')
                : daysDone === 1
                  ? t('Last done yesterday')
                  : t('Last done {0} days ago', daysDone)
            const daysStr = days.map(d => t(DAYS[d])).join(', ')

            return (
              <div key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id + '?split=' + id)} style={{ cursor: 'pointer' }}>
                <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
                <div className="grow">
                  <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="tt" style={{ fontWeight: 500 }}>{r.name}</div>
                    <span className="tag" style={{ fontSize: 11, padding: '2px 6px', background: 'var(--surface-3)', color: 'var(--label)' }}>{daysStr}</span>
                  </div>
                  <div className="ss">{exCount(r.ex.length)} · {lastDoneLabel}</div>
                </div>
                <button
                  className="iconbtn"
                  aria-label={t('Remove from split')}
                  onClick={e => { e.stopPropagation(); removeFromSplit(r.id) }}
                >
                  <Icon name="xmark" />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty" style={{ padding: '20px 0', marginBottom: 16 }}>
          <div className="dim small">{t('No routines in this split yet.')}</div>
        </div>
      )}

      {S.routines.length > splitRoutines.length && (
        <Button variant="ghost" icon="plus" onClick={addExistingRoutine}>
          {t('Add existing routine')}
        </Button>
      )}

      <div style={{ height: 20 }} />
      <Button
        variant="danger"
        onClick={() => confirmSheet({
          title: t('Delete split?'),
          message: t('“{0}” will be deleted. The routines in this split will stay in your library.', split.name),
          confirmText: t('Delete'),
          danger: true,
          onConfirm: () => {
            deleteSplit(id)
            nav('/plan')
          }
        })}
      >
        {t('Delete split')}
      </Button>
    </div>
  )
}

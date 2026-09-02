import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYS } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { loadStarterPlan, openTemplatesSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { activeSplit } from '../lib/rotation.js'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const createSplit = useStore(s => s.createSplit)
  const setActiveSplit = useStore(s => s.setActiveSplit)

  const splits = S.splits || []
  const active = activeSplit(S)

  const handleCreateSplit = () => {
    const sp = createSplit({ name: t('New split'), emoji: '💪' })
    nav('/splits/' + sp.id)
  }

  return (
    <div className="narrow">
      <div className="hdr">
        <div>
          <h1>{t('Splits')}</h1>
          <div className="sub">{t('Your weekly training schedules')}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="ghost" icon="sparkles" onClick={openTemplatesSheet}>
            {t('Plantillas')}
          </Button>
          <Button size="sm" variant="tinted" icon="plus" onClick={handleCreateSplit}>
            {t('New')}
          </Button>
        </div>
      </div>

      {splits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div className="empty">
            <div className="ico"><Icon name="calendar" /></div>
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 6 }}>{t('No training plan yet')}</div>
            <div className="dim small" style={{ maxWidth: 320, margin: '0 auto 20px', lineHeight: 1.5 }}>
              {t('Set up a split to organize your weekly training schedule and reuse routines.')}
            </div>
          </div>
          <Button variant="primary" icon="sparkles" onClick={openTemplatesSheet}>
            {t('Plantillas de entrenamiento')}
          </Button>
          <div style={{ height: 10 }} />
          <Button variant="ghost" icon="plus" onClick={handleCreateSplit}>
            {t('Create custom split')}
          </Button>
        </div>
      ) : (
        <div className="list" style={{ gap: 8 }}>
          {splits.map(sp => {
            const isActive = active?.id === sp.id
            const scheduledDays = WEEK_DAYS.filter(d => sp.week?.[d])
            const daysStr = scheduledDays.length
              ? scheduledDays.map(d => t(DAYS[d]).slice(0, 3)).join(', ')
              : t('No scheduled days')

            return (
              <div
                key={sp.id}
                className="item"
                onClick={() => nav('/splits/' + sp.id)}
                style={{
                  cursor: 'pointer',
                  padding: '12px 14px',
                  border: isActive ? '1px solid color-mix(in srgb, var(--acc) 30%, transparent)' : undefined,
                  background: isActive ? 'color-mix(in srgb, var(--acc) 5%, var(--surface))' : undefined,
                }}
              >
                <span className="lrow-i" style={{ background: isActive ? 'var(--acc)' : undefined, color: isActive ? 'var(--acc-fg)' : undefined }}>
                  <Icon name={glyphOf(sp.emoji || '💪')} />
                </span>
                <div className="grow">
                  <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="tt" style={{ fontWeight: isActive ? 600 : 500 }}>{sp.name}</div>
                    {isActive && <span className="tag acc" style={{ fontSize: 11, padding: '2px 6px' }}>{t('Active')}</span>}
                  </div>
                  <div className="ss">{scheduledDays.length} {t('days/week')} · {daysStr}</div>
                </div>
                {!isActive && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={e => { e.stopPropagation(); setActiveSplit(sp.id) }}
                  >
                    {t('Activate')}
                  </Button>
                )}
                <Icon name="chevronRight" className="chev" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

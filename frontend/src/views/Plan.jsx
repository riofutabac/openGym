import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { uid, exCount, DAYS } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { loadStarterPlan, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { nextRoutine, daysSinceDone } from '../lib/rotation.js'

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  const next = nextRoutine(S)

  return (
    <div className="narrow">
      <div className="hdr">
        <div>
          <h1>{t('Routines')}</h1>
          <div className="sub">{t('Continuous rotation cycle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
          <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
        </div>
      </div>

      {S.routines.length ? (
        <>
          <div className="list">
            {S.routines.map((r, idx) => {
              const isNext = next && next.id === r.id
              const days = daysSinceDone(S, r.id)
              const lastDoneLabel = days == null
                ? t('Never performed')
                : days === 0
                  ? t('done today')
                  : days === 1
                    ? t('Last done yesterday')
                    : t('Last done {0} days ago', days)

              const assignedDays = Object.entries(S.week || {})
                .filter(([, rid]) => rid === r.id)
                .map(([d]) => Number(d))
                .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))

              const daysStr = assignedDays.length > 0
                ? assignedDays.map(d => t(DAYS[d])).join(', ')
                : null

              return (
                <div key={r.id} className={'item' + (isNext ? ' highlighted' : '')} onClick={() => nav('/plan/r/' + r.id)} style={{ cursor: 'pointer' }}>
                  <span className="lrow-i" style={{ background: isNext ? 'var(--acc)' : undefined, color: isNext ? 'var(--acc-fg)' : undefined }}>
                    <Icon name={glyphOf(r.emoji)} />
                  </span>
                  <div className="grow">
                    <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div className="tt" style={{ fontWeight: isNext ? 600 : 500 }}>{r.name}</div>
                      {daysStr && <span className="tag" style={{ fontSize: 11, padding: '2px 6px', background: 'var(--surface-3)', color: 'var(--label)' }}>{daysStr}</span>}
                      {isNext && <span className="tag acc" style={{ fontSize: 11, padding: '2px 6px' }}>{t('Up next')}</span>}
                    </div>
                    <div className="ss">{exCount(r.ex.length)} · {daysStr ? t('Every {0}', daysStr) : lastDoneLabel}</div>
                  </div>
                  <Icon name="chevronRight" className="chev" />
                </div>
              )
            })}
          </div>

          <div className="card small muted" style={{ marginTop: 16, lineHeight: 1.5, background: 'var(--surface-1)' }}>
            <div className="row" style={{ gap: 8, marginBottom: 4, color: 'var(--fg)', fontWeight: 500 }}>
              <Icon name="repeat" style={{ color: 'var(--acc)' }} />
              <span>{t('How rotation works')}</span>
            </div>
            {t('Routines rotate in a continuous cycle: when you finish one, openGym suggests the next.')}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div className="empty">
            <div className="ico"><Icon name="repeat" /></div>
            <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>{t('No routines yet')}</div>
            <div className="dim small" style={{ maxWidth: 320, margin: '0 auto 18px', lineHeight: 1.5 }}>
              {t('Routines rotate in a continuous cycle: when you finish one, openGym suggests the next.')}
            </div>
          </div>
          <Button variant="primary" icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Upper / Lower 4 days)')}</Button>
          <div style={{ height: 10 }} />
          <Button variant="ghost" icon="plus" onClick={addRoutine}>{t('Create custom routine')}</Button>
        </div>
      )}
    </div>
  )
}

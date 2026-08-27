import { useStore, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { auth } from '../lib/backend/index.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

// Appwrite email/password + OAuth authentication view
function AppwriteAuth() {
  const { setUser, pushState, pullState } = useStore()
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const em = email.trim()
    const pw = password
    if (!em || !pw) {
      useUI.getState().toast(t('Please enter email and password'))
      return
    }
    if (isRegister && pw.length < 8) {
      useUI.getState().toast(t('Password must be at least 8 characters'))
      return
    }

    setBusy(true)
    try {
      let u
      if (isRegister) {
        u = await auth.register(em, pw, name.trim())
        setUser(u)
        if (hasData(useStore.getState().S)) {
          await pushState()
          useUI.getState().toast(t('Account created — local workouts linked to your account'))
        } else {
          await pullState()
          useUI.getState().toast(t('Welcome, {0}', u.name))
        }
      } else {
        u = await auth.loginWithEmail(em, pw)
        setUser(u)
        await pullState()
        useUI.getState().toast(t('Welcome back, {0}', u.name))
      }
    } catch (err) {
      useUI.getState().toast(err.message || (isRegister ? t('Registration failed') : t('Sign-in failed')))
    } finally {
      setBusy(false)
    }
  }

  const handleOAuth = async () => {
    try {
      await auth.loginWithOAuth(auth.oauthProviderName?.toLowerCase() || 'google')
    } catch (err) {
      useUI.getState().toast(err.message || t('OAuth failed'))
    }
  }

  const oauthLabel = auth.oauthProviderName
    ? t('Continue with {0}', auth.oauthProviderName)
    : t('Continue with Google')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isRegister && (
          <div>
            <label className="dim small" style={{ display: 'block', marginBottom: 4 }}>{t('Your name')}</label>
            <input className="input" placeholder="Alex" value={name} onChange={e => setName(e.target.value)} maxLength={50} />
          </div>
        )}
        <div>
          <label className="dim small" style={{ display: 'block', marginBottom: 4 }}>{t('Email')}</label>
          <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="dim small" style={{ display: 'block', marginBottom: 4 }}>{t('Password')}</label>
          <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <div style={{ height: 4 }} />
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? t('Connecting…') : isRegister ? t('Create account') : t('Sign in')}
        </Button>
      </form>

      {auth.supportsOAuth && (
        <>
          <div className="dim small" style={{ textAlign: 'center', margin: '4px 0' }}>{t('or')}</div>
          <Button variant="outline" onClick={handleOAuth} disabled={busy}>
            {oauthLabel}
          </Button>
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <button
          type="button"
          className="btnlink small"
          style={{ color: 'var(--acc)', background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister ? t('Already have an account? Sign in') : t('New to openGym? Create an account')}
        </button>
      </div>

      <div className="card small muted" style={{ marginTop: 14, textAlign: 'left', lineHeight: 1.5 }}>
        {t('An internet connection is required once to create or sign into your account. After that, openGym works completely offline.')}
      </div>
    </div>
  )
}

export default function Login() {
  const { setGuest } = useStore()
  const head = <>
    <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="dumbbell" /></div>
    <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>openGym</h1>
  </>
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }

  // Demo build: no backend to sign in against — the only way in is the local guest profile.
  if (DEMO) return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 30 }}>{t('Live demo — everything stays in this browser.')}</div>
      <Button variant="primary" icon="sparkles" onClick={() => setGuest(true)}>{t('Start the demo')}</Button>
      <div className="card small muted" style={{ textAlign: 'left', marginTop: 16 }}>
        {t('This demo runs entirely in your browser on example data — nothing is sent anywhere. Sign-in and sync across your devices come with the openGym server or Appwrite backend.')}
      </div>
      <div className="dim small" style={{ marginTop: 22, lineHeight: 1.6 }}>
        <a href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</a>
      </div>
    </div>
  )

  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 24 }}>{t('Your workouts. Your weights. Your account.')}</div>
      <AppwriteAuth />
    </div>
  )
}

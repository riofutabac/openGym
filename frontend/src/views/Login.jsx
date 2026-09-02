import { useStore, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { auth } from '../lib/backend/index.js'
import { mapAuthError } from '../lib/errors.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Button, Segmented, TextField } from '../components/ui.jsx'

// DIRECTION: the app's own bottom-sheet grammar (rising bg-el panel, rounded
// top, one entrance beat) rises over a hero that states the real product
// fact — one online moment, then offline for good — instead of a generic
// logo-and-tagline card. Same tokens/components as the rest of openGym.

// Appwrite email/password + OAuth authentication view
function AppwriteAuth() {
  const { setUser, pushState, pullState } = useStore()
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    setError(null)
    const em = email.trim()
    const pw = password
    if (!em || !pw) {
      setError(t('Please enter email and password'))
      return
    }
    if (isRegister && pw.length < 8) {
      setError(t('Password must be at least 8 characters'))
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
      console.error('[Login.jsx handleSubmit error]', err)
      const errKey = mapAuthError(err, isRegister)
      const translated = t(errKey)
      setError(translated || err?.message || t('Registration failed. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const handleOAuth = async () => {
    setError(null)
    try {
      await auth.loginWithOAuth(auth.oauthProviderName?.toLowerCase() || 'google')
    } catch (err) {
      const errKey = mapAuthError(err, false)
      setError(t(errKey))
    }
  }

  const oauthLabel = auth.oauthProviderName
    ? t('Continue with {0}', auth.oauthProviderName)
    : t('Continue with Google')

  return (
    <>
      <Segmented
        className="auth-seg"
        value={isRegister ? 'register' : 'login'}
        onChange={v => { setIsRegister(v === 'register'); setError(null) }}
        options={[
          { value: 'login', label: t('Sign in') },
          { value: 'register', label: t('Create account') },
        ]}
      />

      <form onSubmit={handleSubmit} className="auth-form">
        {isRegister && (
          <div className="auth-field">
            <label className="dim small">{t('Your name')}</label>
            <TextField placeholder={t('Your name')} value={name} onChange={e => setName(e.target.value)} maxLength={50} />
          </div>
        )}
        <div className="auth-field">
          <label className="dim small">{t('Email')}</label>
          <TextField type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="auth-field">
          <label className="dim small">
            {t('Password')} {isRegister && <span style={{ opacity: 0.7 }}>({t('min. 8 characters')})</span>}
          </label>
          <TextField type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={isRegister ? 8 : 1} />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <Button variant="primary" type="submit" disabled={busy} className="auth-cta">
          {busy ? t('Connecting…') : isRegister ? t('Create account') : t('Sign in')}
        </Button>
      </form>

      {auth.supportsOAuth && (
        <>
          <div className="auth-or">{t('or')}</div>
          <Button variant="outline" onClick={handleOAuth} disabled={busy}>
            {oauthLabel}
          </Button>
        </>
      )}

      <div className="auth-note">
        {t('An internet connection is required once to create or sign into your account. After that, openGym works completely offline.')}
      </div>
    </>
  )
}

export default function Login() {
  const { setGuest } = useStore()

  const mark = (
    <div className="auth-mark">
      <Icon name="dumbbell" />
      <span>openGym</span>
    </div>
  )

  // Demo build: no backend to sign in against — the only way in is the local guest profile.
  if (DEMO) return (
    <div className="auth-shell">
      <div className="auth-hero">
        {mark}
        <h1 className="auth-claim">{t('See it running')} <span className="accent">{t('right now.')}</span></h1>
      </div>
      <div className="auth-panel">
        <div className="auth-note" style={{ marginTop: 0, marginBottom: 4 }}>{t('Live demo — everything stays in this browser.')}</div>
        <Button variant="primary" icon="sparkles" onClick={() => setGuest(true)} className="auth-cta">
          {t('Start the demo')}
        </Button>
        <div className="auth-note">
          {t('This demo runs entirely in your browser on example data — nothing is sent anywhere. Sign-in and sync across your devices come with the openGym server or Appwrite backend.')}
        </div>
        <a href={REPO} target="_blank" rel="noopener" className="auth-selfhost">{t('Self-host it in a minute →')}</a>
      </div>
    </div>
  )

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        {mark}
        <h1 className="auth-claim">{t('Sign in once.')} <span className="accent">{t('Train offline, always.')}</span></h1>
      </div>
      <div className="auth-panel">
        <AppwriteAuth />
      </div>
    </div>
  )
}

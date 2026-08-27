import { useStore, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { auth } from '../lib/backend/index.js'
import { webauthnOK, api, BIO } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

// Passkey registration sheet for self-hosted Node server build
function PasskeyRegisterSheet({ close }) {
  const { setUser, pushState, pullState } = useStore()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [inviteOnly, setInviteOnly] = useState(false)
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  // TODO (Milestone 7): retire /api/config once instance settings move to Appwrite
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => {}) }, [])
  const go = async () => {
    const n = name.trim()
    if (!n) { useUI.getState().toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { useUI.getState().toast(t('An invite code is required')); return }
    try {
      const u = await auth.register(n, code.trim())
      setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created — data from this device moved into it')) }
      else { await pullState(); useUI.getState().toast(t('Welcome, {0}', u.name)) }
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(e.message || t('Registration failed')) }
  }
  return <>
    <h3>{t('Create your profile')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Pick a name, then confirm with {0}. The passkey is saved in your device — no password needed.', BIO)}</div>
    <input ref={ref} className="input" placeholder={t('Your name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
    {inviteOnly && <>
      <div style={{ height: 10 }} />
      <input className="input" placeholder={t('Invite code')} maxLength={40} value={code}
        onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} />
      <div className="dim small" style={{ marginTop: 6 }}>{t('This app is invite-only — enter the code you were given.')}</div>
    </>}
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={go}>{t('Create passkey')}</Button>
  </>
}

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
      await auth.loginWithOAuth('google')
    } catch (err) {
      useUI.getState().toast(err.message || t('OAuth failed'))
    }
  }

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
            {t('Continue with Google')}
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
  const { setUser, pullState, setGuest } = useStore()
  const signInPasskey = async () => {
    try { const u = await auth.login(); setUser(u); await pullState(); useUI.getState().toast(t('Welcome back, {0}', u.name)) }
    catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(e.message || t('Sign-in failed')) }
  }
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

  // Appwrite authentication mode (mobile APK / Appwrite web)
  if (auth.supportsEmailPassword) {
    return (
      <div className="narrow" style={wrap}>
        {head}
        <div className="muted" style={{ marginBottom: 24 }}>{t('Your workouts. Your weights. Your account.')}</div>
        <AppwriteAuth />
      </div>
    )
  }

  // Self-hosted passkey authentication mode
  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 34 }}>{t('Your workouts. Your weights. Your profile.')}</div>
      {webauthnOK() ? <>
        <Button variant="primary" icon="person" onClick={signInPasskey}>{t('Sign in with passkey')}</Button>
        <div style={{ height: 10 }} />
        <Button icon="sparkles" onClick={() => useUI.getState().openSheet(close => <PasskeyRegisterSheet close={close} />)}>{t('Create new profile')}</Button>
        <div style={{ height: 10 }} />
      </> : <div className="card small muted" style={{ textAlign: 'left' }}>{t("This browser doesn't support passkeys — you can still use openGym locally on this device.")}</div>}
      <div className="dim small" style={{ marginTop: 26, lineHeight: 1.5 }}>{t('Passkeys use {0} — no passwords.', BIO)}<br />{t('Each profile keeps its own plan, workouts & body weight.')}</div>
    </div>
  )
}

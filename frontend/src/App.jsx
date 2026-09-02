import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { ACCENTS } from './lib/format.js'
import { setLang, useLang, t } from './lib/i18n.js'
import { setNav } from './lib/nav.js'
import { useWakeLock } from './lib/wakelock.js'
import { startFlow, onboardingSheet } from './sheets.jsx'
import { needsOnboarding } from './lib/onboarding.js'
import Icon from './components/Icon.jsx'
import { auth } from './lib/backend/index.js'
import TabBar from './components/TabBar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import RestTimer from './components/RestTimer.jsx'
import Login from './views/Login.jsx'
import Home from './views/Home.jsx'
import Plan from './views/Plan.jsx'
import SplitEdit from './views/SplitEdit.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

function applyPrefs(theme, accent) {
  const de = document.documentElement
  de.dataset.theme = theme === 'light' ? 'light' : 'dark'
  de.dataset.accent = ACCENTS[accent] ? accent : 'lime'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'light' ? '#f2f2f7' : '#000000'
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready, profilePulled } = useStore()
  const isGuest = useStore(s => s.isGuest())
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { applyPrefs(S.theme, S.accent) }, [S.theme, S.accent])
  useEffect(() => { setLang(S.lang || 'en') }, [S.lang])
  useEffect(() => { document.documentElement.lang = S.lang || 'en' }, [langV, S.lang])
  // every tab/route change starts at the top of the page
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  // Listen for native deep link callbacks (e.g. OAuth returning from system browser)
  useEffect(() => {
    let listener = null
    const bindDeepLinks = async () => {
      if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
        try {
          const { App: CapApp } = await import('@capacitor/app')
          listener = await CapApp.addListener('appUrlOpen', async (event) => {
            if (event?.url) {
              const u = await auth.handleOAuthCallback?.(event.url)
              if (u) {
                useStore.getState().setUser(u)
                await useStore.getState().pullState()
                useUI.getState().toast(t('Welcome, {0}', u.name))
              }
            }
          })
          await CapApp.addListener('backButton', ({ canGoBack }) => {
            const st = useStore.getState().S
            const curLoc = window.location.hash || window.location.pathname
            const isWorkout = curLoc.includes('/workout')
            const openSheets = useUI.getState().sheets
            if (openSheets.length > 0) {
              useUI.getState().closeSheet(openSheets[openSheets.length - 1].id)
              return
            }
            if (st.active && isWorkout) {
              // Focus mode: protect active workout against accidental back exit
              return
            }
            if (canGoBack) {
              window.history.back()
            } else {
              CapApp.exitApp()
            }
          })
        } catch { /* ignore */ }
      }
    }
    bindDeepLinks()
    return () => { listener?.remove?.() }
  }, [])

  const authed = user || isGuest

  useEffect(() => {
    // profilePulled guards against the pre-pull moment right after login: setUser()
    // flips `authed` before pullState() has merged the remote profile in, so a
    // returning user's stale local S (no data yet) briefly looks brand-new and would
    // otherwise re-trigger onboarding on every login.
    if (ready && authed && profilePulled && needsOnboarding(S)) {
      onboardingSheet()
    }
  }, [ready, authed, profilePulled, S])

  if (!ready && !authed) return (
    <div id="app">
      <div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}>
        <Icon name="dumbbell" />
      </div>
    </div>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar is always a way out */}
      <div id="app" className="vfade" key={loc.pathname}>
        <ErrorBoundary>
          {!authed ? <Login /> : (
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/splits/:id" element={<SplitEdit />} />
              <Route path="/plan/split/:id" element={<SplitEdit />} />
              <Route path="/plan/r/:id" element={<RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </ErrorBoundary>
      </div>
      <TabBar onStart={startFlow} />
      <RestTimer />
      <Modals />
      <Toast />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  return <HashRouter><Shell /></HashRouter>
}

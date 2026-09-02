# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

<!-- Capacitor wraps this React/web app for Android/iOS distribution, but the design
language itself is web (SF Pro system stack, CSS, DOM), not native SwiftUI/Compose —
per init.md, a native wrapper around a website does not make its design language native. -->

## Users

The owner-developer (riofutabac), training personally in a gym, tracking their own
workouts, weights, and progression. Not built for a public multi-tenant audience —
one primary user (plus possibly a few people close to them) running their own
self-hosted instance.

## Product Purpose

openGym is a personal strength-training tracker: log workouts, track weights and
progression per exercise, organize training into reusable weekly Splits made of
Routines, and see history/streaks over time. Success is a frictionless daily
logging habit that survives gym wifi dead zones and doesn't depend on a
subscription service staying alive.

## Positioning

What a neighboring commercial app (Strong, Hevy) cannot truthfully copy:
- **Self-hosted, own the data.** Runs against the owner's own Appwrite backend —
  no vendor lock-in, no risk of a company shutting down and taking workout
  history with it.
- **Offline-first by design.** One internet connection needed to sign in once;
  everything after (logging sets, browsing routines, viewing history) works with
  zero connectivity — not a "cached for convenience" afterthought.
- **Split → Routine as a real reusable structure**, not a single flat weekly
  schedule. A Split (e.g. "Upper/Lower 4x") is a named, saveable container; a
  Routine (a day's exercises) is a library item reusable across days and across
  multiple Splits — built this session specifically because commercial apps
  couple routines 1:1 to a single calendar.

## Operating Context

- Used mid-workout, phone in hand or on a rack, often with sweaty hands / low
  attention for typing — one-handed thumb reach and large tap targets matter.
- Gym wifi/cell signal is unreliable; login is the one moment true connectivity
  is assumed, everything after is not.
- Distributed as an Android/iOS Capacitor build (self-signed APK) plus a web
  build; users self-host their own Appwrite project (endpoint/project id are
  environment config, not hardcoded).

## Capabilities and Constraints

- Auth: Appwrite email/password + optional OAuth (Google, when configured) —
  confirmed in `frontend/src/lib/backend/appwrite.js`.
- A `DEMO` build mode exists (static GitHub Pages deploy) with no backend —
  guest/local-only mode, seeded example data.
- No native admin panel currently exists in the app (a Node-backend admin
  dashboard existed pre-Appwrite-migration and was intentionally retired; project
  administration today happens through the Appwrite console).
- Spanish (`es`) is the default UI language (`DEF.lang` in `useStore.js`); i18n
  covers 11 locales.

## Brand Commitments

- Name: **openGym**. Icon: a dumbbell glyph used as the wordmark's visual anchor
  on the current login screen — not necessarily binding for a redesign, but a
  real existing brand touchpoint.
- Existing app-wide visual system already in code (see `frontend/src/index.css`):
  pure-black base (`--bg:#000`), iOS-grouped-list-style elevated surfaces, a
  configurable accent color (lime-green `--green` by default, with sky/orange/
  violet/pink/red/teal/gold alternates), SF Pro / system font stack, light theme
  variant also defined. This is an established world other surfaces (Home, Plan,
  Workout) already inherit — not invented for this task.

## Evidence on Hand

No real user testimonials, customer logos, or press exist (single-user personal
project) — none should be fabricated for any redesigned surface.

## Product Principles

1. Logging a set must survive zero connectivity and near-zero attention — never
   design an interaction that assumes a stable network or full focus.
2. Respect the existing dark/iOS-native/accent-color system already used across
   the app; a new surface should feel like the same product, not a bolt-on.
3. Prefer structure the user actually owns (self-hosted data, reusable Splits/
   Routines) over feature parity with subscription competitors.
4. Spanish-first copy; the UI must stay translatable (route text through `t()`).

## Accessibility & Inclusion

No project-specific accessibility requirement was established beyond standard
mobile touch-target and contrast practice; `:focus-visible` outlines and
`prefers-*` handling already exist in `index.css` as baseline.

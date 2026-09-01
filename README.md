<div align="center">

<img src="assets/banner.png" alt="openGym" width="720">

<br>

**A self-hosted gym & body-weight tracker you actually own.**

Plan your week, run guided workouts, track every set and your body weight over time —
on your phone, synced across devices, powered by Appwrite or standalone on your device.
No subscription, no ads, no telemetry.

<br>

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-a3e635?style=flat-square)](LICENSE)
![Self-hosted](https://img.shields.io/badge/self--hosted-%F0%9F%8F%A0-60a5fa?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-installable-a78bfa?style=flat-square)
![React](https://img.shields.io/badge/React-19-38bdf8?style=flat-square&logo=react&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![No tracking](https://img.shields.io/badge/telemetry-none-f472b6?style=flat-square)
<br>
![GitHub last commit](https://img.shields.io/github/last-commit/DuarteSantos8/openGym?style=flat-square)
[![GitHub stars](https://img.shields.io/github/stars/DuarteSantos8/openGym?style=flat-square)](https://github.com/DuarteSantos8/openGym/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/DuarteSantos8/openGym?style=flat-square)](https://github.com/DuarteSantos8/openGym/issues)

</div>

<br>

<div align="center">
<table>
<tr>
<td align="center"><img src="assets/screenshots/home.png" alt="Home" width="230"><br><sub><b>Home</b> — today's workout & weight</sub></td>
<td align="center"><img src="assets/screenshots/workout.png" alt="Workout" width="230"><br><sub><b>Guided workout</b> — animated demos & sets</sub></td>
<td align="center"><img src="assets/screenshots/stats.png" alt="Stats" width="230"><br><sub><b>Stats</b> — heatmap, charts & PRs</sub></td>
</tr>
</table>
</div>

<div align="center">

### [🌐 opengym.duarte-santos.ch](https://opengym.duarte-santos.ch) · [▶ Try the live demo](https://duartesantos8.github.io/openGym/)

No signup, nothing to install — it runs entirely in your browser on example data.<br>
<sub>There's no server behind the demo, so authentication and multi-device sync run on your own Appwrite instance or local storage.</sub>

</div>

## Why

Most workout apps lock your data behind a login on their servers, nag you to upgrade, or
disappear when the startup does. openGym is the opposite: **it runs on your box or device,
your data is strictly yours, and it's free and open source.** It still feels modern — installable
as a home-screen app, offline support with durable sync, native rest alarms, and multi-device sync.

## Features

- ⚖️ **Body-weight tracking** — interactive chart with a goal line you set, gains/losses colored by whether they move toward it
- 🏋️ **Weekly plan** — a routine per weekday, over a library of **1,324 exercises** (searchable, with animated demos)
- 🗓️ **Reschedule any day** — sick, missed a session, or fewer gym days this week? Move a workout to another day without touching your weekly plan
- ▶️ **Guided workouts** — it knows what day it is and starts today's session; asks your body weight first, pre-fills your weights from last time, rest timer, PR detection, per-exercise weight tracking
- ☀️ **The screen stays awake while you train** — no unlocking the phone and finding your place again between every set. On for as long as a workout is running, released the moment you finish it, and switchable off in Settings
- 🔗 **Supersets** — build them, and log them back-to-back with a rest only after the pair
- ⏱️ **Timed exercises** — planks, hangs, wall sits and loaded carries are logged by time, not reps, with a work timer that counts the set itself (separate from the rest timer) and logs the time you actually held. They can carry weight too
- 📈 **Progression that follows a rule** — pick one per routine, override it per exercise: linear, **Greyskull LP** (AMRAP top set, double jumps, 10 % resets), double progression through a rep range, or adding time. Your weights are already right when the session opens, and every target says *why* it's that number. Missed reps never advance the load, stalls trigger a deload, and bodyweight exercises progress in reps instead
- 💪 **Estimated 1RM** — per exercise, from your best eligible set (it names which one), with its own progress curve and a calculator for sets you haven't done. Won't guess above 12 reps
- 🎯 **Effort per set, in your scale** — an optional third column rating how hard a set was, as **RIR** (reps left in the tank) or **RPE** (the same judgement on a 10-point scale). Off by default; each set keeps the scale it was logged with, and nothing else reads the value — your progression and 1RM are unaffected
- 💪 **Bodyweight exercises, logged as bodyweight** — push-ups, pull-ups, dips and 300-odd others arrive knowing they carry no load, so there's no weight column and no working-weight prompt: one stepper, log the reps. Add a dip belt and it reads as an addition, and progression goes back to following the weight. Without one, reps climb — and past a ceiling you set, a set is added instead of a rep, up to the point where the honest advice is load or a harder variation
- ↔️ **Reps per side** — for lunges, single-arm rows and the rest. You log the total, the app shows the split ("8 per side"), and the target steps in twos so it never lands on a number one side can't have
- 🏃 **Cardio** — log time + speed, not just weight × reps
- 📤 **Share a plan** — send someone your routines and week schedule as a small file (no workouts, no weigh-ins), or print it as a clean PDF. Importing merges, so their plan is never overwritten
- 🔧 **Filter by equipment** — narrow the library to what you actually own; the options adapt to what you've picked, so every combination on screen has results behind it
- ✨ **Your own exercises** — a name and a body part is enough; they behave like built-in ones everywhere, with an optional description instead of an animation
- 🟩 **Activity heatmap** — a GitHub-style year view, shaded by time spent training
- 💪 **Muscle map** — a front-and-back body diagram shaded by how much work each muscle got, over a week, a month or all time. It names the muscles you *haven't* trained in that period, previews what a routine hits while you build it, and shows what you just trained when you finish. Male or female figure, your pick
- 🔔 **Native rest notifications & sticky workout card** — rest-timer alarms that fire with sound/vibration even when your phone is locked or WebView is suspended, plus lock-screen actions (`+15s`, `Skip rest`) and a silent persistent status card
- 🎨 **Designed, not assembled** — light/dark themes and 8 accent colors saved to your profile, over a hand-drawn icon set instead of emoji, so it looks the same on every phone
- 🌍 **12 languages** — full UI translation (EN, DE, ES, FR, IT, PT, PL, TR, RU, ZH, KO, HI); exercise instructions localized in 10 of them, loaded on demand so the app stays fast
- 📥 **Bring your history with you** — import from **FitNotes** (Android and iOS), **Strong** and **Hevy**, or body weight straight out of an **Apple Health** export. Exercise names are matched against the library and anything unrecognised becomes one of your own exercises, so nothing in the file is dropped
- 📦 **Yours to keep** — one-tap JSON export/import, guest mode, **no telemetry**
- 📱 **Standalone Android app** — the whole tracker as a sideloadable APK: works fully offline, durable sync queue against Appwrite, native workout reminders ([download](https://opengym.duarte-santos.ch))

## Quick start (self-host)

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/DuarteSantos8/openGym
cd openGym
cp .env.example .env
docker compose pull   # grab prebuilt web image (amd64 + arm64) — or build from source
docker compose up -d
```

Open **http://localhost:8080**, sign in or create an account, and you're in. To build the images locally instead of pulling from `ghcr.io`, run `docker compose up -d --build`.

For Appwrite configuration and backend setup, see **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**.

## Mobile app (Android APK)

The same codebase builds a **native Android app** (Capacitor) with offline storage, durable background sync, and OS-level alarms:

- **Android:** [**download the APK**](https://opengym.duarte-santos.ch) and sideload it — openGym is deliberately not on the Play Store. Or build it yourself: **[docs/MOBILE.md](docs/MOBILE.md)**.
- **iOS:** Add it to your home screen from Safari (it's a full PWA), or build the native app onto your own device from Xcode — see **[docs/MOBILE.md](docs/MOBILE.md)**.

## How it's built

- **frontend/** — React 19 + Vite (React Router + Zustand), with domain-isolated backend adapters under `src/lib/backend/`.
- **Appwrite Backend** — Appwrite Cloud / Self-hosted instance with TablesDB collections (`profiles`, `workouts`) and row-level document security.
- **Mobile (Android)** — Capacitor native build communicating with Appwrite, native local notification channels, and persistent offline sync queue.

## Your data

Workouts and profiles are stored in **Appwrite Databases / TablesDB** under `profiles` (settings, routines, plan, weigh-ins) and `workouts` (one immutable row per workout session). Row-level document security (`Permission.read/update/delete(Role.user(uid))`) guarantees that each user's data is strictly isolated.

## Configuration

All configured via `frontend/.env` (see `frontend/.env.example`):

| Variable | What it is | Example |
|---|---|---|
| `VITE_APPWRITE` | Enables Appwrite backend | `1` |
| `VITE_APPWRITE_ENDPOINT` | Regional Appwrite Cloud endpoint | `https://sfo.cloud.appwrite.io/v1` |
| `VITE_APPWRITE_PROJECT_ID` | Your Appwrite project ID | `6a904b0d003e4351232f` |
| `VITE_APPWRITE_DATABASE_ID` | Appwrite database ID | `opengym` |
| `VITE_APPWRITE_OAUTH_PROVIDER` | Optional OAuth provider | `google` |

## Tech

React 19 + Vite (React Router, Zustand) · Appwrite · nginx · Docker Compose ·
exercise data from [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset).
The frontend builds inside Docker, so self-hosting stays a one-command `docker compose up`.

The training logic — progression rules, 1RM estimation, how a logged session is read back —
lives in pure functions under `frontend/src/lib/` with tests next to them: `npm test` in
`frontend/`. Vitest is a dev dependency; the app itself ships no runtime dependencies beyond
React, the router, Zustand, and Appwrite SDK.

## Community

- **[Q&A](https://github.com/DuarteSantos8/openGym/discussions/categories/q-a)** — self-hosting help, Appwrite setup, "how do I…".
- **[Ideas](https://github.com/DuarteSantos8/openGym/discussions/categories/ideas)** — features worth talking through before anyone writes code.
- **[Show and tell](https://github.com/DuarteSantos8/openGym/discussions/categories/show-and-tell)** — your setup, your plan templates, whatever you built on top.
- **[Issues](https://github.com/DuarteSantos8/openGym/issues)** — bugs, and work that's already been agreed on.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues: more starter
plans, exercise-data languages, import from other trackers. **A ⭐ helps more people find it.**

openGym is free and stays free: AGPL, no subscription, no paid tier, nothing held back for
sponsors.

## License

[GNU AGPL v3.0](LICENSE) — free and open source.

Exercise images/GIFs are fetched from the upstream dataset and keep their own terms — see [NOTICE.md](NOTICE.md).

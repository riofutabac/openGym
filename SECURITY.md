# Security policy

openGym operates with Appwrite (Cloud or self-hosted) as its backend service. This document outlines the security model, vulnerability reporting process, and data isolation guarantees.

## Supported versions

Only the **latest release**. Releases are semver tags (`v1.0.0` → `v1.2.4`, see [CHANGELOG.md](CHANGELOG.md)); there is no LTS or maintenance branch and older tags are never patched.

Updating a self-hosted web instance:

```bash
git pull && docker compose pull && docker compose up -d
```

## Reporting a vulnerability

Use GitHub's private vulnerability reporting — repo **Security** tab → **Report a vulnerability**:

<https://github.com/DuarteSantos8/openGym/security/advisories/new>

Please do not disclose security issues publicly before they have been addressed.

## In scope

- **Frontend Security** — XSS in the React app, client storage handling, or anything that allows an unauthorized origin to manipulate user data or tokens.
- **Appwrite Integration Layer** — Permissions, repository queries, and row-level document security boundaries.
- **Shipped deployment config** — `docker-compose.yml`, `web/nginx.conf`, and `Dockerfile`.
- **The published image** `ghcr.io/duartesantos8/opengym-web`.

## Out of scope

- Anything assuming direct access to the underlying Appwrite server host or administrative API keys.
- **Missing rate limiting** on the static nginx web container — rate limiting should be configured on your external reverse proxy / gateway.
- Scanner warnings in build-time devDependencies (Vite, Vitest, Capacitor CLI) that do not reach runtime.
- The GitHub Pages demo build (`VITE_DEMO=1`) — runs completely client-side in memory/local storage without a backend.
- Third-party exercise dataset media.

## Security Model

### What it does

- **Appwrite Authentication & Session Management**:
  - Authentication uses Appwrite Auth (Email/Password or OAuth providers).
  - Sessions are managed via standard Appwrite security tokens and cookies.
- **Row-Level Document Security (RLS)**:
  - User profiles (`profiles` table) and workout sessions (`workouts` table) are protected with explicit Document Security permissions: `Permission.read/update/delete(Role.user(userId))`.
  - Table-level `create("users")` enables authenticated users to create rows they own.
  - Queries for another user's rows return `404 Not Found` (Appwrite prevents existence disclosure and access).
- **Offline Data Storage & Mobile Synchronization**:
  - Mobile APK stores offline records in private device storage with durable sync queue drained upon reconnection.
### Access Control & Operational Boundaries

- **Private & Invite-Only Instances**: Controlled via Appwrite User Limit policy (prohibiting open public signups) and operator scripts (`scripts/invite-user.mjs`) using Server API keys.
- **HTTPS Required for Web Deployments**: TLS termination is the reverse proxy's responsibility. Browsers require HTTPS for secure cookie handling and native APIs like Wake Lock.
- **Guest Mode Storage**: Guest mode stores data unencrypted in the browser's `localStorage` and is evicted if browser cache is cleared.

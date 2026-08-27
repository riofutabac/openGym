# Self-hosting openGym with Appwrite

openGym operates with **Appwrite Cloud** or a self-hosted Appwrite instance. The app uses Appwrite for authentication, user profiles, and granular per-session workout logs with row-level document security.

---

## 1. Appwrite Console Setup

In your Appwrite Cloud project (or self-hosted Appwrite):

### A. Database & Tables

Column types below are the ones the app is actually deployed with — they are not
interchangeable with the obvious alternatives:

- `ts`, `start` and `end` hold `Date.now()` values (~1.8e12), which **overflow a 32-bit
  integer**. They must be `bigint`.
- The JSON columns are `text` / `mediumtext`, not `string(N)`. A table's in-row size is
  capped at 65535 bytes, and a handful of large `string` columns exceeds it; `text` types
  are stored off-row (the deployed `profiles` table uses 1472 of 65535 bytes).
- Table-level `create("users")` is **required**. Row security governs read/update/delete of
  each row, but creating a row still needs table-level create permission — with empty table
  permissions no user can ever write anything.

1. Create a database with ID `opengym` (or choose your own and set `VITE_APPWRITE_DATABASE_ID`).

2. Create table **`profiles`** — row ID is the Appwrite user ID:

   | Column | Type | Required |
   |---|---|---|
   | `userId` | string(64) | yes |
   | `ts` | bigint | no |
   | `settings` | text | no |
   | `routines` | mediumtext | no |
   | `week` | text | no |
   | `dayPlan` | mediumtext | no |
   | `exWeights` | mediumtext | no |
   | `customEx` | mediumtext | no |
   | `bodyweight` | mediumtext | no |

   - **Row security**: enabled.
   - **Table permissions**: `create("users")` only.

3. Create table **`workouts`** — one row per training session, row ID is the client-generated
   session id:

   | Column | Type | Required |
   |---|---|---|
   | `userId` | string(64) | yes |
   | `d` | string(10) | yes |
   | `start` | bigint | no |
   | `end` | bigint | no |
   | `routineId` | string(64) | no |
   | `name` | string(200) | no |
   | `bw` | double | no |
   | `vol` | double | no |
   | `prs` | text | no |
   | `entries` | mediumtext | no |

   - Indexes: `userId_idx` (key, `userId` ASC) and `userId_d_idx` (key, `userId` ASC + `d` ASC).
   - **Row security**: enabled.
   - **Table permissions**: `create("users")` only.

Each row is written with `read`/`update`/`delete` permissions for its owner alone, so on a
shared instance one account cannot read another's rows. Verify this with a second account
before trusting it: reading another user's row must answer **401**, not an empty list.

### B. Authentication
- Under **Auth -> Settings**, ensure **Email/Password** is enabled.
- Set Session Lifetime to 1 year (`31536000` seconds).
- Configure OAuth providers (e.g. Google) if desired.

---

## 2. Frontend Configuration

Create `frontend/.env`:

```bash
VITE_APPWRITE=1
# Regional endpoint (e.g. sfo, fra, nyc):
VITE_APPWRITE_ENDPOINT=https://sfo.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id
VITE_APPWRITE_DATABASE_ID=opengym
# Optional OAuth provider:
# VITE_APPWRITE_OAUTH_PROVIDER=google
```

Build and run:

```bash
cd frontend
npm install
npm run build
```

---

## 3. Data Migration (from legacy db.json)

If you have existing workouts in `data/db.json` or `data/state-<uid>.json`:

```bash
node scripts/migrate-to-appwrite.mjs \
  --db data/db.json \
  --user <source-user-id> \
  --account <appwrite-user-id> \
  --endpoint https://<region>.cloud.appwrite.io/v1 \
  --project <project-id> \
  --key <server-api-key-with-databases-scope>
```

The script migrates the profile and all workout rows, re-reads data from Appwrite, and verifies that workout and bodyweight counts match before reporting success.

---

## 4. Storage Bucket Setup & Media Upload

Exercise animations (GIFs) are stored in Appwrite Storage, while static JPGs are bundled directly within the app.

### A. Create Bucket
In Appwrite Console:
1. Go to **Storage -> Create Bucket**.
2. **Bucket ID**: `exercises`
3. **Permissions**: Add `read("any")` (public read access so animations can load without session cookies).
4. **Max File Size**: 5 MB.
5. **Compression & Encryption**: Disabled (dataset contains pre-compressed binary media).

### B. Upload Media
Download the dataset and upload the files to your bucket:

```bash
# 1. Fetch media dataset locally if not already downloaded
./scripts/fetch-media.sh

# 2. Upload animations to Appwrite Storage bucket
node scripts/upload-media-to-appwrite.mjs \
  --endpoint https://<region>.cloud.appwrite.io/v1 \
  --project <project-id> \
  --key <server-api-key-with-files-write-scope> \
  --bucket exercises \
  --dir ./media/gif
```


# Self-hosting openGym with Appwrite

openGym operates with **Appwrite Cloud** or a self-hosted Appwrite instance. The app uses Appwrite for authentication, user profiles, and granular per-session workout logs with row-level document security.

---

## 1. Appwrite Console Setup

In your Appwrite Cloud project (or self-hosted Appwrite):

### A. Database & Tables

Column types below are the ones the app is actually deployed with:

- `ts`, `start` and `end` hold `Date.now()` values (~1.8e12), which **overflow a 32-bit integer**. They must be `bigint`.
- The JSON columns are `text` / `mediumtext`, not `string(N)`. A table's in-row size is capped at 65535 bytes, and a handful of large `string` columns exceeds it; `text` types are stored off-row.
- Table-level `create("users")` is **required**. Row security governs read/update/delete of each row, but creating a row still needs table-level create permission.

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

3. Create table **`workouts`** — one row per training session, row ID is the client-generated session id:

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

Each row is written with `read`/`update`/`delete` permissions for its owner alone, so on a shared instance one account cannot read another's rows (Appwrite answers `404 Not Found` for unauthorized row access).

### B. Authentication & Security
- Under **Auth -> Settings**, ensure **Email/Password** is enabled.
- Disable unused auth methods (`Phone`, `Magic URL`, `Email OTP`, `Anonymous`) to keep attack surface minimal.
- Set Session Lifetime to 1 year (`31536000` seconds).
- Configure OAuth providers (e.g. Google) if desired.
- Set **User Limit** to your current number of active users (closes open public registration while keeping login intact for existing members).

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

## 3. Storage Bucket Setup & Media Upload

Exercise animations (GIFs) are stored in Appwrite Storage, while static JPGs are bundled directly within the app.

### A. Create Bucket
In Appwrite Console:
1. Go to **Storage -> Create Bucket**.
2. **Bucket ID**: `exercises`
3. **Permissions**: Add `read("any")` (public read access so animations can load without session cookies).
4. **Max File Size**: 5 MB.
5. **Compression & Encryption**: Disabled.

### B. Upload Media
Download the dataset locally and upload the animation files to your bucket:

```bash
# 1. Fetch media dataset locally (downloads 1324 exercise animations)
./scripts/fetch-media.sh

# 2. Upload animations to Appwrite Storage bucket
node scripts/upload-media-to-appwrite.mjs \
  --endpoint https://<region>.cloud.appwrite.io/v1 \
  --project <project-id> \
  --key <server-api-key-with-files-write-scope> \
  --bucket exercises \
  --dir ./media/gif
```

---

## 4. Shared Instance & Access Control

### A. Closing Public Registration
In Appwrite Console -> **Auth -> Security**:
- Set **User Limit** equal to the current user count.
- Appwrite prohibits any new public signups (`user_count_exceeded`) while keeping all existing accounts active and able to sign in.

### B. Inviting a New User
Use the operator script with your Server API key (`users.write` scope):

```bash
node scripts/invite-user.mjs \
  --email friend@example.com \
  --name "Friend Name" \
  --key <api-key-with-users-write-scope> \
  --project <project-id> \
  --endpoint https://<region>.cloud.appwrite.io/v1
```

The script creates the account securely and outputs temporary credentials for the invited member.

**The user limit does not need to be raised first, and must not be.** A Server API key creates
users through the admin path, which bypasses the limit — verified against a live project whose
limit was already met. That has a useful consequence: after each invite the user count sits *above*
the limit, so public registration stays closed permanently with no further maintenance. Raising the
limit to make room would reopen public signup for as long as it stayed raised, which is exactly the
hole this section closes.

### C. Blocking / Unblocking a User
Block an account immediately (terminates sessions and denies login):

```bash
# Block user
node scripts/block-user.mjs --email friend@example.com --key <api-key>

# Unblock user
node scripts/block-user.mjs --email friend@example.com --unblock --key <api-key>
```

---

## 5. Legacy Data Migration (Optional)

If migrating from a legacy pre-Appwrite `db.json` database backup:

```bash
node scripts/migrate-to-appwrite.mjs \
  --db data/db.json \
  --user <source-user-id> \
  --account <appwrite-user-id> \
  --endpoint https://<region>.cloud.appwrite.io/v1 \
  --project <project-id> \
  --key <server-api-key-with-databases-scope>
```

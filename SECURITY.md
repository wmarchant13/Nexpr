# Security Policy

This document outlines the current security posture of the app, the Strava API
constraints it follows today, and the remaining gaps before a full production
security sign-off.

---

## 1. OAuth Refresh Tokens

### Storage

- Current implementation: access tokens and refresh tokens are stored in the
  `strava_sessions` table server-side.
- The browser only receives an opaque `HttpOnly` session cookie
  (`nexpr_strava_session`), so Strava OAuth tokens are never exposed to client
  JavaScript.

### Rotation

- On every Strava API call, check whether the access token has expired
  (`expires_at < Date.now() / 1000`).
- If expired, call `https://www.strava.com/api/v3/oauth/token` with
  `grant_type=refresh_token` to obtain a new pair **before** making the
  intended request.
- Current implementation persists refreshed values back to `strava_sessions`
  and clears the session cookie if refresh fails.

### Transmission

- All API calls to Strava use HTTPS. Never construct Strava API URLs over HTTP.
- The `Authorization: Bearer <token>` header is set server-side by TanStack
  Start server functions; tokens are not placed in URL query strings.

---

## 2. Data Privacy

### UUIDs in URLs

- User-facing URLs **must not** expose Strava numeric user IDs.
- Every internal record (athlete, activity, symptom entry) has a UUID primary
  key. URLs reference UUIDs only (e.g., `/activities/uuid-here`).

### Minimal data collection

- We store only the Strava data fields required for diagnostics
  (activity metrics, best efforts, athlete stats).
- Raw GPS streams are not persisted; they may be fetched transiently for
  in-session analysis and discarded.

---

## 3. Strava Deauthorisation — User Data Deletion

Per Strava API Agreement § Data Deletion: if a user revokes access, Strava data
must be deleted promptly. This app currently does **not** persist Strava
activity data in Neon; only app-authored data such as fueling, symptom, and
journal entries are stored in the database.

### Trigger

Strava sends a `DELETE` event to your webhook endpoint when a user deauthorises
the app via `POST /oauth/deauthorize`.

### Deletion scope

The following must be hard-deleted (not soft-deleted) within 24 hours:

| Table / Store            | Deletion method                       |
| ------------------------ | ------------------------------------- |
| `symptom_entries`        | DELETE WHERE athlete_uuid = ?         |
| `fueling_data`           | DELETE WHERE athlete_uuid = ?         |
| local caches (`nexpr_*`) | Cleared client-side on next page load |

### Implementation checklist

- [x] Webhook endpoint `POST /api/strava/webhook` validates `STRAVA_WEBHOOK_VERIFY_TOKEN` during the GET handshake.
- [x] A server-side deauthorization flow deletes app-authored records for the athlete.
- [x] Deletion is idempotent — safe to call multiple times for the same athlete or activity.
- [ ] A background job retries failed deletions with exponential back-off.
- [ ] Deletion completion is logged with a timestamp (no PII in logs).

---

## 4. Activity Deletion Webhook

Per Strava guidelines: if a user deletes an activity on Strava, it must be
removed from our system in real time.

### Event shape

```json
{
  "aspect_type": "delete",
  "object_type": "activity",
  "object_id": 1234567890,
  "owner_id": 9876543
}
```

### Handler logic

1. Receive `POST /api/strava/webhook`.
2. Validate the hub challenge (GET requests) using `STRAVA_WEBHOOK_VERIFY_TOKEN`.
3. For `aspect_type === "delete"` + `object_type === "activity"`:
  - Hard-delete any app-authored rows keyed to `(athlete_id, activity_id)`.
   - Return HTTP 200 immediately — Strava expects a response within 2 seconds.

---

## 5. Git & Environment Security

### .gitignore (enforced)

The following are excluded from version control:

```
.env
.env.local
.env.*.local
*.log
/dist
/.output
```

### Secret scanning

- Enable GitHub Secret Scanning on the repository to catch any accidental
  credential commits.
- Never commit real values to `.env.example` — use placeholder strings only.

### Dependency hygiene

- Run `bun audit` before each release.
- Pin major dependency versions in `package.json`.

---

## 6. OWASP Top 10 Controls

| Risk                          | Control                                                   |
| ----------------------------- | --------------------------------------------------------- |
| A01 Broken Access Control     | UUID-only URLs; server validates session on every request |
| A02 Cryptographic Failures    | Tokens stored server-side; HTTPS enforced                 |
| A03 Injection                 | Parameterised queries only via `@neondatabase/serverless` |
| A05 Security Misconfiguration | `.env` excluded from git; no debug output in production   |
| A07 Auth Failures             | Token rotation; `HttpOnly` session cookies                |
| A09 Logging Failures          | Deletion events logged; no PII in log lines               |

# Security Policy

This document outlines how Apex Performance Lab handles authentication tokens,
user data, and our obligations under the Strava API agreement (v2026).

---

## 1. OAuth Refresh Tokens

### Storage

- Access tokens and refresh tokens are **never stored in `localStorage` or
  `sessionStorage`** — both are accessible to any script on the page (XSS risk).
- Tokens are held **server-side only**, encrypted at rest in the Neon PostgreSQL
  database using AES-256-GCM via a `TOKEN_ENCRYPTION_KEY` env variable (not
  committed to source control, never in `.env.example`).
- The client receives a **short-lived session cookie** (`HttpOnly`, `Secure`,
  `SameSite=Lax`) that maps to the server-side token record.

### Rotation

- On every Strava API call, check whether the access token has expired
  (`expires_at < Date.now() / 1000`).
- If expired, call `https://www.strava.com/api/v3/oauth/token` with
  `grant_type=refresh_token` to obtain a new pair **before** making the
  intended request.
- Persist the new `access_token`, `refresh_token`, and `expires_at` to the
  database atomically (single UPDATE statement) to prevent race conditions on
  concurrent requests.

### Transmission

- All API calls to Strava use HTTPS. Never construct Strava API URLs over HTTP.
- The `Authorization: Bearer <token>` header is set server-side; tokens are
  never included in client-side fetch calls or URL query strings.

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

Per Strava API Agreement § Data Deletion: if a user revokes access, **all**
their data must be deleted promptly.

### Trigger

Strava sends a `DELETE` event to your webhook endpoint when a user deauthorises
the app via `POST /oauth/deauthorize`.

### Deletion scope

The following must be hard-deleted (not soft-deleted) within 24 hours:

| Table / Store            | Deletion method                       |
| ------------------------ | ------------------------------------- |
| `strava_tokens`          | DELETE WHERE athlete_uuid = ?         |
| `activities`             | DELETE WHERE athlete_uuid = ?         |
| `symptom_entries`        | DELETE WHERE athlete_uuid = ?         |
| `fueling_data`           | DELETE WHERE athlete_uuid = ?         |
| `best_efforts`           | DELETE WHERE athlete_uuid = ?         |
| localStorage (`nexpr_*`) | Cleared client-side on next page load |

### Implementation checklist

- [ ] Webhook endpoint `POST /api/webhooks/strava` validates `STRAVA_WEBHOOK_VERIFY_TOKEN`.
- [ ] A `DELETE /api/users/:uuid` internal route cascades deletes across all tables.
- [ ] Deletion is idempotent — safe to call multiple times for the same UUID.
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

1. Receive `POST /api/webhooks/strava`.
2. Validate the hub challenge (GET requests) using `STRAVA_WEBHOOK_VERIFY_TOKEN`.
3. For `aspect_type === "delete"` + `object_type === "activity"`:
   - Resolve the internal UUID from `strava_activity_id = object_id`.
   - Hard-delete the activity row and all child rows (symptom entries, fueling
     data, best efforts) in a single transaction.
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
| A02 Cryptographic Failures    | Tokens encrypted at rest; HTTPS enforced                  |
| A03 Injection                 | Parameterised queries only via `@neondatabase/serverless` |
| A05 Security Misconfiguration | `.env` excluded from git; no debug output in production   |
| A07 Auth Failures             | Token rotation; `HttpOnly` session cookies                |
| A09 Logging Failures          | Deletion events logged; no PII in log lines               |

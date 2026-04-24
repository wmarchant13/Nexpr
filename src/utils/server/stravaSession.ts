import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { firstRow, getDb, getRequiredEnv } from "./env";

const STRAVA_SESSION_COOKIE = "nexpr_strava_session";
const SESSION_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type StoredSessionRow = {
  id: string;
  athlete_id: number | string;
  access_token: string;
  refresh_token: string;
  expires_at: string | Date;
  granted_scope: string | null;
};

type SessionTokenPayload = {
  athleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  grantedScope?: string;
};

export type StravaSession = {
  id: string;
  athleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  grantedScope: string;
};

// Refresh In Flight
const refreshInFlight = new Map<string, Promise<StravaSession>>();

// Returns true if value is a valid UUID string
function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    ),
  );
}

// Returns Strava session cookie configuration
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

// Maps a DB row to a typed StravaSession object
function toSession(row: StoredSessionRow): StravaSession {
  return {
    id: row.id,
    athleteId: Number(row.athlete_id),
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt:
      row.expires_at instanceof Date
        ? row.expires_at
        : new Date(row.expires_at),
    grantedScope: row.granted_scope ?? "",
  };
}

// Writes refreshed token fields back to the DB
async function persistUpdatedTokens(
  sessionId: string,
  payload: SessionTokenPayload,
) {
  const db = getDb();
  const row = firstRow<StoredSessionRow>(
    await db`
    UPDATE strava_sessions
    SET access_token = ${payload.accessToken},
        refresh_token = ${payload.refreshToken},
        expires_at = ${new Date(payload.expiresAt * 1000)},
        granted_scope = ${payload.grantedScope ?? ""},
        updated_at = NOW()
    WHERE id = ${sessionId}
    RETURNING id, athlete_id, access_token, refresh_token, expires_at, granted_scope
  `,
  );

  if (!row) {
    throw new Error("Strava session no longer exists");
  }

  return toSession(row);
}

// Calls the Strava token-refresh endpoint and persists results
async function refreshStoredSession(
  session: StravaSession,
): Promise<StravaSession> {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getRequiredEnv("STRAVA_CLIENT_ID"),
      client_secret: getRequiredEnv("STRAVA_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      `Token refresh failed: ${error?.message || response.statusText}`,
    );
  }

  const result = await response.json();
  return persistUpdatedTokens(session.id, {
    athleteId: session.athleteId,
    accessToken: result.access_token ?? "",
    refreshToken: result.refresh_token ?? session.refreshToken,
    expiresAt: result.expires_at ?? 0,
    grantedScope: result.scope ?? session.grantedScope,
  });
}

// Inserts a new session row and sets the session cookie
export async function createStravaSession(payload: SessionTokenPayload) {
  const db = getDb();
  const row = firstRow<StoredSessionRow>(
    await db`
    INSERT INTO strava_sessions (
      athlete_id,
      access_token,
      refresh_token,
      expires_at,
      granted_scope
    )
    VALUES (
      ${payload.athleteId},
      ${payload.accessToken},
      ${payload.refreshToken},
      ${new Date(payload.expiresAt * 1000)},
      ${payload.grantedScope ?? ""}
    )
    RETURNING id, athlete_id, access_token, refresh_token, expires_at, granted_scope
  `,
  );

  if (!row) {
    throw new Error("Failed to create Strava session");
  }

  const session = toSession(row);
  setCookie(STRAVA_SESSION_COOKIE, session.id, cookieOptions());
  return session;
}

// Reads the current session from cookie and DB
export async function getCurrentStravaSession(): Promise<StravaSession | null> {
  const sessionId = getCookie(STRAVA_SESSION_COOKIE);
  if (!isUuid(sessionId)) {
    return null;
  }

  const db = getDb();
  const row = firstRow<StoredSessionRow>(
    await db`
    SELECT id, athlete_id, access_token, refresh_token, expires_at, granted_scope
    FROM strava_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `,
  );

  return row ? toSession(row) : null;
}

// Returns the current session or throws if unauthenticated
export async function requireCurrentStravaSession(): Promise<StravaSession> {
  const session = await getCurrentStravaSession();
  if (!session) {
    throw new Error("Not authenticated with Strava");
  }
  return session;
}

// Returns access token, refreshing it if near expiry
export async function requireStravaAccess(): Promise<{
  athleteId: number;
  accessToken: string;
  sessionId: string;
}> {
  const session = await requireCurrentStravaSession();
  const timeUntilExpiry = session.expiresAt.getTime() - Date.now();

  if (timeUntilExpiry > SESSION_REFRESH_WINDOW_MS) {
    return {
      athleteId: session.athleteId,
      accessToken: session.accessToken,
      sessionId: session.id,
    };
  }

  const existingRefresh = refreshInFlight.get(session.id);
  if (existingRefresh) {
    const refreshed = await existingRefresh;
    return {
      athleteId: refreshed.athleteId,
      accessToken: refreshed.accessToken,
      sessionId: refreshed.id,
    };
  }

  const refreshPromise = refreshStoredSession(session).finally(() => {
    refreshInFlight.delete(session.id);
  });

  refreshInFlight.set(session.id, refreshPromise);
  let refreshed: StravaSession;
  try {
    refreshed = await refreshPromise;
  } catch (error) {
    await clearCurrentStravaSession();
    throw error;
  }

  return {
    athleteId: refreshed.athleteId,
    accessToken: refreshed.accessToken,
    sessionId: refreshed.id,
  };
}

// Deletes the session cookie and removes the DB row
export async function clearCurrentStravaSession() {
  const sessionId = getCookie(STRAVA_SESSION_COOKIE);
  deleteCookie(STRAVA_SESSION_COOKIE, cookieOptions());

  if (!isUuid(sessionId)) {
    return;
  }

  const db = getDb();
  await db`DELETE FROM strava_sessions WHERE id = ${sessionId}`;
}

// Deletes all sessions for a given athlete
export async function clearStravaSessionsForAthlete(athleteId: number) {
  const db = getDb();
  await db`DELETE FROM strava_sessions WHERE athlete_id = ${athleteId}`;
}

// Removes all app data rows for an athlete
export async function deleteAthleteAppData(athleteId: number) {
  const db = getDb();
  await db`DELETE FROM fueling_entries WHERE athlete_id = ${athleteId}`;
  await db`DELETE FROM symptom_log WHERE athlete_id = ${athleteId}`;
  await db`DELETE FROM weekly_reflections WHERE athlete_id = ${athleteId}`;
  await db`DELETE FROM distance_goals WHERE athlete_id = ${athleteId}`;
  await clearStravaSessionsForAthlete(athleteId);
}

// Removes activity-level data rows for an athlete
export async function deleteAthleteActivityData(
  athleteId: number,
  activityId: number,
) {
  const db = getDb();
  await db`
    DELETE FROM fueling_entries
    WHERE athlete_id = ${athleteId} AND activity_id = ${activityId}
  `;
  await db`
    DELETE FROM symptom_log
    WHERE athlete_id = ${athleteId} AND activity_id = ${activityId}
  `;
}

// Marks all sessions for an athlete as updated so clients can detect webhook events.
export async function markAthleteWebhookHit(athleteId: number) {
  const db = getDb();
  await db`
    UPDATE strava_sessions
    SET updated_at = NOW()
    WHERE athlete_id = ${athleteId}
  `;
}

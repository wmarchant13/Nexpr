import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { getRequiredEnv } from "../utils/server/env";
import { requireString, requireUrlOrigin } from "../utils/server/validation";
import {
  clearCurrentStravaSession,
  createStravaSession,
  getCurrentStravaSession,
  requireCurrentStravaSession,
  deleteAthleteAppData,
} from "../utils/server/stravaSession";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_REQUESTED_SCOPE = "read,activity:read_all,profile:read_all";
const STRAVA_OAUTH_STATE_COOKIE = "nexpr_strava_oauth_state";

// Returns cookie config for the OAuth CSRF state token
function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  };
}

// Generates a random hex CSRF state string
function generateState(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

// Builds the Strava OAuth authorization URL
export const getStravaAuthUrl = createServerFn({ method: "GET" })
  .inputValidator((input: { origin: string }) => input)
  .handler(async ({ data }) => {
    const state = generateState();
    const origin = requireUrlOrigin(data.origin, "origin");
    const redirectUri = `${origin}/auth/strava/callback`;
    setCookie(STRAVA_OAUTH_STATE_COOKIE, state, oauthStateCookieOptions());
    const params = new URLSearchParams({
      client_id: getRequiredEnv("STRAVA_CLIENT_ID"),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: STRAVA_REQUESTED_SCOPE,
      state,
    });

    return {
      authUrl: `${STRAVA_AUTH_URL}?${params.toString()}`,
      state,
      redirectUri,
    };
  });

// Exchanges an OAuth code for access and refresh tokens
export const exchangeStravaCode = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; state?: string }) => input)
  .handler(async ({ data }) => {
    const code = requireString(data.code, "code", {
      minLength: 8,
      maxLength: 512,
    });
    const returnedState = requireString(data.state ?? "", "state", {
      minLength: 8,
      maxLength: 128,
    });
    const expectedState = getCookie(STRAVA_OAUTH_STATE_COOKIE);
    deleteCookie(STRAVA_OAUTH_STATE_COOKIE, oauthStateCookieOptions());

    if (!expectedState || expectedState !== returnedState) {
      throw new Error(
        "OAuth state mismatch. Please try connecting Strava again.",
      );
    }

    const params = new URLSearchParams({
      client_id: getRequiredEnv("STRAVA_CLIENT_ID"),
      client_secret: getRequiredEnv("STRAVA_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
    });

    const response = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const message = error?.message || response.statusText;
      throw new Error(`OAuth token exchange failed: ${message}`);
    }

    const result = await response.json();

    const athleteId = Number(result?.athlete?.id ?? 0);
    if (!Number.isFinite(athleteId) || athleteId <= 0) {
      throw new Error("OAuth token exchange failed: missing athlete identity");
    }

    await createStravaSession({
      athleteId,
      accessToken: result.access_token ?? result.accessToken ?? "",
      refreshToken: result.refresh_token ?? result.refreshToken ?? "",
      expiresAt: result.expires_at ?? result.expiresAt ?? 0,
      grantedScope: result.scope ?? "",
    });

    return {
      athlete: result.athlete ?? null,
      grantedScope: result.scope ?? "",
      expiresAt: result.expires_at ?? result.expiresAt ?? 0,
    };
  });

// Returns the current authentication status
export const getViewerSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getCurrentStravaSession();
    if (!session) {
      return { authenticated: false as const, athleteId: null };
    }

    return {
      authenticated: true as const,
      athleteId: session.athleteId,
    };
  },
);

// Clears the current Strava session
export const logoutStravaSession = createServerFn({ method: "POST" }).handler(
  async () => {
    await clearCurrentStravaSession();
    return { ok: true as const };
  },
);

// Deletes all app data for the signed-in athlete and clears current session
export const deleteMyAppData = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await requireCurrentStravaSession();
    await deleteAthleteAppData(session.athleteId);
    await clearCurrentStravaSession();
    return { ok: true as const };
  },
);

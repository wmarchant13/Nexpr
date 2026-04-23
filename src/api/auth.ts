import { createServerFn } from "@tanstack/react-start";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_REQUESTED_SCOPE = "read,activity:read_all,profile:read_all";

function generateState(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export const getStravaAuthUrl = createServerFn({ method: "GET" })
  .inputValidator((input: { origin: string }) => input)
  .handler(async ({ data }) => {
    const state = generateState();
    // Use the origin passed from the client so the redirect URI always matches
    // the actual port the dev/prod server is running on, regardless of env vars.
    const redirectUri = `${data.origin}/auth/strava/callback`;
    const params = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: STRAVA_REQUESTED_SCOPE,
      state: state,
    });

    return {
      authUrl: `${STRAVA_AUTH_URL}?${params.toString()}`,
      state,
      redirectUri,
    };
  });

export const exchangeStravaCode = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data }) => {
    const code = data.code;
    if (!code) {
      throw new Error("Authorization code not found");
    }

    try {
      const params = new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID || "",
        client_secret: process.env.STRAVA_CLIENT_SECRET || "",
        code: code,
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
        const error = await response.json();
        throw new Error(`OAuth token exchange failed: ${error.message}`);
      }

      const result = await response.json();

      return {
        ...result,
        accessToken: result.accessToken ?? result.access_token ?? "",
        refreshToken: result.refreshToken ?? result.refresh_token ?? "",
        grantedScope: result.scope ?? "",
        // Unix timestamp (seconds) when the access token expires
        expiresAt: result.expires_at ?? result.expiresAt ?? 0,
      };
    } catch (error) {
      console.error("Token exchange error:", error);
      throw error;
    }
  });

export const refreshStravaToken = createServerFn({ method: "POST" })
  .inputValidator((input: { refreshToken: string }) => input)
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID || "",
      client_secret: process.env.STRAVA_CLIENT_SECRET || "",
      refresh_token: data.refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.message}`);
    }

    const result = await response.json();
    return {
      accessToken: result.access_token ?? "",
      refreshToken: result.refresh_token ?? "",
      expiresAt: result.expires_at ?? 0,
    };
  });

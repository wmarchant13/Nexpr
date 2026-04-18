import { createServerFn } from "@tanstack/react-start";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

function generateState(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export const getStravaAuthUrl = createServerFn({ method: "GET" }).handler(
  async () => {
    const state = generateState();
    const params = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID || "",
      redirect_uri:
        process.env.STRAVA_REDIRECT_URI ||
        "http://localhost:3000/auth/strava/callback",
      response_type: "code",
      scope: "activity:read_all,profile:read_all",
      state: state,
    });

    return {
      authUrl: `${STRAVA_AUTH_URL}?${params.toString()}`,
      state,
    };
  },
);

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
      };
    } catch (error) {
      console.error("Token exchange error:", error);
      throw error;
    }
  });

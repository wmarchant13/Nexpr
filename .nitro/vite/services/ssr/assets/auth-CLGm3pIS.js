import { c as createServerRpc } from "./createServerRpc-B7qvQyGJ.js";
import { _ as createServerFn } from "../server.js";
import "node:async_hooks";
import "node:stream";
import "node:stream/web";
import "util";
import "crypto";
import "async_hooks";
import "stream";
const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
function generateState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
const getStravaAuthUrl_createServerFn_handler = createServerRpc({
  id: "57e57f9ad3a052abb4ff80e36000664d4271aaf52959c15686bf6cd3dd155e55",
  name: "getStravaAuthUrl",
  filename: "src/api/auth.ts"
}, (opts) => getStravaAuthUrl.__executeServer(opts));
const getStravaAuthUrl = createServerFn({
  method: "GET"
}).handler(getStravaAuthUrl_createServerFn_handler, async () => {
  const state = generateState();
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID || "",
    redirect_uri: process.env.STRAVA_REDIRECT_URI || "http://localhost:3000/auth/strava/callback",
    response_type: "code",
    scope: "activity:read_all,profile:read_all",
    state
  });
  return {
    authUrl: `${STRAVA_AUTH_URL}?${params.toString()}`,
    state
  };
});
const exchangeStravaCode_createServerFn_handler = createServerRpc({
  id: "fa770a19229d28f852abdf85c9ce2b503e8a91dbf68339ba2dd4cc0f8e9e2688",
  name: "exchangeStravaCode",
  filename: "src/api/auth.ts"
}, (opts) => exchangeStravaCode.__executeServer(opts));
const exchangeStravaCode = createServerFn({
  method: "POST"
}).inputValidator((input) => input).handler(exchangeStravaCode_createServerFn_handler, async ({
  data
}) => {
  const code = data.code;
  if (!code) {
    throw new Error("Authorization code not found");
  }
  try {
    const params = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID || "",
      client_secret: process.env.STRAVA_CLIENT_SECRET || "",
      code,
      grant_type: "authorization_code"
    });
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OAuth token exchange failed: ${error.message}`);
    }
    const result = await response.json();
    return {
      ...result,
      accessToken: result.accessToken ?? result.access_token ?? "",
      refreshToken: result.refreshToken ?? result.refresh_token ?? ""
    };
  } catch (error) {
    console.error("Token exchange error:", error);
    throw error;
  }
});
const refreshStravaToken_createServerFn_handler = createServerRpc({
  id: "9d83f4c10be9a0051dbe5803dfbe0bf8a9ef204b527c9a88ad31cc0928670431",
  name: "refreshStravaToken",
  filename: "src/api/auth.ts"
}, (opts) => refreshStravaToken.__executeServer(opts));
const refreshStravaToken = createServerFn({
  method: "POST"
}).inputValidator((input) => input).handler(refreshStravaToken_createServerFn_handler, async ({
  data
}) => {
  const refreshToken = data.refreshToken;
  try {
    const params = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID || "",
      client_secret: process.env.STRAVA_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    });
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    if (!response.ok) {
      throw new Error("Failed to refresh access token");
    }
    return response.json();
  } catch (error) {
    console.error("Token refresh error:", error);
    throw error;
  }
});
export {
  exchangeStravaCode_createServerFn_handler,
  getStravaAuthUrl_createServerFn_handler,
  refreshStravaToken_createServerFn_handler
};

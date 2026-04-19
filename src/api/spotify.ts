// import { createServerFn } from "@tanstack/react-start";

// const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
// const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

// export const getSpotifyAuthUrl = createServerFn({ method: "GET" }).handler(
//   async () => {
//     const params = new URLSearchParams({
//       client_id: process.env.SPOTIFY_CLIENT_ID || "",
//       response_type: "code",
//       redirect_uri:
//         process.env.SPOTIFY_REDIRECT_URI ||
//         "http://localhost:3000/auth/spotify/callback",
//       scope: "user-read-recently-played",
//       show_dialog: "true",
//     });

//     return {
//       authUrl: `${SPOTIFY_AUTH_URL}?${params.toString()}`,
//     };
//   },
// );

// export const exchangeSpotifyCode = createServerFn({ method: "POST" })
//   .inputValidator((input: { code: string }) => input)
//   .handler(async ({ data }) => {
//     const code = data.code;
//     if (!code) throw new Error("Authorization code not found");

//     const params = new URLSearchParams({
//       grant_type: "authorization_code",
//       code,
//       redirect_uri: process.env.SPOTIFY_REDIRECT_URI || "",
//       client_id: process.env.SPOTIFY_CLIENT_ID || "",
//       client_secret: process.env.SPOTIFY_CLIENT_SECRET || "",
//     });

//     const response = await fetch(SPOTIFY_TOKEN_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       body: params.toString(),
//     });

//     if (!response.ok) {
//       const err = await response.text();
//       throw new Error(`Spotify token exchange failed: ${err}`);
//     }

//     return response.json();
//   });

// export const getRecentlyPlayed = createServerFn({ method: "GET" })
//   .inputValidator((input: { accessToken: string; after?: number; before?: number; limit?: number }) => input)
//   .handler(async ({ data }) => {
//     const { accessToken, after, before, limit = 50 } = data;
//     const url = new URL("https://api.spotify.com/v1/me/player/recently-played");
//     if (after) url.searchParams.set("after", String(after));
//     if (before) url.searchParams.set("before", String(before));
//     url.searchParams.set("limit", String(limit));

//     const res = await fetch(url.toString(), {
//       headers: { Authorization: `Bearer ${accessToken}` },
//     });

//     if (!res.ok) {
//       const err = await res.text();
//       throw new Error(`Spotify API error: ${err}`);
//     }

//     return res.json();
//   });

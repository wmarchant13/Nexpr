// import { createFileRoute } from "@tanstack/react-router";
// import React, { useEffect } from "react";
// import { useNavigate, useSearch } from "@tanstack/react-router";
// import { useSpotifyCallback } from "../hooks";

// interface CallbackSearch {
//   code?: string;
//   state?: string;
//   error?: string;
//   error_description?: string;
// }

// function SpotifyCallbackPage() {
//   const navigate = useNavigate();
//   const search = useSearch({ from: "/auth/spotify/callback" }) as CallbackSearch;
//   const [status, setStatus] = React.useState<"loading" | "success" | "error">("loading");
//   const [errorMsg, setErrorMsg] = React.useState<string>("");

//   const callbackMutation = useSpotifyCallback(search.code || "");

//   useEffect(() => {
//     if (search.error) {
//       setStatus("error");
//       setErrorMsg(search.error_description || search.error);
//       return;
//     }

//     if (search.code) {
//       setStatus("loading");
//       callbackMutation.mutate(undefined, {
//         onSuccess: () => {
//           setStatus("success");
//           setTimeout(() => {
//             navigate({ to: "/dashboard" });
//           }, 1000);
//         },
//         onError: (error: any) => {
//           setStatus("error");
//           setErrorMsg(error.message || "Authentication failed");
//         },
//       });
//     }
//   }, [search.code, search.error, callbackMutation, navigate]);

//   if (status === "error") {
//     return (
//       <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#0b1120 0%, #0f172a 100%)' }}>
//         <div style={{ background: '#111827', padding: 24, borderRadius: 12 }}>
//           <h1 style={{ color: '#f87171' }}>Spotify Authentication Failed</h1>
//           <p style={{ color: '#e5e7eb' }}>{errorMsg}</p>
//           <a href="/" style={{ color: '#93c5fd' }}>Back to app</a>
//         </div>
//       </div>
//     );
//   }

//   if (status === "success") {
//     return (
//       <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#0b1120 0%, #0f172a 100%)' }}>
//         <div style={{ background: '#0f172a', padding: 24, borderRadius: 12 }}>
//           <h1 style={{ color: '#34d399' }}>Spotify Connected</h1>
//           <p style={{ color: '#d1d5db' }}>You can now see tracks for your activities.</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#0b1120 0%, #0f172a 100%)' }}>
//       <div style={{ background: '#0b1220', padding: 24, borderRadius: 12 }}>
//         <p style={{ color: '#d1d5db' }}>Connecting Spotify…</p>
//       </div>
//     </div>
//   );
// }

// export const Route = createFileRoute("/auth/spotify/callback")({
//   component: SpotifyCallbackPage,
// });

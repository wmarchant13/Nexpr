/// <reference types="vite/client" />
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import * as React from "react";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Secund.io - Strava Activity Tracker",
      },
      {
        name: "description",
        content: "Track and visualize your Strava activities with Secund.io",
      },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap",
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style>{`
          /* Design tokens: editorial + performance-focused */
          :root {
            --font-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
            --font-display: "Space Grotesk", "Space Grotesk", Georgia, 'Times New Roman', serif;

            /* Colors */
            --bg-900: #050607; /* primary dark */
            --bg-800: #0b0d10;
            --fg-100: #f7f7f5; /* off-white */
            --muted: #9aa3b2;
            --accent: #7dd3a6; /* muted green accent */
            --accent-amber: #f59e0b;

            /* Spacing scale */
            --space-xs: 0.25rem;
            --space-sm: 0.5rem;
            --space-md: 1rem;
            --space-lg: 1.5rem;
            --space-xl: 2.5rem;

            --radius-lg: 1rem;

            /* Typographic scale */
            --h1: 2.6rem;
            --h2: 1.6rem;
            --stat-size: 2.8rem;
          }

          /* Dark mode only — no light-mode overrides included */

          *, *::before, *::after { box-sizing: border-box; }

          html, body, #root { min-height: 100%; height: 100%; }

          html { background: var(--bg-900); }

          body {
            margin: 0;
            background: linear-gradient(180deg, var(--bg-900) 0%, var(--bg-800) 100%);
            color: var(--fg-100);
            font-family: var(--font-body);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            line-height: 1.4;
          }

          h1, h2, h3 { font-family: var(--font-display); margin: 0; }

          a { color: inherit; text-decoration: none; }

          /* Utility: large stat display */
          .stat-large { font-size: var(--stat-size); font-weight: 800; letter-spacing: -0.02em; }

          /* Reduced motion preference respects subtle motion only */
          @media (prefers-reduced-motion: reduce) {
            * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
          }
        `}</style>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

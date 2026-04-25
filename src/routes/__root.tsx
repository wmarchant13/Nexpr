
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
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
        title: "Nexpr - Unlock Your Next PR",
      },
      {
        name: "description",
        content:
          "Data-driven running performance platform. Train smarter, race faster, unlock your next personal record.",
      },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: RootNotFound,
  shellComponent: RootDocument,
});

// 404 page shown when no route matches
function RootNotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "3rem 1.5rem",
      }}
    >
      <div
        style={{
          width: "min(100%, 33.75rem)",
          border: "0.0625rem solid var(--border)",
          background: "var(--bg-subtle)",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--fg-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Page Not Found
        </p>
        <h1 style={{ margin: "0.75rem 0 0", fontSize: "clamp(2rem, 6vw, 3.5rem)" }}>
          Nothing lives here.
        </h1>
        <p style={{ margin: "1rem 0 0", color: "var(--fg-secondary)" }}>
          The route you requested does not exist anymore or was moved during the recent app
          cleanup.
        </p>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            marginTop: "1.5rem",
            padding: "0.75rem 1.125rem",
            border: "0.0625rem solid var(--border-strong)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono)",
          }}
        >
          Return Home
        </Link>
      </div>
    </main>
  );
}

// Root HTML document shell with global CSS variables
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style>{`
          :root {
            /* ── Typefaces ── */
            --font-serif: 'DM Serif Display', Georgia, 'Times New Roman', serif;
            --font-body-serif: 'Playfair Display', Georgia, 'Times New Roman', serif;
            --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            --font-mono: 'IBM Plex Mono', 'Courier New', monospace;

            /* ── Dark palette — black base, white text ── */
            --bg:          #0A0A0A;
            --bg-subtle:   #111111;
            --bg-muted:    #1A1A1A;
            --bg-raised:   #1C1C1C;

            /* Surface aliases */
            --cream:  #0A0A0A;
            --paper:  #111111;
            --ink:    #FFFFFF;

            /* White-based opacity tiers */
            --ink-80:  rgba(255,255,255,0.80);
            --ink-60:  rgba(255,255,255,0.60);
            --ink-40:  rgba(255,255,255,0.40);
            --ink-15:  rgba(255,255,255,0.15);

            /* ── Brand accents ── */
            --accent:       #FFFFFF;
            --accent-hover: #D6D6D6;
            --accent-10:    rgba(255,255,255,0.12);
            --ochre:        #C4A668;
            --ochre-bg:     rgba(196,166,104,0.12);
            --forest:       #2D3B2D;
            --stamp:        #FFFFFF;

            /* ── Borders — white at low opacity ── */
            --border:        rgba(255,255,255,0.14);
            --border-strong: rgba(255,255,255,0.28);

            /* ── Semantic ── */
            --success:       #4ABA8A;
            --success-bg:    rgba(74,186,138,0.10);
            --success-subtle:rgba(74,186,138,0.10);
            --success-fg:    #4ABA8A;
            --warning:       #C4A668;
            --warning-bg:    rgba(196,166,104,0.10);
            --warning-subtle:rgba(196,166,104,0.10);
            --danger:        #E2E2E2;
            --danger-bg:     rgba(255,255,255,0.10);
            --danger-subtle: rgba(255,255,255,0.10);

            /* ── Radius ── */
            --radius-sm: 0.125rem;
            --radius:    0.1875rem;
            --radius-md: 0.25rem;
            --radius-lg: 0.25rem;

            /* ── Layout ── */
            --header-h: 3.75rem;
            --max-w:    80rem;
            --page-px:  3rem;
            --page-py:  4.5rem;

            /* ── Legacy aliases ── */
            --fg:          #FFFFFF;
            --fg-muted:    rgba(255,255,255,0.55);
            --fg-secondary:rgba(255,255,255,0.70);
            --fg-subtle:   rgba(255,255,255,0.38);
            --font-body:   'Inter', -apple-system, sans-serif;
            --font-display:'DM Serif Display', Georgia, serif;
            --bg-900:      #0A0A0A;
            --bg-800:      #111111;
            --fg-100:      #FFFFFF;
            --muted:       rgba(255,255,255,0.55);
            --shadow-sm:   none;
            --shadow:      none;
            --accent-subtle: rgba(255,255,255,0.12);
            --accent-fg:   #000000;
            --white:       #FFFFFF;
          }

          *, *::before, *::after { box-sizing: border-box; }

          html, body, #root { min-height: 100%; }

          html { background: #0A0A0A; }

          body {
            margin: 0;
            background: #0A0A0A;
            color: #FFFFFF;
            font-family: var(--font-sans);
            font-size: 0.9375rem;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          /* Grain texture overlay */
          body::after {
            content: '';
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 9999;
            opacity: 0.04;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E");
            background-repeat: repeat;
            background-size: 18.75rem 18.75rem;
          }

          h1, h2, h3, h4 {
            font-family: var(--font-serif);
            font-weight: 400;
            letter-spacing: -0.01em;
            margin: 0;
            color: #FFFFFF;
            line-height: 1.1;
          }

          a { color: inherit; text-decoration: none; }

          /* Crosshair cursor on all interactive elements */
          a, button, [role="button"], input, select, label[for] {
            cursor: crosshair;
          }

          /* Scroll fade-up animation classes */
          .fade-up {
            opacity: 0;
            transform: translateY(0.75rem);
            transition: opacity 500ms ease-out, transform 500ms ease-out;
          }
          .fade-up-slow {
            opacity: 0;
            transform: translateY(0.75rem);
            transition: opacity 800ms ease-out, transform 800ms ease-out;
          }
          .fade-up.in-view,
          .fade-up-slow.in-view {
            opacity: 1;
            transform: translateY(0);
          }

          @media (prefers-reduced-motion: reduce) {
            * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
            .fade-up, .fade-up-slow { opacity: 1; transform: none; }
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

// Root route component wrapping the app with QueryClient
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

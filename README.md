# Nexpr

Data-driven running performance platform. Connect your Strava account to track pace trends, predict PRs, log fueling, and make smarter training decisions.

> Independent app — not affiliated with or endorsed by Strava.

## Features

| Page | What it does |
|---|---|
| **Log** | Recent runs with effort classification (easy/moderate/hard), weather, and weekly mileage |
| **Miles** | Full activity list with per-run fueling log and mechanical stress tracker |
| **Breakdown** | Fitness metrics, VDOT score, race predictions, injury risk analysis |
| **Goals** | Distance goal tracking with projected completion times via the Oracle engine |
| **Journal** | Weekly reflection notes tied to training blocks |
| **Kit** | VDOT calculator and Marathon Diagnostics tools |

**Oracle** — goal-race probability engine. Enter a target time and get a probability score plus the specific training levers that move the needle most.

**Fueling Analysis** — log carbs, hydration, and caffeine per run to surface correlations between nutrition and performance over time.

**Mechanical Stress Log** — track recurring pain points per activity to detect structural alert patterns before they become injuries.

## Stack

- [TanStack Start](https://tanstack.com/start) — React SSR + server functions
- [TanStack Router](https://tanstack.com/router) — file-based routing
- [Neon Postgres](https://neon.tech) — serverless database (sessions, goals, symptom log, reflections)
- [Strava API](https://developers.strava.com) — activity data source
- [OpenWeatherMap API](https://openweathermap.org/api) — current conditions
- Vite · Bun · TypeScript · SCSS Modules · Recharts

## Local Development

```bash
# 1. Install
bun install

# 2. Configure
cp .env.example .env
# Fill in all values — see Environment Variables below

# 3. Init the database
bun run scripts/init-db.ts

# 4. Start
bun dev
```

## Environment Variables

| Variable | Description | How to get it |
|---|---|---|
| `DATABASE_URL` | Neon Postgres connection string | [console.neon.tech](https://console.neon.tech) |
| `STRAVA_CLIENT_ID` | Strava OAuth app client ID | [strava.com/settings/api](https://www.strava.com/settings/api) |
| `STRAVA_CLIENT_SECRET` | Strava OAuth app client secret | same as above |
| `STRAVA_REDIRECT_URI` | OAuth callback URL | `https://yourdomain.com/auth/strava/callback` |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Random token for webhook registration | `openssl rand -hex 32` |
| `SESSION_SECRET` | Secret for signing session cookies | `openssl rand -hex 32` |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key | [openweathermap.org](https://openweathermap.org/api) |

## Deploy to Vercel

1. Import this repository into [Vercel](https://vercel.com)
2. Set all environment variables from the table above in the Vercel dashboard
3. Add `NITRO_PRESET=vercel` as a Vercel environment variable (enables Nitro's Vercel output format)
4. Vercel will use `vercel.json` automatically — no other config needed

The build outputs to `.vercel/output/` (Vercel Build Output API format).

## Strava Webhook Setup

Register the webhook once after deploying:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=YOUR_CLIENT_ID \
  -F client_secret=YOUR_CLIENT_SECRET \
  -F callback_url=https://yourdomain.com/api/strava/webhook \
  -F verify_token=YOUR_STRAVA_WEBHOOK_VERIFY_TOKEN
```

The webhook handles `athlete.deauthorize` events to delete app data on disconnect.

## Rate Limiting

Page and API requests are limited to **300/minute per IP**. Auth endpoints (`/auth/*`) use a stricter **20/minute** limit. Internal server function RPCs (`/_server/*`) and static assets are excluded from rate limiting — they are already protected by session authentication. Responses include `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers.

## Security

- Session cookies are `httpOnly`, `sameSite=lax`, and `secure` in production
- All server function inputs are validated at the boundary (`src/utils/server/validation.ts`)
- Bot traffic is blocked at the middleware layer via `isbot`
- Secrets are read exclusively from environment variables — nothing is hardcoded


## Features

### 🎯 PR Prediction Engine
- Predicts potential finish times for 5K, 10K, Half Marathon, and Marathon
- Calculates probability of beating your current PR
- Shows readiness score and days to optimal form

### 📊 Momentum & Readiness Tracking
- **Momentum**: Rolling training volume indicator
- **Freshness**: Recent training intensity indicator  
- **Readiness**: Race potential score
- Trend analysis: building, maintaining, recovering, or declining

*Note: These are Nexpr-specific metrics, not industry-standard calculations.*

### 💡 Smart Recommendations
- Daily training suggestions based on your current form
- Intensity guidance: push, maintain, easy, or recover
- Suggested mileage and target pace

### 📱 Dedicated Views
- **Dashboard**: Overview of key metrics and recent activity
- **Activities**: Full activity log with search, filter, and sort
- **Insights**: Deep training analysis and PR predictions
- **Goals**: Track progress toward targets and view PRs
- **Profile**: Account settings and lifetime stats

## Architecture

### Tech Stack
- **Frontend**: React 19, TanStack Router, TanStack Query
- **Backend**: Nitro server functions (serverless)
- **Styling**: SCSS Modules with design tokens
- **Charts**: Recharts for data visualization

### Data Layer
```
src/
├── store/
│   ├── cache.ts      # Local caching system
│   └── predictions.ts # PR prediction engine
├── hooks/
│   └── index.ts      # React Query hooks with caching
└── api/
    ├── auth.ts       # OAuth flow
    └── strava.ts     # Strava API proxy
```

### API Optimization

Nexpr aggressively minimizes Strava API calls:

1. **Local Caching**: Activities cached for 15 min, athlete for 1 hour, stats for 30 min
2. **React Query staleTime**: Prevents refetching fresh data
3. **Derived Metrics**: All analytics computed from cached data—no additional API calls
4. **Batch Fetching**: Single request for 200 activities covers most use cases
5. **Server-side request dedupe**: Strava requests are deduplicated in-flight with short TTL caching to avoid duplicate bursts

## Production Notes

- Strava requests flow through a shared server client with rate-limit awareness and short-lived caching.
- OAuth callback verifies `state` before exchanging the authorization code.
- Server functions validate input before hitting Neon or third-party APIs.
- User-authored app data is stored in Neon; Strava activity data is not persisted to Neon.

### Route Structure
```
/                    # Login page
/_app/              # Authenticated layout (tabs)
  /dashboard        # Main dashboard
  /activities       # Activity list
  /insights         # Training analysis
  /goals            # Goal tracking
  /profile          # User profile
```

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- Strava API credentials

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```

3. Create `.env` file:
   ```env
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   DATABASE_URL=postgresql://...
   STRAVA_WEBHOOK_VERIFY_TOKEN=optional_if_using_webhooks
   OPENWEATHER_API_KEY=optional_openweather_key
   ```

   The OAuth callback URL is derived from the current app origin, so on Vercel
   you only need to register `https://your-domain/auth/strava/callback` in the
   Strava dashboard. No code change is needed when moving from localhost to
   production.

4. Start development server:
   ```bash
   bun run dev
   ```

## Design Philosophy

### Performance-First
- Every feature justified by user value
- Aggressive caching to minimize API usage
- Lazy loading and memoization throughout

### Premium Aesthetic
- Dark mode with editorial typography
- Subtle gradients and micro-interactions
- Information hierarchy for quick scanning

### Actionable Insights
- Data presented as recommendations, not just numbers
- Clear next steps for improvement
- Progress toward specific goals

## Key Metrics Explained

| Metric | Description | Range |
|--------|-------------|-------|
| Momentum | Rolling training volume (~42 day average) | Higher = more consistent |
| Freshness | Recent training intensity (~7 day average) | Higher = more recent effort |
| Readiness | Momentum - Freshness; race potential indicator | +15 to +25 = peak readiness |
| Ramp Rate | Weekly change in momentum | >5% = building |

*Note: These are Nexpr-specific metrics calculated from your activity data. They are not the same as any other platform's calculations.*

## License

MIT

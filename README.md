# Nexpr

**Unlock your next PR** — A data-driven running performance platform.

## Overview

Nexpr transforms your activity data into actionable training insights. Using advanced analytics, it tracks your training momentum, predicts your race potential, and provides daily recommendations to help you reach your next personal record.

*Uses Strava activity data. Nexpr is an independent app and is not affiliated with or endorsed by Strava.*

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
   STRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback
   ```

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

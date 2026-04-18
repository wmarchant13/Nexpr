# Secund.io

A Strava activity dashboard built with TanStack Start, React, TanStack Query, and Sass modules.

## What It Does

- Authenticates with Strava using OAuth
- Exchanges the authorization code with TanStack Start server functions
- Stores the returned Strava token in `localStorage`
- Loads athlete profile and recent activities into a dashboard
- Renders charts and activity summaries in a responsive UI

## Stack

- TanStack Start
- React 19
- TanStack Router
- TanStack Query
- Vite
- Sass modules
- Bun for package management and local development

## Prerequisites

- Bun
- A Strava developer app

## Setup

1. Install dependencies:

```bash
bun install
```

2. Copy the example env file:

```bash
cp .env.example .env
```

3. Fill in your Strava credentials:

```env
STRAVA_CLIENT_ID=your_client_id_here
STRAVA_CLIENT_SECRET=your_client_secret_here
STRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback
PORT=3000
NODE_ENV=development
```

4. In your Strava app settings:

- Set the Authorization Callback Domain to `localhost`
- Make sure the redirect URI matches `http://localhost:3000/auth/strava/callback`

## Development

Run the app:

```bash
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Build

```bash
bun run build
bun run start
```

## Project Structure

```text
src/
  api/                     TanStack Start server functions
  components/              Route components with local Sass modules
  hooks/                   React Query hooks and shared data helpers
  routes/                  File-based routes
  router.tsx               Router setup
```

## Notes

- This app currently stores the Strava access token in `localStorage`.
- The dashboard uses the athlete and activities endpoints that are actively displayed in the UI.
- Styling is component-scoped through `.module.scss` files.

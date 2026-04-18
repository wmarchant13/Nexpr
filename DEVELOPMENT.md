# Development Guide

## Current Architecture

This project is a TanStack Start app.

- Routing lives in `src/routes`
- Server-side Strava calls live in `src/api`
- Data fetching hooks live in `src/hooks`
- UI components live in `src/components`
- Component styles use Sass modules in each component folder

## Local Workflow

Install dependencies:

```bash
bun install
```

Run development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## OAuth Notes

- The login flow starts from the home page
- Strava redirects back to `/auth/strava/callback`
- The callback exchanges the code for a token
- On success, the app redirects to `/dashboard`

## Validation

Use:

```bash
npm run type-check
npm run build
```

## Implementation Notes

- React Query is provided at the root route level
- Route protection for `/dashboard` is handled in the file route
- Auth state is based on the presence of an access token in `localStorage`
- Styling is no longer Tailwind-based

## Cleanup Status

Removed from the active app:

- Elysia-specific architecture and docs
- Legacy multi-server assumptions
- Unused Axios API client
- Unused Strava server functions that were not used by the UI

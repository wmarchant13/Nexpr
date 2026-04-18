# Secund.io - Strava Activity Tracker

A modern web application built with Bun, React, TanStack Query, and Elysia that allows users to authenticate with Strava via OAuth 2 and visualize their activity data.

## Features

- **OAuth 2 Authentication** with Strava
- **Real-time Activity Tracking** - View your recent activities with detailed metrics
- **Athlete Statistics** - See comprehensive stats about your cycling activities
- **Responsive Design** - Works on desktop and mobile devices
- **Type-safe** - Built with TypeScript throughout

## Tech Stack

### Backend

- **Bun** - Fast JavaScript runtime
- **Elysia** - Lightweight web framework
- **OAuth 2.0** - Secure authentication with Strava API

### Frontend

- **React 18** - UI library
- **TanStack Query** - Server state management
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Prerequisites

- [Bun](https://bun.sh) installed (v1.0 or higher)
- A [Strava Developer Account](https://www.strava.com/settings/api)
- Node.js 18+ (for some frontend tooling)

## Setup

### 1. Clone and Install Dependencies

```bash
cd /Users/wmarchant/Secund.io
bun install
```

### 2. Create Strava OAuth Application

1. Go to [Strava Settings > API](https://www.strava.com/settings/api)
2. Create a new application
3. Set the **Authorization Callback Domain** to `localhost`
4. Note your **Client ID** and **Client Secret**

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your Strava credentials:

```
STRAVA_CLIENT_ID=your_client_id_here
STRAVA_CLIENT_SECRET=your_client_secret_here
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/strava/callback
PORT=3000
NODE_ENV=development
SESSION_SECRET=generate_a_random_32_char_string_here
```

### 4. Start Development Servers

```bash
# This starts both the Bun backend and Vite frontend
bun run dev
```

The app will be available at:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

## Project Structure

```
secund.io/
├── server/                    # Bun backend
│   ├── index.ts              # Main server file
│   ├── auth.ts               # OAuth 2 routes
│   ├── oauth.ts              # OAuth helper functions
│   └── strava.ts             # Strava API routes
├── src/                       # React frontend
│   ├── components/           # React components
│   │   ├── LoginPage.tsx     # OAuth login
│   │   ├── CallbackPage.tsx  # OAuth callback handler
│   │   └── Dashboard.tsx     # Main dashboard
│   ├── hooks.ts              # Custom React hooks for API
│   ├── api-client.ts         # Axios client with interceptors
│   ├── App.tsx               # Main app component
│   ├── index.tsx             # React entry point
│   └── styles.css            # Global styles
├── public/                    # Static files
│   └── index.html            # HTML template
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite configuration
└── .env                       # Environment variables (git ignored)
```

## API Endpoints

### Authentication

- `GET /api/auth/strava/login` - Get OAuth authorization URL
- `GET /api/auth/strava/callback` - Handle OAuth callback
- `POST /api/auth/logout` - Logout user

### Strava Data

- `GET /api/strava/athlete` - Get authenticated user's profile
- `GET /api/strava/activities?page=1&per_page=20` - Get user's activities
- `GET /api/strava/activity/:id` - Get specific activity details
- `GET /api/strava/stats?athlete_id=123` - Get user's statistics

All endpoints require `Authorization: Bearer <access_token>` header.

## Key Features Explained

### OAuth 2 Flow

1. User clicks "Connect with Strava"
2. Redirected to Strava authorization page
3. After approval, redirected back with authorization code
4. Backend exchanges authorization code for access token
5. Access token stored in browser localStorage
6. All subsequent API requests include the token

### TanStack Query Usage

- Automatic caching and background updates
- Built-in loading and error states
- Automatic request deduplication
- Optimistic updates support

### Type Safety

All API responses are fully typed with TypeScript interfaces defined in `src/hooks.ts`:

- `Athlete` - User profile information
- `Activity` - Single activity data
- `Stats` - User statistics

## Building for Production

```bash
# Build both frontend and backend
bun run build

# Start production server
bun run start
```

The frontend will be built to `dist/` and served by the Bun server.

## Security Notes

- Access tokens are stored in `localStorage` (consider using httpOnly cookies for production)
- CORS is configured for `localhost:5173` - update for production domains
- Implement proper session management and CSRF protection for production
- Store sensitive data (tokens, secrets) securely
- Use HTTPS in production

## Troubleshooting

### CORS Errors

- Ensure the Vite proxy is configured correctly in `vite.config.ts`
- Verify the CORS middleware in `server/index.ts` allows your frontend origin

### OAuth Callback Not Working

- Check that `STRAVA_REDIRECT_URI` matches your Strava app settings
- Ensure the callback handler is receiving the `code` parameter

### Activities Not Loading

- Verify your access token is valid
- Check that your Strava account has activities
- Make sure the Strava API isn't rate limiting your requests

## Environment Variables

| Variable               | Description               | Required                  |
| ---------------------- | ------------------------- | ------------------------- |
| `STRAVA_CLIENT_ID`     | Your Strava app client ID | Yes                       |
| `STRAVA_CLIENT_SECRET` | Your Strava app secret    | Yes                       |
| `STRAVA_REDIRECT_URI`  | OAuth callback URL        | Yes                       |
| `PORT`                 | Server port               | No (default: 3000)        |
| `NODE_ENV`             | Environment               | No (default: development) |
| `SESSION_SECRET`       | Session encryption key    | Yes                       |

## License

MIT

## Resources

- [Strava API Documentation](https://developers.strava.com/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Bun Documentation](https://bun.sh/docs)
- [Elysia Documentation](https://elysiajs.com/)

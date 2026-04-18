# Development Guide

## Quick Start

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Setup Strava OAuth**
   - Go to https://www.strava.com/settings/api
   - Create a new application
   - Copy your Client ID and Client Secret
   - Update `.env` file with your credentials

3. **Run development server**

   ```bash
   bun run dev
   ```

4. **Open in browser**
   - Frontend: http://localhost:5173
   - API: http://localhost:3000

## Development Workflow

### Making Changes to Backend

The backend uses Bun's `--hot` flag for hot reload:

- Edit files in `server/` directory
- Changes are automatically reloaded
- Check terminal for any errors

### Making Changes to Frontend

The frontend uses Vite's hot module replacement:

- Edit files in `src/` directory
- Changes appear instantly in the browser
- Type errors are shown in terminal

### Testing API Endpoints

Use curl or Postman to test endpoints:

```bash
# Get login URL
curl http://localhost:3000/api/auth/strava/login

# Get athlete data (replace TOKEN with actual access token)
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/strava/athlete

# Get activities
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/strava/activities?page=1&per_page=10
```

## Common Issues & Solutions

### Port Already in Use

```bash
# Change port in .env
PORT=3001
```

### Module Not Found Errors

```bash
# Reinstall dependencies
rm -rf node_modules
bun install
```

### OAuth Redirect Mismatch

- Ensure `STRAVA_REDIRECT_URI` in `.env` matches Strava app settings
- Default: `http://localhost:3000/api/auth/strava/callback`

### CORS Errors

- Make sure Vite proxy is enabled in `vite.config.ts`
- Both servers should be running (`bun run dev` starts both)

## Code Examples

### Using the Athlete Hook

```tsx
import { useAthlete } from "../hooks";

function Profile() {
  const { data: athlete, isLoading, error } = useAthlete();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading profile</div>;

  return (
    <h1>
      {athlete.firstname} {athlete.lastname}
    </h1>
  );
}
```

### Fetching Activities

```tsx
import { useActivities } from "../hooks";

function ActivitiesList() {
  const [page, setPage] = useState(1);
  const { data: activities, isLoading } = useActivities(page, 20);

  return (
    <div>
      {activities?.map((activity) => (
        <div key={activity.id}>{activity.name}</div>
      ))}
    </div>
  );
}
```

### Making Custom API Calls

```tsx
import { useMutation } from "@tanstack/react-query";
import apiClient from "../api-client";

const { mutate: doSomething } = useMutation({
  mutationFn: async (data) => {
    const response = await apiClient.post("/api/custom", data);
    return response.data;
  },
});
```

## Authentication Flow Details

1. **Login**

   ```
   User clicks "Connect with Strava"
     ↓
   Frontend calls /api/auth/strava/login
     ↓
   Backend generates OAuth URL with state
     ↓
   User redirected to Strava
     ↓
   User approves access
   ```

2. **Callback**

   ```
   Strava redirects to /api/auth/strava/callback?code=xxx&state=yyy
     ↓
   Backend verifies state
     ↓
   Backend exchanges code for token
     ↓
   Token stored in localStorage
     ↓
   Redirect to /dashboard
   ```

3. **Authenticated Requests**
   ```
   Each API call includes Authorization header
     ↓
   Backend validates token with Strava
     ↓
   Returns user data
   ```

## Type Safety

All TypeScript types are defined in `src/hooks.ts`:

- `Athlete` - User profile
- `Activity` - Single activity record
- `Stats` - User statistics

These interfaces are auto-generated from the Strava API responses.

## Next Steps

1. Add user session persistence (database)
2. Implement token refresh logic
3. Add more activity filters and sorting
4. Create activity detail views
5. Add data visualization (charts/maps)
6. Deploy to production

## Useful Resources

- [Strava API Docs](https://developers.strava.com/)
- [Bun Guide](https://bun.sh/docs)
- [Elysia Docs](https://elysiajs.com/)
- [React Query Docs](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com)

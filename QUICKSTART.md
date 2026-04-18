# Quick Start

## 1. Install

```bash
cd /Users/wmarchant/Secund.io
bun install
```

## 2. Configure Strava

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
2. Create an application
3. Set the Authorization Callback Domain to `localhost`
4. Copy your client ID and client secret

## 3. Add Environment Variables

```bash
cp .env.example .env
```

Set:

```env
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback
PORT=3000
NODE_ENV=development
```

## 4. Start

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5. Test

1. Click `Connect with Strava`
2. Approve the Strava authorization
3. Confirm you land on `/dashboard`
4. Confirm activities load

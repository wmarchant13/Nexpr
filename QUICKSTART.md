# Quick Start Guide - Secund.io

## 1️⃣ Install Dependencies

```bash
cd /Users/wmarchant/Secund.io
bun install
```

## 2️⃣ Setup Strava OAuth

1. Go to: https://www.strava.com/settings/api
2. Create New Application
3. Set **Authorization Callback Domain**: `localhost`
4. Copy your **Client ID** and **Client Secret**

## 3️⃣ Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Strava credentials:

```env
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback
SESSION_SECRET=your_random_32_char_secret_string
PORT=3000
NODE_ENV=development
```

## 4️⃣ Start Development

```bash
bun run dev
```

Opens TanStack Start development server on **http://localhost:3000** with both frontend and backend running together.

## 5️⃣ Test the App

1. Open http://localhost:3000 in your browser
2. Click "Connect with Strava"
3. Authorize the app
4. View your activities and stats on the dashboard!

## 📁 Project Structure

```

## 🔑 Key Features

✅ **OAuth 2 Authentication** with Strava  
✅ **Real-time Activity Tracking**  
✅ **User Statistics & Analytics**  
✅ **Type-safe** with TypeScript  
✅ **Modern UI** with Tailwind CSS  
✅ **Built-in Caching** with TanStack Query  
✅ **Full-stack TypeScript** with TanStack Start

## 📚 Full Documentation

See [README.md](./README.md) for detailed API docs and advanced setup.

## 🚀 Next Steps

- Add database for session persistence
- Implement token refresh
- Deploy to production
- Add data visualizations

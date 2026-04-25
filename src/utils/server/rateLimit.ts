const WINDOW_MS = 60_000;

const DEFAULT_LIMIT = 240;
const SERVER_LIMIT = 120;
const AUTH_LIMIT = 20;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

let lastPurge = Date.now();

// Removes expired entries to prevent unbounded memory growth
function purgeExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

// Returns the client IP from standard proxy headers
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

// Returns a deterministic rate-limit key with per-session isolation for RPC routes.
export function getRateLimitKey(
  request: Request,
  pathname: string,
  ip: string,
): string {
  if (!pathname.startsWith("/_server")) {
    return `ip:${ip}`;
  }

  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)nexpr_strava_session=([^;]+)/);
  const session = match?.[1];

  if (!session) {
    return `ip:${ip}:anon-rpc`;
  }

  return `ip:${ip}:session:${session}`;
}

// Checks and increments the rate limit counter for a given IP
export function checkRateLimit(
  key: string,
  limit = DEFAULT_LIMIT,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();

  if (now - lastPurge > WINDOW_MS) {
    purgeExpired();
    lastPurge = now;
  }

  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    return { allowed: true, remaining: limit - 1, resetAt: entry.resetAt };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  return { allowed: entry.count <= limit, remaining, resetAt: entry.resetAt };
}

// Returns the rate limit for a given pathname
export function limitForPath(pathname: string): number {
  if (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_server/auth")
  ) {
    return AUTH_LIMIT;
  }

  if (pathname.startsWith("/_server")) {
    return SERVER_LIMIT;
  }

  return DEFAULT_LIMIT;
}

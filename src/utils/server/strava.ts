type FetchOptions = {
  ttlMs?: number;
};

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const STRAVA_API_BASE = "https://www.strava.com/api/v3";

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();
let rateLimitedUntil = 0;

function getRetryAfterMs(response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return 60_000;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    return Math.max(seconds * 1000, 15_000);
  }

  const dateValue = Date.parse(retryAfter);
  if (Number.isFinite(dateValue)) {
    return Math.max(dateValue - Date.now(), 15_000);
  }

  return 60_000;
}

function getCacheKey(endpoint: string, accessToken: string) {
  return `${accessToken}:${endpoint}`;
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.message || payload?.errors?.[0]?.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

async function performFetch<T>(endpoint: string, accessToken: string): Promise<T> {
  if (Date.now() < rateLimitedUntil) {
    const waitSeconds = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
    throw new Error(`Strava API rate limit active. Try again in about ${waitSeconds} seconds.`);
  }

  const response = await fetch(`${STRAVA_API_BASE}${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (response.status === 429) {
    rateLimitedUntil = Date.now() + getRetryAfterMs(response);
    throw new Error("Strava API rate limit exceeded. Please wait and retry.");
  }

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(`Strava API error: ${message}`);
  }

  rateLimitedUntil = 0;
  return (await response.json()) as T;
}

export async function fetchStrava<T>(
  endpoint: string,
  accessToken: string,
  options: FetchOptions = {},
): Promise<T> {
  const cacheKey = getCacheKey(endpoint, accessToken);
  const ttlMs = options.ttlMs ?? 0;

  if (ttlMs > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
  }

  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest as Promise<T>;
  }

  const request = performFetch<T>(endpoint, accessToken)
    .then((data) => {
      if (ttlMs > 0) {
        responseCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + ttlMs,
        });
      }
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, request);
  return request;
}
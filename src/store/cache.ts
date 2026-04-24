/**
 * Nexpr Local Cache System
 * 
 * Implements intelligent local caching to minimize Strava API calls.
 * Activities are cached with timestamps and only refreshed when stale.
 * 
 * Cache Strategy:
 * - Activities: Cache for 15 minutes (user might record new activity)
 * - Athlete profile: Cache for 1 hour (rarely changes)
 * - Stats: Cache for 30 minutes (updated after activities)
 * - Computed metrics: Derived from cached data, no additional API calls
 */

import type { Activity, Athlete, Stats } from "../hooks";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface NexprCache {
  athlete: CacheEntry<Athlete> | null;
  activities: CacheEntry<Activity[]> | null;
  stats: CacheEntry<Stats> | null;
  lastSync: number | null;
}

// Cache durations in milliseconds
const CACHE_DURATIONS = {
  athlete: 60 * 60 * 1000,       // 1 hour
  activities: 15 * 60 * 1000,    // 15 minutes
  stats: 30 * 60 * 1000,         // 30 minutes
} as const;

const CACHE_KEY = "nexpr_cache_v1";

/**
 * Load cache from localStorage
 */
export function loadCache(): NexprCache {
  if (typeof window === "undefined") {
    return { athlete: null, activities: null, stats: null, lastSync: null };
  }
  
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return { athlete: null, activities: null, stats: null, lastSync: null };
    }
    return JSON.parse(raw) as NexprCache;
  } catch {
    return { athlete: null, activities: null, stats: null, lastSync: null };
  }
}

/**
 * Save cache to localStorage
 */
export function saveCache(cache: NexprCache): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

/**
 * Check if a cache entry is still valid
 */
export function isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
  if (!entry) return false;
  return Date.now() < entry.expiresAt;
}

/**
 * Create a cache entry with expiration
 */
export function createCacheEntry<T>(
  data: T,
  duration: number
): CacheEntry<T> {
  const now = Date.now();
  return {
    data,
    timestamp: now,
    expiresAt: now + duration,
  };
}

/**
 * Get cached athlete data if valid
 */
export function getCachedAthlete(): Athlete | null {
  const cache = loadCache();
  if (isCacheValid(cache.athlete)) {
    return cache.athlete!.data;
  }
  return null;
}

/**
 * Cache athlete data
 */
export function cacheAthlete(athlete: Athlete): void {
  const cache = loadCache();
  cache.athlete = createCacheEntry(athlete, CACHE_DURATIONS.athlete);
  saveCache(cache);
}

/**
 * Get cached activities if valid
 */
export function getCachedActivities(): Activity[] | null {
  const cache = loadCache();
  if (isCacheValid(cache.activities)) {
    return cache.activities!.data;
  }
  return null;
}

/**
 * Cache activities data
 */
export function cacheActivities(activities: Activity[]): void {
  const cache = loadCache();
  cache.activities = createCacheEntry(activities, CACHE_DURATIONS.activities);
  cache.lastSync = Date.now();
  saveCache(cache);
}

/**
 * Merge new activities with cached ones (for incremental updates)
 * Only adds activities that don't already exist
 */
export function mergeActivities(newActivities: Activity[]): Activity[] {
  const cached = getCachedActivities() || [];
  const existingIds = new Set(cached.map(a => a.id));
  
  const toAdd = newActivities.filter(a => !existingIds.has(a.id));
  const merged = [...toAdd, ...cached].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
  
  cacheActivities(merged);
  return merged;
}

/**
 * Get cached stats if valid
 */
export function getCachedStats(): Stats | null {
  const cache = loadCache();
  if (isCacheValid(cache.stats)) {
    return cache.stats!.data;
  }
  return null;
}

/**
 * Cache stats data
 */
export function cacheStats(stats: Stats): void {
  const cache = loadCache();
  cache.stats = createCacheEntry(stats, CACHE_DURATIONS.stats);
  saveCache(cache);
}

/**
 * Get time since last sync
 */
export function getTimeSinceLastSync(): number | null {
  const cache = loadCache();
  if (!cache.lastSync) return null;
  return Date.now() - cache.lastSync;
}

/**
 * Check if we should fetch fresh data
 * Returns true if cache is stale or empty
 */
export function shouldFetchActivities(): boolean {
  return !isCacheValid(loadCache().activities);
}

/**
 * Clear all cached data (for logout)
 */
export function clearCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Get cache status for debugging/UI
 */
export function getCacheStatus(): {
  hasAthlete: boolean;
  hasActivities: boolean;
  hasStats: boolean;
  activitiesCount: number;
  lastSync: Date | null;
  athleteExpiry: Date | null;
  activitiesExpiry: Date | null;
} {
  const cache = loadCache();
  return {
    hasAthlete: isCacheValid(cache.athlete),
    hasActivities: isCacheValid(cache.activities),
    hasStats: isCacheValid(cache.stats),
    activitiesCount: cache.activities?.data?.length ?? 0,
    lastSync: cache.lastSync ? new Date(cache.lastSync) : null,
    athleteExpiry: cache.athlete ? new Date(cache.athlete.expiresAt) : null,
    activitiesExpiry: cache.activities ? new Date(cache.activities.expiresAt) : null,
  };
}

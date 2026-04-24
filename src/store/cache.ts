

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

const CACHE_DURATIONS = {
  athlete: 60 * 60 * 1000,       
  activities: 15 * 60 * 1000,    
  stats: 30 * 60 * 1000,         
} as const;

const CACHE_KEY = "nexpr_cache_v1";

// Reads the Nexpr cache object from localStorage
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

// Writes the Nexpr cache object to localStorage
export function saveCache(cache: NexprCache): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

// Returns true if the cache entry has not expired
export function isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
  if (!entry) return false;
  return Date.now() < entry.expiresAt;
}

// Wraps data in a timed cache entry
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

// Returns cached athlete data or null if stale
export function getCachedAthlete(): Athlete | null {
  const cache = loadCache();
  if (isCacheValid(cache.athlete)) {
    return cache.athlete!.data;
  }
  return null;
}

// Stores athlete data in the local cache
export function cacheAthlete(athlete: Athlete): void {
  const cache = loadCache();
  cache.athlete = createCacheEntry(athlete, CACHE_DURATIONS.athlete);
  saveCache(cache);
}

// Returns cached activities or null if stale
export function getCachedActivities(): Activity[] | null {
  const cache = loadCache();
  if (isCacheValid(cache.activities)) {
    return cache.activities!.data;
  }
  return null;
}

// Stores activities in the local cache
export function cacheActivities(activities: Activity[]): void {
  const cache = loadCache();
  cache.activities = createCacheEntry(activities, CACHE_DURATIONS.activities);
  cache.lastSync = Date.now();
  saveCache(cache);
}

// Merges new activities into the cache without duplicates
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

// Returns cached stats or null if stale
export function getCachedStats(): Stats | null {
  const cache = loadCache();
  if (isCacheValid(cache.stats)) {
    return cache.stats!.data;
  }
  return null;
}

// Stores stats in the local cache
export function cacheStats(stats: Stats): void {
  const cache = loadCache();
  cache.stats = createCacheEntry(stats, CACHE_DURATIONS.stats);
  saveCache(cache);
}

// Returns milliseconds since the last activity sync
export function getTimeSinceLastSync(): number | null {
  const cache = loadCache();
  if (!cache.lastSync) return null;
  return Date.now() - cache.lastSync;
}

// Returns true if the activities cache is stale or empty
export function shouldFetchActivities(): boolean {
  return !isCacheValid(loadCache().activities);
}

// Removes all Nexpr cached data from localStorage
export function clearCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

// Returns a debug summary of the current cache state
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

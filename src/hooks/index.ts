import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStravaAuthUrl,
  exchangeStravaCode,
  getViewerSession,
  logoutStravaSession,
} from "../api/auth";
import {
  getAthlete,
  getActivities,
  getStats,
  getActivityDetails,
  getActivityBestEfforts,
} from "../api/strava";
import { getGoals, saveGoal, deleteGoal } from "../api/goals";
import {
  getSymptomEntries,
  saveSymptomEntry,
  deleteSymptomEntry,
} from "../api/symptomLog";
import {
  getReflections,
  saveReflection,
  deleteReflection,
} from "../api/weeklyReflection";
import type { PRRecord, RaceDistance } from "../store/predictions";
import type { SymptomEntry } from "../store/symptomLog";
import { normalizeWeekStart, type WeeklyReflection } from "../store/weeklyReflection";
import {
  getCachedAthlete,
  cacheAthlete,
  getCachedActivities,
  cacheActivities,
  getCachedStats,
  cacheStats,
  clearCache,
  shouldFetchActivities,
} from "../store/cache";

export interface Athlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  profile_medium: string;
  profile: string;
  city: string;
  state: string;
  country: string;
}

export interface Activity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  average_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  achievement_count?: number;
  kudos_count?: number;
  suffer_score?: number;
}

export interface ActivityTotals {
  count: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_gain: number;
}

export interface Split {
  distance: number; 
  elapsed_time: number; 
  moving_time: number; 
  split: number; 
  pace_zone: number;
}

export interface Stats {
  recent_run_totals: ActivityTotals;
  all_run_totals: ActivityTotals;
  ytd_run_totals: ActivityTotals;
}

// Query hook: returns current authentication status
export const useViewerSession = () => {
  return useQuery({
    queryKey: ["viewer-session"],
    queryFn: () => getViewerSession(),
    staleTime: 60 * 1000,
    retry: false,
  });
};

// Mutation hook: initiates Strava OAuth redirect
export const useStravaLogin = () => {
  return useMutation({
    mutationFn: async () => {
      if (typeof window === "undefined") {
        throw new Error("Strava login must start in the browser");
      }
      const origin = window.location.origin;
      const result = await getStravaAuthUrl({ data: { origin } });
      return result;
    },
    onSuccess: (data) => {
      window.location.href = data.authUrl;
    },
  });
};

// Mutation hook: completes OAuth flow with code + state
export const useStravaCallback = (code: string, returnedState?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!code) throw new Error("No code provided");
      if (!returnedState) {
        throw new Error("Missing OAuth state. Please try connecting Strava again.");
      }
      const result = await exchangeStravaCode({ data: { code, state: returnedState } });
      const grantedScopes = new Set(
        String(result.grantedScope ?? "")
          .split(/[\s,]+/)
          .map((scope) => scope.trim())
          .filter(Boolean),
      );

      if (
        !grantedScopes.has("activity:read") &&
        !grantedScopes.has("activity:read_all")
      ) {
        throw new Error(
          "Strava did not grant activity read access. Reconnect and approve activity access.",
        );
      }

      if (typeof window !== "undefined") {
        
        clearCache();
        localStorage.removeItem("nexpr_best_efforts_v1");
        if (result.athlete) {
          localStorage.setItem("athlete", JSON.stringify(result.athlete));
          cacheAthlete(result.athlete as Athlete);
        }
      }
      return result;
    },
    onSuccess: () => {
      
      void queryClient.invalidateQueries({ queryKey: ["viewer-session"] });
      void queryClient.invalidateQueries({ queryKey: ["athlete"] });
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
};

// Mutation hook: clears session and redirects to home
export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await logoutStravaSession();
      
      
      
      clearCache();
      if (typeof window !== "undefined") {
        localStorage.removeItem("athlete");
        localStorage.removeItem("nexpr_best_efforts_v1");
      }
    },
    onSuccess: () => {
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    },
  });
};

// Query hook: fetches athlete profile with local cache
export const useAthlete = () => {
  return useQuery({
    queryKey: ["athlete"],
    queryFn: async () => {
      
      const cached = getCachedAthlete();
      if (cached) {
        return cached;
      }

      const result = await getAthlete();
      const athlete = result as Athlete;

      
      cacheAthlete(athlete);
      return athlete;
    },
    enabled: typeof window !== "undefined",
    staleTime: 60 * 60 * 1000, 
    gcTime: 60 * 60 * 1000,   
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
};

// Query hook: fetches activity list with local cache
export const useActivities = (page: number = 1, perPage: number = 30) => {
  
  
  const isBulk = page === 1 && perPage >= 50;
  const queryKey = isBulk ? ["activities"] : ["activities", page, perPage];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (isBulk) {
        const cached = getCachedActivities();
        if (cached && cached.length > 0 && !shouldFetchActivities()) {
          return cached;
        }
      }

      const result = await getActivities({
        data: { page, perPage },
      });
      const activities = result as Activity[];

      if (isBulk) {
        cacheActivities(activities);
      }

      return activities;
    },
    enabled: typeof window !== "undefined",
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
};

// Query hook: fetches lifetime stats with local cache
export const useStats = (athleteId: number | null) => {
  return useQuery({
    queryKey: ["stats", athleteId],
    queryFn: async () => {
      const cached = getCachedStats();
      if (cached) return cached;

      if (!athleteId) throw new Error("Missing athlete context");

      const result = await getStats();
      const stats = result as Stats;

      cacheStats(stats);
      return stats;
    },
    enabled:
      typeof window !== "undefined" && !!athleteId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

// Query hook: fetches full details for a single activity
export const useActivityDetails = (activityId: number | null) => {
  return useQuery({
    queryKey: ["activityDetails", activityId],
    queryFn: async () => {
      if (!activityId) throw new Error("Missing context");
      const result = await getActivityDetails({
        data: { activityId },
      });
      return result as any;
    },
    enabled: typeof window !== "undefined" && !!activityId,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
};

import {
  getFuelingEntry as getFuelingEntryApi,
  getAllFuelingEntries as getAllFuelingEntriesApi,
  saveFuelingEntry as saveFuelingEntryApi,
  deleteFuelingEntry as deleteFuelingEntryApi,
  type FuelingEntryInput,
} from "../api/fueling";

export interface FuelingEntry {
  activityId: number;
  carbsGrams?: number;
  gelsCount?: number;
  hydrationMl?: number;
  caffeineCount?: number;
  timing?: {
    beforeRun?: "none" | "light" | "moderate" | "heavy";
    duringRun?: "none" | "light" | "moderate" | "heavy";
    afterRun?: "none" | "light" | "moderate" | "heavy";
  };
  note?: string;
  createdAt: number;
  updatedAt: number;
}

// Query hook: fetches fueling entry for a single activity
export const useFuelingEntry = (activityId: number | null) => {
  return useQuery({
    queryKey: ["fueling", activityId],
    queryFn: async () => {
      if (!activityId) return null;
      const result = await getFuelingEntryApi({ data: { activityId } });
      return result as FuelingEntry | null;
    },
    enabled: !!activityId,
    staleTime: 5 * 60 * 1000, 
  });
};

// Query hook: fetches all fueling entries for the athlete
export const useAllFuelingEntries = (athleteId: number | null) => {
  return useQuery({
    queryKey: ["fueling", "all", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const result = await getAllFuelingEntriesApi({ data: { athleteId } });
      return result as FuelingEntry[];
    },
    enabled: !!athleteId,
    staleTime: 5 * 60 * 1000, 
  });
};

// Mutation hook: upserts a fueling entry
export const useSaveFuelingEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: FuelingEntryInput) => {
      const result = await saveFuelingEntryApi({ data: input });
      return result;
    },
    onSuccess: (_, variables) => {
      
      queryClient.invalidateQueries({
        queryKey: ["fueling", variables.activityId],
      });
      queryClient.invalidateQueries({ queryKey: ["fueling", "all"] });
    },
  });
};

// Mutation hook: removes a fueling entry
export const useDeleteFuelingEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { athleteId: number; activityId: number }) => {
      const result = await deleteFuelingEntryApi({ data: input });
      return result;
    },
    onSuccess: (_, variables) => {
      
      queryClient.invalidateQueries({
        queryKey: ["fueling", variables.activityId],
      });
      queryClient.invalidateQueries({ queryKey: ["fueling", "all"] });
    },
  });
};

export {
  classifyEffort,
  classifyEfforts,
  calculateBaseline,
  loadBaselineCache,
  getEffortColor,
  getEffortBgColor,
  formatEffortScore,
  EFFORT_TOOLTIP,
  getBaselineStatus,
  type EffortResult,
  type EffortLabel,
  type RunnerBaseline,
  type EffortFactors,
} from "../store/effort";

const KM_TO_MILES = 0.621371;
const METERS_TO_FEET = 3.28084;

// Converts kilometers to miles, rounded to one decimal
export const kmToMiles = (km: number): number =>
  Math.round(km * KM_TO_MILES * 10) / 10;
// Converts meters to feet
export const metersToFeet = (meters: number): number =>
  Math.round(meters * METERS_TO_FEET);
// Converts meters to kilometers
export const mToKm = (m: number): number => m / 1000;

export interface MileageChartData {
  month: string;
  distance: number;
  activities: number;
  elevation: number;
}

export interface RunStats {
  avgPace: number; 
  avgDistance: number; 
  totalRuns: number;
}

export interface RunnerBlockStats {
  totalMiles: number;
  totalRuns: number;
  avgPace: number;
  longRunMiles: number;
  elevationFeet: number;
  runDays: number;
  weeklyAverageMiles: number;
  consistencyScore: number;
}

export interface WeeklyRunVolumeDatum {
  label: string;
  miles: number;
  runs: number;
  longRun: number;
  avgPace: number | null;
}

export interface RunHighlight {
  label: string;
  value: string;
  detail: string;
}

export interface LifetimeRunSnapshot {
  recentMiles: number;
  recentRuns: number;
  ytdMiles: number;
  ytdRuns: number;
  lifetimeMiles: number;
  lifetimeRuns: number;
}

// Returns true if an activity is a running activity
const isRun = (activity: Activity) =>
  activity.type === "Run" || activity.sport_type === "Run";

// Formats a Date as YYYY-MM-DD string
const formatDateKey = (date: Date) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Returns the Monday of the week containing a given date
export const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
};

// Formats minutes-per-mile as a M:SS string
export const formatPace = (minutesPerMile: number): string => {
  if (!Number.isFinite(minutesPerMile) || minutesPerMile <= 0) {
    return "--";
  }

  const totalSeconds = Math.round(minutesPerMile * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Formats seconds as a decimal hours string
export const formatDurationHours = (seconds: number): string =>
  `${Math.round((seconds / 3600) * 10) / 10}h`;

// Aggregates activity distance and elevation by month
export const aggregate3MonthData = (
  activities: Activity[],
): MileageChartData[] => {
  const now = new Date();
  const threeMonthsAgo = new Date(
    now.getFullYear(),
    now.getMonth() - 3,
    now.getDate(),
  );

  const monthMap = new Map<
    string,
    { distance: number; activities: number; elevation: number }
  >();

  
  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    monthMap.set(monthKey, { distance: 0, activities: 0, elevation: 0 });
  }

  
  activities.forEach((activity) => {
    const activityDate = new Date(activity.start_date);
    if (activityDate >= threeMonthsAgo) {
      const monthKey = activityDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      const existing = monthMap.get(monthKey) || {
        distance: 0,
        activities: 0,
        elevation: 0,
      };
      monthMap.set(monthKey, {
        distance: existing.distance + activity.distance,
        activities: (existing.activities || 0) + 1,
        elevation: existing.elevation + activity.total_elevation_gain,
      });
    }
  });

  
  const data = Array.from(monthMap.entries())
    .map(([month, data]) => ({
      month,
      distance: kmToMiles(mToKm(data.distance)),
      activities: data.activities,
      elevation: Math.round(metersToFeet(data.elevation)),
    }))
    .sort((a, b) => {
      const aDate = new Date(a.month);
      const bDate = new Date(b.month);
      return aDate.getTime() - bDate.getTime();
    });

  return data;
};

// Computes average pace and distance over the past 3 months
export const calculate3MonthRunStats = (activities: Activity[]): RunStats => {
  const now = new Date();
  const threeMonthsAgo = new Date(
    now.getFullYear(),
    now.getMonth() - 3,
    now.getDate(),
  );

  
  const runs = activities.filter(
    (a) =>
      (a.type === "Run" || a.sport_type === "Run") &&
      new Date(a.start_date) >= threeMonthsAgo,
  );

  if (runs.length === 0) {
    return { avgPace: 0, avgDistance: 0, totalRuns: 0 };
  }

  const totalDistance = runs.reduce((sum, a) => sum + a.distance, 0);
  const totalTime = runs.reduce((sum, a) => sum + a.moving_time, 0);

  const avgDistanceMiles = kmToMiles(mToKm(totalDistance / runs.length));
  const avgPaceMinPerMile = totalTime / 60 / kmToMiles(mToKm(totalDistance));

  return {
    avgPace: Math.round(avgPaceMinPerMile * 100) / 100,
    avgDistance: avgDistanceMiles,
    totalRuns: runs.length,
  };
};

// Computes training block stats over the past N days
export const calculateRunnerBlockStats = (
  activities: Activity[],
  days: number = 28,
): RunnerBlockStats => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  const runs = activities.filter(
    (activity) => isRun(activity) && new Date(activity.start_date) >= cutoff,
  );

  if (runs.length === 0) {
    return {
      totalMiles: 0,
      totalRuns: 0,
      avgPace: 0,
      longRunMiles: 0,
      elevationFeet: 0,
      runDays: 0,
      weeklyAverageMiles: 0,
      consistencyScore: 0,
    };
  }

  const totalDistanceMeters = runs.reduce(
    (sum, activity) => sum + activity.distance,
    0,
  );
  const totalMovingTime = runs.reduce(
    (sum, activity) => sum + activity.moving_time,
    0,
  );
  const totalMiles = kmToMiles(mToKm(totalDistanceMeters));
  const runDays = new Set(
    runs.map((activity) => formatDateKey(new Date(activity.start_date))),
  ).size;

  return {
    totalMiles,
    totalRuns: runs.length,
    avgPace: totalMovingTime / 60 / kmToMiles(mToKm(totalDistanceMeters)),
    longRunMiles: kmToMiles(
      mToKm(Math.max(...runs.map((activity) => activity.distance))),
    ),
    elevationFeet: metersToFeet(
      runs.reduce((sum, activity) => sum + activity.total_elevation_gain, 0),
    ),
    runDays,
    weeklyAverageMiles: Math.round((totalMiles / (days / 7)) * 10) / 10,
    consistencyScore: Math.round((runDays / days) * 100),
  };
};

// Builds weekly mileage buckets for a chart
export const buildWeeklyRunVolume = (
  activities: Activity[],
  weeks: number = 8,
): WeeklyRunVolumeDatum[] => {
  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const weekBuckets = new Map<string, WeeklyRunVolumeDatum>();

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - index * 7);
    const key = formatDateKey(weekStart);
    weekBuckets.set(key, {
      label: weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      miles: 0,
      runs: 0,
      longRun: 0,
      avgPace: null,
    });
  }

  const paceAccumulator = new Map<string, { distance: number; time: number }>();

  activities.filter(isRun).forEach((activity) => {
    const weekStart = startOfWeek(new Date(activity.start_date));
    const key = formatDateKey(weekStart);
    const bucket = weekBuckets.get(key);

    if (!bucket) {
      return;
    }

    const miles = kmToMiles(mToKm(activity.distance));
    bucket.miles = Math.round((bucket.miles + miles) * 10) / 10;
    bucket.runs += 1;
    bucket.longRun = Math.max(bucket.longRun, miles);

    const current = paceAccumulator.get(key) ?? { distance: 0, time: 0 };
    current.distance += activity.distance;
    current.time += activity.moving_time;
    paceAccumulator.set(key, current);
  });

  return Array.from(weekBuckets.entries()).map(([key, bucket]) => {
    const paceData = paceAccumulator.get(key);
    return {
      ...bucket,
      avgPace:
        paceData && paceData.distance > 0
          ? Math.round(
              (paceData.time / 60 / kmToMiles(mToKm(paceData.distance))) * 100,
            ) / 100
          : null,
    };
  });
};

// Finds the longest, hilliest, and fastest recent runs
export const calculateRunHighlights = (
  activities: Activity[],
): RunHighlight[] => {
  const runs = activities.filter(isRun);

  if (runs.length === 0) {
    return [];
  }

  const longestRun = runs.reduce((best, activity) =>
    activity.distance > best.distance ? activity : best,
  );
  const hilliestRun = runs.reduce((best, activity) =>
    activity.total_elevation_gain > best.total_elevation_gain ? activity : best,
  );
  const fastestRun = runs
    .filter((activity) => activity.distance >= 5000)
    .reduce<Activity | null>((best, activity) => {
      if (!best) return activity;
      const bestPace = best.moving_time / best.distance;
      const currentPace = activity.moving_time / activity.distance;
      return currentPace < bestPace ? activity : best;
    }, null);

  const highlights: RunHighlight[] = [
    {
      label: "Longest recent run",
      value: `${kmToMiles(mToKm(longestRun.distance))} mi`,
      detail: `${new Date(longestRun.start_date).toLocaleDateString()} · ${longestRun.name}`,
    },
    {
      label: "Most vertical run",
      value: `${metersToFeet(hilliestRun.total_elevation_gain)} ft`,
      detail: `${new Date(hilliestRun.start_date).toLocaleDateString()} · ${hilliestRun.name}`,
    },
  ];

  if (fastestRun) {
    highlights.unshift({
      label: "Fastest 5K+ pace",
      value: `${formatPace(fastestRun.moving_time / 60 / kmToMiles(mToKm(fastestRun.distance)))}/mi`,
      detail: `${kmToMiles(mToKm(fastestRun.distance))} mi · ${fastestRun.name}`,
    });
  }

  return highlights;
};

// Formats Strava lifetime stats into a summary object
export const buildLifetimeRunSnapshot = (
  stats: Stats,
): LifetimeRunSnapshot => ({
  recentMiles:
    Math.round(kmToMiles(mToKm(stats.recent_run_totals.distance)) * 10) / 10,
  recentRuns: stats.recent_run_totals.count,
  ytdMiles:
    Math.round(kmToMiles(mToKm(stats.ytd_run_totals.distance)) * 10) / 10,
  ytdRuns: stats.ytd_run_totals.count,
  lifetimeMiles:
    Math.round(kmToMiles(mToKm(stats.all_run_totals.distance)) * 10) / 10,
  lifetimeRuns: stats.all_run_totals.count,
});

export interface LongRunInsight {
  activityId: number;
  distanceMiles: number;
  avgPace: number; 
  paceCurve: number[]; 
  fatiguePointSegment: number | null; 
  controlledEnduranceScore: number; 
  comparison?: {
    prevAvgPace: number | null;
    deltaSecondsPerMile: number | null;
  };
}

// Filters and maps activities to long runs above a distance threshold
export const getLongRuns = (activities: Activity[], minDistanceMiles = 10) =>
  activities
    .map((a) => ({
      ...a,
      distanceMiles: kmToMiles(mToKm(a.distance)),
    }))
    .filter((a) => a.distanceMiles >= minDistanceMiles)
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    );

// Analyze Long Run
export const analyzeLongRun = (
  activity: Activity,
  pastActivities: Activity[] = [],
  splits?: Split[],
): LongRunInsight => {
  const distanceMiles =
    Math.round(kmToMiles(mToKm(activity.distance)) * 10) / 10 || 0;
  const avgPace =
    distanceMiles > 0 ? activity.moving_time / 60 / distanceMiles : 0;

  let paceCurve: number[];

  if (splits && splits.length > 0) {
    
    paceCurve = splits.map((split) => {
      const splitMiles = kmToMiles(mToKm(split.distance));
      const splitMinutes = split.moving_time / 60;
      return Math.round((splitMinutes / splitMiles) * 100) / 100;
    });
  } else {
    
    const segCount = Math.max(1, Math.floor(distanceMiles));
    const hr = activity.average_heartrate || 0;
    const driftFactor = hr
      ? Math.min(0.35, Math.max(0, (hr - 120) / 250))
      : 0.12;

    paceCurve = Array.from({ length: segCount }).map((_, i) => {
      const t = segCount > 1 ? i / (segCount - 1) : 0;
      
      return Math.round(avgPace * (1 + driftFactor * t) * 100) / 100;
    });
  }

  
  const fatigueIdx = paceCurve.findIndex((p) => p > avgPace * 1.15);

  
  const mean = avgPace;
  const variance =
    paceCurve.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / paceCurve.length;
  const std = Math.sqrt(variance);
  const consistency = Math.max(0, 1 - std / mean); 
  const driftPenalty = splits && splits.length > 0 ? 0 : 0.12; 
  const score = Math.round(
    Math.max(0, Math.min(100, consistency * 100 - driftPenalty * 20)),
  );

  
  const similar = pastActivities
    .map((a) => ({ ...a, distanceMiles: kmToMiles(mToKm(a.distance)) }))
    .filter(
      (a) =>
        a.id !== activity.id &&
        Math.abs(a.distanceMiles - distanceMiles) / distanceMiles <= 0.1,
    )
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    );

  const prev = similar.length > 0 ? similar[0] : null;
  const prevAvgPace = prev
    ? prev.moving_time /
      60 /
      (prev.distance ? kmToMiles(mToKm(prev.distance)) : 1)
    : null;

  const deltaSecondsPerMile =
    prevAvgPace != null ? Math.round((avgPace - prevAvgPace) * 60) : null;

  return {
    activityId: activity.id,
    distanceMiles,
    avgPace: Math.round(avgPace * 100) / 100,
    paceCurve,
    fatiguePointSegment: fatigueIdx === -1 ? null : fatigueIdx,
    controlledEnduranceScore: score,
    comparison: { prevAvgPace, deltaSecondsPerMile },
  };
};

export interface WeeklySummaryWeek {
  weekStart: string;
  label: string;
  miles: number;
  runDays: number;
  longRunMiles: number;
}

export interface WeeklyTrainingAnalysis {
  weeks: WeeklySummaryWeek[]; 
  volumeTrendPercentChange: number | null; 
  easyMiles: number; 
  hardMiles: number; 
  percentEasy: number; 
  percentModerate: number; 
  percentHard: number; 
  restConsistencyScore: number; 
  longRunProportionLastWeek: number; 
}

// Analyze Weekly Training
export const analyzeWeeklyTraining = (
  activities: Activity[],
  weeks: number = 8,
): WeeklyTrainingAnalysis => {
  const now = new Date();
  const currentWeekStart = startOfWeek(now);

  const weekBuckets = new Map<string, WeeklySummaryWeek>();

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - i * 7);
    const key = formatDateKey(d);
    weekBuckets.set(key, {
      weekStart: key,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      miles: 0,
      runDays: 0,
      longRunMiles: 0,
    });
  }

  const runDaysMap = new Map<string, Set<string>>();

  activities.filter(isRun).forEach((activity) => {
    const weekStart = formatDateKey(startOfWeek(new Date(activity.start_date)));
    const bucket = weekBuckets.get(weekStart);
    if (!bucket) return;
    const miles = kmToMiles(mToKm(activity.distance));
    bucket.miles = Math.round((bucket.miles + miles) * 10) / 10;
    if (!runDaysMap.has(weekStart)) runDaysMap.set(weekStart, new Set());
    runDaysMap
      .get(weekStart)!
      .add(new Date(activity.start_date).toISOString().slice(0, 10));
    
    if (miles > bucket.longRunMiles) {
      bucket.longRunMiles = Math.round(miles * 10) / 10;
    }
  });

  
  for (const [key, bucket] of weekBuckets.entries()) {
    bucket.runDays = runDaysMap.get(key)?.size ?? 0;
  }

  const weeksArr = Array.from(weekBuckets.values());

  
  const last = weeksArr[weeksArr.length - 1];
  const prev = weeksArr[weeksArr.length - 2] ?? null;
  const volumeTrendPercentChange =
    prev && prev.miles > 0
      ? Math.round(((last.miles - prev.miles) / prev.miles) * 100)
      : null;

  
  const lastWeekKey = last.weekStart;
  const runsLastWeek = activities.filter(
    (a) =>
      isRun(a) &&
      formatDateKey(startOfWeek(new Date(a.start_date))) === lastWeekKey,
  );
  let easyMiles = 0;
  let hardMiles = 0;
  let totalMiles = 0;

  
  const weekTotalDistanceMeters = runsLastWeek.reduce(
    (s, r) => s + r.distance,
    0,
  );
  const weekTotalTime = runsLastWeek.reduce((s, r) => s + r.moving_time, 0);
  const weekAvgPace =
    weekTotalDistanceMeters > 0
      ? weekTotalTime / 60 / kmToMiles(mToKm(weekTotalDistanceMeters))
      : 0;

  runsLastWeek.forEach((r) => {
    const miles = kmToMiles(mToKm(r.distance));
    totalMiles += miles;
    if (r.average_heartrate && r.average_heartrate > 0) {
      const hr = r.average_heartrate;
      if (hr < 130) easyMiles += miles;
      else if (hr > 155) hardMiles += miles;
      else {
        
      }
    } else if (weekAvgPace > 0) {
      const pace = r.moving_time / 60 / (miles || 1);
      if (pace <= weekAvgPace * 0.95) hardMiles += miles;
      else if (pace >= weekAvgPace * 1.08) easyMiles += miles;
    }
  });

  
  const easyPct =
    totalMiles > 0 ? Math.round((easyMiles / totalMiles) * 100) : 0;
  const hardPct =
    totalMiles > 0 ? Math.round((hardMiles / totalMiles) * 100) : 0;
  const moderatePct = Math.max(0, 100 - easyPct - hardPct);

  
  const restDays = weeksArr.map((w) => 7 - w.runDays);
  const mean = restDays.reduce((s, v) => s + v, 0) / restDays.length;
  const variance =
    restDays.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / restDays.length;
  const std = Math.sqrt(variance);
  const restConsistencyScore = Math.max(
    0,
    Math.min(100, Math.round(100 - std * 18)),
  );

  
  let longestRunMiles = 0;
  runsLastWeek.forEach((r) => {
    const miles = kmToMiles(mToKm(r.distance));
    longestRunMiles = Math.max(longestRunMiles, miles);
  });
  const longRunProportionLastWeek =
    last.miles > 0 ? Math.round((longestRunMiles / last.miles) * 100) : 0;

  return {
    weeks: weeksArr,
    volumeTrendPercentChange,
    
    easyMiles: Math.round(easyMiles * 10) / 10,
    hardMiles: Math.round(hardMiles * 10) / 10,
    percentEasy: easyPct,
    percentModerate: moderatePct,
    percentHard: hardPct,
    restConsistencyScore,
    longRunProportionLastWeek,
  };
};

export interface SegmentAnalysis {
  segments: number;
  segmentMiles: number;
  segmentPaces: number[]; 
  easyMiles: number;
  hardMiles: number;
  firstHalfPace: number; 
  secondHalfPace: number; 
  firstSecondDeltaSecondsPerMile: number; 
  bestControlled: {
    startSegment: number;
    length: number;
    avgPace: number;
    std: number;
  } | null;
}

// Analyze Activity Segments
export const analyzeActivitySegments = (
  activity: Activity,
  segmentMiles = 1,
): SegmentAnalysis => {
  const distanceMiles = kmToMiles(mToKm(activity.distance));
  const totalMiles = Math.max(0.01, distanceMiles);
  const totalMinutes = activity.moving_time / 60;
  const avgPace = totalMinutes / totalMiles; 

  
  const segments = Math.max(1, Math.floor(totalMiles / segmentMiles));

  
  
  const baseSegmentMinutes = totalMinutes / segments;
  
  const segmentPaces = Array.from({ length: segments }).map((_, i) => {
    const t = i / Math.max(1, segments - 1);
    const variation = Math.sin(t * Math.PI * 2) * 0.04 + (t - 0.5) * 0.02; 
    const pace = Math.max(
      0.1,
      Math.round((baseSegmentMinutes / segmentMiles) * (1 + variation) * 100) /
        100,
    );
    return pace;
  });

  const milesPerSegment = segmentMiles;

  
  let easyMiles = 0;
  let hardMiles = 0;
  segmentPaces.forEach((p) => {
    if (p <= avgPace * 0.95) {
      hardMiles += milesPerSegment;
    } else if (p >= avgPace * 1.08) {
      easyMiles += milesPerSegment;
    }
  });

  
  const half = Math.ceil(segments / 2);
  const firstSegs = segmentPaces.slice(0, half);
  const secondSegs = segmentPaces.slice(half);
  // Avg
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const firstHalfPace = Math.round(avg(firstSegs) * 100) / 100;
  const secondHalfPace = Math.round(avg(secondSegs) * 100) / 100;
  const firstSecondDeltaSecondsPerMile = Math.round(
    (secondHalfPace - firstHalfPace) * 60,
  );

  
  const window = Math.min(3, segments);
  let best: { idx: number; len: number; std: number; mean: number } | null =
    null;
  for (let i = 0; i <= segments - window; i++) {
    const slice = segmentPaces.slice(i, i + window);
    const m = avg(slice);
    const variance =
      slice.reduce((s, v) => s + Math.pow(v - m, 2), 0) / slice.length;
    const std = Math.sqrt(variance);
    const score = std + Math.abs(m - avgPace) * 0.2;
    if (!best || score < best.std + Math.abs(best.mean - avgPace) * 0.2) {
      best = { idx: i, len: window, std, mean: m };
    }
  }

  const bestControlled = best
    ? {
        startSegment: best.idx,
        length: best.len,
        avgPace: Math.round(best.mean * 100) / 100,
        std: Math.round(best.std * 100) / 100,
      }
    : null;

  return {
    segments,
    segmentMiles: milesPerSegment,
    segmentPaces,
    easyMiles: Math.round(easyMiles * 10) / 10,
    hardMiles: Math.round(hardMiles * 10) / 10,
    firstHalfPace,
    secondHalfPace,
    firstSecondDeltaSecondsPerMile,
    bestControlled,
  };
};

// Computes activity stats
export const calculateActivityStats = (activities: Activity[]) => {
  const totalDistanceKm =
    activities.reduce((sum, a) => sum + a.distance, 0) / 1000;
  const totalDistanceMiles = kmToMiles(totalDistanceKm);
  const totalElevationFt = metersToFeet(
    activities.reduce((sum, a) => sum + a.total_elevation_gain, 0),
  );
  const avgDistanceMiles =
    activities.length > 0 ? kmToMiles(totalDistanceKm / activities.length) : 0;
  const maxDistanceMiles = kmToMiles(
    mToKm(Math.max(...activities.map((a) => a.distance))),
  );

  return {
    totalDistance: Math.round(totalDistanceMiles),
    totalTime: Math.round(
      activities.reduce((sum, a) => sum + a.moving_time, 0) / 3600,
    ),
    totalElevation: totalElevationFt,
    avgDistance: avgDistanceMiles,
    maxDistance: maxDistanceMiles,
  };
};

export interface BestEffort {
  name: string;
  elapsed_time: number;
  distance: number;
  start_date: string;
  pr_rank: number | null;
}

const BEST_EFFORTS_CACHE_KEY = "nexpr_best_efforts_v1";

// Returns best efforts cache
function loadBestEffortsCache(): Record<
  number,
  { efforts: BestEffort[]; fetchedAt: number }
> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BEST_EFFORTS_CACHE_KEY);
    return raw
      ? (JSON.parse(raw) as Record<
          number,
          { efforts: BestEffort[]; fetchedAt: number }
        >)
      : {};
  } catch {
    return {};
  }
}

// Saves best efforts cache
function saveBestEffortsCache(
  cache: Record<number, { efforts: BestEffort[]; fetchedAt: number }>,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BEST_EFFORTS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    localStorage.removeItem(BEST_EFFORTS_CACHE_KEY);
  }
}

const STRAVA_EFFORT_DISTANCE_MAP: Record<string, RaceDistance> = {
  "5k": "5K",
  "10k": "10K",
  "half marathon": "Half Marathon",
  marathon: "Marathon",
};

const EFFORT_RACE_METERS: Record<RaceDistance, number> = {
  "5K": 5000,
  "10K": 10000,
  "Half Marathon": 21097.5,
  Marathon: 42195,
};

const BEST_EFFORTS_TTL = 24 * 60 * 60 * 1000; 

// React hook: strava p rs
export const useStravaPRs = (activities: Activity[] | undefined) => {
  return useQuery<PRRecord[]>({
    queryKey: ["strava-prs", activities?.length ?? 0],
    queryFn: async (): Promise<PRRecord[]> => {
      if (!activities || activities.length === 0) return [];

      
      const runs = activities
        .filter((a) => a.type === "Run" || a.sport_type === "Run")
        .sort(
          (a, b) =>
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
        );

      
      
      
      let candidates = runs.filter((a) => (a.achievement_count ?? 0) > 0);
      if (candidates.length < 10) {
        candidates = runs;
      }
      candidates = candidates.slice(0, 12);

      
      const cache = loadBestEffortsCache();
      const now = Date.now();
      const toFetch = candidates.filter((a) => {
        const cached = cache[a.id];
        return !cached || now - cached.fetchedAt > BEST_EFFORTS_TTL;
      });

      if (toFetch.length > 0) {
        
        for (let i = 0; i < toFetch.length; i += 2) {
          const batch = toFetch.slice(i, i + 2);
          const results = await Promise.all(
            batch.map((a) =>
              getActivityBestEfforts({
                data: { activityId: a.id },
              }),
            ),
          );
          results.forEach((result, idx) => {
            cache[batch[idx].id] = {
              efforts: result.best_efforts as BestEffort[],
              fetchedAt: now,
            };
          });
        }
        saveBestEffortsCache(cache);
      }

      
      
      
      const bestByDistance = new Map<
        RaceDistance,
        {
          time: number;
          date: string;
          activityId: number;
          activityName: string;
          isConfirmedPR: boolean;
        }
      >();

      for (const run of candidates) {
        const cached = cache[run.id];
        if (!cached) continue;
        for (const effort of cached.efforts) {
          const raceDistance =
            STRAVA_EFFORT_DISTANCE_MAP[effort.name.toLowerCase()];
          if (!raceDistance) continue;
          const isConfirmedPR = effort.pr_rank === 1;
          const existing = bestByDistance.get(raceDistance);

          
          
          const replace =
            !existing ||
            (isConfirmedPR && !existing.isConfirmedPR) ||
            (isConfirmedPR === existing.isConfirmedPR &&
              effort.elapsed_time < existing.time);

          if (replace) {
            bestByDistance.set(raceDistance, {
              time: effort.elapsed_time,
              date: effort.start_date,
              activityId: run.id,
              activityName: run.name,
              isConfirmedPR,
            });
          }
        }
      }

      return Array.from(bestByDistance.entries()).map(
        ([raceDistance, best]) => {
          const distanceMeters = EFFORT_RACE_METERS[raceDistance];
          const miles = kmToMiles(mToKm(distanceMeters));
          return {
            distance: raceDistance,
            time: best.time,
            pace: best.time / 60 / miles,
            date: new Date(best.date),
            activityId: best.activityId,
            activityName: best.activityName,
          } as PRRecord;
        },
      );
    },
    enabled:
      !!activities &&
      activities.length > 0 &&
      typeof window !== "undefined",
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

// React hook: goals
export const useGoals = (athleteId: number | undefined) => {
  return useQuery({
    queryKey: ["goals", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const result = await getGoals({ data: { athleteId } });
      return result as {
        id: string;
        distance: string;
        targetSeconds: number;
        year: number;
      }[];
    },
    enabled: !!athleteId,
    staleTime: 5 * 60 * 1000,
  });
};

// React hook: save goal
export const useSaveGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      athleteId: number;
      distance: string;
      targetSeconds: number;
      year: number;
    }) => saveGoal({ data: input }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["goals", variables.athleteId],
      });
    },
  });
};

// React hook: delete goal
export const useDeleteGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; athleteId: number }) =>
      deleteGoal({ data: input }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["goals", variables.athleteId],
      });
    },
  });
};

// React hook: symptom entries
export const useSymptomEntries = (athleteId: number | undefined) => {
  return useQuery({
    queryKey: ["symptomEntries", athleteId],
    queryFn: async () => {
      if (!athleteId) return [] as SymptomEntry[];
      const result = await getSymptomEntries({ data: { athleteId } });
      return result as SymptomEntry[];
    },
    enabled: !!athleteId,
    staleTime: 2 * 60 * 1000,
  });
};

// React hook: save symptom entry
export const useSaveSymptomEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SymptomEntry & { athleteId: number }) =>
      saveSymptomEntry({
        data: {
          id: input.id,
          athleteId: input.athleteId,
          activityId: Number(input.activityId),
          date: input.date,
          location: input.location,
          trigger: input.trigger,
          warmUpBehavior: input.warmUpBehavior,
          painScale: input.painScale,
          notes: input.notes,
        },
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["symptomEntries", variables.athleteId],
      });
    },
  });
};

// React hook: delete symptom entry
export const useDeleteSymptomEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; athleteId: number }) =>
      deleteSymptomEntry({ data: input }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["symptomEntries", variables.athleteId],
      });
    },
  });
};

// React hook: reflections
export const useReflections = (athleteId: number | undefined) => {
  return useQuery({
    queryKey: ["reflections", athleteId],
    queryFn: async () => {
      if (!athleteId) return [] as WeeklyReflection[];
      const result = await getReflections({ data: { athleteId } });
      return (result as WeeklyReflection[]).map((entry) => ({
        ...entry,
        weekStart: normalizeWeekStart(entry.weekStart),
      }));
    },
    enabled: !!athleteId,
    staleTime: 2 * 60 * 1000,
  });
};

// React hook: save reflection
export const useSaveReflection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WeeklyReflection & { athleteId: number }) =>
      saveReflection({
        data: {
          id: input.id,
          athleteId: input.athleteId,
          weekStart: normalizeWeekStart(input.weekStart),
          whatFeltBetter: input.whatFeltBetter,
          whatFeltWorse: input.whatFeltWorse,
          warningSigns: input.warningSigns,
          changeNextWeek: input.changeNextWeek,
        },
      }),
    onSuccess: (_data, variables) => {
      const { athleteId, ...entry } = variables;
      const normalizedEntry = {
        ...entry,
        weekStart: normalizeWeekStart(entry.weekStart),
      };
      const queryKey = ["reflections", athleteId];
      
      
      queryClient.setQueryData<WeeklyReflection[]>(queryKey, (old = []) => {
        const idx = old.findIndex(
          (r) => normalizeWeekStart(r.weekStart) === normalizedEntry.weekStart,
        );
        if (idx >= 0) {
          return old.map((r, i) => (i === idx ? normalizedEntry : r));
        }
        return [...old, normalizedEntry];
      });
      void queryClient.invalidateQueries({ queryKey });
    },
  });
};

// React hook: delete reflection
export const useDeleteReflection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { weekStart: string; athleteId: number }) =>
      deleteReflection({ data: input }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["reflections", variables.athleteId],
      });
    },
  });
};

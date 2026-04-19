import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStravaAuthUrl, exchangeStravaCode } from "../api/auth";
import { getAthlete, getActivities, getStats } from "../api/strava";

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

export interface Stats {
  recent_run_totals: ActivityTotals;
  all_run_totals: ActivityTotals;
  ytd_run_totals: ActivityTotals;
}

// Auth Hooks
export const useStravaLogin = () => {
  return useMutation({
    mutationFn: async () => {
      const result = await getStravaAuthUrl();
      return result;
    },
    onSuccess: (data) => {
      window.location.href = data.authUrl;
    },
  });
};

export const useStravaCallback = (code: string) => {
  return useMutation({
    mutationFn: async () => {
      if (!code) throw new Error("No code provided");
      const result = await exchangeStravaCode({ data: { code } });
      if (result.accessToken) {
        localStorage.setItem("accessToken", result.accessToken);
        localStorage.setItem("refreshToken", result.refreshToken || "");
        if (result.athlete) {
          localStorage.setItem("athlete", JSON.stringify(result.athlete));
        }
      }
      return result;
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // No server-side logout needed for stateless auth
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("athlete");
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });
};

// Strava API Hooks
export const useAthlete = () => {
  return useQuery({
    queryKey: ["athlete"],
    queryFn: async () => {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) throw new Error("No access token");
      const result = await getAthlete({ data: { accessToken } });
      return result as Athlete;
    },
    enabled: !!localStorage.getItem("accessToken"),
  });
};

export const useActivities = (page: number = 1, perPage: number = 20) => {
  return useQuery({
    queryKey: ["activities", page, perPage],
    queryFn: async () => {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) throw new Error("No access token");
      const result = await getActivities({ data: { accessToken, page, perPage } });
      return result as Activity[];
    },
    enabled: !!localStorage.getItem("accessToken"),
  });
};

export const useStats = (athleteId: number | null) => {
  return useQuery({
    queryKey: ["stats", athleteId],
    queryFn: async () => {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken || !athleteId) throw new Error("Missing athlete context");
      const result = await getStats({
        data: { accessToken, athleteId: athleteId.toString() },
      });
      return result as Stats;
    },
    enabled: !!athleteId && !!localStorage.getItem("accessToken"),
  });
};

// Unit conversion helpers
const KM_TO_MILES = 0.621371;
const METERS_TO_FEET = 3.28084;

export const kmToMiles = (km: number): number => Math.round(km * KM_TO_MILES * 10) / 10;
export const metersToFeet = (meters: number): number => Math.round(meters * METERS_TO_FEET);
export const mToKm = (m: number): number => m / 1000;

// Data aggregation utilities
export interface MileageChartData {
  month: string;
  distance: number;
  activities: number;
  elevation: number;
}

export interface RunStats {
  avgPace: number; // minutes per mile
  avgDistance: number; // miles
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

const isRun = (activity: Activity) =>
  activity.type === "Run" || activity.sport_type === "Run";

const formatDateKey = (date: Date) => date.toISOString().slice(0, 10);

const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
};

export const formatPace = (minutesPerMile: number): string => {
  if (!Number.isFinite(minutesPerMile) || minutesPerMile <= 0) {
    return "--";
  }

  const totalSeconds = Math.round(minutesPerMile * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const formatDurationHours = (seconds: number): string =>
  `${Math.round((seconds / 3600) * 10) / 10}h`;

export const aggregate3MonthData = (activities: Activity[]): MileageChartData[] => {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

  const monthMap = new Map<string, { distance: number; activities: number; elevation: number }>();

  // Initialize last 3 months
  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    monthMap.set(monthKey, { distance: 0, activities: 0, elevation: 0 });
  }

  // Aggregate activities
  activities.forEach((activity) => {
    const activityDate = new Date(activity.start_date);
    if (activityDate >= threeMonthsAgo) {
      const monthKey = activityDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      const existing = monthMap.get(monthKey) || { distance: 0, activities: 0, elevation: 0 };
      monthMap.set(monthKey, {
        distance: existing.distance + activity.distance,
        activities: (existing.activities || 0) + 1,
        elevation: existing.elevation + activity.total_elevation_gain,
      });
    }
  });

  // Convert to array and sort chronologically
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

export const calculate3MonthRunStats = (activities: Activity[]): RunStats => {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

  // Filter for runs only
  const runs = activities.filter(
    (a) =>
      (a.type === "Run" || a.sport_type === "Run") &&
      new Date(a.start_date) >= threeMonthsAgo
  );

  if (runs.length === 0) {
    return { avgPace: 0, avgDistance: 0, totalRuns: 0 };
  }

  const totalDistance = runs.reduce((sum, a) => sum + a.distance, 0);
  const totalTime = runs.reduce((sum, a) => sum + a.moving_time, 0);

  const avgDistanceMiles = kmToMiles(mToKm(totalDistance / runs.length));
  const avgPaceMinPerMile = (totalTime / 60) / kmToMiles(mToKm(totalDistance));

  return {
    avgPace: Math.round(avgPaceMinPerMile * 100) / 100,
    avgDistance: avgDistanceMiles,
    totalRuns: runs.length,
  };
};

export const calculateRunnerBlockStats = (
  activities: Activity[],
  days: number = 28,
): RunnerBlockStats => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  const runs = activities.filter((activity) => isRun(activity) && new Date(activity.start_date) >= cutoff);

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

  const totalDistanceMeters = runs.reduce((sum, activity) => sum + activity.distance, 0);
  const totalMovingTime = runs.reduce((sum, activity) => sum + activity.moving_time, 0);
  const totalMiles = kmToMiles(mToKm(totalDistanceMeters));
  const runDays = new Set(runs.map((activity) => formatDateKey(new Date(activity.start_date)))).size;

  return {
    totalMiles,
    totalRuns: runs.length,
    avgPace: (totalMovingTime / 60) / kmToMiles(mToKm(totalDistanceMeters)),
    longRunMiles: kmToMiles(mToKm(Math.max(...runs.map((activity) => activity.distance)))),
    elevationFeet: metersToFeet(runs.reduce((sum, activity) => sum + activity.total_elevation_gain, 0)),
    runDays,
    weeklyAverageMiles: Math.round((totalMiles / (days / 7)) * 10) / 10,
    consistencyScore: Math.round((runDays / days) * 100),
  };
};

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
      label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      miles: 0,
      runs: 0,
      longRun: 0,
      avgPace: null,
    });
  }

  const paceAccumulator = new Map<string, { distance: number; time: number }>();

  activities
    .filter(isRun)
    .forEach((activity) => {
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
          ? Math.round((((paceData.time / 60) / kmToMiles(mToKm(paceData.distance))) * 100)) / 100
          : null,
    };
  });
};

export const calculateRunHighlights = (activities: Activity[]): RunHighlight[] => {
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
      value: `${formatPace((fastestRun.moving_time / 60) / kmToMiles(mToKm(fastestRun.distance)))}/mi`,
      detail: `${kmToMiles(mToKm(fastestRun.distance))} mi · ${fastestRun.name}`,
    });
  }

  return highlights;
};

export const buildLifetimeRunSnapshot = (stats: Stats): LifetimeRunSnapshot => ({
  recentMiles: Math.round(kmToMiles(mToKm(stats.recent_run_totals.distance)) * 10) / 10,
  recentRuns: stats.recent_run_totals.count,
  ytdMiles: Math.round(kmToMiles(mToKm(stats.ytd_run_totals.distance)) * 10) / 10,
  ytdRuns: stats.ytd_run_totals.count,
  lifetimeMiles: Math.round(kmToMiles(mToKm(stats.all_run_totals.distance)) * 10) / 10,
  lifetimeRuns: stats.all_run_totals.count,
});

export const calculateActivityStats = (activities: Activity[]) => {
  const totalDistanceKm = activities.reduce((sum, a) => sum + a.distance, 0) / 1000;
  const totalDistanceMiles = kmToMiles(totalDistanceKm);
  const totalElevationFt = metersToFeet(activities.reduce((sum, a) => sum + a.total_elevation_gain, 0));
  const avgDistanceMiles = activities.length > 0 ? kmToMiles(totalDistanceKm / activities.length) : 0;
  const maxDistanceMiles = kmToMiles(mToKm(Math.max(...activities.map((a) => a.distance))));

  return {
    totalDistance: Math.round(totalDistanceMiles),
    totalTime: Math.round(activities.reduce((sum, a) => sum + a.moving_time, 0) / 3600),
    totalElevation: totalElevationFt,
    avgDistance: avgDistanceMiles,
    maxDistance: maxDistanceMiles,
  };
};

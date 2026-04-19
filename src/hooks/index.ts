import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStravaAuthUrl, exchangeStravaCode } from "../api/auth";
import { getAthlete, getActivities, getStats, getActivityDetails } from "../api/strava";

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
  distance: number; // in meters
  elapsed_time: number; // in seconds
  moving_time: number; // in seconds
  split: number; // split number (1-indexed)
  pace_zone: number;
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

export const useActivityDetails = (activityId: number | null) => {
  return useQuery({
    queryKey: ["activityDetails", activityId],
    queryFn: async () => {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken || !activityId) throw new Error("Missing context");
      const result = await getActivityDetails({
        data: { accessToken, activityId },
      });
      return result as any; // Strava activity detail response
    },
    enabled: !!activityId && !!localStorage.getItem("accessToken"),
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

const formatDateKey = (date: Date) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const startOfWeek = (date: Date) => {
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

// Long run intelligence helpers
export interface LongRunInsight {
  activityId: number;
  distanceMiles: number;
  avgPace: number; // minutes per mile
  paceCurve: number[]; // minutes per mile per segment
  fatiguePointSegment: number | null; // index where pace degrades
  controlledEnduranceScore: number; // 0-100
  comparison?: {
    prevAvgPace: number | null;
    deltaSecondsPerMile: number | null;
  };
}

export const getLongRuns = (activities: Activity[], minDistanceMiles = 10) =>
  activities
    .map((a) => ({
      ...a,
      distanceMiles: kmToMiles(mToKm(a.distance)),
    }))
    .filter((a) => a.distanceMiles >= minDistanceMiles)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

export const analyzeLongRun = (
  activity: Activity,
  pastActivities: Activity[] = [],
  splits?: Split[],
): LongRunInsight => {
  const distanceMiles = Math.round(kmToMiles(mToKm(activity.distance)) * 10) / 10 || 0;
  const avgPace = distanceMiles > 0 ? (activity.moving_time / 60) / distanceMiles : 0;

  let paceCurve: number[];

  if (splits && splits.length > 0) {
    // Use actual splits from Strava (each split is typically 1 mile)
    paceCurve = splits.map((split) => {
      const splitMiles = kmToMiles(mToKm(split.distance));
      const splitMinutes = split.moving_time / 60;
      return Math.round((splitMinutes / splitMiles) * 100) / 100;
    });
  } else {
    // Fallback: estimate based on whole miles
    const segCount = Math.max(1, Math.floor(distanceMiles));
    const hr = activity.average_heartrate || 0;
    const driftFactor = hr ? Math.min(0.35, Math.max(0, (hr - 120) / 250)) : 0.12;

    paceCurve = Array.from({ length: segCount }).map((_, i) => {
      const t = segCount > 1 ? i / (segCount - 1) : 0;
      // early segments a bit faster, late segments slower by driftFactor
      return Math.round((avgPace * (1 + driftFactor * t)) * 100) / 100;
    });
  }

  // detect first segment where pace exceeds baseline by 15%
  const fatigueIdx = paceCurve.findIndex((p) => p > avgPace * 1.15);

  // controlled endurance score: higher when pace variance low and drift small
  const mean = avgPace;
  const variance = paceCurve.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / paceCurve.length;
  const std = Math.sqrt(variance);
  const consistency = Math.max(0, 1 - std / mean); // 0..1
  const driftPenalty = splits && splits.length > 0 ? 0 : 0.12; // less penalty if using real splits
  const score = Math.round(Math.max(0, Math.min(100, (consistency * 100) - driftPenalty * 20)));

  // comparison: find previous long runs of similar distance (+-10%) and compute avg pace
  const similar = pastActivities
    .map((a) => ({ ...a, distanceMiles: kmToMiles(mToKm(a.distance)) }))
    .filter((a) => a.id !== activity.id && Math.abs(a.distanceMiles - distanceMiles) / distanceMiles <= 0.1)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  const prev = similar.length > 0 ? similar[0] : null;
  const prevAvgPace = prev ? (prev.moving_time / 60) / (prev.distance ? kmToMiles(mToKm(prev.distance)) : 1) : null;

  const deltaSecondsPerMile = prevAvgPace != null ? Math.round((avgPace - prevAvgPace) * 60) : null;

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

// Weekly training structure analysis
export interface WeeklySummaryWeek {
  weekStart: string;
  label: string;
  miles: number;
  runDays: number;
  longRunMiles: number;
}

export interface WeeklyTrainingAnalysis {
  weeks: WeeklySummaryWeek[]; // last N weeks oldest->newest
  volumeTrendPercentChange: number | null; // last vs previous week
  percentEasy: number; // last week % of miles at easy effort
  percentHard: number; // last week % of miles at hard effort
  restConsistencyScore: number; // 0-100
  longRunProportionLastWeek: number; // percent of miles from long runs
}

export const analyzeWeeklyTraining = (
  activities: Activity[],
  weeks: number = 8,
  longRunThresholdMiles: number = 8,
) : WeeklyTrainingAnalysis => {
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
    runDaysMap.get(weekStart)!.add(new Date(activity.start_date).toISOString().slice(0,10));
    if (miles >= longRunThresholdMiles) {
      bucket.longRunMiles = Math.round((bucket.longRunMiles + miles) * 10) / 10;
    }
  });

  // finalize runDays
  for (const [key, bucket] of weekBuckets.entries()) {
    bucket.runDays = runDaysMap.get(key)?.size ?? 0;
  }

  const weeksArr = Array.from(weekBuckets.values());

  // compute volume trend: compare last week and previous week
  const last = weeksArr[weeksArr.length - 1];
  const prev = weeksArr[weeksArr.length - 2] ?? null;
  const volumeTrendPercentChange = prev && prev.miles > 0 ? Math.round(((last.miles - prev.miles) / prev.miles) * 100) : null;

  // classify runs in last week into easy/moderate/hard using HR if available else relative pace
  const lastWeekKey = last.weekStart;
  const runsLastWeek = activities.filter(
    (a) => isRun(a) && formatDateKey(startOfWeek(new Date(a.start_date))) === lastWeekKey,
  );
  let easyMiles = 0;
  let hardMiles = 0;
  let totalMiles = 0;

  // compute week avg pace for relative classification
  const weekTotalDistanceMeters = runsLastWeek.reduce((s, r) => s + r.distance, 0);
  const weekTotalTime = runsLastWeek.reduce((s, r) => s + r.moving_time, 0);
  const weekAvgPace = weekTotalDistanceMeters > 0 ? (weekTotalTime / 60) / kmToMiles(mToKm(weekTotalDistanceMeters)) : 0;

  runsLastWeek.forEach((r) => {
    const miles = kmToMiles(mToKm(r.distance));
    totalMiles += miles;
    if (r.average_heartrate && r.average_heartrate > 0) {
      const hr = r.average_heartrate;
      if (hr < 130) easyMiles += miles;
      else if (hr > 155) hardMiles += miles;
      else {
        // moderate
      }
    } else if (weekAvgPace > 0) {
      const pace = (r.moving_time / 60) / (miles || 1);
      if (pace <= weekAvgPace * 0.95) hardMiles += miles;
      else if (pace >= weekAvgPace * 1.08) easyMiles += miles;
    }
  });

  // compute percentages and ensure they sum to 100 by assigning remainder to moderate
  const easyPct = totalMiles > 0 ? Math.round((easyMiles / totalMiles) * 100) : 0;
  const hardPct = totalMiles > 0 ? Math.round((hardMiles / totalMiles) * 100) : 0;
  const moderatePct = Math.max(0, 100 - easyPct - hardPct);

  // rest consistency: compute rest days per week (7 - runDays) and score
  const restDays = weeksArr.map((w) => 7 - w.runDays);
  const mean = restDays.reduce((s, v) => s + v, 0) / restDays.length;
  const variance = restDays.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / restDays.length;
  const std = Math.sqrt(variance);
  const restConsistencyScore = Math.max(0, Math.min(100, Math.round(100 - std * 18)));

  // Longest run share: percentage of longest run in last week vs total weekly miles
  let longestRunMiles = 0;
  runsLastWeek.forEach((r) => {
    const miles = kmToMiles(mToKm(r.distance));
    longestRunMiles = Math.max(longestRunMiles, miles);
  });
  const longRunProportionLastWeek = last.miles > 0 ? Math.round((longestRunMiles / last.miles) * 100) : 0;

  return {
    weeks: weeksArr,
    volumeTrendPercentChange,
    // return both miles and percentages
    easyMiles: Math.round(easyMiles * 10) / 10,
    hardMiles: Math.round(hardMiles * 10) / 10,
    percentEasy: easyPct,
    percentModerate: moderatePct,
    percentHard: hardPct,
    restConsistencyScore,
    longRunProportionLastWeek,
  };
};

// Segment + effort breakdown for a single activity (simple estimates)
export interface SegmentAnalysis {
  segments: number;
  segmentMiles: number;
  segmentPaces: number[]; // minutes per mile
  easyMiles: number;
  hardMiles: number;
  firstHalfPace: number; // min/mi
  secondHalfPace: number; // min/mi
  firstSecondDeltaSecondsPerMile: number; // positive = second half slower
  bestControlled: {
    startSegment: number;
    length: number;
    avgPace: number;
    std: number;
  } | null;
}

export const analyzeActivitySegments = (activity: Activity, segmentMiles = 1): SegmentAnalysis => {
  const distanceMiles = kmToMiles(mToKm(activity.distance));
  const totalMiles = Math.max(0.01, distanceMiles);
  const totalMinutes = activity.moving_time / 60;
  const avgPace = totalMinutes / totalMiles; // min per mile

  // number of segments (round down to whole segments)
  const segments = Math.max(1, Math.floor(totalMiles / segmentMiles));

  // estimate each segment pace by distributing time proportionally
  // (this is a simple estimate — replace with split streams if available)
  const baseSegmentMinutes = totalMinutes / segments;
  // add small deterministic variation using segment index
  const segmentPaces = Array.from({ length: segments }).map((_, i) => {
    const t = i / Math.max(1, segments - 1);
    const variation = (Math.sin(t * Math.PI * 2) * 0.04 + (t - 0.5) * 0.02); // small wave
    const pace = Math.max(0.1, Math.round(((baseSegmentMinutes) / segmentMiles) * (1 + variation) * 100) / 100);
    return pace;
  });

  const milesPerSegment = segmentMiles;

  // classify easy/hard per segment relative to run avg
  let easyMiles = 0;
  let hardMiles = 0;
  segmentPaces.forEach((p) => {
    if (p <= avgPace * 0.95) {
      hardMiles += milesPerSegment;
    } else if (p >= avgPace * 1.08) {
      easyMiles += milesPerSegment;
    }
  });

  // first vs second half
  const half = Math.ceil(segments / 2);
  const firstSegs = segmentPaces.slice(0, half);
  const secondSegs = segmentPaces.slice(half);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const firstHalfPace = Math.round(avg(firstSegs) * 100) / 100;
  const secondHalfPace = Math.round(avg(secondSegs) * 100) / 100;
  const firstSecondDeltaSecondsPerMile = Math.round((secondHalfPace - firstHalfPace) * 60);

  // best controlled section: sliding window of 3 segments (or smaller) with minimal std and close to avg
  const window = Math.min(3, segments);
  let best: { idx: number; len: number; std: number; mean: number } | null = null;
  for (let i = 0; i <= segments - window; i++) {
    const slice = segmentPaces.slice(i, i + window);
    const m = avg(slice);
    const variance = slice.reduce((s, v) => s + Math.pow(v - m, 2), 0) / slice.length;
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

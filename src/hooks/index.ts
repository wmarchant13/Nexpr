import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStravaAuthUrl, exchangeStravaCode } from "../api/auth";
import { getAthlete, getActivities } from "../api/strava";

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

import { createServerFn } from "@tanstack/react-start";
import { fetchStrava } from "../utils/server/strava";
import { requireStravaAccess } from "../utils/server/stravaSession";
import { requireNumber } from "../utils/server/validation";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type StravaAthlete = {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  profile_medium: string;
  profile: string;
  city: string;
  state: string;
  country: string;
};

type StravaActivity = {
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
};

type StravaActivityTotals = {
  count: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_gain: number;
};

type StravaStats = {
  recent_run_totals: StravaActivityTotals;
  all_run_totals: StravaActivityTotals;
  ytd_run_totals: StravaActivityTotals;
};

type StravaActivityDetails = { [key: string]: JsonValue };

type StravaBestEffortsResponse = {
  id: number;
  best_efforts: Array<{
    name: string;
    elapsed_time: number;
    distance: number;
    start_date: string;
    pr_rank: number | null;
  }>;
};

// Fetches the authenticated athlete's profile
export const getAthlete = createServerFn({ method: "GET" }).handler(
  async (): Promise<StravaAthlete> => {
    const { accessToken } = await requireStravaAccess();
    return fetchStrava<StravaAthlete>("/athlete", accessToken, {
      ttlMs: 5 * 60 * 1000,
    });
  },
);

// Fetches a paginated list of athlete activities
export const getActivities = createServerFn({ method: "GET" })
  .inputValidator((input: { page?: number; perPage?: number }) => input)
  .handler(async ({ data }): Promise<StravaActivity[]> => {
    const { accessToken } = await requireStravaAccess();
    const page = requireNumber(data.page ?? 1, "page", {
      integer: true,
      min: 1,
      max: 200,
    });
    const perPage = requireNumber(data.perPage ?? 20, "perPage", {
      integer: true,
      min: 1,
      max: 100,
    });
    return fetchStrava<StravaActivity[]>(
      `/athlete/activities?page=${page}&per_page=${perPage}`,
      accessToken,
      { ttlMs: 60_000 },
    );
  });

// Fetches lifetime running stats for the athlete
export const getStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<StravaStats> => {
    const { athleteId, accessToken } = await requireStravaAccess();
    return fetchStrava<StravaStats>(
      `/athletes/${athleteId}/stats`,
      accessToken,
      {
        ttlMs: 5 * 60 * 1000,
      },
    );
  },
);

// Fetches full details for a single activity
export const getActivityDetails = createServerFn({ method: "GET" })
  .inputValidator((input: { activityId: number }) => input)
  .handler(async ({ data }): Promise<StravaActivityDetails> => {
    const { accessToken } = await requireStravaAccess();
    return fetchStrava<StravaActivityDetails>(
      `/activities/${requireNumber(data.activityId, "activityId", { integer: true, min: 1 })}?include_all_efforts=false`,
      accessToken,
      { ttlMs: 10 * 60 * 1000 },
    );
  });

// Fetches best efforts logged on a single activity
export const getActivityBestEfforts = createServerFn({ method: "GET" })
  .inputValidator((input: { activityId: number }) => input)
  .handler(async ({ data }): Promise<StravaBestEffortsResponse> => {
    const { accessToken } = await requireStravaAccess();
    const activityId = requireNumber(data.activityId, "activityId", {
      integer: true,
      min: 1,
    });
    const result = await fetchStrava<any>(
      `/activities/${activityId}?include_all_efforts=true`,
      accessToken,
      { ttlMs: 10 * 60 * 1000 },
    );
    return {
      id: activityId,
      best_efforts: (result.best_efforts ?? []) as Array<{
        name: string;
        elapsed_time: number;
        distance: number;
        start_date: string;
        pr_rank: number | null;
      }>,
    };
  });

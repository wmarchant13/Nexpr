import { createServerFn } from "@tanstack/react-start";
import { fetchStrava } from "../utils/server/strava";
import { requireStravaAccess } from "../utils/server/stravaSession";
import { requireNumber } from "../utils/server/validation";

export const getAthlete = createServerFn({ method: "GET" })
  .handler(async () => {
    const { accessToken } = await requireStravaAccess();
    return fetchStrava("/athlete", accessToken, {
      ttlMs: 5 * 60 * 1000,
    });
  });

export const getActivities = createServerFn({ method: "GET" })
  .inputValidator((input: { page?: number; perPage?: number }) => input)
  .handler(async ({ data }) => {
    const { accessToken } = await requireStravaAccess();
    const page = requireNumber(data.page ?? 1, "page", { integer: true, min: 1, max: 200 });
    const perPage = requireNumber(data.perPage ?? 20, "perPage", {
      integer: true,
      min: 1,
      max: 100,
    });
    return fetchStrava(
      `/athlete/activities?page=${page}&per_page=${perPage}`,
      accessToken,
      { ttlMs: 60_000 },
    );
  });

export const getStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { athleteId, accessToken } = await requireStravaAccess();
    return fetchStrava(`/athletes/${athleteId}/stats`, accessToken, {
      ttlMs: 5 * 60 * 1000,
    });
  });

export const getActivityDetails = createServerFn({ method: "GET" })
  .inputValidator((input: { activityId: number }) => input)
  .handler(async ({ data }) => {
    const { accessToken } = await requireStravaAccess();
    return fetchStrava(
      `/activities/${requireNumber(data.activityId, "activityId", { integer: true, min: 1 })}?include_all_efforts=false`,
      accessToken,
      { ttlMs: 10 * 60 * 1000 },
    );
  });

export const getActivityBestEfforts = createServerFn({ method: "GET" })
  .inputValidator((input: { activityId: number }) => input)
  .handler(async ({ data }) => {
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

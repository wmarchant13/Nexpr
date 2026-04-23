import { createServerFn } from "@tanstack/react-start";

let stravaRateLimitedUntil = 0;

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

async function fetchFromStrava(endpoint: string, accessToken: string) {
  if (Date.now() < stravaRateLimitedUntil) {
    const waitSeconds = Math.ceil((stravaRateLimitedUntil - Date.now()) / 1000);
    throw new Error(
      `Strava API rate limit active. Try again in about ${waitSeconds} seconds.`,
    );
  }

  const response = await fetch(`https://www.strava.com/api/v3${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      stravaRateLimitedUntil = Date.now() + getRetryAfterMs(response);
      throw new Error("Strava API rate limit exceeded. Please wait a minute and retry.");
    }

    const error = await response.json();
    throw new Error(
      `Strava API error: ${error.message || response.statusText}`,
    );
  }

  stravaRateLimitedUntil = 0;

  return response.json();
}

export const getAthlete = createServerFn({ method: "GET" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => fetchFromStrava("/athlete", data.accessToken));

export const getActivities = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { accessToken: string; page?: number; perPage?: number }) => input,
  )
  .handler(async ({ data }) => {
    const { accessToken, page = 1, perPage = 20 } = data;
    return fetchFromStrava(
      `/athlete/activities?page=${page}&per_page=${perPage}`,
      accessToken,
    );
  });

export const getStats = createServerFn({ method: "GET" })
  .inputValidator((input: { accessToken: string; athleteId: string }) => input)
  .handler(async ({ data }) =>
    fetchFromStrava(`/athletes/${data.athleteId}/stats`, data.accessToken),
  );

export const getActivityDetails = createServerFn({ method: "GET" })
  .inputValidator((input: { accessToken: string; activityId: number }) => input)
  .handler(async ({ data }) =>
    fetchFromStrava(
      `/activities/${data.activityId}?include_all_efforts=false`,
      data.accessToken,
    ),
  );

export const getActivityBestEfforts = createServerFn({ method: "GET" })
  .inputValidator((input: { accessToken: string; activityId: number }) => input)
  .handler(async ({ data }) => {
    const result = await fetchFromStrava(
      `/activities/${data.activityId}?include_all_efforts=true`,
      data.accessToken,
    );
    return {
      id: data.activityId,
      best_efforts: (result.best_efforts ?? []) as Array<{
        name: string;
        elapsed_time: number;
        distance: number;
        start_date: string;
        pr_rank: number | null;
      }>,
    };
  });

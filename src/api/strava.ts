import { createServerFn } from "@tanstack/react-start";

async function fetchFromStrava(endpoint: string, accessToken: string) {
  const response = await fetch(`https://www.strava.com/api/v3${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Strava API error: ${error.message || response.statusText}`,
    );
  }

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
  .inputValidator(
    (input: { accessToken: string; activityId: number }) => input,
  )
  .handler(async ({ data }) =>
    fetchFromStrava(
      `/activities/${data.activityId}?include_all_efforts=false`,
      data.accessToken,
    ),
  );

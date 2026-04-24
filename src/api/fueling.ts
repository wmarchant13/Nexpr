

import { createServerFn } from "@tanstack/react-start";
import { getDb, toRows } from "../utils/server/env";
import {
  optionalString,
  requireEnumValue,
  requireNumber,
} from "../utils/server/validation";

const FUELING_TIMINGS = ["none", "light", "moderate", "heavy"] as const;

export interface FuelingEntryRow {
  id: number;
  athlete_id: number;
  activity_id: number;
  carbs_grams: number | null;
  gels_count: number | null;
  hydration_ml: number | null;
  caffeine_count: number | null;
  timing_before: string | null;
  timing_during: string | null;
  timing_after: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FuelingEntryInput {
  athleteId: number;
  activityId: number;
  carbsGrams?: number;
  gelsCount?: number;
  hydrationMl?: number;
  caffeineCount?: number;
  timingBefore?: string;
  timingDuring?: string;
  timingAfter?: string;
  note?: string;
}

// Fetches the fueling entry for a single activity
export const getFuelingEntry = createServerFn({ method: "GET" })
  .inputValidator((input: { activityId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const activityId = requireNumber(data.activityId, "activityId", {
      integer: true,
      min: 1,
    });

    const rows = toRows<FuelingEntryRow>(
      await sql`
      SELECT * FROM fueling_entries 
      WHERE activity_id = ${activityId}
      LIMIT 1
    `,
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      activityId: row.activity_id,
      carbsGrams: row.carbs_grams ?? undefined,
      gelsCount: row.gels_count ?? undefined,
      hydrationMl: row.hydration_ml ?? undefined,
      caffeineCount: row.caffeine_count ?? undefined,
      timing: {
        beforeRun: row.timing_before as any,
        duringRun: row.timing_during as any,
        afterRun: row.timing_after as any,
      },
      note: row.note ?? undefined,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  });

// Fetches all fueling entries for an athlete
export const getAllFuelingEntries = createServerFn({ method: "GET" })
  .inputValidator((input: { athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const athleteId = requireNumber(data.athleteId, "athleteId", {
      integer: true,
      min: 1,
    });

    const rows = toRows<FuelingEntryRow>(
      await sql`
      SELECT * FROM fueling_entries 
      WHERE athlete_id = ${athleteId}
      ORDER BY created_at DESC
    `,
    );

    return rows.map((row) => ({
      activityId: row.activity_id,
      carbsGrams: row.carbs_grams ?? undefined,
      gelsCount: row.gels_count ?? undefined,
      hydrationMl: row.hydration_ml ?? undefined,
      caffeineCount: row.caffeine_count ?? undefined,
      timing: {
        beforeRun: row.timing_before as any,
        duringRun: row.timing_during as any,
        afterRun: row.timing_after as any,
      },
      note: row.note ?? undefined,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }));
  });

// Upserts a fueling entry for an activity
export const saveFuelingEntry = createServerFn({ method: "POST" })
  .inputValidator((input: FuelingEntryInput) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const athleteId = requireNumber(data.athleteId, "athleteId", {
      integer: true,
      min: 1,
    });
    const activityId = requireNumber(data.activityId, "activityId", {
      integer: true,
      min: 1,
    });
    const carbsGrams =
      data.carbsGrams == null
        ? null
        : requireNumber(data.carbsGrams, "carbsGrams", {
            integer: true,
            min: 0,
            max: 500,
          });
    const gelsCount =
      data.gelsCount == null
        ? null
        : requireNumber(data.gelsCount, "gelsCount", {
            integer: true,
            min: 0,
            max: 20,
          });
    const hydrationMl =
      data.hydrationMl == null
        ? null
        : requireNumber(data.hydrationMl, "hydrationMl", {
            integer: true,
            min: 0,
            max: 5000,
          });
    const caffeineCount =
      data.caffeineCount == null
        ? null
        : requireNumber(data.caffeineCount, "caffeineCount", {
            integer: true,
            min: 0,
            max: 10,
          });
    const timingBefore =
      data.timingBefore == null
        ? null
        : requireEnumValue(data.timingBefore, "timingBefore", FUELING_TIMINGS);
    const timingDuring =
      data.timingDuring == null
        ? null
        : requireEnumValue(data.timingDuring, "timingDuring", FUELING_TIMINGS);
    const timingAfter =
      data.timingAfter == null
        ? null
        : requireEnumValue(data.timingAfter, "timingAfter", FUELING_TIMINGS);
    const note = optionalString(data.note, "note", 1000);

    const now = new Date().toISOString();

    await sql`
      INSERT INTO fueling_entries (
        athlete_id,
        activity_id,
        carbs_grams,
        gels_count,
        hydration_ml,
        caffeine_count,
        timing_before,
        timing_during,
        timing_after,
        note,
        created_at,
        updated_at
      ) VALUES (
        ${athleteId},
        ${activityId},
        ${carbsGrams},
        ${gelsCount},
        ${hydrationMl},
        ${caffeineCount},
        ${timingBefore},
        ${timingDuring},
        ${timingAfter},
        ${note},
        ${now},
        ${now}
      )
      ON CONFLICT (activity_id) DO UPDATE SET
        carbs_grams = EXCLUDED.carbs_grams,
        gels_count = EXCLUDED.gels_count,
        hydration_ml = EXCLUDED.hydration_ml,
        caffeine_count = EXCLUDED.caffeine_count,
        timing_before = EXCLUDED.timing_before,
        timing_during = EXCLUDED.timing_during,
        timing_after = EXCLUDED.timing_after,
        note = EXCLUDED.note,
        updated_at = ${now}
    `;

    return { success: true, activityId };
  });

// Removes a fueling entry for an activity
export const deleteFuelingEntry = createServerFn({ method: "POST" })
  .inputValidator((input: { athleteId: number; activityId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const athleteId = requireNumber(data.athleteId, "athleteId", {
      integer: true,
      min: 1,
    });
    const activityId = requireNumber(data.activityId, "activityId", {
      integer: true,
      min: 1,
    });

    await sql`
      DELETE FROM fueling_entries 
      WHERE activity_id = ${activityId}
        AND athlete_id = ${athleteId}
    `;

    return { success: true, activityId };
  });

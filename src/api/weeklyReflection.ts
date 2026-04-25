import { createServerFn } from "@tanstack/react-start";
import { normalizeWeekStart } from "../store/weeklyReflection";
import { getDb } from "../utils/server/env";
import { requireCurrentStravaSession } from "../utils/server/stravaSession";
import {
  requireDateKey,
  requireNumber,
  requireString,
  requireUuidLike,
} from "../utils/server/validation";

export interface ReflectionRow {
  id: string;
  athlete_id: number;
  week_start: string;
  what_felt_better: string | null;
  what_felt_worse: string | null;
  warning_signs: string | null;
  change_next_week: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReflectionInput {
  id: string;
  athleteId: number;
  weekStart: string;
  whatFeltBetter: string;
  whatFeltWorse: string;
  warningSigns: string;
  changeNextWeek: string;
}

// Fetches all weekly reflections for an athlete
export const getReflections = createServerFn({ method: "GET" })
  .inputValidator((input: { athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const session = await requireCurrentStravaSession();
    const athleteId = requireNumber(data.athleteId, "athleteId", {
      integer: true,
      min: 1,
    });
    if (athleteId !== session.athleteId) {
      throw new Response("Forbidden", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const rows = await sql`
      SELECT * FROM weekly_reflections
      WHERE athlete_id = ${athleteId}
      ORDER BY week_start DESC
    `;
    return (rows as ReflectionRow[]).map((r) => ({
      id: r.id,
      weekStart: normalizeWeekStart(String(r.week_start)),
      whatFeltBetter: r.what_felt_better ?? "",
      whatFeltWorse: r.what_felt_worse ?? "",
      warningSigns: r.warning_signs ?? "",
      changeNextWeek: r.change_next_week ?? "",
      createdAt: new Date(r.created_at).getTime(),
    }));
  });

// Upserts a weekly reflection entry
export const saveReflection = createServerFn({ method: "POST" })
  .inputValidator((input: ReflectionInput) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const session = await requireCurrentStravaSession();
    const now = new Date().toISOString();
    const id = requireUuidLike(data.id, "id");
    const athleteId = requireNumber(data.athleteId, "athleteId", {
      integer: true,
      min: 1,
    });
    if (athleteId !== session.athleteId) {
      throw new Response("Forbidden", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const weekStart = normalizeWeekStart(
      requireDateKey(data.weekStart, "weekStart"),
    );
    const whatFeltBetter = requireString(
      data.whatFeltBetter,
      "whatFeltBetter",
      { maxLength: 1000, optional: true },
    );
    const whatFeltWorse = requireString(data.whatFeltWorse, "whatFeltWorse", {
      maxLength: 1000,
      optional: true,
    });
    const warningSigns = requireString(data.warningSigns, "warningSigns", {
      maxLength: 1000,
      optional: true,
    });
    const changeNextWeek = requireString(
      data.changeNextWeek,
      "changeNextWeek",
      { maxLength: 1000, optional: true },
    );
    await sql`
      INSERT INTO weekly_reflections
        (id, athlete_id, week_start, what_felt_better, what_felt_worse,
         warning_signs, change_next_week, created_at, updated_at)
      VALUES
        (${id}, ${athleteId}, ${weekStart},
         ${whatFeltBetter}, ${whatFeltWorse},
         ${warningSigns}, ${changeNextWeek}, ${now}, ${now})
      ON CONFLICT (athlete_id, week_start) DO UPDATE SET
        what_felt_better = EXCLUDED.what_felt_better,
        what_felt_worse  = EXCLUDED.what_felt_worse,
        warning_signs    = EXCLUDED.warning_signs,
        change_next_week = EXCLUDED.change_next_week,
        updated_at       = ${now}
    `;
    return { success: true };
  });

// Removes a weekly reflection by week start
export const deleteReflection = createServerFn({ method: "POST" })
  .inputValidator((input: { weekStart: string; athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const session = await requireCurrentStravaSession();
    const athleteId = requireNumber(data.athleteId, "athleteId", {
      integer: true,
      min: 1,
    });
    if (athleteId !== session.athleteId) {
      throw new Response("Forbidden", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const weekStart = normalizeWeekStart(
      requireDateKey(data.weekStart, "weekStart"),
    );
    await sql`
      DELETE FROM weekly_reflections
      WHERE athlete_id = ${athleteId} AND week_start = ${weekStart}
    `;
    return { success: true };
  });

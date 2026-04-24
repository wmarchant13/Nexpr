import { createServerFn } from "@tanstack/react-start";
import { neon } from "@neondatabase/serverless";
import { normalizeWeekStart } from "../store/weeklyReflection";

function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  return neon(databaseUrl);
}

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

export const getReflections = createServerFn({ method: "GET" })
  .inputValidator((input: { athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM weekly_reflections
      WHERE athlete_id = ${data.athleteId}
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

export const saveReflection = createServerFn({ method: "POST" })
  .inputValidator((input: ReflectionInput) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const now = new Date().toISOString();
    const weekStart = normalizeWeekStart(data.weekStart);
    await sql`
      INSERT INTO weekly_reflections
        (id, athlete_id, week_start, what_felt_better, what_felt_worse,
         warning_signs, change_next_week, created_at, updated_at)
      VALUES
        (${data.id}, ${data.athleteId}, ${weekStart},
         ${data.whatFeltBetter}, ${data.whatFeltWorse},
         ${data.warningSigns}, ${data.changeNextWeek}, ${now}, ${now})
      ON CONFLICT (athlete_id, week_start) DO UPDATE SET
        what_felt_better = EXCLUDED.what_felt_better,
        what_felt_worse  = EXCLUDED.what_felt_worse,
        warning_signs    = EXCLUDED.warning_signs,
        change_next_week = EXCLUDED.change_next_week,
        updated_at       = ${now}
    `;
    return { success: true };
  });

export const deleteReflection = createServerFn({ method: "POST" })
  .inputValidator((input: { weekStart: string; athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const weekStart = normalizeWeekStart(data.weekStart);
    await sql`
      DELETE FROM weekly_reflections
      WHERE athlete_id = ${data.athleteId} AND week_start = ${weekStart}
    `;
    return { success: true };
  });

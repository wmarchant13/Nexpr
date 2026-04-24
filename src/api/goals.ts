import { createServerFn } from "@tanstack/react-start";
import { getDb } from "../utils/server/env";
import { requireEnumValue, requireNumber, requireString } from "../utils/server/validation";

const GOAL_DISTANCES = ["5K", "10K", "Half Marathon", "Marathon"] as const;

export interface GoalRow {
  id: string;
  athlete_id: number;
  distance: string;
  target_seconds: number;
  year: number;
  created_at: string;
}

export interface GoalInput {
  athleteId: number;
  distance: string;
  targetSeconds: number;
  year: number;
}

export const getGoals = createServerFn({ method: "GET" })
  .inputValidator((input: { athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const athleteId = requireNumber(data.athleteId, "athleteId", { integer: true, min: 1 });
    const rows = await sql`
      SELECT * FROM distance_goals
      WHERE athlete_id = ${athleteId}
      ORDER BY created_at ASC
    `;
    return (rows as GoalRow[]).map((r) => ({
      id: r.id,
      distance: r.distance,
      targetSeconds: r.target_seconds,
      year: r.year,
    }));
  });

export const saveGoal = createServerFn({ method: "POST" })
  .inputValidator((input: GoalInput) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const athleteId = requireNumber(data.athleteId, "athleteId", { integer: true, min: 1 });
    const distance = requireEnumValue(data.distance, "distance", GOAL_DISTANCES);
    const targetSeconds = requireNumber(data.targetSeconds, "targetSeconds", {
      integer: true,
      min: 1,
      max: 60 * 60 * 24,
    });
    const year = requireNumber(data.year, "year", { integer: true, min: 2020, max: 2100 });
    const rows = await sql`
      INSERT INTO distance_goals (athlete_id, distance, target_seconds, year)
      VALUES (${athleteId}, ${distance}, ${targetSeconds}, ${year})
      RETURNING id
    `;
    return { id: (rows[0] as { id: string }).id };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const id = requireString(data.id, "id", { minLength: 1, maxLength: 64 });
    const athleteId = requireNumber(data.athleteId, "athleteId", { integer: true, min: 1 });
    await sql`
      DELETE FROM distance_goals
      WHERE id = ${id} AND athlete_id = ${athleteId}
    `;
    return { success: true };
  });

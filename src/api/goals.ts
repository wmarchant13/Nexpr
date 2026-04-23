import { createServerFn } from "@tanstack/react-start";
import { neon } from "@neondatabase/serverless";

function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  return neon(databaseUrl);
}

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
    const rows = await sql`
      SELECT * FROM distance_goals
      WHERE athlete_id = ${data.athleteId}
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
    const rows = await sql`
      INSERT INTO distance_goals (athlete_id, distance, target_seconds, year)
      VALUES (${data.athleteId}, ${data.distance}, ${data.targetSeconds}, ${data.year})
      RETURNING id
    `;
    return { id: (rows[0] as { id: string }).id };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    await sql`
      DELETE FROM distance_goals
      WHERE id = ${data.id} AND athlete_id = ${data.athleteId}
    `;
    return { success: true };
  });

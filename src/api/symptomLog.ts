import { createServerFn } from "@tanstack/react-start";
import { neon } from "@neondatabase/serverless";
import type { SymptomTrigger, WarmUpBehavior } from "../store/symptomLog";

function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  return neon(databaseUrl);
}

export interface SymptomRow {
  id: string;
  athlete_id: number;
  activity_id: number;
  date: string;
  location: string;
  trigger: string;
  warm_up_behavior: string;
  pain_scale: number;
  notes: string | null;
  created_at: string;
}

export interface SymptomInput {
  id: string;
  athleteId: number;
  activityId: number;
  date: string;
  location: string;
  trigger: SymptomTrigger;
  warmUpBehavior: WarmUpBehavior;
  painScale: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export const getSymptomEntries = createServerFn({ method: "GET" })
  .inputValidator((input: { athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM symptom_log
      WHERE athlete_id = ${data.athleteId}
      ORDER BY date DESC, created_at DESC
    `;
    return (rows as SymptomRow[]).map((r) => ({
      id: r.id,
      activityId: String(r.activity_id),
      date: r.date,
      location: r.location,
      trigger: r.trigger as SymptomTrigger,
      warmUpBehavior: r.warm_up_behavior as WarmUpBehavior,
      painScale: r.pain_scale as 1 | 2 | 3 | 4 | 5,
      notes: r.notes ?? undefined,
    }));
  });

export const saveSymptomEntry = createServerFn({ method: "POST" })
  .inputValidator((input: SymptomInput) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    await sql`
      INSERT INTO symptom_log
        (id, athlete_id, activity_id, date, location, trigger, warm_up_behavior, pain_scale, notes)
      VALUES
        (${data.id}, ${data.athleteId}, ${data.activityId}, ${data.date},
         ${data.location}, ${data.trigger}, ${data.warmUpBehavior},
         ${data.painScale}, ${data.notes ?? null})
    `;
    return { success: true };
  });

export const deleteSymptomEntry = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    await sql`
      DELETE FROM symptom_log
      WHERE id = ${data.id} AND athlete_id = ${data.athleteId}
    `;
    return { success: true };
  });

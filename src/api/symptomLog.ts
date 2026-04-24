import { createServerFn } from "@tanstack/react-start";
import type { SymptomTrigger, WarmUpBehavior } from "../store/symptomLog";
import { getDb } from "../utils/server/env";
import {
  optionalString,
  requireDateKey,
  requireEnumValue,
  requireNumber,
  requireString,
  requireUuidLike,
} from "../utils/server/validation";

const SYMPTOM_TRIGGERS = ["during", "after", "next-day"] as const;
const WARMUP_BEHAVIORS = ["improves", "same", "worsens"] as const;

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

//Get symptoms if logged for an activity
export const getSymptomEntries = createServerFn({ method: "GET" })
  .inputValidator((input: { athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const athleteId = requireNumber(data.athleteId, "athleteId", {
      integer: true,
      min: 1,
    });
    const rows = await sql`
      SELECT * FROM symptom_log
      WHERE athlete_id = ${athleteId}
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

//Save a symptom entry to database
export const saveSymptomEntry = createServerFn({ method: "POST" })
  .inputValidator((input: SymptomInput) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const id = requireUuidLike(data.id, "id");
    const athleteId = requireNumber(data.athleteId, "athleteId", {
      integer: true,
      min: 1,
    });
    const activityId = requireNumber(data.activityId, "activityId", {
      integer: true,
      min: 1,
    });
    const date = requireDateKey(data.date, "date");
    const location = requireString(data.location, "location", {
      minLength: 2,
      maxLength: 80,
    });
    const trigger = requireEnumValue(data.trigger, "trigger", SYMPTOM_TRIGGERS);
    const warmUpBehavior = requireEnumValue(
      data.warmUpBehavior,
      "warmUpBehavior",
      WARMUP_BEHAVIORS,
    );
    const painScale = requireNumber(data.painScale, "painScale", {
      integer: true,
      min: 1,
      max: 5,
    }) as 1 | 2 | 3 | 4 | 5;
    const notes = optionalString(data.notes, "notes", 1000);
    await sql`
      INSERT INTO symptom_log
        (id, athlete_id, activity_id, date, location, trigger, warm_up_behavior, pain_scale, notes)
      VALUES
        (${id}, ${athleteId}, ${activityId}, ${date},
         ${location}, ${trigger}, ${warmUpBehavior},
         ${painScale}, ${notes})
    `;
    return { success: true };
  });

//Delete a symptom entry from the database
export const deleteSymptomEntry = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; athleteId: number }) => input)
  .handler(async ({ data }) => {
    const sql = getDb();
    const id = requireUuidLike(data.id, "id");
    const athleteId = requireNumber(data.athleteId, "athleteId", {
      integer: true,
      min: 1,
    });
    await sql`
      DELETE FROM symptom_log
      WHERE id = ${id} AND athlete_id = ${athleteId}
    `;
    return { success: true };
  });

/**
 * Initialize the Neon database schema
 * Run with: bun run scripts/init-db.ts
 */

import { neon } from "@neondatabase/serverless";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set in .env");
    process.exit(1);
  }

  console.log("🔌 Connecting to Neon...");
  const sql = neon(databaseUrl);

  console.log("📦 Creating fueling_entries table...");
  await sql`
    CREATE TABLE IF NOT EXISTS fueling_entries (
      id SERIAL PRIMARY KEY,
      athlete_id BIGINT NOT NULL,
      activity_id BIGINT NOT NULL UNIQUE,
      carbs_grams INT,
      gels_count INT,
      hydration_ml INT,
      caffeine_count INT,
      timing_before VARCHAR(20),
      timing_during VARCHAR(20),
      timing_after VARCHAR(20),
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log("🔑 Creating indexes...");
  await sql`CREATE INDEX IF NOT EXISTS idx_fueling_athlete ON fueling_entries(athlete_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fueling_activity ON fueling_entries(activity_id)`;

  console.log("📦 Creating distance_goals table...");
  await sql`
    CREATE TABLE IF NOT EXISTS distance_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id BIGINT NOT NULL,
      distance VARCHAR(20) NOT NULL,
      target_seconds INT NOT NULL,
      year INT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_goals_athlete ON distance_goals(athlete_id)`;

  console.log("📦 Creating symptom_log table...");
  await sql`
    CREATE TABLE IF NOT EXISTS symptom_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id BIGINT NOT NULL,
      activity_id BIGINT NOT NULL,
      date DATE NOT NULL,
      location VARCHAR(255) NOT NULL,
      trigger VARCHAR(50) NOT NULL,
      warm_up_behavior VARCHAR(50) NOT NULL,
      pain_scale SMALLINT NOT NULL CHECK (pain_scale BETWEEN 1 AND 5),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_symptom_athlete ON symptom_log(athlete_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_symptom_activity ON symptom_log(activity_id)`;

  console.log("📦 Creating weekly_reflections table...");
  await sql`
    CREATE TABLE IF NOT EXISTS weekly_reflections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id BIGINT NOT NULL,
      week_start DATE NOT NULL,
      what_felt_better TEXT,
      what_felt_worse TEXT,
      warning_signs TEXT,
      change_next_week TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (athlete_id, week_start)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_reflections_athlete ON weekly_reflections(athlete_id)`;

  console.log("📦 Creating strava_sessions table...");
  await sql`
    CREATE TABLE IF NOT EXISTS strava_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id BIGINT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      granted_scope TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_strava_sessions_athlete ON strava_sessions(athlete_id)`;

  console.log("✅ Database initialized successfully!");
}

main().catch((err) => {
  console.error("❌ Failed to initialize database:", err);
  process.exit(1);
});

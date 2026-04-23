/**
 * Marathon Diagnostics Service
 *
 * Business logic for the Apex Performance Lab's two core diagnostic engines:
 *   1. Volume Progression Analysis — 4-week rolling average with flag system
 *   2. Fueling Efficiency Calculator — g/h carbs, sodium, caffeine breakdown
 *
 * All functions are pure (no side effects) to allow easy testing and memoisation.
 *
 * Spec references (copilot-instructions.md):
 *   § 2A — Volume & Long Run Correlation
 *   § 2B — Fueling & Absorption Breakdown
 */

import type { Activity } from "../hooks";

// ─── VOLUME ANALYSIS ─────────────────────────────────────────────────────────

/** A single week of training, derived from the raw activity list. */
export interface WeeklySnapshot {
  /** ISO date string for the Monday that opens this training week. */
  weekStart: string;
  /** Sum of all run distances in the week (miles). */
  totalMiles: number;
  /** Longest single run of the week (miles). */
  longRunMiles: number;
  /** Number of individual runs logged. */
  runCount: number;
}

export type VolumeFlagType =
  | "LACK_OF_ENDURANCE_SPECIFICITY" // Weekly mileage up >10% but long run static
  | "LONG_RUN_OVERRELIANCE"; // Long run > 33% of weekly total

export interface VolumeFlag {
  type: VolumeFlagType;
  severity: "warning" | "alert";
  message: string;
  context: {
    currentWeekMiles: number;
    rollingAvgMiles: number;
    weekOverWeekChangePct: number;
    longRunPct: number;
  };
}

export interface VolumeAnalysis {
  /** All derived weekly snapshots, oldest → newest. */
  weeks: WeeklySnapshot[];
  /** The most recent week (may be partial if current week is in progress). */
  currentWeek: WeeklySnapshot | null;
  /** 4-week rolling average of total miles (prior to current week). */
  rollingAvg4Week: number;
  /** 4-week rolling average of long-run distance. */
  longRunRollingAvg: number;
  /** Percentage change: current week vs rolling average. */
  weekOverWeekChangePct: number;
  /** Any triggered diagnostic flags. */
  flags: VolumeFlag[];
}

// ─── FUELING EFFICIENCY ───────────────────────────────────────────────────────

/** A single nutrition intake event timed against run duration. */
export interface TimedFuelingEvent {
  /** Seconds from run start when this was consumed. */
  timestampSeconds: number;
  carbsGrams: number;
  sodiumMg: number;
  caffeineMg: number;
  note?: string;
}

export type CarbsRating = "under-fueled" | "optimal" | "over-fueled";

export interface FuelingEfficiency {
  durationHours: number;
  carbsPerHour: number;
  totalCarbsGrams: number;
  totalSodiumMg: number;
  totalCaffeineMg: number;
  events: TimedFuelingEvent[];
  /**
   * Rated against ISAK / Jeukendrup (2014) carbohydrate oxidation targets:
   *   < 75 min  → endogenous glycogen is sufficient; ≤ 60 g/h = optimal
   *   75–150 min → 30–60 g/h optimal
   *   > 150 min  → 60–90 g/h optimal (dual-transporter blend recommended)
   */
  carbsRating: CarbsRating;
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

/** Returns the ISO date string (YYYY-MM-DD) of the Monday for a given date. */
function getWeekMonday(date: Date): string {
  const d = new Date(date);
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday …
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + offsetToMonday);
  return d.toISOString().slice(0, 10);
}

function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Groups a flat activity list into weekly snapshots, sorted oldest → newest.
 * Only considers runs (sport_type === "Run" or legacy type === "Run").
 */
export function deriveWeeklySnapshots(
  activities: Activity[],
): WeeklySnapshot[] {
  const runs = activities.filter(
    (a) => a.sport_type === "Run" || a.type === "Run",
  );

  const map = new Map<string, WeeklySnapshot>();

  for (const run of runs) {
    const key = getWeekMonday(new Date(run.start_date));
    const miles = metersToMiles(run.distance);
    const existing = map.get(key);

    if (existing) {
      existing.totalMiles += miles;
      existing.longRunMiles = Math.max(existing.longRunMiles, miles);
      existing.runCount += 1;
    } else {
      map.set(key, {
        weekStart: key,
        totalMiles: miles,
        longRunMiles: miles,
        runCount: 1,
      });
    }
  }

  return Array.from(map.values())
    .map((w) => ({
      ...w,
      totalMiles: roundTo(w.totalMiles, 2),
      longRunMiles: roundTo(w.longRunMiles, 2),
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Runs the volume progression diagnostic against the most recent week.
 *
 * Rules (§ 2A of copilot-instructions.md):
 *   — Weekly mileage increases > 10% vs 4-week rolling avg AND the long run is
 *     static (within 0.5 mi of rolling avg) → flag "LACK_OF_ENDURANCE_SPECIFICITY"
 *   — Long run exceeds 33% of weekly total → flag "LONG_RUN_OVERRELIANCE"
 */
export function analyzeVolumeProgression(
  activities: Activity[],
): VolumeAnalysis {
  const weeks = deriveWeeklySnapshots(activities);

  if (weeks.length < 2) {
    return {
      weeks,
      currentWeek: weeks[weeks.length - 1] ?? null,
      rollingAvg4Week: 0,
      longRunRollingAvg: 0,
      weekOverWeekChangePct: 0,
      flags: [],
    };
  }

  const currentWeek = weeks[weeks.length - 1];

  // Use up to the 4 weeks immediately prior to the current week
  const priorWeeks = weeks.slice(-5, -1);

  const rollingAvg4Week =
    priorWeeks.reduce((sum, w) => sum + w.totalMiles, 0) / priorWeeks.length;

  const longRunRollingAvg =
    priorWeeks.reduce((sum, w) => sum + w.longRunMiles, 0) / priorWeeks.length;

  const weekOverWeekChangePct =
    rollingAvg4Week > 0
      ? ((currentWeek.totalMiles - rollingAvg4Week) / rollingAvg4Week) * 100
      : 0;

  const longRunPct =
    currentWeek.totalMiles > 0
      ? (currentWeek.longRunMiles / currentWeek.totalMiles) * 100
      : 0;

  const flags: VolumeFlag[] = [];

  const context = {
    currentWeekMiles: roundTo(currentWeek.totalMiles, 1),
    rollingAvgMiles: roundTo(rollingAvg4Week, 1),
    weekOverWeekChangePct: roundTo(weekOverWeekChangePct, 1),
    longRunPct: roundTo(longRunPct, 1),
  };

  // Flag 1: Volume spike without long-run progression
  const longRunIsStatic =
    Math.abs(currentWeek.longRunMiles - longRunRollingAvg) <= 0.5;

  if (weekOverWeekChangePct > 10 && longRunIsStatic) {
    flags.push({
      type: "LACK_OF_ENDURANCE_SPECIFICITY",
      severity: "warning",
      message:
        "Weekly mileage is up >10% vs the 4-week average but the long run distance is unchanged. " +
        "This adds cumulative stress without building aerobic range — consider lengthening the " +
        "long run instead of stacking additional short runs.",
      context,
    });
  }

  // Flag 2: Long run dominates weekly volume
  if (longRunPct > 33) {
    flags.push({
      type: "LONG_RUN_OVERRELIANCE",
      severity: "alert",
      message:
        `Long run is ${context.longRunPct}% of weekly volume (threshold: 33%). ` +
        "Distributing mileage more evenly reduces single-session injury risk and " +
        "increases weekly aerobic stimulus without raising peak stress.",
      context,
    });
  }

  return {
    weeks,
    currentWeek,
    rollingAvg4Week: roundTo(rollingAvg4Week, 1),
    longRunRollingAvg: roundTo(longRunRollingAvg, 1),
    weekOverWeekChangePct: roundTo(weekOverWeekChangePct, 1),
    flags,
  };
}

/**
 * Calculates fueling efficiency from a list of timed intake events.
 *
 * Carb targets (Jeukendrup 2014 / ISAK):
 *   < 75 min:   endogenous glycogen sufficient; ≤ 60 g/h = optimal
 *   75–150 min: 30–60 g/h optimal
 *   > 150 min:  60–90 g/h optimal (dual-transporter glucose + fructose 2:1 blend)
 */
export function calculateFuelingEfficiency(
  events: TimedFuelingEvent[],
  durationMinutes: number,
): FuelingEfficiency {
  const durationHours = durationMinutes / 60;

  const totalCarbsGrams = events.reduce((sum, e) => sum + e.carbsGrams, 0);
  const totalSodiumMg = events.reduce((sum, e) => sum + e.sodiumMg, 0);
  const totalCaffeineMg = events.reduce((sum, e) => sum + e.caffeineMg, 0);

  const carbsPerHour = durationHours > 0 ? totalCarbsGrams / durationHours : 0;

  let carbsRating: CarbsRating;

  if (durationMinutes < 75) {
    carbsRating = carbsPerHour <= 60 ? "optimal" : "over-fueled";
  } else if (durationMinutes < 150) {
    if (carbsPerHour < 30) carbsRating = "under-fueled";
    else if (carbsPerHour <= 60) carbsRating = "optimal";
    else carbsRating = "over-fueled";
  } else {
    if (carbsPerHour < 60) carbsRating = "under-fueled";
    else if (carbsPerHour <= 90) carbsRating = "optimal";
    else carbsRating = "over-fueled";
  }

  return {
    durationHours: roundTo(durationHours, 2),
    carbsPerHour: roundTo(carbsPerHour, 1),
    totalCarbsGrams: Math.round(totalCarbsGrams),
    totalSodiumMg: Math.round(totalSodiumMg),
    totalCaffeineMg: Math.round(totalCaffeineMg),
    events,
    carbsRating,
  };
}

/**
 * Symptom & Mechanical Stress Log — Types, Constants, and Detection Logic
 *
 * Implements the "Early Warning System" from the Apex Performance Lab spec (§ 2C).
 * A structural alert fires when the same anatomical location appears in 3 or more
 * of the athlete's last 5 logged sessions.
 *
 * All IDs are UUIDs — never expose Strava user IDs in URLs (§ 3, Data Privacy).
 */

// ─── TRIGGERS ─────────────────────────────────────────────────────────────────

export const SYMPTOM_TRIGGERS = [
  "DOWNHILLS",
  "SPEEDWORK",
  "FLAT",
  "UPHILLS",
  "LONG_RUNS",
  "OTHER",
] as const;

export type SymptomTrigger = (typeof SYMPTOM_TRIGGERS)[number];

export const TRIGGER_LABELS: Record<SymptomTrigger, string> = {
  DOWNHILLS: "Downhills",
  SPEEDWORK: "Speedwork",
  FLAT: "Flat terrain",
  UPHILLS: "Uphills",
  LONG_RUNS: "Long runs",
  OTHER: "Other",
};

// ─── WARM-UP BEHAVIOUR ────────────────────────────────────────────────────────

export const WARMUP_BEHAVIORS = ["FADES", "WORSENS", "CONSISTENT"] as const;

export type WarmUpBehavior = (typeof WARMUP_BEHAVIORS)[number];

export const WARMUP_BEHAVIOR_LABELS: Record<WarmUpBehavior, string> = {
  FADES: "Fades after warm-up",
  WORSENS: "Worsens during run",
  CONSISTENT: "Consistent throughout",
};

// ─── CORE TYPES ───────────────────────────────────────────────────────────────

export interface SymptomEntry {
  /** UUID — never used as a URL segment. */
  id: string;
  /** Strava activity UUID reference (not the raw numeric ID). */
  activityId: string;
  /** ISO date string: YYYY-MM-DD */
  date: string;
  /**
   * Precise anatomical description — e.g. "Right Lateral Patella",
   * "Left Achilles Tendon", "Right IT Band — distal".
   */
  location: string;
  trigger: SymptomTrigger;
  warmUpBehavior: WarmUpBehavior;
  /** 1 = minimal discomfort → 5 = activity-stopping pain. */
  painScale: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface StructuralAlert {
  /** Canonical display name for the anatomical location. */
  location: string;
  /** Count of occurrences within the athlete's last 5 *sessions* (not entries). */
  recentOccurrences: number;
  /** True when recentOccurrences >= 3 — triggers the Structural Alert banner. */
  triggered: boolean;
}

// ─── DETECTION LOGIC ─────────────────────────────────────────────────────────

/**
 * Scans a symptom entry log and returns structural alerts.
 *
 * Algorithm:
 *   1. Identify the most recent 5 distinct training-session dates.
 *   2. For each unique location (case-insensitive), count how many of those
 *      sessions contain at least one entry with that location.
 *   3. Flag the location if count >= 3.
 *
 * @param entries - All symptom entries, in any order.
 */
export function detectStructuralAlerts(
  entries: SymptomEntry[],
): StructuralAlert[] {
  // Collect the 5 most recent distinct session dates
  const sessionDates = [...new Set(entries.map((e) => e.date))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5);

  const recentEntries = entries.filter((e) => sessionDates.includes(e.date));

  // For each location: how many of the 5 sessions contain it?
  const sessionCountByLocation = new Map<string, Set<string>>();

  for (const entry of recentEntries) {
    const key = entry.location.trim().toLowerCase();
    if (!sessionCountByLocation.has(key)) {
      sessionCountByLocation.set(key, new Set());
    }
    sessionCountByLocation.get(key)!.add(entry.date);
  }

  const alerts: StructuralAlert[] = [];

  for (const [key, dates] of sessionCountByLocation.entries()) {
    // Use the most recent entry's original casing for display
    const displayName =
      [...recentEntries]
        .sort((a, b) => b.date.localeCompare(a.date))
        .find((e) => e.location.trim().toLowerCase() === key)?.location ?? key;

    alerts.push({
      location: displayName,
      recentOccurrences: dates.size,
      triggered: dates.size >= 3,
    });
  }

  return alerts.sort((a, b) => b.recentOccurrences - a.recentOccurrences);
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

/** Generates a client-side UUID v4 for new symptom entries. */
export function newSymptomId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback — RFC4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

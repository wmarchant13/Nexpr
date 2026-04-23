/**
 * Weekly Reflection Store
 *
 * Once-a-week private diagnostic journal. Connects Running, Strength, and
 * Recovery across the full week. Stored locally — never sent to Strava.
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface WeeklyReflection {
  id: string;
  /** ISO date of the Monday that starts the reflected week (YYYY-MM-DD). */
  weekStart: string;
  /** What felt physically and mechanically better this week. */
  whatFeltBetter: string;
  /** What felt worse, heavier, or more strained. */
  whatFeltWorse: string;
  /** Small signals to watch — fatigue, soreness, motivation dips. */
  warningSigns: string;
  /** Single change to make next week. */
  changeNextWeek: string;
  createdAt: number;
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────

export const REFLECTION_STORAGE_KEY = "nexpr_weekly_reflections_v1";

export function loadReflections(): WeeklyReflection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REFLECTION_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WeeklyReflection[];
  } catch {
    return [];
  }
}

export function saveReflections(reflections: WeeklyReflection[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(reflections));
  } catch {
    // localStorage may be unavailable
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Returns the ISO date string (YYYY-MM-DD) of the most recent Monday. */
export function getCurrentWeekStart(): string {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/** Formats a week-start ISO string as a readable label. */
export function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Simple UUID v4 for reflection IDs. */
export function newReflectionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

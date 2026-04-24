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

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseWeekStartDate(weekStart: string): Date | null {
  const normalized = normalizeWeekStart(weekStart);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

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
  monday.setHours(0, 0, 0, 0);
  return formatDateKey(monday);
}

/** Normalizes a week-start value to YYYY-MM-DD. */
export function normalizeWeekStart(weekStart: string): string {
  if (!weekStart) return "";

  const directMatch = weekStart.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) return directMatch[1];

  const parsed = new Date(weekStart);
  if (Number.isNaN(parsed.getTime())) return weekStart;

  parsed.setHours(0, 0, 0, 0);
  return formatDateKey(parsed);
}

/** Formats a week-start ISO string as a readable label. */
export function formatWeekLabel(weekStart: string): string {
  const d = parseWeekStartDate(weekStart);
  if (!d) return "Unknown week";

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

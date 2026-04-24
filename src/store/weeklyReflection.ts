

export interface WeeklyReflection {
  id: string;
  
  weekStart: string;
  
  whatFeltBetter: string;
  
  whatFeltWorse: string;
  
  warningSigns: string;
  
  changeNextWeek: string;
  createdAt: number;
}

export const REFLECTION_STORAGE_KEY = "nexpr_weekly_reflections_v1";

// Formats a Date as YYYY-MM-DD string
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Parses a week-start string into a Date
function parseWeekStartDate(weekStart: string): Date | null {
  const normalized = normalizeWeekStart(weekStart);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Reads weekly reflections from localStorage
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

// Writes weekly reflections to localStorage
export function saveReflections(reflections: WeeklyReflection[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(reflections));
  } catch {
    
  }
}

// Returns this Monday's date as YYYY-MM-DD
export function getCurrentWeekStart(): string {
  const today = new Date();
  const day = today.getDay(); 
  const diff = day === 0 ? -6 : 1 - day; 
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return formatDateKey(monday);
}

// Normalizes various week-start formats to YYYY-MM-DD
export function normalizeWeekStart(weekStart: string): string {
  if (!weekStart) return "";

  const directMatch = weekStart.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) return directMatch[1];

  const parsed = new Date(weekStart);
  if (Number.isNaN(parsed.getTime())) return weekStart;

  parsed.setHours(0, 0, 0, 0);
  return formatDateKey(parsed);
}

// Formats a week-start date as a human-readable label
export function formatWeekLabel(weekStart: string): string {
  const d = parseWeekStartDate(weekStart);
  if (!d) return "Unknown week";

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Generates a UUID for a new weekly reflection
export function newReflectionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}



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

export const WARMUP_BEHAVIORS = ["FADES", "WORSENS", "CONSISTENT"] as const;

export type WarmUpBehavior = (typeof WARMUP_BEHAVIORS)[number];

export const WARMUP_BEHAVIOR_LABELS: Record<WarmUpBehavior, string> = {
  FADES: "Fades after warm-up",
  WORSENS: "Worsens during run",
  CONSISTENT: "Consistent throughout",
};

export interface SymptomEntry {
  
  id: string;
  
  activityId: string;
  
  date: string;
  
  location: string;
  trigger: SymptomTrigger;
  warmUpBehavior: WarmUpBehavior;
  
  painScale: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface StructuralAlert {
  
  location: string;
  
  recentOccurrences: number;
  
  triggered: boolean;
}

// Flags body locations that appear in 3+ of the last 5 sessions
export function detectStructuralAlerts(
  entries: SymptomEntry[],
): StructuralAlert[] {
  
  const sessionDates = [...new Set(entries.map((e) => e.date))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5);

  const recentEntries = entries.filter((e) => sessionDates.includes(e.date));

  
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

// Generates a UUID for a new symptom entry
export function newSymptomId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

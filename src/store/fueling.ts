

import type { Activity } from "../hooks";

export interface FuelingEntry {
  activityId: number;
  
  
  carbsGrams?: number;           
  gelsCount?: number;            
  hydrationMl?: number;          
  caffeineCount?: number;        
  
  
  timing?: FuelingTiming;
  
  
  note?: string;
  
  
  createdAt: number;
  updatedAt: number;
}

export interface FuelingTiming {
  beforeRun?: "none" | "light" | "moderate" | "heavy";
  duringRun?: "none" | "light" | "moderate" | "heavy";
  afterRun?: "none" | "light" | "moderate" | "heavy";
}

export interface PerformanceSignals {
  
  averagePace: number;           
  paceStability: number;         
  fadePercentage: number;        
  
  
  effortScore: number;           
  elevationAdjustedPace: number; 
  
  
  completionQuality: number;     
  lateRunPaceRatio: number;      
  
  
  distanceMiles: number;
  durationMinutes: number;
  elevationGainFeet: number;
  temperature?: number;          
}

export interface FuelingAnalysis {
  activityId: number;
  fueling: FuelingEntry;
  performance: PerformanceSignals;
  
  
  effectivenessScore: number;    
  insights: FuelingInsight[];
  
  
  fuelingLevel: "unfueled" | "light" | "moderate" | "heavy";
  performanceCategory: "strong" | "typical" | "struggled";
}

export interface FuelingInsight {
  id: string;
  type: "correlation" | "pattern" | "recommendation";
  title: string;
  description: string;
  confidence: number;            
}

export interface FuelingProfile {
  
  totalFueledRuns: number;
  totalUnfueledRuns: number;
  
  
  optimalCarbRange?: { min: number; max: number };
  optimalHydrationRange?: { min: number; max: number };
  
  
  clusters: FuelingCluster[];
  
  
  insights: FuelingInsight[];
  
  
  lastUpdated: number;
}

export interface FuelingCluster {
  id: string;
  label: string;                 
  avgCarbs: number;
  avgHydration: number;
  runCount: number;
  
  
  avgEffectivenessScore: number;
  avgPaceStability: number;
  avgFade: number;
}

const STORAGE_KEY = "nexpr_fueling_v1";
const PROFILE_CACHE_KEY = "nexpr_fueling_profile_v1";
const LONG_RUN_THRESHOLD_MILES = 8;
const GEL_CARBS_GRAMS = 25; 

const FUELING_THRESHOLDS = {
  light: 20,     
  moderate: 40,  
  heavy: 60,     
};

interface FuelingStorage {
  entries: Record<number, FuelingEntry>;
  lastUpdated: number;
}

// Reads the fueling entry storage from localStorage
function getStorage(): FuelingStorage {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { entries: {}, lastUpdated: Date.now() };
    return JSON.parse(data);
  } catch {
    return { entries: {}, lastUpdated: Date.now() };
  }
}

// Writes the fueling entry storage to localStorage
function saveStorage(storage: FuelingStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch {
    
  }
}

// Fetches the fueling entry for a single activity
export function getFuelingEntry(activityId: number): FuelingEntry | null {
  const storage = getStorage();
  return storage.entries[activityId] || null;
}

// Upserts a fueling entry for an activity
export function saveFuelingEntry(entry: Partial<FuelingEntry> & { activityId: number }): FuelingEntry {
  const storage = getStorage();
  const existing = storage.entries[entry.activityId];
  
  const now = Date.now();
  const fullEntry: FuelingEntry = {
    activityId: entry.activityId,
    carbsGrams: entry.carbsGrams ?? entry.gelsCount ? (entry.gelsCount! * GEL_CARBS_GRAMS) : undefined,
    gelsCount: entry.gelsCount,
    hydrationMl: entry.hydrationMl,
    caffeineCount: entry.caffeineCount,
    timing: entry.timing,
    note: entry.note,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  
  storage.entries[entry.activityId] = fullEntry;
  storage.lastUpdated = now;
  saveStorage(storage);
  
  
  localStorage.removeItem(PROFILE_CACHE_KEY);
  
  return fullEntry;
}

// Removes a fueling entry by activity id
export function deleteFuelingEntry(activityId: number): void {
  const storage = getStorage();
  delete storage.entries[activityId];
  storage.lastUpdated = Date.now();
  saveStorage(storage);
  localStorage.removeItem(PROFILE_CACHE_KEY);
}

// Fetches all fueling entries for an athlete
export function getAllFuelingEntries(): FuelingEntry[] {
  const storage = getStorage();
  return Object.values(storage.entries);
}

// Removes all fueling data
export function clearAllFuelingData(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PROFILE_CACHE_KEY);
}

// Derives pace stability and fade signals from an activity
export function extractPerformanceSignals(
  activity: Activity,
  effortScore: number = 5,
  splits?: { pace: number }[]
): PerformanceSignals {
  const distanceMiles = activity.distance / 1609.344;
  const durationMinutes = activity.moving_time / 60;
  const avgPace = durationMinutes / distanceMiles;
  const elevationGainFeet = activity.total_elevation_gain * 3.281;
  
  
  let paceStability = 75; 
  let fadePercentage = 0;
  let lateRunPaceRatio = 1;
  let completionQuality = 75;
  
  if (splits && splits.length >= 3) {
    
    const paces = splits.map(s => s.pace);
    const avgSplitPace = paces.reduce((a, b) => a + b, 0) / paces.length;
    const variance = paces.reduce((sum, p) => sum + Math.pow(p - avgSplitPace, 2), 0) / paces.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgSplitPace;
    paceStability = Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 200)));
    
    
    const thirdLength = Math.floor(paces.length / 3);
    const firstThird = paces.slice(0, thirdLength);
    const lastThird = paces.slice(-thirdLength);
    const firstThirdAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const lastThirdAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
    
    
    fadePercentage = ((lastThirdAvg - firstThirdAvg) / firstThirdAvg) * 100;
    lateRunPaceRatio = lastThirdAvg / firstThirdAvg;
    
    
    const deterioration = Math.max(0, fadePercentage);
    completionQuality = Math.max(0, Math.min(100, 100 - (deterioration * 3)));
  }
  
  
  // Grade Percent
  const gradePercent = (elevationGainFeet / (distanceMiles * 5280)) * 100;
  const gapAdjustment = 1 + (gradePercent * 0.033); 
  const elevationAdjustedPace = avgPace / gapAdjustment;
  
  return {
    averagePace: avgPace,
    paceStability,
    fadePercentage: Math.round(fadePercentage * 10) / 10,
    effortScore,
    elevationAdjustedPace,
    completionQuality,
    lateRunPaceRatio,
    distanceMiles,
    durationMinutes,
    elevationGainFeet,
  };
}

// Categorizes carb intake as unfueled/light/moderate/heavy
export function classifyFuelingLevel(
  entry: FuelingEntry,
  durationMinutes: number
): "unfueled" | "light" | "moderate" | "heavy" {
  const carbsGrams = entry.carbsGrams ?? (entry.gelsCount ? entry.gelsCount * GEL_CARBS_GRAMS : 0);
  
  if (!carbsGrams || carbsGrams === 0) return "unfueled";
  
  const carbsPerHour = carbsGrams / (durationMinutes / 60);
  
  if (carbsPerHour < FUELING_THRESHOLDS.light) return "light";
  if (carbsPerHour < FUELING_THRESHOLDS.moderate) return "moderate";
  return "heavy";
}

// Categorizes run performance as strong/typical/struggled
function classifyPerformance(signals: PerformanceSignals): "strong" | "typical" | "struggled" {
  
  if (signals.paceStability >= 75 && signals.fadePercentage <= 3 && signals.completionQuality >= 80) {
    return "strong";
  }
  
  
  if (signals.paceStability < 60 || signals.fadePercentage > 8 || signals.completionQuality < 60) {
    return "struggled";
  }
  
  return "typical";
}

// Scores overall fueling effectiveness from 0 to 10
function calculateEffectivenessScore(
  fueling: FuelingEntry,
  performance: PerformanceSignals,
  fuelingLevel: "unfueled" | "light" | "moderate" | "heavy"
): number {
  
  let score = 5;
  
  
  score += (performance.paceStability / 100) * 2;
  
  
  
  if (performance.fadePercentage <= 0) {
    score += Math.min(2, Math.abs(performance.fadePercentage) * 0.3); 
  } else {
    score -= Math.min(2, performance.fadePercentage * 0.2); 
  }
  
  
  score += (performance.completionQuality / 100);
  
  
  if (performance.distanceMiles >= LONG_RUN_THRESHOLD_MILES) {
    if (fuelingLevel === "moderate" || fuelingLevel === "heavy") {
      score += 0.5; 
    }
    if (fuelingLevel === "unfueled" && performance.fadePercentage > 5) {
      score -= 0.5; 
    }
  }
  
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

// Builds insight cards correlating fueling with performance
function generateRunInsights(
  fueling: FuelingEntry,
  performance: PerformanceSignals,
  fuelingLevel: "unfueled" | "light" | "moderate" | "heavy",
  performanceCategory: "strong" | "typical" | "struggled"
): FuelingInsight[] {
  const insights: FuelingInsight[] = [];
  const carbsGrams = fueling.carbsGrams ?? (fueling.gelsCount ? fueling.gelsCount * GEL_CARBS_GRAMS : 0);
  
  
  if (performance.distanceMiles >= LONG_RUN_THRESHOLD_MILES) {
    if (fuelingLevel === "moderate" || fuelingLevel === "heavy") {
      if (performance.paceStability >= 70) {
        insights.push({
          id: "fueled-stable",
          type: "correlation",
          title: "Fueling Supported Stability",
          description: `${carbsGrams}g carbs correlated with ${Math.round(performance.paceStability)}% pace stability on this ${Math.round(performance.distanceMiles)}-mile run.`,
          confidence: 70,
        });
      }
    } else if (fuelingLevel === "unfueled" || fuelingLevel === "light") {
      if (performance.fadePercentage > 5) {
        insights.push({
          id: "unfueled-fade",
          type: "correlation",
          title: "Late-Run Slowdown",
          description: `${Math.round(performance.fadePercentage)}% pace fade on this long run with ${fuelingLevel} fueling.`,
          confidence: 65,
        });
      }
    }
  }
  
  
  if (fueling.caffeineCount && fueling.caffeineCount > 0) {
    if (performanceCategory === "strong") {
      insights.push({
        id: "caffeine-positive",
        type: "correlation",
        title: "Caffeine Correlation",
        description: "Caffeine intake correlated with strong performance on this run.",
        confidence: 55,
      });
    }
  }
  
  
  if (fueling.hydrationMl && fueling.hydrationMl > 0) {
    const mlPerMile = fueling.hydrationMl / performance.distanceMiles;
    if (mlPerMile >= 100 && performance.completionQuality >= 75) {
      insights.push({
        id: "hydration-positive",
        type: "correlation",
        title: "Hydration Supported",
        description: `${Math.round(fueling.hydrationMl)}ml fluid intake supported consistent performance.`,
        confidence: 60,
      });
    }
  }
  
  
  if (performanceCategory === "strong" && fuelingLevel === "light") {
    insights.push({
      id: "efficient-fueling",
      type: "pattern",
      title: "Efficient Fueling",
      description: "Strong performance achieved with light fueling—good metabolic efficiency.",
      confidence: 60,
    });
  }
  
  return insights;
}

// Analyzes fueling and performance for a single run
export function analyzeFueledRun(
  activity: Activity,
  fueling: FuelingEntry,
  effortScore: number = 5,
  splits?: { pace: number }[]
): FuelingAnalysis {
  const performance = extractPerformanceSignals(activity, effortScore, splits);
  const fuelingLevel = classifyFuelingLevel(fueling, performance.durationMinutes);
  const performanceCategory = classifyPerformance(performance);
  const effectivenessScore = calculateEffectivenessScore(fueling, performance, fuelingLevel);
  const insights = generateRunInsights(fueling, performance, fuelingLevel, performanceCategory);
  
  return {
    activityId: activity.id,
    fueling,
    performance,
    effectivenessScore,
    insights,
    fuelingLevel,
    performanceCategory,
  };
}

// Builds an aggregate fueling profile across all runs
export function buildFuelingProfile(
  activities: Activity[],
  effortMap: Map<number, { score: number }>,
  fuelingEntries: FuelingEntry[] = []
): FuelingProfile {
  
  const entries = fuelingEntries.length > 0 ? fuelingEntries : getAllFuelingEntries();
  const entryMap = new Map(entries.map(e => [e.activityId, e]));
  
  
  const runs = activities.filter(a => 
    a.type === "Run" || a.sport_type === "Run"
  );
  
  
  const fueledRuns: FuelingAnalysis[] = [];
  const unfueledRuns: Activity[] = [];
  
  runs.forEach(run => {
    const fueling = entryMap.get(run.id);
    const effort = effortMap.get(run.id);
    
    if (fueling) {
      fueledRuns.push(analyzeFueledRun(run, fueling, effort?.score ?? 5));
    } else {
      unfueledRuns.push(run);
    }
  });
  
  
  const clusters: FuelingCluster[] = [];
  
  
  const underFueledLong = fueledRuns.filter(r => 
    r.performance.distanceMiles >= LONG_RUN_THRESHOLD_MILES &&
    (r.fuelingLevel === "unfueled" || r.fuelingLevel === "light")
  );
  
  if (underFueledLong.length > 0) {
    clusters.push({
      id: "under-fueled-long",
      label: "Under-Fueled Long Runs",
      avgCarbs: average(underFueledLong.map(r => 
        r.fueling.carbsGrams ?? (r.fueling.gelsCount ? r.fueling.gelsCount * GEL_CARBS_GRAMS : 0)
      )),
      avgHydration: average(underFueledLong.map(r => r.fueling.hydrationMl ?? 0)),
      runCount: underFueledLong.length,
      avgEffectivenessScore: average(underFueledLong.map(r => r.effectivenessScore)),
      avgPaceStability: average(underFueledLong.map(r => r.performance.paceStability)),
      avgFade: average(underFueledLong.map(r => r.performance.fadePercentage)),
    });
  }
  
  
  const wellFueledLong = fueledRuns.filter(r =>
    r.performance.distanceMiles >= LONG_RUN_THRESHOLD_MILES &&
    (r.fuelingLevel === "moderate" || r.fuelingLevel === "heavy")
  );
  
  if (wellFueledLong.length > 0) {
    clusters.push({
      id: "well-fueled-long",
      label: "Well-Fueled Long Runs",
      avgCarbs: average(wellFueledLong.map(r =>
        r.fueling.carbsGrams ?? (r.fueling.gelsCount ? r.fueling.gelsCount * GEL_CARBS_GRAMS : 0)
      )),
      avgHydration: average(wellFueledLong.map(r => r.fueling.hydrationMl ?? 0)),
      runCount: wellFueledLong.length,
      avgEffectivenessScore: average(wellFueledLong.map(r => r.effectivenessScore)),
      avgPaceStability: average(wellFueledLong.map(r => r.performance.paceStability)),
      avgFade: average(wellFueledLong.map(r => r.performance.fadePercentage)),
    });
  }
  
  
  const caffeineRuns = fueledRuns.filter(r => 
    r.fueling.caffeineCount && r.fueling.caffeineCount > 0
  );
  
  if (caffeineRuns.length > 0) {
    clusters.push({
      id: "caffeine",
      label: "Caffeine-Enhanced Runs",
      avgCarbs: average(caffeineRuns.map(r =>
        r.fueling.carbsGrams ?? (r.fueling.gelsCount ? r.fueling.gelsCount * GEL_CARBS_GRAMS : 0)
      )),
      avgHydration: average(caffeineRuns.map(r => r.fueling.hydrationMl ?? 0)),
      runCount: caffeineRuns.length,
      avgEffectivenessScore: average(caffeineRuns.map(r => r.effectivenessScore)),
      avgPaceStability: average(caffeineRuns.map(r => r.performance.paceStability)),
      avgFade: average(caffeineRuns.map(r => r.performance.fadePercentage)),
    });
  }
  
  
  const strongRuns = fueledRuns.filter(r => r.performanceCategory === "strong");
  let optimalCarbRange: { min: number; max: number } | undefined;
  let optimalHydrationRange: { min: number; max: number } | undefined;
  
  if (strongRuns.length >= 3) {
    const strongCarbs = strongRuns
      .map(r => r.fueling.carbsGrams ?? (r.fueling.gelsCount ? r.fueling.gelsCount * GEL_CARBS_GRAMS : 0))
      .filter(c => c > 0)
      .sort((a, b) => a - b);
    
    if (strongCarbs.length >= 3) {
      optimalCarbRange = {
        min: strongCarbs[Math.floor(strongCarbs.length * 0.25)],
        max: strongCarbs[Math.floor(strongCarbs.length * 0.75)],
      };
    }
    
    const strongHydration = strongRuns
      .map(r => r.fueling.hydrationMl ?? 0)
      .filter(h => h > 0)
      .sort((a, b) => a - b);
    
    if (strongHydration.length >= 3) {
      optimalHydrationRange = {
        min: strongHydration[Math.floor(strongHydration.length * 0.25)],
        max: strongHydration[Math.floor(strongHydration.length * 0.75)],
      };
    }
  }
  
  
  const insights: FuelingInsight[] = [];
  
  
  if (wellFueledLong.length >= 2 && underFueledLong.length >= 2) {
    const wellFueledAvgFade = average(wellFueledLong.map(r => r.performance.fadePercentage));
    const underFueledAvgFade = average(underFueledLong.map(r => r.performance.fadePercentage));
    
    if (underFueledAvgFade > wellFueledAvgFade + 3) {
      insights.push({
        id: "fueling-reduces-fade",
        type: "pattern",
        title: "Fueling Reduces Late-Run Fade",
        description: `Your well-fueled long runs average ${Math.round(underFueledAvgFade - wellFueledAvgFade)}% less pace fade.`,
        confidence: 75,
      });
    }
  }
  
  
  if (optimalCarbRange) {
    insights.push({
      id: "optimal-carb-range",
      type: "pattern",
      title: "Your Optimal Carb Range",
      description: `Strong performances cluster around ${Math.round(optimalCarbRange.min)}-${Math.round(optimalCarbRange.max)}g carbs.`,
      confidence: 70,
    });
  }
  
  
  if (fueledRuns.length < 5) {
    insights.push({
      id: "limited-data",
      type: "recommendation",
      title: "Building Your Fueling Profile",
      description: `${fueledRuns.length} fueled runs logged. More data will improve personalized insights.`,
      confidence: 100,
    });
  }
  
  const profile: FuelingProfile = {
    totalFueledRuns: fueledRuns.length,
    totalUnfueledRuns: unfueledRuns.length,
    optimalCarbRange,
    optimalHydrationRange,
    clusters,
    insights,
    lastUpdated: Date.now(),
  };
  
  
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {}
  
  return profile;
}

// Returns the mean of a number array
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

export const FUELING_TOOLTIP = {
  title: "About Fueling Analysis",
  
  shortDescription:
    "Track what you consume during long runs to discover patterns between fueling and performance.",
  
  fullDescription:
    `Log carbs, hydration, and caffeine for your long runs to see how fueling correlates with pace stability, late-run fade, and overall performance.

This is correlation analysis—not medical or nutritional advice. It helps you discover what works for YOUR body.

All fueling data is stored locally and can be deleted at any time.`,

  notNutritionApp:
    "This is not a nutrition tracking app. It's a lightweight tool to help you understand what fueling strategies support your best performances.",
};


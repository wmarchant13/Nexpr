/**
 * Nexpr Fueling Analysis System
 * 
 * Lightweight fueling tracking that correlates nutrition intake with performance.
 * This is NOT a nutrition app—it's a performance correlation tool.
 * 
 * Key Principles:
 * - Optional, zero-friction input
 * - Correlation-based insights (not medical advice)
 * - Performance-focused, not calorie-focused
 * - Minimal data requirements
 * 
 * @author Nexpr Engineering
 */

import type { Activity } from "../hooks";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Fueling entry for a single activity.
 * All fields are optional to minimize friction.
 */
export interface FuelingEntry {
  activityId: number;
  
  // Core fueling data (all optional)
  carbsGrams?: number;           // Total carbs consumed
  gelsCount?: number;            // Alternative: number of gels (easier input)
  hydrationMl?: number;          // Total fluid intake
  caffeineCount?: number;        // Caffeine sources (coffees/pills)
  
  // Timing breakdown (optional)
  timing?: FuelingTiming;
  
  // Free-form note (minimal use encouraged)
  note?: string;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
}

export interface FuelingTiming {
  beforeRun?: "none" | "light" | "moderate" | "heavy";
  duringRun?: "none" | "light" | "moderate" | "heavy";
  afterRun?: "none" | "light" | "moderate" | "heavy";
}

/**
 * Performance metrics extracted from an activity for fueling analysis.
 */
export interface PerformanceSignals {
  // Pace analysis
  averagePace: number;           // min/mile
  paceStability: number;         // 0-100, higher = more stable
  fadePercentage: number;        // Negative = slowed down, positive = sped up
  
  // Effort analysis
  effortScore: number;           // 0-10 from effort system
  elevationAdjustedPace: number; // GAP equivalent
  
  // Run quality
  completionQuality: number;     // 0-100, steady vs deteriorating
  lateRunPaceRatio: number;      // Last third pace / first third pace
  
  // Context
  distanceMiles: number;
  durationMinutes: number;
  elevationGainFeet: number;
  temperature?: number;          // If available
}

/**
 * Analysis result for a single fueled run.
 */
export interface FuelingAnalysis {
  activityId: number;
  fueling: FuelingEntry;
  performance: PerformanceSignals;
  
  // Derived metrics
  effectivenessScore: number;    // 0-10, how well fueling correlated with performance
  insights: FuelingInsight[];
  
  // Classification
  fuelingLevel: "unfueled" | "light" | "moderate" | "heavy";
  performanceCategory: "strong" | "typical" | "struggled";
}

export interface FuelingInsight {
  id: string;
  type: "correlation" | "pattern" | "recommendation";
  title: string;
  description: string;
  confidence: number;            // 0-100
}

/**
 * Aggregated fueling patterns over time.
 */
export interface FuelingProfile {
  // Sample sizes
  totalFueledRuns: number;
  totalUnfueledRuns: number;
  
  // Optimal ranges (user-specific)
  optimalCarbRange?: { min: number; max: number };
  optimalHydrationRange?: { min: number; max: number };
  
  // Pattern clusters
  clusters: FuelingCluster[];
  
  // Aggregate insights
  insights: FuelingInsight[];
  
  // Metadata
  lastUpdated: number;
}

export interface FuelingCluster {
  id: string;
  label: string;                 // "Well-Fueled Long Run", "Under-Fueled"
  avgCarbs: number;
  avgHydration: number;
  runCount: number;
  
  // Performance in this cluster
  avgEffectivenessScore: number;
  avgPaceStability: number;
  avgFade: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = "nexpr_fueling_v1";
const PROFILE_CACHE_KEY = "nexpr_fueling_profile_v1";
const LONG_RUN_THRESHOLD_MILES = 8;
const GEL_CARBS_GRAMS = 25; // Typical gel ~25g carbs

// Fueling level thresholds (carbs per hour)
const FUELING_THRESHOLDS = {
  light: 20,     // < 20g/hr = light
  moderate: 40,  // 20-40g/hr = moderate
  heavy: 60,     // > 40g/hr = heavy
};

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

interface FuelingStorage {
  entries: Record<number, FuelingEntry>;
  lastUpdated: number;
}

function getStorage(): FuelingStorage {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { entries: {}, lastUpdated: Date.now() };
    return JSON.parse(data);
  } catch {
    return { entries: {}, lastUpdated: Date.now() };
  }
}

function saveStorage(storage: FuelingStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch {
    // localStorage might be full
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get fueling entry for an activity.
 */
export function getFuelingEntry(activityId: number): FuelingEntry | null {
  const storage = getStorage();
  return storage.entries[activityId] || null;
}

/**
 * Save or update fueling entry for an activity.
 */
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
  
  // Invalidate profile cache
  localStorage.removeItem(PROFILE_CACHE_KEY);
  
  return fullEntry;
}

/**
 * Delete fueling entry for an activity.
 */
export function deleteFuelingEntry(activityId: number): void {
  const storage = getStorage();
  delete storage.entries[activityId];
  storage.lastUpdated = Date.now();
  saveStorage(storage);
  localStorage.removeItem(PROFILE_CACHE_KEY);
}

/**
 * Get all fueling entries.
 */
export function getAllFuelingEntries(): FuelingEntry[] {
  const storage = getStorage();
  return Object.values(storage.entries);
}

/**
 * Delete all fueling data (privacy feature).
 */
export function clearAllFuelingData(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PROFILE_CACHE_KEY);
}

// ============================================================================
// PERFORMANCE SIGNAL EXTRACTION
// ============================================================================

/**
 * Extract performance signals from an activity.
 */
export function extractPerformanceSignals(
  activity: Activity,
  effortScore: number = 5,
  splits?: { pace: number }[]
): PerformanceSignals {
  const distanceMiles = activity.distance / 1609.344;
  const durationMinutes = activity.moving_time / 60;
  const avgPace = durationMinutes / distanceMiles;
  const elevationGainFeet = activity.total_elevation_gain * 3.281;
  
  // Calculate pace stability and fade from splits if available
  let paceStability = 75; // Default
  let fadePercentage = 0;
  let lateRunPaceRatio = 1;
  let completionQuality = 75;
  
  if (splits && splits.length >= 3) {
    // Pace stability: standard deviation of split paces
    const paces = splits.map(s => s.pace);
    const avgSplitPace = paces.reduce((a, b) => a + b, 0) / paces.length;
    const variance = paces.reduce((sum, p) => sum + Math.pow(p - avgSplitPace, 2), 0) / paces.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgSplitPace;
    paceStability = Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 200)));
    
    // Fade: compare first third to last third
    const thirdLength = Math.floor(paces.length / 3);
    const firstThird = paces.slice(0, thirdLength);
    const lastThird = paces.slice(-thirdLength);
    const firstThirdAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const lastThirdAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
    
    // Positive fade = slowed down (higher pace number is slower)
    fadePercentage = ((lastThirdAvg - firstThirdAvg) / firstThirdAvg) * 100;
    lateRunPaceRatio = lastThirdAvg / firstThirdAvg;
    
    // Completion quality: how steady was the run overall
    const deterioration = Math.max(0, fadePercentage);
    completionQuality = Math.max(0, Math.min(100, 100 - (deterioration * 3)));
  }
  
  // Simple GAP approximation
  const gradePercent = (elevationGainFeet / (distanceMiles * 5280)) * 100;
  const gapAdjustment = 1 + (gradePercent * 0.033); // ~3.3% slower per 1% grade
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

// ============================================================================
// FUELING CLASSIFICATION
// ============================================================================

/**
 * Classify fueling level based on intake per hour.
 */
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

/**
 * Classify performance based on signals.
 */
function classifyPerformance(signals: PerformanceSignals): "strong" | "typical" | "struggled" {
  // Strong: good stability, minimal fade, good completion
  if (signals.paceStability >= 75 && signals.fadePercentage <= 3 && signals.completionQuality >= 80) {
    return "strong";
  }
  
  // Struggled: high fade, poor stability, poor completion
  if (signals.paceStability < 60 || signals.fadePercentage > 8 || signals.completionQuality < 60) {
    return "struggled";
  }
  
  return "typical";
}

// ============================================================================
// ANALYSIS ENGINE
// ============================================================================

/**
 * Calculate fueling effectiveness score.
 * 
 * This measures how well the fueling correlated with good performance,
 * relative to what we'd expect for this run type.
 */
function calculateEffectivenessScore(
  fueling: FuelingEntry,
  performance: PerformanceSignals,
  fuelingLevel: "unfueled" | "light" | "moderate" | "heavy"
): number {
  // Base score from performance quality
  let score = 5;
  
  // Pace stability contribution (0-2 points)
  score += (performance.paceStability / 100) * 2;
  
  // Fade contribution (-2 to +2 points)
  // Negative fade (positive split) = bad
  if (performance.fadePercentage <= 0) {
    score += Math.min(2, Math.abs(performance.fadePercentage) * 0.3); // Negative split bonus
  } else {
    score -= Math.min(2, performance.fadePercentage * 0.2); // Positive split penalty
  }
  
  // Completion quality contribution (0-1 point)
  score += (performance.completionQuality / 100);
  
  // Long run fueling bonus
  if (performance.distanceMiles >= LONG_RUN_THRESHOLD_MILES) {
    if (fuelingLevel === "moderate" || fuelingLevel === "heavy") {
      score += 0.5; // Bonus for fueling long runs
    }
    if (fuelingLevel === "unfueled" && performance.fadePercentage > 5) {
      score -= 0.5; // Penalty for unfueled long run with fade
    }
  }
  
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

/**
 * Generate insights for a single fueled run.
 */
function generateRunInsights(
  fueling: FuelingEntry,
  performance: PerformanceSignals,
  fuelingLevel: "unfueled" | "light" | "moderate" | "heavy",
  performanceCategory: "strong" | "typical" | "struggled"
): FuelingInsight[] {
  const insights: FuelingInsight[] = [];
  const carbsGrams = fueling.carbsGrams ?? (fueling.gelsCount ? fueling.gelsCount * GEL_CARBS_GRAMS : 0);
  
  // Long run fueling correlation
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
  
  // Caffeine timing
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
  
  // Hydration on hot/long runs
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
  
  // Strong performance without heavy fueling (efficiency)
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

/**
 * Analyze a single activity's fueling and performance.
 */
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

// ============================================================================
// AGGREGATE ANALYSIS
// ============================================================================

/**
 * Build user's fueling profile from all fueled runs.
 * Now accepts fueling entries as a parameter for server-side fetching.
 */
export function buildFuelingProfile(
  activities: Activity[],
  effortMap: Map<number, { score: number }>,
  fuelingEntries: FuelingEntry[] = []
): FuelingProfile {
  // If no entries provided, try localStorage (legacy fallback)
  const entries = fuelingEntries.length > 0 ? fuelingEntries : getAllFuelingEntries();
  const entryMap = new Map(entries.map(e => [e.activityId, e]));
  
  // Filter to runs only
  const runs = activities.filter(a => 
    a.type === "Run" || a.sport_type === "Run"
  );
  
  // Separate fueled and unfueled runs
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
  
  // Build clusters
  const clusters: FuelingCluster[] = [];
  
  // Cluster 1: Under-fueled long runs
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
  
  // Cluster 2: Well-fueled long runs
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
  
  // Cluster 3: Caffeine runs
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
  
  // Calculate optimal ranges
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
  
  // Generate aggregate insights
  const insights: FuelingInsight[] = [];
  
  // Compare fueled vs unfueled long runs
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
  
  // Optimal carb range insight
  if (optimalCarbRange) {
    insights.push({
      id: "optimal-carb-range",
      type: "pattern",
      title: "Your Optimal Carb Range",
      description: `Strong performances cluster around ${Math.round(optimalCarbRange.min)}-${Math.round(optimalCarbRange.max)}g carbs.`,
      confidence: 70,
    });
  }
  
  // Limited data insight
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
  
  // Cache profile
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {}
  
  return profile;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

// ============================================================================
// TOOLTIP COPY
// ============================================================================

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

// ============================================================================
// EXAMPLE OUTPUT (Documentation)
// ============================================================================

/*
Example FuelingAnalysis output:

{
  "activityId": 12345678,
  "fueling": {
    "activityId": 12345678,
    "carbsGrams": 75,
    "gelsCount": 3,
    "hydrationMl": 500,
    "caffeineCount": 1,
    "timing": {
      "beforeRun": "light",
      "duringRun": "moderate"
    },
    "createdAt": 1713523200000,
    "updatedAt": 1713523200000
  },
  "performance": {
    "averagePace": 8.5,
    "paceStability": 82,
    "fadePercentage": 2.3,
    "effortScore": 6.5,
    "elevationAdjustedPace": 8.2,
    "completionQuality": 85,
    "lateRunPaceRatio": 1.02,
    "distanceMiles": 16.2,
    "durationMinutes": 137,
    "elevationGainFeet": 450
  },
  "effectivenessScore": 7.8,
  "insights": [
    {
      "id": "fueled-stable",
      "type": "correlation",
      "title": "Fueling Supported Stability",
      "description": "75g carbs correlated with 82% pace stability on this 16-mile run.",
      "confidence": 70
    }
  ],
  "fuelingLevel": "moderate",
  "performanceCategory": "strong"
}

Example FuelingProfile output:

{
  "totalFueledRuns": 12,
  "totalUnfueledRuns": 45,
  "optimalCarbRange": { "min": 50, "max": 90 },
  "optimalHydrationRange": { "min": 400, "max": 700 },
  "clusters": [
    {
      "id": "well-fueled-long",
      "label": "Well-Fueled Long Runs",
      "avgCarbs": 72,
      "avgHydration": 520,
      "runCount": 8,
      "avgEffectivenessScore": 7.4,
      "avgPaceStability": 79,
      "avgFade": 3.2
    },
    {
      "id": "under-fueled-long",
      "label": "Under-Fueled Long Runs",
      "avgCarbs": 15,
      "avgHydration": 200,
      "runCount": 4,
      "avgEffectivenessScore": 5.2,
      "avgPaceStability": 62,
      "avgFade": 8.5
    }
  ],
  "insights": [
    {
      "id": "fueling-reduces-fade",
      "type": "pattern",
      "title": "Fueling Reduces Late-Run Fade",
      "description": "Your well-fueled long runs average 5% less pace fade.",
      "confidence": 75
    },
    {
      "id": "optimal-carb-range",
      "type": "pattern",
      "title": "Your Optimal Carb Range",
      "description": "Strong performances cluster around 50-90g carbs.",
      "confidence": 70
    }
  ],
  "lastUpdated": 1713523200000
}
*/

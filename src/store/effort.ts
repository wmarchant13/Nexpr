/**
 * Nexpr Effort Classification System
 * 
 * A robust, production-ready system to classify running effort as Easy, Moderate, or Hard.
 * 
 * Key Features:
 * - Dual-mode: Uses heart rate when available, falls back to pace/elevation
 * - Distribution-based: Models runner using percentiles, not peak performance
 * - Grade-Adjusted Pace: Normalizes for elevation gain/loss
 * - Fatigue-aware: Considers recent training load
 * - Zero manual input: Everything inferred automatically
 * 
 * @author Nexpr Engineering
 */

import type { Activity } from "../hooks";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type EffortLabel = "easy" | "moderate" | "hard";

export interface EffortResult {
  score: number;           // 0-10 continuous score
  label: EffortLabel;      // easy / moderate / hard
  explanation: string;     // Human-readable insight
  confidence: number;      // 0-100 confidence in classification
  method: "hr" | "pace";   // Which method was used
  factors: EffortFactors;  // Breakdown of contributing factors
}

export interface EffortFactors {
  relativePace: number;      // How this pace compares to user's distribution
  elevationImpact: number;   // Impact of elevation on effort
  distanceImpact: number;    // Impact of distance (longer = harder)
  fatigueImpact: number;     // Impact of recent training load
  variabilityImpact: number; // Impact of pace variability
  hrImpact?: number;         // Heart rate impact (when available)
}

export interface RunnerBaseline {
  // Pace distribution (min/mile)
  medianPace: number;
  easyPaceThreshold: number;   // 75th percentile (slower = easier)
  hardPaceThreshold: number;   // 25th percentile (faster = harder)
  paceStdDev: number;
  
  // Distance distribution
  medianDistance: number;      // miles
  longRunThreshold: number;    // 90th percentile
  
  // Elevation distribution
  medianElevationPerMile: number;
  highElevationThreshold: number;
  
  // Heart rate (if available)
  hasHRData: boolean;
  estimatedMaxHR?: number;
  restingHR?: number;
  hrZones?: HRZones;
  
  // Training patterns
  typicalWeeklyMiles: number;
  typicalRunsPerWeek: number;
  
  // Metadata
  activityCount: number;
  windowDays: number;
  lastUpdated: number;
}

export interface HRZones {
  zone1Max: number;  // Recovery (< 60% max)
  zone2Max: number;  // Easy (60-70% max)
  zone3Max: number;  // Moderate (70-80% max)
  zone4Max: number;  // Hard (80-90% max)
  zone5Max: number;  // Max (90-100% max)
}

export interface RecentTrainingLoad {
  last3DaysMiles: number;
  last7DaysMiles: number;
  last3DaysHardEfforts: number;
  last7DaysHardEfforts: number;
  daysSinceLastRun: number;
  fatigueScore: number;  // 0-10, higher = more fatigued
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY = "nexpr_effort_baseline_v1";
const BASELINE_CACHE_HOURS = 24; // Recompute baseline once per day
const BASELINE_WINDOW_DAYS = 60; // Use 60 days of data for baseline
const MIN_ACTIVITIES_FOR_BASELINE = 5;

// Grade adjustment factors (based on Strava's GAP algorithm approximation)
// Positive grade = uphill, negative = downhill
const GRADE_ADJUSTMENT_TABLE: Record<number, number> = {
  [-15]: 0.70,  // Steep downhill: 70% effort
  [-10]: 0.82,
  [-5]: 0.91,
  [0]: 1.00,    // Flat: 100% effort
  [5]: 1.12,
  [10]: 1.25,
  [15]: 1.40,   // Steep uphill: 140% effort
  [20]: 1.60,
};

// Effort score thresholds
const EFFORT_THRESHOLDS = {
  easy: { min: 0, max: 3.5 },
  moderate: { min: 3.5, max: 6.5 },
  hard: { min: 6.5, max: 10 },
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert meters to miles
 */
function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

/**
 * Calculate pace in minutes per mile
 */
function calculatePace(distanceMeters: number, movingTimeSeconds: number): number {
  const miles = metersToMiles(distanceMeters);
  if (miles === 0) return 0;
  return movingTimeSeconds / 60 / miles;
}

/**
 * Calculate percentile of a value in an array
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/**
 * Calculate standard deviation
 */
function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Clamp a number between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Get grade adjustment factor for a given grade percentage
 */
function getGradeAdjustment(gradePercent: number): number {
  // Clamp grade to our table range
  const grade = clamp(gradePercent, -15, 20);
  
  // Find surrounding values and interpolate
  const grades = Object.keys(GRADE_ADJUSTMENT_TABLE).map(Number).sort((a, b) => a - b);
  
  for (let i = 0; i < grades.length - 1; i++) {
    if (grade >= grades[i] && grade <= grades[i + 1]) {
      const t = (grade - grades[i]) / (grades[i + 1] - grades[i]);
      return lerp(GRADE_ADJUSTMENT_TABLE[grades[i]], GRADE_ADJUSTMENT_TABLE[grades[i + 1]], t);
    }
  }
  
  // Edge cases
  if (grade <= grades[0]) return GRADE_ADJUSTMENT_TABLE[grades[0]];
  return GRADE_ADJUSTMENT_TABLE[grades[grades.length - 1]];
}

/**
 * Filter to only running activities
 */
function filterRuns(activities: Activity[]): Activity[] {
  return activities.filter(a => 
    a.type === "Run" || a.sport_type === "Run"
  );
}

/**
 * Filter activities within a time window
 */
function filterByTimeWindow(activities: Activity[], days: number): Activity[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return activities.filter(a => new Date(a.start_date).getTime() >= cutoff);
}

// ============================================================================
// BASELINE CALCULATION
// ============================================================================

/**
 * Load cached baseline from localStorage
 */
export function loadBaselineCache(): RunnerBaseline | null {
  if (typeof window === "undefined") return null;
  
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    
    const baseline = JSON.parse(raw) as RunnerBaseline;
    
    // Check if cache is still valid
    const hoursSinceUpdate = (Date.now() - baseline.lastUpdated) / (1000 * 60 * 60);
    if (hoursSinceUpdate > BASELINE_CACHE_HOURS) return null;
    
    return baseline;
  } catch {
    return null;
  }
}

/**
 * Save baseline to localStorage cache
 */
export function saveBaselineCache(baseline: RunnerBaseline): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(baseline));
  } catch {
    console.warn("Failed to cache effort baseline");
  }
}

/**
 * Clear baseline cache
 */
export function clearBaselineCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Calculate runner's baseline metrics from activity history
 * Uses distribution-based statistics, NOT peak performance
 */
export function calculateBaseline(activities: Activity[]): RunnerBaseline {
  const runs = filterRuns(activities);
  const recentRuns = filterByTimeWindow(runs, BASELINE_WINDOW_DAYS);
  
  // Handle edge case: new user with limited data
  const runPool = recentRuns.length >= MIN_ACTIVITIES_FOR_BASELINE 
    ? recentRuns 
    : runs.slice(0, Math.max(MIN_ACTIVITIES_FOR_BASELINE, runs.length));
  
  if (runPool.length === 0) {
    return getDefaultBaseline();
  }
  
  // Calculate pace distribution (min/mile)
  const paces = runPool.map(r => calculatePace(r.distance, r.moving_time)).filter(p => p > 0 && p < 20);
  const medianPace = percentile(paces, 50);
  const easyPaceThreshold = percentile(paces, 75);  // Slower paces (higher number)
  const hardPaceThreshold = percentile(paces, 25);  // Faster paces (lower number)
  const paceStdDev = stdDev(paces);
  
  // Calculate distance distribution (miles)
  const distances = runPool.map(r => metersToMiles(r.distance));
  const medianDistance = percentile(distances, 50);
  const longRunThreshold = percentile(distances, 90);
  
  // Calculate elevation distribution (ft/mile)
  const elevationsPerMile = runPool.map(r => {
    const miles = metersToMiles(r.distance);
    return miles > 0 ? (r.total_elevation_gain * 3.28084) / miles : 0;
  });
  const medianElevationPerMile = percentile(elevationsPerMile, 50);
  const highElevationThreshold = percentile(elevationsPerMile, 85);
  
  // Check for heart rate data availability
  const runsWithHR = runPool.filter(r => r.average_heartrate && r.average_heartrate > 0);
  const hasHRData = runsWithHR.length >= runPool.length * 0.3; // At least 30% with HR
  
  let estimatedMaxHR: number | undefined;
  let restingHR: number | undefined;
  let hrZones: HRZones | undefined;
  
  if (hasHRData) {
    // Estimate max HR from highest recorded
    const maxHRs = runsWithHR
      .filter(r => r.max_heartrate && r.max_heartrate > 0)
      .map(r => r.max_heartrate!);
    
    if (maxHRs.length > 0) {
      // Use 95th percentile of max HRs to avoid outliers
      estimatedMaxHR = Math.round(percentile(maxHRs, 95));
    }
    
    // Estimate resting HR from lowest average HR in easy runs
    const avgHRs = runsWithHR.map(r => r.average_heartrate!);
    const lowestAvgHR = percentile(avgHRs, 10);
    restingHR = Math.round(lowestAvgHR * 0.55); // Rough estimate
    
    if (estimatedMaxHR) {
      hrZones = calculateHRZones(estimatedMaxHR);
    }
  }
  
  // Calculate typical training patterns
  const weeklyMileages: number[] = [];
  const weeklyCounts: number[] = [];
  
  // Group by week
  const weekMap = new Map<string, { miles: number; count: number }>();
  runPool.forEach(r => {
    const date = new Date(r.start_date);
    const weekKey = `${date.getFullYear()}-${Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000))}`;
    const existing = weekMap.get(weekKey) || { miles: 0, count: 0 };
    existing.miles += metersToMiles(r.distance);
    existing.count += 1;
    weekMap.set(weekKey, existing);
  });
  
  weekMap.forEach(v => {
    weeklyMileages.push(v.miles);
    weeklyCounts.push(v.count);
  });
  
  const typicalWeeklyMiles = weeklyMileages.length > 0 ? percentile(weeklyMileages, 50) : 0;
  const typicalRunsPerWeek = weeklyCounts.length > 0 ? percentile(weeklyCounts, 50) : 0;
  
  const baseline: RunnerBaseline = {
    medianPace,
    easyPaceThreshold,
    hardPaceThreshold,
    paceStdDev,
    medianDistance,
    longRunThreshold,
    medianElevationPerMile,
    highElevationThreshold,
    hasHRData,
    estimatedMaxHR,
    restingHR,
    hrZones,
    typicalWeeklyMiles,
    typicalRunsPerWeek,
    activityCount: runPool.length,
    windowDays: BASELINE_WINDOW_DAYS,
    lastUpdated: Date.now(),
  };
  
  // Cache the baseline
  saveBaselineCache(baseline);
  
  return baseline;
}

/**
 * Get default baseline for new users with no data
 */
function getDefaultBaseline(): RunnerBaseline {
  return {
    medianPace: 10.0,  // 10:00/mile
    easyPaceThreshold: 11.0,
    hardPaceThreshold: 9.0,
    paceStdDev: 1.5,
    medianDistance: 4.0,
    longRunThreshold: 8.0,
    medianElevationPerMile: 50,
    highElevationThreshold: 150,
    hasHRData: false,
    typicalWeeklyMiles: 20,
    typicalRunsPerWeek: 3,
    activityCount: 0,
    windowDays: BASELINE_WINDOW_DAYS,
    lastUpdated: Date.now(),
  };
}

/**
 * Calculate heart rate zones based on max HR
 * Using Karvonen formula zones
 */
function calculateHRZones(maxHR: number): HRZones {
  return {
    zone1Max: Math.round(maxHR * 0.60),
    zone2Max: Math.round(maxHR * 0.70),
    zone3Max: Math.round(maxHR * 0.80),
    zone4Max: Math.round(maxHR * 0.90),
    zone5Max: maxHR,
  };
}

// ============================================================================
// GRADE-ADJUSTED PACE (GAP)
// ============================================================================

/**
 * Calculate Grade-Adjusted Pace for an activity
 * 
 * GAP normalizes pace for elevation, making hilly runs comparable to flat runs.
 * 
 * Approach:
 * 1. Calculate average grade from elevation gain/loss over distance
 * 2. Apply adjustment factor based on research (Minetti et al.)
 * 3. Return equivalent flat-ground pace
 * 
 * Note: This is an approximation since we don't have split-level elevation data
 */
export function calculateGAP(
  distanceMeters: number,
  movingTimeSeconds: number,
  elevationGainMeters: number
): { gap: number; adjustmentFactor: number; avgGrade: number } {
  const miles = metersToMiles(distanceMeters);
  const actualPace = calculatePace(distanceMeters, movingTimeSeconds);
  
  if (miles === 0 || actualPace === 0) {
    return { gap: actualPace, adjustmentFactor: 1, avgGrade: 0 };
  }
  
  // Estimate average grade
  // Note: We only have elevation GAIN, not net elevation change
  // Assume a typical out-and-back or loop, so net elevation is ~0
  // The elevation gain represents extra climbing effort
  const elevationGainFeet = elevationGainMeters * 3.28084;
  const elevationPerMile = elevationGainFeet / miles;
  
  // Convert elevation per mile to approximate grade percentage
  // 5280 feet per mile, grade = (rise / run) * 100
  // For a run with 100ft gain/mile: avgGrade ≈ (100 / 5280) * 100 ≈ 1.9%
  const avgGrade = (elevationPerMile / 5280) * 100;
  
  // Get adjustment factor
  const adjustmentFactor = getGradeAdjustment(avgGrade);
  
  // GAP = actual pace / adjustment factor
  // If running uphill (adjustment > 1), GAP will be faster than actual
  // This represents what the runner would do on flat ground
  const gap = actualPace / adjustmentFactor;
  
  return { gap, adjustmentFactor, avgGrade };
}

// ============================================================================
// TRAINING LOAD CALCULATION
// ============================================================================

/**
 * Calculate recent training load for fatigue context
 */
export function calculateTrainingLoad(activities: Activity[]): RecentTrainingLoad {
  const runs = filterRuns(activities);
  const now = Date.now();
  
  const last3Days = filterByTimeWindow(runs, 3);
  const last7Days = filterByTimeWindow(runs, 7);
  
  const last3DaysMiles = last3Days.reduce((sum, r) => sum + metersToMiles(r.distance), 0);
  const last7DaysMiles = last7Days.reduce((sum, r) => sum + metersToMiles(r.distance), 0);
  
  // Count hard efforts (will be updated once we classify them)
  // For now, use suffer_score as a proxy if available, or pace-based
  let last3DaysHardEfforts = 0;
  let last7DaysHardEfforts = 0;
  
  // Simple heuristic: count runs with suffer_score > 50 or fast relative pace
  last3Days.forEach(r => {
    if (r.suffer_score && r.suffer_score > 50) last3DaysHardEfforts++;
  });
  last7Days.forEach(r => {
    if (r.suffer_score && r.suffer_score > 50) last7DaysHardEfforts++;
  });
  
  // Days since last run
  const sortedByDate = runs.sort((a, b) => 
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
  const daysSinceLastRun = sortedByDate.length > 0
    ? (now - new Date(sortedByDate[0].start_date).getTime()) / (1000 * 60 * 60 * 24)
    : 30;
  
  // Calculate fatigue score (0-10)
  // Higher volume and more hard efforts = more fatigue
  // More rest = less fatigue
  let fatigueScore = 0;
  
  // Volume contribution (based on typical weekly miles)
  // If running > 150% of typical in last 7 days, that's high fatigue
  fatigueScore += clamp(last7DaysMiles / 30 * 3, 0, 3); // Max 3 points for volume
  
  // Hard efforts contribution
  fatigueScore += clamp(last3DaysHardEfforts * 1.5, 0, 3); // Max 3 points for recent hard work
  fatigueScore += clamp(last7DaysHardEfforts * 0.5, 0, 2); // Max 2 points for week's hard work
  
  // Rest contribution (reduces fatigue)
  if (daysSinceLastRun >= 2) fatigueScore -= 1;
  if (daysSinceLastRun >= 3) fatigueScore -= 1;
  
  fatigueScore = clamp(fatigueScore, 0, 10);
  
  return {
    last3DaysMiles: Math.round(last3DaysMiles * 10) / 10,
    last7DaysMiles: Math.round(last7DaysMiles * 10) / 10,
    last3DaysHardEfforts,
    last7DaysHardEfforts,
    daysSinceLastRun: Math.round(daysSinceLastRun * 10) / 10,
    fatigueScore,
  };
}

// ============================================================================
// EFFORT SCORING
// ============================================================================

/**
 * Calculate effort score using heart rate (when available)
 */
function calculateHREffortScore(
  avgHR: number,
  maxHR: number,
  baseline: RunnerBaseline
): { score: number; zone: number } {
  if (!baseline.hrZones || !baseline.estimatedMaxHR) {
    return { score: 5, zone: 3 };
  }
  
  const zones = baseline.hrZones;
  const hrReserve = baseline.estimatedMaxHR - (baseline.restingHR || 60);
  const hrPercent = (avgHR - (baseline.restingHR || 60)) / hrReserve;
  
  // Determine zone
  let zone = 1;
  if (avgHR > zones.zone4Max) zone = 5;
  else if (avgHR > zones.zone3Max) zone = 4;
  else if (avgHR > zones.zone2Max) zone = 3;
  else if (avgHR > zones.zone1Max) zone = 2;
  
  // Convert HR % to effort score (0-10)
  // Zone 1-2: Easy (0-3.5)
  // Zone 3: Moderate (3.5-6.5)
  // Zone 4-5: Hard (6.5-10)
  let score: number;
  if (zone <= 2) {
    score = lerp(0, 3.5, hrPercent / 0.70);
  } else if (zone === 3) {
    score = lerp(3.5, 6.5, (hrPercent - 0.70) / 0.10);
  } else {
    score = lerp(6.5, 10, (hrPercent - 0.80) / 0.20);
  }
  
  return { score: clamp(score, 0, 10), zone };
}

/**
 * Calculate effort score using pace and other factors (no HR)
 */
function calculatePaceEffortScore(
  activity: Activity,
  baseline: RunnerBaseline,
  trainingLoad: RecentTrainingLoad
): EffortFactors {
  const pace = calculatePace(activity.distance, activity.moving_time);
  const miles = metersToMiles(activity.distance);
  const gapResult = calculateGAP(activity.distance, activity.moving_time, activity.total_elevation_gain);
  
  // 1. Relative Pace Score (0-10)
  // Compare GAP to user's pace distribution
  // Faster than hard threshold = high score
  // Slower than easy threshold = low score
  let relativePace: number;
  if (gapResult.gap <= baseline.hardPaceThreshold) {
    // Faster than typical hard pace
    const paceRatio = baseline.hardPaceThreshold / gapResult.gap;
    relativePace = lerp(7, 10, Math.min((paceRatio - 1) / 0.15, 1));
  } else if (gapResult.gap >= baseline.easyPaceThreshold) {
    // Slower than typical easy pace
    const paceRatio = gapResult.gap / baseline.easyPaceThreshold;
    relativePace = lerp(2, 0, Math.min((paceRatio - 1) / 0.15, 1));
  } else {
    // Between easy and hard thresholds
    const range = baseline.easyPaceThreshold - baseline.hardPaceThreshold;
    const position = (baseline.easyPaceThreshold - gapResult.gap) / range;
    relativePace = lerp(2, 7, position);
  }
  
  // 2. Elevation Impact (0-3)
  // High elevation adds to effort
  const elevationPerMile = miles > 0 
    ? (activity.total_elevation_gain * 3.28084) / miles 
    : 0;
  let elevationImpact: number;
  if (elevationPerMile <= baseline.medianElevationPerMile) {
    elevationImpact = 0;
  } else if (elevationPerMile >= baseline.highElevationThreshold) {
    elevationImpact = 2;
  } else {
    const range = baseline.highElevationThreshold - baseline.medianElevationPerMile;
    const position = (elevationPerMile - baseline.medianElevationPerMile) / range;
    elevationImpact = position * 2;
  }
  // Extra credit for really hilly runs
  if (elevationPerMile > baseline.highElevationThreshold * 1.5) {
    elevationImpact += 1;
  }
  elevationImpact = clamp(elevationImpact, 0, 3);
  
  // 3. Distance Impact (0-2)
  // Longer runs are harder
  let distanceImpact: number;
  if (miles <= baseline.medianDistance) {
    distanceImpact = 0;
  } else if (miles >= baseline.longRunThreshold) {
    distanceImpact = 1.5;
    // Bonus for very long runs
    if (miles > baseline.longRunThreshold * 1.3) {
      distanceImpact = 2;
    }
  } else {
    const range = baseline.longRunThreshold - baseline.medianDistance;
    const position = (miles - baseline.medianDistance) / range;
    distanceImpact = position * 1.5;
  }
  distanceImpact = clamp(distanceImpact, 0, 2);
  
  // 4. Pace Variability Impact (-1 to 1)
  // Steady pace = easier, variable pace = harder
  // We don't have split data, so this is estimated
  // Use elapsed_time vs moving_time as a proxy
  const movingRatio = activity.moving_time / activity.elapsed_time;
  let variabilityImpact: number;
  if (movingRatio > 0.95) {
    variabilityImpact = 0; // Very consistent
  } else if (movingRatio < 0.80) {
    variabilityImpact = 0.5; // Lots of stops = interval-like
  } else {
    variabilityImpact = lerp(0, 0.5, (0.95 - movingRatio) / 0.15);
  }
  
  // 5. Fatigue Impact (0-2)
  // Recent hard training increases effort
  const fatigueImpact = trainingLoad.fatigueScore * 0.2;
  
  return {
    relativePace: Math.round(relativePace * 100) / 100,
    elevationImpact: Math.round(elevationImpact * 100) / 100,
    distanceImpact: Math.round(distanceImpact * 100) / 100,
    fatigueImpact: Math.round(fatigueImpact * 100) / 100,
    variabilityImpact: Math.round(variabilityImpact * 100) / 100,
  };
}

/**
 * Generate human-readable explanation for effort
 */
function generateExplanation(
  label: EffortLabel,
  factors: EffortFactors,
  baseline: RunnerBaseline,
  activity: Activity,
  method: "hr" | "pace"
): string {
  const pace = calculatePace(activity.distance, activity.moving_time);
  const miles = metersToMiles(activity.distance);
  const elevationPerMile = miles > 0 ? (activity.total_elevation_gain * 3.28084) / miles : 0;
  
  const parts: string[] = [];
  
  // Primary descriptor
  if (label === "hard") {
    parts.push("Hard effort");
  } else if (label === "moderate") {
    parts.push("Moderate effort");
  } else {
    parts.push("Easy effort");
  }
  
  // Add context based on most significant factors
  const contextParts: string[] = [];
  
  if (factors.relativePace >= 6) {
    contextParts.push("faster than your typical pace");
  } else if (factors.relativePace <= 3) {
    contextParts.push("slower, recovery-focused pace");
  }
  
  if (factors.elevationImpact >= 1.5) {
    contextParts.push("significant elevation gain");
  }
  
  if (factors.distanceImpact >= 1) {
    contextParts.push("longer than your typical run");
  }
  
  if (factors.fatigueImpact >= 0.8) {
    contextParts.push("on top of recent training load");
  }
  
  if (method === "hr" && factors.hrImpact !== undefined) {
    if (factors.hrImpact >= 7) {
      contextParts.push("high heart rate zone");
    } else if (factors.hrImpact <= 3) {
      contextParts.push("low heart rate zone");
    }
  }
  
  if (contextParts.length > 0) {
    parts.push("—");
    parts.push(contextParts.slice(0, 2).join(" with "));
  }
  
  return parts.join(" ") + ".";
}

// ============================================================================
// MAIN CLASSIFICATION FUNCTION
// ============================================================================

/**
 * Classify effort for a single activity
 * 
 * This is the main entry point for effort classification.
 * It automatically chooses between HR-based and pace-based methods.
 */
export function classifyEffort(
  activity: Activity,
  allActivities: Activity[],
  baseline?: RunnerBaseline
): EffortResult {
  // Get or calculate baseline
  const runnerBaseline = baseline || loadBaselineCache() || calculateBaseline(allActivities);
  
  // Calculate training load
  const trainingLoad = calculateTrainingLoad(allActivities);
  
  // Determine if we should use HR-based classification
  const useHR = runnerBaseline.hasHRData && 
                activity.average_heartrate && 
                activity.average_heartrate > 0 &&
                runnerBaseline.estimatedMaxHR;
  
  let score: number;
  let factors: EffortFactors;
  let method: "hr" | "pace";
  
  if (useHR) {
    // HR-based classification
    method = "hr";
    const hrResult = calculateHREffortScore(
      activity.average_heartrate!,
      activity.max_heartrate || activity.average_heartrate! * 1.1,
      runnerBaseline
    );
    
    // Get pace factors for additional context
    const paceFactors = calculatePaceEffortScore(activity, runnerBaseline, trainingLoad);
    
    // Combine HR score with pace factors (HR weighted 70%, pace factors 30%)
    factors = {
      ...paceFactors,
      hrImpact: hrResult.score,
    };
    
    // Weighted combination
    const paceContribution = (
      paceFactors.relativePace * 0.6 +
      paceFactors.elevationImpact +
      paceFactors.distanceImpact +
      paceFactors.variabilityImpact +
      paceFactors.fatigueImpact
    );
    
    score = hrResult.score * 0.7 + paceContribution * 0.3 / 10 * 10;
  } else {
    // Pace-based classification
    method = "pace";
    factors = calculatePaceEffortScore(activity, runnerBaseline, trainingLoad);
    
    // Combine factors into final score
    // Relative pace is the primary driver
    score = factors.relativePace * 0.65 +  // 65% weight
            factors.elevationImpact * 0.8 +  // Can add up to ~2.4 points
            factors.distanceImpact * 0.6 +   // Can add up to ~1.2 points
            factors.variabilityImpact +      // Can add up to ~1 point
            factors.fatigueImpact;           // Can add up to ~2 points
  }
  
  score = clamp(Math.round(score * 10) / 10, 0, 10);
  
  // Determine label
  let label: EffortLabel;
  if (score <= EFFORT_THRESHOLDS.easy.max) {
    label = "easy";
  } else if (score <= EFFORT_THRESHOLDS.moderate.max) {
    label = "moderate";
  } else {
    label = "hard";
  }
  
  // Calculate confidence based on data quality
  let confidence = 50; // Base confidence
  if (runnerBaseline.activityCount >= 20) confidence += 20;
  else if (runnerBaseline.activityCount >= 10) confidence += 10;
  
  if (method === "hr") confidence += 15;
  if (trainingLoad.last7DaysMiles > 0) confidence += 10;
  
  confidence = clamp(confidence, 0, 100);
  
  // Generate explanation
  const explanation = generateExplanation(label, factors, runnerBaseline, activity, method);
  
  return {
    score,
    label,
    explanation,
    confidence,
    method,
    factors,
  };
}

/**
 * Classify effort for multiple activities efficiently
 * Reuses baseline calculation across all activities
 */
export function classifyEfforts(activities: Activity[]): Map<number, EffortResult> {
  const baseline = loadBaselineCache() || calculateBaseline(activities);
  const results = new Map<number, EffortResult>();
  
  const runs = filterRuns(activities);
  
  runs.forEach(activity => {
    results.set(activity.id, classifyEffort(activity, activities, baseline));
  });
  
  return results;
}

// ============================================================================
// UI HELPERS & TOOLTIP
// ============================================================================

/**
 * Get color for effort label
 */
export function getEffortColor(label: EffortLabel): string {
  switch (label) {
    case "easy": return "#4ade80";    // Green
    case "moderate": return "#facc15"; // Yellow
    case "hard": return "#f87171";     // Red
  }
}

/**
 * Get background color for effort label
 */
export function getEffortBgColor(label: EffortLabel): string {
  switch (label) {
    case "easy": return "rgba(74, 222, 128, 0.15)";
    case "moderate": return "rgba(250, 204, 21, 0.15)";
    case "hard": return "rgba(248, 113, 113, 0.15)";
  }
}

/**
 * Format effort score for display
 */
export function formatEffortScore(score: number): string {
  return score.toFixed(1);
}

/**
 * Tooltip text explaining effort calculation
 * This is the exact copy for the UI
 */
export const EFFORT_TOOLTIP = {
  title: "How Effort is Calculated",
  description: `Effort is automatically calculated using your pace, elevation, distance, and recent training patterns. We compare each run to your personal baseline—built from your last 60 days of running—to determine whether it was easy, moderate, or hard for you.

If heart rate data is available from Strava, it's used to improve accuracy by incorporating your actual physiological response.

No manual input required—your effort level is personalized and updates as you train.`,
  shortDescription: "Effort is automatically calculated using pace, elevation, and training patterns. Heart rate data improves accuracy when available.",
};

/**
 * Get baseline status for debugging/display
 */
export function getBaselineStatus(baseline: RunnerBaseline): {
  hasData: boolean;
  quality: "new" | "limited" | "good" | "excellent";
  message: string;
} {
  if (baseline.activityCount === 0) {
    return {
      hasData: false,
      quality: "new",
      message: "Start running to build your personal baseline.",
    };
  } else if (baseline.activityCount < 5) {
    return {
      hasData: true,
      quality: "limited",
      message: `Effort estimates based on ${baseline.activityCount} runs. Accuracy improves with more data.`,
    };
  } else if (baseline.activityCount < 20) {
    return {
      hasData: true,
      quality: "good",
      message: `Effort calibrated from ${baseline.activityCount} runs.`,
    };
  } else {
    return {
      hasData: true,
      quality: "excellent",
      message: `Effort precisely calibrated from ${baseline.activityCount} runs.`,
    };
  }
}

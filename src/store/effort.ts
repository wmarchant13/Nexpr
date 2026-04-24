

import type { Activity } from "../hooks";

export type EffortLabel = "easy" | "moderate" | "hard";

export interface EffortResult {
  score: number;           
  label: EffortLabel;      
  explanation: string;     
  confidence: number;      
  method: "hr" | "pace";   
  factors: EffortFactors;  
}

export interface EffortFactors {
  relativePace: number;      
  elevationImpact: number;   
  distanceImpact: number;    
  fatigueImpact: number;     
  variabilityImpact: number; 
  hrImpact?: number;         
}

export interface RunnerBaseline {
  
  medianPace: number;
  easyPaceThreshold: number;   
  hardPaceThreshold: number;   
  paceStdDev: number;
  
  
  medianDistance: number;      
  longRunThreshold: number;    
  
  
  medianElevationPerMile: number;
  highElevationThreshold: number;
  
  
  hasHRData: boolean;
  estimatedMaxHR?: number;
  restingHR?: number;
  hrZones?: HRZones;
  
  
  typicalWeeklyMiles: number;
  typicalRunsPerWeek: number;
  
  
  activityCount: number;
  windowDays: number;
  lastUpdated: number;
}

export interface HRZones {
  zone1Max: number;  
  zone2Max: number;  
  zone3Max: number;  
  zone4Max: number;  
  zone5Max: number;  
}

export interface RecentTrainingLoad {
  last3DaysMiles: number;
  last7DaysMiles: number;
  last3DaysHardEfforts: number;
  last7DaysHardEfforts: number;
  daysSinceLastRun: number;
  fatigueScore: number;  
}

const CACHE_KEY = "nexpr_effort_baseline_v1";
const BASELINE_CACHE_HOURS = 24; 
const BASELINE_WINDOW_DAYS = 60; 
const MIN_ACTIVITIES_FOR_BASELINE = 5;

const GRADE_ADJUSTMENT_TABLE: Record<number, number> = {
  [-15]: 0.70,  
  [-10]: 0.82,
  [-5]: 0.91,
  [0]: 1.00,    
  [5]: 1.12,
  [10]: 1.25,
  [15]: 1.40,   
  [20]: 1.60,
};

const EFFORT_THRESHOLDS = {
  easy: { min: 0, max: 3.5 },
  moderate: { min: 3.5, max: 6.5 },
  hard: { min: 6.5, max: 10 },
} as const;

// Converts meters to miles
function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

// Computes pace in minutes per mile
function calculatePace(distanceMeters: number, movingTimeSeconds: number): number {
  const miles = metersToMiles(distanceMeters);
  if (miles === 0) return 0;
  return movingTimeSeconds / 60 / miles;
}

// Returns the Nth percentile value of an array
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  // Index
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// Computes standard deviation of a number array
function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

// Clamps a value between a min and max
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Linear interpolation between two values
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Interpolates grade-adjustment factor for a given slope
function getGradeAdjustment(gradePercent: number): number {
  
  const grade = clamp(gradePercent, -15, 20);
  
  
  const grades = Object.keys(GRADE_ADJUSTMENT_TABLE).map(Number).sort((a, b) => a - b);
  
  for (let i = 0; i < grades.length - 1; i++) {
    if (grade >= grades[i] && grade <= grades[i + 1]) {
      const t = (grade - grades[i]) / (grades[i + 1] - grades[i]);
      return lerp(GRADE_ADJUSTMENT_TABLE[grades[i]], GRADE_ADJUSTMENT_TABLE[grades[i + 1]], t);
    }
  }
  
  
  if (grade <= grades[0]) return GRADE_ADJUSTMENT_TABLE[grades[0]];
  return GRADE_ADJUSTMENT_TABLE[grades[grades.length - 1]];
}

// Filters an activity list to running activities only
function filterRuns(activities: Activity[]): Activity[] {
  return activities.filter(a => 
    a.type === "Run" || a.sport_type === "Run"
  );
}

// Filters activities to those within the past N days
function filterByTimeWindow(activities: Activity[], days: number): Activity[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return activities.filter(a => new Date(a.start_date).getTime() >= cutoff);
}

// Loads the cached RunnerBaseline from localStorage
export function loadBaselineCache(): RunnerBaseline | null {
  if (typeof window === "undefined") return null;
  
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    
    const baseline = JSON.parse(raw) as RunnerBaseline;
    
    
    // Hours Since Update
    const hoursSinceUpdate = (Date.now() - baseline.lastUpdated) / (1000 * 60 * 60);
    if (hoursSinceUpdate > BASELINE_CACHE_HOURS) return null;
    
    return baseline;
  } catch {
    return null;
  }
}

// Writes the RunnerBaseline to localStorage
export function saveBaselineCache(baseline: RunnerBaseline): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(baseline));
  } catch {
    
  }
}

// Removes baseline cache
export function clearBaselineCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

// Builds a RunnerBaseline from recent activity history
export function calculateBaseline(activities: Activity[]): RunnerBaseline {
  const runs = filterRuns(activities);
  const recentRuns = filterByTimeWindow(runs, BASELINE_WINDOW_DAYS);
  
  
  const runPool = recentRuns.length >= MIN_ACTIVITIES_FOR_BASELINE 
    ? recentRuns 
    : runs.slice(0, Math.max(MIN_ACTIVITIES_FOR_BASELINE, runs.length));
  
  if (runPool.length === 0) {
    return getDefaultBaseline();
  }
  
  
  const paces = runPool.map(r => calculatePace(r.distance, r.moving_time)).filter(p => p > 0 && p < 20);
  const medianPace = percentile(paces, 50);
  const easyPaceThreshold = percentile(paces, 75);  
  const hardPaceThreshold = percentile(paces, 25);  
  const paceStdDev = stdDev(paces);
  
  
  const distances = runPool.map(r => metersToMiles(r.distance));
  const medianDistance = percentile(distances, 50);
  const longRunThreshold = percentile(distances, 90);
  
  
  const elevationsPerMile = runPool.map(r => {
    const miles = metersToMiles(r.distance);
    return miles > 0 ? (r.total_elevation_gain * 3.28084) / miles : 0;
  });
  const medianElevationPerMile = percentile(elevationsPerMile, 50);
  const highElevationThreshold = percentile(elevationsPerMile, 85);
  
  
  const runsWithHR = runPool.filter(r => r.average_heartrate && r.average_heartrate > 0);
  const hasHRData = runsWithHR.length >= runPool.length * 0.3; 
  
  let estimatedMaxHR: number | undefined;
  let restingHR: number | undefined;
  let hrZones: HRZones | undefined;
  
  if (hasHRData) {
    
    const maxHRs = runsWithHR
      .filter(r => r.max_heartrate && r.max_heartrate > 0)
      .map(r => r.max_heartrate!);
    
    if (maxHRs.length > 0) {
      
      estimatedMaxHR = Math.round(percentile(maxHRs, 95));
    }
    
    
    const avgHRs = runsWithHR.map(r => r.average_heartrate!);
    const lowestAvgHR = percentile(avgHRs, 10);
    restingHR = Math.round(lowestAvgHR * 0.55); 
    
    if (estimatedMaxHR) {
      hrZones = calculateHRZones(estimatedMaxHR);
    }
  }
  
  
  const weeklyMileages: number[] = [];
  const weeklyCounts: number[] = [];
  
  
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
  
  
  saveBaselineCache(baseline);
  
  return baseline;
}

// Returns a sensible default baseline for new users
function getDefaultBaseline(): RunnerBaseline {
  return {
    medianPace: 10.0,  
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

// Computes 5 HR training zones from max heart rate
function calculateHRZones(maxHR: number): HRZones {
  return {
    zone1Max: Math.round(maxHR * 0.60),
    zone2Max: Math.round(maxHR * 0.70),
    zone3Max: Math.round(maxHR * 0.80),
    zone4Max: Math.round(maxHR * 0.90),
    zone5Max: maxHR,
  };
}

// Computes grade-adjusted pace for an activity
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
  
  
  
  
  
  const elevationGainFeet = elevationGainMeters * 3.28084;
  const elevationPerMile = elevationGainFeet / miles;
  
  
  
  
  // Avg Grade
  const avgGrade = (elevationPerMile / 5280) * 100;
  
  
  const adjustmentFactor = getGradeAdjustment(avgGrade);
  
  
  
  
  const gap = actualPace / adjustmentFactor;
  
  return { gap, adjustmentFactor, avgGrade };
}

// Computes recent training load over 3 and 7-day windows
export function calculateTrainingLoad(activities: Activity[]): RecentTrainingLoad {
  const runs = filterRuns(activities);
  const now = Date.now();
  
  const last3Days = filterByTimeWindow(runs, 3);
  const last7Days = filterByTimeWindow(runs, 7);
  
  const last3DaysMiles = last3Days.reduce((sum, r) => sum + metersToMiles(r.distance), 0);
  const last7DaysMiles = last7Days.reduce((sum, r) => sum + metersToMiles(r.distance), 0);
  
  
  
  let last3DaysHardEfforts = 0;
  let last7DaysHardEfforts = 0;
  
  
  last3Days.forEach(r => {
    if (r.suffer_score && r.suffer_score > 50) last3DaysHardEfforts++;
  });
  last7Days.forEach(r => {
    if (r.suffer_score && r.suffer_score > 50) last7DaysHardEfforts++;
  });
  
  
  const sortedByDate = runs.sort((a, b) => 
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
  const daysSinceLastRun = sortedByDate.length > 0
    ? (now - new Date(sortedByDate[0].start_date).getTime()) / (1000 * 60 * 60 * 24)
    : 30;
  
  
  
  
  let fatigueScore = 0;
  
  
  
  fatigueScore += clamp(last7DaysMiles / 30 * 3, 0, 3); 
  
  
  fatigueScore += clamp(last3DaysHardEfforts * 1.5, 0, 3); 
  fatigueScore += clamp(last7DaysHardEfforts * 0.5, 0, 2); 
  
  
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

// Classifies effort using heart rate zone
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
  // Hr Percent
  const hrPercent = (avgHR - (baseline.restingHR || 60)) / hrReserve;
  
  
  let zone = 1;
  if (avgHR > zones.zone4Max) zone = 5;
  else if (avgHR > zones.zone3Max) zone = 4;
  else if (avgHR > zones.zone2Max) zone = 3;
  else if (avgHR > zones.zone1Max) zone = 2;
  
  
  
  
  
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

// Classifies effort using pace relative to baseline
function calculatePaceEffortScore(
  activity: Activity,
  baseline: RunnerBaseline,
  trainingLoad: RecentTrainingLoad
): EffortFactors {
  const pace = calculatePace(activity.distance, activity.moving_time);
  const miles = metersToMiles(activity.distance);
  const gapResult = calculateGAP(activity.distance, activity.moving_time, activity.total_elevation_gain);
  
  
  
  
  
  let relativePace: number;
  if (gapResult.gap <= baseline.hardPaceThreshold) {
    
    const paceRatio = baseline.hardPaceThreshold / gapResult.gap;
    relativePace = lerp(7, 10, Math.min((paceRatio - 1) / 0.15, 1));
  } else if (gapResult.gap >= baseline.easyPaceThreshold) {
    
    const paceRatio = gapResult.gap / baseline.easyPaceThreshold;
    relativePace = lerp(2, 0, Math.min((paceRatio - 1) / 0.15, 1));
  } else {
    
    const range = baseline.easyPaceThreshold - baseline.hardPaceThreshold;
    // Position
    const position = (baseline.easyPaceThreshold - gapResult.gap) / range;
    relativePace = lerp(2, 7, position);
  }
  
  
  
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
    // Position
    const position = (elevationPerMile - baseline.medianElevationPerMile) / range;
    elevationImpact = position * 2;
  }
  
  if (elevationPerMile > baseline.highElevationThreshold * 1.5) {
    elevationImpact += 1;
  }
  elevationImpact = clamp(elevationImpact, 0, 3);
  
  
  
  let distanceImpact: number;
  if (miles <= baseline.medianDistance) {
    distanceImpact = 0;
  } else if (miles >= baseline.longRunThreshold) {
    distanceImpact = 1.5;
    
    if (miles > baseline.longRunThreshold * 1.3) {
      distanceImpact = 2;
    }
  } else {
    const range = baseline.longRunThreshold - baseline.medianDistance;
    // Position
    const position = (miles - baseline.medianDistance) / range;
    distanceImpact = position * 1.5;
  }
  distanceImpact = clamp(distanceImpact, 0, 2);
  
  
  
  
  
  const movingRatio = activity.moving_time / activity.elapsed_time;
  let variabilityImpact: number;
  if (movingRatio > 0.95) {
    variabilityImpact = 0; 
  } else if (movingRatio < 0.80) {
    variabilityImpact = 0.5; 
  } else {
    variabilityImpact = lerp(0, 0.5, (0.95 - movingRatio) / 0.15);
  }
  
  
  
  const fatigueImpact = trainingLoad.fatigueScore * 0.2;
  
  return {
    relativePace: Math.round(relativePace * 100) / 100,
    elevationImpact: Math.round(elevationImpact * 100) / 100,
    distanceImpact: Math.round(distanceImpact * 100) / 100,
    fatigueImpact: Math.round(fatigueImpact * 100) / 100,
    variabilityImpact: Math.round(variabilityImpact * 100) / 100,
  };
}

// Generates a human-readable effort explanation string
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
  
  
  if (label === "hard") {
    parts.push("Hard effort");
  } else if (label === "moderate") {
    parts.push("Moderate effort");
  } else {
    parts.push("Easy effort");
  }
  
  
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

// Classifies a single activity's effort as easy/moderate/hard
export function classifyEffort(
  activity: Activity,
  allActivities: Activity[],
  baseline?: RunnerBaseline
): EffortResult {
  
  const runnerBaseline = baseline || loadBaselineCache() || calculateBaseline(allActivities);
  
  
  const trainingLoad = calculateTrainingLoad(allActivities);
  
  
  const useHR = runnerBaseline.hasHRData && 
                activity.average_heartrate && 
                activity.average_heartrate > 0 &&
                runnerBaseline.estimatedMaxHR;
  
  let score: number;
  let factors: EffortFactors;
  let method: "hr" | "pace";
  
  if (useHR) {
    
    method = "hr";
    const hrResult = calculateHREffortScore(
      activity.average_heartrate!,
      activity.max_heartrate || activity.average_heartrate! * 1.1,
      runnerBaseline
    );
    
    
    const paceFactors = calculatePaceEffortScore(activity, runnerBaseline, trainingLoad);
    
    
    factors = {
      ...paceFactors,
      hrImpact: hrResult.score,
    };
    
    
    // Pace Contribution
    const paceContribution = (
      paceFactors.relativePace * 0.6 +
      paceFactors.elevationImpact +
      paceFactors.distanceImpact +
      paceFactors.variabilityImpact +
      paceFactors.fatigueImpact
    );
    
    score = hrResult.score * 0.7 + paceContribution * 0.3 / 10 * 10;
  } else {
    
    method = "pace";
    factors = calculatePaceEffortScore(activity, runnerBaseline, trainingLoad);
    
    
    
    score = factors.relativePace * 0.65 +  
            factors.elevationImpact * 0.8 +  
            factors.distanceImpact * 0.6 +   
            factors.variabilityImpact +      
            factors.fatigueImpact;           
  }
  
  score = clamp(Math.round(score * 10) / 10, 0, 10);
  
  
  let label: EffortLabel;
  if (score <= EFFORT_THRESHOLDS.easy.max) {
    label = "easy";
  } else if (score <= EFFORT_THRESHOLDS.moderate.max) {
    label = "moderate";
  } else {
    label = "hard";
  }
  
  
  let confidence = 50; 
  if (runnerBaseline.activityCount >= 20) confidence += 20;
  else if (runnerBaseline.activityCount >= 10) confidence += 10;
  
  if (method === "hr") confidence += 15;
  if (trainingLoad.last7DaysMiles > 0) confidence += 10;
  
  confidence = clamp(confidence, 0, 100);
  
  
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

// Classifies a batch of activities using the shared baseline
export function classifyEfforts(activities: Activity[]): Map<number, EffortResult> {
  const baseline = loadBaselineCache() || calculateBaseline(activities);
  const results = new Map<number, EffortResult>();
  
  const runs = filterRuns(activities);
  
  runs.forEach(activity => {
    results.set(activity.id, classifyEffort(activity, activities, baseline));
  });
  
  return results;
}

// Returns the hex color for an effort label
export function getEffortColor(label: EffortLabel): string {
  switch (label) {
    case "easy": return "#4ade80";    
    case "moderate": return "#facc15"; 
    case "hard": return "#f87171";     
  }
}

// Returns the background hex color for an effort label
export function getEffortBgColor(label: EffortLabel): string {
  switch (label) {
    case "easy": return "rgba(74, 222, 128, 0.15)";
    case "moderate": return "rgba(250, 204, 21, 0.15)";
    case "hard": return "rgba(248, 113, 113, 0.15)";
  }
}

// Formats a numeric effort score as a display string
export function formatEffortScore(score: number): string {
  return score.toFixed(1);
}

export const EFFORT_TOOLTIP = {
  title: "How Effort is Calculated",
  description: `Effort is automatically calculated using your pace, elevation, distance, and recent training patterns. We compare each run to your personal baseline—built from your last 60 days of running—to determine whether it was easy, moderate, or hard for you.

If heart rate data is available from Strava, it's used to improve accuracy by incorporating your actual physiological response.

No manual input required—your effort level is personalized and updates as you train.`,
  shortDescription: "Effort is automatically calculated using pace, elevation, and training patterns. Heart rate data improves accuracy when available.",
};

// Returns a human-readable description of the baseline state
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

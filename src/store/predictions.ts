

import type { Activity } from "../hooks";
import { kmToMiles, mToKm, formatPace } from "../hooks";

const RACE_DISTANCES = {
  "5K": 5000,
  "10K": 10000,
  "Half Marathon": 21097.5,
  "Marathon": 42195,
} as const;

export type RaceDistance = keyof typeof RACE_DISTANCES;

export interface PRRecord {
  distance: RaceDistance;
  time: number; 
  pace: number; 
  date: Date;
  activityId: number;
  activityName: string;
}

export interface FitnessMetrics {
  momentum: number;     
  freshness: number;    
  readiness: number;    
  trend: "building" | "maintaining" | "recovering" | "declining";
  rampRate: number;     
}

export interface PRPrediction {
  distance: RaceDistance;
  currentPR: PRRecord | null;
  predictedTime: number | null;  
  predictedPace: number | null;  
  probability: number;           
  readinessScore: number;        
  daysToOptimalReadiness: number;
  recommendation: string;
}

export interface WeeklyLoad {
  weekStart: Date;
  totalLoad: number;
  runCount: number;
  totalMiles: number;
  avgIntensity: number;
  avgPace: number;
}

export interface InjuryRiskWarning {
  id: string;
  severity: "warning" | "alert";
  title: string;
  message: string;
  value: number;
  context?: string;
}

export interface TrainingRecommendation {
  type: "push" | "maintain" | "recover" | "easy";
  intensity: string;
  rationale: string;
  suggestedMiles: number;
  suggestedPace: string;
}

// Formats a Date as YYYY-MM-DD string
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Parses a YYYY-MM-DD string into a Date object
function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Returns the Monday key for a given date
function getWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return formatDateKey(d);
}

// Returns true if the run exceeds effort thresholds
function isHardRun(activity: Activity, baselinePace: number): boolean {
  const miles = kmToMiles(mToKm(activity.distance));
  if (miles <= 0) return false;

  if (activity.average_heartrate && activity.average_heartrate > 155) {
    return true;
  }

  if (baselinePace <= 0) return false;

  // Pace
  const pace = (activity.moving_time / 60) / miles;
  return pace <= baselinePace * 0.95;
}

// Computes momentum, freshness, and readiness metrics
export function calculateFitnessMetrics(activities: Activity[]): FitnessMetrics {
  const runs = activities.filter(a => a.type === "Run" || a.sport_type === "Run");

  if (runs.length === 0) {
    return { momentum: 0, freshness: 0, readiness: 0, trend: "maintaining", rampRate: 0 };
  }

  
  const weekMiles = new Map<string, number>();
  for (const run of runs) {
    const key = getWeekMonday(new Date(run.start_date));
    const miles = kmToMiles(mToKm(run.distance));
    weekMiles.set(key, (weekMiles.get(key) ?? 0) + miles);
  }

  const now = new Date();
  const thisMonday = getWeekMonday(now);

  // Returns the week-key N weeks before the current Monday
  function mondayMinusWeeks(n: number): string {
    const d = parseDateKey(thisMonday);
    d.setDate(d.getDate() - n * 7);
    d.setHours(0, 0, 0, 0);
    return formatDateKey(d);
  }

  
  const momentumWeeks = [1, 2, 3, 4].map(n => weekMiles.get(mondayMinusWeeks(n)) ?? 0);
  const momentum = Math.round((momentumWeeks.reduce((s, v) => s + v, 0) / 4) * 10) / 10;

  
  
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const twentyEightDaysAgo = new Date(now);
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

  let acute = 0;
  let chronic28 = 0;
  for (const run of runs) {
    const date = new Date(run.start_date);
    const miles = kmToMiles(mToKm(run.distance));
    if (date >= sevenDaysAgo) acute += miles;
    if (date >= twentyEightDaysAgo) chronic28 += miles;
  }
  const chronicAvg = chronic28 / 4; 
  const ratio = chronicAvg > 0 ? acute / chronicAvg : 1;
  const freshness = chronicAvg > 0
    ? Math.round((1 - acute / chronicAvg) * 1000) / 10
    : 0;
  const readiness = Math.min(100, Math.max(0, Math.round((200 - 100 * ratio) * 10) / 10));

  
  const lastWeekMiles = weekMiles.get(mondayMinusWeeks(1)) ?? 0;
  const priorWeeks = [2, 3, 4, 5].map(n => weekMiles.get(mondayMinusWeeks(n)) ?? 0);
  const priorAvg = priorWeeks.reduce((s, v) => s + v, 0) / 4;
  const rampRate = priorAvg > 0
    ? Math.round(((lastWeekMiles - priorAvg) / priorAvg) * 1000) / 10
    : 0;

  let trend: FitnessMetrics["trend"];
  if (rampRate > 5) trend = "building";
  else if (rampRate < -5) trend = "declining";
  else if (readiness >= 70) trend = "recovering";
  else trend = "maintaining";

  return { momentum, freshness, readiness, trend, rampRate };
}

// Finds the best recorded time for each standard race distance
export function findPRs(activities: Activity[]): PRRecord[] {
  const runs = activities.filter(a => a.type === "Run" || a.sport_type === "Run");
  const prs: PRRecord[] = [];
  
  for (const [distanceName, targetMeters] of Object.entries(RACE_DISTANCES)) {
    const tolerance = targetMeters * 0.05; 
    
    
    const candidates = runs.filter(
      a => Math.abs(a.distance - targetMeters) <= tolerance
    );
    
    if (candidates.length === 0) continue;
    
    
    const fastest = candidates.reduce((best, current) => {
      const bestPace = best.moving_time / best.distance;
      const currentPace = current.moving_time / current.distance;
      return currentPace < bestPace ? current : best;
    });
    
    const miles = kmToMiles(mToKm(fastest.distance));
    // Pace
    const pace = (fastest.moving_time / 60) / miles;
    
    prs.push({
      distance: distanceName as RaceDistance,
      time: fastest.moving_time,
      pace,
      date: new Date(fastest.start_date),
      activityId: fastest.id,
      activityName: fastest.name,
    });
  }
  
  return prs;
}

export interface EffortDistribution {
  percentEasy: number;
  percentModerate: number;
  percentHard: number;
}

// Scores effort distribution against the 80/10/10 ideal
function calculateEffortReadiness(effort: EffortDistribution): number {
  const idealEasy = 80;
  const idealModerate = 10;
  const idealHard = 10;
  
  
  const easyDiff = Math.abs(effort.percentEasy - idealEasy);
  const moderateDiff = Math.abs(effort.percentModerate - idealModerate);
  const hardDiff = Math.abs(effort.percentHard - idealHard);
  
  
  // Total Diff
  const totalDiff = (easyDiff * 1.5) + moderateDiff + hardDiff;
  
  
  const score = Math.max(0, Math.min(100, 100 - totalDiff));
  return Math.round(score);
}

// Predicts future PRs using Riegel extrapolation and readiness
export function predictPRs(
  activities: Activity[],
  trainingMetrics: FitnessMetrics,
  effortDistribution?: EffortDistribution
): PRPrediction[] {
  const currentPRs = findPRs(activities);
  const predictions: PRPrediction[] = [];
  
  
  const effortReadiness = effortDistribution 
    ? calculateEffortReadiness(effortDistribution)
    : null;
  
  
  const recentRuns = activities
    .filter(a => {
      const isRun = a.type === "Run" || a.sport_type === "Run";
      // Days Ago
      const daysAgo = (Date.now() - new Date(a.start_date).getTime()) / (1000 * 60 * 60 * 24);
      return isRun && daysAgo <= 30 && a.distance >= 3000; 
    })
    .sort((a, b) => {
      
      const paceA = a.moving_time / a.distance;
      const paceB = b.moving_time / b.distance;
      return paceA - paceB;
    });
  
  if (recentRuns.length === 0) {
    return Object.keys(RACE_DISTANCES).map(distance => ({
      distance: distance as RaceDistance,
      currentPR: currentPRs.find(p => p.distance === distance) || null,
      predictedTime: null,
      predictedPace: null,
      probability: 0,
      readinessScore: 0,
      daysToOptimalReadiness: 14,
      recommendation: "Need more recent running data for predictions",
    }));
  }
  
  
  const baseline = recentRuns[0];
  const baselineSeconds = baseline.moving_time;
  const baselineMeters = baseline.distance;
  
  for (const [distanceName, targetMeters] of Object.entries(RACE_DISTANCES)) {
    const existingPR = currentPRs.find(p => p.distance === distanceName) || null;
    
    
    const predictedSeconds = baselineSeconds * Math.pow(targetMeters / baselineMeters, 1.06);
    
    
    const readinessAdjustment = 1 - (trainingMetrics.readiness / 500);
    const adjustedSeconds = predictedSeconds * readinessAdjustment;
    
    const predictedMiles = kmToMiles(mToKm(targetMeters));
    // Predicted Pace
    const predictedPace = (adjustedSeconds / 60) / predictedMiles;
    
    
    let probability = 0;
    if (existingPR) {
      // Improvement
      const improvement = (existingPR.time - adjustedSeconds) / existingPR.time;
      if (improvement > 0) {
        probability = Math.min(95, Math.round(improvement * 500 + trainingMetrics.readiness * 2));
      } else {
        probability = Math.max(5, Math.round(50 + trainingMetrics.readiness * 2));
      }
    } else {
      probability = 75; 
    }
    
    
    let readinessScore: number;
    if (effortReadiness !== null) {
      const trainingScore = Math.max(0, Math.min(100, 50 + trainingMetrics.readiness * 3));
      readinessScore = Math.round((trainingScore * 0.4) + (effortReadiness * 0.6));
    } else {
      readinessScore = Math.round(
        Math.max(0, Math.min(100, 50 + trainingMetrics.readiness * 3))
      );
    }
    
    
    const optimalReadiness = 20;
    const daysToOptimal = trainingMetrics.readiness >= optimalReadiness 
      ? 0 
      : Math.round((optimalReadiness - trainingMetrics.readiness) * 2);
    
    
    let recommendation: string;
    const effortNote = effortDistribution && effortDistribution.percentEasy < 60
      ? " Increase easy runs to improve recovery."
      : "";
      
    if (trainingMetrics.readiness < -10) {
      recommendation = "Focus on recovery. Recent high volume may limit performance." + effortNote;
    } else if (trainingMetrics.readiness < 5) {
      recommendation = "Maintain current training. A slight taper would optimize race potential." + effortNote;
    } else if (trainingMetrics.readiness < 20) {
      recommendation = "Good readiness window. Consider racing in the next 1-2 weeks." + effortNote;
    } else {
      recommendation = "Peak readiness! This is an ideal time to attempt a PR." + effortNote;
    }
    
    predictions.push({
      distance: distanceName as RaceDistance,
      currentPR: existingPR,
      predictedTime: Math.round(adjustedSeconds),
      predictedPace: Math.round(predictedPace * 100) / 100,
      probability: Math.max(0, Math.min(100, probability)),
      readinessScore,
      daysToOptimalReadiness: daysToOptimal,
      recommendation,
    });
  }
  
  return predictions;
}

// Builds weekly load objects for the past N weeks
export function calculateWeeklyLoads(activities: Activity[], weeks: number = 12): WeeklyLoad[] {
  const runs = activities.filter(a => a.type === "Run" || a.sport_type === "Run");

  const weeklyLoads: WeeklyLoad[] = [];
  const now = new Date();

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (w * 7) - now.getDay() + 1); 
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekRuns = runs.filter(r => {
      const date = new Date(r.start_date);
      return date >= weekStart && date < weekEnd;
    });

    let totalMiles = 0;
    let totalMovingTime = 0;
    weekRuns.forEach(run => {
      totalMiles += kmToMiles(mToKm(run.distance));
      totalMovingTime += run.moving_time;
    });

    const avgPace = totalMiles > 0 ? (totalMovingTime / 60) / totalMiles : 0;

    weeklyLoads.push({
      weekStart,
      totalLoad: 0,
      runCount: weekRuns.length,
      totalMiles: Math.round(totalMiles * 10) / 10,
      avgIntensity: 0,
      avgPace: Math.round(avgPace * 100) / 100,
    });
  }

  return weeklyLoads;
}

// Detects mileage and intensity spikes that elevate injury risk
export function calculateInjuryRiskWarnings(activities: Activity[]): InjuryRiskWarning[] {
  const runs = activities
    .filter(a => a.type === "Run" || a.sport_type === "Run")
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  if (runs.length === 0) return [];

  const now = new Date();
  const currentWeekStart = parseDateKey(getWeekMonday(now));
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);

  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  const baselineWeekStarts = [1, 2, 3, 4].map((offset) => {
    const date = new Date(previousWeekStart);
    date.setDate(date.getDate() - offset * 7);
    return formatDateKey(date);
  });

  const currentWeekRuns = runs.filter((run) => {
    const date = new Date(run.start_date);
    return date >= currentWeekStart && date < currentWeekEnd;
  });

  const previousWeekRuns = runs.filter((run) => {
    const date = new Date(run.start_date);
    return date >= previousWeekStart && date < currentWeekStart;
  });

  // Miles For
  const milesFor = (items: Activity[]) => items.reduce((sum, run) => sum + kmToMiles(mToKm(run.distance)), 0);
  // Baseline Pace
  const baselinePace = (() => {
    const totalMiles = milesFor(runs);
    const totalTime = runs.reduce((sum, run) => sum + run.moving_time, 0);
    return totalMiles > 0 ? (totalTime / 60) / totalMiles : 0;
  })();

  const currentWeekMiles = milesFor(currentWeekRuns);
  const previousWeekMiles = milesFor(previousWeekRuns);

  const weeklyMiles = new Map<string, number>();
  const weeklyIntensity = new Map<string, number>();
  for (const run of runs) {
    const weekKey = getWeekMonday(new Date(run.start_date));
    weeklyMiles.set(weekKey, (weeklyMiles.get(weekKey) ?? 0) + kmToMiles(mToKm(run.distance)));
    if (isHardRun(run, baselinePace)) {
      weeklyIntensity.set(weekKey, (weeklyIntensity.get(weekKey) ?? 0) + kmToMiles(mToKm(run.distance)));
    }
  }

  const baselineMiles = baselineWeekStarts.map((weekKey) => weeklyMiles.get(weekKey) ?? 0);
  const baselineMilesAvg = baselineMiles.reduce((sum, miles) => sum + miles, 0) / baselineMiles.length;

  const currentWeekKey = formatDateKey(currentWeekStart);
  const currentIntensityMiles = weeklyIntensity.get(currentWeekKey) ?? 0;
  const currentIntensityPct = currentWeekMiles > 0 ? (currentIntensityMiles / currentWeekMiles) * 100 : 0;
  const baselineIntensityPcts = baselineWeekStarts.map((weekKey) => {
    const weekMiles = weeklyMiles.get(weekKey) ?? 0;
    const hardMiles = weeklyIntensity.get(weekKey) ?? 0;
    return weekMiles > 0 ? (hardMiles / weekMiles) * 100 : 0;
  });
  const baselineIntensityAvg = baselineIntensityPcts.reduce((sum, pct) => sum + pct, 0) / baselineIntensityPcts.length;

  const warnings: InjuryRiskWarning[] = [];

  const mileageSpikeVsLastWeek = previousWeekMiles > 0
    ? ((currentWeekMiles - previousWeekMiles) / previousWeekMiles) * 100
    : 0;
  const mileageSpikeVsBaseline = baselineMilesAvg > 0
    ? ((currentWeekMiles - baselineMilesAvg) / baselineMilesAvg) * 100
    : 0;
  const mileageSpike = Math.max(mileageSpikeVsLastWeek, mileageSpikeVsBaseline);

  if (mileageSpike >= 10) {
    warnings.push({
      id: "mileage-spike",
      severity: mileageSpike >= 20 ? "alert" : "warning",
      title: "Mileage spike",
      message: `You increased mileage +${Math.round(mileageSpike)}% this week — elevated injury risk.`,
      value: Math.round(mileageSpike),
      context: `${currentWeekMiles.toFixed(1)} mi this week`,
    });
  }

  const intensityDelta = currentIntensityPct - baselineIntensityAvg;
  if (intensityDelta >= 10) {
    warnings.push({
      id: "intensity-spike",
      severity: intensityDelta >= 18 ? "alert" : "warning",
      title: "Intensity spike",
      message: `You increased intensity +${Math.round(intensityDelta)}% this week — elevated injury risk.`,
      value: Math.round(intensityDelta),
      context: `${Math.round(currentIntensityPct)}% hard-mile share`,
    });
  }

  const recentHardRuns = runs.filter((run) => {
    const date = new Date(run.start_date);
    return date >= previousWeekStart && isHardRun(run, baselinePace);
  });

  let hardDaysStacked = 0;
  for (let i = 0; i < recentHardRuns.length - 1; i++) {
    const current = new Date(recentHardRuns[i].start_date);
    const next = new Date(recentHardRuns[i + 1].start_date);
    const gapDays = Math.round((next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    if (gapDays <= 2) {
      hardDaysStacked += 1;
    }
  }

  if (hardDaysStacked >= 2) {
    warnings.push({
      id: "hard-day-cluster",
      severity: "warning",
      title: "Hard days stacked",
      message: `You stacked ${hardDaysStacked + 1} hard days close together — recovery risk is elevated.`,
      value: hardDaysStacked + 1,
      context: "Hard efforts landed within 48 hours of each other",
    });
  }

  return warnings;
}

// Recommends today's training type based on recent load
export function getTodayRecommendation(
  activities: Activity[],
  trainingMetrics: FitnessMetrics
): TrainingRecommendation {
  
  const now = new Date();
  const recentRuns = activities
    .filter(a => {
      const isRun = a.type === "Run" || a.sport_type === "Run";
      // Days Ago
      const daysAgo = (now.getTime() - new Date(a.start_date).getTime()) / (1000 * 60 * 60 * 24);
      return isRun && daysAgo <= 3;
    });
  
  const runYesterday = recentRuns.some(r => {
    // Days Ago
    const daysAgo = (now.getTime() - new Date(r.start_date).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 1 && daysAgo > 0;
  });
  
  const hardEffortRecently = recentRuns.some(r => {
    const miles = kmToMiles(mToKm(r.distance));
    // Pace
    const pace = (r.moving_time / 60) / miles;
    return miles > 8 || pace < 8 || (r.average_heartrate && r.average_heartrate > 160);
  });
  
  
  const allRuns = activities.filter(a => a.type === "Run" || a.sport_type === "Run");
  const totalTime = allRuns.reduce((sum, r) => sum + r.moving_time, 0);
  const totalDist = allRuns.reduce((sum, r) => sum + r.distance, 0);
  // Avg Pace
  const avgPace = (totalTime / 60) / kmToMiles(mToKm(totalDist));
  
  
  if (trainingMetrics.readiness < -15) {
    return {
      type: "recover",
      intensity: "Rest or very easy",
      rationale: "Recent training volume is high. Rest today to optimize recovery.",
      suggestedMiles: 0,
      suggestedPace: "Rest",
    };
  }
  
  if (hardEffortRecently || trainingMetrics.readiness < 0) {
    return {
      type: "easy",
      intensity: "Recovery pace",
      rationale: "Easy effort to maintain momentum while allowing recovery.",
      suggestedMiles: 4,
      suggestedPace: formatPace(avgPace + 1.5),
    };
  }
  
  if (!runYesterday && trainingMetrics.readiness > 5) {
    return {
      type: "push",
      intensity: "Moderate to hard",
      rationale: "Good readiness and fresh legs. A quality session will build momentum.",
      suggestedMiles: 6,
      suggestedPace: formatPace(avgPace - 0.5),
    };
  }
  
  return {
    type: "maintain",
    intensity: "Moderate",
    rationale: "Steady running to maintain current training trajectory.",
    suggestedMiles: 5,
    suggestedPace: formatPace(avgPace),
  };
}

// Formats seconds as H:MM:SS or M:SS
export function formatTime(seconds: number): string {
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

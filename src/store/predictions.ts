/**
 * Nexpr PR Prediction Engine
 * 
 * Uses historical data to predict potential PRs and provide
 * actionable training insights. All calculations are derived
 * from cached activity data - no additional API calls.
 * 
 * Key Metrics:
 * - Momentum (rolling training volume, ~42 day average)
 * - Freshness (recent training intensity, ~7 day average)
 * - Readiness (momentum - freshness, indicates race potential)
 * - PR Probability based on current training trajectory
 * 
 * Note: These are Nexpr-specific metrics derived from activity data.
 * They are NOT the same as any other platform's calculations.
 */

import type { Activity } from "../hooks";
import { kmToMiles, mToKm, formatPace } from "../hooks";

// Standard race distances in meters
const RACE_DISTANCES = {
  "5K": 5000,
  "10K": 10000,
  "Half Marathon": 21097.5,
  "Marathon": 42195,
} as const;

export type RaceDistance = keyof typeof RACE_DISTANCES;

export interface PRRecord {
  distance: RaceDistance;
  time: number; // seconds
  pace: number; // min/mile
  date: Date;
  activityId: number;
  activityName: string;
}

export interface FitnessMetrics {
  momentum: number;     // Rolling training volume (~42 day avg)
  freshness: number;    // Recent training intensity (~7 day avg)
  readiness: number;    // momentum - freshness (race potential indicator)
  trend: "building" | "maintaining" | "recovering" | "declining";
  rampRate: number;     // Weekly momentum change percentage
}

export interface PRPrediction {
  distance: RaceDistance;
  currentPR: PRRecord | null;
  predictedTime: number | null;  // seconds
  predictedPace: number | null;  // min/mile
  probability: number;           // 0-100
  readinessScore: number;        // 0-100
  daysToOptimalReadiness: number;
  recommendation: string;
}

export interface WeeklyLoad {
  weekStart: Date;
  totalLoad: number;
  runCount: number;
  totalMiles: number;
  avgIntensity: number;
}

export interface TrainingRecommendation {
  type: "push" | "maintain" | "recover" | "easy";
  intensity: string;
  rationale: string;
  suggestedMiles: number;
  suggestedPace: string;
}

/**
 * Calculate training load for a single activity
 * Uses duration × relative intensity (HR or pace-based)
 */
function calculateActivityLoad(activity: Activity, avgPace: number): number {
  const durationMinutes = activity.moving_time / 60;
  const distanceMiles = kmToMiles(mToKm(activity.distance));
  const activityPace = distanceMiles > 0 ? durationMinutes / distanceMiles : 0;
  
  // Intensity factor: faster pace = higher intensity
  // Normalized so average pace = 1.0
  const intensityFactor = avgPace > 0 ? avgPace / activityPace : 1;
  
  // Heart rate bonus if available
  const hrFactor = activity.average_heartrate 
    ? Math.min(1.5, activity.average_heartrate / 140) 
    : 1;
  
  // Load = duration × intensity × HR factor
  return durationMinutes * intensityFactor * hrFactor;
}

/**
 * Calculate training metrics using exponentially weighted moving averages
 * Note: These are Nexpr-specific metrics, not standardized formulas.
 */
export function calculateFitnessMetrics(activities: Activity[]): FitnessMetrics {
  const runs = activities
    .filter(a => a.type === "Run" || a.sport_type === "Run")
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  
  if (runs.length === 0) {
    return { 
      momentum: 0, 
      freshness: 0, 
      readiness: 0, 
      trend: "maintaining",
      rampRate: 0 
    };
  }
  
  // Calculate average pace for intensity normalization
  const totalTime = runs.reduce((sum, r) => sum + r.moving_time, 0);
  const totalDist = runs.reduce((sum, r) => sum + r.distance, 0);
  const avgPace = (totalTime / 60) / kmToMiles(mToKm(totalDist));
  
  // Time constants for exponential smoothing
  const LONG_WINDOW = 42;  // ~6 weeks for momentum
  const SHORT_WINDOW = 7;   // 1 week for freshness
  
  const longDecay = Math.exp(-1 / LONG_WINDOW);
  const shortDecay = Math.exp(-1 / SHORT_WINDOW);
  
  let momentum = 0;  // Long-term training volume
  let freshness = 0; // Recent training intensity
  
  // Calculate daily activity scores and apply EWMA
  const now = new Date();
  const dayScores = new Map<string, number>();
  
  runs.forEach(run => {
    const dateKey = new Date(run.start_date).toISOString().slice(0, 10);
    const score = calculateActivityLoad(run, avgPace);
    dayScores.set(dateKey, (dayScores.get(dateKey) || 0) + score);
  });
  
  // Process last 90 days
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().slice(0, 10);
    const dayScore = dayScores.get(dateKey) || 0;
    
    momentum = momentum * longDecay + dayScore * (1 - longDecay);
    freshness = freshness * shortDecay + dayScore * (1 - shortDecay);
  }
  
  const readiness = momentum - freshness;
  
  // Calculate ramp rate (weekly momentum change)
  let momentumWeekAgo = 0;
  for (let i = 90; i >= 7; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().slice(0, 10);
    const dayScore = dayScores.get(dateKey) || 0;
    momentumWeekAgo = momentumWeekAgo * longDecay + dayScore * (1 - longDecay);
  }
  
  const rampRate = momentumWeekAgo > 0 ? ((momentum - momentumWeekAgo) / momentumWeekAgo) * 100 : 0;
  
  // Determine trend
  let trend: FitnessMetrics["trend"];
  if (rampRate > 5) trend = "building";
  else if (rampRate < -5) trend = "declining";
  else if (readiness > 10) trend = "recovering";
  else trend = "maintaining";
  
  return {
    momentum: Math.round(momentum * 10) / 10,
    freshness: Math.round(freshness * 10) / 10,
    readiness: Math.round(readiness * 10) / 10,
    trend,
    rampRate: Math.round(rampRate * 10) / 10,
  };
}

/**
 * Find personal records for standard race distances
 * Looks for activities close to race distances (±5%)
 */
export function findPRs(activities: Activity[]): PRRecord[] {
  const runs = activities.filter(a => a.type === "Run" || a.sport_type === "Run");
  const prs: PRRecord[] = [];
  
  for (const [distanceName, targetMeters] of Object.entries(RACE_DISTANCES)) {
    const tolerance = targetMeters * 0.05; // 5% tolerance
    
    // Find all activities within tolerance of this distance
    const candidates = runs.filter(
      a => Math.abs(a.distance - targetMeters) <= tolerance
    );
    
    if (candidates.length === 0) continue;
    
    // Find fastest (best pace)
    const fastest = candidates.reduce((best, current) => {
      const bestPace = best.moving_time / best.distance;
      const currentPace = current.moving_time / current.distance;
      return currentPace < bestPace ? current : best;
    });
    
    const miles = kmToMiles(mToKm(fastest.distance));
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

/**
 * Calculate race readiness score based on effort distribution
 * Optimal endurance training follows 80/10/10 (easy/moderate/hard)
 * Returns 0-100 score where 100 = perfect distribution
 */
function calculateEffortReadiness(effort: EffortDistribution): number {
  const idealEasy = 80;
  const idealModerate = 10;
  const idealHard = 10;
  
  // Calculate deviation from ideal (penalize more for too little easy)
  const easyDiff = Math.abs(effort.percentEasy - idealEasy);
  const moderateDiff = Math.abs(effort.percentModerate - idealModerate);
  const hardDiff = Math.abs(effort.percentHard - idealHard);
  
  // Weight easy running higher (more important for race readiness)
  const totalDiff = (easyDiff * 1.5) + moderateDiff + hardDiff;
  
  // Convert to 0-100 scale (max possible diff ~120 with weighting)
  const score = Math.max(0, Math.min(100, 100 - totalDiff));
  return Math.round(score);
}

/**
 * Predict potential PR times based on current training
 * Uses Riegel formula with training metrics and effort distribution adjustments
 */
export function predictPRs(
  activities: Activity[],
  trainingMetrics: FitnessMetrics,
  effortDistribution?: EffortDistribution
): PRPrediction[] {
  const currentPRs = findPRs(activities);
  const predictions: PRPrediction[] = [];
  
  // Calculate effort-based readiness if available
  const effortReadiness = effortDistribution 
    ? calculateEffortReadiness(effortDistribution)
    : null;
  
  // Get recent performance baseline
  const recentRuns = activities
    .filter(a => {
      const isRun = a.type === "Run" || a.sport_type === "Run";
      const daysAgo = (Date.now() - new Date(a.start_date).getTime()) / (1000 * 60 * 60 * 24);
      return isRun && daysAgo <= 30 && a.distance >= 3000; // 3K+ runs in last 30 days
    })
    .sort((a, b) => {
      // Sort by pace (fastest first)
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
  
  // Use best recent effort as baseline
  const baseline = recentRuns[0];
  const baselineSeconds = baseline.moving_time;
  const baselineMeters = baseline.distance;
  
  for (const [distanceName, targetMeters] of Object.entries(RACE_DISTANCES)) {
    const existingPR = currentPRs.find(p => p.distance === distanceName) || null;
    
    // Riegel formula: T2 = T1 × (D2/D1)^1.06
    const predictedSeconds = baselineSeconds * Math.pow(targetMeters / baselineMeters, 1.06);
    
    // Adjust based on training readiness
    const readinessAdjustment = 1 - (trainingMetrics.readiness / 500);
    const adjustedSeconds = predictedSeconds * readinessAdjustment;
    
    const predictedMiles = kmToMiles(mToKm(targetMeters));
    const predictedPace = (adjustedSeconds / 60) / predictedMiles;
    
    // Calculate probability of beating PR
    let probability = 0;
    if (existingPR) {
      const improvement = (existingPR.time - adjustedSeconds) / existingPR.time;
      if (improvement > 0) {
        probability = Math.min(95, Math.round(improvement * 500 + trainingMetrics.readiness * 2));
      } else {
        probability = Math.max(5, Math.round(50 + trainingMetrics.readiness * 2));
      }
    } else {
      probability = 75; // High probability if no PR exists
    }
    
    // Readiness score: combine training readiness with effort distribution
    let readinessScore: number;
    if (effortReadiness !== null) {
      const trainingScore = Math.max(0, Math.min(100, 50 + trainingMetrics.readiness * 3));
      readinessScore = Math.round((trainingScore * 0.4) + (effortReadiness * 0.6));
    } else {
      readinessScore = Math.round(
        Math.max(0, Math.min(100, 50 + trainingMetrics.readiness * 3))
      );
    }
    
    // Days to optimal readiness (targeting readiness of +15 to +25)
    const optimalReadiness = 20;
    const daysToOptimal = trainingMetrics.readiness >= optimalReadiness 
      ? 0 
      : Math.round((optimalReadiness - trainingMetrics.readiness) * 2);
    
    // Generate recommendation based on readiness and effort distribution
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

/**
 * Calculate weekly training loads for trend visualization
 */
export function calculateWeeklyLoads(activities: Activity[], weeks: number = 12): WeeklyLoad[] {
  const runs = activities.filter(a => a.type === "Run" || a.sport_type === "Run");
  
  // Calculate average pace for normalization
  const totalTime = runs.reduce((sum, r) => sum + r.moving_time, 0);
  const totalDist = runs.reduce((sum, r) => sum + r.distance, 0);
  const avgPace = totalDist > 0 ? (totalTime / 60) / kmToMiles(mToKm(totalDist)) : 0;
  
  const weeklyLoads: WeeklyLoad[] = [];
  const now = new Date();
  
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (w * 7) - now.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const weekRuns = runs.filter(r => {
      const date = new Date(r.start_date);
      return date >= weekStart && date < weekEnd;
    });
    
    let totalLoad = 0;
    let totalMiles = 0;
    let totalIntensity = 0;
    
    weekRuns.forEach(run => {
      const load = calculateActivityLoad(run, avgPace);
      totalLoad += load;
      totalMiles += kmToMiles(mToKm(run.distance));
      
      const runMiles = kmToMiles(mToKm(run.distance));
      const runPace = runMiles > 0 ? (run.moving_time / 60) / runMiles : 0;
      totalIntensity += avgPace > 0 ? avgPace / runPace : 1;
    });
    
    weeklyLoads.push({
      weekStart,
      totalLoad: Math.round(totalLoad),
      runCount: weekRuns.length,
      totalMiles: Math.round(totalMiles * 10) / 10,
      avgIntensity: weekRuns.length > 0 
        ? Math.round((totalIntensity / weekRuns.length) * 100) / 100 
        : 0,
    });
  }
  
  return weeklyLoads;
}

/**
 * Generate today's training recommendation\n */
export function getTodayRecommendation(
  activities: Activity[],
  trainingMetrics: FitnessMetrics
): TrainingRecommendation {
  // Look at recent days
  const now = new Date();
  const recentRuns = activities
    .filter(a => {
      const isRun = a.type === "Run" || a.sport_type === "Run";
      const daysAgo = (now.getTime() - new Date(a.start_date).getTime()) / (1000 * 60 * 60 * 24);
      return isRun && daysAgo <= 3;
    });
  
  const runYesterday = recentRuns.some(r => {
    const daysAgo = (now.getTime() - new Date(r.start_date).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 1 && daysAgo > 0;
  });
  
  const hardEffortRecently = recentRuns.some(r => {
    const miles = kmToMiles(mToKm(r.distance));
    const pace = (r.moving_time / 60) / miles;
    return miles > 8 || pace < 8 || (r.average_heartrate && r.average_heartrate > 160);
  });
  
  // Base average pace on all-time data
  const allRuns = activities.filter(a => a.type === "Run" || a.sport_type === "Run");
  const totalTime = allRuns.reduce((sum, r) => sum + r.moving_time, 0);
  const totalDist = allRuns.reduce((sum, r) => sum + r.distance, 0);
  const avgPace = (totalTime / 60) / kmToMiles(mToKm(totalDist));
  
  // Decision logic
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

/**
 * Format seconds to mm:ss or hh:mm:ss
 */
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

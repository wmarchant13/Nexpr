/**
 * The Oracle — Probabilistic Goal Engine
 *
 * Answers the question every runner has:
 * "Can I run sub-X at this distance?"
 *
 * Uses Monte Carlo-style variance bands built from training consistency,
 * fitness metrics, and Riegel race equivalence. Returns a probability,
 * confidence range, projected times, and the specific levers to pull.
 *
 * No LLM. No external API. Pure training data intelligence.
 */

import type { Activity } from "../hooks";
import { kmToMiles, mToKm } from "../hooks";
import type { RaceDistance } from "./predictions";
import {
  calculateFitnessMetrics,
  findPRs,
  calculateWeeklyLoads,
  type FitnessMetrics,
  type PRRecord,
} from "./predictions";

export type { RaceDistance } from "./predictions";

export interface OracleQuery {
  distance: RaceDistance;
  targetSeconds: number;
  weeksToRace: number;
}

export type OracleVerdict =
  | "ready"
  | "close"
  | "possible"
  | "stretch"
  | "unlikely";
export type LeverUrgency = "critical" | "high" | "medium";
export type LeverCategory =
  | "volume"
  | "intensity"
  | "consistency"
  | "recovery"
  | "race_specific";

export interface OracleLever {
  title: string;
  description: string;
  probabilityGain: number;
  urgency: LeverUrgency;
  category: LeverCategory;
  icon: string;
}

export interface OracleResult {
  query: OracleQuery;
  currentPR: PRRecord | null;

  probability: number;
  probabilityLow: number;
  probabilityHigh: number;

  projectedSeconds: number;
  projectedSecondsLow: number;
  projectedSecondsHigh: number;

  gapSeconds: number;
  gapPositive: boolean;

  verdict: OracleVerdict;
  verdictText: string;

  levers: OracleLever[];

  dataConfidence: number;
  dataConfidenceReason: string;

  weeksToOptimal: number;
}

const RACE_DISTANCE_METERS: Record<RaceDistance, number> = {
  "5K": 5000,
  "10K": 10000,
  "Half Marathon": 21097.5,
  Marathon: 42195,
};

const TARGET_WEEKLY_MILES: Record<RaceDistance, number> = {
  "5K": 25,
  "10K": 35,
  "Half Marathon": 40,
  Marathon: 50,
};

const LONG_RUN_TARGETS: Record<RaceDistance, number> = {
  "5K": 8,
  "10K": 12,
  "Half Marathon": 14,
  Marathon: 20,
};

const BASE_VARIANCE: Record<RaceDistance, number> = {
  "5K": 0.02,
  "10K": 0.025,
  "Half Marathon": 0.035,
  Marathon: 0.055,
};

// Clamps a value between a min and max
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// Predicts race time using the Riegel power-law formula
function riegelPredict(
  baseTime: number,
  baseDistMeters: number,
  targetDistMeters: number,
): number {
  return baseTime * Math.pow(targetDistMeters / baseDistMeters, 1.06);
}

// Identifies the highest-impact training changes for a goal
function detectLevers(
  activities: Activity[],
  metrics: FitnessMetrics,
  weeklyLoads: ReturnType<typeof calculateWeeklyLoads>,
  distance: RaceDistance,
): OracleLever[] {
  const levers: OracleLever[] = [];
  const runs = activities.filter(
    (a) => a.type === "Run" || a.sport_type === "Run",
  );
  const now = Date.now();

  const recentWeeks = weeklyLoads.slice(-8);
  const weekMiles = recentWeeks.map((w) => w.totalMiles);
  const avgMiles =
    weekMiles.reduce((s, m) => s + m, 0) / (weekMiles.length || 1);
  const stdDev = Math.sqrt(
    weekMiles.reduce((s, m) => s + Math.pow(m - avgMiles, 2), 0) /
      (weekMiles.length || 1),
  );
  const cv = avgMiles > 0 ? stdDev / avgMiles : 0.5;
  const zeroWeeks = weekMiles.filter((m) => m < 1).length;

  if (cv > 0.35 || zeroWeeks >= 2) {
    levers.push({
      title: "Build a consistent weekly base",
      description: `Your mileage swings ${Math.round(cv * 100)}% week-to-week${zeroWeeks >= 2 ? ` and you had ${zeroWeeks} near-zero weeks` : ""}. Consistent stimulus is the single biggest predictor of race improvement.`,
      probabilityGain: clamp(Math.round(cv * 28), 6, 18),
      urgency: cv > 0.55 ? "critical" : "high",
      category: "consistency",
      icon: "📅",
    });
  }

  const targetMiles = TARGET_WEEKLY_MILES[distance];
  if (avgMiles < targetMiles * 0.7) {
    const deficit = Math.round(targetMiles * 0.7 - avgMiles);
    levers.push({
      title: `Add ~${deficit} miles per week`,
      description: `You're averaging ${Math.round(avgMiles)} mi/week. A ${distance} PR typically requires ${targetMiles}+ mi/week. Even a 10% increase compounding over 6 weeks moves the needle significantly.`,
      probabilityGain: clamp(Math.round((deficit / targetMiles) * 22), 5, 16),
      urgency: deficit > 15 ? "critical" : "high",
      category: "volume",
      icon: "📈",
    });
  }

  const last28Days = runs.filter(
    (r) => (now - new Date(r.start_date).getTime()) / 86400000 <= 28,
  );
  const allPaces = runs
    .filter((r) => r.distance > 3000)
    .map((r) => r.moving_time / 60 / kmToMiles(mToKm(r.distance)))
    .sort((a, b) => a - b);
  const hardPaceThreshold = allPaces[Math.floor(allPaces.length * 0.25)] ?? 0;

  const hardRunsRecent = last28Days.filter((r) => {
    if (r.distance < 3000) return false;
    const pace = r.moving_time / 60 / kmToMiles(mToKm(r.distance));
    return pace <= hardPaceThreshold;
  });

  if (hardRunsRecent.length < 2 && allPaces.length >= 8) {
    levers.push({
      title: "Add weekly quality work",
      description: `Only ${hardRunsRecent.length} quality session${hardRunsRecent.length === 1 ? "" : "s"} in the last 4 weeks. One tempo or interval session per week is the highest-ROI training change most runners can make.`,
      probabilityGain: clamp(
        8 + Math.max(0, 2 - hardRunsRecent.length) * 5,
        8,
        18,
      ),
      urgency: hardRunsRecent.length === 0 ? "critical" : "high",
      category: "intensity",
      icon: "⚡",
    });
  }

  const longRunTarget = LONG_RUN_TARGETS[distance];
  if (distance === "Half Marathon" || distance === "Marathon") {
    const longestRecent =
      last28Days
        .map((r) => kmToMiles(mToKm(r.distance)))
        .sort((a, b) => b - a)[0] ?? 0;

    if (longestRecent < longRunTarget * 0.8) {
      levers.push({
        title: `Extend long run to ${longRunTarget}+ miles`,
        description: `Your longest recent run is ~${Math.round(longestRecent)} mi. The ${distance} demands aerobic durability that only long runs build — confidence, fat metabolism, and mental rehearsal.`,
        probabilityGain: clamp(
          Math.round(((longRunTarget - longestRecent) / longRunTarget) * 14),
          4,
          13,
        ),
        urgency: longestRecent < longRunTarget * 0.55 ? "critical" : "high",
        category: "race_specific",
        icon: "🏃",
      });
    }
  }

  if (distance === "Marathon") {
    const longRunCount = runs.filter(
      (r) => kmToMiles(mToKm(r.distance)) >= 18,
    ).length;
    if (longRunCount < 3) {
      levers.push({
        title: `Log ${3 - longRunCount} more 18+ mile runs`,
        description: `You have ${longRunCount} run${longRunCount === 1 ? "" : "s"} ≥18 mi in your history. The marathon wall is a real physiological event at mile 20 — specific long runs are the only real insurance.`,
        probabilityGain: clamp((3 - longRunCount) * 5, 5, 14),
        urgency: longRunCount === 0 ? "critical" : "high",
        category: "race_specific",
        icon: "🎯",
      });
    }
  }

  if (metrics.rampRate > 15) {
    levers.push({
      title: "Reduce weekly load increase",
      description: `Training load is climbing ${Math.round(metrics.rampRate)}% per week — the safe ceiling is ~10%. This pattern precedes overuse injuries. Back off 15% this week, then resume progression.`,
      probabilityGain: 7,
      urgency: "critical",
      category: "recovery",
      icon: "🛡️",
    });
  } else if (metrics.readiness < -10) {
    levers.push({
      title: "Schedule a recovery week now",
      description:
        "Your fatigue is high relative to your fitness. A planned easy week triggers the super-compensation that makes the next build more effective. This is training, not weakness.",
      probabilityGain: 9,
      urgency: "high",
      category: "recovery",
      icon: "💤",
    });
  }

  return levers
    .sort((a, b) => b.probabilityGain - a.probabilityGain)
    .slice(0, 4);
}

// Core Oracle engine: computes probability and projected race time
export function runOracle(
  activities: Activity[],
  query: OracleQuery,
  stravaPRs?: PRRecord[],
): OracleResult {
  const { distance, targetSeconds, weeksToRace } = query;
  const targetMeters = RACE_DISTANCE_METERS[distance];

  const runs = activities.filter(
    (a) => a.type === "Run" || a.sport_type === "Run",
  );
  const metrics = calculateFitnessMetrics(activities);

  const prs =
    stravaPRs && stravaPRs.length > 0 ? stravaPRs : findPRs(activities);
  const weeklyLoads = calculateWeeklyLoads(activities, 16);
  const now = Date.now();

  const currentPR = prs.find((p) => p.distance === distance) ?? null;

  let dataConfidence = 100;
  const confidenceNotes: string[] = [];

  if (runs.length < 10) {
    dataConfidence -= 45;
    confidenceNotes.push("limited run history");
  } else if (runs.length < 30) {
    dataConfidence -= 15;
  }

  const recentRuns = runs.filter(
    (r) => (now - new Date(r.start_date).getTime()) / 86400000 <= 30,
  );
  if (recentRuns.length < 3) {
    dataConfidence -= 25;
    confidenceNotes.push("no recent runs");
  }

  if (!currentPR) {
    dataConfidence -= 10;
    confidenceNotes.push("no PR at this distance");
  }

  dataConfidence = clamp(dataConfidence, 15, 95);
  const dataConfidenceReason =
    confidenceNotes.length > 0
      ? `Lower confidence: ${confidenceNotes.join(", ")}.`
      : "Solid data — prediction confidence is high.";

  const baselineRun = runs
    .filter((r) => {
      // Days Ago
      const daysAgo = (now - new Date(r.start_date).getTime()) / 86400000;
      return daysAgo <= 60 && r.distance >= 3000;
    })
    .sort((a, b) => a.moving_time / a.distance - b.moving_time / b.distance)[0];

  if (!baselineRun && !currentPR) {
    return {
      query,
      currentPR: null,
      probability: 0,
      probabilityLow: 0,
      probabilityHigh: 0,
      projectedSeconds: 0,
      projectedSecondsLow: 0,
      projectedSecondsHigh: 0,
      gapSeconds: targetSeconds,
      gapPositive: false,
      verdict: "unlikely",
      verdictText:
        "Not enough run history to make a prediction. Log more runs to unlock The Oracle.",
      levers: [],
      dataConfidence: 10,
      dataConfidenceReason:
        "Insufficient data — run more and sync with Strava.",
      weeksToOptimal: 8,
    };
  }

  let rawProjected: number;
  if (baselineRun) {
    rawProjected = riegelPredict(
      baselineRun.moving_time,
      baselineRun.distance,
      targetMeters,
    );
  } else {
    rawProjected = currentPR!.time;
  }

  const readinessAdj = 1 - clamp(metrics.readiness / 900, -0.025, 0.025);
  const projectedSeconds = rawProjected * readinessAdj;

  const recentWeeks = weeklyLoads.slice(-8);
  const weekMiles = recentWeeks.map((w) => w.totalMiles);
  const avgMiles =
    weekMiles.reduce((s, m) => s + m, 0) / (weekMiles.length || 1);
  const stdDev = Math.sqrt(
    weekMiles.reduce((s, m) => s + Math.pow(m - avgMiles, 2), 0) /
      (weekMiles.length || 1),
  );
  const cv = avgMiles > 0 ? stdDev / avgMiles : 0.35;

  const weeksModifier = clamp(weeksToRace / 16, 0.5, 2.0);
  const variancePct = BASE_VARIANCE[distance] * (1 + cv) * weeksModifier;
  const varianceSeconds = projectedSeconds * variancePct;

  const projectedSecondsLow = Math.round(
    projectedSeconds + varianceSeconds * 1.4,
  );
  const projectedSecondsHigh = Math.round(
    projectedSeconds - varianceSeconds * 0.8,
  );

  const gapSeconds = Math.round(targetSeconds - projectedSeconds);
  const gapPositive = gapSeconds >= 0;

  const sigma = varianceSeconds;
  const normalizedGap = sigma > 0 ? gapSeconds / sigma : gapPositive ? 3 : -3;
  const baseProbability = 100 / (1 + Math.exp(-normalizedGap * 0.75));

  const trainingBonus = clamp(
    (metrics.trend === "building" ? 0.08 : 0) +
      (metrics.rampRate > 0 && metrics.rampRate < 15 ? 0.04 : 0) +
      (recentRuns.length >= 4 ? 0.04 : -0.08) +
      (cv < 0.25 ? 0.04 : 0),
    -0.15,
    0.18,
  );

  const probability = clamp(
    Math.round(baseProbability * (1 + trainingBonus)),
    3,
    97,
  );
  const probabilityLow = clamp(probability - 13, 2, 94);
  const probabilityHigh = clamp(probability + 11, 4, 97);

  const gapMinutes = Math.abs(gapSeconds) / 60;
  const gapLabel = gapPositive
    ? `${formatOracleTime(Math.abs(gapSeconds))} under target`
    : `${formatOracleTime(Math.abs(gapSeconds))} to find`;

  let verdict: OracleVerdict;
  let verdictText: string;

  if (probability >= 75) {
    verdict = "ready";
    verdictText = `You're tracking ${gapLabel}. Current training puts you in the window — pick your race and execute the taper.`;
  } else if (probability >= 55) {
    verdict = "close";
    verdictText = `${gapLabel}. You're in striking range. The levers below can close this gap in ${Math.ceil(weeksToRace * 0.5)}–${weeksToRace} weeks.`;
  } else if (probability >= 35) {
    verdict = "possible";
    verdictText = `Achievable with deliberate changes. ${gapLabel} — address the highest-impact lever first and reassess in 4 weeks.`;
  } else if (probability >= 18) {
    verdict = "stretch";
    verdictText = `A real stretch goal right now. ${gapLabel} requires major training evolution. Keep it as a 6-month target and build toward it.`;
  } else {
    verdict = "unlikely";
    verdictText = `The gap is large — ${formatOracleTime(Math.abs(gapSeconds))}. Build your base significantly before targeting this time. Set an intermediate milestone first.`;
  }

  const levers = detectLevers(activities, metrics, weeklyLoads, distance);

  const weeksToOptimal =
    metrics.readiness >= 15
      ? 0
      : clamp(Math.round((15 - metrics.readiness) / 3), 0, 16);

  return {
    query,
    currentPR,
    probability,
    probabilityLow,
    probabilityHigh,
    projectedSeconds: Math.round(projectedSeconds),
    projectedSecondsLow,
    projectedSecondsHigh,
    gapSeconds,
    gapPositive,
    verdict,
    verdictText,
    levers,
    dataConfidence,
    dataConfidenceReason,
    weeksToOptimal,
  };
}

// Formats seconds as a human-readable race time string
export function formatOracleTime(seconds: number): string {
  if (seconds <= 0) return "--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Parses MM:SS or HH:MM:SS input to total seconds
export function parseTimeInput(input: string): number | null {
  const trimmed = input.trim();
  const parts = trimmed.split(":").map(Number);
  if (parts.some((p) => isNaN(p) || p < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

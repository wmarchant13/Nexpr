/**
 * VDOT Calculator
 *
 * Based on Jack Daniels' Running Formula VDOT tables and equations.
 * VDOT is a proxy for VO2max derived from race performance — it accounts
 * for running economy, not just aerobic capacity.
 *
 * Reference: Daniels J. (2014) Daniels' Running Formula, 3rd ed.
 * Equations: Daniels & Gilbert (1979) oxygen-cost model.
 */

export type TrainingZone = "E" | "M" | "T" | "I" | "R";

export interface VDOTResult {
  vdot: number;
  trainingPaces: TrainingPaces;
  racePredictions: RacePredictions;
}

export interface TrainingPaces {
  easyLow: number;
  easyHigh: number;
  marathon: number;
  threshold: number;
  interval: number;
  repetition: number;
}

export interface RacePredictions {
  "1500m": number;
  mile: number;
  "5K": number;
  "10K": number;
  "Half Marathon": number;
  Marathon: number;
}

export type RaceDistance = keyof RacePredictions;

// Models percent VO2max utilization at a given duration
function percentVO2Max(durationMinutes: number): number {
  const t = durationMinutes;

  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * t) +
    0.2989558 * Math.exp(-0.1932605 * t)
  );
}

// Converts running velocity (m/min) to VO2 demand
function vo2FromVelocity(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

// Inverts VO2 demand back to running velocity
function velocityFromVo2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -(4.6 + vo2);
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

// Computes VDOT score from a race distance and time
export function computeVDOT(
  distanceMeters: number,
  timeSeconds: number,
): number {
  const minutes = timeSeconds / 60;
  const velocityMpm = distanceMeters / minutes;
  const vo2 = vo2FromVelocity(velocityMpm);
  const pct = percentVO2Max(minutes);
  const vdot = vo2 / pct;

  return Math.round(vdot * 10) / 10;
}

const ZONE_VO2_FRACTIONS: Record<TrainingZone, [number, number]> = {
  E: [0.59, 0.74],
  M: [0.75, 0.84],
  T: [0.83, 0.88],
  I: [0.95, 1.0],
  R: [1.05, 1.1],
};

// Converts a VO2max fraction + vdot to pace in sec/mile
function paceSecondsPerMile(vo2MaxFraction: number, vdot: number): number {
  const targetVo2 = vdot * vo2MaxFraction;
  const velocityMpm = velocityFromVo2(targetVo2);
  const metersPerSecond = velocityMpm / 60;
  const secondsPerMeter = 1 / metersPerSecond;
  const secondsPerMile = secondsPerMeter * 1609.344;
  return secondsPerMile;
}

// Computes all Daniels training zone paces for a VDOT
export function computeTrainingPaces(vdot: number): TrainingPaces {
  const [eLow, eHigh] = ZONE_VO2_FRACTIONS.E;
  const [, mHigh] = ZONE_VO2_FRACTIONS.M;
  const [tLow] = ZONE_VO2_FRACTIONS.T;
  const [iLow] = ZONE_VO2_FRACTIONS.I;
  const [rLow] = ZONE_VO2_FRACTIONS.R;

  return {
    easyLow: paceSecondsPerMile(eHigh, vdot),
    easyHigh: paceSecondsPerMile(eLow, vdot),
    marathon: paceSecondsPerMile(mHigh, vdot),
    threshold: paceSecondsPerMile(tLow, vdot),
    interval: paceSecondsPerMile(iLow, vdot),
    repetition: paceSecondsPerMile(rLow, vdot),
  };
}

const RACE_DISTANCES_METERS: Record<RaceDistance, number> = {
  "1500m": 1500,
  mile: 1609.344,
  "5K": 5000,
  "10K": 10000,
  "Half Marathon": 21097.5,
  Marathon: 42195,
};

// Binary-searches for the race time matching a given VDOT
function predictRaceTime(distanceMeters: number, vdot: number): number {
  let lo = 1;
  let hi = 600;
  for (let i = 0; i < 60; i++) {
    // Mid
    const mid = (lo + hi) / 2;
    const v = computeVDOT(distanceMeters, mid * 60);
    if (v > vdot) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.round(((lo + hi) / 2) * 60);
}

// Predicts race times for all standard distances
export function computeRacePredictions(vdot: number): RacePredictions {
  const predictions = {} as RacePredictions;

  for (const [distance, meters] of Object.entries(
    RACE_DISTANCES_METERS,
  ) as Array<[RaceDistance, number]>) {
    predictions[distance] = predictRaceTime(meters, vdot);
  }

  return predictions;
}

// Returns full VDOT result including paces and race predictions
export function calculateVDOT(
  distanceMeters: number,
  timeSeconds: number,
): VDOTResult {
  const vdot = computeVDOT(distanceMeters, timeSeconds);
  const trainingPaces = computeTrainingPaces(vdot);
  const racePredictions = computeRacePredictions(vdot);
  return { vdot, trainingPaces, racePredictions };
}

// Formats total seconds as H:MM:SS or M:SS race time
export function formatRaceTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Formats seconds-per-mile as M:SS pace string
export function formatPacePerMile(secondsPerMile: number): string {
  const m = Math.floor(secondsPerMile / 60);
  const s = Math.round(secondsPerMile % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Parses a user time input string to total seconds
export function parseVDOTTimeInput(input: string): number | null {
  const trimmed = input.trim();
  const parts = trimmed.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s < 0 || s >= 60 || m < 0) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (s < 0 || s >= 60 || m < 0 || m >= 60 || h < 0) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

export const VDOT_DISTANCE_OPTIONS: { label: string; meters: number }[] = [
  { label: "1500m", meters: 1500 },
  { label: "Mile", meters: 1609.344 },
  { label: "5K", meters: 5000 },
  { label: "10K", meters: 10000 },
  { label: "Half Marathon", meters: 21097.5 },
  { label: "Marathon", meters: 42195 },
];

export const TRAINING_ZONE_INFO: Record<
  TrainingZone,
  { label: string; description: string; color: string }
> = {
  E: {
    label: "Easy",
    description:
      "Conversational effort. Builds aerobic base and aids recovery.",
    color: "#4ade80",
  },
  M: {
    label: "Marathon",
    description: "Goal marathon race pace. Metabolically specific training.",
    color: "#60a5fa",
  },
  T: {
    label: "Threshold",
    description:
      "Comfortably hard. Raises lactate threshold — the most important marathon adaptation.",
    color: "#fb923c",
  },
  I: {
    label: "Interval",
    description:
      "VO2max stimulus. Hard 3–5 min efforts. Raises your aerobic ceiling.",
    color: "#f87171",
  },
  R: {
    label: "Repetition",
    description:
      "Fast & short. Improves running economy and neuromuscular power.",
    color: "#e879f9",
  },
};

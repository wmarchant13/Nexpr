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

// ============================================================================
// TYPES
// ============================================================================

export type TrainingZone = "E" | "M" | "T" | "I" | "R";

export interface VDOTResult {
  vdot: number;
  trainingPaces: TrainingPaces;
  racePredictions: RacePredictions;
}

export interface TrainingPaces {
  // Seconds per mile
  easyLow: number; // bottom of easy range
  easyHigh: number; // top of easy range (conversational)
  marathon: number; // M pace
  threshold: number; // T pace (comfortably hard)
  interval: number; // I pace (VO2max — ~3k–5k effort)
  repetition: number; // R pace (fast, neuromuscular — ~mile effort)
}

export interface RacePredictions {
  "1500m": number; // seconds
  mile: number;
  "5K": number;
  "10K": number;
  "Half Marathon": number;
  Marathon: number;
}

export type RaceDistance = keyof RacePredictions;

// ============================================================================
// DANIELS/GILBERT OXYGEN COST MODEL
// ============================================================================

// Fraction of VO2max sustainable at a given race duration (minutes)
// Based on percent utilisation curve from Daniels & Gilbert (1979)
function percentVO2Max(durationMinutes: number): number {
  const t = durationMinutes;
  // Percent of VO2max as a function of race duration
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * t) +
    0.2989558 * Math.exp(-0.1932605 * t)
  );
}

// Oxygen cost of running at velocity v (ml/kg/min), v in meters per minute
function vo2FromVelocity(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

// Inverse: velocity from VO2 demand (meters per minute)
function velocityFromVo2(vo2: number): number {
  // Quadratic solve: 0.000104v² + 0.182258v - (4.60 + vo2) = 0
  const a = 0.000104;
  const b = 0.182258;
  const c = -(4.6 + vo2);
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

// ============================================================================
// VDOT FROM RACE PERFORMANCE
// ============================================================================

/**
 * Compute VDOT from a race result.
 * @param distanceMeters - race distance in meters
 * @param timeSeconds - finish time in seconds
 */
export function computeVDOT(
  distanceMeters: number,
  timeSeconds: number,
): number {
  const minutes = timeSeconds / 60;
  const velocityMpm = distanceMeters / minutes; // meters per minute
  const vo2 = vo2FromVelocity(velocityMpm);
  const pct = percentVO2Max(minutes);
  const vdot = vo2 / pct;
  // Round to 1 decimal
  return Math.round(vdot * 10) / 10;
}

// ============================================================================
// TRAINING PACES FROM VDOT
// ============================================================================

// The training zones correspond to specific %VO2max or %HRmax ranges per Daniels.
// We express them as pace adjustments from the VDOT-equivalent velocity.

const ZONE_VO2_FRACTIONS: Record<TrainingZone, [number, number]> = {
  E: [0.59, 0.74], // 59–74% VO2max — Easy/recovery
  M: [0.75, 0.84], // 75–84% VO2max — Marathon pace
  T: [0.83, 0.88], // 83–88% VO2max — Lactate threshold / Tempo
  I: [0.95, 1.0], // 95–100% VO2max — Interval / VO2max
  R: [1.05, 1.1], // Repetition — above VO2max, speed/economy
};

function paceSecondsPerMile(vo2MaxFraction: number, vdot: number): number {
  const targetVo2 = vdot * vo2MaxFraction;
  const velocityMpm = velocityFromVo2(targetVo2);
  const metersPerSecond = velocityMpm / 60;
  const secondsPerMeter = 1 / metersPerSecond;
  const secondsPerMile = secondsPerMeter * 1609.344;
  return secondsPerMile;
}

export function computeTrainingPaces(vdot: number): TrainingPaces {
  const [eLow, eHigh] = ZONE_VO2_FRACTIONS.E;
  const [, mHigh] = ZONE_VO2_FRACTIONS.M;
  const [tLow] = ZONE_VO2_FRACTIONS.T;
  const [iLow] = ZONE_VO2_FRACTIONS.I;
  const [rLow] = ZONE_VO2_FRACTIONS.R;

  return {
    easyLow: paceSecondsPerMile(eHigh, vdot), // slower = higher pace value at low fraction
    easyHigh: paceSecondsPerMile(eLow, vdot), // faster ceiling of easy
    marathon: paceSecondsPerMile(mHigh, vdot),
    threshold: paceSecondsPerMile(tLow, vdot),
    interval: paceSecondsPerMile(iLow, vdot),
    repetition: paceSecondsPerMile(rLow, vdot),
  };
}

// ============================================================================
// RACE PREDICTIONS FROM VDOT
// ============================================================================

const RACE_DISTANCES_METERS: Record<RaceDistance, number> = {
  "1500m": 1500,
  mile: 1609.344,
  "5K": 5000,
  "10K": 10000,
  "Half Marathon": 21097.5,
  Marathon: 42195,
};

// Binary search: find race time that produces target VDOT at given distance
function predictRaceTime(distanceMeters: number, vdot: number): number {
  // Bracket in minutes
  let lo = 1;
  let hi = 600;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = computeVDOT(distanceMeters, mid * 60);
    if (v > vdot) {
      lo = mid; // too fast — need more time
    } else {
      hi = mid;
    }
  }
  return Math.round(((lo + hi) / 2) * 60);
}

export function computeRacePredictions(vdot: number): RacePredictions {
  return Object.fromEntries(
    Object.entries(RACE_DISTANCES_METERS).map(([distance, meters]) => [
      distance,
      predictRaceTime(meters, vdot),
    ]),
  ) as RacePredictions;
}

// ============================================================================
// FULL VDOT CALCULATION
// ============================================================================

export function calculateVDOT(
  distanceMeters: number,
  timeSeconds: number,
): VDOTResult {
  const vdot = computeVDOT(distanceMeters, timeSeconds);
  const trainingPaces = computeTrainingPaces(vdot);
  const racePredictions = computeRacePredictions(vdot);
  return { vdot, trainingPaces, racePredictions };
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/** Format seconds as M:SS or H:MM:SS */
export function formatRaceTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format seconds-per-mile as M:SS /mi */
export function formatPacePerMile(secondsPerMile: number): string {
  const m = Math.floor(secondsPerMile / 60);
  const s = Math.round(secondsPerMile % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse user time input (MM:SS, M:SS, H:MM:SS) to seconds. Returns null if invalid. */
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

/** Standard distance options for the calculator UI */
export const VDOT_DISTANCE_OPTIONS: { label: string; meters: number }[] = [
  { label: "1500m", meters: 1500 },
  { label: "Mile", meters: 1609.344 },
  { label: "5K", meters: 5000 },
  { label: "10K", meters: 10000 },
  { label: "Half Marathon", meters: 21097.5 },
  { label: "Marathon", meters: 42195 },
];

/** Training zone labels and descriptions */
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

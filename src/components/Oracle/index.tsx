

import React, { useState, useCallback, useRef, useEffect } from "react";
import type { Activity } from "../../hooks";
import type {
  OracleResult,
  OracleLever,
  LeverUrgency,
} from "../../store/oracle";
import type { PRRecord } from "../../store/predictions";
import {
  runOracle,
  formatOracleTime,
  parseTimeInput,
  type RaceDistance,
} from "../../store/oracle";
import styles from "./Oracle.module.scss";

const DISTANCES: RaceDistance[] = ["5K", "10K", "Half Marathon", "Marathon"];

const DISTANCE_SHORTHAND: Record<RaceDistance, string> = {
  "5K": "5K",
  "10K": "10K",
  "Half Marathon": "HM",
  Marathon: "MAR",
};

const DISTANCE_PRESETS: Record<
  RaceDistance,
  { label: string; seconds: number }[]
> = {
  "5K": [
    { label: "Sub-30", seconds: 30 * 60 },
    { label: "Sub-25", seconds: 25 * 60 },
    { label: "Sub-20", seconds: 20 * 60 },
  ],
  "10K": [
    { label: "Sub-60", seconds: 60 * 60 },
    { label: "Sub-50", seconds: 50 * 60 },
    { label: "Sub-45", seconds: 45 * 60 },
  ],
  "Half Marathon": [
    { label: "Sub-2:00", seconds: 2 * 3600 },
    { label: "Sub-1:45", seconds: 1 * 3600 + 45 * 60 },
    { label: "Sub-1:30", seconds: 1 * 3600 + 30 * 60 },
  ],
  Marathon: [
    { label: "Sub-4:00", seconds: 4 * 3600 },
    { label: "Sub-3:30", seconds: 3 * 3600 + 30 * 60 },
    { label: "Sub-3:00", seconds: 3 * 3600 },
  ],
};

const VERDICT_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; ringColor: string }
> = {
  ready: {
    label: "READY",
    color: "#7dd3a6",
    bg: "rgba(125, 211, 166, 0.1)",
    ringColor: "#7dd3a6",
  },
  close: {
    label: "CLOSE",
    color: "#60a5fa",
    bg: "rgba(96, 165, 250, 0.1)",
    ringColor: "#60a5fa",
  },
  possible: {
    label: "POSSIBLE",
    color: "#facc15",
    bg: "rgba(250, 204, 21, 0.1)",
    ringColor: "#facc15",
  },
  stretch: {
    label: "STRETCH",
    color: "#fb923c",
    bg: "rgba(251, 146, 60, 0.1)",
    ringColor: "#fb923c",
  },
  unlikely: {
    label: "UNLIKELY",
    color: "#f87171",
    bg: "rgba(248, 113, 113, 0.1)",
    ringColor: "#f87171",
  },
};

const URGENCY_COLOR: Record<LeverUrgency, string> = {
  critical: "#f87171",
  high: "#facc15",
  medium: "#60a5fa",
};

const RING_RADIUS = 68;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface OraclePanelProps {
  activities: Activity[];
  stravaPRs?: PRRecord[];
}

// Oracle Panel
export function OraclePanel({ activities, stravaPRs }: OraclePanelProps) {
  const [selectedDistance, setSelectedDistance] =
    useState<RaceDistance>("Marathon");
  const [targetInput, setTargetInput] = useState("3:30:00");
  const [weeksToRace, setWeeksToRace] = useState(12);
  const [result, setResult] = useState<OracleResult | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [animatedProbability, setAnimatedProbability] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  
  useEffect(() => {
    if (!result) {
      setAnimatedProbability(0);
      return;
    }
    const target = result.probability;
    let current = 0;
    // Step
    const step = () => {
      current = Math.min(current + 2, target);
      setAnimatedProbability(current);
      if (current < target) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current !== null)
        cancelAnimationFrame(animFrameRef.current);
    };
  }, [result]);

  const handleQuery = useCallback(() => {
    const parsed = parseTimeInput(targetInput);
    if (!parsed || parsed <= 0) {
      setInputError("Enter a valid time — e.g. 3:30:00 or 28:00");
      return;
    }
    setInputError(null);
    setAnimatedProbability(0);
    const r = runOracle(
      activities,
      {
        distance: selectedDistance,
        targetSeconds: parsed,
        weeksToRace,
      },
      stravaPRs,
    );
    setResult(r);
  }, [activities, selectedDistance, targetInput, weeksToRace, stravaPRs]);

  const handlePreset = useCallback((seconds: number) => {
    setTargetInput(formatOracleTime(seconds));
    setResult(null);
    setInputError(null);
  }, []);

  const handleDistanceChange = useCallback((d: RaceDistance) => {
    setSelectedDistance(d);
    const preset = DISTANCE_PRESETS[d][0];
    setTargetInput(formatOracleTime(preset.seconds));
    setResult(null);
    setInputError(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleQuery();
    },
    [handleQuery],
  );

  const verdictConfig = result ? VERDICT_CONFIG[result.verdict] : null;
  // Ring Dash
  const ringDash = (animatedProbability / 100) * RING_CIRCUMFERENCE;

  return (
    <div className={styles.container}>
      {}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.tag}>Decision Engine</span>
        </div>
        <h2 className={styles.title}>The Oracle</h2>
        <p className={styles.subtitle}>
          Ask the one question every runner has. Get a probabilistic, honest
          answer.
        </p>
      </div>

      {}
      <div className={styles.queryBlock}>
        {}
        <div className={styles.distanceRow}>
          {DISTANCES.map((d) => (
            <button
              key={d}
              className={`${styles.distanceBtn} ${selectedDistance === d ? styles.active : ""}`}
              onClick={() => handleDistanceChange(d)}
              aria-pressed={selectedDistance === d}
            >
              {DISTANCE_SHORTHAND[d]}
            </button>
          ))}
        </div>

        {}
        <div className={styles.presetRow}>
          {DISTANCE_PRESETS[selectedDistance].map((p) => (
            <button
              key={p.label}
              className={styles.presetBtn}
              onClick={() => handlePreset(p.seconds)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {}
        <div className={styles.inputRow}>
          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Target time</label>
            <input
              className={`${styles.timeInput} ${inputError ? styles.hasError : ""}`}
              value={targetInput}
              onChange={(e) => {
                setTargetInput(e.target.value);
                setInputError(null);
                setResult(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="3:30:00"
              aria-label="Target finish time"
              spellCheck={false}
            />
            {inputError && (
              <span className={styles.errorText}>{inputError}</span>
            )}
          </div>

          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Weeks to race</label>
            <select
              className={styles.weeksSelect}
              value={weeksToRace}
              onChange={(e) => {
                setWeeksToRace(Number(e.target.value));
                setResult(null);
              }}
              aria-label="Weeks until race"
            >
              {[4, 6, 8, 10, 12, 16, 20, 24].map((w) => (
                <option key={w} value={w}>
                  {w} weeks
                </option>
              ))}
            </select>
          </div>

          <button className={styles.askBtn} onClick={handleQuery}>
            Ask Oracle
          </button>
        </div>
      </div>

      {}
      {!result && (
        <div className={styles.emptyState}>
          <span className={styles.emptyOrb}>◎</span>
          <p className={styles.emptyText}>
            Set your goal above and ask The Oracle.
          </p>
          <p className={styles.emptyHint}>
            Built from your Strava history — no guesswork.
          </p>
        </div>
      )}

      {}
      {result && verdictConfig && (
        <div className={styles.result}>
          {}
          <div className={styles.resultTop}>
            {}
            <div className={styles.ringWrapper}>
              <svg
                className={styles.ring}
                viewBox="0 0 180 180"
                fill="none"
                aria-label={`${result.probability}% probability`}
              >
                {}
                <defs>
                  <filter
                    id="ring-glow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {}
                <circle
                  cx="90"
                  cy="90"
                  r={RING_RADIUS}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="10"
                  fill="none"
                />
                {}
                <circle
                  cx="90"
                  cy="90"
                  r={RING_RADIUS}
                  stroke={verdictConfig.ringColor}
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${ringDash} ${RING_CIRCUMFERENCE}`}
                  transform="rotate(-90 90 90)"
                  filter="url(#ring-glow)"
                />

                {}
                <text
                  x="90"
                  y="84"
                  textAnchor="middle"
                  className={styles.ringNumber}
                  fill={verdictConfig.color}
                >
                  {animatedProbability}%
                </text>
                <text
                  x="90"
                  y="102"
                  textAnchor="middle"
                  className={styles.ringLabel}
                  fill="rgba(255,255,255,0.35)"
                >
                  probability
                </text>
              </svg>

              {}
              <div className={styles.confidenceBand}>
                <span className={styles.bandEdge}>
                  {result.probabilityLow}%
                </span>
                <div className={styles.bandTrack}>
                  <div
                    className={styles.bandFill}
                    style={{
                      left: `${result.probabilityLow}%`,
                      width: `${result.probabilityHigh - result.probabilityLow}%`,
                      background: verdictConfig.color,
                    }}
                  />
                  {}
                  <div
                    className={styles.bandMarker}
                    style={{
                      left: `${result.probability}%`,
                      background: verdictConfig.color,
                    }}
                  />
                </div>
                <span className={styles.bandEdge}>
                  {result.probabilityHigh}%
                </span>
              </div>
              <span className={styles.bandCaption}>confidence range</span>
            </div>

            {}
            <div className={styles.verdictWrapper}>
              {}
              <div
                className={styles.verdictBadge}
                style={{
                  color: verdictConfig.color,
                  background: verdictConfig.bg,
                }}
              >
                {verdictConfig.label}
              </div>

              <p className={styles.verdictText}>{result.verdictText}</p>

              {}
              <div className={styles.projections}>
                <div className={styles.proj}>
                  <span className={styles.projLabel}>Pessimistic</span>
                  <span
                    className={styles.projTime}
                    style={{ color: "#f87171" }}
                  >
                    {formatOracleTime(result.projectedSecondsLow)}
                  </span>
                </div>
                <div className={`${styles.proj} ${styles.projCenter}`}>
                  <span className={styles.projLabel}>Expected</span>
                  <span className={styles.projTimeMain}>
                    {formatOracleTime(result.projectedSeconds)}
                  </span>
                </div>
                <div className={styles.proj}>
                  <span className={styles.projLabel}>Optimistic</span>
                  <span
                    className={styles.projTime}
                    style={{ color: "#7dd3a6" }}
                  >
                    {formatOracleTime(result.projectedSecondsHigh)}
                  </span>
                </div>
              </div>

              {}
              {result.projectedSeconds > 0 && (
                <div
                  className={`${styles.gapChip} ${result.gapPositive ? styles.gapAhead : styles.gapBehind}`}
                >
                  {result.gapPositive
                    ? `${formatOracleTime(Math.abs(result.gapSeconds))} ahead of target`
                    : `${formatOracleTime(Math.abs(result.gapSeconds))} to find`}
                </div>
              )}
            </div>
          </div>

          {}
          {result.levers.length > 0 && (
            <div className={styles.levers}>
              <p className={styles.leversTitle}>Move the needle</p>
              <div className={styles.leverGrid}>
                {result.levers.map((lever, i) => (
                  <LeverCard key={i} lever={lever} index={i} />
                ))}
              </div>
            </div>
          )}

          {}
          <div className={styles.footer}>
            <div className={styles.confidenceRow}>
              <span className={styles.confidenceLabel}>Data confidence</span>
              <div className={styles.confidenceTrack}>
                <div
                  className={styles.confidenceFill}
                  style={{ width: `${result.dataConfidence}%` }}
                />
              </div>
              <span className={styles.confidencePct}>
                {result.dataConfidence}%
              </span>
            </div>
            <p className={styles.confidenceNote}>
              {result.dataConfidenceReason}
            </p>
            {result.currentPR && (
              <p className={styles.prNote}>
                Current PR: {formatOracleTime(result.currentPR.time)} on{" "}
                {new Date(result.currentPR.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Single lever card inside the Oracle result display
function LeverCard({ lever, index }: { lever: OracleLever; index: number }) {
  const color = URGENCY_COLOR[lever.urgency];
  return (
    <div
      className={styles.leverCard}
      style={{ "--lever-color": color } as React.CSSProperties}
      role="article"
    >
      <div className={styles.leverTop}>
        <span className={styles.leverIcon} aria-hidden="true">
          {lever.icon}
        </span>
        <div className={styles.leverMeta}>
          <span className={styles.leverTitle}>{lever.title}</span>
          <span className={styles.leverUrgency} style={{ color }}>
            {lever.urgency}
          </span>
        </div>
        <div className={styles.leverGain}>
          <span className={styles.leverGainValue} style={{ color }}>
            +{lever.probabilityGain}%
          </span>
          <span className={styles.leverGainLabel}>probability</span>
        </div>
      </div>
      <p className={styles.leverDesc}>{lever.description}</p>
    </div>
  );
}

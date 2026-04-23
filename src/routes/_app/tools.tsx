/**
 * Tools Page
 *
 * A collection of running calculators and planning utilities.
 * First tool: VDOT Calculator (Daniels' Running Formula).
 */

import React, { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  calculateVDOT,
  parseVDOTTimeInput,
  formatRaceTime,
  formatPacePerMile,
  VDOT_DISTANCE_OPTIONS,
  TRAINING_ZONE_INFO,
  type VDOTResult,
  type TrainingZone,
} from "../../store/vdot";
import styles from "./Tools.module.scss";

// ============================================================================
// VDOT CALCULATOR
// ============================================================================

const ZONE_ORDER: TrainingZone[] = ["E", "M", "T", "I", "R"];

function VDOTCalculator() {
  const [distanceMeters, setDistanceMeters] = useState(5000);
  const [timeInput, setTimeInput] = useState("");
  const [result, setResult] = useState<VDOTResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"paces" | "races">("paces");

  const handleCalculate = useCallback(() => {
    const seconds = parseVDOTTimeInput(timeInput);
    if (!seconds || seconds <= 0) {
      setError("Enter a valid time — e.g. 19:30 or 1:45:00");
      return;
    }
    // Sanity check: pace must be at least 3:00/mi (exceptionally fast)
    const pacePerMile = (seconds / distanceMeters) * 1609.344;
    if (pacePerMile < 180) {
      setError("That pace isn't physically possible — check your time.");
      return;
    }
    setError(null);
    setResult(calculateVDOT(distanceMeters, seconds));
  }, [distanceMeters, timeInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleCalculate();
    },
    [handleCalculate],
  );

  const handleReset = useCallback(() => {
    setResult(null);
    setTimeInput("");
    setError(null);
  }, []);

  const selectedDistanceLabel = useMemo(
    () =>
      VDOT_DISTANCE_OPTIONS.find((d) => d.meters === distanceMeters)?.label ??
      "",
    [distanceMeters],
  );

  return (
    <section className={styles.tool}>
      {/* Tool Header */}
      <div className={styles.toolHeader}>
        <div className={styles.toolMeta}>
          <span className={styles.toolTag}>Daniels' Running Formula</span>
        </div>
        <h2 className={styles.toolTitle}>VDOT Calculator</h2>
        <p className={styles.toolDescription}>
          Enter a recent race result to get your VDOT — a proxy for running
          fitness — and unlock training paces calibrated to your current aerobic
          capacity.
        </p>
      </div>

      {/* Input Form */}
      <div className={styles.calcForm}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Race Distance</label>
          <select
            className={styles.select}
            value={distanceMeters}
            onChange={(e) => {
              setDistanceMeters(Number(e.target.value));
              setResult(null);
              setError(null);
            }}
          >
            {VDOT_DISTANCE_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.meters}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Finish Time</label>
          <div className={styles.timeInputWrapper}>
            <input
              type="text"
              className={`${styles.timeInput} ${error ? styles.inputError : ""}`}
              placeholder={distanceMeters < 10000 ? "MM:SS" : "H:MM:SS"}
              value={timeInput}
              onChange={(e) => {
                setTimeInput(e.target.value);
                setError(null);
                setResult(null);
              }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {error && <p className={styles.inputErrorMsg}>{error}</p>}
        </div>

        <div className={styles.formActions}>
          <button className={styles.calcButton} onClick={handleCalculate}>
            Calculate
          </button>
          {result && (
            <button className={styles.resetButton} onClick={handleReset}>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className={styles.results}>
          {/* VDOT Hero */}
          <div className={styles.vdotHero}>
            <div className={styles.vdotValue}>{result.vdot.toFixed(1)}</div>
            <div className={styles.vdotLabel}>VDOT</div>
            <div className={styles.vdotBasis}>
              based on your {selectedDistanceLabel}
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "paces" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("paces")}
            >
              Training Paces
            </button>
            <button
              className={`${styles.tab} ${activeTab === "races" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("races")}
            >
              Race Predictions
            </button>
          </div>

          {/* Training Paces */}
          {activeTab === "paces" && (
            <div className={styles.pacesGrid}>
              {ZONE_ORDER.map((zone) => {
                const info = TRAINING_ZONE_INFO[zone];
                let paceDisplay: string;
                let paceRange: string | null = null;

                if (zone === "E") {
                  paceRange = `${formatPacePerMile(result.trainingPaces.easyLow)} – ${formatPacePerMile(result.trainingPaces.easyHigh)}`;
                  paceDisplay = paceRange;
                  paceRange = null;
                } else if (zone === "M") {
                  paceDisplay = formatPacePerMile(
                    result.trainingPaces.marathon,
                  );
                } else if (zone === "T") {
                  paceDisplay = formatPacePerMile(
                    result.trainingPaces.threshold,
                  );
                } else if (zone === "I") {
                  paceDisplay = formatPacePerMile(
                    result.trainingPaces.interval,
                  );
                } else {
                  paceDisplay = formatPacePerMile(
                    result.trainingPaces.repetition,
                  );
                }

                return (
                  <div key={zone} className={styles.paceCard}>
                    <div className={styles.paceCardLeft}>
                      <span
                        className={styles.zoneTag}
                        style={{
                          color: info.color,
                          borderColor: `${info.color}30`,
                        }}
                      >
                        {zone}
                      </span>
                      <div className={styles.zoneInfo}>
                        <span className={styles.zoneName}>{info.label}</span>
                        <span className={styles.zoneDesc}>
                          {info.description}
                        </span>
                      </div>
                    </div>
                    <div
                      className={styles.paceValue}
                      style={{ color: info.color }}
                    >
                      {paceDisplay}
                      <span className={styles.paceUnit}>/mi</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Race Predictions */}
          {activeTab === "races" && (
            <div className={styles.racesGrid}>
              {(
                [
                  ["1500m", "1500m"],
                  ["mile", "Mile"],
                  ["5K", "5K"],
                  ["10K", "10K"],
                  ["Half Marathon", "Half Marathon"],
                  ["Marathon", "Marathon"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className={styles.raceCard}>
                  <span className={styles.raceDistance}>{label}</span>
                  <span className={styles.raceTime}>
                    {formatRaceTime(result.racePredictions[key])}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footnote */}
          <p className={styles.footnote}>
            VDOT is derived from Daniels & Gilbert (1979). Training zones are
            calibrated to current fitness — recalculate after each race or
            significant fitness shift.
          </p>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// PAGE
// ============================================================================

function ToolsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Page Header */}
        <header className={styles.header}>
          <span className={styles.kicker}>Calculators & Planning</span>
          <h1 className={styles.title}>Tools</h1>
          <p className={styles.subtitle}>
            Data-driven calculators to support smarter training decisions.
          </p>
        </header>

        <VDOTCalculator />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/tools")({
  component: ToolsPage,
});

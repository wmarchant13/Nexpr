/**
 * Goals Page
 *
 * User-inputtable distance/time goals for the year.
 * Automatically marks goals complete when a matching Strava activity is logged.
 */

import React, { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useActivities,
  useAthlete,
  kmToMiles,
  mToKm,
  formatPace,
  useStravaPRs,
  useGoals,
  useSaveGoal,
  useDeleteGoal,
} from "../../hooks";
import { formatTime } from "../../store/predictions";
import styles from "./Goals.module.scss";

export const Route = createFileRoute("/_app/goals")({
  component: GoalsPage,
});

type RaceDistanceKey = "5K" | "10K" | "Half Marathon" | "Marathon";

const RACE_DISTANCE_METERS: Record<RaceDistanceKey, number> = {
  "5K": 5000,
  "10K": 10000,
  "Half Marathon": 21097.5,
  Marathon: 42195,
};

const DISTANCE_ORDER: RaceDistanceKey[] = [
  "5K",
  "10K",
  "Half Marathon",
  "Marathon",
];

interface DistanceGoal {
  id: string;
  distance: RaceDistanceKey;
  targetSeconds: number;
  year: number;
}

function parseTimeInput(input: string): number | null {
  const parts = input.trim().split(":").map(Number);
  if (parts.some(isNaN) || parts.length < 2 || parts.length > 3) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s < 0 || s >= 60) return null;
    return m * 60 + s;
  }
  const [h, m, s] = parts;
  if (m < 0 || m >= 60 || s < 0 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

function GoalsPage() {
  const { data: athlete } = useAthlete();
  const { data: activities, isLoading } = useActivities(1, 100);
  const { data: stravaPRs, isLoading: prsLoading } = useStravaPRs(activities);
  const { data: dbGoals = [] } = useGoals(athlete?.id);
  const saveGoalMutation = useSaveGoal();
  const deleteGoalMutation = useDeleteGoal();

  const [newDistance, setNewDistance] = useState<RaceDistanceKey>("5K");
  const [newTime, setNewTime] = useState("");
  const [timeError, setTimeError] = useState("");

  const currentYear = new Date().getFullYear();

  const goals = dbGoals as DistanceGoal[];

  // Best time this year per distance (from actual activities)
  const bestTimesThisYear = useMemo<
    Record<RaceDistanceKey, number | undefined>
  >(() => {
    if (!activities) return {} as Record<RaceDistanceKey, number | undefined>;
    const result: Partial<Record<RaceDistanceKey, number>> = {};
    for (const [distName, meters] of Object.entries(RACE_DISTANCE_METERS) as [
      RaceDistanceKey,
      number,
    ][]) {
      const tolerance = meters * 0.05;
      const yearRuns = activities.filter((a) => {
        const isRun = a.type === "Run" || a.sport_type === "Run";
        const date = new Date(a.start_date);
        return (
          isRun &&
          date.getFullYear() === currentYear &&
          Math.abs(a.distance - meters) <= tolerance
        );
      });
      if (yearRuns.length > 0) {
        result[distName] = Math.min(...yearRuns.map((r) => r.moving_time));
      }
    }
    return result as Record<RaceDistanceKey, number | undefined>;
  }, [activities, currentYear]);

  const handleAddGoal = useCallback(() => {
    if (!athlete?.id) return;
    const targetSeconds = parseTimeInput(newTime);
    if (targetSeconds === null || targetSeconds <= 0) {
      setTimeError("Enter time as MM:SS or H:MM:SS");
      return;
    }
    saveGoalMutation.mutate({
      athleteId: athlete.id,
      distance: newDistance,
      targetSeconds,
      year: currentYear,
    });
    setNewTime("");
    setTimeError("");
  }, [athlete?.id, newDistance, newTime, currentYear, saveGoalMutation]);

  const handleDeleteGoal = useCallback(
    (id: string) => {
      if (!athlete?.id) return;
      deleteGoalMutation.mutate({ id, athleteId: athlete.id });
    },
    [athlete?.id, deleteGoalMutation],
  );

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading your goals...</p>
        </div>
      </div>
    );
  }

  const yearGoals = goals.filter((g) => g.year === currentYear);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.kicker}>Race Goals</span>
          <h1 className={styles.title}>{currentYear} Targets</h1>
          <p className={styles.subtitle}>
            Set a goal, and we'll mark it done when Strava logs your PR.
          </p>
        </header>

        {/* Add Goal Form */}
        <section className={styles.formSection}>
          <div className={styles.goalForm}>
            <select
              className={styles.distanceSelect}
              value={newDistance}
              onChange={(e) =>
                setNewDistance(e.target.value as RaceDistanceKey)
              }
            >
              {DISTANCE_ORDER.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className={styles.timeInputWrapper}>
              <input
                className={`${styles.timeInput} ${timeError ? styles.timeInputError : ""}`}
                type="text"
                placeholder={
                  newDistance === "5K" || newDistance === "10K"
                    ? "MM:SS"
                    : "H:MM:SS"
                }
                value={newTime}
                onChange={(e) => {
                  setNewTime(e.target.value);
                  setTimeError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAddGoal()}
              />
              {timeError && (
                <span className={styles.timeError}>{timeError}</span>
              )}
            </div>
            <button className={styles.addButton} onClick={handleAddGoal}>
              Add Goal
            </button>
          </div>
        </section>

        {/* Goals List */}
        {yearGoals.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No goals yet for {currentYear}.</p>
            <p className={styles.emptyHint}>
              Pick a distance and target time above.
            </p>
          </div>
        ) : (
          <section className={styles.goalsSection}>
            <div className={styles.goalsGrid}>
              {yearGoals.map((goal) => {
                const bestTime = bestTimesThisYear[goal.distance];
                const isComplete =
                  bestTime !== undefined && bestTime <= goal.targetSeconds;
                const gapSeconds =
                  bestTime !== undefined ? goal.targetSeconds - bestTime : null;
                const isClose =
                  gapSeconds !== null && !isComplete && gapSeconds < 30;

                return (
                  <div
                    key={goal.id}
                    className={`${styles.goalCard} ${isComplete ? styles.complete : ""}`}
                  >
                    <div className={styles.goalHeader}>
                      <span className={styles.goalDistance}>
                        {goal.distance}
                      </span>
                      <div className={styles.goalActions}>
                        {isComplete && (
                          <span className={styles.completeBadge}>✓ Done</span>
                        )}
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDeleteGoal(goal.id)}
                          aria-label="Delete goal"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    <div className={styles.goalBody}>
                      <div className={styles.timeStat}>
                        <span className={styles.timeLabel}>Target</span>
                        <span className={styles.timeValue}>
                          {formatTime(goal.targetSeconds)}
                        </span>
                      </div>
                      {bestTime !== undefined && (
                        <div className={styles.timeStat}>
                          <span className={styles.timeLabel}>
                            Best this year
                          </span>
                          <span
                            className={`${styles.timeValue} ${isComplete ? styles.timeComplete : ""}`}
                          >
                            {formatTime(bestTime)}
                          </span>
                        </div>
                      )}
                    </div>

                    {gapSeconds !== null && (
                      <div
                        className={`${styles.gapChip} ${isComplete ? styles.gapComplete : isClose ? styles.gapClose : ""}`}
                      >
                        {isComplete
                          ? `${formatTime(Math.abs(gapSeconds))} under target`
                          : `${formatTime(gapSeconds)} to go`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Personal Records */}
        <section className={styles.prsSection}>
          <h2 className={styles.sectionTitle}>Personal Records</h2>
          <p className={styles.sectionSubtitle}>
            Pulled from your Strava best efforts
          </p>

          {prsLoading ? (
            <div className={styles.prsLoading}>
              <div className={styles.spinner} />
              <span>Fetching from Strava...</span>
            </div>
          ) : stravaPRs && stravaPRs.length > 0 ? (
            <div className={styles.prsGrid}>
              {[...stravaPRs]
                .sort(
                  (a, b) =>
                    DISTANCE_ORDER.indexOf(a.distance as RaceDistanceKey) -
                    DISTANCE_ORDER.indexOf(b.distance as RaceDistanceKey),
                )
                .map((pr) => (
                  <div key={pr.distance} className={styles.prCard}>
                    <span className={styles.prDistance}>{pr.distance}</span>
                    <span className={styles.prTime}>{formatTime(pr.time)}</span>
                    <span className={styles.prPace}>
                      {formatPace(pr.pace)}/mi
                    </span>
                    <span className={styles.prDate}>
                      {pr.date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className={styles.noPrs}>
              <p>No best efforts found yet.</p>
              <p className={styles.noPrsHint}>
                Strava records best efforts at 5K, 10K, Half, and Marathon
                within your runs.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

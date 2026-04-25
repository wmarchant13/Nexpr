

import React, { useMemo } from "react";
import type { Activity } from "../../../hooks";
import {
  useFuelingEntry,
  useAllFuelingEntries,
  useActivitiesByIds,
} from "../../../hooks";
import type { FuelingInsight } from "../../../store/fueling";
import {
  analyzeFueledRun,
  buildFuelingProfile,
  FUELING_TOOLTIP,
} from "../../../store/fueling";
import styles from "./FuelingInsights.module.scss";

interface FuelingCardProps {
  activity: Activity;
  effortScore?: number;
}

// Displays fueling analysis for a single activity
export function FuelingCard({ activity, effortScore = 5 }: FuelingCardProps) {
  const { data: entry, isLoading } = useFuelingEntry(activity.id);

  const analysis = useMemo(() => {
    if (!entry) return null;
    return analyzeFueledRun(activity, entry, effortScore);
  }, [activity, entry, effortScore]);

  if (isLoading || !analysis) return null;

  const {
    fueling,
    performance,
    effectivenessScore,
    fuelingLevel,
    performanceCategory,
    insights,
  } = analysis;
  const carbsDisplay =
    fueling.carbsGrams ?? (fueling.gelsCount ? fueling.gelsCount * 25 : 0);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>⚡</span>
        <h4 className={styles.cardTitle}>Fueling Analysis</h4>
        <div
          className={`${styles.effectivenessBadge} ${styles[performanceCategory]}`}
          title={`Effectiveness: ${effectivenessScore}/10`}
        >
          {effectivenessScore.toFixed(1)}
        </div>
      </div>

      <div className={styles.cardStats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{carbsDisplay}g</span>
          <span className={styles.statLabel}>Carbs</span>
        </div>
        {fueling.hydrationMl && (
          <div className={styles.statItem}>
            <span className={styles.statValue}>{fueling.hydrationMl}ml</span>
            <span className={styles.statLabel}>Hydration</span>
          </div>
        )}
        {fueling.caffeineCount && (
          <div className={styles.statItem}>
            <span className={styles.statValue}>{fueling.caffeineCount}</span>
            <span className={styles.statLabel}>Caffeine</span>
          </div>
        )}
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles[fuelingLevel]}`}>
            {fuelingLevel.charAt(0).toUpperCase() + fuelingLevel.slice(1)}
          </span>
          <span className={styles.statLabel}>Level</span>
        </div>
      </div>

      <div className={styles.performanceRow}>
        <div className={styles.perfMetric}>
          <span className={styles.perfLabel}>Stability</span>
          <div className={styles.perfBar}>
            <div
              className={styles.perfFill}
              style={{ width: `${performance.paceStability}%` }}
            />
          </div>
          <span className={styles.perfValue}>
            {Math.round(performance.paceStability)}%
          </span>
        </div>
        <div className={styles.perfMetric}>
          <span className={styles.perfLabel}>Fade</span>
          <span
            className={`${styles.perfValue} ${performance.fadePercentage > 5 ? styles.negative : styles.positive}`}
          >
            {performance.fadePercentage > 0 ? "+" : ""}
            {performance.fadePercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {insights.length > 0 && (
        <div className={styles.cardInsights}>
          {insights.slice(0, 2).map((insight) => (
            <div
              key={insight.id}
              className={`${styles.insight} ${styles[insight.type]}`}
            >
              <span className={styles.insightTitle}>{insight.title}</span>
              <span className={styles.insightDesc}>{insight.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface FuelingProfileCardProps {
  activities: Activity[];
  effortMap: Map<number, { score: number }>;
  athleteId: number;
}

// Displays aggregate fueling profile across all runs
export function FuelingProfileCard({
  activities,
  effortMap,
  athleteId,
}: FuelingProfileCardProps) {
  const { data: fuelingEntries = [], isLoading: isFuelingLoading } =
    useAllFuelingEntries(athleteId);

  const normalizedFuelingEntries = useMemo(
    () =>
      fuelingEntries
        .map((entry) => ({
          ...entry,
          activityId: Number(entry.activityId),
        }))
        .filter((entry) => Number.isInteger(entry.activityId) && entry.activityId > 0),
    [fuelingEntries],
  );

  const missingActivityIds = useMemo(() => {
    const existingIds = new Set(activities.map((a) => a.id));
    return normalizedFuelingEntries
      .map((entry) => entry.activityId)
      .filter((id) => !existingIds.has(id));
  }, [activities, normalizedFuelingEntries]);

  const {
    data: backfilledActivities = [],
    isLoading: isBackfillLoading,
  } = useActivitiesByIds(missingActivityIds);

  const mergedActivities = useMemo(() => {
    if (backfilledActivities.length === 0) return activities;
    const byId = new Map<number, Activity>();
    activities.forEach((a) => byId.set(a.id, a));
    backfilledActivities.forEach((a) => byId.set(a.id, a));
    return Array.from(byId.values());
  }, [activities, backfilledActivities]);

  const profile = useMemo(() => {
    return buildFuelingProfile(mergedActivities, effortMap, normalizedFuelingEntries);
  }, [mergedActivities, effortMap, normalizedFuelingEntries]);

  const unresolvedEntries = useMemo(() => {
    const availableActivityIds = new Set(mergedActivities.map((a) => a.id));
    return normalizedFuelingEntries.filter(
      (entry) => !availableActivityIds.has(entry.activityId),
    );
  }, [mergedActivities, normalizedFuelingEntries]);

  const loggedFuelingRows = useMemo(() => {
    const activityById = new Map(mergedActivities.map((activity) => [activity.id, activity]));

    return normalizedFuelingEntries
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8)
      .map((entry) => {
        const activity = activityById.get(entry.activityId);
        const carbs =
          entry.carbsGrams ??
          (entry.gelsCount ? entry.gelsCount * 25 : undefined);

        return {
          id: entry.activityId,
          activityLabel: activity?.name ?? `Activity #${entry.activityId}`,
          stravaUrl: `https://www.strava.com/activities/${entry.activityId}`,
          dateLabel: activity?.start_date_local
            ? new Date(activity.start_date_local).toLocaleDateString()
            : null,
          carbs,
          gelsCount: entry.gelsCount,
          hydrationMl: entry.hydrationMl,
          caffeineCount: entry.caffeineCount,
          note: entry.note?.trim() || null,
        };
      });
  }, [mergedActivities, normalizedFuelingEntries]);

  if (isFuelingLoading || isBackfillLoading) {
    return (
      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <span className={styles.profileIcon}>⚡</span>
          <h3 className={styles.profileTitle}>Fueling Insights</h3>
        </div>
        <div className={styles.emptyState}>
          <p>Loading fueling data...</p>
        </div>
      </div>
    );
  }

  if (profile.totalFueledRuns === 0) {
    return (
      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <span className={styles.profileIcon}>⚡</span>
          <h3 className={styles.profileTitle}>Fueling Insights</h3>
        </div>
        <div className={styles.emptyState}>
          {normalizedFuelingEntries.length === 0 ? (
            <>
              <p>No fueling data logged yet.</p>
              <p className={styles.emptyHint}>
                Log fueling on your long runs to discover what strategies work
                best for you.
              </p>
            </>
          ) : (
            <>
              <p>
                {normalizedFuelingEntries.length} fueling entries found in your
                logs.
              </p>
              <p className={styles.emptyHint}>
                Showing saved entries from your database while activity details
                sync.
              </p>
              <div className={styles.entryList}>
                {normalizedFuelingEntries.slice(0, 8).map((entry) => {
                  const carbs =
                    entry.carbsGrams ??
                    (entry.gelsCount ? entry.gelsCount * 25 : undefined);
                  const stravaUrl = `https://www.strava.com/activities/${entry.activityId}`;

                  return (
                    <div key={entry.activityId} className={styles.entryRow}>
                      <div className={styles.entryHeader}>
                        <span className={styles.entryId}>
                          Activity #{entry.activityId}
                        </span>
                        <a
                          className={styles.entryLink}
                          href={stravaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View on Strava
                        </a>
                      </div>
                      <span className={styles.entryMeta}>
                        {carbs != null ? `${carbs}g carbs` : "No carbs logged"}
                      </span>
                      <span className={styles.entryMeta}>
                        {entry.hydrationMl != null
                          ? `${entry.hydrationMl}ml hydration`
                          : "No hydration logged"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {unresolvedEntries.length > 0 && (
                <p className={styles.emptyHint}>
                  {unresolvedEntries.length} entries are waiting on activity
                  details from Strava.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.profileCard}>
      <div className={styles.profileHeader}>
        <span className={styles.profileIcon}>⚡</span>
        <h3 className={styles.profileTitle}>Fueling Insights</h3>
        <span className={styles.profileMeta}>
          {profile.totalFueledRuns} runs logged
        </span>
      </div>

      {loggedFuelingRows.length > 0 && (
        <div className={styles.logSection}>
          <h4 className={styles.sectionTitle}>Logged Fueling</h4>
          <div className={styles.logList}>
            {loggedFuelingRows.map((row) => (
              <div key={row.id} className={styles.logItem}>
                <div className={styles.logItemHeader}>
                  <div className={styles.logMainInfo}>
                    <a
                      className={styles.logTitleLink}
                      href={row.stravaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={styles.logTitle}>{row.activityLabel}</span>
                    </a>
                    {row.dateLabel && (
                      <span className={styles.logDate}>{row.dateLabel}</span>
                    )}
                  </div>
                  <a
                    className={styles.logStravaLink}
                    href={row.stravaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Strava
                  </a>
                </div>

                <div className={styles.logMetrics}>
                  <span className={styles.logMetric}>
                    {row.carbs != null ? `${row.carbs}g carbs` : "No carbs"}
                  </span>
                  <span className={styles.logMetric}>
                    {row.gelsCount != null ? `${row.gelsCount} gels` : "No gels"}
                  </span>
                  <span className={styles.logMetric}>
                    {row.hydrationMl != null
                      ? `${row.hydrationMl}ml hydration`
                      : "No hydration"}
                  </span>
                  <span className={styles.logMetric}>
                    {row.caffeineCount != null
                      ? `${row.caffeineCount} caffeine`
                      : "No caffeine"}
                  </span>
                </div>

                {row.note && <div className={styles.logNote}>{row.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {}
      {(profile.optimalCarbRange || profile.optimalHydrationRange) && (
        <div className={styles.optimalSection}>
          <h4 className={styles.sectionTitle}>Your Optimal Ranges</h4>
          <div className={styles.rangeGrid}>
            {profile.optimalCarbRange && (
              <div className={styles.rangeItem}>
                <span className={styles.rangeLabel}>Carbs</span>
                <span className={styles.rangeValue}>
                  {Math.round(profile.optimalCarbRange.min)}–
                  {Math.round(profile.optimalCarbRange.max)}g
                </span>
              </div>
            )}
            {profile.optimalHydrationRange && (
              <div className={styles.rangeItem}>
                <span className={styles.rangeLabel}>Hydration</span>
                <span className={styles.rangeValue}>
                  {Math.round(profile.optimalHydrationRange.min)}–
                  {Math.round(profile.optimalHydrationRange.max)}ml
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {}
      {profile.clusters.length >= 2 && (
        <div className={styles.clusterSection}>
          <h4 className={styles.sectionTitle}>Performance by Fueling Level</h4>
          <div className={styles.clusterGrid}>
            {profile.clusters.slice(0, 2).map((cluster) => (
              <div key={cluster.id} className={styles.clusterCard}>
                <span className={styles.clusterLabel}>{cluster.label}</span>
                <div className={styles.clusterStats}>
                  <div className={styles.clusterStat}>
                    <span className={styles.clusterValue}>
                      {cluster.runCount}
                    </span>
                    <span className={styles.clusterUnit}>runs</span>
                  </div>
                  <div className={styles.clusterStat}>
                    <span className={styles.clusterValue}>
                      {Math.round(cluster.avgPaceStability)}%
                    </span>
                    <span className={styles.clusterUnit}>stability</span>
                  </div>
                  <div className={styles.clusterStat}>
                    <span
                      className={`${styles.clusterValue} ${cluster.avgFade > 5 ? styles.negative : ""}`}
                    >
                      {cluster.avgFade > 0 ? "+" : ""}
                      {cluster.avgFade.toFixed(1)}%
                    </span>
                    <span className={styles.clusterUnit}>fade</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {}
      {profile.insights.length > 0 && (
        <div className={styles.insightsSection}>
          <h4 className={styles.sectionTitle}>Patterns</h4>
          <div className={styles.insightsList}>
            {profile.insights.slice(0, 3).map((insight) => (
              <InsightRow key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {}
      <div className={styles.profileFooter}>
        <span className={styles.disclaimer}>
          {FUELING_TOOLTIP.notNutritionApp}
        </span>
      </div>
    </div>
  );
}

// Insight Row
function InsightRow({ insight }: { insight: FuelingInsight }) {
  const iconMap: Record<string, string> = {
    correlation: "📊",
    pattern: "🔄",
    recommendation: "💡",
  };

  return (
    <div className={`${styles.insightRow} ${styles[insight.type]}`}>
      <span className={styles.insightIcon}>{iconMap[insight.type] || "•"}</span>
      <div className={styles.insightContent}>
        <span className={styles.insightTitle}>{insight.title}</span>
        <span className={styles.insightDesc}>{insight.description}</span>
      </div>
      <span className={styles.confidenceBadge}>{insight.confidence}%</span>
    </div>
  );
}

export { FuelingInput } from "../FuelingInput";

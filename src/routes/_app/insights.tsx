/**
 * Insights Page
 *
 * Deep training analysis and PR prediction system.
 * The core value proposition of Nexpr.
 */

import React, { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  useActivities,
  useAthlete,
  formatPace,
  analyzeWeeklyTraining,
  classifyEfforts,
} from "../../hooks";
import {
  calculateFitnessMetrics,
  calculateInjuryRiskWarnings,
  calculateWeeklyLoads,
} from "../../store/predictions";
import { analyzeVolumeProgression } from "../../store/MarathonDiagnostics";
import { FuelingProfileCard } from "../../components/Fueling";
import styles from "./Insights.module.scss";

const CHART_ACCENT = "#86A7C8";

export const Route = createFileRoute("/_app/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const { data: athlete } = useAthlete();
  const { data: activities, isLoading } = useActivities(1, 100);

  const fitnessMetrics = useMemo(() => {
    if (!activities) return null;
    return calculateFitnessMetrics(activities);
  }, [activities]);

  const weeklyTraining = useMemo(() => {
    if (!activities) return null;
    return analyzeWeeklyTraining(activities, 8);
  }, [activities]);

  // Effort map for fueling analysis
  const effortMap = useMemo(() => {
    if (!activities) return new Map();
    return classifyEfforts(activities);
  }, [activities]);

  const weeklyLoads = useMemo(() => {
    if (!activities) return [];
    return calculateWeeklyLoads(activities, 12);
  }, [activities]);

  const injuryRiskWarnings = useMemo(() => {
    if (!activities) return [];
    return calculateInjuryRiskWarnings(activities);
  }, [activities]);

  const volumeAnalysis = useMemo(() => {
    if (!activities) return null;
    return analyzeVolumeProgression(activities);
  }, [activities]);

  const chartData = useMemo(() => {
    return weeklyLoads.map((w) => ({
      week: w.weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      load: w.totalLoad,
      miles: w.totalMiles,
      avgPace: w.avgPace > 0 ? w.avgPace : null,
      runs: w.runCount,
    }));
  }, [weeklyLoads]);

  const longRunChartData = useMemo(() => {
    if (!weeklyTraining) return [];
    return weeklyTraining.weeks.map((w) => ({
      week: w.label,
      miles: w.miles,
      longRun: w.longRunMiles,
    }));
  }, [weeklyTraining]);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Analyzing your training...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.kicker}>Training Intelligence</span>
          <h1 className={styles.title}>Unlock Your Next PR</h1>
          <p className={styles.subtitle}>
            Data-driven insights to help you train smarter and race faster.
          </p>
        </header>

        {/* Training Metrics */}
        {fitnessMetrics && (
          <section className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Momentum</span>
              <span className={styles.metricValue}>
                {fitnessMetrics.momentum}
              </span>
              <span className={styles.metricCaption}>
                Avg miles, last 4 weeks
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Freshness</span>
              <span
                className={`${styles.metricValue} ${fitnessMetrics.freshness >= 0 ? styles.positive : styles.negative}`}
              >
                {fitnessMetrics.freshness > 0 ? "+" : ""}
                {fitnessMetrics.freshness}%
              </span>
              <span className={styles.metricCaption}>7d miles vs 28d baseline</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Readiness</span>
              <span
                className={`${styles.metricValue} ${fitnessMetrics.readiness >= 90 ? styles.positive : fitnessMetrics.readiness < 60 ? styles.negative : ""}`}
              >
                {fitnessMetrics.readiness}
              </span>
              <span className={styles.metricCaption}>7d load score vs 28d average</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Trend</span>
              <span className={`${styles.metricValue} ${styles.trend}`}>
                {fitnessMetrics.trend}
              </span>
              <span className={styles.metricCaption}>
                {fitnessMetrics.rampRate > 0 ? "+" : ""}
                {fitnessMetrics.rampRate}% weekly
              </span>
            </div>
          </section>
        )}

        {activities && activities.length > 0 && (
          <section className={styles.volumeSection}>
            <div className={styles.volumeHeader}>
              <span className={styles.volumeTag}>Injury Risk</span>
              <h2 className={styles.volumeTitle}>Load + Intensity Warnings</h2>
            </div>

            {injuryRiskWarnings.length === 0 ? (
              <div className={styles.volumeClean}>
                No acute mileage or intensity spikes detected this week.
              </div>
            ) : (
              <div className={styles.volumeFlags}>
                {injuryRiskWarnings.map((warning) => (
                  <div
                    key={warning.id}
                    className={`${styles.volumeFlag} ${styles[warning.severity]}`}
                  >
                    <div className={styles.flagLabel}>
                      <span className={styles.flagBadge}>{warning.title}</span>
                    </div>
                    <p className={styles.flagMessage}>{warning.message}</p>
                    <div className={styles.flagStats}>
                      <div className={styles.flagStat}>
                        <span className={styles.flagStatVal}>{warning.value}%</span>
                        <span className={styles.flagStatKey}>Change</span>
                      </div>
                      {warning.context && (
                        <div className={styles.flagStat}>
                          <span className={styles.flagStatVal}>{warning.context}</span>
                          <span className={styles.flagStatKey}>Context</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Training Load Chart */}
        {chartData.length > 0 && (
          <section className={styles.chartSection}>
            <div className={styles.chartHeader}>
              <span className={styles.chartTag}>Weekly Mileage</span>
              <h2 className={styles.chartTitle}>12-Week Progression</h2>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                  <XAxis
                    dataKey="week"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1A1A",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "3px",
                      fontSize: "0.8125rem",
                      color: "#FFFFFF",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="miles"
                    stroke={CHART_ACCENT}
                    strokeWidth={2}
                    fill="rgba(134,167,200,0.16)"
                    name="Weekly Mileage"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {chartData.length > 0 && (
          <section className={styles.chartSection}>
            <div className={styles.chartHeader}>
              <span className={styles.chartTag}>Weekly Pace</span>
              <h2 className={styles.chartTitle}>Average Pace Over Time</h2>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                  <XAxis
                    dataKey="week"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    reversed
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatPace(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1A1A",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "3px",
                      fontSize: "0.8125rem",
                      color: "#FFFFFF",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                    formatter={(value) => [formatPace(Number(value)), "Avg Pace"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgPace"
                    stroke={CHART_ACCENT}
                    strokeWidth={2}
                    dot={{ r: 2, fill: CHART_ACCENT }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                    name="Avg Pace"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Long Run Chart */}
        {longRunChartData.length > 0 && (
          <section className={styles.chartSection}>
            <div className={styles.chartHeader}>
              <span className={styles.chartTag}>Weekly Mileage</span>
              <h2 className={styles.chartTitle}>Long Runs Over Time</h2>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={longRunChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                  <XAxis
                    dataKey="week"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: "miles",
                      angle: -90,
                      position: "insideLeft",
                      fill: "rgba(255,255,255,0.35)",
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1A1A",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "3px",
                      fontSize: "0.8125rem",
                      color: "#FFFFFF",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                  />
                  <Bar
                    dataKey="miles"
                    fill="rgba(255,255,255,0.14)"
                    radius={[2, 2, 0, 0]}
                    name="Total Miles"
                  />
                  <Bar
                    dataKey="longRun"
                    fill={CHART_ACCENT}
                    radius={[2, 2, 0, 0]}
                    name="Long Run"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Last Week's Long Run Analysis */}
        {volumeAnalysis && volumeAnalysis.weeks.length >= 1 && (() => {
          // Use the most recent complete week (second-to-last if last is current partial)
          const lastWeek = volumeAnalysis.weeks.length >= 2
            ? volumeAnalysis.weeks[volumeAnalysis.weeks.length - 2]
            : volumeAnalysis.weeks[0];
          if (!lastWeek || lastWeek.totalMiles === 0) return null;
          const longRunPct = Math.round((lastWeek.longRunMiles / lastWeek.totalMiles) * 100);
          const status = longRunPct > 33 ? 'high' : longRunPct >= 20 ? 'optimal' : 'low';
          return (
            <section className={styles.volumeSection}>
              <div className={styles.volumeHeader}>
                <span className={styles.volumeTag}>Long Run Analysis</span>
                <h2 className={styles.volumeTitle}>Last Week's Long Run</h2>
              </div>
              <div className={styles.flagStats} style={{ marginBottom: 16 }}>
                <div className={styles.flagStat}>
                  <span className={styles.flagStatVal}>{lastWeek.longRunMiles.toFixed(1)} mi</span>
                  <span className={styles.flagStatKey}>Long run</span>
                </div>
                <div className={styles.flagStat}>
                  <span className={styles.flagStatVal}>{lastWeek.totalMiles.toFixed(1)} mi</span>
                  <span className={styles.flagStatKey}>Weekly total</span>
                </div>
                <div className={styles.flagStat}>
                  <span className={styles.flagStatVal}>{longRunPct}%</span>
                  <span className={styles.flagStatKey}>Of weekly volume</span>
                </div>
                <div className={styles.flagStat}>
                  <span className={styles.flagStatVal} style={{
                    color: status === 'optimal' ? 'var(--success)' : 'var(--warning)'
                  }}>
                    {status === 'optimal' ? 'Optimal' : status === 'high' ? 'High %' : 'Low %'}
                  </span>
                  <span className={styles.flagStatKey}>Assessment</span>
                </div>
              </div>
              {longRunPct > 33 && (
                <div className={`${styles.volumeFlag} ${styles.warning}`}>
                  <p className={styles.flagMessage}>
                    Long run is {longRunPct}% of weekly volume — above the recommended 25–33%. Consider distributing more mileage across other days to reduce injury risk.
                  </p>
                </div>
              )}
              {longRunPct < 20 && lastWeek.longRunMiles > 0 && (
                <div className={`${styles.volumeFlag} ${styles.warning}`}>
                  <p className={styles.flagMessage}>
                    Long run is only {longRunPct}% of weekly volume. A dedicated long run of 25–33% of total mileage builds aerobic base more effectively.
                  </p>
                </div>
              )}
              {status === 'optimal' && (
                <div className={styles.volumeClean}>
                  Long run ratio is within the optimal 20–33% range — good balance between endurance stimulus and recovery.
                </div>
              )}
            </section>
          );
        })()}

        {/* Fueling Insights */}
        {activities && activities.length > 0 && athlete && (
          <section className={styles.fuelingSection}>
            <FuelingProfileCard
              activities={activities}
              effortMap={effortMap as Map<number, { score: number }>}
              athleteId={athlete.id}
            />
          </section>
        )}
      </div>
    </div>
  );
}

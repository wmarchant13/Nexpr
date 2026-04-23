/**
 * Insights Page
 *
 * Deep training analysis and PR prediction system.
 * The core value proposition of Nexpr.
 */

import React, { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
  useStravaPRs,
} from "../../hooks";
import {
  calculateFitnessMetrics,
  calculateWeeklyLoads,
} from "../../store/predictions";
import { analyzeVolumeProgression } from "../../store/MarathonDiagnostics";
import { FuelingProfileCard } from "../../components/Fueling";
import { OraclePanel } from "../../components/Oracle";
import WeeklyReflectionPanel from "../../components/WeeklyReflection";
import styles from "./Insights.module.scss";

export const Route = createFileRoute("/_app/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const { data: athlete } = useAthlete();
  const { data: activities, isLoading } = useActivities(1, 100);
  const { data: stravaPRs } = useStravaPRs(activities);

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

        {/* The Oracle */}
        {activities && (
          <section className={styles.oracleSection}>
            <OraclePanel activities={activities} stravaPRs={stravaPRs} />
          </section>
        )}

        {/* Training Metrics */}
        {fitnessMetrics && (
          <section className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Momentum</span>
              <span className={styles.metricValue}>
                {fitnessMetrics.momentum}
              </span>
              <span className={styles.metricCaption}>
                Rolling training volume
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Freshness</span>
              <span className={styles.metricValue}>
                {fitnessMetrics.freshness}
              </span>
              <span className={styles.metricCaption}>Recent intensity</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Readiness</span>
              <span
                className={`${styles.metricValue} ${fitnessMetrics.readiness > 0 ? styles.positive : styles.negative}`}
              >
                {fitnessMetrics.readiness > 0 ? "+" : ""}
                {fitnessMetrics.readiness}
              </span>
              <span className={styles.metricCaption}>Race potential</span>
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

        {/* Training Load Chart */}
        {chartData.length > 0 && (
          <section className={styles.chartSection}>
            <div className={styles.chartHeader}>
              <span className={styles.chartTag}>Training Load</span>
              <h2 className={styles.chartTitle}>12-Week Progression</h2>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="loadGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#111111" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#111111" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,17,17,0.08)" />
                  <XAxis
                    dataKey="week"
                    stroke="rgba(17,17,17,0.35)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(17,17,17,0.35)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#F5F2EB",
                      border: "1px solid rgba(17,17,17,0.15)",
                      borderRadius: "3px",
                      fontSize: "0.8125rem",
                      color: "#111111",
                    }}
                    labelStyle={{ color: "#111111" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="load"
                    stroke="#111111"
                    strokeWidth={1.5}
                    fill="url(#loadGradient)"
                    name="Training Load"
                  />
                </AreaChart>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,17,17,0.08)" />
                  <XAxis
                    dataKey="week"
                    stroke="rgba(17,17,17,0.35)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(17,17,17,0.35)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: "miles",
                      angle: -90,
                      position: "insideLeft",
                      fill: "rgba(17,17,17,0.4)",
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#F5F2EB",
                      border: "1px solid rgba(17,17,17,0.15)",
                      borderRadius: "3px",
                      fontSize: "0.8125rem",
                      color: "#111111",
                    }}
                    labelStyle={{ color: "#111111" }}
                  />
                  <Bar
                    dataKey="miles"
                    fill="rgba(17,17,17,0.15)"
                    radius={[2, 2, 0, 0]}
                    name="Total Miles"
                  />
                  <Bar
                    dataKey="longRun"
                    fill="#111111"
                    radius={[2, 2, 0, 0]}
                    name="Long Run"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Volume Progression Diagnostics */}
        {volumeAnalysis && volumeAnalysis.weeks.length >= 2 && (
          <section className={styles.volumeSection}>
            <div className={styles.volumeHeader}>
              <span className={styles.volumeTag}>4-Week Rolling Analysis</span>
              <h2 className={styles.volumeTitle}>Volume Diagnostics</h2>
            </div>

            {volumeAnalysis.flags.length === 0 ? (
              <div className={styles.volumeClean}>
                Volume progression within normal parameters — no flags
                triggered.
              </div>
            ) : (
              <div className={styles.volumeFlags}>
                {volumeAnalysis.flags.map((flag) => (
                  <div
                    key={flag.type}
                    className={`${styles.volumeFlag} ${flag.severity === "alert" ? styles.alert : styles.warning}`}
                  >
                    <div className={styles.flagLabel}>
                      <span className={styles.flagBadge}>
                        {flag.severity === "alert" ? "Alert" : "Warning"}
                      </span>
                    </div>
                    <p className={styles.flagMessage}>{flag.message}</p>
                    <div className={styles.flagStats}>
                      <div className={styles.flagStat}>
                        <span className={styles.flagStatVal}>
                          {flag.context.currentWeekMiles} mi
                        </span>
                        <span className={styles.flagStatKey}>This week</span>
                      </div>
                      <div className={styles.flagStat}>
                        <span className={styles.flagStatVal}>
                          {flag.context.rollingAvgMiles} mi
                        </span>
                        <span className={styles.flagStatKey}>4wk avg</span>
                      </div>
                      <div className={styles.flagStat}>
                        <span className={styles.flagStatVal}>
                          {flag.context.weekOverWeekChangePct > 0 ? "+" : ""}
                          {flag.context.weekOverWeekChangePct}%
                        </span>
                        <span className={styles.flagStatKey}>Change</span>
                      </div>
                      <div className={styles.flagStat}>
                        <span className={styles.flagStatVal}>
                          {flag.context.longRunPct}%
                        </span>
                        <span className={styles.flagStatKey}>Long run %</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

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

        {/* Weekly Reflection — The Gold Mine */}
        <section className={styles.reflectionSection}>
          <WeeklyReflectionPanel />
        </section>
      </div>
    </div>
  );
}

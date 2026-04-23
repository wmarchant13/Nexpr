/**
 * Fueling Insights Component
 * 
 * Displays fueling analysis for a single activity and aggregate patterns.
 * Uses React Query hooks for data fetching from Neon PostgreSQL.
 */

import React, { useMemo } from "react";
import type { Activity } from "../../hooks";
import { useFuelingEntry, useAllFuelingEntries, type FuelingEntry } from "../../hooks";
import type { FuelingAnalysis, FuelingProfile, FuelingInsight } from "../../store/fueling";
import { 
  analyzeFueledRun, 
  buildFuelingProfile,
  FUELING_TOOLTIP,
} from "../../store/fueling";
import styles from "./Fueling.module.scss";

// ============================================================================
// Single Activity Fueling Card
// ============================================================================

interface FuelingCardProps {
  activity: Activity;
  effortScore?: number;
}

export function FuelingCard({ activity, effortScore = 5 }: FuelingCardProps) {
  const { data: entry, isLoading } = useFuelingEntry(activity.id);
  
  const analysis = useMemo(() => {
    if (!entry) return null;
    return analyzeFueledRun(activity, entry, effortScore);
  }, [activity, entry, effortScore]);
  
  if (isLoading || !analysis) return null;
  
  const { fueling, performance, effectivenessScore, fuelingLevel, performanceCategory, insights } = analysis;
  const carbsDisplay = fueling.carbsGrams ?? (fueling.gelsCount ? fueling.gelsCount * 25 : 0);
  
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
          <span className={styles.perfValue}>{Math.round(performance.paceStability)}%</span>
        </div>
        <div className={styles.perfMetric}>
          <span className={styles.perfLabel}>Fade</span>
          <span className={`${styles.perfValue} ${performance.fadePercentage > 5 ? styles.negative : styles.positive}`}>
            {performance.fadePercentage > 0 ? "+" : ""}{performance.fadePercentage.toFixed(1)}%
          </span>
        </div>
      </div>
      
      {insights.length > 0 && (
        <div className={styles.cardInsights}>
          {insights.slice(0, 2).map(insight => (
            <div key={insight.id} className={`${styles.insight} ${styles[insight.type]}`}>
              <span className={styles.insightTitle}>{insight.title}</span>
              <span className={styles.insightDesc}>{insight.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Fueling Profile Summary
// ============================================================================

interface FuelingProfileCardProps {
  activities: Activity[];
  effortMap: Map<number, { score: number }>;
  athleteId: number;
}

export function FuelingProfileCard({ activities, effortMap, athleteId }: FuelingProfileCardProps) {
  const { data: fuelingEntries = [], isLoading } = useAllFuelingEntries(athleteId);
  
  const profile = useMemo(() => {
    return buildFuelingProfile(activities, effortMap, fuelingEntries);
  }, [activities, effortMap, fuelingEntries]);
  
  if (isLoading) {
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
          <p>No fueling data logged yet.</p>
          <p className={styles.emptyHint}>
            Log fueling on your long runs to discover what strategies work best for you.
          </p>
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
      
      {/* Optimal Ranges */}
      {(profile.optimalCarbRange || profile.optimalHydrationRange) && (
        <div className={styles.optimalSection}>
          <h4 className={styles.sectionTitle}>Your Optimal Ranges</h4>
          <div className={styles.rangeGrid}>
            {profile.optimalCarbRange && (
              <div className={styles.rangeItem}>
                <span className={styles.rangeLabel}>Carbs</span>
                <span className={styles.rangeValue}>
                  {Math.round(profile.optimalCarbRange.min)}–{Math.round(profile.optimalCarbRange.max)}g
                </span>
              </div>
            )}
            {profile.optimalHydrationRange && (
              <div className={styles.rangeItem}>
                <span className={styles.rangeLabel}>Hydration</span>
                <span className={styles.rangeValue}>
                  {Math.round(profile.optimalHydrationRange.min)}–{Math.round(profile.optimalHydrationRange.max)}ml
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Clusters Comparison */}
      {profile.clusters.length >= 2 && (
        <div className={styles.clusterSection}>
          <h4 className={styles.sectionTitle}>Performance by Fueling Level</h4>
          <div className={styles.clusterGrid}>
            {profile.clusters.slice(0, 2).map(cluster => (
              <div key={cluster.id} className={styles.clusterCard}>
                <span className={styles.clusterLabel}>{cluster.label}</span>
                <div className={styles.clusterStats}>
                  <div className={styles.clusterStat}>
                    <span className={styles.clusterValue}>{cluster.runCount}</span>
                    <span className={styles.clusterUnit}>runs</span>
                  </div>
                  <div className={styles.clusterStat}>
                    <span className={styles.clusterValue}>{Math.round(cluster.avgPaceStability)}%</span>
                    <span className={styles.clusterUnit}>stability</span>
                  </div>
                  <div className={styles.clusterStat}>
                    <span className={`${styles.clusterValue} ${cluster.avgFade > 5 ? styles.negative : ""}`}>
                      {cluster.avgFade > 0 ? "+" : ""}{cluster.avgFade.toFixed(1)}%
                    </span>
                    <span className={styles.clusterUnit}>fade</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Insights */}
      {profile.insights.length > 0 && (
        <div className={styles.insightsSection}>
          <h4 className={styles.sectionTitle}>Patterns</h4>
          <div className={styles.insightsList}>
            {profile.insights.slice(0, 3).map(insight => (
              <InsightRow key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className={styles.profileFooter}>
        <span className={styles.disclaimer}>{FUELING_TOOLTIP.notNutritionApp}</span>
      </div>
    </div>
  );
}

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

// ============================================================================
// Exports
// ============================================================================

export { FuelingInput } from "./FuelingInput";

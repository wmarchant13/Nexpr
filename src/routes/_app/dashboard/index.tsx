

import React, { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useActivities,
  useAthlete,
  useStats,
  formatPace,
  kmToMiles,
  calculateRunnerBlockStats,
  buildLifetimeRunSnapshot,
} from "../../../hooks";
import styles from "./Dashboard.module.scss";

export const Route = createFileRoute("/_app/dashboard/")({
  component: DashboardPage,
});

// Dashboard Page
function DashboardPage() {
  const {
    data: athlete,
    isLoading: athleteLoading,
    isError: athleteError,
    error: athleteQueryError,
    refetch: refetchAthlete,
  } = useAthlete();
  const {
    data: activities,
    isLoading,
    isError: activitiesError,
    error: activitiesQueryError,
    refetch: refetchActivities,
  } = useActivities(1, 100);
  const { data: stats } = useStats(athlete?.id ?? null);

  const loadError = activitiesQueryError ?? athleteQueryError;

  const runnerBlock = useMemo(() => {
    if (!activities) return null;
    return calculateRunnerBlockStats(activities, 28);
  }, [activities]);

  const recentRuns = useMemo(() => {
    if (!activities) return [];
    return activities
      .filter((a) => a.type === "Run" || a.sport_type === "Run")
      .slice(0, 6);
  }, [activities]);

  const lifetimeStats = useMemo(() => {
    if (!stats) return null;
    return buildLifetimeRunSnapshot(stats);
  }, [stats]);

  
  const dateStamp = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (isLoading || athleteLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading your training log…</p>
        </div>
      </div>
    );
  }

  if (athleteError || activitiesError) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <p>Could not load dashboard data.</p>
          {loadError instanceof Error ? <p>{loadError.message}</p> : null}
          <button
            className={styles.retryBtn}
            onClick={() => {
              void refetchAthlete();
              void refetchActivities();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {}
        <section className={styles.hero}>
          <p className={styles.dateStamp}>{dateStamp}</p>
          <h1 className={styles.heroGreeting}>
            {athlete?.firstname
              ? <>Good to see you,<br /><em className={styles.heroName}>{athlete.firstname}.</em></>
              : <>Your training log.</>}
          </h1>
        </section>

        {}
        <section className={styles.statsSection}>
          <p className={styles.statsSectionLabel}>28-Day Block</p>
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{runnerBlock?.totalMiles ?? "—"}</span>
              <span className={styles.statLabel}>Miles</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{runnerBlock?.totalRuns ?? "—"}</span>
              <span className={styles.statLabel}>Runs</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{formatPace(runnerBlock?.avgPace ?? 0)}</span>
              <span className={styles.statLabel}>Avg Pace</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{runnerBlock?.consistencyScore ?? "—"}<span className={styles.statUnit}>%</span></span>
              <span className={styles.statLabel}>Consistency</span>
            </div>
          </div>
        </section>

        {}
        <section className={styles.recentSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionTitle}>Recent Work</p>
            <Link to="/activities" className={styles.sectionLink}>View all →</Link>
          </div>

          <div className={styles.runList}>
            {recentRuns.map((activity) => {
              const miles = kmToMiles(activity.distance / 1000);
              const pace = activity.moving_time / 60 / miles;
              const stravaUrl = `https://www.strava.com/activities/${activity.id}`;
              const date = new Date(activity.start_date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <div key={activity.id} className={styles.runRow}>
                  <span className={styles.runDate}>{date}</span>
                  <a
                    href={stravaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.runNameLink}
                  >
                    <span className={styles.runName}>{activity.name}</span>
                  </a>
                  <span className={styles.runMiles}>{miles.toFixed(1)}</span>
                  <span className={styles.runPace}>{formatPace(pace)}</span>
                  <a
                    href={stravaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.runStravaLink}
                  >
                    View on Strava
                  </a>
                </div>
              );
            })}
            {recentRuns.length === 0 && (
              <p className={styles.emptyNote}>No runs recorded yet.</p>
            )}
          </div>
        </section>

        {}
        {lifetimeStats && (
          <section className={styles.lifetimeSection}>
            <p className={styles.sectionTitle}>All Time</p>
            <div className={styles.lifetimeRow}>
              <div className={styles.lifetimeStat}>
                <span className={styles.lifetimeNum}>{lifetimeStats.lifetimeMiles}</span>
                <span className={styles.lifetimeLabel}>Total Miles</span>
              </div>
              <div className={styles.lifetimeStat}>
                <span className={styles.lifetimeNum}>{lifetimeStats.lifetimeRuns}</span>
                <span className={styles.lifetimeLabel}>Total Runs</span>
              </div>
              <div className={styles.lifetimeStat}>
                <span className={styles.lifetimeNum}>{lifetimeStats.ytdMiles}</span>
                <span className={styles.lifetimeLabel}>YTD Miles</span>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}


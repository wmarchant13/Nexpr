import React, { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildLifetimeRunSnapshot,
  buildWeeklyRunVolume,
  calculate3MonthRunStats,
  calculateRunHighlights,
  calculateRunnerBlockStats,
  formatPace,
  kmToMiles,
  metersToFeet,
  useActivities,
  useAthlete,
  useLogout,
  useStats,
} from "../../hooks";
import styles from "./Dashboard.module.scss";

const chartTooltipStyles = {
  backgroundColor: "#0c1015",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
};

const chartLabelStyles = { color: "#f3f4f6" };

type MetricAccent = "orange" | "blue" | "green" | "purple" | "pink";
type RunAccent = "indigo" | "cyan" | "red";

function metricCardClass(accent: MetricAccent) {
  return `${styles.metricCard} ${styles[`metricCard${accent[0].toUpperCase()}${accent.slice(1)}`]}`;
}

function valueClass(accent: MetricAccent | RunAccent) {
  return styles[`value${accent[0].toUpperCase()}${accent.slice(1)}`];
}

function runCardClass(accent: RunAccent) {
  return `${styles.runCard} ${styles[`runCard${accent[0].toUpperCase()}${accent.slice(1)}`]}`;
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className={styles.statusPage}>
      <div className={styles.statusContent}>
        <div className={styles.spinner} />
        <p className={styles.statusText}>{message}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [page, setPage] = useState(1);
  const { data: athlete, isLoading: athleteLoading } = useAthlete();
  const { data: activities, isLoading: activitiesLoading } = useActivities(page, 200);
  const { data: stats } = useStats(athlete?.id ?? null);
  const { mutate: logout } = useLogout();

  const runStats = useMemo(
    () => (activities ? calculate3MonthRunStats(activities) : null),
    [activities],
  );

  const runnerBlock = useMemo(
    () => (activities ? calculateRunnerBlockStats(activities) : null),
    [activities],
  );

  const weeklyRunVolume = useMemo(
    () => (activities ? buildWeeklyRunVolume(activities) : []),
    [activities],
  );

  const runHighlights = useMemo(
    () => (activities ? calculateRunHighlights(activities) : []),
    [activities],
  );

  const lifetimeSnapshot = useMemo(
    () => (stats ? buildLifetimeRunSnapshot(stats) : null),
    [stats],
  );

  if (athleteLoading) {
    return <LoadingState message="Loading your profile..." />;
  }

  if (!athlete) {
    return (
      <div className={styles.statusPage}>
        <p className={styles.errorText}>Failed to load athlete data</p>
      </div>
    );
  }

  const recentActivities = activities?.slice(0, 10) || [];

  return (
    <div className={styles.page}>
      <div className={styles.pageTexture} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.profileGroup}>
            <img src={athlete.profile} alt={athlete.firstname} className={styles.avatar} />
            <div>
              <p className={styles.eyebrow}>Personal motion archive</p>
              <h1 className={styles.name}>
                {athlete.firstname} {athlete.lastname}
              </h1>
              <p className={styles.username}>@{athlete.username}</p>
            </div>
          </div>
          <button onClick={() => logout()} className={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.heroGrid}>
          <div className={styles.heroIntro}>
            <p className={styles.sectionKicker}>Dashboard</p>
            <h2 className={styles.heroTitle}>Your recent movement, clearly organized.</h2>
            <p className={styles.heroText}>
              Review recent volume, elevation, pace, and activity patterns in one place.
            </p>
            <div className={styles.heroMeta}>
              <div className={styles.heroMetaItem}>
                <span className={styles.heroMetaLabel}>Current block</span>
                <strong className={styles.heroMetaValue}>{runnerBlock?.totalMiles ?? 0} mi</strong>
              </div>
              <div className={styles.heroMetaItem}>
                <span className={styles.heroMetaLabel}>Consistency</span>
                <strong className={styles.heroMetaValue}>{runnerBlock?.consistencyScore ?? 0}%</strong>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.metricsGrid}>
          <div className={metricCardClass("orange")}>
            <p className={styles.metricLabel}>28-Day Mileage</p>
            <p className={`${styles.metricValue} ${valueClass("orange")}`}>
              {runnerBlock?.totalMiles || 0}
            </p>
            <p className={styles.metricCaption}>miles</p>
          </div>

          <div className={metricCardClass("blue")}>
            <p className={styles.metricLabel}>Run Days</p>
            <p className={`${styles.metricValue} ${valueClass("blue")}`}>{runnerBlock?.runDays || 0}</p>
            <p className={styles.metricCaption}>days in 4 weeks</p>
          </div>

          <div className={metricCardClass("green")}>
            <p className={styles.metricLabel}>Average Pace</p>
            <p className={`${styles.metricValue} ${valueClass("green")}`}>
              {formatPace(runnerBlock?.avgPace || 0)}
            </p>
            <p className={styles.metricCaption}>per mile</p>
          </div>

          <div className={metricCardClass("purple")}>
            <p className={styles.metricLabel}>Long Run</p>
            <p className={`${styles.metricValue} ${valueClass("purple")}`}>
              {runnerBlock?.longRunMiles || 0}
            </p>
            <p className={styles.metricCaption}>miles in 28 days</p>
          </div>

          <div className={metricCardClass("pink")}>
            <p className={styles.metricLabel}>Climbing</p>
            <p className={`${styles.metricValue} ${valueClass("pink")}`}>
              {runnerBlock?.elevationFeet || 0}
            </p>
            <p className={styles.metricCaption}>feet in 28 days</p>
          </div>
        </div>

        {runStats && runStats.totalRuns > 0 && (
          <div className={styles.runStatsGrid}>
            <div className={runCardClass("indigo")}>
              <p className={styles.metricLabel}>Weekly Average</p>
              <p className={`${styles.metricValue} ${valueClass("indigo")}`}>{runnerBlock?.weeklyAverageMiles || 0}</p>
              <p className={styles.metricCaption}>miles per week</p>
            </div>

            <div className={runCardClass("cyan")}>
              <p className={styles.metricLabel}>3-Month Runs</p>
              <p className={`${styles.metricValue} ${valueClass("cyan")}`}>{runStats.totalRuns}</p>
              <p className={styles.metricCaption}>run workouts</p>
            </div>

            <div className={runCardClass("red")}>
              <p className={styles.metricLabel}>Average Run Distance</p>
              <p className={`${styles.metricValue} ${valueClass("red")}`}>{runStats.avgDistance}</p>
              <p className={styles.metricCaption}>miles per run</p>
            </div>
          </div>
        )}

        {lifetimeSnapshot && (
          <section className={styles.snapshotGrid}>
            <div className={styles.panel}>
              <div className={styles.chartHeader}>
                <span className={styles.chartTag}>Strava stats</span>
                <h2 className={styles.panelTitle}>Running Totals</h2>
              </div>
              <div className={styles.snapshotCards}>
                <div className={styles.snapshotCard}>
                  <span className={styles.snapshotLabel}>Last 4 Weeks</span>
                  <strong className={styles.snapshotValue}>{lifetimeSnapshot.recentMiles} mi</strong>
                  <span className={styles.snapshotDetail}>{lifetimeSnapshot.recentRuns} runs</span>
                </div>
                <div className={styles.snapshotCard}>
                  <span className={styles.snapshotLabel}>Year to Date</span>
                  <strong className={styles.snapshotValue}>{lifetimeSnapshot.ytdMiles} mi</strong>
                  <span className={styles.snapshotDetail}>{lifetimeSnapshot.ytdRuns} runs</span>
                </div>
                <div className={styles.snapshotCard}>
                  <span className={styles.snapshotLabel}>Lifetime</span>
                  <strong className={styles.snapshotValue}>{lifetimeSnapshot.lifetimeMiles} mi</strong>
                  <span className={styles.snapshotDetail}>{lifetimeSnapshot.lifetimeRuns} runs</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {runHighlights.length > 0 && (
          <section className={styles.snapshotGrid}>
            <div className={styles.panel}>
              <div className={styles.chartHeader}>
                <span className={styles.chartTag}>Best recent efforts</span>
                <h2 className={styles.panelTitle}>Runner Notes</h2>
              </div>
              <div className={styles.snapshotCards}>
                {runHighlights.map((highlight) => (
                  <div key={highlight.label} className={styles.snapshotCard}>
                    <span className={styles.snapshotLabel}>{highlight.label}</span>
                    <strong className={styles.snapshotValue}>{highlight.value}</strong>
                    <span className={styles.snapshotDetail}>{highlight.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {!activitiesLoading && weeklyRunVolume.length > 0 && (
          <div className={styles.chartGrid}>
            <div className={styles.panel}>
              <div className={styles.chartHeader}>
                <span className={styles.chartTag}>Training block</span>
                <h2 className={styles.panelTitle}>8-Week Run Volume</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={weeklyRunVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={chartTooltipStyles}
                    labelStyle={chartLabelStyles}
                    formatter={(value: any, name: string) =>
                      name && /pace/i.test(name) ? formatPace(Number(value)) : value
                    }
                  />
                  <Legend />
                  <Bar dataKey="miles" fill="#00ffa3" name="Mileage" radius={[8, 8, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="runs"
                    stroke="#3b82f6"
                    name="Runs"
                    yAxisId="right"
                    strokeWidth={3}
                  />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.panel}>
              <div className={styles.chartHeader}>
                <span className={styles.chartTag}>Weekly shape</span>
                <h2 className={styles.panelTitle}>Long Run and Pace Trend</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={weeklyRunVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={chartTooltipStyles}
                    labelStyle={chartLabelStyles}
                    formatter={(value: any, name: string) =>
                      name && /pace/i.test(name) ? formatPace(Number(value)) : value
                    }
                  />
                  <Legend />
                  <Bar dataKey="longRun" fill="#60a5fa" name="Long run (mi)" radius={[8, 8, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="avgPace"
                    stroke="#bef264"
                    name="Avg pace (min/mi)"
                    yAxisId="right"
                    strokeWidth={3}
                  />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.chartTag}>Field notes</span>
              <h2 className={styles.panelTitle}>Recent Activities</h2>
            </div>
          </div>

          {activitiesLoading ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>Loading activities...</p>
            </div>
          ) : recentActivities.length > 0 ? (
            <div className={styles.activityList}>
              {recentActivities.map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={styles.activityTop}>
                    <div className={styles.activityInfo}>
                      <h3 className={styles.activityName}>{activity.name}</h3>
                      <p className={styles.activityMeta}>
                        {new Date(activity.start_date).toLocaleDateString()}{" "}
                        <span className={styles.metaDivider}>•</span>
                        <span className={styles.activityType}>{activity.type}</span>
                      </p>
                    </div>
                    <span className={styles.activityBadge}>{activity.sport_type}</span>
                  </div>

                  <div className={styles.activityStatsGrid}>
                    <div className={styles.activityStatCard}>
                      <p className={styles.activityStatLabel}>Distance</p>
                      <p className={styles.activityStatValue}>{kmToMiles(activity.distance / 1000)} mi</p>
                    </div>
                    <div className={styles.activityStatCard}>
                      <p className={styles.activityStatLabel}>Elevation</p>
                      <p className={styles.activityStatValue}>
                        {metersToFeet(activity.total_elevation_gain)} ft
                      </p>
                    </div>
                    <div className={styles.activityStatCard}>
                      <p className={styles.activityStatLabel}>Time</p>
                      <p className={styles.activityStatValue}>{Math.round(activity.moving_time / 60)} min</p>
                    </div>
                    <div className={styles.activityStatCard}>
                      <p className={styles.activityStatLabel}>Pace</p>
                      <p className={styles.activityStatValue}>
                        {formatPace(activity.moving_time / 60 / kmToMiles(activity.distance / 1000))}/mi
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>No activities found</p>
            </div>
          )}

          {recentActivities.length > 0 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className={styles.paginationButton}
              >
                Previous
              </button>
              <span className={styles.paginationLabel}>Page {page}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={!activities || activities.length < 100}
                className={styles.paginationButton}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

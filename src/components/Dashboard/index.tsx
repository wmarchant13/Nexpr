import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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
  aggregate3MonthData,
  calculate3MonthRunStats,
  calculateActivityStats,
  kmToMiles,
  metersToFeet,
  useActivities,
  useAthlete,
  useLogout,
  useStats,
} from "../../hooks";
import styles from "./Dashboard.module.scss";

const chartTooltipStyles = {
  backgroundColor: "#1f2937",
  border: "1px solid #374151",
  borderRadius: "8px",
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
  const { data: activities, isLoading: activitiesLoading } = useActivities(page, 100);
  useStats(athlete?.id ?? null);
  const { mutate: logout } = useLogout();

  const chartData = useMemo(
    () => (activities ? aggregate3MonthData(activities) : []),
    [activities],
  );

  const activityStats = useMemo(
    () => (activities ? calculateActivityStats(activities) : null),
    [activities],
  );

  const runStats = useMemo(
    () => (activities ? calculate3MonthRunStats(activities) : null),
    [activities],
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
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.profileGroup}>
            <img src={athlete.profile} alt={athlete.firstname} className={styles.avatar} />
            <div>
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
        <div className={styles.metricsGrid}>
          <div className={metricCardClass("orange")}>
            <p className={styles.metricLabel}>Total Distance</p>
            <p className={`${styles.metricValue} ${valueClass("orange")}`}>
              {activityStats?.totalDistance || 0}
            </p>
            <p className={styles.metricCaption}>miles</p>
          </div>

          <div className={metricCardClass("blue")}>
            <p className={styles.metricLabel}>Activities</p>
            <p className={`${styles.metricValue} ${valueClass("blue")}`}>{activities?.length || 0}</p>
            <p className={styles.metricCaption}>total workouts</p>
          </div>

          <div className={metricCardClass("green")}>
            <p className={styles.metricLabel}>Moving Time</p>
            <p className={`${styles.metricValue} ${valueClass("green")}`}>
              {activityStats?.totalTime || 0}
            </p>
            <p className={styles.metricCaption}>hours</p>
          </div>

          <div className={metricCardClass("purple")}>
            <p className={styles.metricLabel}>Elevation Gain</p>
            <p className={`${styles.metricValue} ${valueClass("purple")}`}>
              {activityStats?.totalElevation || 0}
            </p>
            <p className={styles.metricCaption}>feet</p>
          </div>

          <div className={metricCardClass("pink")}>
            <p className={styles.metricLabel}>Avg Distance</p>
            <p className={`${styles.metricValue} ${valueClass("pink")}`}>
              {activityStats?.avgDistance || 0}
            </p>
            <p className={styles.metricCaption}>miles / activity</p>
          </div>
        </div>

        {runStats && runStats.totalRuns > 0 && (
          <div className={styles.runStatsGrid}>
            <div className={runCardClass("indigo")}>
              <p className={styles.metricLabel}>3-Month Runs</p>
              <p className={`${styles.metricValue} ${valueClass("indigo")}`}>{runStats.totalRuns}</p>
              <p className={styles.metricCaption}>run workouts</p>
            </div>

            <div className={runCardClass("cyan")}>
              <p className={styles.metricLabel}>Avg Run Distance</p>
              <p className={`${styles.metricValue} ${valueClass("cyan")}`}>{runStats.avgDistance}</p>
              <p className={styles.metricCaption}>miles per run</p>
            </div>

            <div className={runCardClass("red")}>
              <p className={styles.metricLabel}>Avg Running Pace</p>
              <p className={`${styles.metricValue} ${valueClass("red")}`}>{runStats.avgPace}'</p>
              <p className={styles.metricCaption}>minutes per mile</p>
            </div>
          </div>
        )}

        {!activitiesLoading && chartData.length > 0 && (
          <div className={styles.chartGrid}>
            <div className={styles.panel}>
              <h2 className={styles.panelTitle}>3-Month Mileage</h2>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={chartTooltipStyles} labelStyle={chartLabelStyles} />
                  <Legend />
                  <Bar dataKey="distance" fill="#f97316" name="Distance (mi)" radius={[8, 8, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="activities"
                    stroke="#3b82f6"
                    name="Activities"
                    yAxisId="right"
                    strokeWidth={3}
                  />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.panel}>
              <h2 className={styles.panelTitle}>Elevation Gain by Month</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={chartTooltipStyles} labelStyle={chartLabelStyles} />
                  <Legend />
                  <Bar dataKey="elevation" fill="#a855f7" name="Elevation (ft)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Recent Activities</h2>
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
                        {(activity.moving_time / 60 / kmToMiles(activity.distance / 1000)).toFixed(1)}'
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

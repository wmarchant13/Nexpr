

import React, { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useActivities,
  useActivityWebhookSync,
  useAthlete,
  formatPace,
  kmToMiles,
  metersToFeet,
  useSymptomEntries,
  useSaveSymptomEntry,
  useDeleteSymptomEntry,
} from "../../hooks";
import { FuelingInput, FuelingCard } from "../../components/Fueling";
import SymptomLog from "../../components/SymptomLog";
import type { SymptomEntry } from "../../store/symptomLog";
import styles from "./Activities.module.scss";

export const Route = createFileRoute("/_app/activities")({
  component: ActivitiesPage,
});

type SortField = "date" | "distance" | "pace" | "elevation";

// Activities list page with fueling and symptom log per run
function ActivitiesPage() {
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openSymptomId, setOpenSymptomId] = useState<number | null>(null);
  const { data: athlete } = useAthlete();
  useActivityWebhookSync();
  const { data: activities, isLoading } = useActivities(page, 100);
  const { data: symptomEntries = [] } = useSymptomEntries(athlete?.id);
  const saveSymptomMutation = useSaveSymptomEntry();
  const deleteSymptomMutation = useDeleteSymptomEntry();

  const filteredAndSorted = useMemo(() => {
    if (!activities) return [];

    
    let result = activities.filter(
      (a) => a.type === "Run" || a.sport_type === "Run",
    );

    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(query));
    }

    
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison =
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
          break;
        case "distance":
          comparison = b.distance - a.distance;
          break;
        case "pace":
          const paceA = a.moving_time / a.distance;
          const paceB = b.moving_time / b.distance;
          comparison = paceA - paceB; 
          break;
        case "elevation":
          comparison = b.total_elevation_gain - a.total_elevation_gain;
          break;
      }

      return sortAsc ? -comparison : comparison;
    });

    return result;
  }, [activities, sortField, sortAsc, searchQuery]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortAsc(!sortAsc);
      } else {
        setSortField(field);
        setSortAsc(false);
      }
    },
    [sortField, sortAsc],
  );

  const handleSaveSymptom = useCallback(
    (entry: SymptomEntry) => {
      if (!athlete?.id) return;
      saveSymptomMutation.mutate({ ...entry, athleteId: athlete.id });
    },
    [athlete?.id, saveSymptomMutation],
  );

  const handleDeleteSymptom = useCallback(
    (id: string) => {
      if (!athlete?.id) return;
      deleteSymptomMutation.mutate({ id, athleteId: athlete.id });
    },
    [athlete?.id, deleteSymptomMutation],
  );

  const runCount = filteredAndSorted.length;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <span className={styles.kicker}>Run Log</span>
            <h1 className={styles.title}>Your Runs</h1>
            <p className={styles.subtitle}>{runCount} runs</p>
          </div>
        </header>

        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <svg
              className={styles.searchIcon}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filters}>
            <div className={styles.sortButtons}>
              {(["date", "distance", "pace", "elevation"] as SortField[]).map(
                (field) => (
                  <button
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`${styles.sortButton} ${sortField === field ? styles.active : ""}`}
                  >
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                    {sortField === field && (
                      <span className={styles.sortArrow}>
                        {sortAsc ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading activities...</p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No activities found</p>
          </div>
        ) : (
          <div className={styles.activityList}>
            {filteredAndSorted.map((activity) => {
              const miles = kmToMiles(activity.distance / 1000);
              const pace = activity.moving_time / 60 / miles;
              const elevation = metersToFeet(activity.total_elevation_gain);
              const duration = Math.round(activity.moving_time / 60);

              return (
                <article key={activity.id} className={styles.activityCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.activityDate}>
                      {new Date(activity.start_date).toLocaleDateString(
                        "en-US",
                        { weekday: "short", month: "short", day: "numeric" },
                      )}
                    </span>
                    <div className={styles.cardInfo}>
                      <h3 className={styles.activityName}>{activity.name}</h3>
                      {/garmin/i.test(activity.device_name ?? "") && (
                        <span className={styles.deviceBadge}>Garmin</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.statsGrid}>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{miles.toFixed(1)} mi</span>
                      <span className={styles.statLabel}>Distance</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{formatPace(pace)}</span>
                      <span className={styles.statLabel}>Pace /mi</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{duration} min</span>
                      <span className={styles.statLabel}>Duration</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{elevation} ft</span>
                      <span className={styles.statLabel}>Elevation</span>
                    </div>
                  </div>

                  {}
                  {athlete && (
                    <FuelingInput
                      activityId={activity.id}
                      athleteId={athlete.id}
                      distanceMiles={miles}
                    />
                  )}

                  {}
                  <FuelingCard activity={activity} />

                  {}
                  <div className={styles.symptomToggleRow}>
                    <button
                      className={`${styles.symptomToggleBtn} ${openSymptomId === activity.id ? styles.active : ""}`}
                      onClick={() =>
                        setOpenSymptomId(
                          openSymptomId === activity.id ? null : activity.id,
                        )
                      }
                    >
                      {openSymptomId === activity.id ? "▲" : "▼"} Stress Log
                      {symptomEntries.filter(
                        (e) => e.activityId === String(activity.id),
                      ).length > 0 && (
                        <span>
                          {" "}
                          ·{" "}
                          {
                            symptomEntries.filter(
                              (e) => e.activityId === String(activity.id),
                            ).length
                          }
                        </span>
                      )}
                    </button>
                  </div>

                  {openSymptomId === activity.id && (
                    <div className={styles.symptomLogWrapper}>
                      <SymptomLog
                        activityId={String(activity.id)}
                        activityDate={
                          activity.start_date_local?.slice(0, 10) ??
                          activity.start_date.slice(0, 10)
                        }
                        existingEntries={symptomEntries}
                        onSave={handleSaveSymptom}
                        onDelete={handleDeleteSymptom}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <div className={styles.pagination}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className={styles.pageButton}
          >
            ← Previous
          </button>
          <span className={styles.pageInfo}>Page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={!activities || activities.length < 100}
            className={styles.pageButton}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from "react";
import {
  getCurrentWeekStart,
  formatWeekLabel,
  newReflectionId,
  type WeeklyReflection,
} from "../../store/weeklyReflection";
import {
  useAthlete,
  useReflections,
  useSaveReflection,
  useDeleteReflection,
} from "../../hooks";
import styles from "./WeeklyReflection.module.scss";

// ─── COMPONENT ───────────────────────────────────────────────────────────────

function WeeklyReflectionPanel() {
  const { data: athlete } = useAthlete();
  const { data: reflections = [] } = useReflections(athlete?.id);
  const saveReflectionMutation = useSaveReflection();
  const deleteReflectionMutation = useDeleteReflection();

  const currentWeekStart = useMemo(() => getCurrentWeekStart(), []);

  const thisWeeksEntry = useMemo(
    () => reflections.find((r) => r.weekStart === currentWeekStart) ?? null,
    [reflections, currentWeekStart],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state — seeded from existing entry when editing
  const [feltBetter, setFeltBetter] = useState(
    thisWeeksEntry?.whatFeltBetter ?? "",
  );
  const [feltWorse, setFeltWorse] = useState(
    thisWeeksEntry?.whatFeltWorse ?? "",
  );
  const [warningSigns, setWarningSigns] = useState(
    thisWeeksEntry?.warningSigns ?? "",
  );
  const [changeNext, setChangeNext] = useState(
    thisWeeksEntry?.changeNextWeek ?? "",
  );
  const [justSaved, setJustSaved] = useState(false);

  function openForm() {
    setFeltBetter(thisWeeksEntry?.whatFeltBetter ?? "");
    setFeltWorse(thisWeeksEntry?.whatFeltWorse ?? "");
    setWarningSigns(thisWeeksEntry?.warningSigns ?? "");
    setChangeNext(thisWeeksEntry?.changeNextWeek ?? "");
    setIsEditing(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!athlete?.id) return;

    saveReflectionMutation.mutate(
      {
        id: thisWeeksEntry?.id ?? newReflectionId(),
        athleteId: athlete.id,
        weekStart: currentWeekStart,
        whatFeltBetter: feltBetter.trim(),
        whatFeltWorse: feltWorse.trim(),
        warningSigns: warningSigns.trim(),
        changeNextWeek: changeNext.trim(),
        createdAt: thisWeeksEntry?.createdAt ?? Date.now(),
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          setJustSaved(true);
          setTimeout(() => setJustSaved(false), 2500);
        },
      },
    );
  }

  function handleDelete(weekStart: string) {
    if (!athlete?.id) return;
    deleteReflectionMutation.mutate({ weekStart, athleteId: athlete.id });
    if (
      expandedId &&
      reflections.find((r) => r.weekStart === weekStart)?.id === expandedId
    ) {
      setExpandedId(null);
    }
  }

  const pastReflections = useMemo(
    () => reflections.filter((r) => r.weekStart !== currentWeekStart),
    [reflections, currentWeekStart],
  );

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Weekly Reflection</span>
          <h2 className={styles.title}>The Gold Mine</h2>
          <p className={styles.desc}>
            Once a week, connect the dots across Running, Strength &amp;
            Recovery. Private — diagnostic only.
          </p>
        </div>
        {!isEditing && (
          <button
            className={styles.primaryBtn}
            onClick={openForm}
            type="button"
          >
            {thisWeeksEntry ? "Edit This Week" : "Write This Week"}
          </button>
        )}
      </header>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      {isEditing && (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.formWeekLabel}>
            Week of {formatWeekLabel(currentWeekStart)}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              <span className={styles.labelIcon}>↑</span>
              What felt <em>better</em> this week?
            </label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="Running cadence, leg spring, sleep quality, motivation..."
              value={feltBetter}
              onChange={(e) => setFeltBetter(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              <span className={styles.labelIcon}>↓</span>
              What felt <em>worse</em>?
            </label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="Heavy legs, tightness, low energy, disrupted sleep..."
              value={feltWorse}
              onChange={(e) => setFeltWorse(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              <span className={styles.labelIcon}>⚑</span>
              Any small warning signs?
            </label>
            <textarea
              className={styles.textarea}
              rows={2}
              placeholder="Minor pain, mood changes, unusual fatigue..."
              value={warningSigns}
              onChange={(e) => setWarningSigns(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              <span className={styles.labelIcon}>→</span>
              One change for next week
            </label>
            <textarea
              className={styles.textarea}
              rows={2}
              placeholder="Add a second easy day, reduce long run, prioritise sleep..."
              value={changeNext}
              onChange={(e) => setChangeNext(e.target.value)}
            />
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn}>
              Save Reflection
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
            {justSaved && (
              <span className={styles.savedMsg} role="status">
                Saved.
              </span>
            )}
          </div>
        </form>
      )}

      {/* ── This week's saved entry ───────────────────────────────────────── */}
      {!isEditing && thisWeeksEntry && (
        <div className={styles.currentEntry}>
          <div className={styles.entryWeekLabel}>
            Week of {formatWeekLabel(thisWeeksEntry.weekStart)}
          </div>
          <div className={styles.quadrant}>
            <div className={styles.quadItem}>
              <span className={styles.quadLabel}>
                <span className={styles.labelIcon}>↑</span> Better
              </span>
              <p className={styles.quadText}>
                {thisWeeksEntry.whatFeltBetter || "—"}
              </p>
            </div>
            <div className={styles.quadItem}>
              <span className={styles.quadLabel}>
                <span className={styles.labelIcon}>↓</span> Worse
              </span>
              <p className={styles.quadText}>
                {thisWeeksEntry.whatFeltWorse || "—"}
              </p>
            </div>
            <div className={styles.quadItem}>
              <span className={styles.quadLabel}>
                <span className={styles.labelIcon}>⚑</span> Warning Signs
              </span>
              <p className={styles.quadText}>
                {thisWeeksEntry.warningSigns || "—"}
              </p>
            </div>
            <div className={styles.quadItem}>
              <span className={styles.quadLabel}>
                <span className={styles.labelIcon}>→</span> Change Next Week
              </span>
              <p className={styles.quadText}>
                {thisWeeksEntry.changeNextWeek || "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── No entry yet prompt ───────────────────────────────────────────── */}
      {!isEditing && !thisWeeksEntry && (
        <div className={styles.emptyState}>
          <p>No reflection logged for this week yet.</p>
          <p className={styles.emptyHint}>
            Takes 2 minutes. Patterns only surface when you write them down.
          </p>
        </div>
      )}

      {/* ── Past reflections ──────────────────────────────────────────────── */}
      {pastReflections.length > 0 && (
        <div className={styles.history}>
          <h3 className={styles.historyTitle}>Past Reflections</h3>
          <ul className={styles.historyList}>
            {pastReflections.map((r) => {
              const open = expandedId === r.id;
              return (
                <li key={r.id} className={styles.historyItem}>
                  <div className={styles.historyItemHeader}>
                    <button
                      type="button"
                      className={styles.historyToggle}
                      onClick={() => setExpandedId(open ? null : r.id)}
                      aria-expanded={open}
                    >
                      <span className={styles.historyWeek}>
                        Week of {formatWeekLabel(r.weekStart)}
                      </span>
                      <span
                        className={`${styles.historyChevron} ${open ? styles.open : ""}`}
                        aria-hidden="true"
                      >
                        ›
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.historyDeleteBtn}
                      onClick={() => handleDelete(r.weekStart)}
                      aria-label={`Delete reflection for week of ${formatWeekLabel(r.weekStart)}`}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                  {open && (
                    <div className={styles.historyBody}>
                      <div className={styles.quadrant}>
                        <div className={styles.quadItem}>
                          <span className={styles.quadLabel}>
                            <span className={styles.labelIcon}>↑</span> Better
                          </span>
                          <p className={styles.quadText}>
                            {r.whatFeltBetter || "—"}
                          </p>
                        </div>
                        <div className={styles.quadItem}>
                          <span className={styles.quadLabel}>
                            <span className={styles.labelIcon}>↓</span> Worse
                          </span>
                          <p className={styles.quadText}>
                            {r.whatFeltWorse || "—"}
                          </p>
                        </div>
                        <div className={styles.quadItem}>
                          <span className={styles.quadLabel}>
                            <span className={styles.labelIcon}>⚑</span> Warning
                            Signs
                          </span>
                          <p className={styles.quadText}>
                            {r.warningSigns || "—"}
                          </p>
                        </div>
                        <div className={styles.quadItem}>
                          <span className={styles.quadLabel}>
                            <span className={styles.labelIcon}>→</span> Change
                            Next Week
                          </span>
                          <p className={styles.quadText}>
                            {r.changeNextWeek || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default WeeklyReflectionPanel;

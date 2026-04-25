import React, { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  getCurrentWeekStart,
  formatWeekLabel,
  newReflectionId,
} from "../../../store/weeklyReflection";
import {
  useAthlete,
  useReflections,
  useSaveReflection,
  useDeleteReflection,
} from "../../../hooks";
import styles from "./Journal.module.scss";

export const Route = createFileRoute("/_app/journal/")({
  component: JournalPage,
});

// Weekly reflection journal page
function JournalPage() {
  const { data: athlete } = useAthlete();
  const { data: reflections = [], isLoading } = useReflections(athlete?.id);
  const saveReflection = useSaveReflection();
  const deleteReflection = useDeleteReflection();

  const currentWeekStart = useMemo(() => getCurrentWeekStart(), []);

  const thisWeeksEntry = useMemo(
    () => reflections.find((r) => r.weekStart === currentWeekStart) ?? null,
    [reflections, currentWeekStart],
  );

  const pastEntries = useMemo(
    () =>
      [...reflections]
        .filter((r) => r.weekStart !== currentWeekStart)
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [reflections, currentWeekStart],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [feltBetter, setFeltBetter] = useState("");
  const [feltWorse, setFeltWorse] = useState("");
  const [warningSigns, setWarningSigns] = useState("");
  const [changeNext, setChangeNext] = useState("");

  // Open Form
  function openForm() {
    setFeltBetter(thisWeeksEntry?.whatFeltBetter ?? "");
    setFeltWorse(thisWeeksEntry?.whatFeltWorse ?? "");
    setWarningSigns(thisWeeksEntry?.warningSigns ?? "");
    setChangeNext(thisWeeksEntry?.changeNextWeek ?? "");
    setIsEditing(true);
  }

  // Handles submit
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!athlete?.id) return;

    saveReflection.mutate(
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

  // Handles delete
  function handleDelete(weekStart: string) {
    if (!athlete?.id) return;
    deleteReflection.mutate(
      { weekStart, athleteId: athlete.id },
      {
        onSuccess: () => {
          if (weekStart === currentWeekStart) {
            setIsEditing(false);
            setFeltBetter("");
            setFeltWorse("");
            setWarningSigns("");
            setChangeNext("");
          }
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading journal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.kicker}>Weekly Check-in</span>
          <h1 className={styles.title}>Training Journal</h1>
          <p className={styles.subtitle}>
            A private log of how each week felt — patterns only you can see.
          </p>
        </header>

        <section className={styles.thisWeekSection}>
          <div className={styles.thisWeekHeader}>
            <div>
              <span className={styles.thisWeekLabel}>This Week</span>
              <span className={styles.thisWeekDate}>
                {formatWeekLabel(currentWeekStart)}
              </span>
            </div>
            {!isEditing && (
              <button className={styles.writeButton} onClick={openForm}>
                {thisWeeksEntry ? "Edit" : "Write Entry"}
              </button>
            )}
          </div>

          {isEditing ? (
            <form className={styles.entryForm} onSubmit={handleSubmit}>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>What felt better?</label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    placeholder="Legs felt springy, breathing easier…"
                    value={feltBetter}
                    onChange={(e) => setFeltBetter(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>What felt worse?</label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    placeholder="Left knee tight after the long run…"
                    value={feltWorse}
                    onChange={(e) => setFeltWorse(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    Warning signs to watch
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    placeholder="Sleep was off, motivation low mid-week…"
                    value={warningSigns}
                    onChange={(e) => setWarningSigns(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    One change next week
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    placeholder="Cut Tuesday pace down, add 10 min warm-up…"
                    value={changeNext}
                    onChange={(e) => setChangeNext(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.saveButton}>
                  {saveReflection.isPending ? "Saving…" : "Save Entry"}
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : thisWeeksEntry ? (
            <div className={styles.currentEntry}>
              <ReflectionBody entry={thisWeeksEntry} />
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => handleDelete(thisWeeksEntry.weekStart)}
              >
                Delete entry
              </button>
            </div>
          ) : (
            <div className={styles.emptyThis}>
              <p>No entry yet for this week.</p>
            </div>
          )}

          {justSaved && <p className={styles.savedNote}>Entry saved.</p>}
        </section>

        {pastEntries.length > 0 && (
          <section className={styles.pastSection}>
            <h2 className={styles.pastTitle}>Past Entries</h2>
            <div className={styles.entryList}>
              {pastEntries.map((entry) => {
                const isOpen = expandedId === entry.id;
                return (
                  <div key={entry.id} className={styles.entryCard}>
                    <button
                      className={styles.entryCardHeader}
                      onClick={() => setExpandedId(isOpen ? null : entry.id)}
                    >
                      <span className={styles.entryWeek}>
                        Week of {formatWeekLabel(entry.weekStart)}
                      </span>
                      <span className={styles.entryChevron}>
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className={styles.entryBody}>
                        <ReflectionBody entry={entry} />
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => handleDelete(entry.weekStart)}
                        >
                          Delete entry
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {reflections.length === 0 && (
          <div className={styles.emptyState}>
            <p>Your journal is empty.</p>
            <p className={styles.emptyHint}>
              Write your first entry above — it only takes a minute.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ReflectionBodyProps {
  entry: {
    whatFeltBetter: string;
    whatFeltWorse: string;
    warningSigns: string;
    changeNextWeek: string;
  };
}

// Reflection Body
function ReflectionBody({ entry }: ReflectionBodyProps) {
  const rows = [
    { label: "Better", value: entry.whatFeltBetter },
    { label: "Worse", value: entry.whatFeltWorse },
    { label: "Watch for", value: entry.warningSigns },
    { label: "Change", value: entry.changeNextWeek },
  ].filter((r) => r.value.trim().length > 0);

  if (rows.length === 0) return null;

  return (
    <dl className={styles.reflectionDl}>
      {rows.map((r) => (
        <div key={r.label} className={styles.reflectionRow}>
          <dt className={styles.reflectionTerm}>{r.label}</dt>
          <dd className={styles.reflectionDef}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

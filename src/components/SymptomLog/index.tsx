import React, { useState, useMemo } from "react";
import {
  SYMPTOM_TRIGGERS,
  TRIGGER_LABELS,
  WARMUP_BEHAVIORS,
  WARMUP_BEHAVIOR_LABELS,
  detectStructuralAlerts,
  newSymptomId,
  type SymptomEntry,
  type SymptomTrigger,
  type WarmUpBehavior,
} from "../../store/symptomLog";
import styles from "./SymptomLog.module.scss";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface SymptomLogProps {
  /** Strava activity UUID (not the raw numeric ID — never in URLs). */
  activityId: string;
  /** ISO date string for the activity being annotated. */
  activityDate: string;
  /** Full symptom history — used for structural alert detection. */
  existingEntries?: SymptomEntry[];
  /** Called with the completed entry on successful submission. */
  onSave: (entry: SymptomEntry) => void;
  /** Called with the entry ID to delete. */
  onDelete?: (id: string) => void;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PAIN_SCALE_LABELS: Record<number, string> = {
  1: "Minimal",
  2: "Mild",
  3: "Moderate",
  4: "Significant",
  5: "Severe",
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────

function SymptomLog({
  activityId,
  activityDate,
  existingEntries = [],
  onSave,
  onDelete,
}: SymptomLogProps) {
  const [location, setLocation] = useState("");
  const [trigger, setTrigger] = useState<SymptomTrigger>("DOWNHILLS");
  const [warmUpBehavior, setWarmUpBehavior] = useState<WarmUpBehavior>("FADES");
  const [painScale, setPainScale] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [notes, setNotes] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Only show alerts for triggered (>= 3/5) locations
  const triggeredAlerts = useMemo(
    () => detectStructuralAlerts(existingEntries).filter((a) => a.triggered),
    [existingEntries],
  );

  // Entries for this specific activity (shown below the form as a log)
  const activityEntries = useMemo(
    () => existingEntries.filter((e) => e.activityId === activityId),
    [existingEntries, activityId],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!location.trim()) {
      setLocationError("Specify the anatomical location.");
      return;
    }

    setLocationError(null);

    onSave({
      id: newSymptomId(),
      activityId,
      date: activityDate,
      location: location.trim(),
      trigger,
      warmUpBehavior,
      painScale,
      notes: notes.trim() || undefined,
    });

    // Reset form
    setLocation("");
    setNotes("");
    setPainScale(1);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  return (
    <div className={styles.root}>
      {/* ── Structural Alert Banner ─────────────────────────────────────── */}
      {triggeredAlerts.length > 0 && (
        <div className={styles.alertBanner} role="alert" aria-live="polite">
          <span className={styles.alertIcon} aria-hidden="true">
            !
          </span>
          <div className={styles.alertBody}>
            <span className={styles.alertTitle}>Structural Alert</span>
            {triggeredAlerts.map((a) => (
              <span key={a.location} className={styles.alertLocation}>
                {a.location} — flagged in {a.recentOccurrences} of last 5
                sessions
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Mechanical Stress Form ──────────────────────────────────────── */}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <header className={styles.formHeader}>
          <span className={styles.formKicker}>Mechanical Stress Log</span>
          <p className={styles.formDesc}>
            Log specific stress points to surface recurring injury patterns.
          </p>
        </header>

        {/* Location */}
        <div className={styles.field}>
          <label htmlFor="symptom-location" className={styles.label}>
            Anatomical Location
          </label>
          <input
            id="symptom-location"
            type="text"
            className={`${styles.input} ${locationError ? styles.inputError : ""}`}
            placeholder="e.g. Right Lateral Patella"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setLocationError(null);
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {locationError && (
            <span className={styles.errorMsg} role="alert">
              {locationError}
            </span>
          )}
        </div>

        {/* Trigger */}
        <div className={styles.field}>
          <label htmlFor="symptom-trigger" className={styles.label}>
            Trigger
          </label>
          <select
            id="symptom-trigger"
            className={styles.select}
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as SymptomTrigger)}
          >
            {SYMPTOM_TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {TRIGGER_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Warm-up Behaviour */}
        <div className={styles.field}>
          <label htmlFor="symptom-warmup" className={styles.label}>
            Warm-up Behaviour
          </label>
          <select
            id="symptom-warmup"
            className={styles.select}
            value={warmUpBehavior}
            onChange={(e) =>
              setWarmUpBehavior(e.target.value as WarmUpBehavior)
            }
          >
            {WARMUP_BEHAVIORS.map((b) => (
              <option key={b} value={b}>
                {WARMUP_BEHAVIOR_LABELS[b]}
              </option>
            ))}
          </select>
        </div>

        {/* Pain Scale */}
        <div className={styles.field}>
          <span className={styles.label} id="pain-scale-label">
            Pain Scale
          </span>
          <div
            className={styles.painRow}
            role="group"
            aria-labelledby="pain-scale-label"
          >
            {([1, 2, 3, 4, 5] as const).map((val) => (
              <button
                key={val}
                type="button"
                className={`${styles.painBtn} ${painScale === val ? styles.painBtnActive : ""}`}
                onClick={() => setPainScale(val)}
                aria-pressed={painScale === val}
                title={PAIN_SCALE_LABELS[val]}
              >
                {val}
              </button>
            ))}
            <span className={styles.painLabel}>
              {PAIN_SCALE_LABELS[painScale]}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div className={styles.field}>
          <label htmlFor="symptom-notes" className={styles.label}>
            Notes <span className={styles.optional}>(optional)</span>
          </label>
          <textarea
            id="symptom-notes"
            className={styles.textarea}
            rows={2}
            placeholder="Additional context..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitBtn}>
            Log Stress Point
          </button>
          {justSaved && (
            <span className={styles.successMsg} role="status">
              Logged.
            </span>
          )}
        </div>
      </form>

      {/* ── Activity Entry Log ──────────────────────────────────────────── */}
      {activityEntries.length > 0 && (
        <ul className={styles.entryList} aria-label="Logged stress points">
          {activityEntries.map((entry) => (
            <li key={entry.id} className={styles.entryRow}>
              <div className={styles.entryRowHeader}>
                <span className={styles.entryLocation}>{entry.location}</span>
                {onDelete && (
                  <button
                    type="button"
                    className={styles.entryDeleteBtn}
                    onClick={() => onDelete(entry.id)}
                    aria-label={`Delete ${entry.location} entry`}
                    title="Delete"
                  >
                    ×
                  </button>
                )}
              </div>
              <span className={styles.entryMeta}>
                {TRIGGER_LABELS[entry.trigger]}
                {" · "}
                {WARMUP_BEHAVIOR_LABELS[entry.warmUpBehavior]}
                {" · "}
                {entry.painScale}/5
              </span>
              {entry.notes && (
                <span className={styles.entryNotes}>{entry.notes}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SymptomLog;

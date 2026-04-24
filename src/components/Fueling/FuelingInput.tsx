/**
 * Fueling Input Component
 *
 * Lightweight, zero-friction input for logging fueling data on activities.
 * Designed to be minimalist and optional.
 * Persists to Neon PostgreSQL via server functions.
 */

import React, { useState, useEffect } from "react";
import {
  useFuelingEntry,
  useSaveFuelingEntry,
  useDeleteFuelingEntry,
  type FuelingEntry,
} from "../../hooks";
import styles from "./Fueling.module.scss";

interface FuelingTiming {
  beforeRun?: "none" | "light" | "moderate" | "heavy";
  duringRun?: "none" | "light" | "moderate" | "heavy";
  afterRun?: "none" | "light" | "moderate" | "heavy";
}

interface FuelingInputProps {
  activityId: number;
  athleteId: number;
  distanceMiles: number;
  onSave?: (entry: FuelingEntry) => void;
  onDelete?: () => void;
}

export function FuelingInput({
  activityId,
  athleteId,
  distanceMiles,
  onSave,
  onDelete,
}: FuelingInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [entry, setEntry] = useState<Partial<FuelingEntry>>({});
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load existing entry from server
  const { data: existingEntry, isLoading } = useFuelingEntry(activityId);
  const saveMutation = useSaveFuelingEntry();
  const deleteMutation = useDeleteFuelingEntry();

  const hasExisting = !!existingEntry;

  // Sync server data to local state
  useEffect(() => {
    if (existingEntry) {
      setEntry(existingEntry);
    }
  }, [existingEntry]);

  // Only show for long runs (8+ miles)
  const isLongRun = distanceMiles >= 8;

  const handleSave = async () => {
    try {
      setErrorMessage(null);
      await saveMutation.mutateAsync({
        athleteId,
        activityId,
        carbsGrams: entry.carbsGrams,
        gelsCount: entry.gelsCount,
        hydrationMl: entry.hydrationMl,
        caffeineCount: entry.caffeineCount,
        timingBefore: entry.timing?.beforeRun,
        timingDuring: entry.timing?.duringRun,
        timingAfter: entry.timing?.afterRun,
        note: entry.note,
      });

      setSaved(true);
      onSave?.(entry as FuelingEntry);

      // Reset saved indicator after 2s
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save fueling entry");
    }
  };

  const handleDelete = async () => {
    try {
      setErrorMessage(null);
      await deleteMutation.mutateAsync({ athleteId, activityId });
      setEntry({});
      setIsExpanded(false);
      onDelete?.();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete fueling entry");
    }
  };

  const updateTiming = (field: keyof FuelingTiming, value: string) => {
    setEntry((prev) => ({
      ...prev,
      timing: {
        ...prev.timing,
        [field]: value as FuelingTiming[keyof FuelingTiming],
      },
    }));
  };

  // Compact view for quick logging
  if (!isExpanded) {
    return (
      <div className={styles.compactContainer}>
        <button
          className={styles.expandBtn}
          onClick={() => setIsExpanded(true)}
          disabled={isLoading}
        >
          {isLoading ? (
            <span>Loading...</span>
          ) : hasExisting ? (
            <>
              <span className={styles.fuelingIcon}>⚡</span>
              <span>Fueling logged</span>
              <span className={styles.editHint}>Edit</span>
            </>
          ) : (
            <>
              <span className={styles.fuelingIcon}>+</span>
              <span>Log fueling</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>
          <span className={styles.fuelingIcon}>⚡</span>
          Fueling
        </h4>
        <button
          className={styles.collapseBtn}
          onClick={() => setIsExpanded(false)}
        >
          ✕
        </button>
      </div>

      <div className={styles.inputGrid}>
        {/* Gels / Carbs */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>Gels / Carbs</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              min="0"
              max="20"
              placeholder="0"
              value={entry.gelsCount ?? ""}
              onChange={(e) =>
                setEntry((prev) => ({
                  ...prev,
                  gelsCount: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                }))
              }
              className={styles.input}
            />
            <span className={styles.unit}>gels</span>
            <span className={styles.or}>or</span>
            <input
              type="number"
              min="0"
              max="500"
              placeholder="0"
              value={entry.carbsGrams ?? ""}
              onChange={(e) =>
                setEntry((prev) => ({
                  ...prev,
                  carbsGrams: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                }))
              }
              className={styles.input}
            />
            <span className={styles.unit}>g carbs</span>
          </div>
        </div>

        {/* Hydration */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>Hydration</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              min="0"
              max="5000"
              step="100"
              placeholder="0"
              value={entry.hydrationMl ?? ""}
              onChange={(e) =>
                setEntry((prev) => ({
                  ...prev,
                  hydrationMl: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                }))
              }
              className={styles.input}
            />
            <span className={styles.unit}>ml</span>
            <div className={styles.quickBtns}>
              <button
                type="button"
                className={styles.quickBtn}
                onClick={() =>
                  setEntry((prev) => ({ ...prev, hydrationMl: 500 }))
                }
              >
                500ml
              </button>
              <button
                type="button"
                className={styles.quickBtn}
                onClick={() =>
                  setEntry((prev) => ({ ...prev, hydrationMl: 750 }))
                }
              >
                750ml
              </button>
            </div>
          </div>
        </div>

        {/* Caffeine */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>Caffeine</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              min="0"
              max="10"
              placeholder="0"
              value={entry.caffeineCount ?? ""}
              onChange={(e) =>
                setEntry((prev) => ({
                  ...prev,
                  caffeineCount: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                }))
              }
              className={styles.input}
            />
            <span className={styles.unit}>coffees/pills</span>
          </div>
        </div>
      </div>

      {/* Timing (collapsible advanced) */}
      <details className={styles.timingSection}>
        <summary className={styles.timingSummary}>Timing breakdown</summary>
        <div className={styles.timingGrid}>
          {(["beforeRun", "duringRun", "afterRun"] as const).map((field) => (
            <div key={field} className={styles.timingGroup}>
              <label className={styles.timingLabel}>
                {field === "beforeRun"
                  ? "Before"
                  : field === "duringRun"
                    ? "During"
                    : "After"}
              </label>
              <select
                value={entry.timing?.[field] ?? "none"}
                onChange={(e) => updateTiming(field, e.target.value)}
                className={styles.timingSelect}
              >
                <option value="none">None</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>
          ))}
        </div>
      </details>

      {/* Note */}
      <div className={styles.noteGroup}>
        <input
          type="text"
          placeholder="Optional note..."
          value={entry.note ?? ""}
          onChange={(e) =>
            setEntry((prev) => ({ ...prev, note: e.target.value }))
          }
          className={styles.noteInput}
          maxLength={100}
        />
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {hasExisting && (
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </button>
        )}
        <button
          type="button"
          className={`${styles.saveBtn} ${saved ? styles.saved : ""}`}
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving..." : saved ? "✓ Saved" : "Save"}
        </button>
      </div>

      {errorMessage && <p className={styles.errorNote}>{errorMessage}</p>}
    </div>
  );
}

export default FuelingInput;

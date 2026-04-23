import React from "react";
import styles from "./PartnerFooter.module.scss";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface PartnerFooterProps {
  /**
   * The `device_name` field from a Strava activity detail response.
   * When this string contains "Garmin" (case-insensitive), a Garmin
   * attribution line is rendered above the Strava logo.
   *
   * Leave undefined when rendering on non-activity pages.
   */
  deviceName?: string;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

/**
 * PartnerFooter
 *
 * Renders mandatory Strava attribution (§ 3.1 of Strava API guidelines) and,
 * when a Garmin device is detected, a Garmin attribution line.
 *
 * Logo path references the canonical Strava assets bundle included in /public.
 * Do not resize the logo below its natural aspect ratio — per Strava brand guidelines.
 */
function PartnerFooter({ deviceName }: PartnerFooterProps) {
  const garminModel =
    deviceName && /garmin/i.test(deviceName) ? deviceName : null;

  return (
    <footer className={styles.root}>
      {garminModel && (
        <span className={styles.garmin}>Data processed from {garminModel}</span>
      )}

      {/* Strava "Powered by" — mandatory on all data-fed pages (§ 3.1) */}
      <a
        href="https://www.strava.com"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.stravaLink}
        aria-label="Powered by Strava"
      >
        <img
          src="/1.2-Strava-API-Logos/Powered by Strava/pwrdBy_strava_white/api_logo_pwrdBy_strava_horiz_white.png"
          alt="Powered by Strava"
          className={styles.stravaLogo}
          width={193}
          height={48}
          loading="lazy"
        />
      </a>
    </footer>
  );
}

export default PartnerFooter;

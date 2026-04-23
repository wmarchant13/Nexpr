/**
 * Profile Page
 * 
 * User profile and account settings.
 * Shows lifetime stats and account management.
 */

import React, { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAthlete, useStats, useLogout, buildLifetimeRunSnapshot } from "../../hooks";
import { getCacheStatus, clearCache } from "../../store/cache";
import styles from "./Profile.module.scss";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { data: athlete, isLoading: athleteLoading } = useAthlete();
  const { data: stats } = useStats(athlete?.id ?? null);
  const { mutate: logout } = useLogout();
  const avatarUrl = athlete?.profile || athlete?.profile_medium || "";
  
  const lifetimeStats = useMemo(() => {
    if (!stats) return null;
    return buildLifetimeRunSnapshot(stats);
  }, [stats]);
  
  const cacheStatus = useMemo(() => getCacheStatus(), []);
  
  const handleClearCache = () => {
    clearCache();
    window.location.reload();
  };
  
  if (athleteLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }
  
  if (!athlete) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState}>
          <p>Failed to load profile</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Profile Header */}
        <section className={styles.profileHeader}>
          <div className={styles.avatarWrapper}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={athlete.firstname}
                className={styles.avatar}
                onError={(event) => {
                  const target = event.currentTarget;
                  target.style.display = "none";
                  target.parentElement?.classList.add(styles.avatarFallbackVisible);
                }}
              />
            ) : null}
            <div className={styles.avatarFallback} aria-hidden="true">
              {(athlete.firstname?.[0] || "U").toUpperCase()}
            </div>
            <span className={styles.statusDot} />
          </div>
          
          <div className={styles.profileInfo}>
            <h1 className={styles.name}>
              {athlete.firstname} {athlete.lastname}
            </h1>
            <p className={styles.username}>@{athlete.username}</p>
            {athlete.city && (
              <p className={styles.location}>
                📍 {athlete.city}, {athlete.state}
              </p>
            )}
          </div>
        </section>
        
        {/* Lifetime Stats */}
        {lifetimeStats && (
          <section className={styles.statsSection}>
            <h2 className={styles.sectionTitle}>Lifetime Running Stats</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{lifetimeStats.lifetimeMiles}</span>
                <span className={styles.statLabel}>Total Miles</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{lifetimeStats.lifetimeRuns}</span>
                <span className={styles.statLabel}>Total Runs</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{lifetimeStats.ytdMiles}</span>
                <span className={styles.statLabel}>YTD Miles</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{lifetimeStats.ytdRuns}</span>
                <span className={styles.statLabel}>YTD Runs</span>
              </div>
            </div>
          </section>
        )}
        
        {/* Data Management */}
        <section className={styles.settingsSection}>
          <h2 className={styles.sectionTitle}>Data & Cache</h2>
          <div className={styles.settingsCard}>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Cached Activities</span>
                <span className={styles.settingValue}>
                  {cacheStatus.activitiesCount} activities
                </span>
              </div>
              <span className={`${styles.settingStatus} ${cacheStatus.hasActivities ? styles.active : ""}`}>
                {cacheStatus.hasActivities ? "Fresh" : "Stale"}
              </span>
            </div>
            
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Last Sync</span>
                <span className={styles.settingValue}>
                  {cacheStatus.lastSync 
                    ? cacheStatus.lastSync.toLocaleString()
                    : "Never"
                  }
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleClearCache}
              className={styles.settingButton}
            >
              Clear Cache & Refresh
            </button>
          </div>
        </section>
        
        {/* Account Actions */}
        <section className={styles.settingsSection}>
          <h2 className={styles.sectionTitle}>Account</h2>
          <div className={styles.settingsCard}>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Connected to Strava</span>
                <span className={styles.settingValue}>
                  Athlete ID: {athlete.id}
                </span>
              </div>
              <span className={`${styles.settingStatus} ${styles.active}`}>
                Connected
              </span>
            </div>
            
            <button 
              onClick={() => logout()}
              className={`${styles.settingButton} ${styles.danger}`}
            >
              Disconnect & Logout
            </button>
          </div>
        </section>
        
        {/* App Info */}
        <section className={styles.appInfo}>
          <div className={styles.appBrand}>
            <img
              src="/assets/nexpr_logo.png"
              alt="Nexpr"
              className={styles.appLogo}
            />
            <span className={styles.appName}>nexpr</span>
          </div>
          <p className={styles.appTagline}>Unlock your next PR</p>
          <p className={styles.appVersion}>Version 2.0.0</p>
        </section>
      </div>
    </div>
  );
}

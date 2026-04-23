import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import styles from "./TabNav.module.scss";

interface Tab {
  path: string;
  label: string;
  shortLabel: string;
}

const TABS: Tab[] = [
  { path: "/dashboard", label: "Log", shortLabel: "Log" },
  { path: "/activities", label: "Miles", shortLabel: "Miles" },
  { path: "/insights", label: "Breakdown", shortLabel: "Break" },
  { path: "/goals", label: "Race Day", shortLabel: "Race" },
  { path: "/tools", label: "Kit", shortLabel: "Kit" },
  { path: "/profile", label: "Profile", shortLabel: "Me" },
];

export default function TabNav() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const isActive = (path: string) =>
    currentPath === path ||
    (path !== "/dashboard" && currentPath.startsWith(path));

  return (
    <>
      {/* Desktop nav — rendered in header center column */}
      <nav className={styles.desktopNav}>
        {TABS.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`${styles.navItem} ${isActive(tab.path) ? styles.active : ""}`}
            aria-label={tab.label}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Mobile bottom bar — fixed position, outside normal flow */}
      <nav className={styles.mobileNav}>
        {TABS.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`${styles.mobileNavItem} ${isActive(tab.path) ? styles.mobileActive : ""}`}
            aria-label={tab.label}
          >
            {tab.shortLabel}
          </Link>
        ))}
      </nav>
    </>
  );
}

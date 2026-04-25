import { Link, useRouterState } from "@tanstack/react-router";
import styles from "./TabNav.module.scss";

interface Tab {
  path: string;
  label: string;
  shortLabel: string;
}

const TABS: Tab[] = [
  { path: "/dashboard", label: "Log", shortLabel: "Log" },
  { path: "/activities", label: "Activities", shortLabel: "Acts" },
  { path: "/insights", label: "Breakdown", shortLabel: "Break" },
  { path: "/goals", label: "Goals", shortLabel: "Goals" },
  { path: "/tools", label: "Kit", shortLabel: "Kit" },
  { path: "/journal", label: "Journal", shortLabel: "Notes" },
  { path: "/profile", label: "Profile", shortLabel: "Me" },
];

// Primary navigation tab bar for desktop and mobile
export default function TabNav() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  // Returns true if active
  const isActive = (path: string) =>
    currentPath === path ||
    (path !== "/dashboard" && currentPath.startsWith(path));

  return (
    <>
      {}
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

      {}
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

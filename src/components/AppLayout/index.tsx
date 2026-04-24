import { Outlet, useNavigate } from "@tanstack/react-router";
import TabNav from "../TabNav";
import PartnerFooter from "../PartnerFooter";
import WeatherWidget from "../WeatherWidget";
import { useAthlete, useLogout } from "../../hooks";
import styles from "./AppLayout.module.scss";

// Root layout shell with header, nav, and main content area
export default function AppLayout() {
  const { data: athlete } = useAthlete();
  const { mutate: logout } = useLogout();
  const navigate = useNavigate();

  return (
    <div className={styles.layout}>
      <div className={styles.backgroundLayer} aria-hidden="true">
        <img
          src="/assets/duo-running.jpg"
          alt=""
          className={`${styles.backgroundTile} ${styles.tileNorthwest}`}
        />
        <img
          src="/assets/man-running.jpg"
          alt=""
          className={`${styles.backgroundTile} ${styles.tileNorth}`}
        />
        <img
          src="/assets/man-running-2.jpg"
          alt=""
          className={`${styles.backgroundTile} ${styles.tileEast}`}
        />
        <img
          src="/assets/track-running.jpg"
          alt=""
          className={`${styles.backgroundTile} ${styles.tileSouthwest}`}
        />
        <div className={styles.backgroundScrim} />
      </div>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <img
              src="/assets/nexpr_logo.png"
              alt="Nexpr"
              className={styles.wordmarkLogo}
            />
            <span className={styles.wordmarkSub}>EST. 2026 · BUFFALO, NY</span>
          </div>
          <TabNav />
          <div className={styles.headerRight}>
            <WeatherWidget />
            {athlete && (
              <button
                onClick={() => navigate({ to: "/profile" })}
                className={styles.avatarButton}
                aria-label="Profile"
              >
                <img
                  src={athlete.profile}
                  alt={athlete.firstname}
                  className={styles.avatar}
                />
              </button>
            )}
            <button onClick={() => logout()} className={styles.logoutButton}>
              Sign Out
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.contentShell}>
          <Outlet />
        </div>
        <div className={styles.footerWrapper}>
          <PartnerFooter />
        </div>
      </main>
    </div>
  );
}

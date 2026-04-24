/**
 * Nexpr App Layout
 *
 * Wraps authenticated pages with consistent header and navigation.
 * Provides the premium app shell experience.
 */

import { Outlet, useNavigate } from "@tanstack/react-router";
import TabNav from "../TabNav";
import PartnerFooter from "../PartnerFooter";
import WeatherWidget from "../WeatherWidget";
import { useAthlete, useLogout } from "../../hooks";
import styles from "./AppLayout.module.scss";

export default function AppLayout() {
  const { data: athlete } = useAthlete();
  const { mutate: logout } = useLogout();
  const navigate = useNavigate();

  return (
    <div className={styles.layout}>
      {/**Background Images */}
      <div className={styles.backgroundLayer} aria-hidden="true">
        <img
          src="/assets/pexels-caique-araujo-101156227-15875672.jpg"
          alt=""
          className={`${styles.backgroundTile} ${styles.tileNorthwest}`}
        />
        <img
          src="/assets/pexels-ketut-subiyanto-5036843.jpg"
          alt=""
          className={`${styles.backgroundTile} ${styles.tileNorth}`}
        />
        <img
          src="/assets/pexels-kf-zhou-609625381-19146676.jpg"
          alt=""
          className={`${styles.backgroundTile} ${styles.tileEast}`}
        />
        <img
          src="/assets/pexels-umutdagli-15085825.jpg"
          alt=""
          className={`${styles.backgroundTile} ${styles.tileSouthwest}`}
        />
        <div className={styles.backgroundScrim} />
      </div>
      {/**Header across app */}
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
            {/**OpenWeather widget */}
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
      {/**Content */}
      <main className={styles.main}>
        <div className={styles.contentShell}>
          <Outlet />
        </div>
        {/**Footer */}
        <div className={styles.footerWrapper}>
          <PartnerFooter />
        </div>
      </main>
    </div>
  );
}

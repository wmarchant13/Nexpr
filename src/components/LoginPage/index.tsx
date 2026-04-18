import styles from "./LoginPage.module.scss";
import { useStravaLogin } from "../../hooks";

export default function LoginPage() {
  const { mutate: login, isPending } = useStravaLogin();

  return (
    <div className={styles.page}>
      <div className={styles.backdropMesh} />
      <div className={styles.card}>
        <div className={styles.topBar} aria-hidden="true">
          <div className={styles.topBarAccentGreen} />
          <div className={styles.topBarAccentBlue} />
        </div>

        <div className={styles.header}>
          <p className={styles.eyebrow}>Secund / Strava</p>
          <h1 className={styles.title}>Secund.io</h1>
          <p className={styles.subtitle}>
            Connect your Strava account to open your activity dashboard.
          </p>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Connect your archive</h2>
            <span className={styles.panelBadge}>Strava OAuth</span>
          </div>
          <p className={styles.panelText}>
            Connect your Strava account to view and track your activities.
          </p>

          <button
            onClick={() => login()}
            disabled={isPending}
            className={styles.button}
          >
            {isPending ? "Redirecting..." : "Connect with Strava"}
          </button>
        </div>

        <div className={styles.footer}>
          <p>By connecting, you agree to our terms of service and privacy policy.</p>
        </div>
      </div>
    </div>
  );
}

import styles from "./LoginPage.module.scss";
import { useStravaLogin } from "../../hooks";

export default function LoginPage() {
  const { mutate: login, isPending } = useStravaLogin();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Secund.io</h1>
          <p className={styles.subtitle}>Track your Strava activities</p>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Get Started</h2>
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

import { useStravaLogin } from "../../hooks";
import styles from "./LoginPage.module.scss";

// Landing and login page with Strava connect button
export default function LoginPage() {
  const { mutate: login, isPending, error } = useStravaLogin();

  return (
    <div className={styles.page}>
      {}
      <video
        className={styles.videoBg}
        src="/assets/running-video.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />

      {}
      <div className={styles.scrim} aria-hidden="true" />

      {}
      <div className={styles.grain} aria-hidden="true" />

      {}
      <div className={styles.box}>
        <div className={styles.wordmark}>
          <img
            src="/assets/nexpr_logo.png"
            alt="Nexpr"
            className={styles.wordmarkLogo}
          />
          <span className={styles.wordmarkSub}>EST. 2026 · BUFFALO, NY</span>
        </div>

        <p className={styles.tagline}>Powering your next PR</p>

        <button
          className={styles.ctaButton}
          onClick={() => login()}
          disabled={isPending}
          aria-label="Connect with Strava"
        >
          <img
            src="/assets/btn_strava_connect_with_orange.png"
            alt="Connect with Strava"
            className={styles.ctaImage}
            width={280}
            height={80}
            loading="eager"
          />
        </button>

        <p className={styles.legalNote}>
          We only read your activity data. We never post on your behalf.
        </p>

        {error && (
          <p className={styles.errorNote}>
            {error instanceof Error ? error.message : "Something went wrong. Please try again."}
          </p>
        )}
      </div>
    </div>
  );
}

import { useStravaLogin } from "../../hooks";
import styles from "./LoginPage.module.scss";

// Landing and login page with Strava connect button
export default function LoginPage() {
  const { mutate: login, isPending, error } = useStravaLogin();

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.box}>
          <div className={styles.brandBlock}>
            <img
              src="/assets/branding/nexpr_logo.png"
              alt="Nexpr"
              className={styles.brandLogo}
            />

            <div className={styles.copyBlock}>
              <p className={styles.kicker}>Training Journal</p>
              <h1 className={styles.headline}>Run smarter. Recover better.</h1>
              <p className={styles.tagline}>
                Connect Strava with your physical training journal to bring your
                runs, fueling, and recovery notes together in one clean, unified
                place.
              </p>
            </div>
          </div>

          <button
            className={styles.ctaButton}
            onClick={() => login()}
            disabled={isPending}
            aria-label="Connect with Strava"
          >
            <img
              src="/assets/strava/btn_strava_connect_with_orange.png"
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
              {error instanceof Error
                ? error.message
                : "Something went wrong. Please try again."}
            </p>
          )}
        </div>

        <aside className={styles.videoPane} aria-hidden="true">
          <video
            className={styles.videoBg}
            src="/assets/running-media/running-video.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className={styles.scrim} />
        </aside>
      </div>
    </div>
  );
}

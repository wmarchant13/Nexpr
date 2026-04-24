import { useStravaLogin } from "../../hooks";
import styles from "./LoginPage.module.scss";

// Landing and login page with Strava connect button
export default function LoginPage() {
  const { mutate: login, isPending } = useStravaLogin();

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
        >
          {isPending ? (
            <>
              <span className={styles.ctaSpinner} />
              Connecting…
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M15.387 3.292c-.8.266-1.442.75-1.865 1.389-.2.305-.363.638-.463.987l-.038.142-.04-.007c-.233-.038-.468-.058-.705-.058-1.578 0-2.838.985-3.233 2.48-.044.169-.074.342-.09.518l-.01.162v.055l-.127.021c-.65.127-1.224.462-1.648.966-.46.547-.703 1.254-.703 2.015 0 1.835 1.421 3.256 3.268 3.256h7.534c1.694 0 3.072-1.305 3.072-2.91 0-1.25-.775-2.342-1.934-2.757l-.17-.056-.017-.178c-.117-1.26-.817-2.342-1.875-2.948l-.158-.086.036-.161c.078-.36.1-.73.067-1.097-.11-1.172-.802-2.197-1.9-2.733zm-3.49 13.266H5.33C3.49 16.558 2 15.136 2 13.36c0-.957.393-1.843 1.065-2.488a3.37 3.37 0 0 1 1.638-.872l.235-.046.007-.24c.018-.498.12-.974.3-1.42C5.763 7.23 6.956 6.35 8.36 6.35c.176 0 .352.014.525.041l.476.077.108-.47c.27-1.165 1.156-1.998 2.265-1.998.16 0 .32.016.476.047l.168.038.057-.16c.282-.808.826-1.436 1.579-1.797.749-.36 1.62-.424 2.415-.168.797.257 1.457.82 1.84 1.583.19.378.292.794.3 1.22l.005.286.275.107c1.277.497 2.12 1.72 2.12 3.1 0 1.832-1.512 3.301-3.37 3.301H11.9v-.002z" />
              </svg>
              Connect with Strava
            </>
          )}
        </button>

        <p className={styles.legalNote}>
          We only read your activity data. We never post on your behalf.
        </p>
      </div>
    </div>
  );
}

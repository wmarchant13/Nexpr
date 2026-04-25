import styles from "./PartnerFooter.module.scss";

export interface PartnerFooterProps {}

// Strava partner branding footer component
function PartnerFooter(_props: PartnerFooterProps) {
  return (
    <footer className={styles.root}>
      <a
        href="https://www.strava.com"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.stravaLink}
        aria-label="Powered by Strava"
      >
        <img
          src="/assets/strava/pwrdBy_strava_white/api_logo_pwrdBy_strava_horiz_white.png"
          alt="Powered by Strava"
          className={styles.stravaLogo}
          width={193}
          height={48}
          loading="lazy"
        />
      </a>
    </footer>
  );
}

export default PartnerFooter;

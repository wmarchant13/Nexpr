import styles from "./PartnerFooter.module.scss";

export interface PartnerFooterProps {
  
  deviceName?: string;
}

// Strava partner branding footer component
function PartnerFooter({ deviceName }: PartnerFooterProps) {
  const garminModel =
    deviceName && /garmin/i.test(deviceName) ? deviceName : null;

  return (
    <footer className={styles.root}>
      {garminModel && (
        <span className={styles.garmin}>Data processed from {garminModel}</span>
      )}

      {}
      <a
        href="https://www.strava.com"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.stravaLink}
        aria-label="Powered by Strava"
      >
        <img
          src="/1.2-Strava-API-Logos/Powered by Strava/pwrdBy_strava_white/api_logo_pwrdBy_strava_horiz_white.png"
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

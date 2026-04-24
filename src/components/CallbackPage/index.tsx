import React, { useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { useStravaCallback } from "../../hooks";
import styles from "./CallbackPage.module.scss";

interface CallbackSearch {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

function StatusLayout({
  children,
  centered = false,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.ambientGrid} aria-hidden="true" />
      <div className={`${styles.card} ${centered ? styles.centered : ""}`.trim()}>{children}</div>
    </div>
  );
}

export default function CallbackPage() {
  const search = useSearch({ from: "/auth/strava/callback" }) as CallbackSearch;
  const [status, setStatus] = React.useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = React.useState<string>("");
  const hasCalledRef = React.useRef(false);

  const callbackMutation = useStravaCallback(search.code || "", search.state);
  const { mutate } = callbackMutation;

  useEffect(() => {
    if (search.error) {
      setStatus("error");
      setErrorMsg(search.error_description || search.error);
      return;
    }

    if (search.code && !hasCalledRef.current) {
      hasCalledRef.current = true;
      setStatus("loading");
      mutate(undefined, {
        onSuccess: () => {
          setStatus("success");
          setTimeout(() => {
            window.location.replace("/dashboard");
          }, 800);
        },
        onError: (error) => {
          setStatus("error");
          setErrorMsg(error.message || "Authentication failed");
        },
      });
    }
    // mutate is stable; search params won't change after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.code, search.error, search.error_description]);

  if (search.error) {
    return (
      <StatusLayout>
        <p className={styles.eyebrow}>Strava callback</p>
        <h1 className={styles.errorTitle}>Authentication Failed</h1>
        <p className={styles.message}>{errorMsg}</p>
        <a href="/" className={styles.errorButton}>
          Back to Login
        </a>
      </StatusLayout>
    );
  }

  if (status === "success") {
    return (
      <StatusLayout centered>
        <p className={styles.eyebrow}>Strava callback</p>
        <div className={styles.successIcon}>✓</div>
        <h1 className={styles.successTitle}>Success!</h1>
        <p className={styles.message}>
          Your Strava account has been connected. Redirecting to dashboard...
        </p>
      </StatusLayout>
    );
  }

  if (status === "error") {
    return (
      <StatusLayout>
        <p className={styles.eyebrow}>Strava callback</p>
        <h1 className={styles.errorTitle}>Authentication Failed</h1>
        <p className={styles.message}>{errorMsg}</p>
        <a href="/" className={styles.errorButton}>
          Back to Login
        </a>
      </StatusLayout>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.ambientGrid} aria-hidden="true" />
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p className={styles.eyebrow}>Strava callback</p>
        <p className={styles.loadingText}>Processing authentication...</p>
      </div>
    </div>
  );
}

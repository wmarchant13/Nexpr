import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWeather } from "../../api/weather";
import styles from "./WeatherWidget.module.scss";

export default function WeatherWidget() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const [locationReady, setLocationReady] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      setCoords({ lat: 40.6782, lon: -73.9442 });
      setLocationReady(true);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLocationReady(true);
        },
        () => {
          // fallback to Brooklyn
          setCoords({ lat: 40.6782, lon: -73.9442 });
          setLocationReady(true);
        },
        { timeout: 4000 },
      );
    } else {
      setCoords({ lat: 40.6782, lon: -73.9442 });
      setLocationReady(true);
    }
  }, []);

  const { data } = useQuery({
    queryKey: ["weather", coords?.lat, coords?.lon],
    queryFn: () => getWeather({ data: coords! }),
    enabled: locationReady && !!coords,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (!data) {
    return (
      <span className={styles.widget} aria-label="Weather loading">
        <span className={styles.dot}>·</span>
      </span>
    );
  }

  return (
    <span className={styles.widget} title={data.description}>
      <span>{data.temp}°F</span>
      <span className={styles.separator}>·</span>
      <span className={styles.icon} aria-hidden="true">
        {data.icon}
      </span>
      <span className={styles.separator}>·</span>
      <span>
        Wind {data.windDir} {data.windSpeed}mph
      </span>
    </span>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { getRequiredEnv } from "../utils/server/env";
import { requireNumber } from "../utils/server/validation";

// Converts wind bearing degrees to a compass direction string
function getWindDir(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export interface WeatherData {
  temp: number;
  condition: string;
  description: string;
  windSpeed: number;
  windDir: string;
  city: string;
  icon: string;
}

// Fetches current weather for a lat/lon coordinate
export const getWeather = createServerFn({ method: "GET" })
  .inputValidator((input: { lat: number; lon: number }) => input)
  .handler(async ({ data }): Promise<WeatherData> => {
    const lat = requireNumber(data.lat, "lat", { min: -90, max: 90 });
    const lon = requireNumber(data.lon, "lon", { min: -180, max: 180 });
    const apiKey = getRequiredEnv("OPENWEATHER_API_KEY");

    const [currentRes, geoRes] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`,
      ),
      fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`,
      ),
    ]);

    if (!currentRes.ok) {
      throw new Error("Weather API request failed");
    }

    const current = await currentRes.json();
    const geo = geoRes.ok ? await geoRes.json() : [];

    const condition: string = current?.weather?.[0]?.main ?? "Clear";

    const ICONS: Record<string, string> = {
      Clear: "☀",
      Clouds: "☁",
      Rain: "⛆",
      Drizzle: "⛆",
      Thunderstorm: "⚡",
      Snow: "❄",
      Mist: "≈",
      Fog: "≈",
      Haze: "≈",
      Smoke: "≈",
      Dust: "≈",
      Sand: "≈",
      Tornado: "⚡",
    };

    return {
      temp: Math.round(current?.main?.temp ?? 55),
      condition,
      description: current?.weather?.[0]?.description ?? "",
      windSpeed: Math.round(current?.wind?.speed ?? 0),
      windDir: getWindDir(current?.wind?.deg ?? 0),
      city: (geo[0]?.name as string) ?? "Brooklyn",
      icon: ICONS[condition] ?? "·",
    };
  });

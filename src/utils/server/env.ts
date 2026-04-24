import { neon } from "@neondatabase/serverless";

let cachedDb: ReturnType<typeof neon> | null = null;

export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getDb() {
  if (!cachedDb) {
    cachedDb = neon(getRequiredEnv("DATABASE_URL"));
  }

  return cachedDb;
}

export function toRows<T>(result: unknown): T[] {
  return result as T[];
}

export function firstRow<T>(result: unknown): T | undefined {
  return toRows<T>(result)[0];
}
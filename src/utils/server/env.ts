import { neon } from "@neondatabase/serverless";

let cachedDb: ReturnType<typeof neon> | null = null;

// Returns required env var value or throws if missing
export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

// Returns the singleton Neon DB connection
export function getDb() {
  if (!cachedDb) {
    cachedDb = neon(getRequiredEnv("DATABASE_URL"));
  }

  return cachedDb;
}

// Casts an unknown query result to a typed row array
export function toRows<T>(result: unknown): T[] {
  return result as T[];
}

// Returns the first row from a query result or undefined
export function firstRow<T>(result: unknown): T | undefined {
  return toRows<T>(result)[0];
}
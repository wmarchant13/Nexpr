import { neon } from "@neondatabase/serverless";

// Returns required env var value or throws if missing
// Checks process.env (local) and globalThis.__env__ (Cloudflare Worker bindings)
export function getRequiredEnv(name: string): string {
  const value = (process.env[name] ?? (globalThis as Record<string, any>).__env__?.[name])?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

// Returns a Neon DB connection (always fresh to support Cloudflare Workers env binding)
export function getDb() {
  return neon(getRequiredEnv("DATABASE_URL"));
}

// Casts an unknown query result to a typed row array
export function toRows<T>(result: unknown): T[] {
  return result as T[];
}

// Returns the first row from a query result or undefined
export function firstRow<T>(result: unknown): T | undefined {
  return toRows<T>(result)[0];
}
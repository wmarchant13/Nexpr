type NumberRange = {
  min?: number;
  max?: number;
  integer?: boolean;
};

type StringOptions = {
  minLength?: number;
  maxLength?: number;
  optional?: boolean;
};

export function requireNumber(value: unknown, field: string, options: NumberRange = {}): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error(`${field} must be a valid number`);
  }

  if (options.integer && !Number.isInteger(value)) {
    throw new Error(`${field} must be an integer`);
  }

  if (options.min != null && value < options.min) {
    throw new Error(`${field} must be at least ${options.min}`);
  }

  if (options.max != null && value > options.max) {
    throw new Error(`${field} must be at most ${options.max}`);
  }

  return value;
}

export function requireString(value: unknown, field: string, options: StringOptions = {}): string {
  if (value == null || value === "") {
    if (options.optional) return "";
    throw new Error(`${field} is required`);
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    if (options.optional) return "";
    throw new Error(`${field} is required`);
  }

  if (options.minLength != null && normalized.length < options.minLength) {
    throw new Error(`${field} must be at least ${options.minLength} characters`);
  }

  if (options.maxLength != null && normalized.length > options.maxLength) {
    throw new Error(`${field} must be at most ${options.maxLength} characters`);
  }

  return normalized;
}

export function optionalString(value: unknown, field: string, maxLength: number): string | null {
  if (value == null || value === "") return null;
  return requireString(value, field, { maxLength, optional: true }) || null;
}

export function requireEnumValue<const T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  const normalized = requireString(value, field);
  if (!allowed.includes(normalized as T)) {
    throw new Error(`${field} is invalid`);
  }
  return normalized as T;
}

export function requireDateKey(value: unknown, field: string): string {
  const normalized = requireString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${field} must use YYYY-MM-DD format`);
  }
  return normalized;
}

export function requireUuidLike(value: unknown, field: string): string {
  const normalized = requireString(value, field, { minLength: 8, maxLength: 64 });
  if (!/^[a-zA-Z0-9-]+$/.test(normalized)) {
    throw new Error(`${field} is invalid`);
  }
  return normalized;
}

export function requireUrlOrigin(value: unknown, field: string): string {
  const normalized = requireString(value, field);
  const url = new URL(normalized);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${field} must use http or https`);
  }
  return url.origin;
}
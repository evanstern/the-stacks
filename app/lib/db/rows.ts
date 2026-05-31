import { randomUUID } from "node:crypto";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function stringifyJson(value: JsonValue | undefined, fallback: JsonValue): string {
  return JSON.stringify(value ?? fallback);
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

export function rowToBoolean(value: unknown): boolean {
  return value === 1 || value === true;
}

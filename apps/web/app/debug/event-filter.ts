import type { StoredEvent } from "@the-stacks/session-model";

export interface EventFilter {
  types: string[];
  actors: string[];
  visibilities: string[];
}

export const emptyFilter: EventFilter = {
  types: [],
  actors: [],
  visibilities: [],
};

const passes = (list: readonly string[], value: string) =>
  list.length === 0 || list.includes(value);

/** AND across the three lists, OR within one; an empty list is no constraint. */
export function filterEvents(
  events: readonly StoredEvent[],
  filter: EventFilter,
): StoredEvent[] {
  return events.filter(
    (e) =>
      passes(filter.types, e.type) &&
      passes(filter.actors, e.actor) &&
      passes(filter.visibilities, e.visibility),
  );
}

const sortedUnique = (values: Iterable<string>) => [...new Set(values)].sort();

export function distinctValues(events: readonly StoredEvent[]): EventFilter {
  return {
    types: sortedUnique(events.map((e) => e.type)),
    actors: sortedUnique(events.map((e) => e.actor)),
    visibilities: sortedUnique(events.map((e) => e.visibility)),
  };
}

/** The last `count` rows. */
export function windowRows<T>(rows: readonly T[], count: number): T[] {
  return count >= rows.length ? [...rows] : rows.slice(rows.length - count);
}

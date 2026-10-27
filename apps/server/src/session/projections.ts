import {
  project,
  type SessionProjections,
  type StoredEvent,
  type Viewer,
} from "@the-stacks/session-model";
import { type DbClient, readFrom } from "../events/log.js";
import { toStoredEvent } from "./events.js";

const BATCH_SIZE = 200;

/**
 * Reads the log from seq 0 in `readFrom` batches of 200 and folds it for the
 * viewer. With `throughSeq`, rows after that seq are left out, so the result
 * is the state as of that seq.
 */
export async function loadProjections(
  db: DbClient,
  sessionId: string,
  viewer: Viewer,
  opts: { throughSeq?: number } = {},
): Promise<SessionProjections> {
  const stored: StoredEvent[] = [];
  let afterSeq = 0;
  for (;;) {
    const rows = await readFrom(db, { sessionId, afterSeq, limit: BATCH_SIZE });
    for (const row of rows) {
      if (opts.throughSeq !== undefined && row.seq > opts.throughSeq) {
        return project(stored, viewer);
      }
      stored.push(toStoredEvent(row));
    }
    if (rows.length < BATCH_SIZE) break;
    afterSeq = rows[rows.length - 1].seq;
  }
  return project(stored, viewer);
}

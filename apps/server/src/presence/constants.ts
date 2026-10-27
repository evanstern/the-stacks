/**
 * Presence timings (decision-0024, specs/035-presence/contracts/presence-reader.md).
 * A clean leave shows within CLEAN_LEAVE_BOUND_MS; a silent loss within SILENT_LOSS_BOUND_MS.
 * Silent loss worst case: two heartbeat intervals + the grace window = 25 s.
 */

/** How long a user with no open connection stays present, so a reconnect does not flicker. */
export const PRESENCE_GRACE_MS = 5000;

/** Protocol-level ping cadence. */
export const HEARTBEAT_INTERVAL_MS = 10000;

/** A clean close is reflected in presence within this bound. */
export const CLEAN_LEAVE_BOUND_MS = 10000;

/** A connection lost without a close is reflected in presence within this bound. */
export const SILENT_LOSS_BOUND_MS = 30000;

// Seeded violation: a model-side module importing a log writer.
import { appendSessionEvent } from "../session/events.js";

export const leak = appendSessionEvent;

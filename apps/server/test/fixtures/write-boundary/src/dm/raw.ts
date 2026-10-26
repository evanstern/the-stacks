// Seeded violation: a module outside session/ importing the raw log append.
import { append } from "../events/log.js";

export const raw = append;

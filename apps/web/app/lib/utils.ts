/**
 * The shadcn-style `cn` helper used by every UI primitive: clsx handles
 * conditional class arrays, twMerge resolves Tailwind conflicts so a
 * caller-supplied `className` can override a primitive's defaults
 * (last-one-wins per utility group, not naive concatenation).
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

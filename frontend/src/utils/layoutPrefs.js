/**
 * Defensive readers for layout preferences restored from localStorage.
 *
 * A hand-edited or half-written value must never wedge the IDE at a 0% split
 * or a 5000% zoom, so every persisted number goes through here on read.
 */
import { SPLIT_DEFAULT, SPLIT_MIN, SPLIT_MAX, ZOOM_DEFAULT, ZOOM_MIN, ZOOM_MAX } from "../constants";

function clamp(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function clampSplit(value) {
  return clamp(value, SPLIT_MIN, SPLIT_MAX, SPLIT_DEFAULT);
}

export function clampZoom(value) {
  return clamp(value, ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT);
}

/**
 * Migration: legacy v1 state -> Manifest v2.
 *
 * The legacy state lives under localStorage key `physics-lab-state-v1` and
 * looks like:
 *   { mode: 'blocks' | 'text', pythonCode: string, workspaceXml: string }
 *
 * v1 had no project abstraction. Every existing save becomes a single Physics
 * project with goal='physics' and projectType='custom'. The editor mode is
 * carried into preferredEditor ('text' -> 'code').
 *
 * Per the plan, the v1 key is preserved one release as a rollback path and
 * removed in v1.1; we do not delete it here.
 */

import { SCHEMA_VERSION, isManifest } from "./schema";
import { createManifest } from "./factory";

export const LEGACY_V1_KEY = "physics-lab-state-v1";

/**
 * migrate(raw) -> ManifestV2
 *
 * Accepts:
 *   - null / undefined (returns null — nothing to migrate)
 *   - a v2 manifest object (returned as-is once validated)
 *   - a legacy v1 state ({mode, pythonCode, workspaceXml})
 *
 * Throws on shapes that look like a manifest but aren't valid v2 (corruption,
 * not legacy data we know how to translate).
 */
export function migrate(raw) {
  if (raw === null || raw === undefined) return null;

  // Already v2 — accept after validation.
  if (raw.schemaVersion === SCHEMA_VERSION) {
    if (!isManifest(raw)) {
      throw new Error("migrate: v2 manifest is structurally invalid");
    }
    return raw;
  }

  // Future schema (downgrade not supported).
  if (typeof raw.schemaVersion === "number" && raw.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `migrate: cannot read schemaVersion ${raw.schemaVersion} (this build supports ${SCHEMA_VERSION})`,
    );
  }

  // Looks like a legacy v1 flat state.
  if (isLegacyV1(raw)) {
    return migrateV1(raw);
  }

  throw new Error("migrate: unrecognized state shape");
}

function isLegacyV1(raw) {
  if (!raw || typeof raw !== "object") return false;
  // v1 was an untagged object — recognise by its three fields.
  const hasMode = typeof raw.mode === "string";
  const hasCode = typeof raw.pythonCode === "string";
  const hasXml = typeof raw.workspaceXml === "string";
  return hasMode || hasCode || hasXml;
}

function migrateV1(raw) {
  const preferredEditor = raw.mode === "text" ? "code" : "blocks";
  const manifest = createManifest({
    goal: "physics",
    projectType: "custom",
    preferredEditor,
    beginnerEnabled: false,
    title: "Recovered project",
    workspaceXml: raw.workspaceXml || "",
    python: raw.pythonCode || "",
  });
  return manifest;
}

/**
 * Convenience for app startup: read the legacy key once and migrate if
 * present. Does NOT delete the legacy key — callers decide when to clean up.
 */
export function readLegacyV1(storage = (typeof window !== "undefined" ? window.localStorage : null)) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LEGACY_V1_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

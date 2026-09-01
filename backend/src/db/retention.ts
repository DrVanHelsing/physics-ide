import { and, eq, lte } from "drizzle-orm";
import { classes } from "./schema.js";
import { getSetting } from "./settings.js";
import type { Db } from "./types.js";

/** §11's retention clock, shared by the admin PREVIEW (admin.ts) and the
 *  daily SWEEP (tick.ts). Those two surfaces make one promise — "the count
 *  you confirmed is the set the sweep deletes" — so the clock, the stored
 *  read and the eligibility predicate live here as single symbols rather
 *  than as copies that must be kept identical by discipline. This tree has
 *  already paid for that class of drift once (three independent copies of
 *  the roster-status rule, consolidated into assignments.ts's
 *  rosterSubmissionStatus by task 24's review). */

/** An "N years ago" cutoff is a JS Date computed with this constant and
 *  compared in SQL, never an interval built inside the query
 *  (classes.ts's CLASS_CREATE_WINDOW_MS idiom). */
export const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** The stored period, guarded. `getSetting` returns `unknown`
 *  (db/settings.ts), and this value drives an irreversible mass delete —
 *  a row holding `0`, `null` or `"3"` must never reach the cutoff
 *  arithmetic, so anything that is not a number falls back to the
 *  product's default of 3 years. */
export async function readRetentionYears(db: Db): Promise<number> {
  const stored = await getSetting(db, "retention_years");
  return typeof stored === "number" ? stored : 3;
}

/** The one definition of "old enough to delete": archived, AND archived at
 *  or before the cutoff (inclusive `lte` — a class archived exactly N years
 *  ago is eligible, matching what the preview has always counted). */
export function eligibleForRetention(cutoff: Date) {
  return and(eq(classes.archived, true), lte(classes.archivedAt, cutoff));
}

import { z } from "zod";

/** Delivery lifecycle (design D§4) — the invites table's vocabulary plus
 *  "lapsed": pending shares lapse when the class switch goes off (D§8). */
export const SHARE_STATUSES = ["pending", "accepted", "revoked", "lapsed"] as const;
export type ShareStatus = (typeof SHARE_STATUSES)[number];

/** The client-minted project id shape — the same pattern
 *  backend/src/routes/projects.ts pins privately (PROJECT_ID_REGEX,
 *  projects.ts:13). Two literals by design: shared/ cannot import from
 *  backend/, and exporting the backend's would touch sync-adjacent code for
 *  no behaviour change. If one ever changes, both must. */
export const SHARE_PROJECT_ID_REGEX = /^p-[A-Za-z0-9-]{3,60}$/;

/** POST /api/shares — a share carries a project and a name, nothing else
 *  (design D§1). No message field, ever. */
export const CreateShareInputSchema = z.object({
  classId: z.string().uuid(),
  recipientId: z.string().uuid(),
  projectId: z.string().regex(SHARE_PROJECT_ID_REGEX),
});

/** POST /api/shares/:id/accept — the FRESH id the recipient's copy will
 *  live under, minted client-side like every project id, never the
 *  source's own (design D§2). */
export const AcceptShareInputSchema = z.object({
  projectId: z.string().regex(SHARE_PROJECT_ID_REGEX),
});

/** What sits in projects.attribution — ids only. The sharer's NAME is
 *  resolved at read time so §11 erasure has exactly one place to act
 *  (design D§3). zod's default strip is load-bearing here: a name can
 *  never be smuggled into storage through this schema. */
export const AttributionSchema = z.object({
  sharerId: z.string().uuid(),
  shareId: z.string().uuid(),
});

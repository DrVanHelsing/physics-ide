import { describe, test, expect } from "vitest";
import {
  SHARE_STATUSES,
  CreateShareInputSchema,
  AcceptShareInputSchema,
  AttributionSchema,
} from "./sharing.js";

describe("share contracts", () => {
  test("the delivery lifecycle is the invites vocabulary plus lapsed", () => {
    expect(SHARE_STATUSES).toEqual(["pending", "accepted", "revoked", "lapsed"]);
  });

  test("a share names a class, a recipient and a p- project — nothing else", () => {
    const ok = CreateShareInputSchema.safeParse({
      classId: "6f3f8a30-0000-4000-8000-000000000001",
      recipientId: "6f3f8a30-0000-4000-8000-000000000002",
      projectId: "p-abc-123",
    });
    expect(ok.success).toBe(true);
    // No message field ever parses through (design D§1 — a share carries a
    // project and a name; zod strips unknown keys by default, proving the
    // wire shape cannot quietly grow a note to a classmate).
    expect(Object.keys(ok.data ?? {})).toEqual(["classId", "recipientId", "projectId"]);
    const badId = CreateShareInputSchema.safeParse({
      classId: "6f3f8a30-0000-4000-8000-000000000001",
      recipientId: "6f3f8a30-0000-4000-8000-000000000002",
      projectId: "x-1",
    });
    expect(badId.success).toBe(false);
  });

  test("accept carries only the fresh client-minted id", () => {
    expect(AcceptShareInputSchema.safeParse({ projectId: "p-fresh-1" }).success).toBe(true);
    expect(AcceptShareInputSchema.safeParse({ projectId: "not-a-project" }).success).toBe(false);
  });

  test("attribution is ids only — the name is never stored (design D§3)", () => {
    const parsed = AttributionSchema.parse({
      sharerId: "6f3f8a30-0000-4000-8000-000000000003",
      shareId: "6f3f8a30-0000-4000-8000-000000000004",
      sharerName: "smuggled",
    });
    expect(parsed).toEqual({
      sharerId: "6f3f8a30-0000-4000-8000-000000000003",
      shareId: "6f3f8a30-0000-4000-8000-000000000004",
    });
  });
});

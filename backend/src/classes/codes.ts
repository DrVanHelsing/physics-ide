import { randomInt } from "node:crypto";
import { CLASS_CODE_ALPHABET } from "@physics-ide/shared";
import type { Db } from "../db/types.js";
import { classes } from "../db/schema.js";
import { eq } from "drizzle-orm";

function randomCode(): string {
  const pick = () => CLASS_CODE_ALPHABET[randomInt(CLASS_CODE_ALPHABET.length)];
  return `${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}`;
}

/** Random code, retried on the (astronomically unlikely) collision. */
export async function generateClassCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const clash = await db.select({ id: classes.id }).from(classes).where(eq(classes.joinCode, code));
    if (clash.length === 0) return code;
  }
  throw new Error("Could not generate a unique class code after 5 attempts.");
}

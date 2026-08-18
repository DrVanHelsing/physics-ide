import { db, pool } from "./db/client.js";
import { setSetting, getSetting } from "./db/settings.js";

const existing = await getSetting(db, "account_cap");
if (existing === undefined) {
  await setSetting(db, "account_cap", 200);
  console.log("Seeded account_cap = 200");
} else {
  console.log(`account_cap already set to ${existing} — leaving as is`);
}
await pool.end();

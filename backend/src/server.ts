import { buildApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./db/client.js";

const app = buildApp({ db });

app.listen({ port: config.port, host: "127.0.0.1" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

// Task 24 / design D§6: production has Cloud Scheduler call POST /api/tick
// once a day; dev gets this hourly stand-in instead. Deliberately only here,
// never in app.ts — tests build the app from app.ts directly and never
// import server.ts, so this can't fire during a test run.
if (config.nodeEnv !== "production") {
  setInterval(() => {
    fetch(`http://127.0.0.1:${config.port}/api/tick`, {
      method: "POST",
      headers: { "x-tick-secret": config.tickSecret },
    }).catch((err) => app.log.error(err, "dev tick call failed"));
  }, 60 * 60 * 1000);
}

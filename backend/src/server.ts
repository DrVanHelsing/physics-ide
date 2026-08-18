import { buildApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./db/client.js";

const app = buildApp({ db });

app.listen({ port: config.port, host: "127.0.0.1" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

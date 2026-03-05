import { config } from "dotenv";
import path from "node:path";

import { runMafiIngest } from "../lib/ingest/run-mafi-ingest";

config({ path: ".env.local" });
config();

const shouldPrune = process.argv.includes("--prune");
const dataDirectory = path.join(process.cwd(), "data", "mafi-shots");

runMafiIngest({
  prune: shouldPrune,
  dataDirectory,
  onLog: (line) => console.log(line),
})
  .then((result) => {
    if (!result.ok) {
      console.error("❌ Ingest failed:", result.error);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("❌ Ingest failed:", err);
    process.exit(1);
  });

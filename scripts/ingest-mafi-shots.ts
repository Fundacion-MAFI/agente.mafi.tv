import { config } from "dotenv";

import { runMafiIngest } from "../lib/ingest/run-mafi-ingest";

config({ path: ".env.local" });
config();

const shouldPrune = process.argv.includes("--prune");

runMafiIngest({
  prune: shouldPrune,
  onLog: (line) => console.log(line),
})
  .then((result) => {
    if (!result.ok) {
      console.error("❌ Embedding failed:", result.error);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("❌ Embedding failed:", err);
    process.exit(1);
  });

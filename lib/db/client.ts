if (typeof window !== "undefined") {
  throw new Error("The database client can only be used in a server environment.");
}

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// biome-ignore lint: Forbidden non-null assertion is acceptable for required env.
const client = postgres(process.env.POSTGRES_URL!);

export const db = drizzle(client);

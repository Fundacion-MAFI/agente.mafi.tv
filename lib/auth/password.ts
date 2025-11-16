import "server-only";

import { generateDummyPassword } from "../db/utils";

export const DUMMY_PASSWORD = generateDummyPassword();

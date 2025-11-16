export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

export const STREAM_TROUBLESHOOTING_MESSAGE =
  [
    "What you (or another dev/LLM) should check in the repo:",
    "",
    "Network tab:",
    "/api/chat returns 504",
    "",
    "Server logs (Vercel):",
    "Any errors from streamObject / generateObject / embeddings?",
    "",
    "Env / provider config:",
    "Correct model name?",
    "API key / gateway token present?",
    "Base URL pointing to the right provider?",
  ].join("\n");

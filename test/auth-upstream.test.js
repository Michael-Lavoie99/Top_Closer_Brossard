const assert = require("node:assert/strict");
const test = require("node:test");
const { validateGoogleCredential } = require("../api/_auth");

const originalFetch = global.fetch;
const originalEnv = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
};

test.after(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("sign-in fails closed when the user database cannot be reached", async () => {
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

  global.fetch = async (url) => {
    if (String(url).startsWith("https://oauth2.googleapis.com/")) {
      return {
        ok: true,
        json: async () => ({
          aud: "test-client",
          email: "user@example.com",
          email_verified: "true",
          sub: "test-user"
        })
      };
    }
    throw new TypeError("fetch failed");
  };

  await assert.rejects(
    validateGoogleCredential("test-credential"),
    (error) => error.statusCode === 503 && error.message.includes("SUPABASE_URL")
  );
});

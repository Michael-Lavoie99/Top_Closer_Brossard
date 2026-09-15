const assert = require("node:assert/strict");
const test = require("node:test");
const handler = require("../api/auth/config");

function response() {
  return {
    code: 0,
    body: null,
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

test("scheduled check generates database activity without exposing user data", async () => {
  const oldFetch = global.fetch;
  const oldEnv = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  try {
    process.env.GOOGLE_CLIENT_ID = "test-client";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    let queries = 0;
    global.fetch = async () => { queries += 1; return { ok: true }; };

    const res = response();
    await handler({ method: "GET", headers: { "user-agent": "vercel-cron/1.0" } }, res);

    assert.equal(res.code, 200);
    assert.equal(queries, 3);
    assert.deepEqual(res.body, { googleClientId: "test-client" });
  } finally {
    global.fetch = oldFetch;
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

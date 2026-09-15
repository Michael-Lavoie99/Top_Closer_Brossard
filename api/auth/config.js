const { setAuthCors } = require("../_auth");

module.exports = async (req, res) => {
  setAuthCors(res, "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "GOOGLE_CLIENT_ID is missing" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    const isScheduledCheck = String(req.headers?.["user-agent"] || "").includes("vercel-cron/1.0");
    const checks = isScheduledCheck ? 3 : 1;
    const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/app_users?select=id&limit=1`;

    try {
      for (let i = 0; i < checks; i += 1) {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: "application/json"
          },
          cache: "no-store",
          signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Supabase account database check failed:", error);
      return res.status(503).json({ error: "Base de comptes indisponible. Verifie le projet Supabase dans Vercel." });
    }
  }

  return res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID });
};

const { requireRole, setAuthCors } = require("../_auth");

const VALID_ROLES = ["representant", "manager", "admin"];

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return VALID_ROLES.includes(role) ? role : "representant";
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function listUsers(config) {
  const endpoint = `${config.url}/rest/v1/app_users?select=id,email,full_name,role,is_active,created_at,updated_at&order=email.asc`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Impossible de charger la liste utilisateurs");
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function upsertUser(config, body) {
  const email = normalizeEmail(body?.email);
  const fullName = String(body?.fullName || "").trim();
  const role = normalizeRole(body?.role);
  const isActive = body?.isActive === false ? false : true;

  if (!email || !email.includes("@")) {
    throw new Error("Courriel invalide");
  }

  const payload = [{ email, full_name: fullName || null, role, is_active: isActive }];
  const endpoint = `${config.url}/rest/v1/app_users?on_conflict=email`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Sauvegarde utilisateur echouee: ${details}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

module.exports = async (req, res) => {
  setAuthCors(res, "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const adminUser = requireRole(req, res, ["admin"]);
  if (!adminUser) return;

  const config = getSupabaseConfig();
  if (!config) {
    return res.status(500).json({ error: "Configuration Supabase manquante" });
  }

  try {
    if (req.method === "GET") {
      const users = await listUsers(config);
      return res.status(200).json({ users });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "object" && req.body !== null ? req.body : {};
      const saved = await upsertUser(config, body);
      return res.status(200).json({ user: saved });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

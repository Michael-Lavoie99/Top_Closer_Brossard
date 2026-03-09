const { requireAuth, setAuthCors } = require("./_auth");

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function normalizeConversation(conversation) {
  if (!Array.isArray(conversation)) return [];
  return conversation
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 8000)
    }));
}

function normalizeEvaluation(evaluation) {
  if (!evaluation || typeof evaluation !== "object") return {};
  const score = Number.isFinite(evaluation.score) ? Math.max(0, Math.min(100, Math.round(evaluation.score))) : null;
  const trackScoresSrc = evaluation.trackScores && typeof evaluation.trackScores === "object" ? evaluation.trackScores : {};
  const toTrackScore = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
  };
  const trackScores = {
    qualification: toTrackScore(trackScoresSrc.qualification),
    presentationProduit: toTrackScore(trackScoresSrc.presentationProduit),
    presentationPrix: toTrackScore(trackScoresSrc.presentationPrix)
  };
  return {
    ...evaluation,
    score,
    trackScores
  };
}

async function listSimulations(config, user) {
  const endpoint = `${config.url}/rest/v1/simulation_runs?select=id,user_email,user_name,level,goal,outcome,client_name,client_segment,client_difficulty,transcript,evaluation,created_at&user_email=eq.${encodeURIComponent(user.email)}&order=created_at.desc&limit=100`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Chargement simulations impossible: ${details}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function createSimulation(config, user, body) {
  const context = body?.context && typeof body.context === "object" ? body.context : {};
  const client = context?.client && typeof context.client === "object" ? context.client : {};
  const payload = [
    {
      user_email: user.email,
      user_name: user.name || null,
      level: String(context.level || ""),
      goal: String(context.goal || ""),
      outcome: String(context.outcome || "manual"),
      client_name: String(client.name || ""),
      client_segment: String(client.segment || ""),
      client_difficulty: String(client.difficulty || ""),
      transcript: normalizeConversation(body?.conversation),
      evaluation: normalizeEvaluation(body?.evaluation)
    }
  ];

  const endpoint = `${config.url}/rest/v1/simulation_runs`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Sauvegarde simulation impossible: ${details}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

async function updateSimulation(config, user, body) {
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("id de simulation invalide");
  }

  const context = body?.context && typeof body.context === "object" ? body.context : {};
  const client = context?.client && typeof context.client === "object" ? context.client : {};
  const payload = {
    level: String(context.level || ""),
    goal: String(context.goal || ""),
    outcome: String(context.outcome || "manual"),
    client_name: String(client.name || ""),
    client_segment: String(client.segment || ""),
    client_difficulty: String(client.difficulty || ""),
    transcript: normalizeConversation(body?.conversation),
    evaluation: normalizeEvaluation(body?.evaluation)
  };

  const endpoint = `${config.url}/rest/v1/simulation_runs?id=eq.${id}&user_email=eq.${encodeURIComponent(user.email)}`;
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Mise a jour simulation impossible: ${details}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

module.exports = async (req, res) => {
  setAuthCors(res, "GET, POST, PATCH, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;

  const config = getSupabaseConfig();
  if (!config) {
    return res.status(500).json({ error: "Configuration Supabase manquante" });
  }

  try {
    if (req.method === "GET") {
      const simulations = await listSimulations(config, user);
      return res.status(200).json({ simulations });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "object" && req.body !== null ? req.body : {};
      const simulation = await createSimulation(config, user, body);
      return res.status(200).json({ simulation });
    }

    if (req.method === "PATCH") {
      const body = typeof req.body === "object" && req.body !== null ? req.body : {};
      const simulation = await updateSimulation(config, user, body);
      return res.status(200).json({ simulation });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

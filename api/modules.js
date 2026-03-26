const { requireAuth, setAuthCors } = require("./_auth");
const { listModuleTopics, getModuleTopicBySlug, normalizeModuleLevel } = require("./_moduleTopics");
const { normalizeConversation, runModuleEvaluation } = require("./_evaluation");

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function canManageAllModules(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "admin" || role === "manager";
}

function normalizeRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 60;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeTextList(value, fallback) {
  const items = Array.isArray(value) ? value : [];
  const cleaned = items
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 6);
  return cleaned.length ? cleaned : fallback;
}

function normalizeModuleEvaluation(evaluation) {
  const src = evaluation && typeof evaluation === "object" ? evaluation : {};
  const ratings = src.qualityRatings && typeof src.qualityRatings === "object" ? src.qualityRatings : {};
  const feedback = src.qualityFeedback && typeof src.qualityFeedback === "object" ? src.qualityFeedback : {};
  return {
    ...src,
    score: normalizeRating(src.score),
    verdict: String(src.verdict || "Evaluation de module"),
    summary: String(src.summary || "Evaluation disponible."),
    strengths: normalizeTextList(src.strengths, ["Bonne base observee pendant le module."]),
    improvements: normalizeTextList(src.improvements, ["Preciser davantage la structure de reponse et la valeur client."]),
    inaccuracies: normalizeTextList(src.inaccuracies, ["Aucune inexactitude majeure relevee."]),
    corrections: normalizeTextList(src.corrections, ["Aucune correction critique requise."]),
    qualityRatings: {
      clarte: normalizeRating(ratings.clarte),
      precision: normalizeRating(ratings.precision),
      credibilite: normalizeRating(ratings.credibilite),
      venteConseil: normalizeRating(ratings.venteConseil)
    },
    qualityFeedback: {
      clarte: String(feedback.clarte || "Clarte correcte dans l ensemble."),
      precision: String(feedback.precision || "Precision acceptable avec marge d approfondissement."),
      credibilite: String(feedback.credibilite || "Credibilite globalement maintenue."),
      venteConseil: String(feedback.venteConseil || "Bonne posture de conseil, a raffiner selon les objections.")
    },
    nextObjective: String(src.nextObjective || "Refaire un module en corrigeant les points d amelioration."),
    status: String(src.status || "completed")
  };
}

function buildModuleContext(body) {
  const context = body?.context && typeof body.context === "object" ? body.context : {};
  const topic = getModuleTopicBySlug(context.topicSlug) || getModuleTopicBySlug(body?.topicSlug) || null;
  if (!topic) throw new Error("Sujet de module invalide");
  return {
    mode: "module",
    level: normalizeModuleLevel(context.level),
    topicSlug: topic.slug,
    topicTitle: topic.title,
    moduleTopic: topic,
    topicSummary: topic.summary,
    contextSummary: String(context.contextSummary || ""),
    status: String(context.status || "completed")
  };
}

async function listModules(config, user) {
  const isManagerOrAdmin = canManageAllModules(user);
  const filter = isManagerOrAdmin ? "" : `&user_email=eq.${encodeURIComponent(user.email)}`;
  const limit = isManagerOrAdmin ? 500 : 100;
  const endpoint = `${config.url}/rest/v1/training_module_runs?select=id,user_email,user_name,topic_slug,topic_title,level,status,context_summary,transcript,evaluation,created_at${filter}&order=created_at.desc&limit=${limit}`;
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
    throw new Error(`Chargement modules impossible: ${details}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function createModuleRun(config, user, body) {
  const context = buildModuleContext(body);
  const payload = [
    {
      user_email: user.email,
      user_name: user.name || null,
      topic_slug: context.topicSlug,
      topic_title: context.topicTitle,
      level: context.level,
      status: context.status,
      context_summary: context.contextSummary,
      transcript: normalizeConversation(body?.conversation),
      evaluation: normalizeModuleEvaluation(body?.evaluation)
    }
  ];

  const endpoint = `${config.url}/rest/v1/training_module_runs`;
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
    throw new Error(`Sauvegarde module impossible: ${details}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

async function updateModuleRun(config, user, body) {
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("id de module invalide");

  const context = buildModuleContext(body);
  const payload = {
    topic_slug: context.topicSlug,
    topic_title: context.topicTitle,
    level: context.level,
    status: context.status,
    context_summary: context.contextSummary,
    transcript: normalizeConversation(body?.conversation),
    evaluation: normalizeModuleEvaluation(body?.evaluation)
  };

  const endpoint = `${config.url}/rest/v1/training_module_runs?id=eq.${id}&user_email=eq.${encodeURIComponent(user.email)}`;
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
    throw new Error(`Mise a jour module impossible: ${details}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

async function updateModuleById(config, id, payload) {
  const endpoint = `${config.url}/rest/v1/training_module_runs?id=eq.${id}`;
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
    throw new Error(`Mise a jour module impossible: ${details}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

async function reevaluateModules(config, user, body) {
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];

  if (!ids.length) throw new Error("Aucun module a reevaluer");

  const visible = await listModules(config, user);
  const allowed = canManageAllModules(user)
    ? visible
    : visible.filter((row) => String(row?.user_email || "").toLowerCase() === String(user?.email || "").toLowerCase());

  const selected = allowed.filter((row) => ids.includes(Number(row.id)));
  if (!selected.length) throw new Error("Aucun module autorise a reevaluer");

  const results = [];
  for (const row of selected) {
    const topic = getModuleTopicBySlug(row.topic_slug);
    if (!topic) continue;
    const conversation = normalizeConversation(row.transcript || []);
    const context = {
      mode: "module",
      level: normalizeModuleLevel(row.level),
      topicSlug: topic.slug,
      topicTitle: topic.title,
      moduleTopic: topic,
      contextSummary: row.context_summary || "",
      status: row.status || "completed"
    };
    const { evaluation } = await runModuleEvaluation({
      context,
      conversation,
      apiKey: process.env.OPENAI_API_KEY
    });
    const updated = await updateModuleById(config, row.id, {
      topic_slug: topic.slug,
      topic_title: topic.title,
      level: context.level,
      status: row.status || "completed",
      context_summary: row.context_summary || "",
      transcript: conversation,
      evaluation: normalizeModuleEvaluation(evaluation)
    });
    if (updated) results.push(updated);
  }

  return results;
}

module.exports = async (req, res) => {
  setAuthCors(res, "GET, POST, PATCH, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET" && String(req.query?.view || "").toLowerCase() === "topics") {
    return res.status(200).json({ topics: listModuleTopics() });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return res.status(500).json({ error: "Configuration Supabase manquante" });
  }

  try {
    if (req.method === "GET") {
      const modules = await listModules(config, user);
      return res.status(200).json({ modules });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "object" && req.body !== null ? req.body : {};
      if (body.action === "reevaluate") {
        const modules = await reevaluateModules(config, user, body);
        return res.status(200).json({ modules, reevaluated: modules.length });
      }
      const moduleRun = await createModuleRun(config, user, body);
      return res.status(200).json({ moduleRun });
    }

    if (req.method === "PATCH") {
      const body = typeof req.body === "object" && req.body !== null ? req.body : {};
      const moduleRun = await updateModuleRun(config, user, body);
      return res.status(200).json({ moduleRun });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const { requireAuth, setAuthCors } = require("./_auth");

function normalizeConversation(conversation) {
  if (!Array.isArray(conversation)) return [];

  return conversation
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 6000)
    }));
}

function buildPrompt(context) {
  const level = context?.level || "Intermediaire";
  const goal = context?.goal || "Structure complete";
  const client = context?.client || {};

  return [
    "Tu es directeur des ventes Honda et coach de performance.",
    "Langue: francais quebecois professionnel.",
    "Donne une evaluation tres concrete de la simulation.",
    "",
    "Contexte:",
    `- Niveau vendeur: ${level}`,
    `- Objectif: ${goal}`,
    `- Client: ${client?.name || "N/A"}`,
    `- Segment: ${client?.segment || "N/A"}`,
    `- Difficulte: ${client?.difficulty || "N/A"}`,
    `- Strategie attendue: ${client?.sales_strategy || "N/A"}`,
    "",
    "Retourne UNIQUEMENT un JSON valide avec cette structure exacte:",
    "{",
    '  "score": number,',
    '  "verdict": "string",',
    '  "resume": "string",',
    '  "bonsCoups": ["string", "string", "string"],',
    '  "mauvaisCoups": ["string", "string", "string"],',
    '  "pistesSolution": ["string", "string", "string"],',
    '  "actionsManager": ["string", "string", "string"],',
    '  "nextObjective": "string"',
    "}",
    "",
    "Regles:",
    "- score entre 0 et 100",
    "- Maximum 2 phrases dans resume",
    "- Bons coups et mauvais coups relies au transcript",
    "- actionsManager = ce qu un directeur des ventes veut suivre",
    "- Aucun markdown, aucun texte hors JSON"
  ].join("\n");
}

module.exports = async (req, res) => {
  setAuthCors(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = requireAuth(req, res);
  if (!user) return;
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY is missing" });

  try {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const context = body.context || {};
    const conversation = normalizeConversation(body.conversation || []);

    const messages = [
      { role: "system", content: buildPrompt(context) },
      ...conversation,
      { role: "user", content: "Fais maintenant l evaluation JSON." }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 1200
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: "OpenAI request failed", details: errText });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return res.status(502).json({ error: "Empty reply from model" });

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(text.slice(start, end + 1));
      } else {
        throw new Error("Invalid JSON from model");
      }
    }

    if (typeof parsed.score !== "number") parsed.score = 60;
    parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    return res.status(200).json({ evaluation: parsed, model: data.model || DEFAULT_MODEL });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

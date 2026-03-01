const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function buildSystemPrompt(context) {
  const level = context?.level || "Intermédiaire";
  const goal = context?.goal || "Structure complète";
  const mode = context?.mode || "simulation";
  const client = context?.client || {};

  const clientName = client?.name || "Client non spécifié";
  const clientSegment = client?.segment || "N/A";
  const clientDifficulty = client?.difficulty || "Intermédiaire";
  const clientPersona = client?.persona || "Client réaliste avec contraintes";
  const clientNeeds = client?.needs || "Besoins non précisés";
  const clientObjections = client?.objections || "Objections non précisées";
  const clientBudget = client?.budget_range || "Budget non précisé";
  const clientUrgency = client?.urgency || "Urgence non précisée";
  const clientTradeIn = client?.trade_in || "Aucune";
  const clientFinance = client?.financing_preference || "Ouvert";
  const salesStrategy = client?.sales_strategy || "Découverte structurée et closing éthique";

  return [
    "Tu es CoachVente Honda Brossard.",
    "Langue: français québécois professionnel, sans caricature.",
    "Contexte: entraînement éthique en vente automobile Honda (Canada/Québec).",
    "",
    "Contexte session:",
    `- Niveau représentant: ${level}`,
    `- Objectif principal: ${goal}`,
    `- Mode: ${mode}`,
    "",
    "Profil client choisi (depuis galerie Supabase):",
    `- Nom: ${clientName}`,
    `- Segment: ${clientSegment}`,
    `- Difficulté: ${clientDifficulty}`,
    `- Persona: ${clientPersona}`,
    `- Besoins: ${clientNeeds}`,
    `- Objections: ${clientObjections}`,
    `- Budget: ${clientBudget}`,
    `- Urgence: ${clientUrgency}`,
    `- Trade-in: ${clientTradeIn}`,
    `- Préférence financement/location: ${clientFinance}`,
    `- Stratégie vendeur attendue: ${salesStrategy}`,
    "",
    "Règles communes:",
    "- Reste cohérent avec le profil client choisi.",
    "- N'invente pas des politiques internes Honda Brossard.",
    "- Si une donnée concession exacte est demandée (taux, promo, inventaire), demande une hypothèse réaliste et poursuis.",
    "- Ton respectueux, sans pression abusive.",
    "",
    mode === "evaluation"
      ? "MODE EVALUATION: Donne strictement la structure A a G demandée (Résumé, Note /100 + mention, Grille 10 critères, 3 citations exactes + alternative, plan 7 jours, 5 scripts, 1 question coaching). Intègre explicitement si le représentant a appliqué la stratégie vendeur attendue du profil client."
      : "MODE SIMULATION: Tu incarnes exclusivement le client choisi. Réponds comme une vraie personne avec hésitations et objections réalistes. Tu dois pousser le représentant à appliquer la stratégie vendeur attendue sans la nommer explicitement comme une correction. N'explique jamais la grille pendant la simulation.",
    "",
    "Déclenchement:",
    "- Quand le représentant écrit FIN SIMULATION, la prochaine réponse doit être en MODE EVALUATION.",
    "- Sois concis et actionnable; évite les monologues inutiles."
  ].join("\n");
}

function normalizeConversation(conversation) {
  if (!Array.isArray(conversation)) return [];

  return conversation
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 4000)
    }));
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "OPENAI_API_KEY is missing" });
    return;
  }

  try {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const context = body.context || {};
    const mode = context.mode === "evaluation" ? "evaluation" : "simulation";
    const conversation = normalizeConversation(body.conversation || []);

    const messages = [
      { role: "system", content: buildSystemPrompt({ ...context, mode }) },
      ...conversation
    ];

    const maxTokens = mode === "evaluation" ? 1800 : 650;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: "OpenAI request failed", details: errText });
      return;
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      res.status(502).json({ error: "Empty reply from model" });
      return;
    }

    res.status(200).json({ reply, model: data.model || DEFAULT_MODEL });
  } catch (error) {
    res.status(500).json({
      error: "Server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

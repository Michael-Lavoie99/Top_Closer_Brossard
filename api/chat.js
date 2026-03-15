const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const { requireAuth, setAuthCors } = require("./_auth");

function buildSystemPrompt(context) {
  const level = context?.level || "Intermediaire";
  const goal = context?.goal || "Structure complete";
  const client = context?.client || {};

  const clientName = client?.name || "Client non specifie";
  const clientSegment = client?.segment || "N/A";
  const clientDifficulty = client?.difficulty || "Intermediaire";
  const clientPersona = client?.persona || "Client realiste avec contraintes";
  const clientNeeds = client?.needs || "Besoins non precises";
  const clientObjections = client?.objections || "Objections non precisees";
  const clientBudget = client?.budget_range || "Budget non precise";
  const clientUrgency = client?.urgency || "Urgence non precisee";
  const clientTradeIn = client?.trade_in || "Aucune";
  const clientFinance = client?.financing_preference || "Ouvert";
  const salesStrategy = client?.sales_strategy || "Decouverte structuree et closing ethique";

  const common = [
    "Tu es CoachVente Honda Brossard.",
    "Langue: francais quebecois professionnel.",
    "Contexte: entrainement ethique en vente auto Honda.",
    "",
    "Contexte session:",
    `- Niveau representant: ${level}`,
    `- Objectif principal: ${goal}`,
    "- Mode: simulation (force)",
    "",
    "Profil client:",
    `- Nom: ${clientName}`,
    `- Segment: ${clientSegment}`,
    `- Difficulte: ${clientDifficulty}`,
    `- Persona: ${clientPersona}`,
    `- Besoins: ${clientNeeds}`,
    `- Objections: ${clientObjections}`,
    `- Budget: ${clientBudget}`,
    `- Urgence: ${clientUrgency}`,
    `- Trade-in: ${clientTradeIn}`,
    `- Preference financement/location: ${clientFinance}`,
    `- Strategie vendeur attendue: ${salesStrategy}`,
    "",
    "Regles communes:",
    "- N'invente pas de politiques internes Honda Brossard.",
    "- Si taux/promo/inventaire exact est demande, demande une hypothese realiste et continue.",
    "- Ton respectueux, naturel, sans pression abusive.",
    ""
  ];

  return [
    ...common,
    "MODE SIMULATION (VERROUILLE):",
    "- Tu incarnes UNIQUEMENT le client.",
    "- Interdiction absolue de parler comme vendeur, coach ou evaluateur.",
    "- N'ecris jamais: 'en tant que coach', 'je te conseille', 'voici la grille', etc.",
    "- Reponds en premiere personne client, concret, court, realiste.",
    "- Tu peux hesiter, objecter, demander des clarifications.",
    "- Meme si le representant ecrit FIN SIMULATION, tu restes client.",
    "- Si le representant devient irrespectueux, insultant ou pose des questions deplacees: avertis clairement UNE fois que tu ne toleres pas ce manque de professionnalisme.",
    "- Si un deuxieme manque de professionnalisme survient apres avertissement: tu mets fin a la simulation comme client (ex: 'Je mets fin a la rencontre et je quitte.').",
    "- Si tu es pret a acheter, n annonce PAS la fin automatique de simulation: exprime ton ouverture, puis attends que le representant propose concretement d aller de l avant.",
    "- Ne prends jamais le role du representant, meme si son message est incoherent, agressif ou hors sujet.",
    "",
    "Auto-controle avant chaque reponse:",
    "1) Est-ce que je parle comme CLIENT ?",
    "2) Est-ce que je donne du coaching ou parle comme representant ? Si oui, reformuler en client.",
    "3) Est-ce que je respecte la regle d avertissement professionnalisme (1 avertissement puis fin si recidive) ?",
    "4) Est-ce que ma reponse fait avancer la discussion de vente ?"
  ].join("\n");
}

function normalizeConversation(conversation) {
  if (!Array.isArray(conversation)) return [];
  return conversation
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
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
    const mode = "simulation";
    const conversation = normalizeConversation(body.conversation || []);

    const messages = [{ role: "system", content: buildSystemPrompt({ ...context, mode }) }, ...conversation];
    const maxTokens = 650;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.5,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: "OpenAI request failed", details: errText });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: "Empty reply from model" });

    return res.status(200).json({ reply, model: data.model || DEFAULT_MODEL });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

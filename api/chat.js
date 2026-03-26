const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const { requireAuth, setAuthCors } = require("./_auth");
const { getModuleTopicBySlug, normalizeModuleLevel } = require("./_moduleTopics");

function buildSimulationSystemPrompt(context) {
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

function buildModuleSystemPrompt(context) {
  const level = normalizeModuleLevel(context?.level);
  const topic = context?.moduleTopic || getModuleTopicBySlug(context?.topicSlug);
  if (!topic) throw new Error("Sujet de module invalide");

  const knowledgeBase = topic.knowledgeBase || {};
  const levelKey = level === "Debutant" ? "beginner" : level === "Avance" ? "advanced" : "intermediate";
  const teachingPoints = Array.isArray(knowledgeBase[levelKey]) ? knowledgeBase[levelKey] : [];
  const roleplayNotes = Array.isArray(topic.roleplayNotes) ? topic.roleplayNotes : [];
  const coachingFocus = Array.isArray(topic.coachingFocus) ? topic.coachingFocus : [];

  return [
    "Tu es CoachVente Honda Brossard.",
    "Langue: francais quebecois professionnel.",
    "Contexte: module de formation interactif en vente automobile.",
    "",
    "SUJET DU MODULE:",
    `- Titre: ${topic.title}`,
    `- Categorie: ${topic.category}`,
    `- Niveau choisi: ${level}`,
    `- Resume pedagogique: ${topic.summary}`,
    `- Profil client simule: ${topic.customerProfile}`,
    "",
    "CRITERES DE REUSSITE:",
    ...topic.successCriteria.map((item) => `- ${item}`),
    "",
    "POINTS DE VIGILANCE POUR LE ROLEPLAY CLIENT:",
    ...roleplayNotes.map((item) => `- ${item}`),
    "",
    "CE QUE LE REPRESENTANT DEVRAIT DEMONTRER:",
    ...coachingFocus.map((item) => `- ${item}`),
    "",
    "NOTIONS A TRANSMETTRE AU REPRESENTANT:",
    ...teachingPoints.map((item) => `- ${item}`),
    "",
    "FORMAT ATTENDU:",
    "- S il n y a encore aucune reponse assistant dans la conversation, ta PREMIERE reponse doit contenir 4 sections courtes:",
    "  1) Contexte",
    "  2) Informations utiles pour reussir",
    "  3) Explication du sujet selon le niveau choisi",
    "  4) Debut de l echange",
    `- Dans la section 'Debut de l echange', termine par la premiere replique client suivante ou une variante tres proche: ${topic.clientOpening}`,
    "- Apres cette premiere reponse, tu incarnes UNIQUEMENT le client dans la conversation.",
    "- Une fois le module lance, tu ne donnes plus de coaching, plus de correction, plus de recap intermediaire.",
    "- Comme client, tu peux objecter, demander des precisions, comparer, hesiter ou demander de justifier la recommandation.",
    "- Reste coherent avec le sujet du module. Si le representant sort du sujet, ramene la conversation vers la situation client.",
    "- N invente pas de chiffres, programmes ou politiques specifiques si tu n en es pas certain.",
    "",
    "AUTO-CONTROLE:",
    "1) Si c est la premiere reponse assistant, est-ce que je respecte les 4 sections?",
    "2) Sinon, est-ce que je parle uniquement comme client?",
    "3) Est-ce que mes objections restent plausibles pour ce sujet?",
    "4) Est-ce que j aide a evaluer la maitrise du representant sans lui donner la reponse?"
  ].join("\n");
}

function buildSystemPrompt(context) {
  const mode = String(context?.mode || "simulation").toLowerCase();
  if (mode === "module") {
    return buildModuleSystemPrompt(context);
  }
  return buildSimulationSystemPrompt(context);
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
    const mode = String(context?.mode || "simulation").toLowerCase() === "module" ? "module" : "simulation";
    const conversation = normalizeConversation(body.conversation || []);

    const messages = [{ role: "system", content: buildSystemPrompt({ ...context, mode }) }, ...conversation];
    const maxTokens = mode === "module" ? 900 : 650;

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

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

function clampScore(value, fallback = 60) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function normalizeTrackScores(trackScores) {
  const src = trackScores && typeof trackScores === "object" ? trackScores : {};
  return {
    qualification: clampScore(src.qualification, 60),
    presentationProduit: clampScore(src.presentationProduit, 60),
    presentationPrix: clampScore(src.presentationPrix, 60)
  };
}

function computeGlobalScore(trackScores, fallbackScore = 60) {
  const q = clampScore(trackScores?.qualification, 60);
  const p = clampScore(trackScores?.presentationProduit, 60);
  const pr = clampScore(trackScores?.presentationPrix, 60);
  const weighted = q * 0.5 + p * 0.25 + pr * 0.25;
  const floor = Math.min(q, p, pr);
  const basePenalty = Math.max(0, 55 - floor) * 0.35;
  const qualificationPenalty = Math.max(0, 70 - q) * 0.55;
  const penalized = weighted - basePenalty - qualificationPenalty;
  const blended = (penalized * 0.8) + (clampScore(fallbackScore, 60) * 0.2);
  let finalScore = clampScore(blended, 60);
  if (q < 60) finalScore = Math.min(finalScore, 69);
  if (q < 50) finalScore = Math.min(finalScore, 59);
  if (q < 40) finalScore = Math.min(finalScore, 49);
  return finalScore;
}

function normalizeFeedbackItem(item, defaultHighlight, defaultImprovement) {
  const src = item && typeof item === "object" ? item : {};
  const pointMarquant = typeof src.pointMarquant === "string" && src.pointMarquant.trim()
    ? src.pointMarquant.trim()
    : defaultHighlight;
  const pisteAmelioration = typeof src.pisteAmelioration === "string" && src.pisteAmelioration.trim()
    ? src.pisteAmelioration.trim()
    : defaultImprovement;
  return { pointMarquant, pisteAmelioration };
}

function normalizeTrackFeedback(trackFeedback) {
  const src = trackFeedback && typeof trackFeedback === "object" ? trackFeedback : {};
  return {
    qualification: normalizeFeedbackItem(
      src.qualification,
      "Qualification de base observee pendant la discussion.",
      "Creuser davantage les besoins, contraintes et criteres de decision."
    ),
    presentationProduit: normalizeFeedbackItem(
      src.presentationProduit,
      "Presentation produit amorcee avec certains liens au besoin client.",
      "Ajouter plus d elements emotionnels et une demonstration orientee usage."
    ),
    presentationPrix: normalizeFeedbackItem(
      src.presentationPrix,
      "Presentation du prix abordee avec un premier scenario.",
      "Mieux relier la valeur, les options et le traitement des objections."
    )
  };
}

function normalizeChecklistLevel(value, fallback = "partiel") {
  const raw = String(value || "").toLowerCase();
  if (raw === "faible" || raw === "partiel" || raw === "solide") return raw;
  return fallback;
}

function normalizeQualificationChecklist(checklist) {
  const src = checklist && typeof checklist === "object" ? checklist : {};
  const general = src.infosGenerales && typeof src.infosGenerales === "object" ? src.infosGenerales : {};
  const technical = src.infosTechniques && typeof src.infosTechniques === "object" ? src.infosTechniques : {};
  return {
    infosGenerales: {
      motivationAchat: normalizeChecklistLevel(general.motivationAchat),
      raisonVisite: normalizeChecklistLevel(general.raisonVisite),
      optionsClientDifferenciation: normalizeChecklistLevel(general.optionsClientDifferenciation),
      pourquoiNous: normalizeChecklistLevel(general.pourquoiNous)
    },
    infosTechniques: {
      vehiculeActuelEtContexte: normalizeChecklistLevel(technical.vehiculeActuelEtContexte),
      vehiculeRechercheEtUsage: normalizeChecklistLevel(technical.vehiculeRechercheEtUsage),
      budgetFinancementDelais: normalizeChecklistLevel(technical.budgetFinancementDelais),
      criteresEtEquipements: normalizeChecklistLevel(technical.criteresEtEquipements)
    },
    profondeurQualification: clampScore(src.profondeurQualification, 60),
    clarteBesoinsFinaux: normalizeChecklistLevel(src.clarteBesoinsFinaux)
  };
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
    '  "trackScores": {',
    '    "qualification": number,',
    '    "presentationProduit": number,',
    '    "presentationPrix": number',
    "  },",
    '  "trackFeedback": {',
    '    "qualification": { "pointMarquant": "string", "pisteAmelioration": "string" },',
    '    "presentationProduit": { "pointMarquant": "string", "pisteAmelioration": "string" },',
    '    "presentationPrix": { "pointMarquant": "string", "pisteAmelioration": "string" }',
    "  },",
    '  "qualificationChecklist": {',
    '    "infosGenerales": {',
    '      "motivationAchat": "faible|partiel|solide",',
    '      "raisonVisite": "faible|partiel|solide",',
    '      "optionsClientDifferenciation": "faible|partiel|solide",',
    '      "pourquoiNous": "faible|partiel|solide"',
    "    },",
    '    "infosTechniques": {',
    '      "vehiculeActuelEtContexte": "faible|partiel|solide",',
    '      "vehiculeRechercheEtUsage": "faible|partiel|solide",',
    '      "budgetFinancementDelais": "faible|partiel|solide",',
    '      "criteresEtEquipements": "faible|partiel|solide"',
    "    },",
    '    "profondeurQualification": number,',
    '    "clarteBesoinsFinaux": "faible|partiel|solide"',
    "  },",
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
    "- Evalue la performance selon la track de vente en 3 etapes:",
    "  1) qualification du client (qualite des questions, profondeur, budget/delai/criteres, validation besoins)",
    "  2) presentation du produit (walk around, essai routier, lien emotionnel + rationnel avec besoins)",
    "  3) presentation des prix (valeur vs prix, scenarios, produits connexes, gestion objections/negociation)",
    "",
    "Regles SPECIFIQUES pour la qualification (priorite absolue):",
    "- Une bonne qualification couvre des informations generales ET techniques, avec profondeur.",
    "- Informations generales attendues:",
    "  a) Motivation d achat (point d inconfort: accident, nouveaux besoins, ajout vehicule, etc.)",
    "  b) Raison concrete de la visite aujourd hui (voir, essayer, chiffrer, negocier, acheter)",
    "  c) Options du client et alternatives (garder vehicule, multi-marques, neuf vs usage, contraintes)",
    "  d) Pourquoi la concession/marque/vehicule est consideree",
    "- Le vendeur doit demontrer une capacite de differenciation face aux options du client.",
    "- Informations techniques attendues (fiches Honda/Toyota):",
    "  a) Vehicule actuel, contexte et historique (annee/km/usage, echange, infos utiles)",
    "  b) Vehicule recherche et usage futur (modele/categorie, km-an, conducteur principal/secondaire)",
    "  c) Parametres d achat (budget, mise de fonds, mensualite, financement/location, delais)",
    "  d) Criteres/quipements (importants vs souhaites, securite, confort, cout d entretien, etc.)",
    "- profondeurQualification (0-100): mesure la qualite des questions de relance et la precision obtenue.",
    "- clarteBesoinsFinaux = 'solide' seulement si besoins + desirs + contraintes sont clairement etablis.",
    "- Si la qualification est incomplete/floue, trackScores.qualification doit etre basse (souvent < 60).",
    "- Si le representant n a PAS une idee claire des besoins/desirs/contraintes, la qualification est consideree non reussie.",
    "- Le score global doit rester limite meme si les autres etapes sont bonnes quand la qualification est faible.",
    "- trackScores.<etape> entre 0 et 100",
    "- trackFeedback.<etape>.pointMarquant = exemple concret observe (approche, phrase cle, action)",
    "- trackFeedback.<etape>.pisteAmelioration = action precise et praticable",
    "- qualificationChecklist.profondeurQualification entre 0 et 100",
    "- Le score global doit representer la probabilite de generer une vente",
    "- Le score global doit tenir compte des lacunes dans une etape, meme si la vente semble avancer",
    "- Utilise une logique proche de: qualification 50%, presentation produit 25%, presentation prix 25%, avec penalite forte si qualification faible",
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

    parsed.trackScores = normalizeTrackScores(parsed.trackScores);
    parsed.trackFeedback = normalizeTrackFeedback(parsed.trackFeedback);
    parsed.qualificationChecklist = normalizeQualificationChecklist(parsed.qualificationChecklist);
    parsed.score = computeGlobalScore(parsed.trackScores, parsed.score);

    return res.status(200).json({ evaluation: parsed, model: data.model || DEFAULT_MODEL });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

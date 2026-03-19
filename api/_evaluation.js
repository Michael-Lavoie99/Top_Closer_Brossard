const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

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
      "Presentation produit abordee avec un lien partiel aux priorites du client.",
      "Structurer la presentation en C.A.B et imposer l essai routier de facon professionnelle."
    ),
    presentationPrix: normalizeFeedbackItem(
      src.presentationPrix,
      "Presentation des offres amorcee avec des elements de transaction.",
      "Structurer l offre complete, travailler les objections et demander clairement le close."
    )
  };
}

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function applyPresentationProduitHardRules(trackScores, trackFeedback, conversation) {
  const repText = (Array.isArray(conversation) ? conversation : [])
    .filter((m) => m && m.role === "user" && typeof m.content === "string")
    .map((m) => m.content)
    .join(" \n ");

  const normalized = stripDiacritics(repText).toLowerCase();
  const essaiMatches = normalized.match(/\b(essai(?:e)?\s*routier|essai(?:e)?|test\s*drive)\b/g) || [];
  const essaiMentions = essaiMatches.length;
  const importanceMentioned = /\b(important|essentiel|imperatif|indispensable|valider|confirmer|ressentir|experience|sur\s+la\s+route)\b/.test(normalized);

  const hardFail = essaiMentions < 2 || !importanceMentioned;
  if (!hardFail) return false;

  trackScores.presentationProduit = Math.min(clampScore(trackScores.presentationProduit, 60), 45);
  trackFeedback.presentationProduit = normalizeFeedbackItem(
    {
      pointMarquant: "Presentation produit partielle observee, mais execution incomplete de l essai routier.",
      pisteAmelioration: "Imposer l essai routier avec 2 approches distinctes et expliquer clairement pourquoi il est essentiel pour valider le choix."
    },
    "Presentation produit partielle observee, mais execution incomplete de l essai routier.",
    "Imposer l essai routier avec 2 approches distinctes et expliquer clairement pourquoi il est essentiel pour valider le choix."
  );
  return true;
}

function applyPresentationPrixHardRules(trackScores, trackFeedback, conversation) {
  const repText = (Array.isArray(conversation) ? conversation : [])
    .filter((m) => m && m.role === "user" && typeof m.content === "string")
    .map((m) => m.content)
    .join(" \n ");

  const normalized = stripDiacritics(repText).toLowerCase();
  const mentionsComplementary = /\b(pneu|antivol|garantie|protection|accessoire|tag|assurance|traitement)\b/.test(normalized);
  const cabSignals = /\b(caracteristique|avantage|benefice|ce qui vous donne|donc pour vous|dans votre cas)\b/.test(normalized);
  const objectionSignals = /\b(objection|hesit|inquiet|bloqu|retient|empech|preoccup|si on respecte|qu est ce qui vous)\b/.test(normalized);
  const removeSignals = /\b(retir|enlev|supprim)\b/.test(normalized);
  const reasonSignals = /\b(pourquoi|raison|motif)\b/.test(normalized);
  const closeSignals = /\b(on va de l avant|aller de l avant|on procede|on avance|on finalise|on conclut|on reserve|on signe|votre accord|ask for close|ask le close)\b/.test(normalized);

  const failComplementary = mentionsComplementary && (!cabSignals || !objectionSignals || (removeSignals && !reasonSignals));
  const failClosing = !closeSignals || !objectionSignals;
  const hardFail = failComplementary || failClosing;
  if (!hardFail) return false;

  const reasonText = failComplementary && failClosing
    ? "Produits complementaires et closing non maitrises (C.A.B/objections/close)."
    : failComplementary
      ? "Produits complementaires mal executes (C.A.B/objections/raison de retrait)."
      : "Closing incomplet: pas de close clair et/ou objections finales non travaillees.";

  trackScores.presentationPrix = Math.min(clampScore(trackScores.presentationPrix, 60), 45);
  trackFeedback.presentationPrix = normalizeFeedbackItem(
    {
      pointMarquant: "Presentation de prix amorcee, mais execution commerciale incomplete.",
      pisteAmelioration: `${reasonText} Expliquer l offre complete, traiter les objections puis demander explicitement d aller de l avant.`
    },
    "Presentation de prix amorcee, mais execution commerciale incomplete.",
    `${reasonText} Expliquer l offre complete, traiter les objections puis demander explicitement d aller de l avant.`
  );
  return true;
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
    "  2) presentation du produit (expertise technique, C.A.B, essai routier impose)",
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
    "",
    "Regles SPECIFIQUES pour la presentation du produit:",
    "- Volet 1: Reponses techniques du client",
    "  a) Le representant doit repondre de facon exacte, confiante et professionnelle.",
    "  b) Le representant fort va chercher la raison derriere la question pour rassurer ou renforcer l element important pour le client.",
    "- Volet 2: Presentation du vehicule en C.A.B (Caracteristique, Avantage, Benefice)",
    "  a) Presenter les caracteristiques pertinentes au besoin (espace, confort, securite, techno, etc.).",
    "  b) Lier caracteristique -> avantage -> benefice concret pour CE client.",
    "  c) Une bonne note exige: majorite des questions clients traitees + nouvelles informations utiles partagees.",
    "  d) Si les caracteristiques du vehicule sont peu ou pas discutees, la note presentationProduit doit etre fortement reduite.",
    "- Volet 3: Essai routier (obligatoire)",
    "  a) L essai routier est imperatif et doit etre impose avec respect, pas seulement suggere.",
    "  b) Si le client hesite, le representant doit proposer au moins 2 approches distinctes pour faire l essai.",
    "  c) Si essai routier seulement propose une fois OU sans insister sur son importance -> echec automatique de presentationProduit.",
    "  d) En echec automatique, presentationProduit doit rester basse (en pratique <= 45).",
    "",
    "Regles SPECIFIQUES pour la presentation des prix:",
    "- Volet 1: Budget approximatif (poids mineur mais obligatoire en coherence)",
    "  a) Le representant doit relier le budget client a une fourchette realiste de paiement/prix selon le type de vehicule.",
    "  b) Si le budget ne cadre pas, il doit reajuster le tir ou reorienter vers une option coherente.",
    "- Volet 2: Presentation complete de l offre",
    "  a) Expliquer clairement: paiement, taux, details transaction (PDSF/frais/taxes), valeur d echange et impact fiscal, prix taxes incluses.",
    "  b) Pouvoir repondre aux questions techniques a la demande (cout total avec interets, depot multiple, risques gros acompte location, option financement/location/cash selon besoins).",
    "  c) Si les bases ne sont pas claires OU si les questions techniques ne sont pas maitrisees, presentationPrix doit chuter fortement.",
    "- Volet 3: Produits complementaires",
    "  a) Presenter la valeur des produits complementaires sans pression.",
    "  b) Utiliser C.A.B, traiter les objections de base, et ouvrir la porte au directeur commercial.",
    "  c) Si produits complementaires presentes sans C.A.B OU objections non traitees OU produits retires sans comprendre la raison -> echec automatique presentationPrix.",
    "- Volet 4: Closing",
    "  a) Quand le scenario cible est trouve, le representant doit demander explicitement d aller de l avant (ask le close) et traiter les dernieres objections.",
    "  b) S il ne demande pas l achat OU ne traite pas les objections -> echec automatique presentationPrix.",
    "  c) Si fermeture difficile, il doit preparer le terrain pour le directeur des ventes.",
    "- En echec automatique, presentationPrix doit rester basse (en pratique <= 45).",
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

async function runEvaluation({ context, conversation, apiKey }) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const messages = [
    { role: "system", content: buildPrompt(context || {}) },
    ...normalizeConversation(conversation || []),
    { role: "user", content: "Fais maintenant l evaluation JSON." }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
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
    throw new Error(`OpenAI request failed: ${errText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty reply from model");

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
  parsed.presentationProduitAutoFail = applyPresentationProduitHardRules(
    parsed.trackScores,
    parsed.trackFeedback,
    conversation
  );
  parsed.presentationPrixAutoFail = applyPresentationPrixHardRules(
    parsed.trackScores,
    parsed.trackFeedback,
    conversation
  );
  parsed.score = computeGlobalScore(parsed.trackScores, parsed.score);
  return { evaluation: parsed, model: data.model || DEFAULT_MODEL };
}

module.exports = {
  normalizeConversation,
  runEvaluation
};

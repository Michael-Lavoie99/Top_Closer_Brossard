const { requireAuth, setAuthCors } = require("./_auth");

const FALLBACK_CLIENTS = [
  {
    id: 1,
    name: "Famille pragmatique",
    segment: "Famille",
    difficulty: "IntermÃ©diaire",
    persona: "Couple avec un enfant, veut un VUS polyvalent sans dÃ©passer le budget mensuel.",
    needs: "Espace, sÃ©curitÃ©, fiabilitÃ©, paiement stable.",
    objections: "Paiement trop Ã©levÃ©, peur des frais cachÃ©s.",
    budget_range: "550-700 CAD/mois",
    urgency: "30 jours",
    trade_in: "Hyundai Elantra 2018",
    financing_preference: "HÃ©site entre achat et location",
    sales_strategy: "DÃ©couverte structurÃ©e + comparaison claire de 2 options max + cadrage des coÃ»ts totaux."
  },
  {
    id: 2,
    name: "Navetteur analytique",
    segment: "Solo",
    difficulty: "IntermÃ©diaire",
    persona: "Professionnel qui roule beaucoup et compare 2-3 marques de maniÃ¨re rationnelle.",
    needs: "Consommation, coÃ»t total, transparence.",
    objections: "Sceptique sur les frais concession.",
    budget_range: "450-600 CAD/mois",
    urgency: "2-6 semaines",
    trade_in: "Aucun",
    financing_preference: "Financement",
    sales_strategy: "Utiliser des chiffres simples, preuves concrÃ¨tes et rÃ©ponses factuelles sans pression."
  },
  {
    id: 3,
    name: "Client pressÃ©",
    segment: "Urgence",
    difficulty: "DÃ©butant",
    persona: "Besoin d'un vÃ©hicule trÃ¨s vite, peu de temps pour magasiner.",
    needs: "DisponibilitÃ© rapide, processus efficace.",
    objections: "Peur de perdre du temps.",
    budget_range: "600-850 CAD/mois",
    urgency: "Cette semaine",
    trade_in: "SUV 2017",
    financing_preference: "Ouvert",
    sales_strategy: "Diriger la vente par Ã©tapes courtes, confirmer rapidement la prochaine action."
  },
  {
    id: 4,
    name: "Acheteur prix d'abord",
    segment: "Prix",
    difficulty: "IntermÃ©diaire",
    persona: "Ne parle presque que du paiement mensuel et du rabais.",
    needs: "MensualitÃ© basse, clartÃ©.",
    objections: "" ,
    budget_range: "400-550 CAD/mois",
    urgency: "15-30 jours",
    trade_in: "Compacte 2016",
    financing_preference: "Location",
    sales_strategy: "Recentrer sur valeur/coÃ»t total et proposer 2 scÃ©narios de paiement transparents."
  },
  {
    id: 5,
    name: "Client sceptique",
    segment: "Confiance",
    difficulty: "AvancÃ©",
    persona: "Mauvaise expÃ©rience passÃ©e en concession, faible confiance au dÃ©part.",
    needs: "Preuve de transparence, respect.",
    objections: "Crainte de se faire pousser.",
    budget_range: "500-750 CAD/mois",
    urgency: "30-45 jours",
    trade_in: "Berline 2015",
    financing_preference: "Financement",
    sales_strategy: "Empathie + permission + validation frÃ©quente; zÃ©ro pression et engagement progressif."
  },
  {
    id: 6,
    name: "Jeune premier achat",
    segment: "Nouveau conducteur",
    difficulty: "DÃ©butant",
    persona: "Premier achat auto, anxieux face au financement.",
    needs: "Ã‰ducation, simplicitÃ©, sÃ©curitÃ©.",
    objections: "Ne comprend pas bien location vs achat.",
    budget_range: "350-500 CAD/mois",
    urgency: "2 mois",
    trade_in: "Aucun",
    financing_preference: "IndÃ©cis",
    sales_strategy: "Ã‰duquer sans jargon, reformuler souvent, faire valider chaque Ã©tape."
  },
  {
    id: 7,
    name: "Client fidÃ©litÃ© marque",
    segment: "FidÃ©lisation",
    difficulty: "IntermÃ©diaire",
    persona: "PossÃ¨de dÃ©jÃ  une Honda, veut upgrader mais hÃ©site sur le moment.",
    needs: "Valeur de reprise, nouveautÃ© utile.",
    objections: "Peut attendre encore 1 an.",
    budget_range: "550-800 CAD/mois",
    urgency: "Flexible",
    trade_in: "Honda Civic 2020",
    financing_preference: "Financement",
    sales_strategy: "Capitaliser sur historique positif + dÃ©montrer gains concrets de l'upgrade."
  },
  {
    id: 8,
    name: "Client orientÃ© techno",
    segment: "Technologie",
    difficulty: "AvancÃ©",
    persona: "Veut les fonctions avancÃ©es et compare les versions en dÃ©tail.",
    needs: "Aides Ã  la conduite, connectivitÃ©.",
    objections: "Peur de payer trop pour des options inutiles.",
    budget_range: "650-900 CAD/mois",
    urgency: "3-5 semaines",
    trade_in: "Aucun",
    financing_preference: "Location",
    sales_strategy: "Qualifier les vrais usages techno, dÃ©montrer la valeur par cas concret."
  },
  {
    id: 9,
    name: "Client flotte PME",
    segment: "B2B",
    difficulty: "AvancÃ©",
    persona: "PropriÃ©taire de PME, regarde 2 vÃ©hicules pour son Ã©quipe.",
    needs: "FiabilitÃ©, coÃ»ts prÃ©visibles, service.",
    objections: "NÃ©gociation ferme sur volume.",
    budget_range: "Variable",
    urgency: "4-8 semaines",
    trade_in: "Pick-up 2019",
    financing_preference: "Financement",
    sales_strategy: "Approche consultative business, chiffrage total et suivi structurÃ©."
  },
  {
    id: 10,
    name: "Client indÃ©cis chronique",
    segment: "DÃ©cision",
    difficulty: "AvancÃ©",
    persona: "Passe d'un modÃ¨le Ã  l'autre, peur de regretter.",
    needs: "ClartÃ© dÃ©cisionnelle, comparaison nette.",
    objections: "Repousse la dÃ©cision.",
    budget_range: "500-700 CAD/mois",
    urgency: "Aucune",
    trade_in: "Mazda 2017",
    financing_preference: "IndÃ©cis",
    sales_strategy: "Limiter les options, utiliser critÃ¨res pondÃ©rÃ©s et conclure avec next step datÃ©e."
  },
  {
    id: 11,
    name: "Chauffeur Uber budget serre",
    segment: "Mobilite urbaine",
    difficulty: "IntermÃ©diaire",
    persona: "Cherche un vehicule pour faire du Uber avec budget tres serre.",
    needs: "Paiement bas, fiabilite mecanique, confort passagers, bonne consommation.",
    objections: "Craint les couts d entretien et doute de la rentabilite.",
    budget_range: "350-450 CAD/mois",
    urgency: "2-4 semaines",
    trade_in: "Berline 2014",
    financing_preference: "Financement",
    sales_strategy: "Valider kilometrage annuel, presenter options economiques et cout total mensuel clair."
  },
  {
    id: 12,
    name: "Explorateur multi-marques Taschereau",
    segment: "Exploration",
    difficulty: "DÃ©butant",
    persona: "Debut de magasinage sur le boulevard Taschereau, compare plusieurs marques.",
    needs: "Infos simples, comparaison rapide, premiere impression positive.",
    objections: "Ne veut pas s engager, dit qu il magasine seulement.",
    budget_range: "500-750 CAD/mois",
    urgency: "1-3 mois",
    trade_in: "Aucun",
    financing_preference: "IndÃ©cis",
    sales_strategy: "Approche consultation, questions ouvertes courtes et proposition d une prochaine etape sans pression."
  },
  {
    id: 13,
    name: "Visite eclair indecis",
    segment: "Temps limite",
    difficulty: "AvancÃ©",
    persona: "Entre pour des infos sommaires, peu de temps, besoins et budget flous.",
    needs: "Discussion ultra concise, clarte, orientation rapide.",
    objections: "Impatient, reponses courtes, difficile a faire progresser.",
    budget_range: "Budget inconnu",
    urgency: "Non defini",
    trade_in: "Vehicule actuel inconnu",
    financing_preference: "IndÃ©cis",
    sales_strategy: "Qualifier en 3 questions prioritaires, proposer mini-plan et prise de rendez-vous court."
  }
  ,
  {
    id: 14,
    name: "Chauffeur Uber operationnel",
    segment: "Uber",
    difficulty: "IntermÃƒÂ©diaire",
    persona: "Chauffeur Uber qui doit travailler avec un vehicule conforme et rentable.",
    needs: "Paiement entre 300 et 500 CAD/mois, fiabilite, confort passagers, vehicule admissible Uber.",
    objections: "Peur d'avoir une equite negative et de depasser le budget mensuel.",
    budget_range: "300-500 CAD/mois",
    urgency: "2-6 semaines",
    trade_in: "Vehicule actuel potentiellement limite par l age",
    financing_preference: "Financement",
    sales_strategy: "Qualifier budget et mise de fonds, verifier admissibilite Uber, proposer option fiable sans equite negative."
  },
  {
    id: 15,
    name: "Magasinage boulevard Taschereau",
    segment: "Taschereau",
    difficulty: "AvancÃƒÂ©",
    persona: "Client reserve qui compare plusieurs concessions sur Taschereau.",
    needs: "Developper confiance rapidement, comprendre son besoin reel, avancer le processus d achat.",
    objections: "Ne veut pas donner ses infos trop vite et craint la pression.",
    budget_range: "Variable",
    urgency: "1-3 mois",
    trade_in: "A determiner",
    financing_preference: "Indecis",
    sales_strategy: "Approche douce, forte ecoute, differenciation service et prochaine etape planifiee."
  },
  {
    id: 16,
    name: "Nouvel arrivant finance restreint",
    segment: "Nouvel Arrivant",
    difficulty: "AvancÃƒÂ©",
    persona: "Nouveau resident avec historique de credit limite et contraintes de financement.",
    needs: "Trouver un vehicule financable malgre restrictions et budget cible souvent sous 10 000 CAD.",
    objections: "Inquiet de l approbation credit, mise de fonds et paiement mensuel.",
    budget_range: "Sous 10 000 CAD (ou paiement equivalent)",
    urgency: "2-8 semaines",
    trade_in: "Aucun",
    financing_preference: "Financement adapte",
    sales_strategy: "Qualification finance precise (statut, revenu, permis, dossier), puis option realiste admissible."
  },
  {
    id: 17,
    name: "Comparatif Honda vs Toyota",
    segment: "Honda vs Toyota",
    difficulty: "IntermÃƒÂ©diaire",
    persona: "Client qui compare les marques les plus fiables (Honda, Toyota, parfois Subaru).",
    needs: "Voir clairement les forces Honda selon ses priorites reelles.",
    objections: "Hesite entre marques et demande des preuves concretes.",
    budget_range: "450-850 CAD/mois",
    urgency: "2-6 semaines",
    trade_in: "Variable",
    financing_preference: "Achat ou location",
    sales_strategy: "Qualifier priorites, relier aux avantages Honda (confort, insonorisation, valeur revente, delais)."
  }
];

async function loadClientsFromSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return FALLBACK_CLIENTS;
  }

  const endpoint = `${process.env.SUPABASE_URL}/rest/v1/client_profiles?select=id,name,segment,difficulty,persona,needs,objections,budget_range,urgency,trade_in,financing_preference,sales_strategy&order=id.asc`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    return FALLBACK_CLIENTS;
  }

  return data;
}

module.exports = async (req, res) => {
  setAuthCors(res, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const clients = await loadClientsFromSupabase();
    res.status(200).json({ clients });
  } catch (error) {
    res.status(200).json({
      clients: FALLBACK_CLIENTS,
      warning: error instanceof Error ? error.message : "Unknown supabase error"
    });
  }
};

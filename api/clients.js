const { requireAuth, setAuthCors } = require("./_auth");

const FALLBACK_CLIENTS = [
  {
    id: 1,
    name: "Famille pragmatique",
    segment: "Famille",
    difficulty: "Intermédiaire",
    persona: "Couple avec un enfant, veut un VUS polyvalent sans dépasser le budget mensuel.",
    needs: "Espace, sécurité, fiabilité, paiement stable.",
    objections: "Paiement trop élevé, peur des frais cachés.",
    budget_range: "550-700 CAD/mois",
    urgency: "30 jours",
    trade_in: "Hyundai Elantra 2018",
    financing_preference: "Hésite entre achat et location",
    sales_strategy: "Découverte structurée + comparaison claire de 2 options max + cadrage des coûts totaux."
  },
  {
    id: 2,
    name: "Navetteur analytique",
    segment: "Solo",
    difficulty: "Intermédiaire",
    persona: "Professionnel qui roule beaucoup et compare 2-3 marques de manière rationnelle.",
    needs: "Consommation, coût total, transparence.",
    objections: "Sceptique sur les frais concession.",
    budget_range: "450-600 CAD/mois",
    urgency: "2-6 semaines",
    trade_in: "Aucun",
    financing_preference: "Financement",
    sales_strategy: "Utiliser des chiffres simples, preuves concrètes et réponses factuelles sans pression."
  },
  {
    id: 3,
    name: "Client pressé",
    segment: "Urgence",
    difficulty: "Débutant",
    persona: "Besoin d'un véhicule très vite, peu de temps pour magasiner.",
    needs: "Disponibilité rapide, processus efficace.",
    objections: "Peur de perdre du temps.",
    budget_range: "600-850 CAD/mois",
    urgency: "Cette semaine",
    trade_in: "SUV 2017",
    financing_preference: "Ouvert",
    sales_strategy: "Diriger la vente par étapes courtes, confirmer rapidement la prochaine action."
  },
  {
    id: 4,
    name: "Acheteur prix d'abord",
    segment: "Prix",
    difficulty: "Intermédiaire",
    persona: "Ne parle presque que du paiement mensuel et du rabais.",
    needs: "Mensualité basse, clarté.",
    objections: "" ,
    budget_range: "400-550 CAD/mois",
    urgency: "15-30 jours",
    trade_in: "Compacte 2016",
    financing_preference: "Location",
    sales_strategy: "Recentrer sur valeur/coût total et proposer 2 scénarios de paiement transparents."
  },
  {
    id: 5,
    name: "Client sceptique",
    segment: "Confiance",
    difficulty: "Avancé",
    persona: "Mauvaise expérience passée en concession, faible confiance au départ.",
    needs: "Preuve de transparence, respect.",
    objections: "Crainte de se faire pousser.",
    budget_range: "500-750 CAD/mois",
    urgency: "30-45 jours",
    trade_in: "Berline 2015",
    financing_preference: "Financement",
    sales_strategy: "Empathie + permission + validation fréquente; zéro pression et engagement progressif."
  },
  {
    id: 6,
    name: "Jeune premier achat",
    segment: "Nouveau conducteur",
    difficulty: "Débutant",
    persona: "Premier achat auto, anxieux face au financement.",
    needs: "Éducation, simplicité, sécurité.",
    objections: "Ne comprend pas bien location vs achat.",
    budget_range: "350-500 CAD/mois",
    urgency: "2 mois",
    trade_in: "Aucun",
    financing_preference: "Indécis",
    sales_strategy: "Éduquer sans jargon, reformuler souvent, faire valider chaque étape."
  },
  {
    id: 7,
    name: "Client fidélité marque",
    segment: "Fidélisation",
    difficulty: "Intermédiaire",
    persona: "Possède déjà une Honda, veut upgrader mais hésite sur le moment.",
    needs: "Valeur de reprise, nouveauté utile.",
    objections: "Peut attendre encore 1 an.",
    budget_range: "550-800 CAD/mois",
    urgency: "Flexible",
    trade_in: "Honda Civic 2020",
    financing_preference: "Financement",
    sales_strategy: "Capitaliser sur historique positif + démontrer gains concrets de l'upgrade."
  },
  {
    id: 8,
    name: "Client orienté techno",
    segment: "Technologie",
    difficulty: "Avancé",
    persona: "Veut les fonctions avancées et compare les versions en détail.",
    needs: "Aides à la conduite, connectivité.",
    objections: "Peur de payer trop pour des options inutiles.",
    budget_range: "650-900 CAD/mois",
    urgency: "3-5 semaines",
    trade_in: "Aucun",
    financing_preference: "Location",
    sales_strategy: "Qualifier les vrais usages techno, démontrer la valeur par cas concret."
  },
  {
    id: 9,
    name: "Client flotte PME",
    segment: "B2B",
    difficulty: "Avancé",
    persona: "Propriétaire de PME, regarde 2 véhicules pour son équipe.",
    needs: "Fiabilité, coûts prévisibles, service.",
    objections: "Négociation ferme sur volume.",
    budget_range: "Variable",
    urgency: "4-8 semaines",
    trade_in: "Pick-up 2019",
    financing_preference: "Financement",
    sales_strategy: "Approche consultative business, chiffrage total et suivi structuré."
  },
  {
    id: 10,
    name: "Client indécis chronique",
    segment: "Décision",
    difficulty: "Avancé",
    persona: "Passe d'un modèle à l'autre, peur de regretter.",
    needs: "Clarté décisionnelle, comparaison nette.",
    objections: "Repousse la décision.",
    budget_range: "500-700 CAD/mois",
    urgency: "Aucune",
    trade_in: "Mazda 2017",
    financing_preference: "Indécis",
    sales_strategy: "Limiter les options, utiliser critères pondérés et conclure avec next step datée."
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

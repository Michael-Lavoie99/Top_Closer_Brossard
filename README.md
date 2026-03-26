# Top_Closer_Brossard

CoachVente Honda Brossard est un simulateur de vente connecté à ChatGPT avec une galerie de clients dynamique (Supabase).

## Nouvelles fonctionnalités
- Galerie de profils clients (10+) pilotée par Supabase
- Carte "Client aléatoire" qui choisit un profil surprise
- Le chat s'ouvre uniquement au clic sur un client
- Le profil client influence directement le comportement de l'IA et la stratégie de vente attendue
- Thème visuel avec accents rouges Honda
- Fin manuelle via bouton + fin auto si le client est prêt à acheter

## Architecture
- `index.html` : UI galerie + chat + logique session
- `api/chat.js` : proxy OpenAI + prompt système orienté par profil client
- `api/clients.js` : récupération des profils clients depuis Supabase (fallback local)
- `supabase/seed_clients.sql` : table + RLS + 10 clients initiaux

## Variables d'environnement (Vercel)
Ajoute dans `Project Settings -> Environment Variables` :

- `OPENAI_API_KEY` : clé API OpenAI
- `OPENAI_MODEL` : optionnel (`gpt-4.1-mini` par défaut)
- `SUPABASE_URL` : URL du projet Supabase (ex: `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` : clé service role (serveur uniquement)

## Setup Supabase
1. Ouvre SQL Editor dans Supabase.
2. Exécute le script `supabase/seed_clients.sql`.
3. Vérifie que la table `public.client_profiles` contient les profils.

## Déploiement
1. Push le repo.
2. Déploie/re-déploie sur Vercel.
3. Ouvre le site, choisis un client dans la galerie.

## Sécurité
- Ne jamais exposer `OPENAI_API_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` dans le frontend.
- Les clés sensibles sont utilisées uniquement dans les routes `api/*` côté serveur.

## Authentification Google
Variables ajoutees :
- `GOOGLE_CLIENT_ID` : Client ID OAuth Web Google (Google Sign-In)
- `AUTH_SESSION_SECRET` : secret long (32+ caracteres) pour signer les sessions
- `ALLOWED_GOOGLE_DOMAINS` : optionnel, domaines autorises separes par virgules (ex: `hondabrossard.com`)
- `ALLOWED_GOOGLE_EMAILS` : optionnel, liste blanche d emails autorises separes par virgules

## Gestion des roles (admin/manager/representant)
1. Dans Supabase SQL Editor, execute `supabase/seed_users.sql`.
2. Ouvre la table `public.app_users` et remplace `admin@hondabrossard.com` par ton vrai courriel admin.
3. Connecte-toi avec cet email admin.
4. Dans l'application, utilise le bouton `Gestion utilisateurs` pour ajouter/modifier les comptes.
5. Un utilisateur doit etre `is_active=true` pour se connecter.

## Historique des simulations
- Chaque simulation est enregistree dans `public.simulation_runs` (transcript complet + evaluation).
- Endpoint backend: `api/simulations.js`.
- Setup SQL requis: executer `supabase/seed_simulations.sql` dans Supabase SQL Editor.

## Modules de formation
- La section `2. Axe sur amelioration` propose maintenant des modules interactifs par sujet et par niveau.
- Les sujets sont centralises dans `api/_moduleTopics.js` pour faciliter l ajout de nouveaux modules.
- Chaque module est enregistre dans `public.training_module_runs` (script + evaluation + corrections).
- Endpoint backend: `api/modules.js`.
- Setup SQL requis: executer `supabase/seed_training_modules.sql` dans Supabase SQL Editor.

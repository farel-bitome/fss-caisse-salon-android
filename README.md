# FSS-CAISSE-SALON Mobile (Android)

Version Android **autonome** de FSS-CAISSE-SALON — toutes les données (ventes,
personnel, clients, paie...) sont stockées **uniquement sur le téléphone/tablette**,
sans connexion à un serveur, à un PC, ni à internet.

## Fonctionnalités incluses

- **Connexion** avec compte **BITOME** protégé (mot de passe `Chrisrelamour24`)
- **Ouverture de caisse** obligatoire pour les rôles Caissier/Caissière
- **Caisse** : catalogue par catégorie, panier, encaissement (Espèces avec
  calculatrice de billets, ou Carte), ticket imprimé au format **58mm**
- **Fidélité** : fiche client, carte à 10 visites, choix de récompense
- **Historique** : ventes passées, réimpression
- **Prestations** : gestion des prestations et catégories
- **Personnel** : liste, poste, salaire de base
- **Utilisateurs** : comptes multiples avec rôles
- **Pointage** : arrivée/départ, historique du jour
- **Paie** : saisie mensuelle par employé, état de paie et bulletins imprimables
- **Bilan** : chiffre d'affaires par collaborateur (jour/semaine/mois/année),
  avec diagramme, imprimable
- **Clôture** : prélèvements (bloqués si caisse insuffisante), solde en caisse,
  imprimable
- **Réglages** : informations du salon, devise, récompenses fidélité, numérotation

## Volontairement absent

- **Connexion réelle à un TPE** : aucune marque n'étant choisie, le mode "Carte"
  enregistre juste que le paiement a été fait par carte, sans vraie communication
  avec un terminal physique
- **Synchronisation** avec le PC (FSS-CAISSE-SALON Electron) ou avec un autre
  téléphone — chaque appareil est totalement indépendant, avec ses propres données

## Impression

Utilise le système d'impression natif d'Android, avec un format suggéré de
**58mm** (adapté aux TPE avec imprimante intégrée). Assurez-vous que
l'application/le pilote de votre imprimante Bluetooth est installée sur le
téléphone pour qu'elle apparaisse dans la liste au moment d'imprimer.

## Compiler l'APK

1. Publiez ce dossier sur GitHub (dépôt **privé**)
2. Onglet **Actions** → **Build Android APK** → **Run workflow**
3. Téléchargez l'artefact `fss-caisse-salon-mobile-apk`, dézippez pour
   récupérer le `.apk`
4. Transférez-le sur le téléphone et installez (autoriser "source inconnue")

## Limites connues

- Les données restent sur l'appareil : perte du téléphone = perte des données
  (pas de sauvegarde automatique)
- Aucun test réel n'a pu être effectué sur un vrai appareil Android de mon
  côté — signalez tout bug rencontré

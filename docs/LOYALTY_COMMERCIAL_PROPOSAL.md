# Fidélisation chez Salut Bon Bon Thé : deux propositions

**Document préparé par Gaban Solutions à l’intention du propriétaire**
Statut : proposition commerciale et état d’avancement technique, aucune activation commerciale n’a eu lieu.

> **Mise à jour 2026-11-19 : l’option A (9 boissons achetées, la 10e gratuite) est maintenant celle qui est développée et remplace l’option B dans le site (carte de tampons avec barre de progression, migration 010). Voir [Récompenses](REWARDS.md). Le texte ci-dessous est conservé comme historique de la proposition.**
>
> **En bref.** Nous vous présentons deux façons de récompenser vos clients fidèles. Pour l’aperçu du site, nous avons réalisé l’**option B, Récompenses Salut** (10 points par 1 $, 1 000 points = 5 $ de rabais), parce qu’elle s’appuie sur le moteur de fidélité déjà construit. L’**option A, la carte de fidélité numérique** (9 boissons achetées, la 10e gratuite), est présentée comme **proposition seulement** : elle n’est pas développée. Rien dans ce document ne constitue une promesse de résultats de vente, et aucun prix de boisson n’a été inventé : tous les montants ci-dessous sont des **exemples chiffrés**, pas des prix de votre menu.

---

## 1. Ce que nous cherchons à accomplir

- Donner une raison simple de revenir : le client comprend en quelques secondes ce qu’il gagne.
- Contrôler le coût : savoir à tout moment ce que le programme peut coûter, et pouvoir l’ajuster.
- Protéger la boutique : limiter les abus et garder une trace de chaque opération.
- Respecter les clients : ne demander que le strict nécessaire, expliquer clairement les règles.

---

## 2. OPTION A — CARTE FIDÉLITÉ DIGITALE

**9 boissons admissibles achetées, la dixième gratuite.**

> **Statut : développée (2026-11-19).** Carte de tampons sur le moteur de fidélité existant, programme encore inactif tant que l’ADMIN ne l’active pas.

### Fonctionnement

Chaque boisson admissible achetée ajoute un tampon à la carte numérique du client. Après 9 tampons, la 10e boisson admissible est offerte. Le tampon est ajouté par l’équipe en magasin ou, pour une commande en ligne, une fois la commande remise.

### Expérience client

- Lecture immédiate : « Encore 3 boissons et la prochaine est gratuite ».
- Une carte dans le téléphone, sans compte obligatoire si nous réutilisons l’approche « carte invité » de l’option B.
- Aucune notion de dollars ni de taux à comprendre.

### Avantages commerciaux

- Très facile à expliquer et à afficher au comptoir.
- Valorise la **fréquence** d’achat plutôt que la taille du panier.
- Récompense attendue et concrète : une boisson, pas un rabais abstrait.

### Coûts potentiels

- Le coût **nominal** d’une récompense est le prix de vente de la boisson offerte. Illustration arithmétique (exemple, non un prix du menu) : si les 10 boissons coûtent chacune 7,00 $, le client paie 63,00 $ pour 70,00 $ de produits, soit environ **10 % de rabais nominal** sur l’ensemble.
- Cette valeur nominale **n’est pas le coût réel** pour la boutique. Le coût marginal (ingrédients, gobelet, main-d’œuvre déjà en place) est généralement inférieur au prix de vente, mais nous ne l’avons pas mesuré : il dépend de vos recettes et de vos coûts. Il ne faut pas confondre coût nominal, coût marginal et rentabilité.
- Le taux de **non-utilisation** des cartes (clients qui ne complètent jamais leur carte) est inconnu avant de mesurer.
- Risque d’**érosion de marge** si la boisson gratuite est toujours la plus chère du menu.

### Risques d’abus

| Risque | Atténuation recommandée |
| --- | --- |
| Le client fait choisir la boisson la plus chère pour la 10e | Plafond de valeur (montant à fixer par le propriétaire) ou « la moins chère des 10 » |
| Plusieurs tampons sur un même achat | Un tampon par boisson, plafond par transaction |
| Tampons fabriqués ou répétés | Identification par code QR à usage unique, journal des opérations |
| Boissons à rabais ou gratuites qui comptent | Exclure les articles en promotion et les boissons gratuites |
| Cartes multipliées pour contourner les règles | Limite d’une carte active par client, contrôles au comptoir |

### Limites de valeur et d’admissibilité recommandées

*(À approuver par le propriétaire — aucune valeur n’est fixée ici.)*

- Catégories de boissons admissibles (exclure, par exemple, les articles à très faible prix ou les extras seuls).
- Valeur maximale de la boisson gratuite.
- Nombre maximal de tampons par visite.
- Non cumulable avec une autre promotion ?
- Délai de validité d’une carte : aucune politique n’est décidée.

### Besoins techniques

- Nouveau modèle de données par tampon (par ligne de produit admissible), distinct du grand livre de points.
- Table d’admissibilité des produits et plafond de valeur.
- Flux de récompense « article gratuit » au comptoir et, si souhaité, en ligne.
- Réutilisation possible des comptes, des codes QR et des contrôles d’accès déjà construits.
- Aucune intégration avec un système de caisse externe n’existe aujourd’hui.

### Règles à faire approuver

Boissons admissibles · plafond de valeur · tampons par visite · cumul avec promotions · expiration · remboursements (retrait du tampon) · conditions affichées au client.

---

## 3. OPTION B — RÉCOMPENSES SALUT

**10 points par 1 $ CAD admissible. 1 000 points = 5 $ de rabais.**

> ### ★ OPTION RETENUE POUR LE PREVIEW

### Fonctionnement

- Le client gagne **10 points pour chaque 1 $ admissible**, calculé sur le **sous-total avant taxes**. C’est l’équivalent de **5 %** du montant admissible, en points.
- À **1 000 points**, le client échange ses points contre **5 $ de rabais**.
- Les points ne s’accumulent **pas** sur les taxes, les pourboires, les rabais, les récompenses échangées ni les montants remboursés. Aucun point n’est accordé pour une commande annulée.
- Calcul en cents entiers, **une seule fois par commande**, arrondi à l’inférieur : 10,99 $ donnent 109 points (jamais 110).

### Exemples d’accumulation

*(Montants hypothétiques pour illustrer le calcul, pas des prix du menu.)*

| Achat admissible avant taxes | Points | Valeur équivalente | Progrès vers 1 000 points |
| --- | --- | --- | --- |
| 10,99 $ | 109 | 0,54 $ | 11 % |
| 20,00 $ | 200 | 1,00 $ | 20 % |
| 50,00 $ | 500 | 2,50 $ | 50 % |
| 100,00 $ | 1 000 | 5,00 $ | 100 % (récompense atteinte) |

Après un remboursement de 40 % d’une commande ayant rapporté 100 points : 60 points sont conservés, 40 sont repris. Après un remboursement complet : tous les points de la commande sont repris.

### Expérience client

- Une **page publique** (`/fr/recompenses`, `/en/rewards`) explique le programme et propose un **calculateur** sans demander aucune information personnelle.
- **Trois façons de participer** : un compte client (courriel vérifié), une **carte invité** sans mot de passe (code QR, rattachée à l’appareil, avec code de secours), ou simplement présenter son code en magasin.
- Le client consulte son solde et son historique dans son compte ou sur sa carte.
- Une carte invité peut être **liée plus tard** à un compte : les points sont déplacés, jamais dupliqués.
- Les récompenses s’utilisent **au comptoir** : l’équipe scanne le code et applique le rabais en caisse.

### Avantages pour la boutique

- **Configurable** : taux, récompense, achat minimal et catégories modifiables par l’administrateur sans développement.
- **Souple** : on peut ajouter d’autres récompenses (boisson, extra) sur le même grand livre de points.
- **Déjà construit** : s’appuie sur le moteur PostgreSQL existant (grand livre, QR, administration, contrôles).
- Le client perçoit un avantage constant à chaque achat, y compris les petits paniers.

### Coûts promotionnels

- Le coût **nominal maximal** équivaut à **5 %** du montant admissible, au moment où les points sont échangés. À 100 $ admissibles, 5 $ de rabais.
- Ce **n’est pas le coût réel** : une partie des points ne sera jamais utilisée (inconnu avant de mesurer), et le rabais réduit le revenu, pas directement un coût de production. Le coût marginal des produits n’a pas été mesuré.
- Aucune hausse des ventes n’est affirmée : **nous n’avons aucune donnée** à ce stade. Nous recommandons de mesurer (voir section 5) avant de conclure.
- Le rabais de 5 $ peut influer sur le traitement de la TPS/TVQ : **à valider avec votre comptable**.

### Contrôles antifraude (déjà en place)

- Code QR **à usage unique**, valide 5 minutes, stocké seulement sous forme d’empreinte (SHA-256) ; il ne contient ni nom, ni courriel, ni solde.
- **Aucun numéro de téléphone** ni code court prévisible n’est utilisé comme identifiant ou preuve d’identité.
- Grand livre **en ajout seulement** : aucune modification ni suppression d’une opération passée.
- Verrous de base de données : impossible de dépenser deux fois, solde **jamais négatif**, opérations **idempotentes** (un double clic ne double rien), testé en parallèle sur une vraie base PostgreSQL.
- Limites de débit, comptes pouvant être suspendus, ajustements réservés à l’administrateur avec motif obligatoire, historique d’audit des changements de configuration.
- Séparation stricte **client / personnel / administrateur** : l’employé peut scanner, attribuer et échanger ; seul l’administrateur modifie la configuration, enregistre un remboursement ou ajuste un solde.
- La page publique ne montre **aucune donnée personnelle**, aucun solde et aucun nom.

### Capacité d’évolution

Paliers de fidélité, points bonis temporaires, récompenses par catégorie ou par produit, expiration (si vous la souhaitez), et, plus tard, application automatique du rabais à la commande en ligne : le modèle actuel le permet, mais **rien de cela n’est livré**.

### Ce qui est réellement implémenté

| Élément | État |
| --- | --- |
| Moteur de points (grand livre, QR, administration, anti-fraude) | ✅ Implémenté et testé |
| Configuration 10 points/1 $ et récompense de 5 $ pour 1 000 points | ✅ Chargée par défaut, **inactive** |
| Page publique FR/EN, calculateur, FAQ, sans connexion | ✅ Implémenté |
| Carte invité (sans compte), QR, code de secours, liaison à un compte | ✅ Implémenté et testé |
| Cinq états distincts (configuré / aperçu visible / accumulation / échange / autorisation commerciale) | ✅ Implémenté (ADMIN) |
| Reprise des points après remboursement complet ou partiel | ✅ Implémenté (saisie par l’administrateur) |
| Points estimés au panier (distincts des points confirmés) | ✅ Implémenté |
| Échange et rabais **au comptoir** par l’équipe | ✅ Implémenté |
| Application **automatique** du rabais de 5 $ à la commande en ligne | ❌ **Non implémenté** (volontairement) |
| Lien automatique des remboursements Stripe vers la reprise des points | ❌ Non implémenté (saisie manuelle) |
| Intégration avec un système de caisse (POS) externe | ❌ Inexistante |
| Expiration des points | ❌ Aucune politique décidée |

### Ce qui reste à approuver ou à intégrer

- Approbation du taux, du seuil, de la récompense et des conditions du programme.
- **Autorisation commerciale** (case dédiée dans l’administration ; obligatoire pour activer en production).
- Politique d’expiration, de cumul avec les promotions et de consentement/vie privée (textes légaux à valider ; la Loi 25 sur la protection des renseignements personnels s’applique).
- Création du compte de base de données de production, migration 009 (à répéter d’abord sur une branche de test).
- Décision sur l’application automatique du rabais en ligne (développement et tests de paiement requis).

---

## 4. Tableau comparatif

| Critère | Option A — Carte numérique (9+1) | Option B — Récompenses Salut |
| --- | --- | --- |
| Principe | 10e boisson gratuite | 10 points / 1 $ ; 1 000 points = 5 $ |
| Lisibilité pour le client | Très simple | Simple, demande un peu de calcul (aidé par le calculateur) |
| Ce qui est récompensé | Fréquence (nombre de boissons) | Dépenses (montant admissible) |
| Valeur nominale approximative | ~10 % du total des 10 boissons (si prix égaux) | 5 % du montant admissible |
| Coût réel | Variable ; dépend de la boisson offerte et du coût marginal | Variable ; dépend du taux d’utilisation et du coût marginal |
| Risque d’abus principal | Choix systématique de la boisson la plus chère | Fraude à l’identification ; maîtrisé par QR unique et grand livre |
| Flexibilité | Faible (règle fixe) | Élevée (taux, récompenses, catégories configurables) |
| Compatibilité avec le moteur existant | Partielle : nouveau modèle par tampon | Complète |
| État d’avancement | **Proposition seulement** | **Implémentée en aperçu, inactive** |
| Effort restant | Modèle de tampons, admissibilité, flux de gratuité, tests | Approbations, activation, décisions ouvertes |
| Dépendances externes | Aucune caisse externe aujourd’hui | Idem ; Resend pour les comptes clients |

---

## 5. Recommandation

Nous recommandons l’**option B, Récompenses Salut**, pour trois raisons :

1. **Flexibilité** : vous ajustez le taux, la récompense et les catégories sans nouveau développement.
2. **Compatibilité** : elle est déjà construite sur le moteur existant et testée.
3. **Prudence** : un seuil de 1 000 points et des contrôles déjà en place permettent de démarrer petit, de mesurer, puis d’ajuster.

L’option A demeure pertinente si vous souhaitez un message ultra-simple en boutique ; elle pourrait être développée plus tard sans bloquer l’option B.

**Mesures à suivre après l’activation** (sans présumer du résultat) : nombre de membres, points émis, points échangés, valeur nominale échangée, fréquence d’achat des membres et non-membres.

---

## 6. Décisions attendues du propriétaire

1. Confirmer le taux (10 points / 1 $), la récompense (1 000 points = 5 $) et l’achat minimal éventuel.
2. Confirmer les catégories admissibles (toutes ou certaines).
3. Politique d’expiration des points (aucune par défaut).
4. Règle de cumul avec les promotions.
5. Autorisation commerciale d’activation et date de lancement.
6. Application du rabais en ligne : maintenant, plus tard ou jamais.
7. Validation des textes légaux et de vie privée ; avis du comptable sur le traitement fiscal du rabais.

*Rappel : l’aperçu public peut être montré sans activer d’opérations réelles. Distinguer toujours : programme configuré, aperçu public visible, accumulation opérationnelle, échange opérationnel et activation commerciale autorisée.*

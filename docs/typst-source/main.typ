// Plan d'exécution ENISOLAR Rover — Phase 1, version 1.2
#import "report-theme.typ": report-accent, report-theme
#show: report-theme.with(
  title: "ENISOLAR Rover — Plan de démonstration sur cinq jours v1.2",
  author: "Équipe projet ENISOLAR",
  body-size: 10pt,
  rhythm: "report",
  running-header: true,
)
#set text(lang: "fr", region: "fr")

#page(margin: (top: 29%, x: 2.2cm), numbering: none, header: none)[
  #set par(first-line-indent: 0em)
  #align(center)[
    #text(size: 12pt, weight: "bold", fill: report-accent)[ENISOLAR / PLAN D’EXÉCUTION]
    #v(1.1em)
    #text(size: 28pt, weight: "bold", fill: report-accent)[Démonstration rover en cinq jours]
    #v(0.6em)
    #text(size: 14pt, fill: luma(80))[Conduite BLE manuelle, télémétrie et arrêt sûr]
    #v(2em)
    #block(width: 88%, fill: rgb("#EFF5F8"), stroke: 0.7pt + rgb("#9BC9C4"), inset: 14pt, radius: 4pt)[
      #align(left)[
        #strong[Objectif.] Réaliser une démonstration locale d’un rover tout-terrain piloté manuellement depuis un téléphone en BLE. L’ESP32 principal pilote les moteurs, lit les capteurs réellement intégrés et transmet la télémétrie au tableau de bord. L’ESP32-CAM est auxiliaire.
        #linebreak()
        #strong[Limite.] Prototype supervisé, non certifié pour la sécurité. Pas de navigation autonome, cloud, ni commande sur Internet pendant cette semaine.
      ]
    ]
    #v(1.6em)
    #text(size: 10pt, fill: luma(90))[Version 1.2 — aligné sur le cahier des charges ENISOLAR — 5 novembre 2026]
  ]
]
#page(numbering: none, header: none)[#outline(title: [Sommaire], indent: 1.5em)]
#counter(page).update(1)

= Périmètre et architecture

Le dépôt propose une démonstration sur cinq jours pour une équipe de trois personnes. Ce calendrier est une cible de travail, pas une promesse de livraison. Les pièces, broches, courants et fonctions doivent être vérifiés sur le matériel réel avant la mise sous tension des moteurs.

#table(
  columns: (1.35fr, 4.7fr),
  inset: 6pt,
  stroke: 0.5pt + luma(190),
  fill: (x, y) => if y == 0 { rgb("#173B57") } else if calc.rem(y, 2) == 0 { rgb("#F2F6F8") } else { white },
  [#text(fill: white)[#strong[Paramètre]]], [#text(fill: white)[#strong[Décision v1.2]]],
  [Architecture], [Un ESP32 principal + un ESP32-CAM auxiliaire. Le second ESP32 est reporté à l’extension intelligente.],
  [Commande], [Téléphone → BLE local → ESP32 principal. Conduite manuelle uniquement.],
  [Supervision], [Tableau de bord téléphone avec connexion, états, défauts et télémétrie valide/âgée.],
  [Capteurs], [Conserver les modules réellement présents et vérifiés. LiDAR optionnel, présence et interface à confirmer.],
  [Reporté], [Navigation autonome, missions, waypoints, Wi-Fi/MQTT/cloud, second ESP32, perception intelligente et sécurité décisionnelle.],
)

Le tableau de bord distingue une valeur réelle, indisponible, invalide, obsolète ou simulée. Une mesure absente ne doit jamais être présentée comme zéro ni comme donnée réelle.

= Jalons de la semaine

Chaque journée se termine par une preuve de sortie. Aucun essai roulant ne commence tant que le câblage réel, l’arrêt physique et les conditions de test ne sont pas vérifiés.

#table(
  columns: (0.45fr, 1.2fr, 3.5fr, 2.8fr),
  inset: 5pt,
  stroke: 0.5pt + luma(190),
  fill: (x, y) => if y == 0 { rgb("#173B57") } else if calc.rem(y, 2) == 0 { rgb("#F2F6F8") } else { white },
  [#text(fill: white)[#strong[Jour]]], [#text(fill: white)[#strong[Jalon]]], [#text(fill: white)[#strong[Travail]]], [#text(fill: white)[#strong[Condition de sortie / preuve]]],
  [#strong[1]], [Périmètre et inventaire], [Confirmer ESP32, ESP32-CAM, châssis, moteurs, drivers, batterie, capteurs, SD et coupure physique. Figer BLE, rôles, commande/état, pins et zone de test après vérification.], [Nomenclature et risques relus; aucune broche ou valeur électrique supposée. V1 manuelle, sans navigation.],
  [#strong[2]], [Bring-up sûr], [Alimenter d’abord la logique; vérifier les sorties moteurs inactives au boot/reset; tester l’arrêt physique séparément. Acquérir les capteurs sans entraîner les moteurs.], [Contrôles électriques consignés; pas de mouvement au démarrage; stop vérifié avant roulage motorisé.],
  [#strong[3]], [Commande BLE et dashboard], [Créer commandes joystick bornées et STOP prioritaire. Afficher connexion, mode, défauts et télémétrie réellement validée avec unités, âge et validité.], [Client non autorisé/déconnecté ne conduit pas; donnée absente marquée indisponible; réponse de commande visible.],
  [#strong[4]], [Intégration et tests négatifs], [Tester trames invalides/hors limites, STOP, perte/retour BLE, reboot, capteur absent, SD et caméra en défaut. Roues levées d’abord; roulage lent seulement si jalons atteints.], [Timeout mesuré; défauts affichés; caméra/SD ne bloquent pas le contrôle; journal de tests conservé.],
  [#strong[5]], [Gel et démonstration], [Geler firmware et interface; répéter trois fois un scénario manuel à basse vitesse; finaliser schéma, versions, reconnexion/reset, limites et procédure de démo.], [Trois essais reproductibles, stop matériel accessible, télémétrie compréhensible. Sinon simulateur clairement étiqueté.],
)

#block(fill: rgb("#EFF5F8"), stroke: 0.7pt + rgb("#9BC9C4"), inset: 9pt, radius: 3pt)[
  #strong[Règle de périmètre.] Aucun mode AUTO, waypoint, trajet temporisé ou patrouille autonome n’est prévu dans cette V1. Le dépôt évoque des options; le besoin ENISOLAR retient une conduite guidée par opérateur.
]

= Responsabilités et intégration

Répartition indicative pour trois personnes. Si l’équipe diffère, réattribuer les responsabilités sans perdre les propriétaires du câblage/firmware, du BLE et du dashboard/recette.

#table(
  columns: (1.3fr, 2.1fr, 4.7fr),
  inset: 5pt,
  stroke: 0.5pt + luma(190),
  fill: (x, y) => if y == 0 { rgb("#173B57") } else if calc.rem(y, 2) == 0 { rgb("#F2F6F8") } else { white },
  [#text(fill: white)[#strong[Responsable]]], [#text(fill: white)[#strong[Périmètre]]], [#text(fill: white)[#strong[Travail et livrables]]],
  [Personne 1 — électronique / firmware], [Wiring, pins, alimentation, moteurs, arrêt matériel et firmware.], [Inventaire et schéma réel; sorties moteurs OFF au boot/reset; commandes bornées, état, timeout; versions de build/flash et procédure de récupération. Vérifier les courants avant toute mise en parallèle de moteurs.],
  [Personne 2 — BLE / télécommande], [Service BLE, appairage/autorisation, joystick téléphone, commandes et réponses d’état.], [Définir les champs/UUID, STOP, avant/arrière/rotation, séquence, accusé et règles de perte/reconnexion; rejeter commandes inconnues/hors limites. BLE est le seul lien de conduite V1.],
  [Personne 3 — dashboard / télémétrie / recette], [Interface, affichage données, tests intégrés, documentation.], [Montrer connexion, mode, défauts, fraîcheur et validité; griser la conduite si déconnecté; ne pas annoncer réussite sans retour d’état; intégrer caméra/SD seulement si stable.],
)

== Cadence commune

Au début de chaque journée, choisir un livrable par personne et relever les bloqueurs. Intégrer sur un build connu comme fonctionnel au moins une fois par jour. Consigner uniquement les tests réellement réussis et leurs versions. Si un capteur ou le lien BLE bloque, réduire le périmètre ou présenter un simulateur explicitement signalé.

== Contrat minimal commande / télémétrie

#table(
  columns: (1.5fr, 5.7fr),
  inset: 5pt,
  stroke: 0.5pt + luma(190),
  fill: (x, y) => if y == 0 { rgb("#173B57") } else if calc.rem(y, 2) == 0 { rgb("#F2F6F8") } else { white },
  [#text(fill: white)[#strong[Flux]]], [#text(fill: white)[#strong[Comportement minimum]]],
  [Téléphone → rover], [Session BLE autorisée; avant/arrière/rotation bornés; armement explicite; STOP; séquence et expiration documentées.],
  [Rover → dashboard], [Connecté/déconnecté; désarmé/manuel/arrêt/défaut; dernière commande; code défaut; âge/validité des capteurs; tension batterie si instrumentée.],
  [Défauts], [Trame invalide, capteur absent, télémétrie périmée ou absence d’accusé affichés comme défaut/indisponible. Les données simulées portent l’étiquette « simulé ».],
)

= Sécurité, acceptation et limites

Cette démonstration reprend les garde-fous des documents du dépôt sans revendiquer une sécurité complète. Les premiers essais moteurs se font roues levées; le roulage s’effectue à basse vitesse sur une zone dégagée, avec un observateur et la coupure physique accessible.

- Confirmer références et valeurs réelles des moteurs, drivers, batterie/BMS, fusible, fils, régulateur et coupure. Un schéma de blocs n’est pas un pinout prêt à câbler.
- Vérifier polarité, masse, niveaux logiques et sorties inactives au boot. Ne jamais connecter un moteur directement à une GPIO.
- Pas d’Internet public, port-forwarding, broker public, compte cloud ou secret commité pour la démo.
- Un bouton d’application n’équivaut pas à une coupure matérielle. Sans arrêt physique fiable et testé, rester au banc/simulateur.
- Arrêter au moindre comportement inattendu, échauffement, perte de contrôle ou échec du stop.

#table(
  columns: (1.3fr, 3.7fr, 2.7fr),
  inset: 5pt,
  stroke: 0.5pt + luma(190),
  fill: (x, y) => if y == 0 { rgb("#173B57") } else if calc.rem(y, 2) == 0 { rgb("#F2F6F8") } else { white },
  [#text(fill: white)[#strong[Test]]], [#text(fill: white)[#strong[Résultat attendu]]], [#text(fill: white)[#strong[Preuve à conserver]]],
  [Boot / reset], [Moteurs inactifs, rover désarmé; armement explicite requis.], [Build/version et fiche de contrôle.],
  [Commande / limite], [Seules commandes prévues acceptées; limite appliquée.], [Trames et essai roues levées.],
  [STOP / coupure physique], [Rover immobilisé; chemin matériel testé indépendamment de l’interface.], [Deux essais consignés séparément.],
  [Perte BLE / timeout], [Consigne motrice inactive dans le délai configuré; pas de reprise automatique au retour du lien.], [Délai réel mesuré et état dashboard.],
  [Télémétrie / capteur absent], [Unités, validité et fraîcheur affichées; donnée manquante non présentée comme réelle.], [Capture et test d’absence contrôlée.],
  [Répétabilité], [Même scénario manuel réussi trois fois sans comportement inattendu.], [Checklist, anomalies et limites.],
)

#block(fill: rgb("#EFF5F8"), stroke: 0.7pt + rgb("#9BC9C4"), inset: 9pt, radius: 3pt)[
  #strong[Non revendiqué.] Navigation autonome, évitement d’obstacles, détection de personne, résistance au brouillage/spoofing, chiffrement/HMAC/secure boot/OTA sécurisée, conformité normative ou sécurité de production. Ces capacités nécessitent une conception, une intégration et des tests séparés.
]

= Extensions reportées et sources

Après acceptation de la V1 seulement : décider le rôle du deuxième ESP32, concevoir le lien inter-ESP, réévaluer l’autorité motrice en cas de panne, puis définir les exigences du projet de sécurité embarqué et la perception requise. Le blueprint marque le LiDAR comme optionnel et non spécifié; ne l’ajouter qu’après confirmation de présence et d’interface.

Le plan de démonstration s’appuie sur le dépôt public #link("https://github.com/0x53616d6568/rover-security/")[rover-security], notamment son #link("https://github.com/0x53616d6568/rover-security/")[README], le #link("https://github.com/0x53616d6568/rover-security/blob/main/docs/Rover%20blueprint.md")[blueprint], le #link("https://github.com/0x53616d6568/rover-security/blob/main/docs/wiring-schematic.md")[schéma de câblage], les notes de #link("https://github.com/0x53616d6568/rover-security/blob/main/docs/connectivity.md")[connectivité], le #link("https://github.com/0x53616d6568/rover-security/blob/main/docs/dashboard.md")[dashboard], la #link("https://github.com/0x53616d6568/rover-security/blob/main/docs/navigation.md")[navigation] et la #link("https://github.com/0x53616d6568/rover-security/blob/main/docs/security.md")[sécurité]. L’arbre `main` consulté le 5 novembre 2026 avait le SHA `634f8e3a24c2b069ad11904e49d984ff67331bd7`; il contenait des spécifications et plans, pas d’implémentation de firmware/application/dashboard à valider.

Le présent plan accompagne le #link("Cahier_des_charges_Rover_ENISOLAR_v1.2.pdf")[cahier des charges ENISOLAR v1.2]. Toutes les valeurs et dispositions matérielles restent à vérifier sur le prototype; aucune publication du code n’est implicite par ce document.

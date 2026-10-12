<?php

// Suivi des dépenses (achats et charges) : statuts, validation, paiement,
// annulation et historique.
//
// DÉSACTIVÉ par défaut : tant que DEPENSES_WORKFLOW ne vaut pas true, les
// achats et les charges se comportent exactement comme avant, et le code ne
// lit ni n'écrit aucune des colonnes ajoutées par les migrations 2026_10_11_*
// et 2026_10_12_*. L'application reste donc utilisable sur une base qui n'a
// pas encore reçu ces migrations.
//
// À activer (DEPENSES_WORKFLOW=true) uniquement sur une base migrée.
return [
    'workflow' => (bool) env('DEPENSES_WORKFLOW', false),

    // Nombre maximal de lignes d'un export d'achats ou de charges (Logistique).
    // L'export tient toute sa réponse en mémoire, sur le serveur puis dans le
    // navigateur : au-delà de cette limite, il est refusé (422) avec un message
    // qui invite à réduire la période ou à préciser la recherche. S'applique que
    // le suivi des dépenses soit activé ou non. Les listes paginées ne sont pas
    // concernées. Modifiable sans toucher au code : DEPENSES_EXPORT_MAX dans .env.
    'export_max' => (int) env('DEPENSES_EXPORT_MAX', 20000),
];

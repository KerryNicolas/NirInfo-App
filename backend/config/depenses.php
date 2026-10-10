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
];

/* ══════════════════════════════════════════════════════════════════════
   Fichiers CSV fabriqués dans le navigateur.

   Séparateur « ; » : c'est celui qu'Excel attend en français, et celui des
   exports existants de l'application.

   Deux protections, appliquées cellule par cellule :

   1. FORMULES. Excel exécute comme une formule toute cellule qui commence
      par « = », « + », « - » ou « @ » — y compris après des espaces ou des
      caractères invisibles. Un texte saisi par un utilisateur (désignation,
      nom de matériel…) pourrait ainsi lancer un calcul ou ouvrir un lien à
      l'ouverture du fichier. Convention :
        - une valeur NUMÉRIQUE est écrite telle quelle, signe compris : un
          nombre, ou un texte qui n'est QUE un nombre (« -1500.00 », « +3 »).
          Un montant négatif reste donc un montant ;
        - tout autre TEXTE qui commencerait une formule reçoit une apostrophe
          en tête : Excel l'affiche alors comme du texte, sans rien exécuter.
          L'apostrophe reste visible dans la cellule — c'est le prix de la
          protection, et le reste du texte n'est pas modifié.

   2. STRUCTURE. Une cellule est mise entre guillemets quand son texte
      contient un point-virgule, un guillemet ou un retour à la ligne ; ses
      guillemets sont alors doublés (convention CSV, RFC 4180). Sans cela, un
      point-virgule dans une désignation décalait les colonnes, et un retour à
      la ligne coupait la ligne en deux.

   Une cellule ordinaire reste écrite telle quelle.
   ══════════════════════════════════════════════════════════════════════ */

const SEPARATEUR = ';'

// Un nombre et rien d'autre : signe facultatif, chiffres, décimales facultatives (point ou virgule).
const NOMBRE = /^[+-]?\d+(?:[.,]\d+)?$/

// Début de formule : « = », « + », « - », « @ » (et leurs formes pleine chasse),
// éventuellement précédés d'espaces, de tabulations, de retours à la ligne, de
// caractères de contrôle ou d'espaces invisibles.
const DEBUT_DE_FORMULE = /^[\s\u0000-\u001F\u007F ​-‍⁠﻿]*[=+\-@＝＋－＠]/

/** Vrai si la valeur est numérique : un nombre fini, ou un texte qui n'est qu'un nombre. */
export function estNumerique(valeur: unknown): boolean {
  if (typeof valeur === 'number') return Number.isFinite(valeur)
  return typeof valeur === 'string' && NOMBRE.test(valeur)
}

/** Texte rendu inoffensif pour un tableur : une apostrophe en tête s'il commencerait une formule. */
export function neutraliserFormule(texte: string): string {
  return DEBUT_DE_FORMULE.test(texte) ? `'${texte}` : texte
}

/** Texte d'une cellule. null et undefined donnent une cellule vide. */
export function celluleCsv(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  const brut  = String(valeur)
  const texte = estNumerique(valeur) ? brut : neutraliserFormule(brut)
  return /[";\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
}

/** Contenu du fichier : une ligne par tableau de cellules. */
export function versCsv(lignes: unknown[][]): string {
  return lignes.map(ligne => ligne.map(celluleCsv).join(SEPARATEUR)).join('\n')
}

/**
 * Propose le fichier au téléchargement. Le fichier commence par la marque
 * UTF-8 (BOM), comme les exports État et Échéance : sans elle, Excel affiche
 * mal les lettres accentuées (« Désignation », « Matériel »).
 */
export function telechargerCsv(nom: string, lignes: unknown[][]): void {
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(new Blob(['﻿' + versCsv(lignes)], { type: 'text/csv;charset=utf-8' }))
  lien.download = nom
  lien.click()
}

// ══════════════════════════════════════════════════════════════
// Règles de validation et de formatage communes à tous les
// formulaires de l'application NirInfo (Étudiant, Personnel,
// Client, Compte, Facture, Recouvrement, Prestation...).
// À importer depuis src/utils/validators.ts dans chaque formulaire.
// ══════════════════════════════════════════════════════════════

/* ── Téléphone malgache : 10 chiffres, préfixe 032-038, "03X XX XXX XX" ── */
const TEL_PREFIXES = ['032', '033', '034', '035', '036', '037', '038']

export function cleanDigits(value: string): string {
  return (value || '').replace(/\D/g, '')
}

export function formatTelephoneMG(value: string): string {
  const digits = cleanDigits(value).slice(0, 10)
  const parts = [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 8), digits.slice(8, 10)]
  return parts.filter(Boolean).join(' ')
}

export function isValidTelephoneMG(value: string): boolean {
  const digits = cleanDigits(value)
  return digits.length === 10 && TEL_PREFIXES.includes(digits.slice(0, 3))
}

/* ── Numéro de compte : même règle/format que le téléphone ── */
export const formatNumeroCompte = formatTelephoneMG
export const isValidNumeroCompte = isValidTelephoneMG

/* ── CIN malgache : 12 chiffres, "XXX XXX XXX XXX" ── */
export function formatCinMG(value: string): string {
  const digits = cleanDigits(value).slice(0, 12)
  const groups = digits.match(/.{1,3}/g) || []
  return groups.join(' ')
}

export function isValidCinMG(value: string): boolean {
  return cleanDigits(value).length === 12
}

/* ── Email : structure standard nom.utilisateur@domaine.tld ──
   Règles explicites demandées :
   - partie locale : lettres latines, chiffres, points (pas d'espace, pas de
     "=", pas de "_", pas de ",")
   - "@" obligatoire, une seule fois
   - domaine valide (labels alphanumériques + tirets, TLD de 2 lettres min.)
   - pas de points consécutifs (ni dans la partie locale, ni dans le domaine) */
const EMAIL_RE = /^[a-z0-9]+(\.[a-z0-9]+)*@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i
export function isValidEmailStrict(value: string): boolean {
  if (!value) return true // champ optionnel dans la plupart des formulaires
  const v = value.trim()
  if (/[\s=_,]/.test(v)) return false        // espace, "=", "_", "," interdits
  if (/\.\./.test(v)) return false           // points consécutifs interdits
  if ((v.match(/@/g) || []).length !== 1) return false
  return EMAIL_RE.test(v)
}
// Ancien nom conservé pour compatibilité avec le code déjà déployé.
export const isValidEmailComFr = isValidEmailStrict

/* ── Contact générique (champ Service/Client) : téléphone OU email valide ── */
export function isValidContact(value: string): boolean {
  if (!value) return true
  return isValidTelephoneMG(value) || isValidEmailComFr(value)
}

/* ── Formatage "intelligent" du champ Contact : applique l'espacement
   téléphone "03X XX XXX XX" uniquement si ce qui est tapé ressemble à un
   numéro (chiffres/espaces uniquement) ; sinon (lettres, "@", ".") laisse
   la saisie telle quelle pour permettre de taper un email. */
export function formatContact(value: string): string {
  if (/^[0-9 ]*$/.test(value || '')) {
    return formatTelephoneMG(value)
  }
  return value
}

/* ── Matricule étudiant : "NI-" suivi uniquement de chiffres ── */
const MATRICULE_NI_RE = /^NI-\d+$/
export function isValidMatriculeNI(value: string): boolean {
  return MATRICULE_NI_RE.test((value || '').trim())
}

/* ── Référence de facture : "FAC-20XX-[ID numérique]" ── */
const REF_FACTURE_RE = /^FAC-20\d{2}-\d+$/
export function isValidRefFacture(value: string): boolean {
  return REF_FACTURE_RE.test((value || '').trim())
}

/* ── Âge 18+ à la date du jour (champ optionnel : vide = pas de blocage) ── */
export function isAdult18(dateNaissance: string): boolean {
  if (!dateNaissance) return true
  const dn = new Date(dateNaissance)
  if (isNaN(dn.getTime())) return false
  const today = new Date()
  let age = today.getFullYear() - dn.getFullYear()
  const m = today.getMonth() - dn.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dn.getDate())) age--
  return age >= 18
}

/* ── Nom : toujours en MAJUSCULES ── */
export function toUpperName(value: string): string {
  return (value || '').toUpperCase()
}

/* ── Prénom / Lieu : Majuscule à chaque mot ── */
export function toTitleCaseWords(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase())
}

/* ── Montant : affichage avec séparateur d'espace pour les milliers (20 000) ──
   NB : la plupart des tableaux de l'appli utilisent déjà
   Number(n).toLocaleString('fr') pour l'affichage, ce qui produit déjà ce
   format. Cette fonction est fournie pour les endroits qui n'appellent pas
   encore ce formatage (ex: aperçus, résumés). */
export function formatMontant(value: number | string): string {
  const n = typeof value === 'string' ? Number(value.replace(/\s/g, '')) : value
  if (isNaN(n as number)) return String(value)
  return (n as number).toLocaleString('fr-FR')
}

/* ── Saisie de montant en direct : espace comme séparateur de milliers ──
   formatMontantInput("1000000") -> "1 000 000" (à afficher dans l'input,
   pendant que l'utilisateur tape). parseMontantInput fait l'inverse, pour
   récupérer le nombre brut à envoyer à l'API. Un champ lié à ces deux
   fonctions doit rester de type="text" (pas type="number", qui refuse les
   espaces). */
export function formatMontantInput(value: string): string {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('fr-FR').replace(/ | /g, ' ')
}

export function parseMontantInput(value: string): string {
  return (value || '').replace(/\D/g, '')
}

/* ── Style à appliquer à un champ invalide : cadre rouge fin, disparaît
   dès que la valeur redevient conforme. À utiliser ainsi :
   style={value && !isValid(value) ? invalidFieldStyle : undefined}
   FIX : simple bordure fine rouge (même épaisseur que la bordure normale
   de .form-control) — la version précédente (bordure épaisse + ombre)
   faisait un cadre trop massif, pas demandé. */
export const invalidFieldStyle = {
  border: '1.5px solid #ef4444',
  outline: 'none',
} as const
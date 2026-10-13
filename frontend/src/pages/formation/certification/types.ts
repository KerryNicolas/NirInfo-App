import { formatMontantInput } from '../../../utils/validators'

export interface Certification {
  id: number; reference: string
  // null pour un certificat saisi manuellement (pas de fiche étudiant)
  matricule: string | null
  nom: string; prenom: string; nom_complet: string
  module_nom: string; debut_session: string; fin_session: string
  date: string; prix: number; nom_formation?: string; code_module: string | null
  lieu_paiement?: string; code_session?: string
  accept: number
  date_naissance?: string; lieu_naissance?: string
  origine?: 'normal' | 'manuel'
  motif_gratuit?: string | null
  // 0 : certificat en attente sans prix particulier — `prix` est alors le
  // prix standard en vigueur (onglet « Modifier prix »).
  prix_particulier?: number
  editeur?: string
}

// Ce que la fenêtre de validation envoie au serveur : soit un paiement
// (compte + prix), soit une gratuité (certificat manuel + motif).
export type ValidationPayload =
  | { id_compte: number; prix: number }
  | { gratuit: true; motif_gratuit: string }
export interface Compte { id_compte: number; libelle: string }
export interface PrixHistorique { id_prix_certificat: number; prix: number; date_modification: string }

// Vrai si le certificat, encore en attente, suit le prix standard.
export const suitPrixStandard = (c: { prix_particulier?: unknown }) =>
  c.prix_particulier !== undefined && Number(c.prix_particulier) === 0

export const isManuel = (c: { origine?: string }) => c.origine === 'manuel'

// `accept` peut arriver du backend en nombre (1/0) ou en chaîne ("1"/"0")
// selon le driver MySQL : on normalise une fois pour toutes.
export const isValide = (accept: unknown) => Number(accept) === 1

// Validé à 0 Ar = certificat manuel délivré gratuitement.
export const isGratuit = (c: { accept: unknown; prix: unknown }) => isValide(c.accept) && Number(c.prix) === 0

// FIX (prix « 1 000 000 » au lieu de « 10 000 ») : le backend renvoie le
// prix d'une colonne décimale sous forme de texte, ex. "10000.00".
// formatMontantInput() ne garde que les chiffres, donc "10000.00" devenait
// "1000000" → « 1 000 000 ». On convertit d'abord en nombre entier.
export const prixToInput = (prix: unknown): string => {
  if (prix === null || prix === undefined || prix === '') return ''
  const n = Math.round(Number(prix))
  return isNaN(n) ? '' : formatMontantInput(String(n))
}

export const fmtMontant = (n: number) => Number(n).toLocaleString('fr')

export const fmtDateCourt = (d: string) => {
  if (!d) return '—'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' })
}
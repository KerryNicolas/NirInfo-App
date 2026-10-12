import { useEffect, useState } from 'react'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { useAuth } from '../../../contexts/AuthContext'
import { IcoX } from '../../../components/icons'
import { messageErreur } from '../../../utils/apiError'

/* ══════════════════════════════════════════════════════════════════════
   SUIVI DES DÉPENSES dans Logistique : statut d'une dépense et actions
   (valider, payer, annuler le paiement, annuler, historique).

   Tout ce fichier n'est utilisé QUE si le suivi est activé sur le serveur
   (GET /depenses/etat). Suivi désactivé, LogistiquePage n'affiche rien de
   ce qui suit et se comporte exactement comme avant.

   Les règles ci-dessous REPRENNENT celles du serveur pour ne proposer que
   les actions possibles ; elles ne les remplacent pas. Le serveur contrôle
   chaque action (statut, permission, solde) et son refus est affiché tel
   quel. Un bouton masqué n'est jamais une protection.
   ══════════════════════════════════════════════════════════════════════ */

export type TypeDepense = 'achat' | 'charge'

/** Champs que la liste renvoie en plus quand le suivi est activé. */
export interface SuiviChamps {
  statut?: string
  id_compte?: number | null
  compte?: string
  date_validation?: string | null
  date_paiement?: string | null
  ancien_systeme?: number | boolean
  /** Calculé par le serveur : l'utilisateur connecté a-t-il saisi cette dépense ? */
  est_auteur?: boolean
}

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  enregistree: { libelle: 'Enregistrée', classe: 'badge-info' },
  validee:     { libelle: 'Validée',     classe: 'badge-warning' },
  payee:       { libelle: 'Payée',       classe: 'badge-success' },
  annulee:     { libelle: 'Annulée',     classe: 'badge-danger' },
}

const ACTIONS: Record<string, string> = {
  saisie: 'Saisie', validation: 'Validation', paiement: 'Paiement',
  annulation_paiement: 'Annulation du paiement', annulation: 'Annulation',
  modification: 'Modification', suppression: 'Suppression',
}

const estAncien = (d: SuiviChamps) => Number(d.ancien_systeme) === 1
const libelleStatut = (s?: string | null) => (s ? STATUTS[s]?.libelle ?? s : '—')
const ar = (n: number | string) => `${Number(n).toLocaleString('fr')} Ar`
const dateHeure = (v?: string | null) => (v ? String(v).slice(0, 16).replace('T', ' ') : '—')

/* ── Règles d'affichage des boutons EXISTANTS (crayon, corbeille) ── */

/** Serveur : une dépense se modifie si elle est enregistrée ou validée, et n'est pas de l'ancien système. */
export const modifiable = (d: SuiviChamps) => !estAncien(d) && (d.statut === 'enregistree' || d.statut === 'validee')

/** Serveur : une dépense ne se supprime que si elle est enregistrée, et n'est pas de l'ancien système. */
export const supprimable = (d: SuiviChamps) => !estAncien(d) && d.statut === 'enregistree'

/* ── État du suivi ── */

/**
 * Le suivi est-il activé sur le serveur ? Faux tant que la réponse n'est pas
 * arrivée, et faux si la question échoue : dans le doute, l'écran reste celui
 * d'avant.
 */
export function useSuiviActif(): boolean {
  const [actif, setActif] = useState(false)

  useEffect(() => {
    let vivant = true
    api.get('/depenses/etat')
      .then(res => { if (vivant) setActif(res.data?.suivi_actif === true) })
      .catch(() => { if (vivant) setActif(false) })
    return () => { vivant = false }
  }, [])

  return actif
}

/* ── Statut ── */

export function StatutBadge({ depense }: { depense: SuiviChamps }) {
  const s = depense.statut ? STATUTS[depense.statut] : undefined
  return (
    <span data-statut={depense.statut ?? ''} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
      <span className={`badge ${s?.classe ?? ''}`}>{s?.libelle ?? depense.statut ?? '—'}</span>
      {estAncien(depense) && <span style={{ fontSize: 10, color: '#94a3b8' }}>ancien système</span>}
    </span>
  )
}

/** Lignes ajoutées à la fenêtre de détail d'une dépense. */
export function lignesDetail(d: SuiviChamps): [string, string][] {
  return [
    ['Statut', libelleStatut(d.statut) + (estAncien(d) ? ' (ancien système)' : '')],
    ['Validée le', dateHeure(d.date_validation)],
    ['Payée le', dateHeure(d.date_paiement)],
    ['Compte débité', d.compte?.trim() || '—'],
  ]
}

/* ── Fenêtres ── */

const fond: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }
const boite = (largeur: number): React.CSSProperties => ({ width: largeur, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'white', borderRadius: 12, padding: 22 })

function Fenetre({ titre, largeur = 420, onClose, children }: { titre: string; largeur?: number; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={fond} onClick={onClose} data-fenetre={titre}>
      <div style={boite(largeur)} onClick={ev => ev.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{titre}</span>
          <button type="button" onClick={onClose} className="btn-icon"><IcoX /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const Refus = ({ message }: { message: string | null }) => message
  ? <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 7, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{message}</div>
  : null

interface Compte { id_compte: number; libelle: string }

function PayerFenetre({ libelle, montant, url, onClose, onFait }: { libelle: string; montant: number | string; url: string; onClose: () => void; onFait: () => void }) {
  const [comptes, setComptes] = useState<Compte[] | null>(null)
  const [compte,  setCompte]  = useState('')
  const [refus,   setRefus]   = useState<string | null>(null)
  const [envoi,   setEnvoi]   = useState(false)

  useEffect(() => {
    let vivant = true
    api.get('/comptes-budget/simple')
      .then(res => { if (vivant) setComptes(res.data ?? []) })
      .catch(err => { if (vivant) { setComptes([]); setRefus(messageErreur(err, 'Impossible de charger la liste des comptes.')) } })
    return () => { vivant = false }
  }, [])

  const payer = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnvoi(true); setRefus(null)
    try {
      const res = await api.post(`${url}/payer`, { id_compte: Number(compte) })
      toast.success(res.data?.message || 'Dépense payée.')
      onFait(); onClose()
    } catch (err) { setRefus(messageErreur(err, 'Erreur lors du paiement')) }
    finally { setEnvoi(false) }
  }

  return (
    <Fenetre titre="Payer la dépense" onClose={onClose}>
      <form onSubmit={payer}>
        <div style={{ fontSize: 13, color: '#334155', marginBottom: 12 }}>
          « {libelle} » — <strong>{ar(montant)}</strong><br />
          Le compte choisi sera débité de ce montant.
        </div>
        <Refus message={refus} />
        <div className="form-group">
          <label className="form-label" htmlFor="suivi-compte">Compte à débiter </label>
          <select id="suivi-compte" className="form-control" value={compte} onChange={e => setCompte(e.target.value)} required disabled={comptes === null}>
            <option value="">{comptes === null ? 'Chargement…' : '-- Choisir un compte --'}</option>
            {(comptes ?? []).map(c => <option key={c.id_compte} value={c.id_compte}>{c.libelle}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Fermer</button>
          <button type="submit" className="btn btn-primary" disabled={envoi || !compte}>{envoi ? 'Paiement…' : 'Payer'}</button>
        </div>
      </form>
    </Fenetre>
  )
}

function MotifFenetre({ titre, explication, bouton, url, repli, onClose, onFait }: { titre: string; explication: string; bouton: string; url: string; repli: string; onClose: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('')
  const [refus, setRefus] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnvoi(true); setRefus(null)
    try {
      const res = await api.post(url, { motif: motif.trim() })
      toast.success(res.data?.message || 'Opération effectuée.')
      onFait(); onClose()
    } catch (err) { setRefus(messageErreur(err, repli)) }
    finally { setEnvoi(false) }
  }

  return (
    <Fenetre titre={titre} onClose={onClose}>
      <form onSubmit={envoyer}>
        <div style={{ fontSize: 13, color: '#334155', marginBottom: 12 }}>{explication}</div>
        <Refus message={refus} />
        <div className="form-group">
          <label className="form-label" htmlFor="suivi-motif">Motif </label>
          <textarea id="suivi-motif" className="form-control" rows={3} maxLength={255} value={motif} onChange={e => setMotif(e.target.value)} required placeholder="Pourquoi cette annulation ?" />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Fermer</button>
          <button type="submit" className="btn btn-primary" disabled={envoi || !motif.trim()} style={{ background: '#dc2626', borderColor: '#dc2626' }}>{envoi ? 'Envoi…' : bouton}</button>
        </div>
      </form>
    </Fenetre>
  )
}

interface Evenement { id: number; action: string; statut_avant: string | null; statut_apres: string | null; compte: string | null; montant: number | string | null; motif: string | null; utilisateur: string | null; created_at: string }

function HistoriqueFenetre({ libelle, url, onClose }: { libelle: string; url: string; onClose: () => void }) {
  const [lignes, setLignes] = useState<Evenement[] | null>(null)
  const [refus,  setRefus]  = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    api.get(`${url}/historique`)
      .then(res => { if (vivant) setLignes(res.data?.data ?? []) })
      .catch(err => { if (vivant) { setLignes([]); setRefus(messageErreur(err, "Impossible de charger l'historique.")) } })
    return () => { vivant = false }
  }, [url])

  return (
    <Fenetre titre="Historique de la dépense" largeur={760} onClose={onClose}>
      <div style={{ fontSize: 13, color: '#334155', marginBottom: 12 }}>« {libelle} »</div>
      <Refus message={refus} />
      {lignes === null ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
        <div className="table-wrapper">
          <table data-tableau="historique">
            <thead><tr><th>Date</th><th>Action</th><th>Statut</th><th>Montant</th><th>Compte</th><th>Motif</th><th>Par</th></tr></thead>
            <tbody>
              {lignes.length === 0
                ? <tr><td colSpan={7}><div className="empty-state">{refus ? '—' : 'Aucun historique : cette dépense est antérieure au suivi.'}</div></td></tr>
                : lignes.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{dateHeure(e.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{ACTIONS[e.action] ?? e.action}</td>
                    <td style={{ fontSize: 12 }}>{e.statut_avant ? `${libelleStatut(e.statut_avant)} → ` : ''}{libelleStatut(e.statut_apres)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.montant !== null && e.montant !== undefined ? ar(e.montant) : '—'}</td>
                    <td style={{ fontSize: 12 }}>{e.compte || '—'}</td>
                    <td style={{ fontSize: 12 }}>{e.motif || '—'}</td>
                    <td style={{ fontSize: 12 }}>{e.utilisateur || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </Fenetre>
  )
}

/* ── Boutons d'action d'une ligne ── */

const bouton = (couleur: string, fond: string, bord: string): React.CSSProperties => ({
  background: fond, color: couleur, border: `1px solid ${bord}`, borderRadius: 6, padding: '4px 8px',
  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
})

interface ActionsProps {
  type: TypeDepense
  id: number
  libelle: string
  montant: number | string
  depense: SuiviChamps
  /** Appelé après une action réussie, pour recharger la liste. */
  onFait: () => void
}

export function ActionsSuivi({ type, id, libelle, montant, depense, onFait }: ActionsProps) {
  const { hasPermission } = useAuth()
  const [fenetre, setFenetre] = useState<null | 'valider' | 'payer' | 'annuler-paiement' | 'annuler' | 'historique'>(null)
  const [envoi, setEnvoi] = useState(false)

  const url    = `/${type}s/${id}`
  const statut = depense.statut
  const ancien = estAncien(depense)

  // Mêmes conditions que le serveur : statut de la dépense + permission de la route.
  const peutValider         = !ancien && statut === 'enregistree' && hasPermission('depenses.valider')
  const peutPayer           = !ancien && statut === 'validee'     && hasPermission('depenses.payer')
  const peutAnnulerPaiement = !ancien && statut === 'payee'       && hasPermission('depenses.payer')
  // Annuler : la route exige l'accès Logistique, puis le serveur accepte
  // l'administrateur (titulaire de « depenses.valider ») ou l'AUTEUR de la
  // saisie. « est_auteur » est calculé par le serveur à partir des
  // identifiants (jamais des noms) ; seule la valeur true compte.
  const peutAnnuler         = !ancien && (statut === 'enregistree' || statut === 'validee')
    && hasPermission('logistique.access') && (depense.est_auteur === true || hasPermission('depenses.valider'))
  const peutVoirHistorique  = hasPermission('logistique.access')

  const valider = async () => {
    setEnvoi(true)
    try {
      const res = await api.post(`${url}/valider`)
      toast.success(res.data?.message || 'Dépense validée.')
      onFait()
    } catch (err) { toast.error(messageErreur(err, 'Erreur lors de la validation')) }
    finally { setEnvoi(false); setFenetre(null) }
  }

  return (
    <>
      {peutValider && <button type="button" data-action="valider" style={bouton('#15803d', '#f0fdf4', '#bbf7d0')} disabled={envoi} onClick={() => setFenetre('valider')}>Valider</button>}
      {peutPayer && <button type="button" data-action="payer" style={bouton('#1d4ed8', '#eff6ff', '#bfdbfe')} onClick={() => setFenetre('payer')}>Payer</button>}
      {peutAnnulerPaiement && <button type="button" data-action="annuler-paiement" style={bouton('#b45309', '#fffbeb', '#fde68a')} onClick={() => setFenetre('annuler-paiement')}>Annuler le paiement</button>}
      {peutAnnuler && <button type="button" data-action="annuler" style={bouton('#dc2626', '#fef2f2', '#fecaca')} onClick={() => setFenetre('annuler')}>Annuler</button>}
      {peutVoirHistorique && <button type="button" data-action="historique" style={bouton('#475569', '#f8fafc', '#e2e8f0')} onClick={() => setFenetre('historique')}>Historique</button>}

      <ConfirmDialog
        open={fenetre === 'valider'}
        danger={false}
        title="Valider cette dépense ?"
        message={`« ${libelle} » — ${ar(montant)}. Une dépense validée est engagée : elle diminue le disponible réel. La trésorerie ne change qu'au paiement.`}
        confirmLabel="Valider"
        onConfirm={valider}
        onCancel={() => setFenetre(null)}
      />
      {fenetre === 'payer' && <PayerFenetre libelle={libelle} montant={montant} url={url} onClose={() => setFenetre(null)} onFait={onFait} />}
      {fenetre === 'annuler-paiement' && (
        <MotifFenetre titre="Annuler le paiement" bouton="Annuler le paiement" url={`${url}/annuler-paiement`} repli="Erreur lors de l'annulation du paiement"
          explication={`« ${libelle} » — ${ar(montant)}. Le compte sera recrédité et la dépense redeviendra « validée ». L'écriture de paiement reste au journal, compensée par une écriture inverse.`}
          onClose={() => setFenetre(null)} onFait={onFait} />
      )}
      {fenetre === 'annuler' && (
        <MotifFenetre titre="Annuler la dépense" bouton="Annuler la dépense" url={`${url}/annuler`} repli="Erreur lors de l'annulation"
          explication={`« ${libelle} » — ${ar(montant)}. Une dépense annulée ne peut plus être validée ni payée. Cette action est définitive.`}
          onClose={() => setFenetre(null)} onFait={onFait} />
      )}
      {fenetre === 'historique' && <HistoriqueFenetre libelle={libelle} url={url} onClose={() => setFenetre(null)} />}
    </>
  )
}

/** Rappel affiché dans le formulaire quand on modifie une dépense déjà validée. */
export function AvisModificationValidee({ depense }: { depense: SuiviChamps | null }) {
  if (!depense || depense.statut !== 'validee') return null
  return (
    <div data-avis-validee style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: '#92400e', marginBottom: 14 }}>
      Cette dépense est validée. Si son montant change, elle repassera à « enregistrée » et devra être validée à nouveau.
    </div>
  )
}

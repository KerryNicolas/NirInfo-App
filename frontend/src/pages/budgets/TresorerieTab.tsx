import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../../api/axios'
import { messageErreur } from '../../utils/apiError'

/* ══════════════════════════════════════════════════════════════════════
   Indicateurs de trésorerie — GET /tresorerie/indicateurs (lecture seule).

   L'écran n'effectue AUCUN calcul métier : il affiche les chiffres du
   serveur tels quels.
   - Suivi des dépenses activé : Trésorerie, À valider, Engagé, Décaissé,
     Disponible réel.
   - Suivi désactivé : le serveur ne renvoie que la trésorerie ; les autres
     indicateurs ne sont pas affichés.
   La période ne concerne que le Décaissé (mois en cours par défaut).
   ══════════════════════════════════════════════════════════════════════ */

interface Ligne  { total: number; nombre: number }
interface Detail extends Ligne { achats: Ligne; charges: Ligne }
interface Decaisse extends Detail { du: string; au: string; suivi: Ligne; ancien_systeme: Ligne }
interface CompteSolde { id_compte: number; libelle: string; account_number: string; solde: number }
interface Indicateurs {
  suivi_actif: boolean
  tresorerie: { total: number; comptes: CompteSolde[]; comptes_negatifs: number }
  a_valider?: Detail
  engage?: Detail
  decaisse?: Decaisse
  disponible_reel?: number
}

const ar = (n: number) => `${Number(n).toLocaleString('fr')} Ar`
const depenses = (n: number) => `${n} dépense${n > 1 ? 's' : ''}`
const jour = (d: string) => d.split('-').reverse().join('/')

const ROUGE = '#dc2626'

function Carte({ titre, valeur, detail, couleur, note }: { titre: string; valeur: string; detail?: string; couleur: string; note?: string }) {
  return (
    <div className="card" data-indicateur={titre} style={{ padding: 16, borderTop: `3px solid ${couleur}` }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>{titre}</div>
      <div data-valeur style={{ fontSize: 22, fontWeight: 700, color: couleur, margin: '6px 0 4px' }}>{valeur}</div>
      {detail && <div data-detail style={{ fontSize: 12, color: '#64748b' }}>{detail}</div>}
      {note && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{note}</div>}
    </div>
  )
}

export default function TresorerieTab() {
  const [donnees, setDonnees] = useState<Indicateurs | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur,  setErreur]  = useState<string | null>(null)
  // Période saisie (champs) et période réellement demandée au serveur.
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [periode, setPeriode] = useState<{ du?: string; au?: string }>({})
  // Seule la réponse de la dernière demande est affichée.
  const demande = useRef(0)

  const charger = useCallback(async (p: { du?: string; au?: string }) => {
    const numero = ++demande.current
    setLoading(true)
    setErreur(null)
    try {
      const params: Record<string, string> = {}
      if (p.du) params.du = p.du
      if (p.au) params.au = p.au
      const res = await api.get('/tresorerie/indicateurs', { params })
      if (numero === demande.current) setDonnees(res.data)
    } catch (err) {
      if (numero === demande.current) setErreur(messageErreur(err, 'Impossible de charger les indicateurs de trésorerie.'))
    } finally {
      if (numero === demande.current) setLoading(false)
    }
  }, [])

  useEffect(() => { charger(periode) }, [charger, periode])

  const appliquer = (e: React.FormEvent) => {
    e.preventDefault()
    setPeriode({ du: du || undefined, au: au || undefined })
  }
  const moisEnCours = () => { setDu(''); setAu(''); setPeriode({}) }

  const t = donnees?.tresorerie
  const actif = donnees?.suivi_actif === true
  const dispo = donnees?.disponible_reel

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Indicateurs de trésorerie</span>
          <button type="button" className="btn btn-sm" onClick={() => charger(periode)} disabled={loading}>Actualiser</button>
        </div>
        <div className="card-body">
          {erreur && (
            <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: ROUGE, borderRadius: 7, padding: '10px 12px', fontSize: 13, marginBottom: donnees ? 14 : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>{erreur}</span>
              <button type="button" className="btn btn-sm" onClick={() => charger(periode)}>Réessayer</button>
            </div>
          )}

          {!donnees && loading && <div className="loading-center"><div className="spinner" /> Chargement…</div>}

          {donnees && t && (
            <div style={{ opacity: loading ? 0.55 : 1 }}>
              {!actif && (
                <div data-suivi-inactif style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 7, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
                  Le suivi des dépenses n'est pas activé sur cette installation : seule la trésorerie est disponible.
                  Les indicateurs À valider, Engagé, Décaissé et Disponible réel apparaîtront à son activation.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
                <Carte titre="Trésorerie" valeur={ar(t.total)} couleur={t.total < 0 ? ROUGE : '#136a9c'}
                  detail={`${t.comptes.length} compte${t.comptes.length > 1 ? 's' : ''}`}
                  note={t.comptes_negatifs > 0 ? `${t.comptes_negatifs} compte${t.comptes_negatifs > 1 ? 's' : ''} à solde négatif` : undefined} />
                {actif && donnees.a_valider && (
                  <Carte titre="À valider" valeur={ar(donnees.a_valider.total)} couleur="#64748b"
                    detail={depenses(donnees.a_valider.nombre)} note="Saisies non validées : hors de l'engagé" />
                )}
                {actif && donnees.engage && (
                  <Carte titre="Engagé" valeur={ar(donnees.engage.total)} couleur="#d97706"
                    detail={depenses(donnees.engage.nombre)} note="Validées, pas encore payées" />
                )}
                {actif && donnees.decaisse && (
                  <Carte titre="Décaissé" valeur={ar(donnees.decaisse.total)} couleur="#7c3aed"
                    detail={depenses(donnees.decaisse.nombre)} note={`Du ${jour(donnees.decaisse.du)} au ${jour(donnees.decaisse.au)}`} />
                )}
                {actif && dispo !== undefined && (
                  <Carte titre="Disponible réel" valeur={ar(dispo)} couleur={dispo < 0 ? ROUGE : '#16a34a'}
                    detail="Trésorerie − Engagé"
                    note={dispo < 0 ? 'Négatif : les dépenses validées dépassent la trésorerie' : undefined} />
                )}
              </div>

              {actif && (
                <div data-avertissement style={{ fontSize: 12, color: '#64748b', marginTop: 14, lineHeight: 1.5 }}>
                  Le disponible réel est <strong>global</strong> : il n'existe pas par compte, car une dépense validée n'a pas encore de compte
                  (il est choisi au paiement). Il dépend des soldes enregistrés ci-dessous : il vaut ce que valent ces soldes.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {donnees && actif && donnees.decaisse && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="section-info">
              <div className="section-title">Décaissé sur la période</div>
              <div className="section-count">Du {jour(donnees.decaisse.du)} au {jour(donnees.decaisse.au)}</div>
            </div>
          </div>
          <div className="card-body">
            <form onSubmit={appliquer} style={{ marginBottom: 16 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="tresorerie-du">Du </label>
                  <input id="tresorerie-du" className="form-control" type="date" value={du} onChange={e => setDu(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="tresorerie-au">Au </label>
                  <input id="tresorerie-au" className="form-control" type="date" value={au} onChange={e => setAu(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>Appliquer</button>
                <button type="button" className="btn btn-sm" onClick={moisEnCours} disabled={loading}>Mois en cours</button>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Une date laissée vide garde la borne du mois en cours.</span>
              </div>
            </form>
            <div className="table-wrapper">
              <table data-tableau="decaisse">
                <thead><tr><th>Décaissé</th><th>Montant</th><th>Nombre</th></tr></thead>
                <tbody>
                  <tr><td style={{ fontWeight: 600 }}>Achats</td><td>{ar(donnees.decaisse.achats.total)}</td><td>{donnees.decaisse.achats.nombre}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>Charges</td><td>{ar(donnees.decaisse.charges.total)}</td><td>{donnees.decaisse.charges.nombre}</td></tr>
                  <tr><td style={{ fontWeight: 700 }}>Total</td><td style={{ fontWeight: 700 }}>{ar(donnees.decaisse.total)}</td><td style={{ fontWeight: 700 }}>{donnees.decaisse.nombre}</td></tr>
                  <tr><td style={{ color: '#64748b' }}>dont suivi des dépenses</td><td>{ar(donnees.decaisse.suivi.total)}</td><td>{donnees.decaisse.suivi.nombre}</td></tr>
                  <tr><td style={{ color: '#64748b' }}>dont ancien système</td><td>{ar(donnees.decaisse.ancien_systeme.total)}</td><td>{donnees.decaisse.ancien_systeme.nombre}</td></tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
              « Ancien système » : dépenses payées avant la mise en place du suivi, comptées à la date de leur paiement d'origine.
            </div>
          </div>
        </div>
      )}

      {donnees && t && (
        <div className="card">
          <div className="card-header">
            <div className="section-info">
              <div className="section-title">Trésorerie par compte</div>
              <div className="section-count">{t.comptes.length} compte(s)</div>
            </div>
          </div>
          <div className="table-wrapper">
            <table data-tableau="comptes">
              <thead><tr><th>#</th><th>Numéro</th><th>Libellé</th><th>Solde</th></tr></thead>
              <tbody>
                {t.comptes.length === 0 ? (
                  <tr><td colSpan={4}><div className="empty-state">Aucun compte</div></td></tr>
                ) : t.comptes.map((c, idx) => (
                  <tr key={c.id_compte}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{c.account_number}</td>
                    <td style={{ fontWeight: 600 }}>{c.libelle}</td>
                    <td style={{ fontWeight: 600, color: c.solde < 0 ? ROUGE : '#16a34a' }}>
                      {ar(c.solde)}
                      {c.solde < 0 && <span className="badge" style={{ marginLeft: 8, background: '#fef2f2', color: ROUGE, border: '1px solid #fecaca' }}>Solde négatif</span>}
                    </td>
                  </tr>
                ))}
                {t.comptes.length > 0 && (
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 700, textAlign: 'right' }}>Total</td>
                    <td style={{ fontWeight: 700, color: t.total < 0 ? ROUGE : undefined }}>{ar(t.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

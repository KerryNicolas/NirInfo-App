import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useFactureSuggestions } from '../../hooks/useFactureSuggestions'
import { useMatriculeSuggestions } from '../../hooks/useMatriculeSuggestions'
import { useSessionSuggestions } from '../../hooks/useSessionSuggestions'
import { IcoDoc, IcoSession } from '../../components/icons'
// FIX : la présentation de la facture (logo, tableau, montant en lettres,
// impression A5...) vit maintenant dans un seul composant partagé,
// components/FactureInvoice.tsx — le même utilisé juste après une
// inscription (InscriptionTab.tsx). Avant, ce fichier avait sa propre copie
// dupliquée de tout ce rendu, qui pouvait diverger de l'aperçu affiché
// ailleurs dans l'appli ; maintenant il n'existe qu'à un seul endroit.
import FactureInvoice, { FactureData } from '../../components/FactureInvoice'

export default function FacturePage() {
  const [form, setForm] = useState({
    reference: '', numero: '', matricule: '', code_session: '', date_paiement: ''
  })
  const [factures, setFactures] = useState<FactureData[]>([])
  const [loading, setLoading] = useState(false)

  // FIX : autocomplétion sur les 4 champs de recherche — remplace le
  // chargement complet de /sessions (500 lignes d'un coup) et les champs
  // texte libre sans aucune suggestion pour référence/numéro/matricule.
  const [refQuery, setRefQuery] = useState('')
  const refSuggestions = useFactureSuggestions(refQuery)
  const [numeroQuery, setNumeroQuery] = useState('')
  const numeroSuggestions = useFactureSuggestions(numeroQuery)
  const matriculeSuggestions = useMatriculeSuggestions(form.matricule)
  const [sessionQuery, setSessionQuery] = useState('')
  // onlyActive=false — on doit pouvoir retrouver une facture liée à une
  // session déjà terminée, c'est même le cas le plus fréquent en pratique.
  const sessionSuggestions = useSessionSuggestions(sessionQuery, false)

  const handleGenerer = async (e: React.FormEvent) => {
    e.preventDefault()

    const isEmpty = Object.values(form).every(v => v === '')
    if (isEmpty) {
      toast.error('Certains champs sont obligatoires')
      return
    }

    setLoading(true)
    try {
      const verify = await api.post('/factures/verify', {
        reference:      form.reference,
        numero:         form.numero,
        matricule:      form.matricule,
        code_session:   form.code_session,
        date_paiement:  form.date_paiement,
      })

      const references: string[] = verify.data.references

      const printRes = await api.post('/factures/print-all', { references })
      setFactures(printRes.data)
      toast.success(`${printRes.data.length} facture(s) chargée(s)`)

    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="app-layout">
      <Sidebar section="facture" />
      <div className="main-content">

        <div className="top-bar">
          <span className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcoDoc /> Facture
          </span>
        </div>

        <div style={{ padding: 24 }}>

          {/* ── Formulaire — champs groupés par paire, comme le reste de l'appli ── */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <IcoDoc /> Impression facture
              </span>
            </div>
            <div className="card-body">
              <form onSubmit={handleGenerer}>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Référence</label>
                    {/* FIX : autocomplétion — sélectionner une suggestion
                        remplit reference avec le vrai ref_facture (id). */}
                    <input
                      className="form-control"
                      list="facture-ref-suggestions"
                      value={refQuery}
                      onChange={e => {
                        const v = e.target.value
                        setRefQuery(v)
                        setForm(p => ({ ...p, reference: v }))
                      }}
                      placeholder="Ex: 1773034831" />
                    <datalist id="facture-ref-suggestions">
                      {refSuggestions.map(s => (
                        <option key={s.ref_facture} value={s.ref_facture}>
                          {s.numero_facture} — {s.nom} {s.prenom} ({s.matricule})
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Numéro</label>
                    <input
                      className="form-control"
                      list="facture-numero-suggestions"
                      value={numeroQuery}
                      onChange={e => {
                        const v = e.target.value
                        setNumeroQuery(v)
                        setForm(p => ({ ...p, numero: v }))
                      }}
                      placeholder="Ex: 2025-0001" />
                    <datalist id="facture-numero-suggestions">
                      {numeroSuggestions.map(s => (
                        <option key={s.ref_facture} value={s.numero_facture}>
                          {s.nom} {s.prenom} ({s.matricule})
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Matricule</label>
                    <input
                      className="form-control"
                      list="facture-matricule-suggestions"
                      value={form.matricule}
                      onChange={e => setForm(p => ({ ...p, matricule: e.target.value.toUpperCase() }))}
                      placeholder="Ex: NI-3824" />
                    <datalist id="facture-matricule-suggestions">
                      {matriculeSuggestions.map(s => (
                        <option key={s.matricule} value={s.matricule}>{s.nom} {s.prenom}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Session</label>
                    {/* FIX : autocomplétion au lieu du chargement complet de
                        /sessions (jusqu'à 500 lignes d'un coup). */}
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                        <IcoSession />
                      </span>
                      <input
                        className="form-control"
                        style={{ paddingLeft: 32 }}
                        list="facture-session-suggestions"
                        value={sessionQuery}
                        onChange={e => {
                          const v = e.target.value
                          setSessionQuery(v)
                          const match = sessionSuggestions.find(s => s.code_session === v)
                          setForm(p => ({ ...p, code_session: match ? v : '' }))
                        }}
                        placeholder="Tapez pour rechercher une session…" />
                      <datalist id="facture-session-suggestions">
                        {sessionSuggestions.map(s => (
                          <option key={s.code_session} value={s.code_session}>{s.module_nom}</option>
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date paiement</label>
                  <input className="form-control" type="date" value={form.date_paiement}
                    onChange={set('date_paiement')} />
                </div>
              </div>
                <button type="submit" className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 7 }} disabled={loading}>
                  {loading
                    ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Génération…</>
                    : <><IcoDoc /> Générer</>
                  }
                </button>
              </form>
            </div>
          </div>

          {/* ── Aperçu : liste de factures — modèle partagé avec InscriptionTab.tsx ── */}
          <FactureInvoice factures={factures} />
        </div>
      </div>
    </div>
  )
}
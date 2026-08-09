import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { IcoDoc, IcoSession, IcoPrint } from '../../components/icons'

interface FactureData {
  reference: string; numero: string
  etudiant: { matricule: string; nom: string; prenom: string; telephone: string; email: string }
  session: { code_session: string; module_nom: string; date_debut: string; date_fin: string; frais_formation: number; lieu: string; horaire_desc: string }
  inscription: { montant_paye: number; somme_deja_paye: number; total_paye: number; reste: number; date_paiement: string; compte: string }
  date_facture: string
  centre: { nom: string; adresse: string; tel: string; email: string }
}

export default function FacturePage() {
  const [sessions, setSessions] = useState<{ code_session: string }[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [form, setForm] = useState({
    reference: '', numero: '', matricule: '', code_session: '', date_paiement: ''
  })
  const [factures, setFactures] = useState<FactureData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/sessions', { params: { per_page: 500 } })
      .then(r => setSessions(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingSessions(false))
  }, [])

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

  const handlePrint = () => window.print()

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const fmt = (n: number) => Number(n).toLocaleString('fr')

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
                    <input className="form-control" value={form.reference}
                      onChange={set('reference')} placeholder="Ex: FAC-2025-0001" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Numéro</label>
                    <input className="form-control" value={form.numero}
                      onChange={set('numero')} placeholder="Ex: 2025-0001" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Matricule</label>
                    <input className="form-control" value={form.matricule}
                      onChange={set('matricule')} placeholder="Ex: NI-3824" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Session</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                        <IcoSession />
                      </span>
                      <select className="form-control" style={{ paddingLeft: 32 }}
                        value={form.code_session} onChange={set('code_session')}>
                        <option value="">-- Choisir une session --</option>
                        {loadingSessions
                          ? <option disabled>Chargement…</option>
                          : sessions.map(s => (
                              <option key={s.code_session} value={s.code_session}>{s.code_session}</option>
                            ))
                        }
                      </select>
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

          {/* ── Aperçu : liste de factures ── */}
          {factures.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <IcoDoc /> {factures.length > 1 ? `${factures.length} factures` : 'Aperçu de la facture'}
                </span>
                <button className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={handlePrint}>
                  <IcoPrint /> Imprimer
                </button>
              </div>

              <div className="card-body" id="facture-print">
                {factures.map((facture, idx) => (
                  <div key={facture.reference}
                    style={{ maxWidth: 700, margin: '0 auto', ...(idx > 0 ? { marginTop: 40, paddingTop: 40, borderTop: '2px dashed #e2e8f0' } : {}) }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #1e3a8a' }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a8a' }}>{facture.centre.nom}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{facture.centre.adresse}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{facture.centre.tel} | {facture.centre.email}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a' }}>FACTURE</div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Réf : <b>{facture.reference}</b></div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>N° : <b>{facture.numero}</b></div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>Date : <b>{facture.date_facture}</b></div>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 10, textTransform: 'uppercase' }}>Étudiant</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                        <div><span style={{ color: '#64748b' }}>Matricule : </span><b>{facture.etudiant.matricule}</b></div>
                        <div><span style={{ color: '#64748b' }}>Nom : </span><b>{facture.etudiant.nom} {facture.etudiant.prenom}</b></div>
                        <div><span style={{ color: '#64748b' }}>Téléphone : </span>{facture.etudiant.telephone}</div>
                        <div><span style={{ color: '#64748b' }}>Email : </span>{facture.etudiant.email}</div>
                      </div>
                    </div>

                    <div style={{ background: '#eff6ff', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 10, textTransform: 'uppercase' }}>Formation</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                        <div><span style={{ color: '#64748b' }}>Module : </span><b>{facture.session.module_nom}</b></div>
                        <div><span style={{ color: '#64748b' }}>Session : </span>{facture.session.code_session}</div>
                        <div><span style={{ color: '#64748b' }}>Début : </span>{facture.session.date_debut}</div>
                        <div><span style={{ color: '#64748b' }}>Fin : </span>{facture.session.date_fin}</div>
                        <div><span style={{ color: '#64748b' }}>Lieu : </span>{facture.session.lieu}</div>
                        <div><span style={{ color: '#64748b' }}>Horaire : </span>{facture.session.horaire_desc}</div>
                      </div>
                    </div>

                    <div style={{ border: '2px solid #1e3a8a', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 14, textTransform: 'uppercase' }}>Détail du paiement</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#1e3a8a', color: 'white' }}>
                            <th style={{ padding: '8px 14px', textAlign: 'left' }}>Description</th>
                            <th style={{ padding: '8px 14px', textAlign: 'right' }}>Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 14px' }}>Frais de formation — {facture.session.module_nom}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{fmt(facture.session.frais_formation)} Ar</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 14px', color: '#64748b' }}>Déjà versé (avant cette facture)</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmt(facture.inscription.somme_deja_paye)} Ar</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 14px', color: '#16a34a', fontWeight: 600 }}>Montant payé (cette facture)</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(facture.inscription.montant_paye)} Ar</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>Total versé</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{fmt(facture.inscription.total_paye)} Ar</td>
                          </tr>
                          <tr style={{ background: '#fef2f2' }}>
                            <td style={{ padding: '10px 14px', color: '#dc2626', fontWeight: 600 }}>Reste à payer</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{fmt(facture.inscription.reste)} Ar</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                      Merci pour votre confiance — {facture.centre.nom} © {new Date().getFullYear()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
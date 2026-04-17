import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/axios'
import toast from 'react-hot-toast'

interface FactureData {
  reference: string; numero: string
  etudiant: { matricule: string; nom: string; prenom: string; telephone: string; email: string }
  session: { code_session: string; module_nom: string; date_debut: string; date_fin: string; frais_formation: number; lieu: string; horaire_desc: string }
  inscription: { montant_paye: number; reste: number; date_paiement: string; compte: string }
  date_facture: string
  centre: { nom: string; adresse: string; tel: string; email: string }
}

/* ── Icônes SVG professionnelles ── */
const IcoDoc = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const IcoPrint = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"/>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
)
const IcoSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IcoSession = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
)

export default function FacturePage() {
  const [sessions,  setSessions]  = useState<{ code_session: string }[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [formSearch, setFormSearch] = useState({ code_session: '', date: '' })
  const [form, setForm] = useState({
    reference: '', numero: '', matricule: '', code_session: '', date_paiement: ''
  })
  const [facture, setFacture] = useState<FactureData | null>(null)
  const [loading, setLoading] = useState(false)

  /* ── Chargement automatique des sessions au montage ── */
  useEffect(() => {
    api.get('/sessions')
      .then(r => setSessions(r.data.data ?? []))
      .catch(() => {}) // Silencieux
      .finally(() => setLoadingSessions(false))
  }, [])

  const handleGenerer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.matricule || !form.code_session) {
      toast.error('Matricule et session sont requis')
      return
    }
    setLoading(true)
    try {
      const r = await api.post('/factures/generate', {
        matricule: form.matricule,
        code_session: form.code_session,
        date_paiement: form.date_paiement || undefined,
      })
      setFacture(r.data)
      toast.success('Facture générée avec succès')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la génération')
    } finally { setLoading(false) }
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

          {/* ── Recherche par session / date ── */}
          {/* <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <IcoSearch /> Recherche par session / date
              </span>
            </div>
            <div className="card-body">
              <div className="form-row" style={{ maxWidth: 520 }}>
                <div className="form-group">
                  <label className="form-label">Session</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                      <IcoSession />
                    </span>
                    <select
                      className="form-control"
                      style={{ paddingLeft: 32 }}
                      value={formSearch.code_session}
                      onChange={e => setFormSearch(p => ({ ...p, code_session: e.target.value }))}
                    >
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
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-control" type="date"
                    value={formSearch.date}
                    onChange={e => setFormSearch(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IcoSearch /> Afficher
              </button>
            </div>
          </div> */}

          {/* ── Impression facture ── */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <IcoDoc /> Impression facture
              </span>
            </div>
            <div className="card-body">
              <form onSubmit={handleGenerer} style={{ maxWidth: 520 }}>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Référence</label>
                    <input className="form-control" value={form.reference}
                      onChange={set('reference')} placeholder="Auto-généré" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Numéro</label>
                    <input className="form-control" value={form.numero}
                      onChange={set('numero')} placeholder="Auto-généré" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Matricule <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-control" value={form.matricule}
                    onChange={set('matricule')} required placeholder="Ex: NI-3824" />
                </div>

                <div className="form-group">
                  <label className="form-label">Session <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                      <IcoSession />
                    </span>
                    <select className="form-control" style={{ paddingLeft: 32 }}
                      value={form.code_session} onChange={set('code_session')} required>
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

                <div className="form-group">
                  <label className="form-label">Date paiement</label>
                  <input className="form-control" type="date" value={form.date_paiement}
                    onChange={set('date_paiement')} />
                </div>

                <button type="submit" className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 7 }} disabled={loading}>
                  {loading
                    ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Génération…</>
                    : <><IcoDoc /> Générer la facture</>
                  }
                </button>
              </form>
            </div>
          </div>

          {/* ── Aperçu facture ── */}
          {facture && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <IcoDoc /> Aperçu de la facture
                </span>
                <button className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={handlePrint}>
                  <IcoPrint /> Imprimer
                </button>
              </div>
              <div className="card-body" id="facture-print" style={{ maxWidth: 700, margin: '0 auto' }}>

                {/* En-tête */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #1e3a8a' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 36, height: 36, background: '#1e3a8a', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
                          <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                        </svg>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a8a' }}>{facture.centre.nom}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{facture.centre.adresse}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{facture.centre.tel} | {facture.centre.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a' }}>FACTURE</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Réf : <b>{facture.reference}</b></div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>Date : <b>{facture.date_facture}</b></div>
                  </div>
                </div>

                {/* Étudiant */}
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Étudiant</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div><span style={{ color: '#64748b' }}>Matricule : </span><b>{facture.etudiant.matricule}</b></div>
                    <div><span style={{ color: '#64748b' }}>Nom : </span><b>{facture.etudiant.nom} {facture.etudiant.prenom}</b></div>
                    <div><span style={{ color: '#64748b' }}>Téléphone : </span>{facture.etudiant.telephone}</div>
                    <div><span style={{ color: '#64748b' }}>Email : </span>{facture.etudiant.email}</div>
                  </div>
                </div>

                {/* Formation */}
                <div style={{ background: '#eff6ff', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formation</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div><span style={{ color: '#64748b' }}>Module : </span><b>{facture.session.module_nom}</b></div>
                    <div><span style={{ color: '#64748b' }}>Session : </span>{facture.session.code_session}</div>
                    <div><span style={{ color: '#64748b' }}>Début : </span>{facture.session.date_debut}</div>
                    <div><span style={{ color: '#64748b' }}>Fin : </span>{facture.session.date_fin}</div>
                    <div><span style={{ color: '#64748b' }}>Lieu : </span>{facture.session.lieu}</div>
                    <div><span style={{ color: '#64748b' }}>Horaire : </span>{facture.session.horaire_desc}</div>
                  </div>
                </div>

                {/* Paiement */}
                <div style={{ border: '2px solid #1e3a8a', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Détail du paiement</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#1e3a8a', color: 'white' }}>
                        <th style={{ padding: '8px 14px', textAlign: 'left', borderRadius: '6px 0 0 0' }}>Description</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right', borderRadius: '0 6px 0 0' }}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 14px' }}>Frais de formation — {facture.session.module_nom}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{fmt(facture.session.frais_formation)} Ar</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 14px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Montant payé
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(facture.inscription.montant_paye)} Ar</td>
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
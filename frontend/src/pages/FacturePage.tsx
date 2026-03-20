import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/axios'
import toast from 'react-hot-toast'

interface FactureData {
  reference: string; numero: string
  etudiant: { matricule:string; nom:string; prenom:string; telephone:string; email:string }
  session: { code_session:string; module_nom:string; date_debut:string; date_fin:string; frais_formation:number; lieu:string; horaire_desc:string }
  inscription: { montant_paye:number; reste:number; date_paiement:string; compte:string }
  date_facture: string
  centre: { nom:string; adresse:string; tel:string; email:string }
}

export default function FacturePage() {
  const [sessions, setSessions] = useState<{code_session:string}[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [formSearch, setFormSearch] = useState({ code_session:'', date:'' })
  const [form, setForm] = useState({ reference:'', numero:'', matricule:'', code_session:'', date_paiement:'' })
  const [facture, setFacture] = useState<FactureData|null>(null)
  const [loading, setLoading] = useState(false)

  const loadSessions = async () => {
    if(sessionsLoaded) return
    try { const r = await api.get('/sessions'); setSessions(r.data.data); setSessionsLoaded(true) }
    catch {}
  }

  const handleGenerer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.matricule || !form.code_session) { toast.error('Matricule et session requis'); return }
    setLoading(true)
    try {
      const r = await api.post('/factures/generate', { matricule: form.matricule, code_session: form.code_session, date_paiement: form.date_paiement || undefined })
      setFacture(r.data)
      toast.success('Facture générée')
    } catch(err:any) { toast.error(err.response?.data?.message || 'Erreur génération facture') }
    finally { setLoading(false) }
  }

  const handlePrint = () => window.print()

  const set = (k:string)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setForm(p=>({...p,[k]:e.target.value}))

  return (
    <div className="app-layout">
      <Sidebar section="facture" />
      <div className="main-content">
        <div className="page-body">
          <div style={{marginBottom:20}}>
            <h2 style={{fontSize:20,fontWeight:700,color:'#1e293b'}}>Facture</h2>
            <div style={{width:40,height:3,background:'#2563eb',borderRadius:2,marginTop:4}}/>
          </div>

          {/* Search pointage */}
          <div className="card" style={{marginBottom:20}}>
            <div className="card-header"><span className="card-title">Recherche par session / date</span></div>
            <div className="card-body">
              <div className="form-row" style={{maxWidth:480}}>
                <div className="form-group" onClick={loadSessions}><label className="form-label">Session :</label>
                  <select className="form-control" value={formSearch.code_session} onChange={e=>setFormSearch(p=>({...p,code_session:e.target.value}))}>
                    <option value="">-- Choisir --</option>
                    {sessions.map((s:any)=><option key={s.code_session} value={s.code_session}>{s.code_session}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Date :</label>
                  <input className="form-control" type="date" value={formSearch.date} onChange={e=>setFormSearch(p=>({...p,date:e.target.value}))} /></div>
              </div>
              <button className="btn btn-primary btn-sm">Afficher</button>
            </div>
          </div>

          {/* Impression facture */}
          <div className="card">
            <div className="card-header"><span className="card-title">Impression facture</span></div>
            <div className="card-body">
              <form onSubmit={handleGenerer} style={{maxWidth:520}}>
                <div className="form-group"><label className="form-label">Référence</label>
                  <input className="form-control" value={form.reference} onChange={set('reference')} placeholder="Auto-généré" /></div>
                <div className="form-group"><label className="form-label">Numéro</label>
                  <input className="form-control" value={form.numero} onChange={set('numero')} placeholder="Auto-généré" /></div>
                <div className="form-group"><label className="form-label">Matricule</label>
                  <input className="form-control" value={form.matricule} onChange={set('matricule')} required placeholder="Ex: NI-3824" /></div>
                <div className="form-group" onClick={loadSessions}><label className="form-label">Session :</label>
                  <select className="form-control" value={form.code_session} onChange={set('code_session')} required>
                    <option value="">-- Choisir --</option>
                    {sessions.map((s:any)=><option key={s.code_session} value={s.code_session}>{s.code_session}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Date paiement</label>
                  <input className="form-control" type="date" value={form.date_paiement} onChange={set('date_paiement')} /></div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading?<><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Génération…</>:'📄 Générer'}
                </button>
              </form>
            </div>
          </div>

          {/* Facture preview */}
          {facture && (
            <div className="card" style={{marginTop:24}}>
              <div className="card-header">
                <span className="card-title">Aperçu de la facture</span>
                <button className="btn btn-primary btn-sm" onClick={handlePrint}>🖨️ Imprimer</button>
              </div>
              <div className="card-body" id="facture-print" style={{maxWidth:700,margin:'0 auto'}}>
                {/* Header */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28,paddingBottom:20,borderBottom:'2px solid #1e3a8a'}}>
                  <div>
                    <div style={{fontSize:26,fontWeight:800,color:'#1e3a8a'}}>🎓 {facture.centre.nom}</div>
                    <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{facture.centre.adresse}</div>
                    <div style={{fontSize:12,color:'#64748b'}}>{facture.centre.tel} | {facture.centre.email}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:22,fontWeight:700,color:'#1e3a8a'}}>FACTURE</div>
                    <div style={{fontSize:13,color:'#64748b',marginTop:4}}>Réf : <b>{facture.reference}</b></div>
                    <div style={{fontSize:13,color:'#64748b'}}>Date : <b>{facture.date_facture}</b></div>
                  </div>
                </div>

                {/* Étudiant */}
                <div style={{background:'#f8fafc',borderRadius:10,padding:'16px 20px',marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1e3a8a',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Étudiant</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:13}}>
                    <div><span style={{color:'#64748b'}}>Matricule : </span><b>{facture.etudiant.matricule}</b></div>
                    <div><span style={{color:'#64748b'}}>Nom : </span><b>{facture.etudiant.nom} {facture.etudiant.prenom}</b></div>
                    <div><span style={{color:'#64748b'}}>Téléphone : </span>{facture.etudiant.telephone}</div>
                    <div><span style={{color:'#64748b'}}>Email : </span>{facture.etudiant.email}</div>
                  </div>
                </div>

                {/* Session */}
                <div style={{background:'#eff6ff',borderRadius:10,padding:'16px 20px',marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1e3a8a',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Formation</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:13}}>
                    <div><span style={{color:'#64748b'}}>Module : </span><b>{facture.session.module_nom}</b></div>
                    <div><span style={{color:'#64748b'}}>Session : </span>{facture.session.code_session}</div>
                    <div><span style={{color:'#64748b'}}>Début : </span>{facture.session.date_debut}</div>
                    <div><span style={{color:'#64748b'}}>Fin : </span>{facture.session.date_fin}</div>
                    <div><span style={{color:'#64748b'}}>Lieu : </span>{facture.session.lieu}</div>
                    <div><span style={{color:'#64748b'}}>Horaire : </span>{facture.session.horaire_desc}</div>
                  </div>
                </div>

                {/* Paiement */}
                <div style={{border:'2px solid #1e3a8a',borderRadius:10,padding:'16px 20px',marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1e3a8a',marginBottom:14,textTransform:'uppercase',letterSpacing:'0.05em'}}>Détail du paiement</div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{background:'#1e3a8a',color:'white'}}>
                        <th style={{padding:'8px 14px',textAlign:'left',borderRadius:'6px 0 0 0'}}>Description</th>
                        <th style={{padding:'8px 14px',textAlign:'right',borderRadius:'0 6px 0 0'}}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{borderBottom:'1px solid #e2e8f0'}}>
                        <td style={{padding:'10px 14px'}}>Frais de formation — {facture.session.module_nom}</td>
                        <td style={{padding:'10px 14px',textAlign:'right',fontWeight:600}}>{Number(facture.session.frais_formation).toLocaleString('fr')} Ar</td>
                      </tr>
                      <tr style={{borderBottom:'1px solid #e2e8f0'}}>
                        <td style={{padding:'10px 14px',color:'#16a34a'}}>✓ Montant payé</td>
                        <td style={{padding:'10px 14px',textAlign:'right',fontWeight:700,color:'#16a34a'}}>{Number(facture.inscription.montant_paye).toLocaleString('fr')} Ar</td>
                      </tr>
                      <tr style={{background:'#fef2f2'}}>
                        <td style={{padding:'10px 14px',color:'#dc2626',fontWeight:600}}>Reste à payer</td>
                        <td style={{padding:'10px 14px',textAlign:'right',fontWeight:700,color:'#dc2626'}}>{Number(facture.inscription.reste).toLocaleString('fr')} Ar</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{textAlign:'center',color:'#94a3b8',fontSize:12,marginTop:20,paddingTop:16,borderTop:'1px solid #e2e8f0'}}>
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

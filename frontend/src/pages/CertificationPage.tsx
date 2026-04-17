import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import Pagination from '../components/Pagination'

interface Certification {
  id: number; reference: string; matricule: string
  nom: string; prenom: string; nom_complet: string
  module_nom: string; debut_session: string; fin_session: string
  date: string; prix: number; nom_formation?: string
}
interface Module { code_module: string; nom: string }
type SubTab = 'certification' | 'montant'

const today = new Date().toISOString().split('T')[0]
const EMPTY = { matricule:'', code_module:'', date_debut:'', date_fin:'', nom_formation_certificat:'', lieu_paiement:'Ampandrana', code_session:'', prix:'' }

/* ── Icônes ── */
const IcoCertif = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
const IcoPrint  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
const IcoTrash  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IcoSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoMoney  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M8.5 9.5a3.5 3.5 0 0 1 7 0c0 2-3.5 3-3.5 3s-3.5 1-3.5 3a3.5 3.5 0 0 0 7 0"/></svg>
const IcoAward  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
const IcoClose  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

function CertificatView({ certif, onClose }: { certif: Certification; onClose: () => void }) {
  const fmt = (d: string) => { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ position:'absolute', top:20, right:20, display:'flex', gap:10, zIndex:201 }} className="no-print">
        <button onClick={() => window.print()} className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}><IcoPrint /> Imprimer</button>
        <button onClick={onClose} className="btn btn-secondary" style={{ display:'flex', alignItems:'center', gap:6 }}><IcoClose /> Fermer</button>
      </div>
      <div id="certificat-print" style={{ width:794, minHeight:560, background:'white', position:'relative', fontFamily:"'Georgia','Times New Roman',serif", overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:12, border:'3px solid #1e3a8a', borderRadius:4, pointerEvents:'none' }} />
        <div style={{ position:'absolute', inset:18, border:'1px solid #93c5fd', borderRadius:2, pointerEvents:'none' }} />
        {[{top:8,left:8},{top:8,right:8},{bottom:8,left:8},{bottom:8,right:8}].map((pos,i) => (
          <div key={i} style={{ position:'absolute', width:40, height:40, ...pos, borderTop: (pos as any).top!==undefined?'4px solid #1e3a8a':'none', borderBottom: (pos as any).bottom!==undefined?'4px solid #1e3a8a':'none', borderLeft: (pos as any).left!==undefined?'4px solid #1e3a8a':'none', borderRight: (pos as any).right!==undefined?'4px solid #1e3a8a':'none' }} />
        ))}
        <div style={{ padding:'48px 72px', position:'relative', zIndex:1 }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:8 }}>
              <div style={{ width:48, height:48, background:'#1e3a8a', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              </div>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:22, fontWeight:700, color:'#1e3a8a', fontFamily:'sans-serif', letterSpacing:2 }}>NIR'INFO</div>
                <div style={{ fontSize:11, color:'#64748b', fontFamily:'sans-serif', letterSpacing:1, textTransform:'uppercase' }}>Centre de Formation Professionnelle</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12, margin:'16px 0' }}>
              <div style={{ flex:1, height:1, background:'#1e3a8a' }} />
              <div style={{ width:8, height:8, background:'#1e3a8a', transform:'rotate(45deg)' }} />
              <div style={{ flex:1, height:1, background:'#1e3a8a' }} />
            </div>
            <div style={{ fontSize:13, color:'#64748b', fontFamily:'sans-serif', letterSpacing:3, textTransform:'uppercase' }}>Certificat de Formation</div>
            <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'sans-serif' }}>Réf : {certif.reference}</div>
          </div>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <p style={{ fontSize:14, color:'#475569', marginBottom:20, fontFamily:'sans-serif', lineHeight:1.8 }}>Le Centre de Formation Professionnelle <strong style={{ color:'#1e3a8a' }}>Nir'Info</strong> certifie que</p>
            <div style={{ margin:'20px 0' }}>
              <div style={{ fontSize:34, fontWeight:700, color:'#1e3a8a', fontFamily:"'Georgia',serif", letterSpacing:1, borderBottom:'2px solid #93c5fd', display:'inline-block', paddingBottom:6, minWidth:400 }}>
                {certif.nom_complet || `${certif.nom} ${certif.prenom}` || '—'}
              </div>
              <div style={{ fontSize:12, color:'#94a3b8', fontFamily:'sans-serif', marginTop:4 }}>Matricule : {certif.matricule}</div>
            </div>
            <p style={{ fontSize:14, color:'#475569', margin:'20px 0 10px', fontFamily:'sans-serif', lineHeight:1.8 }}>a suivi et validé avec succès la formation</p>
            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'14px 32px', display:'inline-block', margin:'8px 0' }}>
              <div style={{ fontSize:20, fontWeight:700, color:'#1e3a8a', fontFamily:'sans-serif' }}>{certif.nom_formation || certif.module_nom || '—'}</div>
            </div>
            <div style={{ marginTop:20, display:'flex', justifyContent:'center', gap:40 }}>
              {[['Début', certif.debut_session], ['Fin', certif.fin_session], ['Délivré le', certif.date]].map(([label, val]) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'sans-serif', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', fontFamily:'sans-serif' }}>{fmt(String(val))}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop:40 }}>
            <div style={{ textAlign:'center', minWidth:180 }}>
              <div style={{ height:60, borderBottom:'1px solid #1e3a8a', marginBottom:6 }} />
              <div style={{ fontSize:11, color:'#64748b', fontFamily:'sans-serif' }}>Signature de l'étudiant(e)</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ width:80, height:80, border:'2px solid #1e3a8a', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px', color:'#1e3a8a', fontSize:10, fontFamily:'sans-serif', textAlign:'center', lineHeight:1.2 }}>CACHET<br/>OFFICIEL</div>
            </div>
            <div style={{ textAlign:'center', minWidth:180 }}>
              <div style={{ height:60, borderBottom:'1px solid #1e3a8a', marginBottom:6 }} />
              <div style={{ fontSize:11, color:'#64748b', fontFamily:'sans-serif' }}>Le Directeur</div>
              <div style={{ fontSize:12, fontWeight:600, color:'#1e3a8a', fontFamily:'sans-serif' }}>Nir'Info</div>
            </div>
          </div>
          <div style={{ textAlign:'center', marginTop:24, paddingTop:16, borderTop:'1px solid #e2e8f0' }}>
            <div style={{ fontSize:10, color:'#94a3b8', fontFamily:'sans-serif' }}>LOT IIA 80C Ampandrana Ouest, Antananarivo 101 — Tel : 034 36 176 60 — admin@nir-info.mg</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CertificationPage() {
  const [tab, setTab]       = useState<SubTab>('certification')
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [printCertif, setPrintCertif] = useState<Certification | null>(null)

  /* ── Modules pour le select ── */
  const modulesTable = useTable<Module>('/modules', { perPage: 200, autoLoad: true })

  /* ── Certifications avec pagination LIFO ── */
  const certifTable = useTable<Certification>('/certifications', { perPage: 15 })

  /* ── Montant perçu ── */
  const [dateDebut, setDateDebut]   = useState(today)
  const [dateFin,   setDateFin]     = useState(today)
  const [montantData, setMontantData] = useState<{ nb: number; montant: number } | null>(null)
  const [loadingMontant, setLoadingMontant] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleGenerer = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('/certifications', form)
      toast.success('Certificat généré')
      setForm(EMPTY); certifTable.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleDelete = async (reference: string) => {
    if (!confirm(`Supprimer "${reference}" ?`)) return
    try { await api.delete(`/certifications/${reference}`); toast.success('Supprimé'); certifTable.reload() }
    catch { toast.error('Erreur suppression') }
  }

  const handleVoirMontant = async () => {
    setLoadingMontant(true)
    try {
      const r = await api.get('/certifications/montant', { params: { date_debut: dateDebut, date_fin: dateFin } })
      setMontantData(r.data)
    } catch { setMontantData({ nb:0, montant:0 }) }
    finally { setLoadingMontant(false) }
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <div className="app-layout">
      <Sidebar section="formation" />
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display:'flex', alignItems:'center', gap:8 }}><IcoCertif /> Certification</span>
        </div>
        <div style={{ padding:24 }}>
          <div className="tabs">
            {([['certification','Certification'],['montant','Montant perçu']] as [SubTab,string][]).map(([t,l]) => (
              <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={() => setTab(t)}>{l}</button>
            ))}
          </div>

          {tab === 'certification' && (<>
            {/* Formulaire */}
            <div className="card" style={{ marginBottom:20 }}>
              <div className="card-header">
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}><IcoAward /> Générer un certificat</span>
              </div>
              <div className="card-body">
                <form onSubmit={handleGenerer}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Matricule *</label>
                      <input className="form-control" value={form.matricule} onChange={set('matricule')} required placeholder="Ex: NI-3757" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Module *</label>
                      <select className="form-control" value={form.code_module} onChange={set('code_module')} required>
                        <option value="">-- Choisir un module --</option>
                        {modulesTable.data.map(m => <option key={m.code_module} value={m.code_module}>{m.nom}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Nom affiché sur le certificat</label>
                      <input className="form-control" value={form.nom_formation_certificat} onChange={set('nom_formation_certificat')} placeholder="Ex: Excel Avancé" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Prix certificat (Ar)</label>
                      <input className="form-control" type="number" value={form.prix} onChange={set('prix')} placeholder="Ex: 25000" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Début session</label>
                      <input className="form-control" type="date" value={form.date_debut} onChange={set('date_debut')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fin session</label>
                      <input className="form-control" type="date" value={form.date_fin} onChange={set('date_fin')} />
                    </div>
                  </div>
                  <div className="form-group" style={{ maxWidth:280 }}>
                    <label className="form-label">Lieu de paiement</label>
                    <select className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiement')}>
                      <option>Ampandrana</option><option>Ampefiloha</option><option>Andravoahangy</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:7 }} disabled={saving}>
                    {saving ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Génération…</> : <><IcoCertif /> Générer le certificat</>}
                  </button>
                </form>
              </div>
            </div>

            {/* Tableau avec pagination */}
            <div className="card">
              <div className="card-header">
                <div className="section-info">
                  <div className="section-title">Liste des certifications</div>
                  <div className="section-count">{certifTable.meta.total} certificat(s)</div>
                </div>
                <div className="search-bar">
                  <IcoSearch />
                  <input placeholder="Rechercher (matricule, nom, réf)..." value={certifTable.search} onChange={e => certifTable.setSearch(e.target.value)} />
                  {certifTable.search && <button onClick={() => certifTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, fontSize:16 }}>×</button>}
                </div>
              </div>
              <div className="table-wrapper">
                {certifTable.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
                  <table>
                    <thead><tr><th>#</th><th>Référence</th><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Formation</th><th>Début</th><th>Fin</th><th>Prix</th><th>Action</th></tr></thead>
                    <tbody>
                      {certifTable.data.length === 0
                        ? <tr><td colSpan={10}><div className="empty-state">Aucune certification trouvée</div></td></tr>
                        : certifTable.data.map((c, idx) => (
                          <tr key={c.reference}>
                            <td style={{ color:'#94a3b8', fontSize:12 }}>{(certifTable.meta.current_page-1)*certifTable.meta.per_page+idx+1}</td>
                            <td style={{ fontWeight:600, color:'#2563eb', fontSize:12 }}>{c.reference}</td>
                            <td><span className="badge badge-info">{c.matricule}</span></td>
                            <td style={{ fontWeight:600 }}>{c.nom || c.nom_complet?.split(' ')[0] || '—'}</td>
                            <td>{c.prenom || c.nom_complet?.split(' ').slice(1).join(' ') || '—'}</td>
                            <td><span className="badge badge-warning">{c.module_nom}</span></td>
                            <td style={{ fontSize:12 }}>{c.debut_session}</td>
                            <td style={{ fontSize:12 }}>{c.fin_session}</td>
                            <td style={{ fontWeight:600, color:'#16a34a', fontSize:12 }}>{c.prix ? fmt(c.prix)+' Ar' : '—'}</td>
                            <td><div className="table-actions">
                              <button className="btn-icon edit" onClick={() => setPrintCertif(c)} title="Imprimer"><IcoPrint /></button>
                              <button className="btn-icon delete" onClick={() => handleDelete(c.reference)} title="Supprimer"><IcoTrash /></button>
                            </div></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                )}
              </div>
              {!certifTable.loading && certifTable.meta.total > 0 && (
                <Pagination meta={certifTable.meta} onPage={certifTable.setPage} onPerPage={certifTable.setPerPage} />
              )}
            </div>
          </>)}

          {tab === 'montant' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}><IcoMoney /> Montant perçu — Certifications</span>
              </div>
              <div className="card-body">
                <div style={{ display:'flex', alignItems:'flex-end', gap:12, flexWrap:'wrap', marginBottom:24 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Date début</label>
                    <input className="form-control" type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Date fin</label>
                    <input className="form-control" type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={handleVoirMontant} disabled={loadingMontant}>
                    {loadingMontant ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Chargement…</> : <><IcoSearch /> Voir</>}
                  </button>
                </div>
                {montantData ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:24, textAlign:'center' }}>
                      <div style={{ width:48, height:48, borderRadius:'50%', background:'#dcfce7', color:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}><IcoAward /></div>
                      <p style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>Certificats délivrés</p>
                      <p style={{ fontSize:40, fontWeight:800, color:'#16a34a', lineHeight:1 }}>{montantData.nb}</p>
                    </div>
                    <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:12, padding:24, textAlign:'center' }}>
                      <div style={{ width:48, height:48, borderRadius:'50%', background:'#dbeafe', color:'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}><IcoMoney /></div>
                      <p style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>Montant total perçu</p>
                      <p style={{ fontSize:32, fontWeight:800, color:'#2563eb', lineHeight:1 }}>{fmt(montantData.montant)} Ar</p>
                    </div>
                  </div>
                ) : <div className="empty-state">Sélectionnez une période et cliquez sur <b>Voir</b></div>}
              </div>
            </div>
          )}
        </div>
      </div>
      {printCertif && <CertificatView certif={printCertif} onClose={() => setPrintCertif(null)} />}
    </div>
  )
}
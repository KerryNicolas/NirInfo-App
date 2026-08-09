import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { useAuth } from '../../contexts/AuthContext'
import Attestation from '../../assets/attestation.png'
import Tampon from '../../assets/tampon.png'
import Signature from '../../assets/signature.png'

interface Certification {
  id: number; reference: string; matricule: string
  nom: string; prenom: string; nom_complet: string
  module_nom: string; debut_session: string; fin_session: string
  date: string; prix: number; nom_formation?: string
  accept: number
}
interface Module { code_module: string; nom: string }
interface Compte { id_compte: number; libelle: string }
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
      <div id="certificat-print" style={{ width:900, position:'relative' }}>
        <img src={Attestation} alt="Certificat Nir'Info" style={{ width:'100%', display:'block' }} />

        <div style={{ position:'absolute', top:'44%', left:'15%', width:'70%', textAlign:'center', fontFamily:'system-ui, sans-serif', fontSize:'1.8vw', fontWeight:500, color:'#1e293b' }}>
          {certif.nom_complet?.trim() || `${certif.nom || ''} ${certif.prenom || ''}`.trim() || '—'}
        </div>

        <div style={{ position:'absolute', top:'54%', left:'15%', width:'70%', textAlign:'center', fontFamily:'sans-serif', fontSize:'0.8vw', color:'#334155' }}>
          Session du {fmt(certif.debut_session)} au {fmt(certif.fin_session)}
        </div>

        <div style={{ position:'absolute', top:'68%', left:'15%', width:'70%', textAlign:'center', fontFamily:'system-ui, sans-serif', fontSize:'1.5vw', fontWeight:700, color:'#1e3a8a', textTransform:'uppercase' }}>
          {certif.nom_formation || certif.module_nom || '—'}
        </div>

        <img src={Tampon} alt="Tampon officiel" style={{ position:'absolute', top:'83%', left:'40%', width:'20%', transform:'translateY(-50%)', opacity:0.9, mixBlendMode:'multiply' }} />

        <img src={Signature} alt="Signature du directeur" style={{ position:'absolute', top:'92%', left:'80%', width:'12%', transform:'translateY(-50%)', mixBlendMode:'multiply' }} />

        <div style={{ position:'absolute', top:'90.5%', left:'50%', fontFamily:'sans-serif', fontSize:'0.75vw', color:'#334155' }}>
          {certif.reference}
        </div>

        <div style={{ position:'absolute', top:'84.5%', left:'73%', width:'26%', textAlign:'center', whiteSpace:'nowrap', fontFamily:'system-ui, sans-serif', fontSize:'0.8vw', fontWeight:600, color:'#1e293b' }}>
          MIHARISOA Maminirina
        </div>
      </div>
    </div>
  )
}

function ValiderModal({ certif, comptes, onClose, onConfirm }: { certif: Certification; comptes: Compte[]; onClose: () => void; onConfirm: (idCompte: number, prix: number) => Promise<void> }) {
  const [idCompte, setIdCompte] = useState<string>('')
  const [prix, setPrix] = useState<string>(String(certif.prix ?? ''))
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idCompte) { toast.error('Choisissez un compte'); return }
    setLoading(true)
    try { await onConfirm(Number(idCompte), Number(prix)) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:420, background:'white', borderRadius:12, padding:'4px 24px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>Valider le certificat {certif.reference}</span>
          <button onClick={onClose} className="btn-icon"><IcoClose /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Compte encaissement</label>
            <select className="form-control" value={idCompte} onChange={e => setIdCompte(e.target.value)} required>
              <option value="">-- Choisir un compte --</option>
              {comptes.map((c: Compte) => <option key={c.id_compte} value={c.id_compte}>{c.libelle}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Prix (Ar)</label>
            <input className="form-control" type="number" value={prix} onChange={e => setPrix(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width:'100%', marginTop:8 }} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Validation…</> : 'Confirmer la validation'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function CertificationPage() {
  const { hasPermission } = useAuth()
  const canValider = hasPermission('certifications.valider')

  const [tab, setTab]       = useState<SubTab>('certification')
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const [etudiantInfo, setEtudiantInfo] = useState<{nom:string, prenom:string} | null>(null)
  const [checkingMatricule, setCheckingMatricule] = useState(false)

  const checkMatricule = async (matricule: string) => {
    if (matricule.length < 5) { setEtudiantInfo(null); return }
    setCheckingMatricule(true)
    try {
      const r = await api.get(`/etudiants/${matricule}`)
      setEtudiantInfo({ nom: r.data.nom_etudiant, prenom: r.data.prenom_etudiant })
    } catch {
      setEtudiantInfo(null)
    } finally {
      setCheckingMatricule(false)
    }
  }

  const [printCertif, setPrintCertif] = useState<Certification | null>(null)
  const [validerCertif, setValiderCertif] = useState<Certification | null>(null)
  const [comptes, setComptes] = useState<Compte[]>([])

  useEffect(() => {
    if (canValider) {
      api.get('/certifications/comptes')
        .then((r: { data: Compte[] }) => setComptes(r.data))
        .catch(() => setComptes([]))
    }
  }, [canValider])

  const modulesTable = useTable<Module>('/modules', { perPage: 200, autoLoad: true })
  const certifTable = useTable<Certification>('/certifications', { perPage: 15 })

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

  const handleConfirmValidation = async (idCompte: number, prix: number) => {
    if (!validerCertif) return
    try {
      await api.post(`/certifications/${validerCertif.reference}/valider`, { id_compte: idCompte, prix })
      toast.success('Certificat validé avec succès')
      setValiderCertif(null)
      certifTable.reload()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la validation')
    }
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
  const fmtDate = (d: string) => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' }) }

  return (
    <div className="app-layout">
      <Sidebar section="formation" />
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display:'flex', alignItems:'center', gap:8 }}><IcoCertif /> Certification</span>
        </div>
        <div style={{ padding:24, marginTop: -20 }}>
          <div className="tabs">
            {([['certification','Certification'],['montant','Montant perçu']] as [SubTab,string][]).map(([t,l]) => (
              <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={() => setTab(t)}>{l}</button>
            ))}
          </div>

          {tab === 'certification' && (<>
            <div className="card" style={{ marginBottom:20 }}>
              <div className="card-header">
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}><IcoAward /> Générer un certificat</span>
              </div>
              <div className="card-body">
                <form onSubmit={handleGenerer}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Matricule *</label>
                      <input
                        className="form-control"
                        value={form.matricule}
                        onChange={e => {
                          const val = e.target.value.toUpperCase()
                          setForm(p => ({ ...p, matricule: val }))
                          checkMatricule(val)
                        }}
                        required
                        placeholder="Ex: NI-3757"
                      />
                      {checkingMatricule && (
                        <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>
                          Vérification...
                        </div>
                      )}
                      {!checkingMatricule && etudiantInfo && (
                        <div style={{ fontSize:13, color:'#16a34a', marginTop:4, fontWeight:600 }}>
                          ✓ {etudiantInfo.nom} {etudiantInfo.prenom}
                        </div>
                      )}
                      {!checkingMatricule && !etudiantInfo && form.matricule.length >= 5 && (
                        <div style={{ fontSize:13, color:'#dc2626', marginTop:4 }}>
                          ✗ Étudiant non trouvé — créez d'abord la fiche étudiant
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Module *</label>
                      <select className="form-control" value={form.code_module} onChange={set('code_module')} required>
                        <option value="">-- Choisir un module --</option>
                        {modulesTable.data.map((m: Module) => <option key={m.code_module} value={m.code_module}>{m.nom}</option>)}
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
                    <thead><tr><th>#</th><th>Référence</th><th>Étudiant</th><th>Formation</th><th>Début</th><th>Fin</th><th>Prix</th><th>Statut</th><th>Action</th></tr></thead>
                    <tbody>
                      {certifTable.data.length === 0
                        ? <tr><td colSpan={9}><div className="empty-state">Aucune certification trouvée</div></td></tr>
                        : certifTable.data.map((c: Certification, idx: number) => (
                          <tr key={c.reference}>
                            <td style={{ color:'#94a3b8', fontSize:12 }}>{(certifTable.meta.current_page-1)*certifTable.meta.per_page+idx+1}</td>
                            <td style={{ fontWeight:600, color:'#2563eb', fontSize:12 }}>{c.reference}</td>
                            <td>
                              <div style={{ fontWeight:600 }}>{c.nom_complet?.trim() || `${c.nom || ''} ${c.prenom || ''}`.trim() || '—'}</div>
                              <div style={{ fontSize:11, color:'#94a3b8' }}>{c.matricule}</div>
                            </td>
                            <td><span className="badge badge-warning">{c.module_nom}</span></td>
                            <td style={{ fontSize:12 }}>{fmtDate(c.debut_session)}</td>
                            <td style={{ fontSize:12 }}>{fmtDate(c.fin_session)}</td>
                            <td style={{ fontWeight:600, color:'#16a34a', fontSize:12 }}>{c.prix ? fmt(c.prix)+' Ar' : '—'}</td>
                            <td>
                              {c.accept === 1
                                ? <span className="badge badge-success">Validé</span>
                                : <span className="badge badge-warning">En attente</span>
                              }
                            </td>
                            <td><div className="table-actions">
                              {canValider && c.accept === 0 && (
                                <button className="btn-icon" style={{ color: '#16a34a' }} onClick={() => setValiderCertif(c)} title="Valider">
                                  <IcoAward />
                                </button>
                              )}
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
      {validerCertif && (
        <ValiderModal
          certif={validerCertif}
          comptes={comptes}
          onClose={() => setValiderCertif(null)}
          onConfirm={handleConfirmValidation}
        />
      )}
    </div>
  )
}
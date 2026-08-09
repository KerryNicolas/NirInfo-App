import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { IcoUsers, IcoFunc, IcoClose, IcoHamburger, IcoBack, IcoSettings, IcoLogout, IcoEdit, IcoPlus, IcoSearch, IcoCamera, IcoSave, IcoX, IcoExport, IcoTrash } from '../../components/icons'

type Tab = 'personnel' | 'fonction'
interface Fonction  { 
  id_fonction: number;
  nom_fonction: string; 
  description_fonction: string 
  editeur?: string
}
interface Personnel {
  matricule_pers: string; 
  nom_pers: string; 
  prenom_pers: string
  ddn_pers: string; 
  photo_pers: string;
  cin_pers: string; 
  tel_pers: string; 
  email_pers: string
  dembauche_pers: string; 
  salaire_pers: number; 
  diplome_pers: string
  adresse_pers: string; 
  id_fonction: number; 
  nom_fonction: string
  editeur?: string
}

const fmt    = (n: number) => new Intl.NumberFormat('fr-MG').format(n)
const SK     = 'nirinfo_personnel_sidebar'
const navItems = [
  { t: 'personnel' as Tab, label: 'Personnel', icon: <IcoUsers /> },
  { t: 'fonction'  as Tab, label: 'Fonctions',  icon: <IcoFunc /> },
]

const EMPTY_P = { matricule_pers:'', nom_pers:'', prenom_pers:'', ddn_pers:'', cin_pers:'', tel_pers:'', email_pers:'', dembauche_pers:'', salaire_pers:'', diplome_pers:'', adresse_pers:'', id_fonction:'' }
const EMPTY_F = { nom_fonction:'', description_fonction:'' }
const fmtM = (n: number) => new Intl.NumberFormat('fr-MG').format(n)

// ── Modal de détail — même pattern que le reste de l'appli ──
function DetailModal({ p, onClose }: { p: Personnel; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Matricule', p.matricule_pers],
    ['Nom', `${p.nom_pers} ${p.prenom_pers}`],
    ['Fonction', p.nom_fonction || '—'],
    ['Téléphone', p.tel_pers || '—'],
    ['Email', p.email_pers || '—'],
    ['CIN', p.cin_pers || '—'],
    ['Date de naissance', p.ddn_pers || '—'],
    ['Date d\'embauche', p.dembauche_pers || '—'],
    ['Salaire', `${fmtM(p.salaire_pers)} Ar`],
    ['Diplôme', p.diplome_pers || '—'],
    ['Adresse', p.adresse_pers || '—'],
    ['Éditeur', p.editeur?.trim() || '—'],
  ]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:460, background:'white', borderRadius:12, padding:24 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>Détail du personnel</span>
          <button onClick={onClose} className="btn-icon"><IcoX /></button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'8px 14px', fontSize:13 }}>
          {rows.map(([label, val]) => (
            <div key={label} style={{ display:'contents' }}>
              <span style={{ color:'#64748b' }}>{label} :</span>
              <span style={{ fontWeight:500 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Modal de détail pour Fonction ──
function DetailModalFonction({ f, onClose }: { f: Fonction; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Nom de la fonction', f.nom_fonction],
    ['Description', f.description_fonction || '—'],
    ['Éditeur', f.editeur?.trim() || '—'],
  ]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:420, background:'white', borderRadius:12, padding:24 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>Détail de la fonction</span>
          <button onClick={onClose} className="btn-icon"><IcoX /></button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'8px 14px', fontSize:13 }}>
          {rows.map(([label, val]) => (
            <div key={label} style={{ display:'contents' }}>
              <span style={{ color:'#64748b' }}>{label} :</span>
              <span style={{ fontWeight:500 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PersonnelPage() {
  const navigate   = useNavigate()
  const { logout } = useAuth()
  const [tab, setTab] = useState<Tab>('personnel')
  const [open, setOpen] = useState<boolean>(() => {
  const s = localStorage.getItem(SK); 
  return s === null ? true : s === 'true'
  })
  useEffect(() => { localStorage.setItem(SK, String(open)) }, [open])

  const personnelTable = useTable<Personnel>('/personnel', { perPage: 15 })
  const fonctionTable  = useTable<Fonction>('/fonctions',  { perPage: 15 })

  const [fonctionsList, setFonctionsList] = useState<Fonction[]>([])
  useEffect(() => {
    api.get('/fonctions', { params: { per_page: 500 } })
      .then(r => setFonctionsList(r.data.data ?? []))
      .catch(() => {})
  }, [fonctionTable.meta.total])

  const [formP,    setFormP]    = useState<Record<string,string>>(EMPTY_P)
  const [editP,    setEditP]    = useState<Personnel | null>(null)
  const [savingP,  setSavingP]  = useState(false)

  const [formF,    setFormF]    = useState(EMPTY_F)
  const [editF,    setEditF]    = useState<Fonction | null>(null)
  const [savingF,  setSavingF]  = useState(false)
  const [viewingP, setViewingP] = useState<Personnel | null>(null)
  const [viewingF, setViewingF] = useState<Fonction | null>(null)

  const handleSubmitPersonnel = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingP(true)
    try {
      if (editP) { await api.put(`/personnel/${editP.matricule_pers}`, formP); toast.success('Personnel modifié') }
      else       { await api.post('/personnel', formP); toast.success('Personnel enregistré') }
      setFormP(EMPTY_P); setEditP(null); personnelTable.reload()
    } catch (err: any) { toast.error(err.response?.data?.message ?? "Erreur enregistrement") }
    finally { setSavingP(false) }
  }

  const handleDeletePersonnel = async (matricule: string) => {
    if (!confirm('Supprimer ce personnel ?')) return
    try { await api.delete(`/personnel/${matricule}`); toast.success('Personnel supprimé'); personnelTable.reload() }
    catch { toast.error('Erreur suppression') }
  }

  const startEditPersonnel = (p: Personnel) => {
    setEditP(p)
    setFormP({ matricule_pers:p.matricule_pers, nom_pers:p.nom_pers, prenom_pers:p.prenom_pers, ddn_pers:p.ddn_pers?.slice(0,10)??'', cin_pers:p.cin_pers??'', tel_pers:p.tel_pers??'', email_pers:p.email_pers??'', dembauche_pers:p.dembauche_pers?.slice(0,10)??'', salaire_pers:String(p.salaire_pers), diplome_pers:p.diplome_pers??'', adresse_pers:p.adresse_pers??'', id_fonction:String(p.id_fonction) })
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  const resetPersonnel = () => { setFormP(EMPTY_P); setEditP(null) }

  const handlePhotoPersonnel = async (matricule: string, file: File) => {
    const fd = new FormData(); fd.append('photo', file)
    try {
      await api.post(`/personnel/${matricule}/photo`, fd, { headers:{ 'Content-Type':'multipart/form-data' } })
      toast.success('Photo mise à jour'); personnelTable.reload()
    } catch { toast.error('Erreur upload photo') }
  }

  const handleSubmitFonction = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingF(true)
    try {
      if (editF) { await api.put(`/fonctions/${editF.id_fonction}`, formF); toast.success('Fonction modifiée') }
      else       { await api.post('/fonctions', formF); toast.success('Fonction créée') }
      setFormF(EMPTY_F); setEditF(null); fonctionTable.reload()
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur enregistrement') }
    finally { setSavingF(false) }
  }

  const resetFonction = () => { setFormF(EMPTY_F); setEditF(null) }

  const handleDeleteFonction = async (id: number) => {
    if (!confirm('Supprimer cette fonction ?')) return
    try { await api.delete(`/fonctions/${id}`); toast.success('Fonction supprimée'); fonctionTable.reload() }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur suppression') }
  }

  const exportPersonnels = () => {
    if (personnelTable.data.length === 0) { toast.error('Aucune donnée'); return }
    const rows = [['Matricule','Nom','Prénom','Fonction','Tél','Email','Salaire'], ...personnelTable.data.map(p=>[p.matricule_pers,p.nom_pers,p.prenom_pers,p.nom_fonction,p.tel_pers,p.email_pers,String(p.salaire_pers)])]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(';')).join('\n')],{type:'text/csv'})); a.download='personnels.csv'; a.click()
    toast.success('Export CSV téléchargé')
  }

  return (
    <div className="app-layout">

      {/* ── SIDEBAR (inchangée) ── */}
      <div className="sidebar" style={{ width:open?210:52, minWidth:open?210:52, overflow:'hidden', transition:'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)', flexShrink:0 }}>
        <div className="sidebar-logo" style={{ display:'flex', alignItems:'center', justifyContent:open?'space-between':'center', padding:open?'0 12px 0 16px':'0', gap:8, overflow:'hidden', minHeight:54 }}>
          {open && <span style={{ fontWeight:700, fontSize:15, color:'white', whiteSpace:'nowrap' }}>Personnel</span>}
          <button onClick={() => setOpen(p => !p)} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:7, color:'rgba(255,255,255,0.85)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, flexShrink:0, padding:0 }}>
            {open ? <IcoClose /> : <IcoHamburger />}
          </button>
        </div>
        <nav className="sidebar-nav" style={{ overflow:'hidden' }}>
          {navItems.map(m => (
            <button key={m.t} onClick={() => setTab(m.t)} title={!open?m.label:undefined}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:open?'flex-start':'center', gap:open?10:0, padding:open?'9px 16px':'9px 0', background:tab===m.t?'rgba(59,130,246,0.18)':'none', border:'none', borderLeft:tab===m.t?'3px solid #3b82f6':'3px solid transparent', color:tab===m.t?'#60a5fa':'#94a3b8', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:tab===m.t?600:400, transition:'all 0.15s' }}>
              <span style={{ flexShrink:0 }}>{m.icon}</span>
              <span style={{ opacity:open?1:0, maxWidth:open?160:0, overflow:'hidden', whiteSpace:'nowrap', transition:'opacity 0.18s, max-width 0.22s' }}>{m.label}</span>
            </button>
          ))}
          <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'12px 16px' }} />
          <button onClick={() => navigate('/dashboard')} title={!open?'Retour':undefined}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:open?'flex-start':'center', gap:open?10:0, padding:open?'9px 16px':'9px 0', background:'none', border:'none', borderLeft:'3px solid transparent', color:'#94a3b8', cursor:'pointer', fontFamily:'inherit', fontSize:13, transition:'all 0.15s' }}>
            <span style={{ flexShrink:0 }}><IcoBack /></span>
            <span style={{ opacity:open?1:0, maxWidth:open?160:0, overflow:'hidden', whiteSpace:'nowrap', transition:'opacity 0.18s, max-width 0.22s' }}>Retour</span>
          </button>
        </nav>
        <div className="sidebar-footer" style={{ padding:open?'8px 12px':'8px 6px', transition:'padding 0.2s' }}>
          <button onClick={() => navigate('/profile')} title={!open?'Paramètres':undefined}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:open?'flex-start':'center', gap:open?7:0, marginBottom:6, background:'rgba(255,255,255,0.06)', color:'#94a3b8', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:open?'7px 10px':'7px', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', overflow:'hidden', whiteSpace:'nowrap', transition:'all 0.15s' }}>
            <IcoSettings />
            <span style={{ opacity:open?1:0, maxWidth:open?120:0, overflow:'hidden', transition:'opacity 0.18s, max-width 0.22s' }}>Paramètres</span>
          </button>
          <button onClick={() => { logout(); navigate('/login') }} title={!open?'Déconnexion':undefined}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:open?'flex-start':'center', gap:open?7:0, background:'rgba(239,68,68,0.12)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:open?'7px 10px':'7px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', overflow:'hidden', whiteSpace:'nowrap', transition:'all 0.15s' }}>
            <IcoLogout />
            <span style={{ opacity:open?1:0, maxWidth:open?120:0, overflow:'hidden', transition:'opacity 0.18s, max-width 0.22s' }}>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* ── CONTENU ── */}
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display:'flex', alignItems:'center', gap:8 }}>Personnel</span>
        </div>
        <div className="tabs">
          {navItems.map(m => (
            <button key={m.t} className={`tab-btn${tab === m.t ? ' active' : ''}`} onClick={() => setTab(m.t)}>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '4px 24px 24px' }}>

          {/* ════ PERSONNEL — mêmes classes CSS que SessionForm ════ */}
          {tab === 'personnel' && (<>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
                  {editP ? <IcoEdit /> : <IcoPlus />} {editP ? 'Modifier le personnel' : 'Nouveau personnel'}
                </span>
                {editP && <button className="btn btn-secondary btn-sm" onClick={resetPersonnel} style={{ display:'flex', alignItems:'center', gap:5 }}><IcoX /> Annuler</button>}
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmitPersonnel}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Matricule </label>
                      <input className="form-control" value={formP.matricule_pers} onChange={e => setFormP({...formP, matricule_pers:e.target.value})} required disabled={!!editP} placeholder="Ex: PERS-0001" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fonction </label>
                      <select className="form-control" value={formP.id_fonction} onChange={e => setFormP({...formP, id_fonction:e.target.value})} required>
                        <option value="">-- Choisir une fonction --</option>
                        {fonctionsList.map(f => <option key={f.id_fonction} value={f.id_fonction}>{f.nom_fonction}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Nom </label>
                      <input className="form-control" value={formP.nom_pers} onChange={e => setFormP({...formP, nom_pers:e.target.value})} required placeholder="Nom" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Prénom </label>
                      <input className="form-control" value={formP.prenom_pers} onChange={e => setFormP({...formP, prenom_pers:e.target.value})} required placeholder="Prénom" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Date de naissance</label>
                      <input className="form-control" type="date" value={formP.ddn_pers} onChange={e => setFormP({...formP, ddn_pers:e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">N° CIN</label>
                      <input className="form-control" value={formP.cin_pers} onChange={e => setFormP({...formP, cin_pers:e.target.value})} placeholder="N° CIN" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Téléphone</label>
                      <input className="form-control" value={formP.tel_pers} onChange={e => setFormP({...formP, tel_pers:e.target.value})} placeholder="034..." />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input className="form-control" type="email" value={formP.email_pers} onChange={e => setFormP({...formP, email_pers:e.target.value})} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Date d'embauche</label>
                      <input className="form-control" type="date" value={formP.dembauche_pers} onChange={e => setFormP({...formP, dembauche_pers:e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Salaire (Ar)</label>
                      <input className="form-control" type="number" min="0" value={formP.salaire_pers} onChange={e => setFormP({...formP, salaire_pers:e.target.value})} placeholder="0" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Diplôme</label>
                      <input className="form-control" value={formP.diplome_pers} onChange={e => setFormP({...formP, diplome_pers:e.target.value})} placeholder="Bac+3..." />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Adresse</label>
                      <input className="form-control" value={formP.adresse_pers} onChange={e => setFormP({...formP, adresse_pers:e.target.value})} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={savingP}>
                    {savingP ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</> : editP ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>}
                  </button>
                </form>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="section-info">
                  <div className="section-title">Liste du personnel</div>
                  <div className="section-count">{personnelTable.meta.total > 0 ? `${personnelTable.meta.total} membre(s)` : `${personnelTable.data.length} membre(s)`}</div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div className="search-bar">
                    <IcoSearch />
                    <input placeholder="Mot à rechercher..." value={personnelTable.search} onChange={e => personnelTable.setSearch(e.target.value)} />
                    {personnelTable.search && <button onClick={() => personnelTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, fontSize:16 }}>×</button>}
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={exportPersonnels} style={{ display:'flex', alignItems:'center', gap:6 }}><IcoExport /> Export</button>
                </div>
              </div>
              <div className="table-wrapper">
                {personnelTable.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
                  <table>
                    <thead><tr><th>#</th><th>Photo</th><th>Matricule</th><th>Nom & Prénom</th><th>Fonction</th><th>Téléphone</th><th>Salaire</th><th>Action</th></tr></thead>
                    <tbody>
                      {personnelTable.data.length === 0 ? (
                        <tr><td colSpan={8}><div className="empty-state">{personnelTable.search ? `Aucun résultat pour « ${personnelTable.search} »` : 'Aucun personnel enregistré'}</div></td></tr>
                      ) : personnelTable.data.map((p, i) => (
                        <tr key={p.matricule_pers} onClick={() => setViewingP(p)} style={{ cursor:'pointer' }}>
                          <td style={{ color:'#94a3b8', fontSize:12 }}>{(personnelTable.meta.current_page-1)*personnelTable.meta.per_page+i+1}</td>
                          <td>
                            <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                              {p.photo_pers
                                ? <img src={`http://localhost:8000/storage/${p.photo_pers}`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              }
                              <label onClick={ev => ev.stopPropagation()} style={{ position:'absolute', inset:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <IcoCamera />
                                <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handlePhotoPersonnel(p.matricule_pers, e.target.files[0])} />
                              </label>
                            </div>
                          </td>
                          <td><span className="badge badge-info">{p.matricule_pers}</span></td>
                          <td style={{ fontWeight:600 }}>{p.nom_pers} {p.prenom_pers}</td>
                          <td><span className="badge badge-success">{p.nom_fonction || '—'}</span></td>
                          <td style={{ fontSize:12, color:'#64748b' }}>{p.tel_pers || '—'}</td>
                          <td style={{ fontWeight:600, color:'#16a34a' }}>{fmt(p.salaire_pers)} Ar</td>
                          <td onClick={ev => ev.stopPropagation()}><div className="table-actions">
                            <button className="btn-icon edit" onClick={() => startEditPersonnel(p)}><IcoEdit /></button>
                            <button className="btn-icon delete" onClick={() => handleDeletePersonnel(p.matricule_pers)}><IcoTrash /></button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {!personnelTable.loading && personnelTable.meta.total > 0 && <Pagination meta={personnelTable.meta} onPage={personnelTable.setPage} onPerPage={personnelTable.setPerPage} />}
            </div>
          </>)}

          {/* ════ FONCTION — mêmes classes CSS que SessionForm ════ */}
          {tab === 'fonction' && (<>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
                  {editF ? <IcoEdit /> : <IcoPlus />} {editF ? 'Modifier la fonction' : 'Nouvelle fonction'}
                </span>
                {editF && <button className="btn btn-secondary btn-sm" onClick={resetFonction} style={{ display:'flex', alignItems:'center', gap:5 }}><IcoX /> Annuler</button>}
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmitFonction}>
                  <div className="form-group">
                    <label className="form-label">Nom de la fonction </label>
                    <input className="form-control" value={formF.nom_fonction} onChange={e => setFormF({...formF, nom_fonction:e.target.value})} required placeholder="Ex: Formateur..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input className="form-control" value={formF.description_fonction} onChange={e => setFormF({...formF, description_fonction:e.target.value})} placeholder="Description optionnelle..." />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={savingF}>
                    {savingF ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</> : editF ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>}
                  </button>
                </form>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="section-info">
                  <div className="section-title">Liste des fonction(s)</div>
                  <div className="section-count">{fonctionTable.meta.total > 0 ? `${fonctionTable.meta.total} fonction(s)` : `${fonctionTable.data.length} fonction(s)`}</div>
                </div>
                <div className="search-bar">
                  <IcoSearch />
                  <input placeholder="Mot à rechercher..." value={fonctionTable.search} onChange={e => fonctionTable.setSearch(e.target.value)} />
                  {fonctionTable.search && <button onClick={() => fonctionTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, fontSize:16 }}>×</button>}
                </div>
              </div>
              <div className="table-wrapper">
                {fonctionTable.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
                  <table>
                    <thead><tr><th>#</th><th>Nom de la fonction</th><th>Description</th><th>Action</th></tr></thead>
                    <tbody>
                      {fonctionTable.data.length === 0 ? (
                        <tr><td colSpan={4}><div className="empty-state">{fonctionTable.search ? `Aucun résultat pour « ${fonctionTable.search} »` : 'Aucune fonction créée'}</div></td></tr>
                      ) : fonctionTable.data.map((f, i) => (
                        <tr key={f.id_fonction} onClick={() => setViewingF(f)} style={{ cursor:'pointer' }}>
                          <td style={{ color:'#94a3b8', fontSize:12 }}>{(fonctionTable.meta.current_page-1)*fonctionTable.meta.per_page+i+1}</td>
                          <td style={{ fontWeight:600 }}>{f.nom_fonction}</td>
                          <td style={{ fontSize:12, color:'#64748b' }}>{f.description_fonction || '—'}</td>
                          <td onClick={ev => ev.stopPropagation()}><div className="table-actions">
                            <button className="btn-icon edit" onClick={() => { setEditF(f); setFormF({ nom_fonction:f.nom_fonction, description_fonction:f.description_fonction??'' }); window.scrollTo({top:0,behavior:'smooth'}) }}><IcoEdit /></button>
                            <button className="btn-icon delete" onClick={() => handleDeleteFonction(f.id_fonction)}><IcoTrash /></button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {!fonctionTable.loading && fonctionTable.meta.total > 0 && <Pagination meta={fonctionTable.meta} onPage={fonctionTable.setPage} onPerPage={fonctionTable.setPerPage} />}
            </div>
          </>)}

        </div>
      </div>

      {viewingP && <DetailModal p={viewingP} onClose={() => setViewingP(null)} />}
      {viewingF && <DetailModalFonction f={viewingF} onClose={() => setViewingF(null)} />}
    </div>
  )
}
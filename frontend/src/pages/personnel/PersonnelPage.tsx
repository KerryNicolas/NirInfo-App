import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'

/* ── Icônes ── */
const IcoPlus   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IcoEdit   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoTrash  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
const IcoSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoSave   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
const IcoX      = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoBack   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
const IcoCamera = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
const IcoUsers  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IcoFunc   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
const IcoExport = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
const IcoHamburger = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const IcoClose  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoLogout = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const IcoSettings = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>

type Tab = 'personnel' | 'fonction'
interface Fonction  { 
  id_fonction: number;
  nom_fonction: string; 
  description_fonction: string 
}
interface Personnel {
  matricule_pers: string; 
  nom_pers: string; 
  prenom_pers: string
  ddn_pers: string; 
  cin_pers: string; 
  tel_pers: string; 
  email_pers: string
  dembauche_pers: string; 
  salaire_pers: number; 
  diplome_pers: string
  adresse_pers: string; 
  // photo_pers: string; 
  id_fonction: number; 
  nom_fonction: string
}

const fmt    = (n: number) => new Intl.NumberFormat('fr-MG').format(n)
const SK     = 'nirinfo_personnel_sidebar'
const navItems = [
  { t: 'personnel' as Tab, label: 'Personnel', icon: <IcoUsers /> },
  { t: 'fonction'  as Tab, label: 'Fonctions',  icon: <IcoFunc /> },
]

const EMPTY_P = { matricule_pers:'', nom_pers:'', prenom_pers:'', ddn_pers:'', cin_pers:'', tel_pers:'', email_pers:'', dembauche_pers:'', salaire_pers:'', diplome_pers:'', adresse_pers:'', id_fonction:'' }
const EMPTY_F = { nom_fonction:'', description_fonction:'' }

export default function PersonnelPage() {
  const navigate   = useNavigate()
  const { logout } = useAuth()
  const [tab, setTab] = useState<Tab>('personnel')
  const [open, setOpen] = useState<boolean>(() => {
  const s = localStorage.getItem(SK); 
  return s === null ? true : s === 'true'
  })
  useEffect(() => { localStorage.setItem(SK, String(open)) }, [open])

  /* ── useTable — URL correcte /personnel sans s ── */
  const personnelTable = useTable<Personnel>('/personnel', { perPage: 15 })
  const fonctionTable  = useTable<Fonction>('/fonctions',  { perPage: 15 })

  /* ── Liste fonctions pour le select du formulaire ── */
  const [fonctionsList, setFonctionsList] = useState<Fonction[]>([])
  useEffect(() => {
    // Charger toutes les fonctions pour le select (per_page=500)
    api.get('/fonctions', { params: { per_page: 500 } })
      .then(r => setFonctionsList(r.data.data ?? []))
      .catch(() => {})
  }, [fonctionTable.meta.total]) // recharge si ajout/suppression

  /* ── Formulaire Personnel ── */
  const [formP,    setFormP]    = useState<Record<string,string>>(EMPTY_P)
  const [editP,    setEditP]    = useState<Personnel | null>(null)
  const [savingP,  setSavingP]  = useState(false)

  /* ── Formulaire Fonction ── */
  const [formF,    setFormF]    = useState(EMPTY_F)
  const [editF,    setEditF]    = useState<Fonction | null>(null)
  const [savingF,  setSavingF]  = useState(false)

  /* ── CRUD Personnel ── */
  const handleSubmitPersonnel = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingP(true)
    try {
      // URL correcte : /personnel (sans s)
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

  const handlePhotoPersonnel = async (matricule: string, file: File) => {
    const fd = new FormData(); fd.append('photo', file)
    try {
      await api.post(`/personnel/${matricule}/photo`, fd, { headers:{ 'Content-Type':'multipart/form-data' } })
      toast.success('Photo mise à jour'); personnelTable.reload()
    } catch { toast.error('Erreur upload photo') }
  }

  /* ── CRUD Fonctions ── */
  const handleSubmitFonction = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingF(true)
    try {
      if (editF) { await api.put(`/fonctions/${editF.id_fonction}`, formF); toast.success('Fonction modifiée') }
      else       { await api.post('/fonctions', formF); toast.success('Fonction créée') }
      setFormF(EMPTY_F); setEditF(null); fonctionTable.reload()
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur enregistrement') }
    finally { setSavingF(false) }
  }

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

  /* ── Styles ── */
  const inp: React.CSSProperties  = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }
  const btnP: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'linear-gradient(135deg,#1e40af,#2563eb)', color:'white', border:'none', borderRadius:8, padding:'9px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }
  const btnC: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }

  return (
    <div className="app-layout">

      {/* ── SIDEBAR ── */}
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
          <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'6px 0' }} />
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
        <div style={{ background:'white', borderBottom:'1px solid #e2e8f0', padding:'14px 24px', display:'flex', alignItems:'center', gap:12, boxShadow:'0 1px 3px rgba(0,0,0,0.06)', position:'sticky', top:0, zIndex:30 }}>
          <span style={{ fontWeight:700, fontSize:15, color:'#0f172a' }}>Personnel</span>
          <div style={{ width:1, height:20, background:'#e2e8f0' }} />
          <div style={{ display:'flex', gap:4, background:'#f8fafc', borderRadius:11, padding:4, border:'1px solid #e2e8f0' }}>
            {navItems.map(m => (
              <button key={m.t} onClick={() => setTab(m.t)}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'none', background:tab===m.t?'linear-gradient(135deg,#1e40af,#2563eb)':'transparent', color:tab===m.t?'white':'#64748b', transition:'all 0.15s' }}>
                {m.icon}{m.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding:24, display:'flex', gap:20, alignItems:'flex-start' }}>

          {/* ════ PERSONNEL ════ */}
          {tab === 'personnel' && (<>
            {/* Formulaire */}
            <div style={{ width:300, flexShrink:0 }}>
              <div className="card" style={{ padding:20 }}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                  {editP ? <><IcoEdit /> Modifier</> : <><IcoPlus /> Nouveau personnel</>}
                </h3>
                <form onSubmit={handleSubmitPersonnel} style={{ display:'flex', flexDirection:'column', gap:11 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Matricule *</label>
                      <input value={formP.matricule_pers} onChange={e => setFormP({...formP, matricule_pers:e.target.value})} placeholder="PERS-0001" required disabled={!!editP} style={{ ...inp, ...(editP?{background:'#f8fafc',color:'#94a3b8'}:{}) }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Fonction *</label>
                      <select value={formP.id_fonction} onChange={e => setFormP({...formP, id_fonction:e.target.value})} required style={{ ...inp, background:'white' }}>
                        <option value="">-- Choisir --</option>
                        {fonctionsList.map(f => <option key={f.id_fonction} value={f.id_fonction}>{f.nom_fonction}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Nom *</label>
                      <input value={formP.nom_pers} onChange={e => setFormP({...formP, nom_pers:e.target.value})} placeholder="Nom" required style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Prénom *</label>
                      <input value={formP.prenom_pers} onChange={e => setFormP({...formP, prenom_pers:e.target.value})} placeholder="Prénom" required style={inp} />
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Date naissance</label>
                      <input type="date" value={formP.ddn_pers} onChange={e => setFormP({...formP, ddn_pers:e.target.value})} style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>CIN</label>
                      <input value={formP.cin_pers} onChange={e => setFormP({...formP, cin_pers:e.target.value})} placeholder="N° CIN" style={inp} />
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Téléphone</label>
                      <input value={formP.tel_pers} onChange={e => setFormP({...formP, tel_pers:e.target.value})} placeholder="034..." style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Email</label>
                      <input type="email" value={formP.email_pers} onChange={e => setFormP({...formP, email_pers:e.target.value})} style={inp} />
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Date embauche</label>
                      <input type="date" value={formP.dembauche_pers} onChange={e => setFormP({...formP, dembauche_pers:e.target.value})} style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Salaire (Ar)</label>
                      <input type="number" min="0" value={formP.salaire_pers} onChange={e => setFormP({...formP, salaire_pers:e.target.value})} placeholder="0" style={inp} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Diplôme</label>
                    <input value={formP.diplome_pers} onChange={e => setFormP({...formP, diplome_pers:e.target.value})} placeholder="Bac+3..." style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Adresse</label>
                    <input value={formP.adresse_pers} onChange={e => setFormP({...formP, adresse_pers:e.target.value})} style={inp} />
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <button type="submit" disabled={savingP} style={{ ...btnP, flex:1, opacity:savingP?0.7:1 }}><IcoSave /> {editP?'Modifier':'Enregistrer'}</button>
                    {editP && <button type="button" onClick={() => { setEditP(null); setFormP(EMPTY_P) }} style={btnC}><IcoX /></button>}
                  </div>
                </form>
              </div>
            </div>

            {/* Tableau personnel avec useTable + Pagination */}
            <div style={{ flex:1, minWidth:0 }}>
              <div className="card" style={{ padding:'14px 18px', marginBottom:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                <div className="search-bar" style={{ flex:1, minWidth:160 }}>
                  <IcoSearch />
                  <input value={personnelTable.search} onChange={e => personnelTable.setSearch(e.target.value)} placeholder="Rechercher..." />
                  {personnelTable.search && <button onClick={() => personnelTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16 }}>×</button>}
                </div>
                <button onClick={exportPersonnels} style={{ display:'flex', alignItems:'center', gap:6, background:'#16a34a', color:'white', border:'none', borderRadius:7, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoExport /> Export</button>
              </div>

              <div style={{ background:'linear-gradient(135deg,#0f172a,#1e3a8a)', borderRadius:10, padding:'12px 18px', marginBottom:14, display:'flex', justifyContent:'space-between', color:'white' }}>
                <span style={{ fontSize:13, fontWeight:600, opacity:0.85 }}>Total personnel</span>
                <span style={{ fontSize:18, fontWeight:800 }}>{personnelTable.meta.total > 0 ? personnelTable.meta.total : personnelTable.data.length} membre(s)</span>
              </div>

              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <div className="table-wrapper">
                  {personnelTable.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
                    <table style={{ minWidth:800 }}>
                      <thead><tr><th>#</th><th>Photo</th><th>Matricule</th><th>Nom & Prénom</th><th>Fonction</th><th>Téléphone</th><th>Salaire</th><th>Action</th></tr></thead>
                      <tbody>
                        {personnelTable.data.length === 0
                          ? <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Aucun personnel enregistré</td></tr>
                          : personnelTable.data.map((p, i) => (
                            <tr key={p.matricule_pers}>
                              <td style={{ color:'#94a3b8', fontSize:12 }}>{(personnelTable.meta.current_page-1)*personnelTable.meta.per_page+i+1}</td>
                              <td>
                                <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                                  {p.photo_pers
                                    ? <img src={`http://localhost:8000/storage/${p.photo_pers}`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                  }
                                  <label style={{ position:'absolute', inset:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0)', transition:'background 0.2s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background='rgba(0,0,0,0.4)')}
                                    onMouseLeave={e => (e.currentTarget.style.background='rgba(0,0,0,0)')}>
                                    <IcoCamera />
                                    <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handlePhotoPersonnel(p.matricule_pers, e.target.files[0])} />
                                  </label>
                                </div>
                              </td>
                              <td><span className="badge badge-info">{p.matricule_pers}</span></td>
                              <td style={{ fontWeight:600, color:'#0f172a' }}>{p.nom_pers} {p.prenom_pers}</td>
                              <td><span className="badge badge-success">{p.nom_fonction || '—'}</span></td>
                              <td style={{ fontSize:12, color:'#64748b' }}>{p.tel_pers || '—'}</td>
                              <td style={{ fontWeight:700, color:'#1d4ed8', fontSize:13 }}>{fmt(p.salaire_pers)} Ar</td>
                              <td>
                                <div className="table-actions">
                                  <button className="btn-icon edit" onClick={() => startEditPersonnel(p)}><IcoEdit /></button>
                                  <button className="btn-icon delete" onClick={() => handleDeletePersonnel(p.matricule_pers)}><IcoTrash /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  )}
                </div>
                {!personnelTable.loading && personnelTable.meta.total > 0 && (
                  <Pagination meta={personnelTable.meta} onPage={personnelTable.setPage} onPerPage={personnelTable.setPerPage} />
                )}
              </div>
            </div>
          </>)}

          {/* ════ FONCTION ════ */}
          {tab === 'fonction' && (
            <div style={{ width:'100%', display:'flex', gap:20, alignItems:'flex-start' }}>
              {/* Formulaire */}
              <div style={{ width:300, flexShrink:0 }}>
                <div className="card" style={{ padding:20 }}>
                  <h3 style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                    {editF ? <><IcoEdit /> Modifier la fonction</> : <><IcoPlus /> Nouvelle fonction</>}
                  </h3>
                  <form onSubmit={handleSubmitFonction} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Nom de la fonction *</label>
                      <input value={formF.nom_fonction} onChange={e => setFormF({...formF, nom_fonction:e.target.value})} placeholder="Ex: Formateur..." required style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Description</label>
                      <textarea value={formF.description_fonction} onChange={e => setFormF({...formF, description_fonction:e.target.value})} placeholder="Description optionnelle..." rows={3} style={{ ...inp, resize:'vertical' }} />
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="submit" disabled={savingF} style={{ ...btnP, flex:1, opacity:savingF?0.7:1 }}><IcoSave /> {editF?'Modifier':'Créer'}</button>
                      {editF && <button type="button" onClick={() => { setEditF(null); setFormF(EMPTY_F) }} style={btnC}><IcoX /></button>}
                    </div>
                  </form>
                </div>
              </div>

              {/* Tableau fonctions avec useTable + Pagination */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ background:'linear-gradient(135deg,#0f172a,#1e3a8a)', borderRadius:10, padding:'12px 18px', marginBottom:14, display:'flex', justifyContent:'space-between', color:'white' }}>
                  <span style={{ fontSize:13, fontWeight:600, opacity:0.85 }}>Fonctions créées</span>
                  <span style={{ fontSize:18, fontWeight:800 }}>{fonctionTable.meta.total > 0 ? fonctionTable.meta.total : fonctionTable.data.length}</span>
                </div>

                {/* Search fonctions */}
                <div className="card" style={{ padding:'12px 16px', marginBottom:14 }}>
                  <div className="search-bar">
                    <IcoSearch />
                    <input value={fonctionTable.search} onChange={e => fonctionTable.setSearch(e.target.value)} placeholder="Rechercher une fonction..." />
                    {fonctionTable.search && <button onClick={() => fonctionTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16 }}>×</button>}
                  </div>
                </div>

                <div className="card" style={{ padding:0, overflow:'hidden' }}>
                  <div className="table-wrapper">
                    {fonctionTable.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
                      <table>
                        <thead><tr><th>#</th><th>Nom de la fonction</th><th>Description</th><th>Action</th></tr></thead>
                        <tbody>
                          {fonctionTable.data.length === 0
                            ? <tr><td colSpan={4} style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Aucune fonction créée</td></tr>
                            : fonctionTable.data.map((f, i) => (
                              <tr key={f.id_fonction}>
                                <td style={{ color:'#94a3b8', fontSize:12 }}>{(fonctionTable.meta.current_page-1)*fonctionTable.meta.per_page+i+1}</td>
                                <td style={{ fontWeight:600, color:'#0f172a' }}>{f.nom_fonction}</td>
                                <td style={{ fontSize:12, color:'#64748b' }}>{f.description_fonction || '—'}</td>
                                <td>
                                  <div className="table-actions">
                                    <button className="btn-icon edit" onClick={() => { setEditF(f); setFormF({ nom_fonction:f.nom_fonction, description_fonction:f.description_fonction??'' }) }}><IcoEdit /></button>
                                    <button className="btn-icon delete" onClick={() => handleDeleteFonction(f.id_fonction)}><IcoTrash /></button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>
                    )}
                  </div>
                  {!fonctionTable.loading && fonctionTable.meta.total > 0 && (
                    <Pagination meta={fonctionTable.meta} onPage={fonctionTable.setPage} onPerPage={fonctionTable.setPerPage} />
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
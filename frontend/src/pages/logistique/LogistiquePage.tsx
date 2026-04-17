import { useEffect, useState, useRef } from 'react'
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
const IcoCart   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
const IcoCharge = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
const IcoExport = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
const IcoHamburger = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const IcoClose  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoLogout = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const IcoSettings = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>

type Tab = 'achat' | 'charge'
interface Achat  { id_achat: number; nom_materiel: string; prix_unitaire: number; quantite: number; montant: number; date_achat: string; editeur?: string }
interface Charge { id_charge: number; designation: string; montant: number; mois: number; annee: number; date: string; editeur?: string }

const MOIS   = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const TODAY  = new Date().toISOString().split('T')[0]
const YEAR   = new Date().getFullYear()
const fmt    = (n: number | string) => new Intl.NumberFormat('fr-MG').format(Number(n))
const SK     = 'nirinfo_logistique_sidebar'

const navItems = [
  { t: 'achat'  as Tab, label: 'Achat',  icon: <IcoCart /> },
  { t: 'charge' as Tab, label: 'Charge', icon: <IcoCharge /> },
]

const EMPTY_A = { nom_materiel:'', prix_unitaire:'', quantite:'1', date_achat: TODAY }
const EMPTY_C = { designation:'', montant:'', mois: String(new Date().getMonth()+1), annee: String(YEAR), date: TODAY }

export default function LogistiquePage() {
  const navigate   = useNavigate()
  const { logout } = useAuth()
  const [tab, setTab] = useState<Tab>('achat')
  const [open, setOpen] = useState<boolean>(() => {
    const s = localStorage.getItem(SK); return s === null ? true : s === 'true'
  })
  useEffect(() => { localStorage.setItem(SK, String(open)) }, [open])

  /* ── useTable pour Achat ── */
  const achatTable  = useTable<Achat>('/achats', { perPage: 15 })

  /* ── useTable pour Charge ── */
  const chargeTable = useTable<Charge>('/charges', { perPage: 15 })

  /* ── Formulaire Achat ── */
  const [formA, setFormA]   = useState(EMPTY_A)
  const [editA, setEditA]   = useState<Achat | null>(null)
  const [savingA, setSavingA] = useState(false)

  /* ── Formulaire Charge ── */
  const [formC, setFormC]   = useState(EMPTY_C)
  const [editC, setEditC]   = useState<Charge | null>(null)
  const [savingC, setSavingC] = useState(false)

  /* ── CRUD Achats ── */
  const handleSubmitAchat = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingA(true)
    try {
      if (editA) { await api.put(`/achats/${editA.id_achat}`, formA); toast.success('Achat modifié') }
      else       { await api.post('/achats', formA); toast.success('Achat enregistré') }
      setFormA(EMPTY_A); setEditA(null); achatTable.reload()
    } catch { toast.error("Erreur lors de l'enregistrement") }
    finally { setSavingA(false) }
  }

  const handleDeleteAchat = async (id: number) => {
    if (!confirm('Supprimer cet achat ?')) return
    try { await api.delete(`/achats/${id}`); toast.success('Achat supprimé'); achatTable.reload() }
    catch { toast.error('Erreur suppression') }
  }

  const startEditAchat = (a: Achat) => {
    setEditA(a)
    setFormA({ nom_materiel: a.nom_materiel, prix_unitaire: String(a.prix_unitaire), quantite: String(a.quantite), date_achat: String(a.date_achat).slice(0,10) })
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  /* ── CRUD Charges ── */
  const handleSubmitCharge = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingC(true)
    try {
      if (editC) { await api.put(`/charges/${editC.id_charge}`, formC); toast.success('Charge modifiée') }
      else       { await api.post('/charges', formC); toast.success('Charge enregistrée') }
      setFormC(EMPTY_C); setEditC(null); chargeTable.reload()
    } catch { toast.error("Erreur lors de l'enregistrement") }
    finally { setSavingC(false) }
  }

  const handleDeleteCharge = async (id: number) => {
    if (!confirm('Supprimer cette charge ?')) return
    try { await api.delete(`/charges/${id}`); toast.success('Charge supprimée'); chargeTable.reload() }
    catch { toast.error('Erreur suppression') }
  }

  const startEditCharge = (c: Charge) => {
    setEditC(c)
    setFormC({ designation: c.designation, montant: String(c.montant), mois: String(c.mois), annee: String(c.annee), date: String(c.date).slice(0,10) })
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  /* ── Export CSV ── */
  const exportAchats = () => {
    if (achatTable.data.length === 0) { toast.error('Aucune donnée'); return }
    const rows = [['#','Matériel','Prix unit.','Qté','Montant','Date'], ...achatTable.data.map((a,i)=>[i+1,a.nom_materiel,a.prix_unitaire,a.quantite,a.montant,a.date_achat])]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(';')).join('\n')],{type:'text/csv'})); a.download='achats.csv'; a.click()
    toast.success('Export CSV téléchargé')
  }

  const exportCharges = () => {
    if (chargeTable.data.length === 0) { toast.error('Aucune donnée'); return }
    const rows = [['#','Désignation','Montant','Mois','Année','Date'], ...chargeTable.data.map((c,i)=>[i+1,c.designation,c.montant,MOIS[c.mois],c.annee,c.date])]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(';')).join('\n')],{type:'text/csv'})); a.download='charges.csv'; a.click()
    toast.success('Export CSV téléchargé')
  }

  const montantCalc = (Number(formA.prix_unitaire)||0) * (Number(formA.quantite)||0)

  /* ── Styles ── */
  const inp: React.CSSProperties  = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }
  const btnP: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'linear-gradient(135deg,#1e40af,#2563eb)', color:'white', border:'none', borderRadius:8, padding:'9px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }
  const btnC: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }

  return (
    <div className="app-layout">

      {/* ── SIDEBAR ── */}
      <div className="sidebar" style={{ width:open?210:52, minWidth:open?210:52, overflow:'hidden', transition:'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)', flexShrink:0 }}>
        <div className="sidebar-logo" style={{ display:'flex', alignItems:'center', justifyContent:open?'space-between':'center', padding:open?'0 12px 0 16px':'0', gap:8, overflow:'hidden', minHeight:54 }}>
          {open && <span style={{ fontWeight:700, fontSize:15, color:'white', whiteSpace:'nowrap' }}>Logistique</span>}
          <button onClick={() => setOpen(p => !p)} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:7, color:'rgba(255,255,255,0.85)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, flexShrink:0, padding:0 }}>
            {open ? <IcoClose /> : <IcoHamburger />}
          </button>
        </div>
        <nav className="sidebar-nav" style={{ overflow:'hidden' }}>
          {navItems.map(m => (
            <button key={m.t} onClick={() => setTab(m.t)} title={!open ? m.label : undefined}
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
          <span style={{ fontWeight:700, fontSize:15, color:'#0f172a' }}>Logistique</span>
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

          {/* ════ ACHAT ════ */}
          {tab === 'achat' && (<>
            {/* Formulaire */}
            <div style={{ width:300, flexShrink:0 }}>
              <div className="card" style={{ padding:20 }}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                  {editA ? <><IcoEdit /> Modifier l'achat</> : <><IcoPlus /> Nouvel achat</>}
                </h3>
                <form onSubmit={handleSubmitAchat} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Nom du matériel *</label>
                    <input value={formA.nom_materiel} onChange={e => setFormA({...formA, nom_materiel:e.target.value})} placeholder="Ex: Ordinateur" required style={inp} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Prix unitaire *</label>
                      <input type="number" min="0" value={formA.prix_unitaire} onChange={e => setFormA({...formA, prix_unitaire:e.target.value})} placeholder="0" required style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Quantité</label>
                      <input type="number" min="1" value={formA.quantite} onChange={e => setFormA({...formA, quantite:e.target.value})} style={inp} />
                    </div>
                  </div>
                  {montantCalc > 0 && (
                    <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'8px 12px', fontSize:13, color:'#1d4ed8', fontWeight:600 }}>
                      Montant : {fmt(montantCalc)} Ar
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Date d'achat *</label>
                    <input type="date" value={formA.date_achat} onChange={e => setFormA({...formA, date_achat:e.target.value})} required style={inp} />
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button type="submit" disabled={savingA} style={{ ...btnP, flex:1, opacity:savingA?0.7:1 }}>
                      <IcoSave /> {editA ? 'Modifier' : 'Enregistrer'}
                    </button>
                    {editA && <button type="button" onClick={() => { setEditA(null); setFormA(EMPTY_A) }} style={btnC}><IcoX /></button>}
                  </div>
                </form>
              </div>
            </div>

            {/* Tableau achat avec useTable + Pagination */}
            <div style={{ flex:1, minWidth:0 }}>
              <div className="card" style={{ padding:'14px 18px', marginBottom:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                <div className="search-bar" style={{ flex:1, minWidth:160 }}>
                  <IcoSearch />
                  <input value={achatTable.search} onChange={e => achatTable.setSearch(e.target.value)} placeholder="Rechercher..." />
                  {achatTable.search && <button onClick={() => achatTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16 }}>×</button>}
                </div>
                <button onClick={exportAchats} style={{ display:'flex', alignItems:'center', gap:6, background:'#16a34a', color:'white', border:'none', borderRadius:7, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoExport /> Export</button>
              </div>

              {/* Stat total */}
              <div style={{ background:'linear-gradient(135deg,#1e40af,#2563eb)', borderRadius:10, padding:'12px 18px', marginBottom:14, display:'flex', justifyContent:'space-between', color:'white' }}>
                <span style={{ fontSize:13, fontWeight:600, opacity:0.85 }}>
                  Total achats — {achatTable.meta.total > 0 ? achatTable.meta.total : achatTable.data.length} ligne(s)
                </span>
                <span style={{ fontSize:18, fontWeight:800 }}>
                  {fmt(achatTable.data.reduce((s,a) => s+Number(a.montant),0))} Ar
                </span>
              </div>

              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <div className="table-wrapper">
                  {achatTable.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
                    <table>
                      <thead><tr><th>#</th><th>Matériel</th><th>Prix unit.</th><th>Qté</th><th>Montant</th><th>Date</th><th>Action</th></tr></thead>
                      <tbody>
                        {achatTable.data.length === 0
                          ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Aucun achat enregistré</td></tr>
                          : achatTable.data.map((a, i) => (
                            <tr key={a.id_achat}>
                              <td style={{ color:'#94a3b8', fontSize:12 }}>{(achatTable.meta.current_page-1)*achatTable.meta.per_page+i+1}</td>
                              <td style={{ fontWeight:600 }}>{a.nom_materiel}</td>
                              <td style={{ color:'#64748b' }}>{fmt(a.prix_unitaire)} Ar</td>
                              <td><span className="badge badge-info">{a.quantite}</span></td>
                              <td style={{ fontWeight:700, color:'#1d4ed8' }}>{fmt(a.montant)} Ar</td>
                              <td style={{ fontSize:12, color:'#64748b' }}>{String(a.date_achat).slice(0,10)}</td>
                              <td>
                                <div className="table-actions">
                                  <button className="btn-icon edit" onClick={() => startEditAchat(a)}><IcoEdit /></button>
                                  <button className="btn-icon delete" onClick={() => handleDeleteAchat(a.id_achat)}><IcoTrash /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  )}
                </div>
                {!achatTable.loading && achatTable.meta.total > 0 && (
                  <Pagination meta={achatTable.meta} onPage={achatTable.setPage} onPerPage={achatTable.setPerPage} />
                )}
              </div>
            </div>
          </>)}

          {/* ════ CHARGE ════ */}
          {tab === 'charge' && (<>
            {/* Formulaire */}
            <div style={{ width:300, flexShrink:0 }}>
              <div className="card" style={{ padding:20 }}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                  {editC ? <><IcoEdit /> Modifier la charge</> : <><IcoPlus /> Nouvelle charge</>}
                </h3>
                <form onSubmit={handleSubmitCharge} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Désignation *</label>
                    <input value={formC.designation} onChange={e => setFormC({...formC, designation:e.target.value})} placeholder="Ex: Loyer mensuel" required style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Montant (Ar) *</label>
                    <input type="number" min="0" value={formC.montant} onChange={e => setFormC({...formC, montant:e.target.value})} placeholder="0" required style={inp} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Mois</label>
                      <select value={formC.mois} onChange={e => setFormC({...formC, mois:e.target.value})} style={{ ...inp, background:'white' }}>
                        {MOIS.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Année</label>
                      <input type="number" min="2000" value={formC.annee} onChange={e => setFormC({...formC, annee:e.target.value})} style={inp} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Date *</label>
                    <input type="date" value={formC.date} onChange={e => setFormC({...formC, date:e.target.value})} required style={inp} />
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button type="submit" disabled={savingC} style={{ ...btnP, flex:1, opacity:savingC?0.7:1 }}>
                      <IcoSave /> {editC ? 'Modifier' : 'Enregistrer'}
                    </button>
                    {editC && <button type="button" onClick={() => { setEditC(null); setFormC(EMPTY_C) }} style={btnC}><IcoX /></button>}
                  </div>
                </form>
              </div>
            </div>

            {/* Tableau charge avec useTable + Pagination */}
            <div style={{ flex:1, minWidth:0 }}>
              <div className="card" style={{ padding:'14px 18px', marginBottom:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                <div className="search-bar" style={{ flex:1, minWidth:160 }}>
                  <IcoSearch />
                  <input value={chargeTable.search} onChange={e => chargeTable.setSearch(e.target.value)} placeholder="Rechercher..." />
                  {chargeTable.search && <button onClick={() => chargeTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16 }}>×</button>}
                </div>
                <select onChange={e => chargeTable.setSearch(e.target.value === '0' ? '' : MOIS[Number(e.target.value)])} style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:12, fontFamily:'inherit', background:'white' }}>
                  <option value="0">Tous les mois</option>
                  {MOIS.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <button onClick={exportCharges} style={{ display:'flex', alignItems:'center', gap:6, background:'#16a34a', color:'white', border:'none', borderRadius:7, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoExport /> Export</button>
              </div>

              <div style={{ background:'linear-gradient(135deg,#7c3aed,#9333ea)', borderRadius:10, padding:'12px 18px', marginBottom:14, display:'flex', justifyContent:'space-between', color:'white' }}>
                <span style={{ fontSize:13, fontWeight:600, opacity:0.85 }}>
                  Total charges — {chargeTable.meta.total > 0 ? chargeTable.meta.total : chargeTable.data.length} ligne(s)
                </span>
                <span style={{ fontSize:18, fontWeight:800 }}>
                  {fmt(chargeTable.data.reduce((s,c) => s+Number(c.montant),0))} Ar
                </span>
              </div>

              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <div className="table-wrapper">
                  {chargeTable.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
                    <table>
                      <thead><tr><th>#</th><th>Désignation</th><th>Montant</th><th>Mois</th><th>Année</th><th>Date</th><th>Action</th></tr></thead>
                      <tbody>
                        {chargeTable.data.length === 0
                          ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Aucune charge enregistrée</td></tr>
                          : chargeTable.data.map((c, i) => (
                            <tr key={c.id_charge}>
                              <td style={{ color:'#94a3b8', fontSize:12 }}>{(chargeTable.meta.current_page-1)*chargeTable.meta.per_page+i+1}</td>
                              <td style={{ fontWeight:600 }}>{c.designation}</td>
                              <td style={{ fontWeight:700, color:'#7c3aed' }}>{fmt(c.montant)} Ar</td>
                              <td style={{ fontSize:12 }}>{MOIS[c.mois]}</td>
                              <td style={{ fontSize:12, color:'#64748b' }}>{c.annee}</td>
                              <td style={{ fontSize:12, color:'#64748b' }}>{String(c.date).slice(0,10)}</td>
                              <td>
                                <div className="table-actions">
                                  <button className="btn-icon edit" onClick={() => startEditCharge(c)}><IcoEdit /></button>
                                  <button className="btn-icon delete" onClick={() => handleDeleteCharge(c.id_charge)}><IcoTrash /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  )}
                </div>
                {!chargeTable.loading && chargeTable.meta.total > 0 && (
                  <Pagination meta={chargeTable.meta} onPage={chargeTable.setPage} onPerPage={chargeTable.setPerPage} />
                )}
              </div>
            </div>
          </>)}

        </div>
      </div>
    </div>
  )
}
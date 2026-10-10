import { useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import ConfirmDialog from '../../components/ConfirmDialog'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../contexts/AuthContext'
import { IcoCart, IcoCharge, IcoEdit, IcoPlus, IcoSave, IcoTrash, IcoX, IcoExport } from '../../components/icons'
import { formatMontantInput, parseMontantInput } from '../../utils/validators'

type Tab    = 'achat' | 'charge'
interface Achat  { id_achat: number; nom_materiel: string; prix_unitaire: number; quantite: number; montant: number; date_achat: string; editeur?: string }
interface Charge { id_charge: number; designation: string; montant: number; mois: number; annee: number; date: string; editeur?: string }

const MOIS  = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const TODAY = new Date().toISOString().split('T')[0]
const YEAR  = new Date().getFullYear()
const fmt   = (n: number | string) => new Intl.NumberFormat('fr-MG').format(Number(n))

// FIX : navItems ne sert plus qu'à la barre d'onglets pilule en haut du
// contenu (achat/charge) — la navigation du sidebar à gauche est désormais
// entièrement déléguée au composant partagé <Sidebar section="logistique">,
// qui vit dans Sidebar.tsx / index.css comme pour Formation/Services/Budgets.
// Ainsi, une modification de ces deux fichiers s'applique aussi à Logistique
// sans avoir à toucher ce fichier-ci.
const navItems = [
  { t: 'achat'  as Tab, label: 'Achat',  icon: <IcoCart /> },
  { t: 'charge' as Tab, label: 'Charge', icon: <IcoCharge /> },
]

const IcoSearchSvg = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>

// ── Modal de détail — même pattern que Étudiant/Échéance ──
function DetailModal({ title, rows, onClose }: { title: string; rows: [string, string][]; onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:420, background:'white', borderRadius:12, padding:24 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>{title}</span>
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

export default function LogistiquePage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('achat')

  const achatTable  = useTable<Achat>('/achats',  { perPage: 15 })
  const chargeTable = useTable<Charge>('/charges', { perPage: 15 })

  const [achatMois,      setAchatMois]      = useState('0')
  const [achatAnnee,     setAchatAnnee]     = useState('')
  const [achatDateDebut, setAchatDateDebut] = useState('')
  const [achatDateFin,   setAchatDateFin]   = useState('')

  const applyAchatFilters = (mois: string, annee: string, debut: string, fin: string) => {
    const params: Record<string, string | number> = {}
    if (mois  !== '0') params.mois       = Number(mois)
    if (annee !== '')  params.annee      = Number(annee)
    if (debut !== '')  params.date_debut = debut
    if (fin   !== '')  params.date_fin   = fin
    achatTable.setParams(params)
  }

  const resetAchatFilters = () => {
    setAchatMois('0'); setAchatAnnee(''); setAchatDateDebut(''); setAchatDateFin('')
    achatTable.setParams({})
  }

  const achatFiltered = achatMois !== '0' || achatAnnee !== '' || achatDateDebut !== '' || achatDateFin !== ''

  const [moisFilter,  setMoisFilter]  = useState('0')
  const [anneeFilter, setAnneeFilter] = useState('')

  const applyChargeFilters = (mois: string, annee: string) => {
    const params: Record<string, string | number> = {}
    if (mois  !== '0') params.mois  = Number(mois)
    if (annee !== '')  params.annee = Number(annee)
    chargeTable.setParams(params)
  }

  const resetChargeFilters = () => {
    setMoisFilter('0'); setAnneeFilter('')
    chargeTable.setParams({})
  }

  const totalAchat  = achatTable.data.reduce((s, a) => s + Number(a.montant), 0)
  const totalCharge = chargeTable.data.reduce((s, c) => s + Number(c.montant), 0)
  const [viewingAchat,  setViewingAchat]  = useState<Achat | null>(null)
  const [viewingCharge, setViewingCharge] = useState<Charge | null>(null)

  const [formA, setFormA] = useState({ nom_materiel:'', prix_unitaire:'', quantite:'1', date_achat: TODAY })
  const [editA, setEditA] = useState<Achat | null>(null)
  const [loadA, setLoadA] = useState(false)

  const [formC, setFormC] = useState({ designation:'', montant:'', mois: String(new Date().getMonth()+1), annee: String(YEAR), date: TODAY })
  const [editC, setEditC] = useState<Charge | null>(null)
  const [loadC, setLoadC] = useState(false)

  // FIX : boîte de confirmation de suppression — remplace window.confirm()
  // (non stylée, non centrée) par ConfirmDialog, commune Achat/Charge.
  const [confirmDelete, setConfirmDelete] = useState<{ type: Tab; id: number; label: string } | null>(null)

  const handleSubmitAchat = async (e: React.FormEvent) => {
    e.preventDefault(); setLoadA(true)
    try {
      // FIX : le champ Prix unitaire est saisi formaté ("1 000 000") pour
      // l'affichage — on renvoie la valeur numérique brute à l'API.
      const payloadA = { ...formA, prix_unitaire: parseMontantInput(formA.prix_unitaire) }
      if (editA) { await api.put(`/achats/${editA.id_achat}`, payloadA); toast.success('Achat modifié') }
      else       { await api.post('/achats', payloadA);                  toast.success('Achat enregistré') }
      setFormA({ nom_materiel:'', prix_unitaire:'', quantite:'1', date_achat: TODAY }); setEditA(null)
      achatTable.reload()
    } catch { toast.error('Erreur enregistrement') }
    finally { setLoadA(false) }
  }

  const editAchat = (a: Achat) => {
    setEditA(a)
    setFormA({ nom_materiel: a.nom_materiel, prix_unitaire: formatMontantInput(String(a.prix_unitaire)), quantite: String(a.quantite), date_achat: String(a.date_achat).slice(0,10) })
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  const resetAchatForm = () => { setEditA(null); setFormA({ nom_materiel:'', prix_unitaire:'', quantite:'1', date_achat:TODAY }) }

  const handleSubmitCharge = async (e: React.FormEvent) => {
    e.preventDefault(); setLoadC(true)
    try {
      // FIX : idem Achat — le champ Montant est saisi formaté, on renvoie
      // la valeur numérique brute à l'API.
      const payloadC = { ...formC, montant: parseMontantInput(formC.montant) }
      if (editC) { await api.put(`/charges/${editC.id_charge}`, payloadC); toast.success('Charge modifiée') }
      else       { await api.post('/charges', payloadC);                   toast.success('Charge enregistrée') }
      setFormC({ designation:'', montant:'', mois: String(new Date().getMonth()+1), annee: String(YEAR), date: TODAY }); setEditC(null)
      chargeTable.reload()
    } catch { toast.error('Erreur enregistrement') }
    finally { setLoadC(false) }
  }

  const editCharge = (c: Charge) => {
    setEditC(c)
    setFormC({ designation: c.designation, montant: formatMontantInput(String(c.montant)), mois: String(c.mois), annee: String(c.annee), date: String(c.date).slice(0,10) })
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  const resetChargeForm = () => { setEditC(null); setFormC({ designation:'', montant:'', mois:String(new Date().getMonth()+1), annee:String(YEAR), date:TODAY }) }

  // FIX : les deux confirmations ouvrent désormais la même ConfirmDialog
  // stylée au lieu de window.confirm(). La suppression effective n'a lieu
  // qu'au clic sur "Supprimer" dans la boîte (executeDelete).
  const askDeleteAchat  = (a: Achat)  => setConfirmDelete({ type:'achat',  id:a.id_achat,  label:a.nom_materiel })
  const askDeleteCharge = (c: Charge) => setConfirmDelete({ type:'charge', id:c.id_charge, label:c.designation })

  const executeDelete = async () => {
    if (!confirmDelete) return
    const { type, id } = confirmDelete
    try {
      if (type === 'achat') {
        await api.delete(`/achats/${id}`); toast.success('Achat supprimé'); achatTable.reload()
      } else {
        await api.delete(`/charges/${id}`); toast.success('Charge supprimée'); chargeTable.reload()
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setConfirmDelete(null)
    }
  }

  const exportAchats = () => {
    const rows = [['#','Matériel','Prix unit.','Qté','Montant','Date'], ...achatTable.data.map((a,i)=>[i+1,a.nom_materiel,a.prix_unitaire,a.quantite,a.montant,a.date_achat])]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(';')).join('\n')],{type:'text/csv'})); a.download='achats.csv'; a.click()
  }
  const exportCharges = () => {
    const rows = [['#','Désignation','Montant','Mois','Année','Date'], ...chargeTable.data.map((c,i)=>[i+1,c.designation,c.montant,MOIS[c.mois],c.annee,c.date])]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(';')).join('\n')],{type:'text/csv'})); a.download='charges.csv'; a.click()
  }

  const montantCalc = (Number(parseMontantInput(formA.prix_unitaire))||0) * (Number(formA.quantite)||0)

  const fltSelect: React.CSSProperties = { padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:12, fontFamily:'inherit', background:'white' }
  const fltInput:  React.CSSProperties = { padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:12, fontFamily:'inherit' }
  const btnReset:  React.CSSProperties = { padding:'7px 10px', border:'1px solid #fca5a5', borderRadius:7, fontSize:12, fontFamily:'inherit', background:'#fff1f2', color:'#ef4444', cursor:'pointer', fontWeight:600 }

  const chargeLabel = [moisFilter !== '0' ? MOIS[Number(moisFilter)] : '', anneeFilter].filter(Boolean).join(' ')
  const achatLabel  = [achatMois !== '0' ? MOIS[Number(achatMois)] : '', achatAnnee, achatDateDebut && achatDateFin ? `${achatDateDebut} → ${achatDateFin}` : achatDateDebut || achatDateFin].filter(Boolean).join(' | ')

  return (
    <div className="app-layout">

      {/* FIX : le sidebar propre à Logistique (navigation, ouverture/fermeture,
          bouton Paramètres/Déconnexion) était entièrement recopié ici et ne
          profitait donc jamais des correctifs faits dans Sidebar.tsx/index.css
          (c'était justement le bug de couleur d'état actif signalé). On
          délègue maintenant tout ça au composant partagé, avec les onglets
          Achat/Charge pilotés via activeTab/onTabChange puisque Logistique
          n'a pas de route par onglet (contrairement à Services/Budgets). */}
      <Sidebar section="logistique" activeTab={tab} onTabChange={(t) => setTab(t as Tab)} />

      {/* ── CONTENU ── */}
      <div className="main-content">
        {/* ── Barre du haut avec Achat/Charge — inchangée ── */}
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

        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:20 }}>

          {/* ══ ACHAT ══ */}
          {tab === 'achat' && (<>
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
                  {editA ? <IcoEdit /> : <IcoPlus />} {editA ? "Modifier l'achat" : 'Nouvel achat'}
                </span>
                {editA && <button className="btn btn-sm" onClick={resetAchatForm} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmitAchat}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Matériel </label>
                      <input className="form-control" value={formA.nom_materiel} onChange={e => setFormA({...formA, nom_materiel:e.target.value})} placeholder="Ex: Chaise" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date d'achat </label>
                      <input className="form-control" type="date" value={formA.date_achat} onChange={e => setFormA({...formA, date_achat:e.target.value})} required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Prix unitaire (Ar) </label>
                      <input className="form-control" type="text" inputMode="numeric" value={formA.prix_unitaire} onChange={e => setFormA({...formA, prix_unitaire:formatMontantInput(e.target.value)})} placeholder="Ex: 100 000" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Quantité</label>
                      <input className="form-control" type="number" min="1" value={formA.quantite} onChange={e => setFormA({...formA, quantite:e.target.value})} />
                    </div>
                  </div>
                  {montantCalc > 0 && (
                    <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'8px 12px', fontSize:13, color:'#1d4ed8', fontWeight:600, marginBottom:14 }}>
                      Montant : {fmt(montantCalc)} Ar
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={loadA}>
                    {loadA ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</> : editA ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>}
                  </button>
                </form>
              </div>
            </div>

            {/* FIX : fusion de l'ancienne barre de filtres + bandeau total coloré
                dans l'en-tête de la liste — recherche en haut à droite comme sur
                les autres pages (Certification, État...), total intégré au
                compteur avec les couleurs du design system (var(--accent)) au
                lieu d'un bandeau dégradé bleu isolé. */}
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="card-header">
                <div className="section-info">
                  <div className="section-title">Liste des achats</div>
                  <div className="section-count">
                    {achatTable.meta.total} achat{achatTable.meta.total>1?'s':''}
                    {achatLabel && <> · {achatLabel}</>}
                    <span style={{ marginLeft:10, paddingLeft:10, borderLeft:'1px solid var(--border)', color:'var(--accent)', fontWeight:700 }}>
                      Total : {fmt(totalAchat)} Ar
                    </span>
                  </div>
                </div>
                <div className="search-bar">
                  <IcoSearchSvg />
                  <input placeholder="Rechercher matériel..." value={achatTable.search} onChange={e => achatTable.setSearch(e.target.value)} />
                  {achatTable.search && <button onClick={() => achatTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, fontSize:16 }}>×</button>}
                </div>
              </div>

              <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', padding:'0 20px 16px', borderBottom:'1px solid var(--border)' }}>
                <select value={achatMois} onChange={e => { setAchatMois(e.target.value); applyAchatFilters(e.target.value, achatAnnee, achatDateDebut, achatDateFin) }} style={fltSelect}>
                  <option value="0">Tous les mois</option>
                  {MOIS.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <input type="number" placeholder="Année" value={achatAnnee} min="2000" max="2100"
                  onChange={e => { setAchatAnnee(e.target.value); applyAchatFilters(achatMois, e.target.value, achatDateDebut, achatDateFin) }}
                  style={{ ...fltInput, width:75 }} />
                <span style={{ color:'#cbd5e1', fontSize:11, fontWeight:600 }}>ou période</span>
                <input type="date" value={achatDateDebut}
                  onChange={e => { setAchatDateDebut(e.target.value); applyAchatFilters(achatMois, achatAnnee, e.target.value, achatDateFin) }}
                  style={fltInput} title="Date début" />
                <input type="date" value={achatDateFin}
                  onChange={e => { setAchatDateFin(e.target.value); applyAchatFilters(achatMois, achatAnnee, achatDateDebut, e.target.value) }}
                  style={fltInput} title="Date fin" />
                {achatFiltered && <button onClick={resetAchatFilters} style={btnReset}>✕ Reset</button>}
                <button onClick={exportAchats} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:7, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoExport /> Export</button>
              </div>

              <div className="table-wrapper">
                {achatTable.loading ? <div className="loading-center"><div className="spinner"/></div> : (
                  <table>
                    <thead><tr><th>#</th><th>Matériel</th><th>Prix unit.</th><th>Qté</th><th>Montant</th><th>Date</th><th>Action</th></tr></thead>
                    <tbody>
                      {achatTable.data.length === 0
                        ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:13 }}>Aucun achat</td></tr>
                        : achatTable.data.map((a, i) => (
                          <tr key={a.id_achat} onClick={() => setViewingAchat(a)} style={{ cursor:'pointer' }}>
                            <td style={{ color:'#94a3b8', fontSize:12 }}>{(achatTable.meta.current_page-1)*achatTable.meta.per_page+i+1}</td>
                            <td style={{ fontWeight:600 }}>{a.nom_materiel}</td>
                            <td style={{ color:'#64748b' }}>{fmt(a.prix_unitaire)} Ar</td>
                            <td><span className="badge badge-info">{a.quantite}</span></td>
                            <td style={{ fontWeight:700, color:'var(--accent)' }}>{fmt(a.montant)} Ar</td>
                            <td style={{ fontSize:12, color:'#64748b' }}>{String(a.date_achat).slice(0,10)}</td>
                            <td onClick={ev => ev.stopPropagation()}><div className="table-actions">
                              <button className="btn-icon edit" onClick={() => editAchat(a)}><IcoEdit /></button>
                              {isAdmin() && <button className="btn-icon delete" onClick={() => askDeleteAchat(a)}><IcoTrash /></button>}
                            </div></td>
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
          </>)}

          {/* ══ CHARGE ══ */}
          {tab === 'charge' && (<>
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
                  {editC ? <IcoEdit /> : <IcoPlus />} {editC ? 'Modifier la charge' : 'Nouvelle charge'}
                </span>
                {editC && <button className="btn btn-sm" onClick={resetChargeForm} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmitCharge}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Désignation </label>
                      <input className="form-control" value={formC.designation} onChange={e => setFormC({...formC, designation:e.target.value})} placeholder="Ex: Loyer" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Montant (Ar) </label>
                      <input className="form-control" type="text" inputMode="numeric" value={formC.montant} onChange={e => setFormC({...formC, montant:formatMontantInput(e.target.value)})} placeholder="Ex: 100 000" required />
                    </div>
                  </div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label className="form-label">Mois</label>
                      <select className="form-control" value={formC.mois} onChange={e => setFormC({...formC, mois:e.target.value})}>
                        {MOIS.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Année</label>
                      <input className="form-control" type="number" min="2000" value={formC.annee} onChange={e => setFormC({...formC, annee:e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date </label>
                      <input className="form-control" type="date" value={formC.date} onChange={e => setFormC({...formC, date:e.target.value})} required />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={loadC}>
                    {loadC ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</> : editC ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>}
                  </button>
                </form>
              </div>
            </div>

            {/* FIX : même fusion recherche/filtres/total que Achat — la charge
                étant une dépense, le total reste en rouge (var(--danger)),
                mais intégré au compteur au lieu d'un bandeau violet isolé. */}
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="card-header">
                <div className="section-info">
                  <div className="section-title">Charges mensuelles</div>
                  <div className="section-count">
                    {chargeTable.meta.total} charge{chargeTable.meta.total>1?'s':''}
                    {chargeLabel && <> · {chargeLabel}</>}
                    <span style={{ marginLeft:10, paddingLeft:10, borderLeft:'1px solid var(--border)', color:'var(--danger)', fontWeight:700 }}>
                      Total : {fmt(totalCharge)} Ar
                    </span>
                  </div>
                </div>
                <div className="search-bar">
                  <IcoSearchSvg />
                  <input placeholder="Rechercher..." value={chargeTable.search} onChange={e => chargeTable.setSearch(e.target.value)} />
                  {chargeTable.search && <button onClick={() => chargeTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, fontSize:16 }}>×</button>}
                </div>
              </div>

              <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', padding:'0 20px 16px', borderBottom:'1px solid var(--border)' }}>
                <select value={moisFilter} onChange={e => { setMoisFilter(e.target.value); applyChargeFilters(e.target.value, anneeFilter) }} style={fltSelect}>
                  <option value="0">Tous les mois</option>
                  {MOIS.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <input type="number" placeholder="Année" value={anneeFilter} min="2000" max="2100"
                  onChange={e => { setAnneeFilter(e.target.value); applyChargeFilters(moisFilter, e.target.value) }}
                  style={{ ...fltInput, width:75 }} />
                {(moisFilter !== '0' || anneeFilter !== '') && <button onClick={resetChargeFilters} style={btnReset}>✕ Reset</button>}
                <button onClick={exportCharges} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:7, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoExport /> Export</button>
              </div>

              <div className="table-wrapper">
                {chargeTable.loading ? <div className="loading-center"><div className="spinner"/></div> : (
                  <table>
                    <thead><tr><th>#</th><th>Désignation</th><th>Montant</th><th>Mois</th><th>Année</th><th>Date</th><th>Action</th></tr></thead>
                    <tbody>
                      {chargeTable.data.length === 0
                        ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:13 }}>Aucune charge</td></tr>
                        : chargeTable.data.map((c, i) => (
                          <tr key={c.id_charge} onClick={() => setViewingCharge(c)} style={{ cursor:'pointer' }}>
                            <td style={{ color:'#94a3b8', fontSize:12 }}>{(chargeTable.meta.current_page-1)*chargeTable.meta.per_page+i+1}</td>
                            <td style={{ fontWeight:600 }}>{c.designation}</td>
                            <td style={{ fontWeight:700, color:'var(--danger)' }}>{fmt(c.montant)} Ar</td>
                            <td style={{ fontSize:12 }}>{MOIS[c.mois]}</td>
                            <td style={{ fontSize:12, color:'#64748b' }}>{c.annee}</td>
                            <td style={{ fontSize:12, color:'#64748b' }}>{String(c.date).slice(0,10)}</td>
                            <td onClick={ev => ev.stopPropagation()}><div className="table-actions">
                              <button className="btn-icon edit" onClick={() => editCharge(c)}><IcoEdit /></button>
                              {isAdmin() && <button className="btn-icon delete" onClick={() => askDeleteCharge(c)}><IcoTrash /></button>}
                            </div></td>
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
          </>)}

        </div>
      </div>

      {viewingAchat && (
        <DetailModal
          title="Détail de l'achat"
          onClose={() => setViewingAchat(null)}
          rows={[
            ['Matériel', viewingAchat.nom_materiel],
            ['Prix unitaire', `${fmt(viewingAchat.prix_unitaire)} Ar`],
            ['Quantité', String(viewingAchat.quantite)],
            ['Montant', `${fmt(viewingAchat.montant)} Ar`],
            ['Date', String(viewingAchat.date_achat).slice(0,10)],
            ['Éditeur', viewingAchat.editeur?.trim() || '—'],
          ]}
        />
      )}
      {viewingCharge && (
        <DetailModal
          title="Détail de la charge"
          onClose={() => setViewingCharge(null)}
          rows={[
            ['Désignation', viewingCharge.designation],
            ['Montant', `${fmt(viewingCharge.montant)} Ar`],
            ['Mois', MOIS[viewingCharge.mois]],
            ['Année', String(viewingCharge.annee)],
            ['Date', String(viewingCharge.date).slice(0,10)],
            ['Éditeur', viewingCharge.editeur?.trim() || '—'],
          ]}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'achat' ? 'Supprimer cet achat ?' : 'Supprimer cette charge ?'}
        message={confirmDelete ? `« ${confirmDelete.label} » sera définitivement supprimé(e). Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
import { useEffect, useState } from 'react'
import api, { storageUrl } from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useAuth } from '../../contexts/AuthContext'
import { IcoEdit, IcoPlus, IcoSearch, IcoCamera, IcoSave, IcoX, IcoExport, IcoTrash } from '../../components/icons'
import { toUpperName, toTitleCaseWords, formatTelephoneMG, isValidTelephoneMG, formatCinMG, isValidCinMG, isValidEmailComFr, isAdult18, formatMontantInput, parseMontantInput, invalidFieldStyle } from '../../utils/validators'

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
interface Fonction { id_fonction: number; nom_fonction: string }

const fmtM   = (n: number) => new Intl.NumberFormat('fr-MG').format(n)
const EMPTY_P = { matricule_pers:'', nom_pers:'', prenom_pers:'', ddn_pers:'', cin_pers:'', tel_pers:'', email_pers:'', dembauche_pers:'', salaire_pers:'', diplome_pers:'', adresse_pers:'', id_fonction:'' }

// FIX : ce fichier était un composant orphelin — jamais importé nulle part
// (PersonnelPage.tsx réimplémentait tout en interne à sa place), et en plus
// désynchronisé de l'API réelle (il appelait /personnels au pluriel, alors
// que le backend utilise /personnel au singulier). On y déplace maintenant
// la vraie logique qui tournait dans PersonnelPage.tsx : useTable pour la
// pagination/recherche server-side, ConfirmDialog pour la suppression, le
// détail au clic sur une ligne, et les bons endpoints /personnel/....
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
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'8px 14px', fontSize:14 }}>
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

export default function PersonnelTab() {
  const { isAdmin } = useAuth()
  const fmt = fmtM
  const personnelTable = useTable<Personnel>('/personnel', { perPage: 15 })

  const [fonctionsList, setFonctionsList] = useState<Fonction[]>([])
  useEffect(() => {
    api.get('/fonctions', { params: { per_page: 500 } })
      .then(r => setFonctionsList(r.data.data ?? []))
      .catch(() => {})
  }, [])

  const [formP,    setFormP]    = useState<Record<string,string>>(EMPTY_P)
  const [editP,    setEditP]    = useState<Personnel | null>(null)
  const [savingP,  setSavingP]  = useState(false)
  const [viewingP, setViewingP] = useState<Personnel | null>(null)
  const [confirmDeletePersMat, setConfirmDeletePersMat] = useState<string | null>(null)

  const handleSubmitPersonnel = async (e: React.FormEvent) => {
    e.preventDefault()
    // FIX : règles de validation métier — voir utils/validators.ts.
    if (formP.tel_pers && !isValidTelephoneMG(formP.tel_pers)) {
      toast.error('Téléphone invalide — 10 chiffres, préfixe 032 à 038 (ex: 034 12 345 67)')
      return
    }
    if (formP.email_pers && !isValidEmailComFr(formP.email_pers)) {
      toast.error('Email invalide — doit se terminer par .com ou .fr')
      return
    }
    // FIX : Date de naissance et CIN sont désormais obligatoires — même
    // exigence que pour Étudiant (18 ans minimum + CIN requis).
    if (!formP.ddn_pers) {
      toast.error('La date de naissance est obligatoire')
      return
    }
    if (!isAdult18(formP.ddn_pers)) {
      toast.error('Le personnel doit avoir au moins 18 ans')
      return
    }
    if (!formP.cin_pers) {
      toast.error('Le numéro CIN est obligatoire')
      return
    }
    if (!isValidCinMG(formP.cin_pers)) {
      toast.error('CIN invalide — 12 chiffres exactement (ex: 101 234 567 890)')
      return
    }
    setSavingP(true)
    try {
      // FIX : le champ Salaire est saisi formaté ("1 000 000") pour
      // l'affichage — on renvoie la valeur numérique brute à l'API.
      const payloadP = { ...formP, salaire_pers: parseMontantInput(formP.salaire_pers) }
      if (editP) { await api.put(`/personnel/${editP.matricule_pers}`, payloadP); toast.success('Personnel modifié') }
      else       { await api.post('/personnel', payloadP); toast.success('Personnel enregistré') }
      setFormP(EMPTY_P); setEditP(null); personnelTable.reload()
    } catch (err: any) { toast.error(err.response?.data?.message ?? "Erreur enregistrement") }
    finally { setSavingP(false) }
  }

  const handleDeletePersonnel = async () => {
    if (!confirmDeletePersMat) return
    try { await api.delete(`/personnel/${confirmDeletePersMat}`); toast.success('Personnel supprimé'); personnelTable.reload() }
    catch { toast.error('Erreur suppression') }
    finally { setConfirmDeletePersMat(null) }
  }

  const startEditPersonnel = (p: Personnel) => {
    setEditP(p)
    setFormP({ matricule_pers:p.matricule_pers, nom_pers:p.nom_pers, prenom_pers:p.prenom_pers, ddn_pers:p.ddn_pers?.slice(0,10)??'', cin_pers:formatCinMG(p.cin_pers??''), tel_pers:p.tel_pers??'', email_pers:p.email_pers??'', dembauche_pers:p.dembauche_pers?.slice(0,10)??'', salaire_pers:formatMontantInput(String(p.salaire_pers)), diplome_pers:p.diplome_pers??'', adresse_pers:p.adresse_pers??'', id_fonction:String(p.id_fonction) })
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

  const exportPersonnels = () => {
    if (personnelTable.data.length === 0) { toast.error('Aucune donnée'); return }
    const rows = [['Matricule','Nom','Prénom','Fonction','Tél','Email','Salaire'], ...personnelTable.data.map(p=>[p.matricule_pers,p.nom_pers,p.prenom_pers,p.nom_fonction,p.tel_pers,p.email_pers,String(p.salaire_pers)])]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(';')).join('\n')],{type:'text/csv'})); a.download='personnels.csv'; a.click()
    toast.success('Export CSV téléchargé')
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
            {editP ? <IcoEdit /> : <IcoPlus />} {editP ? 'Modifier le personnel' : 'Nouveau personnel'}
          </span>
          {/* FIX : style harmonisé avec le bouton Annuler d'Étudiant, référence commune à tous les formulaires */}
          {editP && <button className="btn btn-sm" onClick={resetPersonnel} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
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
                {/* FIX : toujours en MAJUSCULES */}
                <input className="form-control" value={formP.nom_pers} onChange={e => setFormP({...formP, nom_pers:toUpperName(e.target.value)})} required placeholder="Nom" />
              </div>
              <div className="form-group">
                <label className="form-label">Prénom </label>
                {/* FIX : Majuscule à chaque mot */}
                <input className="form-control" value={formP.prenom_pers} onChange={e => setFormP({...formP, prenom_pers:toTitleCaseWords(e.target.value)})} required placeholder="Prénom" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date de naissance <span style={{ color:'#ef4444' }}>*</span></label>
                {/* FIX : obligatoire — le personnel doit avoir au moins 18 ans */}
                <input className="form-control" type="date" value={formP.ddn_pers}
                  onChange={e => setFormP({...formP, ddn_pers:e.target.value})}
                  style={formP.ddn_pers && !isAdult18(formP.ddn_pers) ? invalidFieldStyle : undefined}
                  required />
              </div>
              <div className="form-group">
                <label className="form-label">N° CIN <span style={{ color:'#ef4444' }}></span></label>
                {/* FIX : obligatoire — formatage automatique "XXX XXX XXX XXX" (12 chiffres) */}
                <input className="form-control" value={formP.cin_pers}
                  onChange={e => setFormP({...formP, cin_pers:formatCinMG(e.target.value)})}
                  style={formP.cin_pers && !isValidCinMG(formP.cin_pers) ? invalidFieldStyle : undefined}
                  required placeholder="Ex: 101 234 567 890" maxLength={15} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                {/* FIX : formatage automatique "03X XX XXX XX" */}
                <input className="form-control" value={formP.tel_pers} onChange={e => setFormP({...formP, tel_pers:formatTelephoneMG(e.target.value)})}
                  style={formP.tel_pers && !isValidTelephoneMG(formP.tel_pers) ? invalidFieldStyle : undefined}
                  placeholder="Ex: 034 12 345 67" maxLength={13} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={formP.email_pers} onChange={e => setFormP({...formP, email_pers:e.target.value})}
                  style={formP.email_pers && !isValidEmailComFr(formP.email_pers) ? invalidFieldStyle : undefined}
                  placeholder="exemple@domaine.com" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date d'embauche</label>
                <input className="form-control" type="date" value={formP.dembauche_pers} onChange={e => setFormP({...formP, dembauche_pers:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Salaire (Ar)</label>
                <input className="form-control" type="text" inputMode="numeric" value={formP.salaire_pers} onChange={e => setFormP({...formP, salaire_pers:formatMontantInput(e.target.value)})} placeholder="Ex: 100 000" />
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
                    <td style={{ color:'#94a3b8', fontSize:13 }}>{(personnelTable.meta.current_page-1)*personnelTable.meta.per_page+i+1}</td>
                    <td>
                      <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                        {p.photo_pers
                          ? <img src={storageUrl(p.photo_pers)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
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
                    <td style={{ fontSize:13, color:'#64748b' }}>{p.tel_pers || '—'}</td>
                    <td style={{ fontWeight:600, color:'#16a34a' }}>{fmt(p.salaire_pers)} Ar</td>
                    <td onClick={ev => ev.stopPropagation()}><div className="table-actions">
                      <button className="btn-icon edit" onClick={() => startEditPersonnel(p)}><IcoEdit /></button>
                      {isAdmin() && <button className="btn-icon delete" onClick={() => setConfirmDeletePersMat(p.matricule_pers)}><IcoTrash /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!personnelTable.loading && personnelTable.meta.total > 0 && <Pagination meta={personnelTable.meta} onPage={personnelTable.setPage} onPerPage={personnelTable.setPerPage} />}
      </div>

      {viewingP && <DetailModal p={viewingP} onClose={() => setViewingP(null)} />}

      <ConfirmDialog
        open={!!confirmDeletePersMat}
        title="Supprimer ce personnel ?"
        message={confirmDeletePersMat ? `Le personnel « ${confirmDeletePersMat} » sera définitivement supprimé. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        onConfirm={handleDeletePersonnel}
        onCancel={() => setConfirmDeletePersMat(null)}
      />
    </>
  )
}
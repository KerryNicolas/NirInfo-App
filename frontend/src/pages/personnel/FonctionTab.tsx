import { useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useAuth } from '../../contexts/AuthContext'
import { IcoEdit, IcoPlus, IcoSearch, IcoSave, IcoX, IcoTrash } from '../../components/icons'

export interface Fonction {
  id_fonction: number
  nom_fonction: string
  description_fonction: string
  editeur?: string
}

const EMPTY_F = { nom_fonction: '', description_fonction: '' }

// FIX : ce fichier était un composant orphelin — jamais importé nulle part,
// PersonnelPage.tsx réimplémentait tout en interne à la place. On y déplace
// maintenant la vraie logique (celle qui tournait dans PersonnelPage.tsx) :
// useTable pour la pagination/recherche, ConfirmDialog pour la suppression,
// et le détail au clic sur une ligne — au lieu de l'ancien fetch minimal
// sans pagination ni recherche.
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

export default function FonctionTab() {
  const { isAdmin } = useAuth()
  const fonctionTable = useTable<Fonction>('/fonctions', { perPage: 15 })

  const [formF,    setFormF]    = useState(EMPTY_F)
  const [editF,    setEditF]    = useState<Fonction | null>(null)
  const [savingF,  setSavingF]  = useState(false)
  const [viewingF, setViewingF] = useState<Fonction | null>(null)
  const [confirmDeleteFonctionId, setConfirmDeleteFonctionId] = useState<number | null>(null)

  const resetFonction = () => { setFormF(EMPTY_F); setEditF(null) }

  const handleSubmitFonction = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingF(true)
    try {
      if (editF) { await api.put(`/fonctions/${editF.id_fonction}`, formF); toast.success('Fonction modifiée') }
      else       { await api.post('/fonctions', formF); toast.success('Fonction créée') }
      setFormF(EMPTY_F); setEditF(null); fonctionTable.reload()
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur enregistrement') }
    finally { setSavingF(false) }
  }

  const handleDeleteFonction = async () => {
    if (!confirmDeleteFonctionId) return
    try { await api.delete(`/fonctions/${confirmDeleteFonctionId}`); toast.success('Fonction supprimée'); fonctionTable.reload() }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Erreur suppression') }
    finally { setConfirmDeleteFonctionId(null) }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
            {editF ? <IcoEdit /> : <IcoPlus />} {editF ? 'Modifier la fonction' : 'Nouvelle fonction'}
          </span>
          {/* FIX : style harmonisé avec le bouton Annuler d'Étudiant */}
          {editF && <button className="btn btn-sm" onClick={resetFonction} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
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
                    <td style={{ color:'#94a3b8', fontSize:13 }}>{(fonctionTable.meta.current_page-1)*fonctionTable.meta.per_page+i+1}</td>
                    <td style={{ fontWeight:600 }}>{f.nom_fonction}</td>
                    <td style={{ fontSize:13, color:'#64748b' }}>{f.description_fonction || '—'}</td>
                    <td onClick={ev => ev.stopPropagation()}><div className="table-actions">
                      <button className="btn-icon edit" onClick={() => { setEditF(f); setFormF({ nom_fonction:f.nom_fonction, description_fonction:f.description_fonction??'' }); window.scrollTo({top:0,behavior:'smooth'}) }}><IcoEdit /></button>
                      {isAdmin() && <button className="btn-icon delete" onClick={() => setConfirmDeleteFonctionId(f.id_fonction)}><IcoTrash /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!fonctionTable.loading && fonctionTable.meta.total > 0 && <Pagination meta={fonctionTable.meta} onPage={fonctionTable.setPage} onPerPage={fonctionTable.setPerPage} />}
      </div>

      {viewingF && <DetailModalFonction f={viewingF} onClose={() => setViewingF(null)} />}

      <ConfirmDialog
        open={!!confirmDeleteFonctionId}
        title="Supprimer cette fonction ?"
        message="Cette fonction sera définitivement supprimée. Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={handleDeleteFonction}
        onCancel={() => setConfirmDeleteFonctionId(null)}
      />
    </>
  )
}
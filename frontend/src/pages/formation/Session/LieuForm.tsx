import { useState } from 'react'
import api from '../../../api/axios'
import { useAuth } from '../../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { useTable } from '../../../hooks/useTable'
import Pagination from '../../../components/Pagination'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX, IcoInfo } from '../../../components/icons'

// Onglet « Lieu » de Session : même présentation que l'onglet Horaire. Les
// lieux créés ici alimentent le champ « Lieu » des sessions et les listes
// « Lieu de paiement » (Inscription, Recouvrement, Certification, État).

interface Lieu { id_lieu: number; nom: string; editeur: string }

function EditeurPopover({ editeur, onClose }: { editeur: string; onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:280, background:'white', borderRadius:12, padding:20 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={{ fontWeight:700, fontSize:14 }}>Éditeur</span>
          <button onClick={onClose} className="btn-icon"><IcoX /></button>
        </div>
        <div style={{ fontSize:14, color:'#334155' }}>{editeur?.trim() || 'Non renseigné'}</div>
      </div>
    </div>
  )
}

export default function LieuForm() {
  const { isAdmin } = useAuth()
  const table = useTable<Lieu>('/lieux', { perPage: 15 })
  const [editing, setEditing] = useState<Lieu | null>(null)
  const [nom,     setNom]     = useState('')
  const [saving,  setSaving]  = useState(false)
  const [showEditeur, setShowEditeur] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Lieu | null>(null)

  const reset = () => { setNom(''); setEditing(null) }

  const handleEdit = (l: Lieu) => {
    setEditing(l)
    setNom(l.nom)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      if (editing) { await api.put(`/lieux/${editing.id_lieu}`, { nom }); toast.success('Lieu mis à jour') }
      else         { await api.post('/lieux', { nom }); toast.success('Lieu créé avec succès') }
      reset(); table.reload()
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.nom?.[0] || err.response?.data?.message || 'Erreur')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try { await api.delete(`/lieux/${confirmDelete.id_lieu}`); toast.success('Lieu supprimé'); table.reload() }
    // Le serveur explique pourquoi : un lieu encore utilisé ne se supprime pas.
    catch (err: any) { toast.error(err.response?.data?.message || 'Erreur suppression') }
    finally { setConfirmDelete(null) }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{editing ? 'Modifier le lieu' : 'Nouveau lieu'}</span>
          {editing && <button className="btn btn-sm" onClick={reset} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nom du lieu </label>
              <input className="form-control" value={nom} onChange={e => setNom(e.target.value)} required maxLength={100} placeholder="Ex: Ampandrana" />
            </div>
            {editing && (
              <p style={{ fontSize:13, color:'#64748b', margin:'6px 0 10px' }}>
                Le nouveau nom sera repris dans les sessions, les paiements et les certificats qui portent ce lieu.
              </p>
            )}
            <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</> : editing ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-info">
            <div className="section-title">Liste des lieu(x)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} lieu(x)` : `${table.data.length} lieu(x)`}</div>
          </div>
          <div className="search-bar">
            <IcoSearch />
            <input placeholder="Mot à rechercher..." value={table.search} onChange={e => table.setSearch(e.target.value)} />
            {table.search && <button onClick={() => table.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, fontSize:16 }}>×</button>}
          </div>
        </div>
        <div className="table-wrapper">
          {table.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
            <table>
              <thead><tr><th>#</th><th>Nom du lieu</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={3}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun lieu trouvé'}</div></td></tr>
                ) : table.data.map((l, idx) => (
                  <tr key={l.id_lieu}>
                    <td style={{ color:'#94a3b8', fontSize:13 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td style={{ fontWeight:600 }}>{l.nom}</td>
                    <td><div className="table-actions">
                      <button className="btn-icon" title="Éditeur" onClick={() => setShowEditeur(l.editeur)}><IcoInfo /></button>
                      <button className="btn-icon edit" onClick={() => handleEdit(l)}><IcoEdit /></button>
                      {isAdmin() && <button className="btn-icon delete" onClick={() => setConfirmDelete(l)}><IcoTrash /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!table.loading && table.meta.total > 0 && <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />}
      </div>

      {showEditeur !== null && <EditeurPopover editeur={showEditeur} onClose={() => setShowEditeur(null)} />}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer ce lieu ?"
        message={confirmDelete ? `Le lieu « ${confirmDelete.nom} » sera définitivement supprimé. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}

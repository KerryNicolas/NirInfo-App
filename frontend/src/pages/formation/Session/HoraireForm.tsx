import { useState } from 'react'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../../hooks/useTable'
import Pagination from '../../../components/Pagination'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX, IcoInfo } from '../../../components/icons'

interface Horaire { code_horaire: string; designation: string; horaire: string; remarque: string; editeur: string }
const EMPTY = { code_horaire: '', designation: '', horaire: '', remarque: '' }

// ── Petit popover léger — une seule info (éditeur), pas besoin d'un modal complet ──
function EditeurPopover({ editeur, onClose }: { editeur: string; onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:280, background:'white', borderRadius:12, padding:20 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={{ fontWeight:700, fontSize:14 }}>Éditeur</span>
          <button onClick={onClose} className="btn-icon"><IcoX /></button>
        </div>
        <div style={{ fontSize:13, color:'#334155' }}>{editeur?.trim() || 'Non renseigné'}</div>
      </div>
    </div>
  )
}

export default function HoraireForm() {
  const table   = useTable<Horaire>('/horaires', { perPage: 15 })
  const [editing, setEditing] = useState<Horaire | null>(null)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [showEditeur, setShowEditeur] = useState<string | null>(null)

  const reset = () => { setForm(EMPTY); setEditing(null) }

  const handleEdit = (h: Horaire) => {
    setEditing(h)
    setForm({ code_horaire: h.code_horaire, designation: h.designation, horaire: h.horaire || '', remarque: h.remarque || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) { await api.put(`/horaires/${editing.code_horaire}`, form); toast.success('Horaire mis à jour') }
      else         { await api.post('/horaires', form); toast.success('Horaire créé avec succès') }
      reset(); table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(`Supprimer l'horaire "${code}" ?`)) return
    try { await api.delete(`/horaires/${code}`); toast.success('Horaire supprimé'); table.reload() }
    catch { toast.error('Erreur suppression') }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{editing ? "Modifier l'horaire" : 'Nouvel horaire'}</span>
          {editing && <button className="btn btn-secondary btn-sm" onClick={reset} style={{ display:'flex', alignItems:'center', gap:5 }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Code </label>
                <input className="form-control" value={form.code_horaire} onChange={set('code_horaire')} required disabled={!!editing} placeholder="Ex: MAT" style={{ textTransform:'uppercase' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Désignation </label>
                <input className="form-control" value={form.designation} onChange={set('designation')} required placeholder="Ex: Matin" />
              </div>
              <div className="form-group">
                <label className="form-label">Description horaire</label>
                <input className="form-control" value={form.horaire} onChange={set('horaire')} placeholder="Ex: Lundi–Vendredi 07h30–12h00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Remarque</label>
              <textarea className="form-control" value={form.remarque} onChange={set('remarque')} rows={2} placeholder="Remarque optionnelle..." />
            </div>
            <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</> : editing ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-info">
            <div className="section-title">Liste des horaire(s)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} horaire(s)` : `${table.data.length} horaire(s)`}</div>
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
              {/* Colonne Éditeur retirée — accessible via le bouton info dans Action */}
              <thead><tr><th>#</th><th>Code</th><th>Désignation</th><th>Description</th><th>Remarque</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun horaire trouvé'}</div></td></tr>
                ) : table.data.map((h, idx) => (
                  <tr key={h.code_horaire}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td><span className="badge badge-info">{h.code_horaire}</span></td>
                    <td style={{ fontWeight:600 }}>{h.designation}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{h.horaire || '—'}</td>
                    <td style={{ fontSize:12 }}>{h.remarque || '—'}</td>
                    <td><div className="table-actions">
                      <button className="btn-icon" title="Éditeur" onClick={() => setShowEditeur(h.editeur)}><IcoInfo /></button>
                      <button className="btn-icon edit" onClick={() => handleEdit(h)}><IcoEdit /></button>
                      <button className="btn-icon delete" onClick={() => handleDelete(h.code_horaire)}><IcoTrash /></button>
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
    </>
  )
}
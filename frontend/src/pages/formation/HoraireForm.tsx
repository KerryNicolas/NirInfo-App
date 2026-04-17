import { useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX } from '../../components/icons'

interface Horaire { code_horaire: string; designation: string; horaire: string; remarque: string; editeur: string }
const EMPTY = { code_horaire: '', designation: '', horaire: '', remarque: '' }

export default function HoraireForm() {
  const table   = useTable<Horaire>('/horaires', { perPage: 15 })
  const [editing, setEditing] = useState<Horaire | null>(null)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)

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
                <label className="form-label">Code <span style={{ color:'#ef4444' }}>*</span></label>
                <input className="form-control" value={form.code_horaire} onChange={set('code_horaire')} required disabled={!!editing} placeholder="Ex: MAT" style={{ textTransform:'uppercase' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Désignation <span style={{ color:'#ef4444' }}>*</span></label>
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
              <thead><tr><th>#</th><th>Code</th><th>Désignation</th><th>Description</th><th>Remarque</th><th>Éditeur</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun horaire trouvé'}</div></td></tr>
                ) : table.data.map((h, idx) => (
                  <tr key={h.code_horaire}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td><span className="badge badge-info">{h.code_horaire}</span></td>
                    <td style={{ fontWeight:600 }}>{h.designation}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{h.horaire || '—'}</td>
                    <td style={{ fontSize:12 }}>{h.remarque || '—'}</td>
                    <td style={{ fontSize:11, color:'#64748b' }}>{h.editeur}</td>
                    <td><div className="table-actions">
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
    </>
  )
}
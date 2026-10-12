import { useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { useAuth } from '../../contexts/AuthContext'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX } from '../../components/icons'

interface Client { id_client: number; client_name: string; client_contact: string; client_adresse: string }
const EMPTY = { client_name: '', client_contact: '', client_adresse: '' }

export default function ClientTab() {
  const { isAdmin } = useAuth()
  const table   = useTable<Client>('/clients', { perPage: 15 })
  const [editing, setEditing] = useState<Client | null>(null)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)

  const reset = () => { setForm(EMPTY); setEditing(null) }

  const handleEdit = (c: Client) => {
    setEditing(c)
    setForm({ client_name: c.client_name, client_contact: c.client_contact || '', client_adresse: c.client_adresse || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) { await api.put(`/clients/${editing.id_client}`, form); toast.success('Client mis à jour') }
      else         { await api.post('/clients', form); toast.success('Client créé avec succès') }
      reset(); table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce client ?')) return
    try { await api.delete(`/clients/${id}`); toast.success('Client supprimé'); table.reload() }
    catch (err: any) { toast.error(err.response?.data?.message || 'Erreur suppression') }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>{editing ? <IcoEdit /> : <IcoPlus />} {editing ? 'Modifier le client' : 'Nouveau client'}</span>
          {editing && <button className="btn btn-secondary btn-sm" onClick={reset} style={{ display:'flex', alignItems:'center', gap:5 }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nom </label>
              <input className="form-control" value={form.client_name} onChange={set('client_name')} required placeholder="Nom du client" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contact</label>
                <input className="form-control" value={form.client_contact} onChange={set('client_contact')} placeholder="Téléphone / email" />
              </div>
              <div className="form-group">
                <label className="form-label">Adresse</label>
                <input className="form-control" value={form.client_adresse} onChange={set('client_adresse')} placeholder="Adresse" />
              </div>
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
            <div className="section-title">Liste de client(s)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} client(s)` : `${table.data.length} client(s)`}</div>
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
              <thead><tr><th>#</th><th>Nom</th><th>Contact</th><th>Adresse</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun client'}</div></td></tr>
                ) : table.data.map((c, idx) => (
                  <tr key={c.id_client}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td style={{ fontWeight:600 }}>{c.client_name}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{c.client_contact || '—'}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{c.client_adresse || '—'}</td>
                    <td><div className="table-actions">
                      <button className="btn-icon edit" onClick={() => handleEdit(c)}><IcoEdit /></button>
                      {isAdmin() && <button className="btn-icon delete" onClick={() => handleDelete(c.id_client)}><IcoTrash /></button>}
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
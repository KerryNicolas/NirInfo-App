import { useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { IcoEdit, IcoTrash, IcoSearch } from '../../components/icons'
import ModuleForm from './ModuleForm'

interface Module { code_module: string; nom: string; description: string; editeur: string }
const EMPTY = { code_module: '', nom: '', description: '' }

export default function ModuleTab() {
  const table   = useTable<Module>('/modules', { perPage: 15 })
  const [editing, setEditing] = useState<Module | null>(null)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)

  const reset = () => { setForm(EMPTY); setEditing(null) }

  const handleEdit = (m: Module) => {
    setEditing(m)
    setForm({ code_module: m.code_module, nom: m.nom, description: m.description || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) { await api.put(`/modules/${editing.code_module}`, form); toast.success('Module mis à jour') }
      else         { await api.post('/modules', form); toast.success('Module créé avec succès') }
      reset(); table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(`Supprimer le module "${code}" ?`)) return
    try { await api.delete(`/modules/${code}`); toast.success('Module supprimé'); table.reload() }
    catch { toast.error('Erreur suppression') }
  }

  const handleChange = (key: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))

  return (
    <div className="page-body">
      <div className="top-bar">
        <span className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Module
        </span>
      </div>

      <div style={{ padding: 24 }}>

        {/*  Formulaire extrait en composant */}
        <ModuleForm
          form={form}
          editing={!!editing}
          saving={saving}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={reset}
        />

        {/* Tableau */}
        <div className="card">
          <div className="card-header">
            <div className="section-info">
              <div className="section-title">Liste des module(s)</div>
              <div className="section-count">
                {table.meta.total > 0 ? `${table.meta.total} module(s)` : `${table.data.length} module(s)`}
              </div>
            </div>
            <div className="search-bar">
              <IcoSearch />
              <input
                placeholder="Mot à rechercher..."
                value={table.search}
                onChange={e => table.setSearch(e.target.value)}
              />
              {table.search && (
                <button
                  onClick={() => table.setSearch('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, fontSize: 16 }}
                >×</button>
              )}
            </div>
          </div>
          <div className="table-wrapper">
            {table.loading ? (
              <div className="loading-center"><div className="spinner" /> Chargement…</div>
            ) : (
              <table>
                <thead>
                  <tr><th>#</th><th>Code</th><th>Nom</th><th>Description</th><th>Éditeur</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {table.data.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          {table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun module trouvé'}
                        </div>
                      </td>
                    </tr>
                  ) : table.data.map((m, idx) => (
                    <tr key={m.code_module}>
                      <td style={{ color: '#94a3b8', fontSize: 12 }}>
                        {(table.meta.current_page - 1) * table.meta.per_page + idx + 1}
                      </td>
                      <td><span className="badge badge-info">{m.code_module}</span></td>
                      <td style={{ fontWeight: 600 }}>{m.nom}</td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{m.description || '—'}</td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{m.editeur}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn-icon edit" onClick={() => handleEdit(m)}><IcoEdit /></button>
                          <button className="btn-icon delete" onClick={() => handleDelete(m.code_module)}><IcoTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {!table.loading && table.meta.total > 0 && (
            <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />
          )}
        </div>

      </div>
    </div>
  )
}

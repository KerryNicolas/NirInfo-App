import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

interface Module { code_module: string; nom: string; description: string; editeur: string }

export default function ModuleTab() {
  const [modules, setModules]   = useState<Module[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [editing, setEditing]   = useState<Module | null>(null)
  const [form, setForm] = useState({ code_module: '', nom: '', description: '' })

  const load = async (q = '') => {
    setLoading(true)
    try {
      const r = await api.get('/modules', { params: { search: q } })
      setModules(r.data.data)
    } catch { toast.error('Erreur chargement modules') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    load(e.target.value)
  }

  const reset = () => { setForm({ code_module: '', nom: '', description: '' }); setEditing(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await api.put(`/modules/${editing.code_module}`, form)
        toast.success('Module mis à jour')
      } else {
        await api.post('/modules', form)
        toast.success('Module créé')
      }
      reset(); load(search)
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erreur'
      toast.error(msg)
    }
  }

  const handleEdit = (m: Module) => {
    setEditing(m)
    setForm({ code_module: m.code_module, nom: m.nom, description: m.description })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (code: string) => {
    if (!confirm('Supprimer ce module ?')) return
    try { await api.delete(`/modules/${code}`); toast.success('Supprimé'); load(search) }
    catch { toast.error('Erreur suppression') }
  }

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Module</h2>
        <div style={{ width: 40, height: 3, background: '#2563eb', borderRadius: 2, marginTop: 4 }} />
      </div>

      {/* Form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">{editing ? 'Modifier le module' : 'Nouveau module'}</span>
          {editing && <button className="btn btn-secondary btn-sm" onClick={reset}>Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Code :</label>
                <input className="form-control" value={form.code_module} onChange={e => setForm(p => ({ ...p, code_module: e.target.value }))} required disabled={!!editing} placeholder="Ex: ACAD" />
              </div>
              <div className="form-group">
                <label className="form-label">Nom :</label>
                <input className="form-control" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} required placeholder="Nom du module" />
              </div>
              <div className="form-group">
                <label className="form-label">Description :</label>
                <input className="form-control" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              {editing ? '💾 Mettre à jour' : '➕ Enregistrer'}
            </button>
          </form>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Liste des module(s)</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{modules.length} module(s)</div>
          </div>
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder="Mot à rechercher..." value={search} onChange={handleSearch} />
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-center"><div className="spinner" />Chargement…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Nom</th><th>Description</th><th>Éditeur</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {modules.length === 0 ? (
                  <tr><td colSpan={5} className="text-center" style={{ padding: 30, color: '#94a3b8' }}>Aucun module trouvé</td></tr>
                ) : modules.map(m => (
                  <tr key={m.code_module}>
                    <td><b>{m.code_module}</b></td>
                    <td>{m.nom}</td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{m.description}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{m.editeur}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn-icon edit" onClick={() => handleEdit(m)} title="Modifier">✏️</button>
                        <button className="btn-icon delete" onClick={() => handleDelete(m.code_module)} title="Supprimer">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

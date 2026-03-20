import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX } from '../../components/icons'

interface Module {
  code_module: string
  nom: string
  description: string
  editeur: string
}

const EMPTY = { code_module: '', nom: '', description: '' }

export default function ModuleTab() {
  const [modules,  setModules]  = useState<Module[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [editing,  setEditing]  = useState<Module | null>(null)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)

  const load = async (q = '') => {
    setLoading(true)
    try {
      const r = await api.get('/modules', { params: { search: q } })
      setModules(r.data.data)
    } catch { toast.error('Erreur chargement des modules') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const reset = () => { setForm(EMPTY); setEditing(null) }

  const handleEdit = (m: Module) => {
    setEditing(m)
    setForm({ code_module: m.code_module, nom: m.nom, description: m.description || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/modules/${editing.code_module}`, form)
        toast.success('Module mis à jour')
      } else {
        await api.post('/modules', form)
        toast.success('Module créé avec succès')
      }
      reset(); load(search)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur')
    } finally { setSaving(false) }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(`Supprimer le module "${code}" ?`)) return
    try { await api.delete(`/modules/${code}`); toast.success('Module supprimé'); load(search) }
    catch { toast.error('Erreur suppression') }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const filtered = modules.filter(m =>
    m.code_module.toLowerCase().includes(search.toLowerCase()) ||
    m.nom.toLowerCase().includes(search.toLowerCase())
  )

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
        {/* ── Formulaire ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">{editing ? 'Modifier le module' : 'Nouveau module'}</span>
            {editing && (
              <button className="btn btn-secondary btn-sm" onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <IcoX /> Annuler
              </button>
            )}
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Code <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-control" value={form.code_module}
                    onChange={set('code_module')} required
                    disabled={!!editing} placeholder="Ex: ACAD" />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-control" value={form.nom}
                    onChange={set('nom')} required placeholder="Nom du module" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="form-control" value={form.description}
                    onChange={set('description')} placeholder="Description" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                disabled={saving}>
                {saving
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Enregistrement…</>
                  : editing
                    ? <><IcoSave /> Mettre à jour</>
                    : <><IcoPlus /> Enregistrer</>
                }
              </button>
            </form>
          </div>
        </div>

        {/* ── Liste ── */}
        <div className="card">
          <div className="card-header">
            <div className="section-info">
              <div className="section-title">Liste des module(s)</div>
              <div className="section-count">{filtered.length} module(s)</div>
            </div>
            <div className="search-bar">
              <IcoSearch />
              <input placeholder="Mot à rechercher..."
                value={search}
                onChange={e => { setSearch(e.target.value); load(e.target.value) }} />
            </div>
          </div>
          <div className="table-wrapper">
            {loading ? (
              <div className="loading-center"><div className="spinner" /> Chargement…</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Code</th><th>Nom</th><th>Description</th><th>Éditeur</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5}>
                      <div className="empty-state">Aucun module trouvé</div>
                    </td></tr>
                  ) : filtered.map(m => (
                    <tr key={m.code_module}>
                      <td><span className="badge badge-info">{m.code_module}</span></td>
                      <td style={{ fontWeight: 600 }}>{m.nom}</td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{m.description || '—'}</td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{m.editeur}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn-icon edit" onClick={() => handleEdit(m)} title="Modifier"><IcoEdit /></button>
                          <button className="btn-icon delete" onClick={() => handleDelete(m.code_module)} title="Supprimer"><IcoTrash /></button>
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
    </div>
  )
}
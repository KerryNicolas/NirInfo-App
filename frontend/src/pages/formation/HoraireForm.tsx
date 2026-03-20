import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

interface Horaire {
  code_horaire: string
  designation: string
  horaire: string
  remarque: string
  editeur: string
}

const EMPTY = { code_horaire: '', designation: '', horaire: '', remarque: '' }

export default function HoraireForm() {
  const [horaires, setHoraires] = useState<Horaire[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [editing,  setEditing]  = useState<Horaire | null>(null)
  const [form,     setForm]     = useState(EMPTY)

  const load = async (q = '') => {
    setLoading(true)
    try {
      const r = await api.get('/horaires', { params: { search: q } })
      setHoraires(r.data.data)
    } catch { toast.error('Erreur chargement des horaires') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const reset = () => { setForm(EMPTY); setEditing(null) }

  const handleEdit = (h: Horaire) => {
    setEditing(h)
    setForm({ code_horaire: h.code_horaire, designation: h.designation, horaire: h.horaire, remarque: h.remarque || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await api.put(`/horaires/${editing.code_horaire}`, form)
        toast.success('Horaire mis à jour')
      } else {
        await api.post('/horaires', form)
        toast.success('Horaire créé')
      }
      reset(); load(search)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur')
    }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(`Supprimer l'horaire "${code}" ?`)) return
    try { await api.delete(`/horaires/${code}`); toast.success('Supprimé'); load(search) }
    catch { toast.error('Erreur suppression') }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <>
      {/* ── Formulaire ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{editing ? 'Modifier l\'horaire' : 'Nouvel horaire'}</span>
          {editing && (
            <button className="btn btn-secondary btn-sm" onClick={reset}>✕ Annuler</button>
          )}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Code :</label>
                <input className="form-control" value={form.code_horaire} onChange={set('code_horaire')}
                  required disabled={!!editing} placeholder="Ex: MAT" />
              </div>
              <div className="form-group">
                <label className="form-label">Désignation :</label>
                <input className="form-control" value={form.designation} onChange={set('designation')}
                  required placeholder="Ex: Matin" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Horaire :</label>
              <input className="form-control" value={form.horaire} onChange={set('horaire')}
                required placeholder="Ex: Lundi au vendredi de 8h à 12h" />
            </div>
            <div className="form-group">
              <label className="form-label">Remarque :</label>
              <textarea className="form-control" value={form.remarque} onChange={set('remarque')} rows={2} />
            </div>
            <button type="submit" className="btn btn-primary">
              {editing ? '💾 Mettre à jour' : '➕ Enregistrer'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Liste ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Liste des horaire(s)</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{horaires.length} horaire(s)</div>
          </div>
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder="Mot à rechercher..." value={search}
              onChange={e => { setSearch(e.target.value); load(e.target.value) }} />
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-center"><div className="spinner" />Chargement…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Désignation</th><th>Description</th><th>Remarque</th><th>Éditeur</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {horaires.length === 0 ? (
                  <tr><td colSpan={6} className="text-center" style={{ padding: 30, color: '#94a3b8' }}>Aucun horaire trouvé</td></tr>
                ) : horaires.map(h => (
                  <tr key={h.code_horaire}>
                    <td><b>{h.code_horaire}</b></td>
                    <td>{h.designation}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{h.horaire}</td>
                    <td style={{ fontSize: 12 }}>{h.remarque}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{h.editeur}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn-icon edit" onClick={() => handleEdit(h)} title="Modifier">✏️</button>
                        <button className="btn-icon delete" onClick={() => handleDelete(h.code_horaire)} title="Supprimer">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

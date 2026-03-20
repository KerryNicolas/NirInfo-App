import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { IcoPlus } from '../../components/icons'

interface Horaire {
  code_horaire: string
  designation: string
  horaire: string
  remarque: string
  editeur?: string
}

const DEFAULT_HORAIRES: Horaire[] = [
  { code_horaire: 'MAT', designation: 'Matin',          horaire: 'Lundi–Vendredi  07h30–12h00', remarque: '', editeur: '' },
  { code_horaire: 'APM', designation: 'Après-midi',     horaire: 'Lundi–Vendredi  13h00–17h30', remarque: '', editeur: '' },
  { code_horaire: 'SS',  designation: 'Soir semaine',   horaire: 'Lundi–Vendredi  18h00–21h00', remarque: '', editeur: '' },
  { code_horaire: 'WE',  designation: 'Week-end matin', horaire: 'Sam–Dim         08h00–12h00', remarque: '', editeur: '' },
  { code_horaire: 'WES', designation: 'Week-end soir',  horaire: 'Sam–Dim         13h00–17h00', remarque: '', editeur: '' },
  { code_horaire: 'INT', designation: 'Intensif',       horaire: 'Tous les jours  08h00–17h00', remarque: '', editeur: '' },
]

const EMPTY = { code_horaire: '', designation: '', horaire: '', remarque: '' }

export default function HoraireForm() {
  const [horaires, setHoraires] = useState<Horaire[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false) // 1. Déclaration de l'état saving
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
    setForm({ 
      code_horaire: h.code_horaire, 
      designation: h.designation, 
      horaire: h.horaire, 
      remarque: h.remarque || '' 
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value
    const preset = DEFAULT_HORAIRES.find(h => h.code_horaire === code)
    if (preset) {
      setForm(p => ({ 
        ...p, 
        code_horaire: preset.code_horaire, 
        designation: preset.designation,
        horaire: preset.horaire 
      }))
    }
  }

  // 2. Utilisation de saving dans le handleSubmit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true) // Active l'état de chargement
    try {
      if (editing) {
        await api.put(`/horaires/${editing.code_horaire}`, form)
        toast.success('Horaire mis à jour')
      } else {
        await api.post('/horaires', form)
        toast.success('Horaire créé')
      }
      reset()
      load(search)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false) // Désactive le chargement quoi qu'il arrive
    }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(`Supprimer l'horaire "${code}" ?`)) return
    try { 
      await api.delete(`/horaires/${code}`)
      toast.success('Supprimé')
      load(search) 
    } catch { toast.error('Erreur suppression') }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{editing ? 'Modifier l\'horaire' : 'Nouvel horaire'}</span>
          {editing && <button className="btn btn-secondary btn-sm" onClick={reset}>✕ Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Modèles prédéfinis :</label>
                <select className="form-control" onChange={handleSelectPreset} value={form.code_horaire}>
                  <option value="">-- Utiliser un modèle --</option>
                  {DEFAULT_HORAIRES.map(d => (
                    <option key={d.code_horaire} value={d.code_horaire}>{d.designation}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row" style={{ marginTop: 15 }}>
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
              <label className="form-label">Description de l'horaire :</label>
              <input className="form-control" value={form.horaire} onChange={set('horaire')}
                required placeholder="Ex: Lundi-Vendredi 08h-12h" />
            </div>

            <div className="form-group">
              <label className="form-label">Remarque :</label>
              <textarea className="form-control" value={form.remarque} onChange={set('remarque')} rows={2} />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }} 
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> 
                  Enregistrement…
                </>
              ) : (
                <>
                  <IcoPlus /> {editing ? 'Mettre à jour' : 'Enregistrer'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Liste des horaire(s)</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{horaires.length} horaire(s)</div>
          </div>
          <div className="search-bar">
            <input 
              placeholder="Rechercher..." 
              value={search}
              onChange={e => { setSearch(e.target.value); load(e.target.value) }} 
            />
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-center"><div className="spinner" />Chargement…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Désignation</th><th>Description</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {horaires.map(h => (
                  <tr key={h.code_horaire}>
                    <td><b>{h.code_horaire}</b></td>
                    <td>{h.designation}</td>
                    <td>{h.horaire}</td>
                    <td>
                      <button className="btn-icon edit" onClick={() => handleEdit(h)}>✏️</button>
                      <button className="btn-icon delete" onClick={() => handleDelete(h.code_horaire)}>🗑️</button>
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
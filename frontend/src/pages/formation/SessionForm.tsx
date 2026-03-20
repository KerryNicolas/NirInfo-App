import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

interface Session {
  code_session: string
  date_debut: string
  date_fin: string
  date_echeance: string
  horaire_description: string
  frais_formation: number
  module_nom: string
  editeur: string
  formateur_nom: string
  lieu: string
}

interface Horaire { code_horaire: string; designation: string; horaire: string }
interface Module  { code_module: string; nom: string }

const EMPTY = {
  date_debut: '', date_fin: '', date_echeance: '',
  code_horaire: '', code_module: '', frais_formation: '',
  lieu: 'Ampandrana', id_formateur: ''
}

export default function SessionForm() {
  const [sessions,   setSessions]   = useState<Session[]>([])
  const [horaires,   setHoraires]   = useState<Horaire[]>([])
  const [modules,    setModules]    = useState<Module[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [form,       setForm]       = useState(EMPTY)

  const load = async (q = '') => {
    setLoading(true)
    try {
      const [sr, hr, mr] = await Promise.all([
        api.get('/sessions',  { params: { search: q } }),
        api.get('/horaires'),
        api.get('/modules'),
      ])
      setSessions(sr.data.data)
      setHoraires(hr.data.data)
      setModules(mr.data.data)
    } catch { toast.error('Erreur chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/sessions', { ...form, id_formateur: form.id_formateur || 1 })
      toast.success('Session créée avec succès')
      setForm(EMPTY)
      load(search)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la création')
    }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(`Supprimer la session "${code}" ?`)) return
    try { await api.delete(`/sessions/${code}`); toast.success('Session supprimée'); load(search) }
    catch { toast.error('Erreur suppression') }
  }

  return (
    <>
      {/* ── Formulaire ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Nouvelle session</span>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date de début :</label>
                <input className="form-control" type="date" value={form.date_debut} onChange={set('date_debut')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Date de fin :</label>
                <input className="form-control" type="date" value={form.date_fin} onChange={set('date_fin')} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date d'échéance :</label>
                <input className="form-control" type="date" value={form.date_echeance} onChange={set('date_echeance')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Horaire :</label>
                <select className="form-control" value={form.code_horaire} onChange={set('code_horaire')} required>
                  <option value="">-- Choisir un horaire --</option>
                  {horaires.map(h => (
                    <option key={h.code_horaire} value={h.code_horaire}>{h.designation} — {h.horaire}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Module :</label>
                <select className="form-control" value={form.code_module} onChange={set('code_module')} required>
                  <option value="">-- Choisir un module --</option>
                  {modules.map(m => (
                    <option key={m.code_module} value={m.code_module}>{m.nom}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Frais de formation :</label>
                <input className="form-control" type="number" value={form.frais_formation} onChange={set('frais_formation')} required placeholder="Ex: 100000" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Lieu :</label>
                <select className="form-control" value={form.lieu} onChange={set('lieu')}>
                  <option>Ampandrana</option>
                  <option>Ampefiloha</option>
                  <option>Andravoahangy</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ID Formateur :</label>
                <input className="form-control" type="number" value={form.id_formateur} onChange={set('id_formateur')} placeholder="Ex: 4" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">➕ Enregistrer</button>
          </form>
        </div>
      </div>

      {/* ── Liste ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Liste des session(s)</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{sessions.length} session(s)</div>
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
                  <th>Code</th><th>Début</th><th>Fin</th><th>Échéance</th>
                  <th>Horaire</th><th>Frais</th><th>Module</th><th>Formateur</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr><td colSpan={9} className="text-center" style={{ padding: 30, color: '#94a3b8' }}>Aucune session trouvée</td></tr>
                ) : sessions.map(s => (
                  <tr key={s.code_session}>
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{s.code_session}</td>
                    <td style={{ fontSize: 12 }}>{s.date_debut}</td>
                    <td style={{ fontSize: 12 }}>{s.date_fin}</td>
                    <td style={{ fontSize: 12 }}>{s.date_echeance}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{s.horaire_description}</td>
                    <td style={{ fontWeight: 600, color: '#16a34a', whiteSpace: 'nowrap' }}>
                      {Number(s.frais_formation).toLocaleString('fr')} Ar
                    </td>
                    <td><span className="badge badge-info">{s.module_nom}</span></td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{s.formateur_nom}</td>
                    <td>
                      <button className="btn-icon delete" onClick={() => handleDelete(s.code_session)} title="Supprimer">🗑️</button>
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

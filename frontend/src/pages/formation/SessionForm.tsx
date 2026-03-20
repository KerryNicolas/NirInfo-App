import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { IcoPlus, IcoTrash, IcoSearch } from '../../components/icons'

interface Session {
  code_session: string; date_debut: string; date_fin: string
  date_echeance: string; horaire_description: string
  frais_formation: number; module_nom: string
  editeur: string; formateur_nom: string; lieu: string
}
interface Horaire { code_horaire: string; designation: string; horaire: string }
interface Module  { code_module: string; nom: string }

const EMPTY = {
  date_debut: '', date_fin: '', date_echeance: '',
  code_horaire: '', code_module: '', frais_formation: '',
  lieu: 'Ampandrana', id_formateur: ''
}

const DEFAULT_HORAIRES: Horaire[] = [
  { code_horaire: 'MAT', designation: 'Matin',          horaire: 'Lundi–Vendredi  07h30–12h00' },
  { code_horaire: 'APM', designation: 'Après-midi',     horaire: 'Lundi–Vendredi  13h00–17h30' },
  { code_horaire: 'SS',  designation: 'Soir semaine',   horaire: 'Lundi–Vendredi  18h00–21h00' },
  { code_horaire: 'WE',  designation: 'Week-end matin', horaire: 'Sam–Dim         08h00–12h00' },
  { code_horaire: 'WES', designation: 'Week-end soir',  horaire: 'Sam–Dim         13h00–17h00' },
  { code_horaire: 'INT', designation: 'Intensif',       horaire: 'Tous les jours  08h00–17h00' },
]

export default function SessionForm() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [horaires, setHoraires] = useState<Horaire[]>([])
  const [modules,  setModules]  = useState<Module[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)

  const load = async (q = '') => {
    setLoading(true)
    try {
      const [sr, hr, mr] = await Promise.all([
        api.get('/sessions',  { params: { search: q } }),
        api.get('/horaires'),
        api.get('/modules'),
      ])
      setSessions(sr.data.data ?? [])
      const apiHoraires = hr.data.data ?? []
      setHoraires(apiHoraires)
      setModules(mr.data.data ?? [])
    } catch {
      // Silencieux
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Fusion horaires API + defaults sans doublons
  const allHoraires = [
    ...horaires,
    ...DEFAULT_HORAIRES.filter(d => !horaires.find(h => h.code_horaire === d.code_horaire))
  ]

  const selectedHoraire = allHoraires.find(h => h.code_horaire === form.code_horaire)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/sessions', { ...form, id_formateur: form.id_formateur || 1 })
      toast.success('Session créée avec succès')
      setForm(EMPTY); load(search)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la création')
    } finally { setSaving(false) }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(`Supprimer la session "${code}" ?`)) return
    try { await api.delete(`/sessions/${code}`); toast.success('Session supprimée'); load(search) }
    catch { toast.error('Erreur lors de la suppression') }
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Nouvelle session</span>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date de début <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" type="date" value={form.date_debut} onChange={set('date_debut')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Date de fin <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" type="date" value={form.date_fin} onChange={set('date_fin')} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date d'échéance <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" type="date" value={form.date_echeance} onChange={set('date_echeance')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Horaire <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="form-control" value={form.code_horaire} onChange={set('code_horaire')} required>
                  <option value="">-- Choisir un horaire --</option>
                  {horaires.filter(h => !DEFAULT_HORAIRES.find(d => d.code_horaire === h.code_horaire)).length > 0 && (
                    <optgroup label="Horaires personnalisés">
                      {horaires
                        .filter(h => !DEFAULT_HORAIRES.find(d => d.code_horaire === h.code_horaire))
                        .map(h => (
                          <option key={h.code_horaire} value={h.code_horaire}>
                            {h.designation} — {h.horaire}
                          </option>
                        ))}
                    </optgroup>
                  )}
                    {allHoraires
                      .filter(h => DEFAULT_HORAIRES.find(d => d.code_horaire === h.code_horaire))
                      .map(h => (
                        <option key={h.code_horaire} value={h.code_horaire}>
                          {h.designation} — {h.horaire}
                        </option>
                      ))}
                </select>
                {selectedHoraire && (
                  <div style={{
                    marginTop: 6, padding: '6px 10px',
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: 7, fontSize: 12, color: '#1d4ed8',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {selectedHoraire.horaire}
                  </div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Module <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="form-control" value={form.code_module} onChange={set('code_module')} required>
                    <input className="form-control" value={form.code_module} onChange={set('code_module')}
                       placeholder="-- Choisir une module --" />
                     <option>-- Choisir une module --</option>
                     <option>Autocad 2D et 3D</option>
                     <option>Access</option>
                     <option>Administration réseau</option>
                     <option>Illustrator</option>
                     <option>Excel avancé</option>
                     <option>Electricité batiment</option>
                     <option>Framework MVC</option>
                     <option>Graphic design complet</option>
          </select>
              </div>
              <div className="form-group">
                <label className="form-label">Frais de formation (Ar) <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" type="number" value={form.frais_formation}
                  onChange={set('frais_formation')} required placeholder="Ex: 100000" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Lieu <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="form-control" value={form.lieu} onChange={set('lieu')}>
                  <input className="form-control" value={form.lieu} onChange={set('lieu')}
                     placeholder="-- Choisir un lieu --" />
                  <option>Ampandrana</option>
                  <option>Ampefiloha</option>
                  <option>Andravoahangy</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ID Formateur<span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" type="number" value={form.id_formateur}
                  onChange={set('id_formateur')} placeholder="Ex: 4" />
              </div>
            </div>

            <button type="submit" className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={saving}>
              {saving
                ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Enregistrement…</>
                : <><IcoPlus /> Enregistrer</>
              }
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-info">
            <div className="section-title">Liste des session(s)</div>
            <div className="section-count">{sessions.length} session(s)</div>
          </div>
          <div className="search-bar">
            <IcoSearch />
            <input placeholder="Mot à rechercher..."
              value={search} onChange={e => { setSearch(e.target.value); load(e.target.value) }} />
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-center"><div className="spinner" /> Chargement…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Début</th><th>Fin</th><th>Échéance</th>
                  <th>Horaire</th><th>Frais</th><th>Module</th><th>Lieu</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr><td colSpan={9}><div className="empty-state">Aucune session trouvée</div></td></tr>
                ) : sessions.map(s => (
                  <tr key={s.code_session}>
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{s.code_session}</td>
                    <td style={{ fontSize: 12 }}>{s.date_debut}</td>
                    <td style={{ fontSize: 12 }}>{s.date_fin}</td>
                    <td style={{ fontSize: 12 }}>{s.date_echeance}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{s.horaire_description}</td>
                    <td style={{ fontWeight: 600, color: '#16a34a', whiteSpace: 'nowrap' }}>
                      {fmt(s.frais_formation)} Ar
                    </td>
                    <td><span className="badge badge-info">{s.module_nom}</span></td>
                    <td style={{ fontSize: 12 }}>{s.lieu}</td>
                    <td>
                      <button className="btn-icon delete" onClick={() => handleDelete(s.code_session)}>
                        <IcoTrash />
                      </button>
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
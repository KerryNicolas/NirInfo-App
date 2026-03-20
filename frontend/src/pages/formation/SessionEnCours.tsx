import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

interface SessionEnCours {
  code_session: string
  date_debut: string
  date_fin: string
  date_echeance: string
  horaire_description: string
  frais_formation: number
  module_nom: string
  nb_inscrits: number
  editeur: string
  formateur_nom: string
  lieu: string
}

interface Module { code_module: string; nom: string }

export default function SessionEnCours() {
  const [sessions, setSessions] = useState<SessionEnCours[]>([])
  const [modules,  setModules]  = useState<Module[]>([])
  const [loading,  setLoading]  = useState(true)
  const [lieu,     setLieu]     = useState('Tous')
  const [module,   setModule]   = useState('Tous')

  const load = async (l = lieu, m = module) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (l !== 'Tous') params.lieu   = l
      if (m !== 'Tous') params.module = m
      const [sr, mr] = await Promise.all([
        api.get('/sessions/en-cours', { params }),
        api.get('/modules'),
      ])
      setSessions(sr.data.data)
      setModules(mr.data.data)
    } catch { toast.error('Erreur chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSearch = () => load(lieu, module)

  const exportCSV = () => {
    const header = ['Code','Début','Fin','Échéance','Horaire','Frais','Module','Inscrits','Lieu','Formateur']
    const rows = sessions.map(s => [
      s.code_session, s.date_debut, s.date_fin, s.date_echeance,
      s.horaire_description, String(s.frais_formation),
      s.module_nom, String(s.nb_inscrits), s.lieu, s.formateur_nom,
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a   = document.createElement('a')
    a.href    = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'sessions_en_cours.csv'
    a.click()
  }

  const totalInscrits = sessions.reduce((a, s) => a + Number(s.nb_inscrits), 0)

  return (
    <div className="card">
      {/* ── Filtres ── */}
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="card-title">Liste des session(s) en cours</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{totalInscrits} étudiant(s) inscrit(s)</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>Lieu :</label>
            <select className="form-control" style={{ width: 160 }} value={lieu}
              onChange={e => setLieu(e.target.value)}>
              <option value="Tous">Tous</option>
              <option>Ampandrana</option>
              <option>Ampefiloha</option>
              <option>Andravoahangy</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>Modules :</label>
            <select className="form-control" style={{ width: 200 }} value={module}
              onChange={e => setModule(e.target.value)}>
              <option value="Tous">Tous</option>
              {modules.map(m => (
                <option key={m.code_module} value={m.code_module}>{m.nom}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSearch}>🔍 Rechercher</button>
          <button className="btn btn-success btn-sm" onClick={exportCSV}>📥 Exporter</button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="table-wrapper">
        {loading ? (
          <div className="loading-center"><div className="spinner" />Chargement…</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Début</th><th>Fin</th><th>Échéance</th>
                <th>Horaire</th><th>Frais</th><th>Module</th>
                <th>Inscrits</th><th>Éditeur</th><th>Formateur</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center" style={{ padding: 40, color: '#94a3b8' }}>
                    Aucune session en cours
                  </td>
                </tr>
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
                  <td className="text-center">
                    <span className="badge badge-success">{s.nb_inscrits}</span>
                  </td>
                  <td style={{ fontSize: 11, color: '#64748b' }}>{s.editeur}</td>
                  <td style={{ fontSize: 11, color: '#64748b' }}>{s.formateur_nom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

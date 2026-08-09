import { useEffect, useState } from 'react'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../../hooks/useTable'
import Pagination from '../../../components/Pagination'

interface SessionEnCours {
  code_session: string; date_debut: string; date_fin: string
  date_echeance: string; horaire_description: string
  frais_formation: number; module_nom: string
  nb_inscrits: number; formateur_nom: string
}
interface Module { code_module: string; nom: string }

const IcoSearch  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoExcel   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
const IcoRefresh = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>

export default function SessionEnCours() {
  const [modules,  setModules]  = useState<Module[]>([])
  const [module,   setModule]   = useState('Tous')

  // useTable avec params filtre module dynamique
  const table = useTable<SessionEnCours>('/sessions/en-cours', {
    perPage: 15,
    params: module !== 'Tous' ? { module } : {},
  })

  // Charger modules pour le select
  useEffect(() => {
    api.get('/modules', { params: { per_page: 200 } })
      .then(r => setModules(Array.isArray(r.data) ? r.data : (r.data.data ?? [])))
      .catch(() => {})
  }, [])

  const handleSearch = () => {
    table.reload()
  }

  const handleReset = () => {
    setModule('Tous')
    table.reset()
  }

  const exportCSV = () => {
    if (table.data.length === 0) { toast.error('Aucune donnée à exporter'); return }
    const header = ['Code','Début','Fin','Échéance','Horaire','Frais','Module','Inscrits','Formateur']
    const rows   = table.data.map(s => [s.code_session, s.date_debut, s.date_fin, s.date_echeance, s.horaire_description, String(s.frais_formation), s.module_nom, String(s.nb_inscrits), s.formateur_nom])
    const csv    = [header, ...rows].map(r => r.map(v => `"${v??''}"`).join(',')).join('\n')
    const a      = document.createElement('a')
    a.href       = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' }))
    a.download   = 'sessions_en_cours.csv'
    a.click()
    toast.success('Export CSV téléchargé')
  }

  const totalInscrits = table.data.reduce((a, s) => a + Number(s.nb_inscrits), 0)
  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap:'wrap', gap:12 }}>
        <div>
          <div className="card-title">Sessions en cours</div>
          <div className="section-count">{totalInscrits} étudiant(s) inscrit(s) — {table.meta.total} session(s)</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* Recherche texte */}
          <div className="search-bar" style={{ minWidth:200 }}>
            <IcoSearch />
            <input placeholder="Rechercher..." value={table.search} onChange={e => table.setSearch(e.target.value)} />
          </div>
          {/* Filtre module */}
          <select className="form-control" style={{ width:200, padding:'5px 10px' }} value={module} onChange={e => setModule(e.target.value)}>
            <option value="Tous">Tous les modules</option>
            {modules.map(m => <option key={m.code_module} value={m.code_module}>{m.nom}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" style={{ display:'flex', alignItems:'center', gap:5 }} onClick={handleSearch}>
            <IcoSearch /> Filtrer
          </button>
          <button className="btn btn-secondary btn-sm" style={{ display:'flex', alignItems:'center', gap:5 }} onClick={handleReset}>
            <IcoRefresh /> Réinitialiser
          </button>
          <button className="btn btn-success btn-sm" style={{ display:'flex', alignItems:'center', gap:5 }} onClick={exportCSV}>
            <IcoExcel /> Export
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        {table.loading ? (
          <div className="loading-center"><div className="spinner" /> Chargement…</div>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Code session</th><th>Début</th><th>Fin</th><th>Échéance</th><th>Horaire</th><th>Frais</th><th>Module</th><th>Inscrits</th><th>Formateur</th></tr>
            </thead>
            <tbody>
              {table.data.length === 0 ? (
                <tr><td colSpan={10}><div className="empty-state">Aucune session en cours</div></td></tr>
              ) : table.data.map((s, idx) => (
                <tr key={s.code_session}>
                  <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                  <td style={{ fontWeight:500, fontSize:12 }}>{s.code_session}</td>
                  <td style={{ fontSize:12 }}>{s.date_debut}</td>
                  <td style={{ fontSize:12 }}>{s.date_fin}</td>
                  <td style={{ fontSize:12 }}>{s.date_echeance}</td>
                  <td style={{ fontSize:12, color:'#64748b' }}>{s.horaire_description}</td>
                  <td style={{ fontWeight:600, color:'#16a34a', whiteSpace:'nowrap' }}>{fmt(s.frais_formation)} Ar</td>
                  <td><span className="badge badge-info">{s.module_nom}</span></td>
                  <td className="text-center"><span className="badge badge-success">{s.nb_inscrits}</span></td>
                  <td style={{ fontSize:11, color:'#64748b' }}>{s.formateur_nom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ← Pagination avec boutons Préc. et Suiv. ← */}
      {!table.loading && table.meta.total > 0 && (
        <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />
      )}
    </div>
  )
}
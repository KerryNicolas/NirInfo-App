import { useState, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import Pagination from '../components/Pagination'

interface Echeance {
  id_paiement: number; date_echeance: string; matricule: string
  nom: string; prenom: string; code_session: string
  montant_paye: number; reste: number; editeur: string
}

const today = new Date().toISOString().split('T')[0]

const IcoClock  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const IcoSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoExcel  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
const IcoDollar = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>

export default function EcheancePage() {
  const [date, setDate]             = useState(today)
  const [activeParams, setActiveParams] = useState<Record<string,string>>({})
  const [totalAPercevoir, setTotalAPercevoir] = useState(0)
  const [searched, setSearched]     = useState(false)

  const table = useTable<Echeance>('/echeances', {
    perPage: 15,
    params: activeParams,
    autoLoad: false,
  })

  const handleSearch = useCallback(async () => {
    const params: Record<string,string> = {}
    if (date) params.date = date

    setSearched(true)

    // Récupérer le total avant pagination
    try {
      const r = await api.get('/echeances', { params: { ...params, per_page: 15, page: 1 } })
      setTotalAPercevoir(r.data.total_a_percevoir ?? 0)
    } catch { setTotalAPercevoir(0) }

    setActiveParams(params)
    setTimeout(() => table.reload(), 50)
  }, [date, table])

  const exportExcel = () => {
    if (table.data.length === 0) { toast.error('Aucune donnée à exporter'); return }
    const header = ["Date d'échéance",'Matricule','Nom','Prénom','Session','Montant payé','Reste','Éditeur']
    const data   = table.data.map(r => [r.date_echeance, r.matricule, r.nom, r.prenom, r.code_session, String(r.montant_paye), String(r.reste), r.editeur])
    const csv    = [header, ...data].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n')
    const a      = document.createElement('a')
    a.href       = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' }))
    a.download   = `echeance_${date}.csv`
    a.click(); toast.success('Export téléchargé')
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <div className="app-layout">
      <Sidebar section="formation" />
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display:'flex', alignItems:'center', gap:8 }}><IcoClock /> Echéance</span>
        </div>

        <div style={{ padding:24 }}>

          {/* Filtre */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header">
              <span className="card-title" style={{ display:'flex', alignItems:'center', gap:6 }}><IcoClock /> Recherche par date d'échéance</span>
            </div>
            <div className="card-body">
              <div style={{ display:'flex', alignItems:'flex-end', gap:12, flexWrap:'wrap' }}>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Date limite d'échéance</label>
                  <input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <button className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={handleSearch} disabled={table.loading}>
                  {table.loading ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Chargement…</> : <><IcoSearch /> Rechercher</>}
                </button>
                <button className="btn btn-success" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={exportExcel}>
                  <IcoExcel /> Export Excel
                </button>
              </div>
            </div>
          </div>

          {/* Total à percevoir — toute la sélection */}
          {searched && (
            <div style={{ background:'white', borderRadius:12, padding:'16px 24px', marginBottom:20, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:44, height:44, borderRadius:11, background:'#fef3c7', color:'#b45309', display:'flex', alignItems:'center', justifyContent:'center' }}><IcoDollar /></div>
              <div>
                <p style={{ fontSize:12, color:'#64748b', marginBottom:2 }}>Montant total à percevoir (toute la sélection)</p>
                <p style={{ fontSize:24, fontWeight:800, color:'#b45309' }}>{fmt(totalAPercevoir)} Ar</p>
              </div>
              <div style={{ marginLeft:'auto' }}>
                <span className="badge badge-warning">{table.meta.total} échéance(s)</span>
              </div>
            </div>
          )}

          {/* Tableau avec pagination LIFO */}
          <div className="card">
            <div className="card-header">
              <div className="section-info">
                <div className="section-title">Liste des échéances</div>
                <div className="section-count">{table.meta.total} échéance(s)</div>
              </div>
              {/* Recherche texte dans les résultats */}
              {searched && (
                <div className="search-bar">
                  <IcoSearch />
                  <input placeholder="Filtrer par nom, matricule..." value={table.search} onChange={e => table.setSearch(e.target.value)} />
                </div>
              )}
            </div>
            <div className="table-wrapper">
              {table.loading ? (
                <div className="loading-center"><div className="spinner" /> Chargement…</div>
              ) : (
                <table>
                  <thead>
                    <tr><th>#</th><th>Date d'échéance</th><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Session</th><th>Montant payé</th><th>Reste</th><th>Éditeur</th></tr>
                  </thead>
                  <tbody>
                    {table.data.length === 0 ? (
                      <tr><td colSpan={9}>
                        <div className="empty-state">
                          {searched ? 'Aucune échéance pour cette date' : 'Sélectionnez une date et cliquez sur Rechercher'}
                        </div>
                      </td></tr>
                    ) : table.data.map((r, i) => (
                      <tr key={r.id_paiement}>
                        <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+i+1}</td>
                        <td style={{ fontSize:12 }}>{r.date_echeance}</td>
                        <td><span className="badge badge-info">{r.matricule}</span></td>
                        <td style={{ fontWeight:600 }}>{r.nom}</td>
                        <td>{r.prenom}</td>
                        <td style={{ fontSize:12, color:'#64748b' }}>{r.code_session}</td>
                        <td style={{ fontWeight:600, color:'#16a34a' }}>{fmt(r.montant_paye)} Ar</td>
                        <td>
                          <span className={`badge ${Number(r.reste)===0?'badge-success':'badge-danger'}`}>{fmt(r.reste)} Ar</span>
                        </td>
                        <td style={{ fontSize:11, color:'#64748b' }}>{r.editeur}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {/* ← Pagination avec Préc. et Suiv. ← */}
            {!table.loading && table.meta.total > 0 && (
              <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
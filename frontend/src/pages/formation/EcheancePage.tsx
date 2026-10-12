import { useState, useCallback } from 'react'
import Sidebar from '../../components/Sidebar'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { IcoSearch, IcoClock, IcoExcel, IcoDollar, IcoX } from '../../components/icons'


interface Echeance {
  id_paiement: number; date_echeance: string; matricule: string
  nom: string; prenom: string; code_session: string
  montant_paye: number; reste: number; editeur: string
}

const today = new Date().toISOString().split('T')[0]
const fmt2 = (n: number) => Number(n).toLocaleString('fr')

// ── Modal de détail — même pattern que le reste de l'appli (Étudiant, Inscription...) ──
function DetailModal({ r, onClose }: { r: Echeance; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Date d\'échéance', r.date_echeance || '—'],
    ['Matricule', r.matricule],
    ['Étudiant', `${r.nom} ${r.prenom}`],
    ['Session', r.code_session],
    ['Montant payé', `${fmt2(r.montant_paye)} Ar`],
    ['Reste', `${fmt2(r.reste)} Ar`],
    ['Éditeur', r.editeur?.trim() || '—'],
  ]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:460, background:'white', borderRadius:12, padding:24 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>Détail de l'échéance</span>
          <button onClick={onClose} className="btn-icon"><IcoX /></button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'8px 14px', fontSize:14 }}>
          {rows.map(([label, val]) => (
            <div key={label} style={{ display:'contents' }}>
              <span style={{ color:'#64748b' }}>{label} :</span>
              <span style={{ fontWeight:500 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function EcheancePage() {
  const [date, setDate]             = useState(today)
  const [totalAPercevoir, setTotalAPercevoir] = useState(0)
  const [searched, setSearched]     = useState(false)
  const [viewing, setViewing]       = useState<Echeance | null>(null)

  // FIX : plus de "params: activeParams" ici — ce champ n'est lu qu'au montage par
  // useTable, il ne réagit jamais à un changement de state côté page (c'était la
  // cause du bug : le filtre "date" ne parvenait jamais réellement au hook).
  const table = useTable<Echeance>('/echeances', {
    perPage: 15,
    autoLoad: false,
  })

  const handleSearch = useCallback(async () => {
    const params: Record<string,string> = {}
    if (date) params.date = date

    setSearched(true)
    // FIX : setParams() est la méthode du hook faite pour ça — elle met à jour le
    // filtre EN INTERNE et déclenche le bon fetch, contrairement à l'ancien
    // setActiveParams() + setTimeout(reload) qui ne synchronisaient rien.
    table.setParams(params)

    try {
      const r = await api.get('/echeances', { params: { ...params, per_page: 15, page: 1 } })
      setTotalAPercevoir(r.data.total_a_percevoir ?? 0)
    } catch { setTotalAPercevoir(0) }
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

          {/* Total à percevoir */}
          {searched && (
            <div style={{ background:'white', borderRadius:12, padding:'16px 24px', marginBottom:20, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:44, height:44, borderRadius:11, background:'#fef3c7', color:'#b45309', display:'flex', alignItems:'center', justifyContent:'center' }}><IcoDollar /></div>
              <div>
                <p style={{ fontSize:13, color:'#64748b', marginBottom:2 }}>Montant total à percevoir (toute la sélection)</p>
                <p style={{ fontSize:24, fontWeight:800, color:'#b45309' }}>{fmt(totalAPercevoir)} Ar</p>
              </div>
              <div style={{ marginLeft:'auto' }}>
                <span className="badge badge-warning">{table.meta.total} échéance(s)</span>
              </div>
            </div>
          )}

          {/* Tableau — colonne Éditeur retirée, disponible via clic sur la ligne */}
          <div className="card">
            <div className="card-header">
              <div className="section-info">
                <div className="section-title">Liste des échéances</div>
                <div className="section-count">{table.meta.total} échéance(s)</div>
              </div>
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
                    <tr><th>#</th><th>Date d'échéance</th><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Session</th><th>Montant payé</th><th>Reste</th></tr>
                  </thead>
                  <tbody>
                    {table.data.length === 0 ? (
                      <tr><td colSpan={8}>
                        <div className="empty-state">
                          {searched ? 'Aucune échéance pour cette date' : 'Sélectionnez une date et cliquez sur Rechercher'}
                        </div>
                      </td></tr>
                    ) : table.data.map((r, i) => (
                      <tr key={r.id_paiement} onClick={() => setViewing(r)} style={{ cursor:'pointer' }}>
                        <td style={{ color:'#94a3b8', fontSize:13 }}>{(table.meta.current_page-1)*table.meta.per_page+i+1}</td>
                        <td style={{ fontSize:13 }}>{r.date_echeance}</td>
                        <td><span className="badge badge-info">{r.matricule}</span></td>
                        <td style={{ fontWeight:600 }}>{r.nom}</td>
                        <td>{r.prenom}</td>
                        <td style={{ fontSize:13, color:'#64748b' }}>{r.code_session}</td>
                        <td style={{ fontWeight:600, color:'#16a34a' }}>{fmt(r.montant_paye)} Ar</td>
                        <td>
                          <span className={`badge ${Number(r.reste)===0?'badge-success':'badge-danger'}`}>{fmt(r.reste)} Ar</span>
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

      {viewing && <DetailModal r={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
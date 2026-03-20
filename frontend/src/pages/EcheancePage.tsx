import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { IcoSearch, IcoExcel } from '../components/icons'

interface Echeance {
  date_echeance: string; matricule: string; nom: string; prenom: string
  code_session: string; montant_paye: number; reste: number; editeur: string
}

const today = new Date().toISOString().split('T')[0]

export default function EcheancePage() {
  const [date, setDate]         = useState(today)
  const [rows, setRows]         = useState<Echeance[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    setLoading(true); setSearched(true)
    try {
      const r = await api.get('/echeances', { params: { date } })
      setRows(r.data.data)
      setTotal(r.data.total_a_percevoir ?? r.data.data.reduce((a: number, e: Echeance) => a + Number(e.reste), 0))
    } catch {
      toast.error('Erreur chargement échéances')
      setRows([]); setTotal(0)
    } finally { setLoading(false) }
  }

  const exportExcel = () => {
    if (rows.length === 0) { toast.error('Aucune donnée à exporter'); return }
    const header = ["Date d'échéance", 'Matricule', 'Nom', 'Prénom', 'Session', 'Montant payé', 'Reste', 'Éditeur']
    const data = rows.map(r => [
      r.date_echeance, r.matricule, r.nom, r.prenom,
      r.code_session, String(r.montant_paye), String(r.reste), r.editeur
    ])
    const csv = [header, ...data].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `echeances_${date}.csv`
    a.click()
    toast.success('Export téléchargé')
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <div className="app-layout">
      <Sidebar section="formation" />
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Échéance
          </span>
        </div>

        <div style={{ padding: 24 }}>
          {/* Filtre */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Recherche par date d'échéance</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                  <label className="form-label">Date limite d'échéance</label>
                  <input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <button className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={handleSearch} disabled={loading}>
                  {loading
                    ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Chargement…</>
                    : <><IcoSearch /> Rechercher</>
                  }
                </button>
                <button className="btn btn-success"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={exportExcel}>
                  <IcoExcel /> Export Excel
                </button>
              </div>
            </div>
          </div>

          {/* Montant à percevoir */}
          {searched && (
            <div style={{
              background: 'white', borderRadius: 12, padding: '16px 24px',
              marginBottom: 20, border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11,
                background: '#fef3c7', color: '#b45309',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Montant à percevoir</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: '#b45309' }}>{fmt(total)} Ar</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span className="badge badge-warning">{rows.length} échéance(s)</span>
              </div>
            </div>
          )}

          {/* Tableau */}
          <div className="card">
            <div className="card-header">
              <div className="section-info">
                <div className="section-title">Liste des échéance(s)</div>
                <div className="section-count">{rows.length} échéance(s)</div>
              </div>
            </div>
            <div className="table-wrapper">
              {loading ? (
                <div className="loading-center"><div className="spinner" /> Chargement…</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Date d'échéance</th><th>Matricule</th><th>Nom</th>
                      <th>Prénoms</th><th>Session</th><th>Montant payé</th>
                      <th>Reste</th><th>Éditeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={8}>
                        <div className="empty-state">
                          {searched ? 'Aucune échéance pour cette date' : 'Sélectionnez une date et cliquez sur Rechercher'}
                        </div>
                      </td></tr>
                    ) : rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12 }}>{r.date_echeance}</td>
                        <td><span className="badge badge-info">{r.matricule}</span></td>
                        <td style={{ fontWeight: 600 }}>{r.nom}</td>
                        <td>{r.prenom}</td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>{r.code_session}</td>
                        <td style={{ fontWeight: 600, color: '#16a34a' }}>{fmt(r.montant_paye)} Ar</td>
                        <td>
                          <span className={`badge ${Number(r.reste) === 0 ? 'badge-success' : 'badge-danger'}`}>
                            {fmt(r.reste)} Ar
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: '#64748b' }}>{r.editeur}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
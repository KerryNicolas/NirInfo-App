import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { IcoSearch, IcoExcel, IcoFilter } from '../components/icons'

interface EtatRow {
  date_transaction: string
  matricule: string
  nom: string
  prenom: string
  code_session: string
  montant: number
  type_paiement: string
  lieu_paiement: string
  editeur: string
}

const today = new Date().toISOString().split('T')[0]

export default function EtatPage() {
  const [form, setForm]       = useState({ date_debut: today, date_fin: today, module: '', lieu: 'Tous' })
  const [rows, setRows]       = useState<EtatRow[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleValider = async () => {
    setLoading(true)
    setSearched(true)
    try {
      const r = await api.get('/etat', { params: form })
      setRows(r.data.data)
      setTotal(r.data.total_montant)
    } catch {
      toast.error('Erreur chargement état')
      // Fallback vide
      setRows([])
      setTotal(0)
    } finally { setLoading(false) }
  }

  const exportExcel = () => {
    if (rows.length === 0) { toast.error('Aucune donnée à exporter'); return }
    const header = ['Date', 'Matricule', 'Nom', 'Prénom', 'Session', 'Montant', 'Type paiement', 'Lieu', 'Éditeur']
    const data = rows.map(r => [
      r.date_transaction, r.matricule, r.nom, r.prenom,
      r.code_session, String(r.montant), r.type_paiement, r.lieu_paiement, r.editeur
    ])
    const csv = [header, ...data].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `etat_${form.date_debut}_${form.date_fin}.csv`
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
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
            </svg>
            État
          </span>
        </div>

        <div style={{ padding: 24 }}>

          {/* Filtres */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IcoFilter /> Filtres
              </span>
            </div>
            <div className="card-body">
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Date début</label>
                  <input className="form-control" type="date" value={form.date_debut} onChange={set('date_debut')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date fin</label>
                  <input className="form-control" type="date" value={form.date_fin} onChange={set('date_fin')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Module</label>
                  <input className="form-control" value={form.module} onChange={set('module')} placeholder="Tous les modules" />
                </div>
                <div className="form-group">
                  <label className="form-label">Lieu</label>
                  <select className="form-control" value={form.lieu} onChange={set('lieu')}>
                    <option value="Tous">Tous</option>
                    <option>Ampandrana</option><option>Ampefiloha</option><option>Andravoahangy</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={handleValider} disabled={loading}>
                  {loading
                    ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Chargement…</>
                    : <><IcoSearch /> Valider</>
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

          {/* Montant perçu */}
          {searched && (
            <div style={{
              background: 'white', borderRadius: 12, padding: '16px 24px',
              marginBottom: 20, border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11,
                background: '#f0fdf4', color: '#16a34a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v2m0 8v2M8.5 9.5a3.5 3.5 0 0 1 7 0c0 2-3.5 3-3.5 3s-3.5 1-3.5 3a3.5 3.5 0 0 0 7 0"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Montant perçu total</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{fmt(total)} Ar</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span className="badge badge-info">{rows.length} entrée(s)</span>
              </div>
            </div>
          )}

          {/* Tableau */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Liste des entrée(s)</span>
              {rows.length > 0 && (
                <span className="badge badge-success">{rows.length} enregistrement(s)</span>
              )}
            </div>
            <div className="table-wrapper">
              {loading ? (
                <div className="loading-center"><div className="spinner" /> Chargement…</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Date transaction</th><th>Matricule</th><th>Nom</th>
                      <th>Prénom</th><th>Session</th><th>Montant</th>
                      <th>Type paiement</th><th>Lieu de paiement</th><th>Éditeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={9}>
                        <div className="empty-state">
                          {searched ? 'Aucune entrée pour cette période' : 'Sélectionnez une période et cliquez sur Valider'}
                        </div>
                      </td></tr>
                    ) : rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12 }}>{r.date_transaction}</td>
                        <td><span className="badge badge-info">{r.matricule}</span></td>
                        <td style={{ fontWeight: 500 }}>{r.nom}</td>
                        <td>{r.prenom}</td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>{r.code_session}</td>
                        <td style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(r.montant)} Ar</td>
                        <td style={{ fontSize: 12 }}>{r.type_paiement}</td>
                        <td style={{ fontSize: 12 }}>{r.lieu_paiement}</td>
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
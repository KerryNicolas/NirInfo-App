import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

interface Session { code_session: string }
interface PointageRow {
  matricule: string; nom: string; prenom: string
  present: boolean; heure: string
}

export default function PointageTab() {
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [session,   setSession]   = useState('')
  const [date,      setDate]      = useState('')
  const [rows,      setRows]      = useState<PointageRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [searched,  setSearched]  = useState(false)

  useEffect(() => {
    api.get('/sessions').then(r => setSessions(r.data.data)).catch(() => {})
  }, [])

  const handleAfficher = async () => {
    if (!session) { toast.error('Veuillez choisir une session'); return }
    setLoading(true)
    setSearched(true)
    try {
      // Endpoint pointage étudiant — retourne les inscrits de la session
      // avec leur statut de présence pour la date donnée
      const r = await api.get('/inscriptions', { params: { search: session } })
      const inscrits = r.data.data.filter((i: any) => i.code_session === session)
      setRows(inscrits.map((i: any) => ({
        matricule: i.matricule,
        nom:       i.nom,
        prenom:    i.prenom,
        present:   false,
        heure:     '',
      })))
      if (inscrits.length === 0) toast('Aucun étudiant inscrit à cette session')
    } catch { toast.error('Erreur chargement pointage') }
    finally { setLoading(false) }
  }

  const togglePresent = (idx: number) =>
    setRows(p => p.map((r, i) => i === idx ? { ...r, present: !r.present } : r))

  const presentCount = rows.filter(r => r.present).length

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Historique pointage</span></div>
      <div className="card-body">
        {/* Filtres */}
        <div className="form-row" style={{ maxWidth: 540 }}>
          <div className="form-group">
            <label className="form-label">Session :</label>
            <select className="form-control" value={session} onChange={e => setSession(e.target.value)}>
              <option value="">-- Choisir une session --</option>
              {sessions.map(s => (
                <option key={s.code_session} value={s.code_session}>{s.code_session}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date :</label>
            <input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleAfficher} disabled={loading}>
          {loading
            ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Chargement…</>
            : '📋 Afficher'
          }
        </button>

        {/* Résultats */}
        {searched && !loading && (
          <div style={{ marginTop: 24 }}>
            {rows.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 48 }}>📋</div>
                <p style={{ marginTop: 8, color: '#94a3b8' }}>
                  Aucun étudiant trouvé pour cette session
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    {rows.length} étudiant(s) —{' '}
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{presentCount} présent(s)</span>
                    {' / '}
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>{rows.length - presentCount} absent(s)</span>
                  </div>
                  {date && <span className="badge badge-info">📅 {date}</span>}
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th><th>Matricule</th><th>Nom</th><th>Prénoms</th>
                        <th className="text-center">Présence</th><th>Heure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={r.matricule}>
                          <td style={{ color: '#94a3b8', fontSize: 12 }}>{idx + 1}</td>
                          <td><span className="badge badge-info">{r.matricule}</span></td>
                          <td style={{ fontWeight: 500 }}>{r.nom}</td>
                          <td>{r.prenom}</td>
                          <td className="text-center">
                            <button
                              onClick={() => togglePresent(idx)}
                              style={{
                                background: r.present ? '#dcfce7' : '#fee2e2',
                                color: r.present ? '#16a34a' : '#dc2626',
                                border: `1px solid ${r.present ? '#86efac' : '#fca5a5'}`,
                                borderRadius: 20, padding: '3px 14px',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              {r.present ? '✓ Présent' : '✗ Absent'}
                            </button>
                          </td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{r.heure || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {!searched && (
          <div className="empty-state" style={{ marginTop: 32 }}>
            <div style={{ fontSize: 52 }}>📋</div>
            <p style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>
              Sélectionnez une session et cliquez sur <b>Afficher</b> pour voir le pointage
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

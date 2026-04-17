import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

interface Session { code_session: string }
interface PointageRow {
  matricule: string; nom: string; prenom: string
  present: boolean; id_pointage?: number
}

/* ── Icônes SVG ── */
const IcoCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
)
const IcoCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IcoX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IcoEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IcoSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
)
const IcoClipboard = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
    <line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/>
  </svg>
)

export default function PointageTab() {
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [session,   setSession]   = useState('')
  const [date,      setDate]      = useState(new Date().toISOString().split('T')[0])
  const [rows,      setRows]      = useState<PointageRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [searched,  setSearched]  = useState(false)

  useEffect(() => {
    api.get('/sessions')
      .then(r => {
        // LIFO — sessions les plus récentes en premier
        const data = (r.data.data ?? []).sort((a: any, b: any) =>
          new Date(b.date_debut ?? '').getTime() - new Date(a.date_debut ?? '').getTime()
        )
        setSessions(data)
      })
      .catch(() => {})
  }, [])

  const handleAfficher = async () => {
    if (!session) { toast.error('Veuillez choisir une session'); return }
    setLoading(true); setSearched(true)
    try {
      // Charger les inscrits de la session
      const r = await api.get('/inscriptions', { params: { search: session } })
      const inscrits = (r.data.data ?? []).filter((i: any) => i.code_session === session)

      // Dédupliquer par matricule
      const seen = new Set<string>()
      const unique = inscrits.filter((i: any) => {
        if (seen.has(i.matricule)) return false
        seen.add(i.matricule); return true
      })

      // Vérifier pointage existant pour cette date
      let pointageExistant: any[] = []
      try {
        const pr = await api.get('/pointage-etudiant', { params: { session, date } })
        pointageExistant = pr.data.data ?? []
      } catch { /* endpoint optionnel */ }

      setRows(unique.map((i: any) => {
        const existing = pointageExistant.find((p: any) => p.matricule_etudiant === i.matricule)
        return {
          matricule: i.matricule,
          nom:       i.nom,
          prenom:    i.prenom,
          present:   existing ? Boolean(existing.present) : false,
          id_pointage: existing?.id_pointage_etudiant,
        }
      }))
    } catch { toast.error('Erreur chargement') }
    finally { setLoading(false) }
  }

  const togglePresent = (idx: number) =>
    setRows(p => p.map((r, i) => i === idx ? { ...r, present: !r.present } : r))

  const handleSauvegarder = async () => {
    if (!session || rows.length === 0) { toast.error('Aucun pointage à sauvegarder'); return }
    setSaving(true)
    try {
      // Sauvegarder chaque ligne
      await Promise.all(rows.map(r =>
        api.post('/pointage-etudiant', {
          date,
          matricule_etudiant: r.matricule,
          session,
          present: r.present ? 1 : 0,
        }).catch(() => {})
      ))
      toast.success('Pointage sauvegardé avec succès')
    } catch { toast.error('Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }

  const presentCount = rows.filter(r => r.present).length
  const absentCount  = rows.length - presentCount

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <IcoCalendar /> Historique pointage
        </span>
      </div>
      <div className="card-body">
        {/* Filtres */}
        <div className="form-row" style={{ maxWidth: 600 }}>
          <div className="form-group">
            <label className="form-label">Session <span style={{ color: '#ef4444' }}>*</span></label>
            <select className="form-control" value={session} onChange={e => setSession(e.target.value)}>
              <option value="">-- Choisir une session --</option>
              {sessions.map(s => (
                <option key={s.code_session} value={s.code_session}>{s.code_session}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-control" type="date" value={date}
              onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={handleAfficher} disabled={loading}>
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Chargement…</>
              : <><IcoEye /> Afficher</>
            }
          </button>
          {rows.length > 0 && (
            <button className="btn btn-success"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={handleSauvegarder} disabled={saving}>
              {saving
                ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Sauvegarde…</>
                : <><IcoSave /> Sauvegarder</>
              }
            </button>
          )}
        </div>

        {/* Résultats */}
        {searched && !loading && rows.length > 0 && (
          <>
            {/* Résumé présence */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '8px 14px' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IcoCheck />
                </span>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{presentCount}</p>
                  <p style={{ fontSize: 11, color: '#64748b' }}>Présent(s)</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '8px 14px' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IcoX />
                </span>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{absentCount}</p>
                  <p style={{ fontSize: 11, color: '#64748b' }}>Absent(s)</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 9, padding: '8px 14px' }}>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#2563eb', lineHeight: 1 }}>{rows.length}</p>
                  <p style={{ fontSize: 11, color: '#64748b' }}>Total inscrit(s)</p>
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Matricule</th><th>Nom</th><th>Prénoms</th>
                    <th className="text-center">Présence</th>
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
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: r.present ? '#dcfce7' : '#fee2e2',
                            color:      r.present ? '#16a34a' : '#dc2626',
                            border: `1px solid ${r.present ? '#86efac' : '#fca5a5'}`,
                            borderRadius: 20, padding: '4px 14px',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {r.present ? <IcoCheck /> : <IcoX />}
                          {r.present ? 'Présent' : 'Absent'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* État vide */}
        {searched && !loading && rows.length === 0 && (
          <div className="empty-state">
            <div style={{ color: '#cbd5e1', marginBottom: 12 }}><IcoClipboard /></div>
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Aucun étudiant trouvé pour cette session</p>
          </div>
        )}

        {!searched && (
          <div className="empty-state">
            <div style={{ color: '#cbd5e1', marginBottom: 12 }}><IcoClipboard /></div>
            <p style={{ color: '#94a3b8', fontSize: 13 }}>
              Sélectionnez une session et cliquez sur <b>Afficher</b>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
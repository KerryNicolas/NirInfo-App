import { useEffect, useState, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import Pagination from '../components/Pagination'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  total_etudiants: number
  sessions_actives: number
  inscriptions_mois: number
  revenus_mois: number
}
interface Inscription {
  id_paiement: number
  matricule: string
  nom_complet: string
  code_session: string
  date_paiement: string
  montant_paye: number
  reste: number
}
interface EtatRow {
  id_paiement: number
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
interface RevenusItem      { mois: string; revenus: number }
interface InscriptionItem  { mois: string; count: number  }
interface LieuItem         { name: string; value: number  }

// ── Couleurs camembert ───────────────────────────────────────────────────────
const PIE_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2']

// ── Constante date ───────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0]

// ── Icônes ───────────────────────────────────────────────────────────────────
const IcoBarChart = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
const IcoFilter   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
const IcoSearch   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoExcel    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
const IcoMoney    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M8.5 9.5a3.5 3.5 0 0 1 7 0c0 2-3.5 3-3.5 3s-3.5 1-3.5 3a3.5 3.5 0 0 0 7 0"/></svg>

// ── Composant principal ──────────────────────────────────────────────────────
export default function EtatPage() {

  // ── Stats KPI ──────────────────────────────────────────────────────────────
  const [stats,        setStats]        = useState<Stats | null>(null)
  const [inscriptions, setInscriptions] = useState<Inscription[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  // ── Graphiques ─────────────────────────────────────────────────────────────
  const [revenusData,      setRevenusData]      = useState<RevenusItem[]>([])
  const [inscriptionsData, setInscriptionsData] = useState<InscriptionItem[]>([])
  const [lieuxData,        setLieuxData]        = useState<LieuItem[]>([])
  const [chartsLoading,    setChartsLoading]    = useState(true)

  // ── Filtres État ───────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    date_debut: today,
    date_fin:   today,
    module:     '',
    lieu:       'Tous',
  })
  const [activeParams,  setActiveParams]  = useState<Record<string, string>>({})
  const [totalMontant,  setTotalMontant]  = useState(0)
  const [searched,      setSearched]      = useState(false)

  const table = useTable<EtatRow>('/etat', {
    perPage:  15,
    params:   activeParams,
    autoLoad: false,
  })

  // ── Chargement stats + graphiques au montage ───────────────────────────────
  useEffect(() => {
    // Stats KPI + dernières inscriptions
    api.get('/dashboard/stats')
      .then(r => {
        setStats(r.data.stats ?? r.data)
        setInscriptions(r.data.dernieres_inscriptions ?? [])
      })
      .catch(() => {
        setStats({ total_etudiants: 0, sessions_actives: 0, inscriptions_mois: 0, revenus_mois: 0 })
        setInscriptions([])
      })
      .finally(() => setStatsLoading(false))

    // Données graphiques
    api.get('/dashboard/charts')
      .then(r => {
        setRevenusData(r.data.revenus      ?? [])
        setInscriptionsData(r.data.inscriptions ?? [])
        setLieuxData(r.data.lieux          ?? [])
      })
      .catch(() => {
        setRevenusData([])
        setInscriptionsData([])
        setLieuxData([])
      })
      .finally(() => setChartsLoading(false))
  }, [])

  // ── Valider filtres État ───────────────────────────────────────────────────
  const handleValider = useCallback(async () => {
    const params: Record<string, string> = {}
    if (form.date_debut)      params.date_debut = form.date_debut
    if (form.date_fin)        params.date_fin   = form.date_fin
    if (form.module)          params.module     = form.module
    if (form.lieu !== 'Tous') params.lieu       = form.lieu

    setSearched(true)

    try {
      const r = await api.get('/etat', { params: { ...params, per_page: 15, page: 1 } })
      setTotalMontant(r.data.total_montant ?? 0)
    } catch {
      setTotalMontant(0)
    }

    setActiveParams(params)
    setTimeout(() => table.reload(), 50)
  }, [form, table])

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportExcel = () => {
    if (table.data.length === 0) { toast.error('Aucune donnée à exporter'); return }
    const header = ['Date', 'Matricule', 'Nom', 'Prénom', 'Session', 'Montant', 'Type paiement', 'Lieu', 'Éditeur']
    const data   = table.data.map(r => [
      r.date_transaction, r.matricule, r.nom, r.prenom,
      r.code_session, String(r.montant), r.type_paiement, r.lieu_paiement, r.editeur
    ])
    const csv  = [header, ...data].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n')
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `etat_${form.date_debut}_${form.date_fin}.csv`
    a.click()
    toast.success('Export téléchargé')
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Sidebar section="formation" />
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcoBarChart /> État
          </span>
        </div>

        <div style={{ padding: 24 }}>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 1 — KPI Cards
          ══════════════════════════════════════════════════════════════ */}
          {statsLoading ? (
            <div className="loading-center"><div className="spinner" /> Chargement des statistiques…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
              {[
                {
                  label: 'Total Étudiants',
                  value: fmt(stats?.total_etudiants ?? 0),
                  color: '#2563eb', bg: '#eff6ff',
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                },
                {
                  label: 'Sessions actives',
                  value: fmt(stats?.sessions_actives ?? 0),
                  color: '#16a34a', bg: '#f0fdf4',
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
                },
                {
                  label: 'Inscriptions/mois',
                  value: fmt(stats?.inscriptions_mois ?? 0),
                  color: '#ea580c', bg: '#fff7ed',
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
                },
                {
                  label: 'Revenus du mois',
                  value: fmt(stats?.revenus_mois ?? 0) + ' Ar',
                  color: '#7c3aed', bg: '#f5f3ff',
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M8.5 9.5a3.5 3.5 0 0 1 7 0c0 2-3.5 3-3.5 3s-3.5 1-3.5 3a3.5 3.5 0 0 0 7 0"/></svg>,
                },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div style={{ width: 46, height: 46, borderRadius: 11, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 2 — Graphiques (vraies données API)
          ══════════════════════════════════════════════════════════════ */}
          {chartsLoading ? (
            <div className="loading-center"><div className="spinner" /> Chargement des graphiques…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.6fr', gap: 16, marginBottom: 24 }}>

              {/* Courbe revenus mensuels */}
              <div className="card" style={{ padding: '16px 20px' }}>
                <div className="card-header" style={{ marginBottom: 12 }}>
                  <span className="card-title">Revenus mensuels</span>
                  <span className="badge badge-info">{new Date().getFullYear()}</span>
                </div>
                {revenusData.length === 0 ? (
                  <div className="empty-state">Aucune donnée disponible</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={revenusData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="mois"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v: number) => (v / 1000) + 'k'}
                      />
                      <Tooltip
                        formatter={(v: unknown) => [fmt(Number(v)) + ' Ar', 'Revenus']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenus"
                        stroke="#2563eb"
                        strokeWidth={2}
                        fill="url(#colorRev)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Barres inscriptions par mois */}
              <div className="card" style={{ padding: '16px 20px' }}>
                <div className="card-header" style={{ marginBottom: 12 }}>
                  <span className="card-title">Inscriptions / mois</span>
                  <span className="badge badge-success">{new Date().getFullYear()}</span>
                </div>
                {inscriptionsData.length === 0 ? (
                  <div className="empty-state">Aucune donnée disponible</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={inscriptionsData} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="mois"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false} tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: unknown) => [Number(v), 'Inscriptions']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                      />
                      <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Camembert répartition par lieu */}
              <div className="card" style={{ padding: '16px 20px' }}>
                <div className="card-header" style={{ marginBottom: 4 }}>
                  <span className="card-title">Par lieu</span>
                </div>
                {lieuxData.length === 0 ? (
                  <div className="empty-state">Aucune donnée disponible</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={lieuxData}
                        cx="50%" cy="50%"
                        innerRadius={40} outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {lieuxData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: unknown) => [Number(v), 'Paiements']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 3 — Dernières inscriptions
          ══════════════════════════════════════════════════════════════ */}
          {!statsLoading && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div>
                  <span className="card-title">Dernières inscriptions</span>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Activité récente du centre</p>
                </div>
                <span className="badge badge-info">
                  {inscriptions.length} enregistrement{inscriptions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Matricule</th>
                      <th>Étudiant</th>
                      <th>Session</th>
                      <th>Date</th>
                      <th>Montant</th>
                      <th>Reste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="empty-state">Aucune inscription récente</div>
                        </td>
                      </tr>
                    ) : inscriptions.map((ins, idx) => (
                      <tr key={ins.id_paiement}>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>{idx + 1}</td>
                        <td><span className="badge badge-info">{ins.matricule}</span></td>
                        <td style={{ fontWeight: 600, color: '#1e293b' }}>{ins.nom_complet}</td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>{ins.code_session}</td>
                        <td style={{ fontSize: 12 }}>{ins.date_paiement}</td>
                        <td style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(Number(ins.montant_paye))} Ar</td>
                        <td>
                          <span className={`badge ${Number(ins.reste) === 0 ? 'badge-success' : 'badge-danger'}`}>
                            {fmt(Number(ins.reste))} Ar
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 4 — Filtres + Tableau État
          ══════════════════════════════════════════════════════════════ */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IcoFilter /> Filtres
              </span>
            </div>
            <div className="card-body">
              <div className="form-row">
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
                    <option value="Tous">Tous les lieux</option>
                    <option>Ampandrana</option>
                    <option>Ampefiloha</option>
                    <option>Andravoahangy</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={handleValider}
                  disabled={table.loading}
                >
                  {table.loading
                    ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Chargement…</>
                    : <><IcoSearch /> Valider</>
                  }
                </button>
                <button
                  className="btn btn-success"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={exportExcel}
                >
                  <IcoExcel /> Export Excel
                </button>
              </div>
            </div>
          </div>

          {/* Total perçu */}
          {searched && (
            <div style={{ background: 'white', borderRadius: 12, padding: '16px 24px', marginBottom: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IcoMoney />
              </div>
              <div>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Montant perçu total (toute la sélection)</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{fmt(totalMontant)} Ar</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span className="badge badge-info">{table.meta.total} entrée(s)</span>
              </div>
            </div>
          )}

          {/* Tableau État */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Liste des entrées</span>
              {table.meta.total > 0 && (
                <span className="badge badge-success">{table.meta.total} enregistrement(s)</span>
              )}
            </div>
            <div className="table-wrapper">
              {table.loading ? (
                <div className="loading-center"><div className="spinner" /> Chargement…</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Date</th><th>Matricule</th><th>Nom</th>
                      <th>Prénom</th><th>Session</th><th>Montant</th>
                      <th>Type</th><th>Lieu</th><th>Éditeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.data.length === 0 ? (
                      <tr>
                        <td colSpan={10}>
                          <div className="empty-state">
                            {searched
                              ? 'Aucune entrée pour cette période'
                              : 'Sélectionnez une période et cliquez sur Valider'}
                          </div>
                        </td>
                      </tr>
                    ) : table.data.map((r, i) => (
                      <tr key={r.id_paiement}>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>
                          {(table.meta.current_page - 1) * table.meta.per_page + i + 1}
                        </td>
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
            {!table.loading && table.meta.total > 0 && (
              <Pagination
                meta={table.meta}
                onPage={table.setPage}
                onPerPage={table.setPerPage}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
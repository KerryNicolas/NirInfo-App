import { useEffect, useState, useCallback } from 'react'
import Sidebar from '../../components/Sidebar'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useModuleSuggestions } from '../../hooks/useModuleSuggestions'
import Pagination from '../../components/Pagination'
import { IcoSearch, IcoBarChart, IcoExcel, IcoFilter, IcoMoney } from '../../components/icons'


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
interface EtatMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
  from: number
  to: number
  [key: string]: unknown
}

// ── Constante date ───────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0]

const EMPTY_META: EtatMeta = { current_page: 1, per_page: 15, total: 0, last_page: 1, from: 0, to: 0 }

// ── Composant principal ──────────────────────────────────────────────────────
export default function EtatPage() {

  // ── Stats KPI ──────────────────────────────────────────────────────────────
  const [stats,        setStats]        = useState<Stats | null>(null)
  const [inscriptions, setInscriptions] = useState<Inscription[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  // ── Chargement stats au montage ─────────────────────────────────────────────
  // Inchangé : cet appel part en parallèle du reste, n'est plus bloquant pour
  // rien d'autre sur la page, et n'a plus de spinner plein cadre (voir plus
  // bas) — juste rien affiché tant que ça charge.
  useEffect(() => {
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
  }, [])

  // ── Filtres État ───────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    date_debut: today,
    date_fin:   today,
    module:     '',
    lieu:       'Tous',
  })
  const [totalMontant, setTotalMontant] = useState(0)
  const [searched,     setSearched]     = useState(false)
  const [moduleQuery,  setModuleQuery]  = useState('')
  const moduleSuggestions = useModuleSuggestions(moduleQuery)

  // FIX PERFORMANCE : on n'utilise plus useTable() ici. useTable() ne renvoie
  // que les données paginées — le total_montant (agrégat sur TOUTE la
  // sélection filtrée, pas seulement la page affichée) doit venir de la même
  // réponse /etat que le backend renvoie déjà (voir EtatController::index,
  // champ total_montant). Avec useTable(), il n'y avait aucun moyen de lire ce
  // champ supplémentaire depuis le hook, donc handleValider() faisait un
  // DEUXIÈME appel réseau manuel à /etat avec les mêmes paramètres, juste pour
  // lire total_montant — doublant purement et simplement le travail du
  // serveur (et le temps d'attente) à chaque clic sur "Valider". En gérant
  // l'état de la table nous-mêmes ici, un seul appel réseau suffit pour tout :
  // lignes, pagination ET total_montant.
  const [rows,    setRows]    = useState<EtatRow[]>([])
  const [meta,    setMeta]    = useState<EtatMeta>(EMPTY_META)
  const [loading, setLoading] = useState(false)
  const [queryParams, setQueryParams] = useState<Record<string, string>>({})

  const fetchEtat = useCallback(async (page: number, perPage: number, params: Record<string, string>) => {
    setLoading(true)
    try {
      const r = await api.get('/etat', { params: { ...params, page, per_page: perPage } })
      const { data, ...rest } = r.data
      setRows(Array.isArray(data) ? data : [])
      setMeta(rest as EtatMeta)
      setTotalMontant(r.data.total_montant ?? 0)
    } catch {
      setRows([])
      setMeta(EMPTY_META)
      setTotalMontant(0)
      toast.error('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Valider filtres État ───────────────────────────────────────────────────
  const handleValider = useCallback(() => {
    const params: Record<string, string> = {}
    if (form.date_debut)      params.date_debut = form.date_debut
    if (form.date_fin)        params.date_fin   = form.date_fin
    if (form.module)          params.module     = form.module
    if (form.lieu !== 'Tous') params.lieu       = form.lieu

    setSearched(true)
    setQueryParams(params)
    void fetchEtat(1, meta.per_page, params)
  }, [form, meta.per_page, fetchEtat])

  const handlePage = useCallback((page: number) => {
    void fetchEtat(page, meta.per_page, queryParams)
  }, [meta.per_page, queryParams, fetchEtat])

  const handlePerPage = useCallback((perPage: number) => {
    void fetchEtat(1, perPage, queryParams)
  }, [queryParams, fetchEtat])

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportExcel = () => {
    if (rows.length === 0) { toast.error('Aucune donnée à exporter'); return }
    const header = ['Date', 'Matricule', 'Nom', 'Prénom', 'Session', 'Montant', 'Type paiement', 'Lieu', 'Éditeur']
    const data   = rows.map(r => [
      r.date_transaction, r.matricule, r.nom, r.prenom,
      r.code_session, String(r.montant), r.type_paiement, r.lieu_paiement, r.editeur
    ])
    const csv  = [header, ...data].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n')
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
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
              FIX : plus de spinner plein cadre — tant que statsLoading est
              vrai, rien n'est affiché ici (page "vide" à cet endroit) plutôt
              qu'un indicateur de chargement, conformément à la demande.
          ══════════════════════════════════════════════════════════════ */}
          {!statsLoading && (
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
              SECTION 2 — Dernières inscriptions
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
              SECTION 3 — Filtres
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
                  <input
                    className="form-control"
                    list="module-suggestions-etat"
                    value={moduleQuery}
                    onChange={e => {
                      const v = e.target.value
                      setModuleQuery(v)
                      const match = moduleSuggestions.find(m => m.nom === v)
                      setForm(p => ({ ...p, module: match ? match.code_module : '' }))
                    }}
                    placeholder="Tous les modules — tapez pour filtrer" />
                  <datalist id="module-suggestions-etat">
                    {moduleSuggestions.map(m => (
                      <option key={m.code_module} value={m.nom}>{m.code_module}</option>
                    ))}
                  </datalist>
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
                {/* FIX : plus d'indicateur de chargement sur ce bouton — juste
                    désactivé pendant la requête (évite le double-clic), sans
                    spinner ni texte "Chargement…", conformément à la demande
                    de ne plus afficher d'indicateur de chargement. */}
                <button
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={handleValider}
                  disabled={loading}
                >
                  <IcoSearch /> Valider
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
                <span className="badge badge-info">{meta.total} entrée(s)</span>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 4 — Tableau État
              FIX : plus de spinner plein cadre pendant le chargement — le
              tableau est simplement vide (rien affiché) le temps de la
              requête, conformément à la demande explicite de préférer une
              zone vide à un indicateur de chargement.
          ══════════════════════════════════════════════════════════════ */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Liste des entrées</span>
              {meta.total > 0 && (
                <span className="badge badge-success">{meta.total} enregistrement(s)</span>
              )}
            </div>
            <div className="table-wrapper">
              {!loading && (
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Date</th><th>Matricule</th><th>Nom</th>
                      <th>Prénom</th><th>Session</th><th>Montant</th>
                      <th>Type</th><th>Lieu</th><th>Éditeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={10}>
                          <div className="empty-state">
                            {searched
                              ? 'Aucune entrée pour cette période'
                              : 'Sélectionnez une période et cliquez sur Valider'}
                          </div>
                        </td>
                      </tr>
                    ) : rows.map((r, i) => (
                      <tr key={r.id_paiement}>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>
                          {(meta.current_page - 1) * meta.per_page + i + 1}
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
            {!loading && meta.total > 0 && (
              <Pagination
                meta={meta}
                onPage={handlePage}
                onPerPage={handlePerPage}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
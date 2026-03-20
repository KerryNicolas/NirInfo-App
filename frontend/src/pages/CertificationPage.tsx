import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { IcoSearch, IcoPrint, IcoTrash } from '../components/icons'

interface Certification {
  reference: string; matricule: string; nom_complet: string
  module_nom: string; editeur: string; can_print: boolean
  id_certification: number
}
interface Module { code_module: string; nom: string }

type SubTab = 'certification' | 'montant'

const today = new Date().toISOString().split('T')[0]

const EMPTY = {
  matricule: '', nom_prenom: '', code_module: '',
  date_debut: '', date_fin: '',
  nom_formation_certificat: '', lieu_paiement: 'Ampandrana',
}

export default function CertificationPage() {
  const [tab, setTab]               = useState<SubTab>('certification')
  const [certifs, setCertifs]       = useState<Certification[]>([])
  const [modules, setModules]       = useState<Module[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [form, setForm]             = useState(EMPTY)
  const [saving, setSaving]         = useState(false)
  // Montant perçu
  const [dateDebut, setDateDebut]   = useState(today)
  const [dateFin, setDateFin]       = useState(today)
  const [montantData, setMontantData] = useState<{ nb: number; montant: number } | null>(null)
  const [loadingMontant, setLoadingMontant] = useState(false)

  const load = async (q = '') => {
    setLoading(true)
    try {
      const [cr, mr] = await Promise.all([
        api.get('/certifications', { params: { search: q } }),
        api.get('/modules'),
      ])
      setCertifs(cr.data.data)
      setModules(mr.data.data)
    } catch { toast.error('Erreur chargement certifications') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleGenerer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/certifications', form)
      toast.success('Certificat généré avec succès')
      setForm(EMPTY); load(search)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur génération')
    } finally { setSaving(false) }
  }

  const handlePrint = async (id: number) => {
    try {
      window.open(`${api.defaults.baseURL}/certifications/${id}/print`, '_blank')
    } catch { toast.error('Erreur impression') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce certificat ?')) return
    try { await api.delete(`/certifications/${id}`); toast.success('Supprimé'); load(search) }
    catch { toast.error('Erreur suppression') }
  }

  const handleVoirMontant = async () => {
    setLoadingMontant(true)
    try {
      const r = await api.get('/certifications/montant', { params: { date_debut: dateDebut, date_fin: dateFin } })
      setMontantData(r.data)
    } catch {
      toast.error('Erreur chargement montant')
      setMontantData({ nb: 0, montant: 0 })
    } finally { setLoadingMontant(false) }
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <div className="app-layout">
      <Sidebar section="formation" />
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
            </svg>
            Certification
          </span>
        </div>

        <div style={{ padding: 24 }}>
          <div className="tabs">
            {(['certification', 'montant'] as SubTab[]).map(t => (
              <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t === 'certification' ? 'Certification' : 'Montant perçu'}
              </button>
            ))}
          </div>

          {tab === 'certification' && (
            <>
              {/* Formulaire */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <span className="card-title">Générer un certificat</span>
                </div>
                <div className="card-body">
                  <form onSubmit={handleGenerer}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Matricule <span style={{ color: '#ef4444' }}>*</span></label>
                        <input className="form-control" value={form.matricule} onChange={set('matricule')}
                          required placeholder="Ex: NI-3757" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Nom & prénoms</label>
                        <input className="form-control" value={form.nom_prenom} onChange={set('nom_prenom')}
                          placeholder="Auto-rempli depuis matricule" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Module <span style={{ color: '#ef4444' }}>*</span></label>
                        <select className="form-control" value={form.code_module} onChange={set('code_module')} required>
                            <input className="form-control" value={form.code_module} onChange={set('code_module')}
                              placeholder="-- Choisir une module --" />
                             <option>-- Choisir une module --</option>
                             <option>Autocad 2D et 3D</option>
                             <option>Access</option>
                             <option>Administration réseau</option>
                             <option>Illustrator</option>
                             <option>Excel avancé</option>
                             <option>Electricité batiment</option>
                             <option>Framework MVC</option>
                             <option>Graphic design complet</option>
                             <option>Développement </option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Nom de la formation sur le certificat</label>
                        <input className="form-control" value={form.nom_formation_certificat}
                          onChange={set('nom_formation_certificat')} placeholder="Ex: Excel avancé" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Début session</label>
                        <input className="form-control" type="date" value={form.date_debut} onChange={set('date_debut')} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Fin session</label>
                        <input className="form-control" type="date" value={form.date_fin} onChange={set('date_fin')} />
                      </div>
                    </div>
                    <div className="form-group" style={{ maxWidth: 280 }}>
                      <label className="form-label">Lieu de paiement</label>
                      <select className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiement')}>
                        <input className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiment')}
                              placeholder="-- Choisir un lieu --" />
                            <option>-- Choisir un lieu --</option>
                            <option>Ampefiloha</option>
                            <option>Ampandrana</option>
                            <option>Andravoahangy</option>
                      </select>
                    </div>
                    <button type="submit" className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={saving}>
                      {saving
                        ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Génération…</>
                        : <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
                            </svg>
                            Générer certificat
                          </>
                      }
                    </button>
                  </form>
                </div>
              </div>

              {/* Liste */}
              <div className="card">
                <div className="card-header">
                  <div className="section-info">
                    <div className="section-title">Liste des certifications</div>
                    <div className="section-count">{certifs.length} certificat(s)</div>
                  </div>
                  <div className="search-bar">
                    <IcoSearch />
                    <input placeholder="Mot à rechercher..." value={search}
                      onChange={e => { setSearch(e.target.value); load(e.target.value) }} />
                  </div>
                </div>
                <div className="table-wrapper">
                  {loading ? (
                    <div className="loading-center"><div className="spinner" /> Chargement…</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Référence</th><th>Matricule</th><th>Nom & prénoms</th>
                          <th>Formation</th><th>Éditeur</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {certifs.length === 0 ? (
                          <tr><td colSpan={6}><div className="empty-state">Aucune certification trouvée</div></td></tr>
                        ) : certifs.map(c => (
                          <tr key={c.id_certification}>
                            <td style={{ fontWeight: 600, color: '#2563eb' }}>{c.reference}</td>
                            <td><span className="badge badge-info">{c.matricule}</span></td>
                            <td style={{ fontWeight: 500 }}>{c.nom_complet}</td>
                            <td style={{ fontSize: 12 }}>{c.module_nom}</td>
                            <td style={{ fontSize: 11, color: '#64748b' }}>{c.editeur}</td>
                            <td>
                              <div className="table-actions">
                                <button className="btn-icon edit" onClick={() => handlePrint(c.id_certification)} title="Imprimer">
                                  <IcoPrint />
                                </button>
                                <button className="btn-icon delete" onClick={() => handleDelete(c.id_certification)} title="Supprimer">
                                  <IcoTrash />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'montant' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Montant perçu — Certifications</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Date début</label>
                    <input className="form-control" type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Date fin</label>
                    <input className="form-control" type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
                  </div>
                  <button className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={handleVoirMontant} disabled={loadingMontant}>
                    {loadingMontant
                      ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Chargement…</>
                      : <><IcoSearch /> Voir</>
                    }
                  </button>
                </div>

                {montantData && (
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{
                      flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0',
                      borderRadius: 12, padding: '20px 24px', textAlign: 'center',
                    }}>
                      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Nombre de certificats délivrés</p>
                      <p style={{ fontSize: 36, fontWeight: 800, color: '#16a34a' }}>{montantData.nb}</p>
                    </div>
                    <div style={{
                      flex: 1, background: '#eff6ff', border: '1px solid #bfdbfe',
                      borderRadius: 12, padding: '20px 24px', textAlign: 'center',
                    }}>
                      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Montant total perçu</p>
                      <p style={{ fontSize: 36, fontWeight: 800, color: '#2563eb' }}>{fmt(montantData.montant)} Ar</p>
                    </div>
                  </div>
                )}

                {!montantData && (
                  <div className="empty-state">
                    Sélectionnez une période et cliquez sur <b>Voir</b>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
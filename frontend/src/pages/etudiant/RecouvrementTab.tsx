import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

interface Recouvrement {
  id_recouvrement: number; matricule: string; nom: string; prenom: string
  code_session: string; montant_paye: number; reste: number
  date_paiement: string; editeur: string
}
interface Session { code_session: string }

const EMPTY = {
  matricule: '',
  code_session: '',
  date_paiement: new Date().toISOString().split('T')[0],
  reste_a_payer: '',
  montant_paye: '',
  compte: 'Caisse',
  lieu_paiement: 'Ampandrana',
}

export default function RecouvrementTab() {
  const [recouvrements, setRecouvrements] = useState<Recouvrement[]>([])
  const [sessions,      setSessions]      = useState<Session[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [form,          setForm]          = useState(EMPTY)

  const load = async (q = '') => {
    setLoading(true)
    try {
      const [rr, sr] = await Promise.all([
        api.get('/recouvrements', { params: { search: q } }),
        api.get('/sessions'),
      ])
      setRecouvrements(rr.data.data)
      setSessions(sr.data.data)
    } catch { toast.error('Erreur chargement recouvrements') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/recouvrements', form)
      toast.success('Recouvrement enregistré avec succès')
      setForm(p => ({ ...p, matricule: '', code_session: '', montant_paye: '', reste_a_payer: '' }))
      load(search)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce recouvrement ?')) return
    try { await api.delete(`/recouvrements/${id}`); toast.success('Supprimé'); load(search) }
    catch { toast.error('Erreur suppression') }
  }

  return (
    <>
      {/* ── Formulaire ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Nouveau recouvrement</span></div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Matricule :</label>
                <input className="form-control" value={form.matricule} onChange={set('matricule')}
                  required placeholder="Ex: ni-3776" />
              </div>
              <div className="form-group">
                <label className="form-label">Session :</label>
                <select className="form-control" value={form.code_session} onChange={set('code_session')} required>
                  <option value="">-- Choisir une session --</option>
                  {sessions.map(s => (
                    <option key={s.code_session} value={s.code_session}>{s.code_session}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date paiement :</label>
                <input className="form-control" type="date" value={form.date_paiement} onChange={set('date_paiement')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Reste à payer :</label>
                <input className="form-control" type="number" value={form.reste_a_payer} onChange={set('reste_a_payer')}
                  placeholder="Montant restant avant paiement" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Montant payé :</label>
                <input className="form-control" type="number" value={form.montant_paye} onChange={set('montant_paye')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Compte :</label>
                <select className="form-control" value={form.compte} onChange={set('compte')}>
                  <option>Caisse</option><option>Banque</option><option>Mobile Money</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ maxWidth: 280 }}>
              <label className="form-label">Lieu de paiement :</label>
              <select className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiement')}>
                <option>Ampandrana</option><option>Ampefiloha</option><option>Andravoahangy</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">➕ Enregistrer</button>
          </form>
        </div>
      </div>

      {/* ── Liste ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Liste de recouvrement(s)</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{recouvrements.length} recouvrement(s)</div>
          </div>
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder="Mot à rechercher..." value={search}
              onChange={e => { setSearch(e.target.value); load(e.target.value) }} />
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-center"><div className="spinner" />Chargement…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Matricule</th><th>Nom</th><th>Prénoms</th><th>Session</th>
                  <th>Montant payé</th><th>Reste</th><th>Date paiement</th><th>Éditeur</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recouvrements.length === 0 ? (
                  <tr><td colSpan={9} className="text-center" style={{ padding: 30, color: '#94a3b8' }}>Aucun recouvrement</td></tr>
                ) : recouvrements.map(r => (
                  <tr key={r.id_recouvrement}>
                    <td><span className="badge badge-info">{r.matricule}</span></td>
                    <td style={{ fontWeight: 500 }}>{r.nom}</td>
                    <td>{r.prenom}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{r.code_session}</td>
                    <td style={{ fontWeight: 600, color: '#16a34a' }}>
                      {Number(r.montant_paye).toLocaleString('fr')} Ar
                    </td>
                    <td>
                      <span className={`badge ${Number(r.reste) === 0 ? 'badge-success' : 'badge-danger'}`}>
                        {Number(r.reste).toLocaleString('fr')} Ar
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{r.date_paiement}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{r.editeur}</td>
                    <td>
                      <button className="btn-icon delete" onClick={() => handleDelete(r.id_recouvrement)} title="Supprimer">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

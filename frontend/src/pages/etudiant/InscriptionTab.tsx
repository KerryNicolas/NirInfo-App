// ══════════════════════════════════════════
// InscriptionTab.tsx
// ══════════════════════════════════════════
import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX } from '../../components/icons'

interface Inscription {
  id_paiement: number; matricule: string; nom: string; prenom: string
  code_session: string; date_paiement: string; montant_paye: number
  reste: number; compte: string; lieu_paiement: string; editeur: string
}
interface Session { code_session: string }

const EMPTY_I = {
  matricule: '', date_paiement: new Date().toISOString().split('T')[0],
  code_session: '', montant_paye: '', compte: 'Caisse', lieu_paiement: 'Ampandrana',
}

export default function InscriptionTab() {
  const table    = useTable<Inscription>('/inscriptions', { perPage: 15 })
  const [sessions, setSessions] = useState<Session[]>([])
  const [form,     setForm]     = useState(EMPTY_I)
  const [editing,  setEditing]  = useState<Inscription | null>(null)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { api.get('/sessions').then(r => setSessions(r.data.data ?? [])).catch(() => {}) }, [])

  const reset = () => { setForm(EMPTY_I); setEditing(null) }

  const handleEdit = (i: Inscription) => {
    setEditing(i)
    setForm({ matricule: i.matricule, date_paiement: i.date_paiement?.split('T')[0] || new Date().toISOString().split('T')[0], code_session: i.code_session, montant_paye: String(i.montant_paye), compte: i.compte || 'Caisse', lieu_paiement: i.lieu_paiement || 'Ampandrana' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) { await api.put(`/inscriptions/${editing.id_paiement}`, { montant_paye: form.montant_paye, compte: form.compte, lieu_paiement: form.lieu_paiement }); toast.success('Inscription mise à jour'); reset() }
      else         { await api.post('/inscriptions', form); toast.success('Inscription enregistrée'); setForm(p => ({ ...p, matricule:'', code_session:'', montant_paye:'' })) }
      table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement") }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette inscription ?')) return
    try { await api.delete(`/inscriptions/${id}`); toast.success('Inscription supprimée'); table.reload() }
    catch { toast.error('Erreur lors de la suppression') }
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>{editing ? <IcoEdit /> : <IcoPlus />} {editing ? "Modifier l'inscription" : 'Nouvelle inscription'}</span>
          {editing && <button className="btn btn-secondary btn-sm" onClick={reset} style={{ display:'flex', alignItems:'center', gap:5 }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Matricule <span style={{ color:'#ef4444' }}>*</span></label>
                <input className="form-control" value={form.matricule} onChange={set('matricule')} required placeholder="Ex: NI-3824" disabled={!!editing} />
              </div>
              <div className="form-group">
                <label className="form-label">Date paiement <span style={{ color:'#ef4444' }}>*</span></label>
                <input className="form-control" type="date" value={form.date_paiement} onChange={set('date_paiement')} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Session <span style={{ color:'#ef4444' }}>*</span></label>
                <select className="form-control" value={form.code_session} onChange={set('code_session')} required disabled={!!editing}>
                  <option value="">-- Choisir une session --</option>
                  {sessions.map(s => <option key={s.code_session} value={s.code_session}>{s.code_session}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Montant payé <span style={{ color:'#ef4444' }}>*</span></label>
                <input className="form-control" type="number" value={form.montant_paye} onChange={set('montant_paye')} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Compte</label>
                <select className="form-control" value={form.compte} onChange={set('compte')}>
                  <option>Caisse</option><option>Banque</option><option>Mobile Money</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Lieu de paiement</label>
                <select className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiement')}>
                  <option>Ampandrana</option><option>Ampefiloha</option><option>Andravoahangy</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</> : editing ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-info">
            <div className="section-title">Liste d'inscrit(s)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} inscrit(s)` : `${table.data.length} inscrit(s)`}</div>
          </div>
          <div className="search-bar">
            <IcoSearch />
            <input placeholder="Mot à rechercher..." value={table.search} onChange={e => table.setSearch(e.target.value)} />
            {table.search && <button onClick={() => table.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, fontSize:16 }}>×</button>}
          </div>
        </div>
        <div className="table-wrapper">
          {table.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
            <table>
              <thead><tr><th>#</th><th>Matricule</th><th>Nom</th><th>Prénoms</th><th>Session</th><th>Date</th><th>Montant payé</th><th>Reste</th><th>Éditeur</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={10}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucune inscription'}</div></td></tr>
                ) : table.data.map((i, idx) => (
                  <tr key={i.id_paiement}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td><span className="badge badge-info">{i.matricule}</span></td>
                    <td style={{ fontWeight:500 }}>{i.nom}</td>
                    <td>{i.prenom}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{i.code_session}</td>
                    <td style={{ fontSize:12 }}>{i.date_paiement}</td>
                    <td style={{ fontWeight:600, color:'#16a34a' }}>{fmt(Number(i.montant_paye))} Ar</td>
                    <td><span className={`badge ${Number(i.reste) === 0 ? 'badge-success' : 'badge-danger'}`}>{fmt(Number(i.reste))} Ar</span></td>
                    <td style={{ fontSize:11, color:'#64748b' }}>{i.editeur}</td>
                    <td><div className="table-actions">
                      <button className="btn-icon edit" onClick={() => handleEdit(i)}><IcoEdit /></button>
                      <button className="btn-icon delete" onClick={() => handleDelete(i.id_paiement)}><IcoTrash /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!table.loading && table.meta.total > 0 && <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />}
      </div>
    </>
  )
}
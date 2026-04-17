import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX } from '../../components/icons'

interface Recouvrement {
  id_recouvrement: number; matricule: string; nom: string; prenom: string
  code_session: string; montant_paye: number; reste: number
  date_paiement: string; compte: string; lieu_paiement: string; editeur: string
}
interface Session { code_session: string }

const EMPTY_R = {
  matricule: '', code_session: '', date_paiement: new Date().toISOString().split('T')[0],
  reste_a_payer: '', montant_paye: '', compte: 'Caisse', lieu_paiement: 'Ampandrana',
}

export default function RecouvrementTab() {
  const table    = useTable<Recouvrement>('/recouvrements', { perPage: 15 })
  const [sessions, setSessions] = useState<Session[]>([])
  const [form,     setForm]     = useState(EMPTY_R)
  const [editing,  setEditing]  = useState<Recouvrement | null>(null)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { api.get('/sessions').then(r => setSessions(r.data.data ?? [])).catch(() => {}) }, [])

  const reset = () => { setForm(EMPTY_R); setEditing(null) }

  const handleEdit = (r: Recouvrement) => {
    setEditing(r)
    setForm({ matricule: r.matricule, code_session: r.code_session, date_paiement: r.date_paiement?.split('T')[0] || new Date().toISOString().split('T')[0], reste_a_payer: String(r.reste), montant_paye: String(r.montant_paye), compte: r.compte || 'Caisse', lieu_paiement: r.lieu_paiement || 'Ampandrana' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) { await api.put(`/recouvrements/${editing.id_recouvrement}`, { montant_paye: form.montant_paye, reste: form.reste_a_payer, compte: form.compte, lieu_paiement: form.lieu_paiement }); toast.success('Recouvrement mis à jour'); reset() }
      else         { await api.post('/recouvrements', form); toast.success('Recouvrement enregistré'); setForm(p => ({ ...p, matricule:'', code_session:'', montant_paye:'', reste_a_payer:'' })) }
      table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement") }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce recouvrement ?')) return
    try { await api.delete(`/recouvrements/${id}`); toast.success('Recouvrement supprimé'); table.reload() }
    catch { toast.error('Erreur lors de la suppression') }
  }

  const fmt = (n: number) => Number(n).toLocaleString('fr')

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>{editing ? <IcoEdit /> : <IcoPlus />} {editing ? 'Modifier le recouvrement' : 'Nouveau recouvrement'}</span>
          {editing && <button className="btn btn-secondary btn-sm" onClick={reset} style={{ display:'flex', alignItems:'center', gap:5 }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Matricule <span style={{ color:'#ef4444' }}>*</span></label>
                <input className="form-control" value={form.matricule} onChange={set('matricule')} required placeholder="Ex: ni-3776" disabled={!!editing} />
              </div>
              <div className="form-group">
                <label className="form-label">Session <span style={{ color:'#ef4444' }}>*</span></label>
                <select className="form-control" value={form.code_session} onChange={set('code_session')} required disabled={!!editing}>
                  <option value="">-- Choisir une session --</option>
                  {sessions.map(s => <option key={s.code_session} value={s.code_session}>{s.code_session}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date paiement <span style={{ color:'#ef4444' }}>*</span></label>
                <input className="form-control" type="date" value={form.date_paiement} onChange={set('date_paiement')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Reste à payer</label>
                <input className="form-control" type="number" value={form.reste_a_payer} onChange={set('reste_a_payer')} placeholder="Montant restant avant paiement" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Montant payé <span style={{ color:'#ef4444' }}>*</span></label>
                <input className="form-control" type="number" value={form.montant_paye} onChange={set('montant_paye')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Compte</label>
                <select className="form-control" value={form.compte} onChange={set('compte')}>
                  <option>Caisse</option><option>Banque</option><option>Mobile Money</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ maxWidth: 280 }}>
              <label className="form-label">Lieu de paiement</label>
              <select className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiement')}>
                <option>Ampandrana</option><option>Ampefiloha</option><option>Andravoahangy</option>
              </select>
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
            <div className="section-title">Liste de recouvrement(s)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} recouvrement(s)` : `${table.data.length} recouvrement(s)`}</div>
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
              <thead><tr><th>#</th><th>Matricule</th><th>Nom</th><th>Prénoms</th><th>Session</th><th>Montant payé</th><th>Reste</th><th>Date paiement</th><th>Éditeur</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={10}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun recouvrement'}</div></td></tr>
                ) : table.data.map((r, idx) => (
                  <tr key={r.id_recouvrement}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td><span className="badge badge-info">{r.matricule}</span></td>
                    <td style={{ fontWeight:500 }}>{r.nom}</td>
                    <td>{r.prenom}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{r.code_session}</td>
                    <td style={{ fontWeight:600, color:'#16a34a' }}>{fmt(Number(r.montant_paye))} Ar</td>
                    <td><span className={`badge ${Number(r.reste) === 0 ? 'badge-success' : 'badge-danger'}`}>{fmt(Number(r.reste))} Ar</span></td>
                    <td style={{ fontSize:12 }}>{r.date_paiement}</td>
                    <td style={{ fontSize:11, color:'#64748b' }}>{r.editeur}</td>
                    <td><div className="table-actions">
                      <button className="btn-icon edit" onClick={() => handleEdit(r)}><IcoEdit /></button>
                      <button className="btn-icon delete" onClick={() => handleDelete(r.id_recouvrement)}><IcoTrash /></button>
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
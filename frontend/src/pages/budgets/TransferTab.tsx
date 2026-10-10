import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useAuth } from '../../contexts/AuthContext'
import { IcoPlus, IcoEdit, IcoSave, IcoTrash, IcoSearch, IcoX } from '../../components/icons'
import { formatMontantInput, parseMontantInput } from '../../utils/validators'

interface Transfer {
  id_transfer: number; starting_account: number; destination_account: number; amount: number
  starting_number: string; starting_libelle: string; destination_number: string; destination_libelle: string
}
interface Compte { id_compte: number; libelle: string }

const EMPTY = { starting_account: '', destination_account: '', amount: '' }
const fmt = (n: number) => Number(n).toLocaleString('fr')

export default function TransferTab() {
  const { isAdmin } = useAuth()
  const table = useTable<Transfer>('/transferts', { perPage: 15 })
  const [comptes, setComptes] = useState<Compte[]>([])
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  // FIX (point 9) : ajout de la modification — le backend expose maintenant
  // PUT /transferts/{id} (TransferController::update), qui annule l'ancien
  // mouvement avant d'appliquer le nouveau (aucune double comptabilisation).
  const [editing, setEditing] = useState<Transfer | null>(null)

  useEffect(() => {
    api.get('/comptes-budget/simple').then(r => setComptes(r.data ?? [])).catch(() => {})
  }, [])

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleEdit = (t: Transfer) => {
    setEditing(t)
    setForm({
      starting_account: String(t.starting_account),
      destination_account: String(t.destination_account),
      amount: formatMontantInput(String(t.amount)),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => { setForm(EMPTY); setEditing(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.starting_account && form.starting_account === form.destination_account) {
      toast.error('Le compte de départ et de destination doivent être différents')
      return
    }
    setSaving(true)
    try {
      // FIX : le champ Montant est saisi formaté ("1 000 000") pour
      // l'affichage — on renvoie la valeur numérique brute à l'API.
      const payload = { ...form, amount: parseMontantInput(form.amount) }
      if (editing) {
        await api.put(`/transferts/${editing.id_transfer}`, payload)
        toast.success('Virement mis à jour avec succès')
      } else {
        await api.post('/transferts', payload)
        toast.success('Virement effectué avec succès')
      }
      resetForm()
      table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || "Erreur lors du virement") }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    try { await api.delete(`/transferts/${confirmDeleteId}`); toast.success('Virement supprimé'); table.reload() }
    catch { toast.error('Erreur lors de la suppression') }
    finally { setConfirmDeleteId(null) }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>{editing ? <IcoEdit /> : <IcoPlus />} {editing ? 'Modifier le virement' : 'Nouveau virement'}</span>
          {editing && <button type="button" className="btn btn-sm" onClick={resetForm} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Compte de départ </label>
                <select className="form-control" value={form.starting_account} onChange={set('starting_account')} required>
                  <option value="">-- Choisir un compte --</option>
                  {comptes.map(c => <option key={c.id_compte} value={c.id_compte}>{c.libelle}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Compte de destination </label>
                <select className="form-control" value={form.destination_account} onChange={set('destination_account')} required>
                  <option value="">-- Choisir un compte --</option>
                  {comptes.map(c => <option key={c.id_compte} value={c.id_compte}>{c.libelle}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Montant </label>
              <input className="form-control" type="text" inputMode="numeric" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: formatMontantInput(e.target.value) }))} required placeholder="Ex: 100 000" />
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
            <div className="section-title">Liste de virement(s)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} virement(s)` : `${table.data.length} virement(s)`}</div>
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
              <thead><tr><th>#</th><th>De</th><th>Vers</th><th>Montant</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun virement'}</div></td></tr>
                ) : table.data.map((t, idx) => (
                  <tr key={t.id_transfer}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td style={{ fontSize:12 }}>{t.starting_libelle}</td>
                    <td style={{ fontSize:12 }}>{t.destination_libelle}</td>
                    <td style={{ fontWeight:600, color:'#2563eb' }}>{fmt(t.amount)} Ar</td>
                    <td><div className="table-actions">
                      <button className="btn-icon edit" onClick={() => handleEdit(t)}><IcoEdit /></button>
                      {isAdmin() && <button className="btn-icon delete" onClick={() => setConfirmDeleteId(t.id_transfer)}><IcoTrash /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!table.loading && table.meta.total > 0 && <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />}
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Supprimer ce virement ?"
        message="Ce virement sera définitivement supprimé et les soldes des comptes concernés seront automatiquement réajustés."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  )
}
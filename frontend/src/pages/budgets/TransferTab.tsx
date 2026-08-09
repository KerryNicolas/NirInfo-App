import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { IcoPlus, IcoTrash, IcoSearch } from '../../components/icons'

interface Transfer {
  id_transfer: number; starting_account: number; destination_account: number; amount: number
  starting_number: string; starting_libelle: string; destination_number: string; destination_libelle: string
}
interface Compte { id_compte: number; libelle: string }

const EMPTY = { starting_account: '', destination_account: '', amount: '' }
const fmt = (n: number) => Number(n).toLocaleString('fr')

export default function TransferTab() {
  const table = useTable<Transfer>('/transferts', { perPage: 15 })
  const [comptes, setComptes] = useState<Compte[]>([])
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    api.get('/comptes-budget/simple').then(r => setComptes(r.data ?? [])).catch(() => {})
  }, [])

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.starting_account && form.starting_account === form.destination_account) {
      toast.error('Le compte de départ et de destination doivent être différents')
      return
    }
    setSaving(true)
    try {
      await api.post('/transferts', form)
      toast.success('Virement effectué avec succès')
      setForm(EMPTY)
      table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || "Erreur lors du virement") }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce virement ?')) return
    try { await api.delete(`/transferts/${id}`); toast.success('Virement supprimé'); table.reload() }
    catch { toast.error('Erreur lors de la suppression') }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}><IcoPlus /> Nouveau virement</span>
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
              <input className="form-control" type="number" value={form.amount} onChange={set('amount')} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</> : <><IcoPlus /> Enregistrer</>}
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
                      <button className="btn-icon delete" onClick={() => handleDelete(t.id_transfer)}><IcoTrash /></button>
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
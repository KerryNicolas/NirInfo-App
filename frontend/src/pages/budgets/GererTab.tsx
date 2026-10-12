import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useAuth } from '../../contexts/AuthContext'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoInfo, IcoSave, IcoX } from '../../components/icons'
import { formatMontantInput, parseMontantInput } from '../../utils/validators'
import { messageErreur } from '../../utils/apiError'

interface Gestion {
  id_transaction: number; transaction_type: 'E' | 'S'; amount: number
  reson: string; account: number; account_number: string; libelle: string; editeur: string
}
interface Compte { id_compte: number; libelle: string }

const EMPTY = { compte: '', type: 'E', montant: '', raison: '' }
const fmt = (n: number) => Number(n).toLocaleString('fr')

function EditeurPopover({ editeur, onClose }: { editeur: string; onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:280, background:'white', borderRadius:12, padding:20 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={{ fontWeight:700, fontSize:14 }}>Éditeur</span>
          <button onClick={onClose} className="btn-icon"><IcoX /></button>
        </div>
        <div style={{ fontSize:14, color:'#334155' }}>{editeur?.trim() || 'Non renseigné'}</div>
      </div>
    </div>
  )
}

export default function GererTab() {
  const { isAdmin } = useAuth()
  const table = useTable<Gestion>('/gerer', { perPage: 15 })
  const [comptes, setComptes] = useState<Compte[]>([])
  const [form,    setForm]    = useState(EMPTY)
  const [editing, setEditing] = useState<Gestion | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [showEditeur, setShowEditeur] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  useEffect(() => {
    api.get('/comptes-budget/simple').then(r => setComptes(r.data ?? [])).catch(() => {})
  }, [])

  const reset = () => { setForm(EMPTY); setEditing(null) }

  const handleEdit = (g: Gestion) => {
    setEditing(g)
    setForm({ compte: String(g.account), type: g.transaction_type, montant: formatMontantInput(String(g.amount)), raison: g.reson })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      // FIX : le champ Montant est saisi formaté ("1 000 000") pour
      // l'affichage — on renvoie la valeur numérique brute à l'API.
      const payload = { ...form, montant: parseMontantInput(form.montant) }
      if (editing) {
        await api.put(`/gerer/${editing.id_transaction}`, payload)
        toast.success('Opération mise à jour avec succès')
      } else {
        await api.post('/gerer', payload)
        toast.success('Opération enregistrée avec succès')
      }
      reset()
      table.reload()
    } catch (err) { toast.error(messageErreur(err, "Erreur lors de l'enregistrement")) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    try { await api.delete(`/gerer/${confirmDeleteId}`); toast.success('Opération supprimée'); table.reload() }
    catch (err) { toast.error(messageErreur(err, 'Erreur lors de la suppression')) }
    finally { setConfirmDeleteId(null) }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>{editing ? <IcoEdit /> : <IcoPlus />} {editing ? "Modifier l'opération" : 'Nouvelle opération'}</span>
          {/* FIX : style harmonisé avec le bouton Annuler d'Étudiant */}
          {editing && <button className="btn btn-sm" onClick={reset} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Compte </label>
                <select className="form-control" value={form.compte} onChange={set('compte')} required>
                  <option value="">-- Choisir un compte --</option>
                  {comptes.map(c => <option key={c.id_compte} value={c.id_compte}>{c.libelle}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type </label>
                <select className="form-control" value={form.type} onChange={set('type')}>
                  <option value="E">DÉPÔT</option>
                  <option value="S">RETRAIT</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Montant </label>
                <input className="form-control" type="text" inputMode="numeric" value={form.montant} onChange={e => setForm(p => ({ ...p, montant: formatMontantInput(e.target.value) }))} required placeholder="Ex: 100 000" />
              </div>
              <div className="form-group">
                <label className="form-label">Raison </label>
                <input className="form-control" value={form.raison} onChange={set('raison')} required placeholder="Motif de l'opération" />
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
            <div className="section-title">Liste d'opération(s)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} opération(s)` : `${table.data.length} opération(s)`}</div>
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
              <thead><tr><th>#</th><th>Compte</th><th>Type</th><th>Montant</th><th>Raison</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucune opération'}</div></td></tr>
                ) : table.data.map((g, idx) => (
                  <tr key={g.id_transaction}>
                    <td style={{ color:'#94a3b8', fontSize:13 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td style={{ fontSize:13, color:'#64748b' }}>{g.libelle}</td>
                    <td><span className={`badge ${g.transaction_type === 'E' ? 'badge-success' : 'badge-danger'}`}>{g.transaction_type === 'E' ? 'DÉPÔT' : 'RETRAIT'}</span></td>
                    <td style={{ fontWeight:600, color: g.transaction_type === 'E' ? '#16a34a' : '#dc2626' }}>{fmt(g.amount)} Ar</td>
                    <td style={{ fontSize:13 }}>{g.reson}</td>
                    <td><div className="table-actions">
                      <button className="btn-icon" title="Éditeur" onClick={() => setShowEditeur(g.editeur)}><IcoInfo /></button>
                      <button className="btn-icon edit" onClick={() => handleEdit(g)}><IcoEdit /></button>
                      {isAdmin() && <button className="btn-icon delete" onClick={() => setConfirmDeleteId(g.id_transaction)}><IcoTrash /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!table.loading && table.meta.total > 0 && <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />}
      </div>

      {showEditeur !== null && <EditeurPopover editeur={showEditeur} onClose={() => setShowEditeur(null)} />}

      {/* FIX : le solde du compte est désormais réajusté automatiquement à
          la suppression (côté backend, GererController::destroy) — message
          mis à jour en conséquence. */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Supprimer cette opération ?"
        message="Cette opération sera définitivement supprimée et le solde du compte sera automatiquement réajusté."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  )
}
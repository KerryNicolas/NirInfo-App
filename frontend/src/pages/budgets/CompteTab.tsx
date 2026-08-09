import { useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX, IcoInfo } from '../../components/icons'

interface Compte { id_compte: number; account_number: string; libelle: string; montant: number; editeur: string }
const EMPTY = { account_number: '', libelle: '' }

function EditeurPopover({ editeur, onClose }: { editeur: string; onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:280, background:'white', borderRadius:12, padding:20 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={{ fontWeight:700, fontSize:14 }}>Éditeur</span>
          <button onClick={onClose} className="btn-icon"><IcoX /></button>
        </div>
        <div style={{ fontSize:13, color:'#334155' }}>{editeur?.trim() || 'Non renseigné'}</div>
      </div>
    </div>
  )
}

const fmt = (n: number) => Number(n).toLocaleString('fr')

export default function CompteTab() {
  const table   = useTable<Compte>('/comptes-budget', { perPage: 15 })
  const [editing, setEditing] = useState<Compte | null>(null)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [showEditeur, setShowEditeur] = useState<string | null>(null)

  const reset = () => { setForm(EMPTY); setEditing(null) }

  const handleEdit = (c: Compte) => {
    setEditing(c)
    setForm({ account_number: c.account_number, libelle: c.libelle })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) { await api.put(`/comptes-budget/${editing.id_compte}`, form); toast.success('Compte mis à jour') }
      else         { await api.post('/comptes-budget', form); toast.success('Compte créé avec succès') }
      reset(); table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce compte ?')) return
    try { await api.delete(`/comptes-budget/${id}`); toast.success('Compte supprimé'); table.reload() }
    catch { toast.error('Erreur suppression') }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>{editing ? <IcoEdit /> : <IcoPlus />} {editing ? 'Modifier le compte' : 'Nouveau compte'}</span>
          {editing && <button className="btn btn-secondary btn-sm" onClick={reset} style={{ display:'flex', alignItems:'center', gap:5 }}><IcoX /> Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Numéro de compte </label>
                <input className="form-control" value={form.account_number} onChange={set('account_number')} required placeholder="Ex: 034 XX XXX XX" />
              </div>
              <div className="form-group">
                <label className="form-label">Libellé </label>
                <input className="form-control" value={form.libelle} onChange={set('libelle')} required placeholder="Ex: Mvola, Caisse..." />
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
            <div className="section-title">Liste de compte(s)</div>
            <div className="section-count">{table.meta.total > 0 ? `${table.meta.total} compte(s)` : `${table.data.length} compte(s)`}</div>
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
              <thead><tr><th>#</th><th>Numéro</th><th>Libellé</th><th>Solde</th><th>Action</th></tr></thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state">{table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun compte'}</div></td></tr>
                ) : table.data.map((c, idx) => (
                  <tr key={c.id_compte}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{(table.meta.current_page-1)*table.meta.per_page+idx+1}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{c.account_number}</td>
                    <td style={{ fontWeight:600 }}>{c.libelle}</td>
                    <td style={{ fontWeight:600, color:'#16a34a' }}>{fmt(c.montant)} Ar</td>
                    <td><div className="table-actions">
                      <button className="btn-icon" title="Éditeur" onClick={() => setShowEditeur(c.editeur)}><IcoInfo /></button>
                      <button className="btn-icon edit" onClick={() => handleEdit(c)}><IcoEdit /></button>
                      <button className="btn-icon delete" onClick={() => handleDelete(c.id_compte)}><IcoTrash /></button>
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
    </>
  )
}
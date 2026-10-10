import { useState } from 'react'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../../hooks/useTable'
import Pagination from '../../../components/Pagination'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { useAuth } from '../../../contexts/AuthContext'
import { IcoEdit, IcoTrash, IcoSearch, IcoClock, IcoInfo, IcoX } from '../../../components/icons'
import ModuleForm from './ModuleForm'


interface Module { code_module: string; nom: string; description: string; editeur: string }
const EMPTY = { code_module: '', nom: '', description: '' }

// ── Petit popover léger — une seule info (éditeur), pas besoin d'un modal complet ──
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

export default function ModuleTab() {
  const { isAdmin } = useAuth()
  const table   = useTable<Module>('/modules', { perPage: 15 })
  const [editing, setEditing] = useState<Module | null>(null)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [showEditeur, setShowEditeur] = useState<string | null>(null)
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null)

  const reset = () => { setForm(EMPTY); setEditing(null) }

  // BONUS — cliquer sur une ligne remplit le formulaire
  const handleEdit = (m: Module) => {
    setEditing(m)
    setForm({ code_module: m.code_module, nom: m.nom, description: m.description || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) { await api.put(`/modules/${editing.code_module}`, form); toast.success('Module mis à jour') }
      else         { await api.post('/modules', form); toast.success('Module créé avec succès') }
      reset(); table.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDeleteCode) return
    try { await api.delete(`/modules/${confirmDeleteCode}`); toast.success('Module supprimé'); table.reload() }
    catch { toast.error('Erreur suppression') }
    finally { setConfirmDeleteCode(null) }
  }

  const handleChange = (key: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))

  return (
    <div className="app-layout">
      <div className="main-content">
       <div className="top-bar">
          <span className="top-bar-title" style={{ display:'flex', alignItems:'center', gap:8 }}><IcoClock /> Module </span>
       </div>

      <div style={{ padding: 24 }}>

        {/* Formulaire en table */}
        <ModuleForm
          form={form}
          editing={!!editing}
          saving={saving}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={reset}
        />

        {/* Tableau liste */}
        <div className="card">
          <div className="card-header">
            <div className="section-info">
              <div className="section-title">Liste des module(s)</div>
              <div className="section-count">
                {table.meta.total > 0 ? `${table.meta.total} module(s)` : `${table.data.length} module(s)`}
              </div>
            </div>
            <div className="search-bar">
              <IcoSearch />
              <input
                placeholder="Mot à rechercher..."
                value={table.search}
                onChange={e => table.setSearch(e.target.value)}
              />
              {table.search && (
                <button onClick={() => table.setSearch('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, fontSize: 16 }}>
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="table-wrapper">
            {table.loading ? (
              <div className="loading-center"><div className="spinner" /> Chargement…</div>
            ) : (
              <table>
                {/* Colonne Éditeur retirée — accessible via le bouton info dans Action */}
                <thead>
                  <tr><th>#</th><th>Code</th><th>Nom</th><th>Description</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {table.data.length === 0 ? (
                    <tr><td colSpan={5}>
                      <div className="empty-state">
                        {table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun module trouvé'}
                      </div>
                    </td></tr>
                  ) : table.data.map((m, idx) => (
                    // BONUS — clic sur la ligne = modifier (comportement inchangé)
                    <tr
                      key={m.code_module}
                      onClick={() => handleEdit(m)}
                      style={{
                        cursor: 'pointer',
                        background: editing?.code_module === m.code_module ? '#eff6ff' : undefined,
                        outline: editing?.code_module === m.code_module ? '2px solid #3b82f6' : undefined,
                      }}
                    >
                      <td style={{ color: '#94a3b8', fontSize: 12 }}>
                        {(table.meta.current_page - 1) * table.meta.per_page + idx + 1}
                      </td>
                      <td><span className="badge badge-info">{m.code_module}</span></td>
                      <td style={{ fontWeight: 600 }}>{m.nom}</td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{m.description || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="table-actions">
                          <button className="btn-icon" title="Éditeur" onClick={() => setShowEditeur(m.editeur)}><IcoInfo /></button>
                          <button className="btn-icon edit" onClick={() => handleEdit(m)}><IcoEdit /></button>
                          {isAdmin() && <button className="btn-icon delete" onClick={() => setConfirmDeleteCode(m.code_module)}><IcoTrash /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!table.loading && table.meta.total > 0 && (
            <Pagination meta={table.meta} onPage={table.setPage} onPerPage={table.setPerPage} />
          )}
        </div>
      </div>
      </div>

      {showEditeur !== null && <EditeurPopover editeur={showEditeur} onClose={() => setShowEditeur(null)} />}

      <ConfirmDialog
        open={!!confirmDeleteCode}
        title="Supprimer ce module ?"
        message={confirmDeleteCode ? `Le module « ${confirmDeleteCode} » sera définitivement supprimé. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteCode(null)}
      />
    </div>
  )
}
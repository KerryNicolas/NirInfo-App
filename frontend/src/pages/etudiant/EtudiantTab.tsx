import { useRef, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../hooks/useTable'
import Pagination from '../../components/Pagination'
import { IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoSave, IcoX, IcoCamera } from '../../components/icons'

interface Etudiant {
  matricule: string; nom: string; prenom: string; sexe: string
  date_naissance: string; lieu_naissance: string; numero_cin: string
  date_cin: string; lieu_cin: string; telephone: string; email: string
  photo: string; photo_url: string; editeur: string
}

const EMPTY = {
  nom: '', prenom: '', sexe: 'HOMME', date_naissance: '',
  lieu_naissance: '', numero_cin: '', date_cin: '',
  lieu_cin: '', telephone: '', email: '',
}

const IcoUserPlaceholder = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#cbd5e1' }}>
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)
const IcoUserSmall = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#94a3b8' }}>
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

export default function EtudiantTab() {
  /* ══════════════════════════════════════
     useTable — gère tout : pagination,
     recherche, chargement automatique
  ══════════════════════════════════════ */
  const table = useTable<Etudiant>('/etudiants', { perPage: 15 })

  const [editing,      setEditing]      = useState<Etudiant | null>(null)
  const [form,         setForm]         = useState(EMPTY)
  const [preview,      setPreview]      = useState<string | null>(null)
  const [newMatricule, setNewMatricule] = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setForm(EMPTY); setEditing(null)
    setPreview(null); setNewMatricule(null)
  }

  const handleEdit = (e: Etudiant) => {
    setEditing(e)
    setForm({
      nom: e.nom, prenom: e.prenom, sexe: e.sexe,
      date_naissance: e.date_naissance || '',
      lieu_naissance: e.lieu_naissance || '',
      numero_cin:     e.numero_cin     || '',
      date_cin:       e.date_cin       || '',
      lieu_cin:       e.lieu_cin       || '',
      telephone:      e.telephone      || '',
      email:          e.email          || '',
    })
    setPreview(e.photo_url || null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPreview(URL.createObjectURL(file))
    const targetId = editing?.matricule || newMatricule
    if (targetId) {
      const fd = new FormData(); fd.append('photo', file)
      try {
        const r = await api.post(`/etudiants/${targetId}/photo`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        setPreview(r.data.photo_url)
        toast.success('Photo mise à jour')
        table.reload()
      } catch { toast.error('Erreur upload photo') }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) {
        await api.put(`/etudiants/${editing.matricule}`, form)
        toast.success('Étudiant mis à jour')
        reset()
      } else {
        const r = await api.post('/etudiants', form)
        const mat = r.data.matricule
        setNewMatricule(mat)
        toast.success(`Étudiant créé — Matricule : ${mat}`)
        setForm(EMPTY)
      }
      table.reload()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement")
    } finally { setSaving(false) }
  }

  const handleDelete = async (mat: string) => {
    if (!confirm(`Supprimer l'étudiant ${mat} ?`)) return
    try {
      await api.delete(`/etudiants/${mat}`)
      toast.success('Étudiant supprimé')
      table.reload()
    } catch { toast.error('Erreur lors de la suppression') }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <>
      {/* ── Formulaire ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {editing ? <IcoEdit /> : <IcoPlus />}
            {editing ? "Modifier l'étudiant" : 'Nouvel étudiant'}
          </span>
          {editing && (
            <button className="btn btn-secondary btn-sm" onClick={reset}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IcoX /> Annuler
            </button>
          )}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nom <span style={{ color: '#ef4444' }}>*</span></label>
                    <input className="form-control" value={form.nom} onChange={set('nom')}
                      required placeholder="Nom de famille" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prénom(s) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input className="form-control" value={form.prenom} onChange={set('prenom')}
                      required placeholder="Prénoms" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Sexe</label>
                    <select className="form-control" value={form.sexe} onChange={set('sexe')}>
                      <option>HOMME</option><option>FEMME</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date de naissance</label>
                    <input className="form-control" type="date" value={form.date_naissance}
                      onChange={set('date_naissance')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Lieu de naissance</label>
                    <input className="form-control" value={form.lieu_naissance}
                      onChange={set('lieu_naissance')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Numéro CIN</label>
                    <input className="form-control" value={form.numero_cin}
                      onChange={set('numero_cin')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date CIN</label>
                    <input className="form-control" type="date" value={form.date_cin}
                      onChange={set('date_cin')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lieu CIN</label>
                    <input className="form-control" value={form.lieu_cin}
                      onChange={set('lieu_cin')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Téléphone</label>
                    <input className="form-control" value={form.telephone}
                      onChange={set('telephone')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-mail</label>
                    <input className="form-control" type="email" value={form.email}
                      onChange={set('email')} />
                  </div>
                </div>
              </div>

              {/* Photo */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                <div onClick={() => fileRef.current?.click()} style={{
                  cursor: 'pointer', width: 130, height: 155,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: preview ? 'transparent' : '#f8fafc',
                  border: `2px dashed ${preview ? '#bfdbfe' : '#e2e8f0'}`,
                  borderRadius: 10, overflow: 'hidden',
                }}>
                  {preview
                    ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center', padding: 12 }}>
                        <IcoUserPlaceholder />
                        <div style={{ fontSize: 11, marginTop: 6, color: '#94a3b8' }}>Cliquer pour ajouter</div>
                      </div>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*"
                  style={{ display: 'none' }} onChange={handlePhotoChange} />
                <button type="button" className="btn btn-secondary btn-sm"
                  style={{ width: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => fileRef.current?.click()}>
                  <IcoCamera /> Photo
                </button>
                {newMatricule && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', fontSize: 12, textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>
                    Matricule : {newMatricule}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button type="submit" className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={saving}>
                {saving
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Enregistrement…</>
                  : editing ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ══════════════════════════════════════
          TABLEAU AVEC PAGINATION
      ══════════════════════════════════════ */}
      <div className="card" style={{ width: '100%', boxSizing: 'border-box' }}>
        <div className="card-header">
          <div className="section-info">
            <div className="section-title">Liste d'étudiant(s)</div>
            <div className="section-count">
              {table.meta.total > 0
                ? `${table.meta.total} étudiant(s) — page ${table.meta.current_page}/${table.meta.last_page}`
                : `${table.data.length} étudiant(s)`
              }
            </div>
          </div>
          {/* Search branché sur useTable */}
          <div className="search-bar">
            <IcoSearch />
            <input
              placeholder="Mot à rechercher..."
              value={table.search}
              onChange={e => table.setSearch(e.target.value)}
            />
            {table.search && (
              <button onClick={() => table.setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, fontSize: 16, lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>
        </div>

        {/* Tableau */}
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as 'touch' }}>
          {table.loading ? (
            <div className="loading-center"><div className="spinner" /> Chargement…</div>
          ) : (
            <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th style={{ width: 100 }}>Matricule</th>
                  <th style={{ width: 46 }}>Photo</th>
                  <th>Nom</th>
                  <th>Prénoms</th>
                  <th style={{ width: 80 }}>Sexe</th>
                  <th style={{ width: 130 }}>Téléphone</th>
                  <th>Email</th>
                  <th style={{ width: 120 }}>Éditeur</th>
                  <th style={{ width: 80 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="empty-state">
                        {table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun étudiant trouvé'}
                      </div>
                    </td>
                  </tr>
                ) : table.data.map((e, idx) => (
                  <tr key={e.matricule}>
                    {/* Numéro absolu : tient compte de la page courante */}
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>
                      {(table.meta.current_page - 1) * table.meta.per_page + idx + 1}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ whiteSpace: 'nowrap' }}>
                        {e.matricule}
                      </span>
                    </td>
                    <td>
                      {e.photo_url
                        ? <img src={e.photo_url} alt="" style={{ width: 32, height: 38, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0', display: 'block' }} />
                        : <div style={{ width: 32, height: 38, background: '#f1f5f9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IcoUserSmall />
                          </div>
                      }
                    </td>
                    <td style={{ fontWeight: 500 }}>{e.nom}</td>
                    <td>{e.prenom}</td>
                    <td>
                      <span className={`badge ${e.sexe === 'HOMME' || e.sexe === 'Homme' ? 'badge-info' : 'badge-warning'}`}>
                        {e.sexe}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{e.telephone}</td>
                    <td style={{ fontSize: 12 }}>{e.email}</td>
                    <td style={{ fontSize: 11, color: '#64748b', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.editeur}
                    </td>
                    <td>
                      <div className="table-actions" style={{ flexWrap: 'nowrap' }}>
                        <button className="btn-icon edit" onClick={() => handleEdit(e)} title="Modifier">
                          <IcoEdit />
                        </button>
                        <button className="btn-icon delete" onClick={() => handleDelete(e.matricule)} title="Supprimer">
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

        {/* ══ PAGINATION ══ */}
        {!table.loading && table.meta.total > 0 && (
          <Pagination
            meta={table.meta}
            onPage={table.setPage}
            onPerPage={table.setPerPage}
          />
        )}
      </div>
    </>
  )
}